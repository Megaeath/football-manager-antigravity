/**
 * Match Engine V2 - 2D Spatial Replay Generator
 *
 * Produces a lightweight spatial replay with smooth ball travel.
 * The goal is visual clarity for V2 canvas playback rather than full parity
 * with the classic engine.
 */

import type { TeamMatchStats, TeamState, PlayerActionLog } from '../types';
import type {
    BallTransition,
    MatchFrame,
    SpatialPosition,
    V2BallState,
    V2MatchState,
    V2PlayerState,
    VisualEvent,
    TeamContext,
    GamePhase,
    RoleIntent,
    PassOption,
    DefensiveAssignment,
} from './types2d';
import { assignFormationPositions, clampToField, getDistance } from './formation';
import {
    generateMovementIntent,
    updatePlayerPosition,
    findNearbyPlayers,
    scorePassTargets,
    assignDefensiveRoles,
    applyTeamSpacingGuard,
} from './spatialEngine';
import { FIELD, TUNING_PARAMS, GK_SAVE_ZONES, SHOT_TARGET_SELECTION, PACE_SPEED_TABLE } from './config';
import { blendRoleIntent, generateSpecialistIntent } from './roleSpecialists';
import { V2TelemetryCollector, buildFrameDebug } from './telemetry';
import { BASE_DIRECT_RED_CHANCE, BASE_YELLOW_CARD_CHANCE, clamp } from '../../constants/disciplineInjury';
import { createSeededRandom, runWithV2Random, v2Random } from './random';

const TICKS_PER_MINUTE = TUNING_PARAMS.simulationTicksPerMinute;
const TOTAL_MINUTES = 90;
const TOTAL_TICKS = TOTAL_MINUTES * TICKS_PER_MINUTE;
const GOAL_MOUTH_CENTER_Y = FIELD.WIDTH / 2;
const GOAL_MOUTH_HALF_WIDTH = FIELD.GOAL.WIDTH / 2;
const GOAL_MOUTH_MIN_Y = GOAL_MOUTH_CENTER_Y - GOAL_MOUTH_HALF_WIDTH;
const GOAL_MOUTH_MAX_Y = GOAL_MOUTH_CENTER_Y + GOAL_MOUTH_HALF_WIDTH;

type ReplayAction =
    | { kind: 'PASS'; from: V2PlayerState; to: V2PlayerState; team: 'home' | 'away' }
    | {
        kind: 'DRIBBLE';
        from: V2PlayerState;
        team: 'home' | 'away';
        fromPosition: SpatialPosition;
        toPosition: SpatialPosition;
        isDuel: boolean;
        beatenDefenderId?: string;
    }
    | { kind: 'SHOT'; from: V2PlayerState; team: 'home' | 'away'; target: SpatialPosition; goalkeeper: V2PlayerState | null; outcome: ShotOutcome };

type ActiveTransition = {
    transition: BallTransition;
    startedAtTick: number;
    receivingPlayer: V2PlayerState | null;
    resultingPossession: 'home' | 'away';
    event: VisualEvent;
    outcome?: 'GOAL' | 'SAVED' | 'OFF_TARGET';
    followUp?: {
        transition: BallTransition;
        receivingPlayer: V2PlayerState | null;
        resultingPossession: TeamKey;
    };
};

type TeamKey = 'home' | 'away';

type ForcedDismissal = {
    playerId: string;
    minute: number;
    teamId?: string;
    reason?: string;
};

type ShotOutcome = {
    outcome: 'GOAL' | 'SAVED' | 'OFF_TARGET';
    target: SpatialPosition;
    resultingPossession: TeamKey;
    receivingPlayer: V2PlayerState | null;
    saveType?: 'CATCH' | 'PARRY';
    reboundTarget?: SpatialPosition;
};

function createEmptyTeamStats(): TeamMatchStats {
    return {
        possession: 0,
        corners: 0,
        offsides: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        shots: 0,
        shotsOnTarget: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        crossesAttempted: 0,
        crossesCompleted: 0,
        freeKicks: 0,
        throws: 0,
        tacklesAttempted: 0,
        tacklesWon: 0,
        dribblesAttempted: 0,
        dribblesWon: 0,
    };
}

function getZoneFromBallPosition(ballPosition: number): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    if (ballPosition <= 30) return 'DEFENSIVE';
    if (ballPosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
}

function resolveEventResult(event: VisualEvent): string {
    if (event.type === 'GOAL') return 'GOAL';
    if (event.type === 'SHOT') {
        const reason = String(event.metadata?.reason || '').toUpperCase();
        if (reason.startsWith('OFF_TARGET')) return 'OFF_TARGET';
        if (reason.startsWith('SAVED')) return 'SAVED';
        if (reason.startsWith('BLOCK')) return 'BLOCKED';
        return 'FAIL';
    }
    if (event.type === 'PASS' || event.type === 'DRIBBLE' || event.type === 'TACKLE' || event.type === 'SAVE') {
        return event.metadata?.success === false ? 'FAIL' : 'SUCCESS';
    }
    return 'SUCCESS';
}

function resolveEventTrickGroup(eventType: string): string {
    const type = String(eventType || '').toUpperCase();
    if (type.includes('PASS')) return 'PASS';
    if (type.includes('SHOT') || type === 'GOAL' || type === 'SAVE') return 'SHOT';
    if (type.includes('DRIBBLE')) return 'DRIBBLE';
    if (type.includes('TACKLE') || type.includes('INTERCEPTION')) return 'DEFENSE';
    if (type.includes('CARD') || type === 'FREE_KICK' || type === 'CORNER' || type === 'THROW_IN') return 'SET_PIECE';
    if (type.includes('SUB')) return 'SUBSTITUTION';
    return 'EVENT';
}

function createV2Player(player: TeamState['players'][number], side: TeamKey, fallback: SpatialPosition): V2PlayerState {
    return {
        ...player,
        side,
        position2D: { ...fallback },
        targetPosition: { ...fallback },
        velocity: { dx: 0, dy: 0 },
        isMovingToBall: false,
        isMarking: null,
        movementSpeed: 0,
        isSprinting: false,
        facingDirection: 0,
    };
}

function getPlayerPhaseState(player: V2PlayerState, carrier: V2PlayerState | null, possession: TeamKey): 'DEFENDING' | 'IN_POSSESSION' | 'ON_BALL' {
    if (carrier?.id === player.id) return 'ON_BALL';
    if (player.side === possession) return 'IN_POSSESSION';
    return 'DEFENDING';
}

function canAttemptShot(player: V2PlayerState, team: TeamKey): boolean {
    const minXHome = TUNING_PARAMS.shotMinXHomeByRole[player.position as keyof typeof TUNING_PARAMS.shotMinXHomeByRole] ?? 62;
    if (team === 'home') {
        return player.position2D.x >= minXHome;
    }
    return player.position2D.x <= 100 - minXHome;
}

function createBallTransition(
    type: BallTransition['type'],
    fromPosition: SpatialPosition,
    toPosition: SpatialPosition,
    fromPlayerId: string,
    minute: number,
    tick: number,
    success: boolean,
    toPlayerId?: string,
): BallTransition {
    const distance = getDistance(fromPosition, toPosition);
    const numericHeight = type === 'SHOT' || type === 'GOAL' || type === 'SAVE' ? 7 : distance > 22 ? 5 : 2;
    const duration = type === 'PASS'
        ? 1
        : type === 'GOAL'
            ? Math.max(3, Math.min(5, Math.round(distance / 7)))
            : type === 'SHOT' || type === 'SAVE'
                ? Math.max(2, Math.min(3, Math.round(distance / 10)))
                : Math.max(1, Math.min(2, Math.round(distance / 12)));
    const trajectory: SpatialPosition[] = [];

    const midX = (fromPosition.x + toPosition.x) / 2;
    const midY = (fromPosition.y + toPosition.y) / 2;
    const angle = Math.atan2(toPosition.y - fromPosition.y, toPosition.x - fromPosition.x);
    const lift = numericHeight * 0.18;
    const controlX = midX - Math.sin(angle) * lift;
    const controlY = midY + Math.cos(angle) * lift;

    for (let index = 0; index < duration; index += 1) {
        const t = duration === 1 ? 1 : index / (duration - 1);
        const inv = 1 - t;
        trajectory.push({
            x: inv * inv * fromPosition.x + 2 * inv * t * controlX + t * t * toPosition.x,
            y: inv * inv * fromPosition.y + 2 * inv * t * controlY + t * t * toPosition.y,
        });
    }

    return {
        type,
        fromPosition,
        toPosition,
        fromPlayerId,
        toPlayerId,
        minute,
        tick,
        success,
        trajectory,
        duration,
        ballHeight: numericHeight >= 6 ? 'aerial' : numericHeight >= 4 ? 'high' : numericHeight >= 2 ? 'low' : 'ground',
        description: type === 'GOAL'
            ? 'Goal-bound shot'
            : type === 'SHOT'
                ? 'Shot on frame'
                : type === 'SAVE'
                    ? 'Goalkeeper parry'
                    : 'Pass move',
    };
}

function getHeightZ(ballHeight: BallTransition['ballHeight'], progress: number): number {
    const peak = ballHeight === 'aerial' ? 8 : ballHeight === 'high' ? 6 : ballHeight === 'low' ? 3 : 0;
    return Math.max(0, 4 * peak * progress * (1 - progress));
}

function selectShotTarget(
    shooter: V2PlayerState,
    attackingTeam: TeamKey,
): SpatialPosition & { targetType: 'CORNER' | 'MID' | 'BLAST' | 'OFF_TARGET' } {
    const shooting = shooter.attributes?.shooting ?? 10;
    const composure = shooter.attributes?.composure ?? 10;
    const skillLevel = (shooting + composure) / 2;

    // Select skill tier
    let tier = SHOT_TARGET_SELECTION.normal;
    if (skillLevel >= 14) tier = SHOT_TARGET_SELECTION.veryGood;
    else if (skillLevel < 10) tier = SHOT_TARGET_SELECTION.poor;

    const rand = v2Random();
    let targetType: 'CORNER' | 'MID' | 'BLAST' | 'OFF_TARGET' = 'MID';
    let y: number;

    const goalWidthHalf = GOAL_MOUTH_HALF_WIDTH;
    const centerY = GOAL_MOUTH_CENTER_Y;

    if (rand < tier.cornerChance) {
        // Near-post / far-post shot but still inside the true goal mouth.
        targetType = 'CORNER';
        const isBottomCorner = v2Random() < 0.5;
        const postOffset = Math.max(0.6, goalWidthHalf - 0.4);
        y = isBottomCorner
            ? centerY - postOffset + v2Random() * 0.25
            : centerY + postOffset - v2Random() * 0.25;
    } else if (rand < tier.cornerChance + tier.midChance) {
        // Center shot inside goal mouth.
        targetType = 'MID';
        y = centerY + (v2Random() - 0.5) * Math.min(2.4, goalWidthHalf * 0.8);
    } else if (rand < tier.cornerChance + tier.midChance + tier.blastChance) {
        // Power shot inside goal mouth.
        targetType = 'BLAST';
        y = centerY + (v2Random() - 0.5) * Math.min(3.6, goalWidthHalf * 1.2);
    } else {
        // Off target
        targetType = 'OFF_TARGET';
        const missDirection = v2Random() < 0.5 ? -1 : 1;
        y = centerY + missDirection * (goalWidthHalf + 2 + v2Random() * 10);
    }

    // Clamp Y to field boundaries
    y = Math.max(5, Math.min(95, y));

    return {
        x: attackingTeam === 'home' ? FIELD.LENGTH - 1.5 : 1.5,
        y,
        targetType,
    };
}

function clampRoleX(
    player: V2PlayerState,
    desiredX: number,
    team: TeamKey,
    phaseState: 'DEFENDING' | 'IN_POSSESSION' | 'ON_BALL',
): number {
    const role = player.position;
    const isHome = team === 'home';

    const bounds = role === 'GK'
        ? { min: 2, max: 12 }
        : role === 'DR' || role === 'DL' || role === 'DC' || role === 'DMC' || role === 'DMR' || role === 'DML'
            ? { min: 8, max: 34 }
            : role === 'MR' || role === 'ML' || role === 'MC' || role === 'AMR' || role === 'AML' || role === 'AMC'
                ? { min: 18, max: 68 }
                : { min: 28, max: 82 };

    const expandForward = phaseState === 'ON_BALL'
        ? (role === 'FWC' || role === 'FWL' || role === 'FWR' || role === 'AMR' || role === 'AML' || role === 'AMC' ? 16 : role === 'MR' || role === 'ML' || role === 'MC' || role === 'DR' || role === 'DL' ? 10 : 6)
        : phaseState === 'IN_POSSESSION'
            ? (role === 'FWC' || role === 'FWL' || role === 'FWR' || role === 'AMR' || role === 'AML' || role === 'AMC' ? 10 : role === 'MR' || role === 'ML' || role === 'MC' || role === 'DR' || role === 'DL' ? 6 : 4)
            : 0;

    const expandBackward = phaseState === 'ON_BALL'
        ? (role === 'FWC' || role === 'FWL' || role === 'FWR' ? 10 : role === 'AMC' || role === 'AMR' || role === 'AML' || role === 'MC' ? 7 : 4)
        : phaseState === 'IN_POSSESSION'
            ? (role === 'FWC' || role === 'FWL' || role === 'FWR' ? 7 : role === 'AMC' || role === 'AMR' || role === 'AML' || role === 'MC' ? 5 : 3)
            : 0;

    const minX = Math.max(0, bounds.min - expandBackward);
    const maxX = Math.min(100, bounds.max + expandForward);

    if (isHome) {
        return Math.min(maxX, Math.max(minX, desiredX));
    }

    return Math.min(100 - minX, Math.max(100 - maxX, desiredX));
}

function getSecondLastDefenderLine(defendingPlayers: V2PlayerState[], defendingTeam: TeamKey): number {
    const sorted = defendingPlayers
        .map((player) => player.position2D.x)
        .sort((left, right) => left - right);

    if (sorted.length < 2) {
        return defendingTeam === 'home' ? 10 : 90;
    }

    return defendingTeam === 'home'
        ? sorted[1]
        : sorted[sorted.length - 2];
}

function applyOffsideSafeX(
    player: V2PlayerState,
    desiredX: number,
    attackingTeam: TeamKey,
    defendingPlayers: V2PlayerState[],
): number {
    if (!(player.position === 'FWR' || player.position === 'FWL' || player.position === 'FWC' || player.position === 'AMR' || player.position === 'AML' || player.position === 'AMC')) {
        return desiredX;
    }

    const offsideLine = getSecondLastDefenderLine(defendingPlayers, attackingTeam === 'home' ? 'away' : 'home');
    const safetyGap = 1.5;

    if (attackingTeam === 'home') {
        if (desiredX <= 50) return desiredX;
        return Math.min(desiredX, offsideLine - safetyGap);
    }

    if (desiredX >= 50) return desiredX;
    return Math.max(desiredX, offsideLine + safetyGap);
}

function createShotOutcome(
    shooter: V2PlayerState,
    attackingTeam: TeamKey,
    goalkeeper: V2PlayerState | null,
): ShotOutcome {
    // Step 1: Select shot target (Y-axis) based on shooting skill
    const shotTarget = selectShotTarget(shooter, attackingTeam);
    const targetY = shotTarget.y;
    const targetType = shotTarget.targetType;

    if (targetY < GOAL_MOUTH_MIN_Y || targetY > GOAL_MOUTH_MAX_Y) {
        const missTarget: SpatialPosition = {
            x: attackingTeam === 'home' ? FIELD.LENGTH + 2 : -2,
            y: Math.max(5, Math.min(95, targetY)),
        };
        return {
            outcome: 'OFF_TARGET',
            target: missTarget,
            resultingPossession: attackingTeam === 'home' ? 'away' : 'home',
            receivingPlayer: null,
        };
    }

    // Check if it's an off-target shot
    if (targetType === 'OFF_TARGET') {
        const missYDirection = v2Random() < 0.5 ? -1 : 1;
        const missOffsetY = FIELD.GOAL.WIDTH + 5 + v2Random() * 8;
        const missTarget: SpatialPosition = {
            x: attackingTeam === 'home' ? FIELD.LENGTH + 3 : -3,
            y: Math.max(5, Math.min(95, targetY + missOffsetY * missYDirection)),
        };
        return {
            outcome: 'OFF_TARGET',
            target: missTarget,
            resultingPossession: attackingTeam === 'home' ? 'away' : 'home',
            receivingPlayer: null,
        };
    }

    // Step 2: Determine GK save probability based on distance zone
    const shooterX = shooter.position2D.x;

    // Determine which zone (distance-based)
    let zone;

    if (attackingTeam === 'home') {
        if (shooterX >= GK_SAVE_ZONES.zone1_penaltyBox.xThresholdHome) {
            zone = GK_SAVE_ZONES.zone1_penaltyBox;
        } else if (shooterX >= GK_SAVE_ZONES.zone2_freeKickBox.xThresholdHome) {
            zone = GK_SAVE_ZONES.zone2_freeKickBox;
        } else {
            zone = GK_SAVE_ZONES.zone3_distance;
        }
    } else {
        if (shooterX <= GK_SAVE_ZONES.zone1_penaltyBox.xThresholdAway) {
            zone = GK_SAVE_ZONES.zone1_penaltyBox;
        } else if (shooterX <= GK_SAVE_ZONES.zone2_freeKickBox.xThresholdAway) {
            zone = GK_SAVE_ZONES.zone2_freeKickBox;
        } else {
            zone = GK_SAVE_ZONES.zone3_distance;
        }
    }

    // Step 3: Calculate save chance based on shot type and GK skill
    const shootingSkill = ((shooter.attributes?.shooting ?? 10) + (shooter.attributes?.composure ?? 10)) / 40;

    // Determine if it's a "simple" or "hard angle" shot
    const goalCenterY = FIELD.WIDTH / 2;
    const angleDistance = Math.abs(targetY - goalCenterY);
    const isHardAngle = angleDistance > 20;  // Y far from center = hard angle

    let saveChance = zone.baseSaveChance;

    if (targetType === 'BLAST') {
        // Simple shot: use simple shot probability
        saveChance = zone.simpleShot;
    } else if (isHardAngle) {
        // Hard angle/corner: reduce save chance
        saveChance = Math.max(0.05, zone.baseSaveChance - zone.angleBonus);
        // But add shooter skill bonus (good shooters beat GK more on hard angles)
        saveChance -= shootingSkill * zone.skillBonus;
    } else if (targetType === 'MID') {
        // Mid shot: standard save chance + skill adjustment
        saveChance -= shootingSkill * zone.skillBonus * 0.5;
    }

    // Apply GK skill bonus (higher agility/handling = more saves)
    if (goalkeeper) {
        const gkSkill = ((goalkeeper.attributes?.agility ?? 10) + (goalkeeper.attributes?.handling ?? 10) + (goalkeeper.attributes?.positioning ?? 10)) / 60;
        saveChance += gkSkill * 0.15;  // GK skill adds up to +15% save chance
    }

    // Clamp save chance to [0.05, 0.95]
    saveChance = Math.max(0.05, Math.min(0.95, saveChance));

    // Step 4: Determine outcome
    const targetPosition: SpatialPosition = {
        x: attackingTeam === 'home' ? FIELD.LENGTH - 1.5 : 1.5,
        y: targetY,
    };

    // Did the shot beat the GK or miss?
    if (v2Random() < saveChance) {
        // GK saves it
        const catchChance = 0.4 + (goalkeeper ? ((goalkeeper.attributes?.agility ?? 10) / 20) : 0) * 0.4;

        if (v2Random() < catchChance) {
            // Clean catch
            return {
                outcome: 'SAVED',
                target: goalkeeper ? { ...goalkeeper.position2D } : targetPosition,
                resultingPossession: attackingTeam === 'home' ? 'away' : 'home',
                receivingPlayer: goalkeeper,
                saveType: 'CATCH',
            };
        }

        // Parry/rebound
        const reboundSide = v2Random() < 0.5 ? -1 : 1;
        const reboundTarget: SpatialPosition = {
            x: attackingTeam === 'home'
                ? Math.max(72, FIELD.GOAL.POSITION_AWAY - (8 + v2Random() * 12))
                : Math.min(28, FIELD.GOAL.POSITION_HOME + (8 + v2Random() * 12)),
            y: Math.max(6, Math.min(94, targetY + reboundSide * (8 + v2Random() * 10))),
        };

        return {
            outcome: 'SAVED',
            target: goalkeeper ? { ...goalkeeper.position2D } : targetPosition,
            resultingPossession: attackingTeam === 'home' ? 'away' : 'home',
            receivingPlayer: null,
            saveType: 'PARRY',
            reboundTarget,
        };
    }

    // Goal!
    return {
        outcome: 'GOAL',
        target: targetPosition,
        resultingPossession: attackingTeam === 'home' ? 'away' : 'home',
        receivingPlayer: null,
    };
}

function pickReboundReceiver(
    reboundTarget: SpatialPosition,
    attackingPlayers: V2PlayerState[],
    defendingPlayers: V2PlayerState[],
): V2PlayerState | null {
    const candidates = [...attackingPlayers, ...defendingPlayers]
        .map((player) => {
            const distance = getDistance(player.position2D, reboundTarget);
            const speed = ((player.attributes.pace || 10) + (player.attributes.acceleration || 10)) / 2;
            const defensiveClearBonus = player.side === defendingPlayers[0]?.side
                && (player.position === 'DL' || player.position === 'DR' || player.position === 'DMC')
                ? -0.8
                : 0;
            const sprintBoost = speed / 35;
            const score = distance + defensiveClearBonus - sprintBoost + v2Random() * 1.2;
            return { player, score };
        })
        .sort((a, b) => a.score - b.score);

    return candidates[0]?.player || null;
}

function choosePassOption(
    carrier: V2PlayerState,
    teammates: V2PlayerState[],
    opponents: V2PlayerState[],
    ball: V2BallState,
    teamContext: TeamContext,
): PassOption | null {
    const options = scorePassTargets(carrier, teammates, opponents, ball, teamContext);
    if (options.length === 0) {
        return null;
    }

    const topOptions = options.slice(0, Math.min(TUNING_PARAMS.passTopOptions, options.length));
    const sumUtility = topOptions.reduce((sum, option) => sum + Math.max(0.01, option.utility), 0);
    let roll = v2Random() * sumUtility;

    for (const option of topOptions) {
        roll -= Math.max(0.01, option.utility);
        if (roll <= 0) {
            return option;
        }
    }

    return topOptions[0] || null;
}

function clampAttribute20(value: number | undefined): number {
    const numeric = Number.isFinite(value as number) ? Number(value) : 10;
    return Math.max(1, Math.min(20, Math.round(numeric)));
}

function getTopSpeedFromPace(pace: number): number {
    return PACE_SPEED_TABLE[pace] ?? (5 + pace * 0.25);
}

function getMovementTopSpeedForPlayer(
    player: V2PlayerState,
    minute: number,
    hasBall: boolean,
): number {
    const pace = clampAttribute20(player.attributes?.pace);
    const stamina = clampAttribute20(player.attributes?.stamina);
    let topSpeed = getTopSpeedFromPace(pace);

    if (hasBall) {
        topSpeed *= TUNING_PARAMS.onBallSpeedMultiplier;
    }

    const conditionFactor = Math.max(0.55, Math.min(1, (player.condition || 100) / 100));
    topSpeed *= conditionFactor;

    if (minute >= 70) {
        const fatigueProgress = Math.min(1, (minute - 70) / 20);
        const staminaResilience = 0.7 + (stamina / 20) * 0.3;
        const lateGameFactor = 1 - fatigueProgress * (1 - staminaResilience);
        topSpeed *= lateGameFactor;
    }

    return Math.max(0, topSpeed);
}

function estimateReachDistance(
    player: V2PlayerState,
    minute: number,
    travelSeconds: number,
): number {
    if (travelSeconds <= 0) return 0;

    const topSpeed = getMovementTopSpeedForPlayer(player, minute, false);
    const acceleration = clampAttribute20(player.attributes?.acceleration ?? player.attributes?.pace);
    const accelerationTime =
        TUNING_PARAMS.accelerationTimeMaxSec -
        ((acceleration - 1) / 19) * (TUNING_PARAMS.accelerationTimeMaxSec - TUNING_PARAMS.accelerationTimeMinSec);
    const accelTime = Math.max(0.1, accelerationTime);
    const accelerationPerSecond = topSpeed / accelTime;

    if (travelSeconds <= accelTime) {
        return 0.5 * accelerationPerSecond * travelSeconds * travelSeconds;
    }

    const accelDistance = 0.5 * accelerationPerSecond * accelTime * accelTime;
    const cruiseDistance = topSpeed * (travelSeconds - accelTime);
    return accelDistance + cruiseDistance;
}

function clampDisplacementToReachableDistance(
    previousPosition: SpatialPosition,
    nextPosition: SpatialPosition,
    maxDistance: number,
): SpatialPosition {
    const distance = getDistance(previousPosition, nextPosition);
    if (distance <= maxDistance || distance <= 0.0001) {
        return { ...nextPosition };
    }

    const ratio = maxDistance / distance;
    return {
        x: previousPosition.x + (nextPosition.x - previousPosition.x) * ratio,
        y: previousPosition.y + (nextPosition.y - previousPosition.y) * ratio,
    };
}

function enforcePerTickMovementCap(
    players: V2PlayerState[],
    previousPositionByPlayer: Map<string, SpatialPosition>,
    minute: number,
    carrierId?: string | null,
): void {
    players.forEach((player) => {
        const previousPosition = previousPositionByPlayer.get(player.id);
        if (!previousPosition) return;

        const maxDistance = estimateReachDistance(
            player,
            minute,
            TUNING_PARAMS.movementTickSeconds,
        );
        const clampedPosition = clampDisplacementToReachableDistance(
            previousPosition,
            player.position2D,
            maxDistance,
        );

        if (clampedPosition.x !== player.position2D.x || clampedPosition.y !== player.position2D.y) {
            const movedDistance = getDistance(previousPosition, player.position2D);
            player.position2D = clampToField(clampedPosition);
            player.velocity = {
                dx: player.position2D.x - previousPosition.x,
                dy: player.position2D.y - previousPosition.y,
            };
            player.movementSpeed = getDistance(previousPosition, player.position2D) / Math.max(0.01, TUNING_PARAMS.movementTickSeconds);

            if (minute % 10 === 0) {
                console.log(
                    `[V2-MOVE] Clamp ${player.position} ${player.id.slice(0, 8)} from ${movedDistance.toFixed(2)} to ${maxDistance.toFixed(2)} units`,
                );
            }
        }

        if (player.id === carrierId) {
            player.targetPosition = { ...player.position2D };
        }
    });
}

function getPassTravelTicks(distance: number): number {
    return Math.max(6, Math.min(18, Math.round(distance / 2.2)));
}

function getDistanceToSegment(point: SpatialPosition, from: SpatialPosition, to: SpatialPosition): { distance: number; projection: number } {
    const segmentDx = to.x - from.x;
    const segmentDy = to.y - from.y;
    const lenSq = segmentDx * segmentDx + segmentDy * segmentDy;
    if (lenSq <= 0.0001) {
        return { distance: getDistance(point, from), projection: 0 };
    }

    const pointDx = point.x - from.x;
    const pointDy = point.y - from.y;
    const projection = Math.max(0, Math.min(1, (pointDx * segmentDx + pointDy * segmentDy) / lenSq));
    const closestX = from.x + projection * segmentDx;
    const closestY = from.y + projection * segmentDy;
    return {
        distance: getDistance(point, { x: closestX, y: closestY }),
        projection,
    };
}

function findShortPassLaneBlocker(
    from: SpatialPosition,
    to: SpatialPosition,
    defenders: V2PlayerState[],
): V2PlayerState | null {
    const radius = Math.max(0.5, Number(TUNING_PARAMS.passLaneBlockRadius || 2));
    const blockers = defenders
        .map((defender) => {
            const segment = getDistanceToSegment(defender.position2D, from, to);
            return { defender, ...segment };
        })
        .filter((entry) => entry.distance <= radius)
        .filter((entry) => entry.projection >= 0.05 && entry.projection <= 0.95)
        .sort((left, right) => {
            if (left.projection !== right.projection) return left.projection - right.projection;
            return left.distance - right.distance;
        });

    return blockers[0]?.defender || null;
}

function isGoalkeeper(player: V2PlayerState): boolean {
    return String(player.position || '').toUpperCase() === 'GK';
}

function getBackwardDistance(from: SpatialPosition, to: SpatialPosition, team: TeamKey): number {
    return team === 'home'
        ? Math.max(0, from.x - to.x)
        : Math.max(0, to.x - from.x);
}

function isAdvancedCarrierZone(carrier: V2PlayerState, team: TeamKey): boolean {
    return team === 'home' ? carrier.position2D.x >= 70 : carrier.position2D.x <= 30;
}

function buildSafePassCandidates(
    carrier: V2PlayerState,
    teammates: V2PlayerState[],
    defenders: V2PlayerState[],
    team: TeamKey,
): V2PlayerState[] {
    const advancedCarrier = isAdvancedCarrierZone(carrier, team);

    return teammates
        .filter((player) => player.id !== carrier.id)
        .filter((player) => {
            const distance = getDistance(carrier.position2D, player.position2D);
            if (distance > 34) return false;

            const backwardDistance = getBackwardDistance(carrier.position2D, player.position2D, team);
            if (backwardDistance > 18) return false;
            if (advancedCarrier && backwardDistance > 10) return false;

            if (advancedCarrier && isGoalkeeper(player)) return false;

            const isShort = distance <= Number(TUNING_PARAMS.passShortDistanceThreshold || 18);
            if (isShort && findShortPassLaneBlocker(carrier.position2D, player.position2D, defenders)) {
                return false;
            }

            return true;
        });
}

function pickQuickDistributionTarget(
    goalkeeper: V2PlayerState,
    teammates: V2PlayerState[],
    defenders: V2PlayerState[],
    team: TeamKey,
): V2PlayerState {
    const candidates = buildSafePassCandidates(goalkeeper, teammates, defenders, team)
        .filter((player) => !isGoalkeeper(player));

    const fallbackPool = teammates
        .filter((player) => player.id !== goalkeeper.id)
        .filter((player) => !isGoalkeeper(player));

    const ranked = (candidates.length > 0 ? candidates : fallbackPool)
        .slice()
        .sort((left, right) => {
            const leftDistance = getDistance(goalkeeper.position2D, left.position2D);
            const rightDistance = getDistance(goalkeeper.position2D, right.position2D);
            const leftBackward = getBackwardDistance(goalkeeper.position2D, left.position2D, team);
            const rightBackward = getBackwardDistance(goalkeeper.position2D, right.position2D, team);

            const leftScore = leftDistance + leftBackward * 0.9;
            const rightScore = rightDistance + rightBackward * 0.9;
            return leftScore - rightScore;
        });

    return ranked[0] || goalkeeper;
}

function findNearestDefenderToPoint(
    point: SpatialPosition,
    defenders: V2PlayerState[],
): { defender: V2PlayerState; distance: number } | null {
    if (!defenders.length) return null;
    const sorted = defenders
        .map((defender) => ({ defender, distance: getDistance(defender.position2D, point) }))
        .sort((left, right) => left.distance - right.distance);
    return sorted[0] || null;
}

function resolveShortPassReceiverContest(
    passer: V2PlayerState,
    receiver: V2PlayerState,
    defenders: V2PlayerState[],
): V2PlayerState | null {
    const nearest = findNearestDefenderToPoint(receiver.position2D, defenders);
    const contestRadius = Math.max(0.5, Number(TUNING_PARAMS.passReceiverContestRadius || 2));
    if (!nearest || nearest.distance > contestRadius) return null;

    const defenderScore = (nearest.defender.attributes?.tackling || 10) + (nearest.defender.attributes?.positioning || 10);
    const receiverSecureScore =
        (receiver.attributes?.positioning || 10)
        + (receiver.attributes?.composure || receiver.attributes?.dribbling || 10)
        + (passer.attributes?.passing || 10) * 0.35;

    return defenderScore > receiverSecureScore ? nearest.defender : null;
}

function resolveLongPassArrivalContest(
    passer: V2PlayerState,
    receiver: V2PlayerState,
    defenders: V2PlayerState[],
    minute: number,
    passTravelTicks: number,
): V2PlayerState | null {
    const nearest = findNearestDefenderToPoint(receiver.position2D, defenders);
    if (!nearest) return null;

    const contestRadius = Math.max(0.5, Number(TUNING_PARAMS.longPassArrivalContestRadius || 2));
    const travelSeconds = passTravelTicks * TUNING_PARAMS.movementTickSeconds;
    const reachableDistance = estimateReachDistance(nearest.defender, minute, travelSeconds);
    const requiredDistance = Math.max(0, nearest.distance - contestRadius);

    if (reachableDistance < requiredDistance) {
        return null;
    }

    const defenderScore =
        (nearest.defender.attributes?.tackling || 10)
        + (nearest.defender.attributes?.heading || 10)
        + (nearest.defender.attributes?.positioning || 10);
    const receiverScore =
        (receiver.attributes?.heading || 10)
        + (receiver.attributes?.positioning || 10)
        + (receiver.attributes?.composure || receiver.attributes?.dribbling || 10)
        + (passer.attributes?.passing || 10) * 0.25;

    return defenderScore > receiverScore ? nearest.defender : null;
}

function lineHeightToX(team: TeamKey, lineHeight: number): number {
    const clamped = Math.max(0, Math.min(100, lineHeight));
    if (team === 'home') {
        return 10 + clamped * 0.36;
    }
    return 90 - clamped * 0.36;
}

function getMentalityProfile(mentality: string) {
    switch (mentality) {
        case 'ULTRA_DEFENSIVE':
            return { defendLine: 30, defendPressure: 34, possessLine: 46, possessPressure: 48 };
        case 'DEFENSIVE':
            return { defendLine: 38, defendPressure: 42, possessLine: 52, possessPressure: 56 };
        case 'ATTACKING':
            return { defendLine: 48, defendPressure: 56, possessLine: 64, possessPressure: 72 };
        case 'ALL_OUT_ATTACK':
            return { defendLine: 54, defendPressure: 64, possessLine: 72, possessPressure: 82 };
        case 'NORMAL':
        default:
            return { defendLine: 45, defendPressure: 48, possessLine: 58, possessPressure: 66 };
    }
}

function isWideBallCarrier(player: V2PlayerState): boolean {
    const pos = player.position;
    return pos === 'MR' || pos === 'ML' || pos === 'AMR' || pos === 'AML' || pos === 'FWR' || pos === 'FWL' || pos === 'DR' || pos === 'DL';
}

function countFrontBlockers(
    carrier: V2PlayerState,
    defenders: V2PlayerState[],
    team: TeamKey,
): number {
    const lookAhead = TUNING_PARAMS.dribbleLookAheadDistance;
    const halfWidth = TUNING_PARAMS.dribbleLaneHalfWidth;

    return defenders.filter((defender) => {
        const ahead = team === 'home'
            ? defender.position2D.x > carrier.position2D.x && defender.position2D.x <= carrier.position2D.x + lookAhead
            : defender.position2D.x < carrier.position2D.x && defender.position2D.x >= carrier.position2D.x - lookAhead;
        const lane = Math.abs(defender.position2D.y - carrier.position2D.y) <= halfWidth;
        return ahead && lane;
    }).length;
}

function findBeatenDefender(
    start: SpatialPosition,
    end: SpatialPosition,
    defenders: V2PlayerState[],
    team: TeamKey,
): V2PlayerState | null {
    const candidates = defenders.filter((defender) => {
        const laneDistance = Math.abs(defender.position2D.y - start.y);
        if (laneDistance > TUNING_PARAMS.dribbleLaneHalfWidth + 1.5) return false;

        const wasAhead = team === 'home'
            ? defender.position2D.x > start.x && defender.position2D.x <= start.x + TUNING_PARAMS.dribbleLookAheadDistance + 2
            : defender.position2D.x < start.x && defender.position2D.x >= start.x - TUNING_PARAMS.dribbleLookAheadDistance - 2;
        if (!wasAhead) return false;

        const passed = team === 'home'
            ? end.x >= defender.position2D.x + 0.6
            : end.x <= defender.position2D.x - 0.6;
        return passed;
    });

    if (candidates.length === 0) return null;

    return candidates
        .slice()
        .sort((a, b) => Math.abs(a.position2D.x - start.x) - Math.abs(b.position2D.x - start.x))[0] || null;
}

function isNearBylineCrossZone(player: V2PlayerState, team: TeamKey): boolean {
    const nearGoalLine = team === 'home'
        ? player.position2D.x >= TUNING_PARAMS.crossBylineXHome
        : player.position2D.x <= TUNING_PARAMS.crossBylineXAway;

    const wideY = player.position2D.y <= TUNING_PARAMS.crossWideYThreshold
        || player.position2D.y >= FIELD.WIDTH - TUNING_PARAMS.crossWideYThreshold;

    return nearGoalLine && wideY;
}

function pickCrossTarget(attackingPlayers: V2PlayerState[], team: TeamKey, crosserId: string): V2PlayerState | null {
    const boxCandidates = attackingPlayers
        .filter((player) => player.id !== crosserId)
        .filter((player) => team === 'home' ? player.position2D.x >= 78 : player.position2D.x <= 22)
        .sort((a, b) => {
            const aGoalDist = team === 'home' ? FIELD.LENGTH - a.position2D.x : a.position2D.x;
            const bGoalDist = team === 'home' ? FIELD.LENGTH - b.position2D.x : b.position2D.x;
            return aGoalDist - bGoalDist;
        });

    return boxCandidates[0] || null;
}

function pickKickoffCarrier(players: V2PlayerState[]): V2PlayerState | null {
    if (players.length === 0) return null;

    const priority = players.filter((player) =>
        player.position === 'FWC'
        || player.position === 'FWL'
        || player.position === 'FWR'
        || player.position === 'AMC'
        || player.position === 'MC',
    );

    const pool = priority.length > 0 ? priority : players;
    const center = { x: FIELD.LENGTH / 2, y: FIELD.WIDTH / 2 };

    return pool
        .slice()
        .sort((left, right) => getDistance(left.position2D, center) - getDistance(right.position2D, center))[0] || null;
}

function normalizeKickoffHalfShape(
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
    kickoffCarrierId?: string,
): void {
    const isForwardLineRole = (player: V2PlayerState) => (
        player.position === 'FWC'
        || player.position === 'FWL'
        || player.position === 'FWR'
        || player.position === 'AMC'
        || player.position === 'AMR'
        || player.position === 'AML'
    );

    homePlayers.forEach((player) => {
        if (!isPlayerActive(player)) return;
        const maxX = 50;
        const clampedX = Math.min(maxX, player.position2D.x);
        const kickoffSafeX = isForwardLineRole(player) ? Math.min(50, clampedX) : clampedX;
        player.position2D = clampToField({ x: kickoffSafeX, y: player.position2D.y });
        player.targetPosition = { ...player.position2D };
        player.velocity = { dx: 0, dy: 0 };
    });

    awayPlayers.forEach((player) => {
        if (!isPlayerActive(player)) return;
        const minX = 50;
        const clampedX = Math.max(minX, player.position2D.x);
        const kickoffSafeX = isForwardLineRole(player) ? Math.max(50, clampedX) : clampedX;
        player.position2D = clampToField({ x: kickoffSafeX, y: player.position2D.y });
        player.targetPosition = { ...player.position2D };
        player.velocity = { dx: 0, dy: 0 };
    });

    if (kickoffCarrierId) {
        const kickoffCarrier = homePlayers.find((player) => player.id === kickoffCarrierId)
            || awayPlayers.find((player) => player.id === kickoffCarrierId);
        if (kickoffCarrier) {
            kickoffCarrier.position2D = { x: FIELD.LENGTH / 2, y: FIELD.WIDTH / 2 };
            kickoffCarrier.targetPosition = { ...kickoffCarrier.position2D };
            kickoffCarrier.velocity = { dx: 0, dy: 0 };
        }
    }
}

function pickGoalKickCarrier(players: V2PlayerState[]): V2PlayerState | null {
    const activePlayers = players.filter((player) => isPlayerActive(player));
    if (activePlayers.length === 0) return null;
    const goalkeeper = activePlayers.find((player) => player.position === 'GK');
    return goalkeeper || activePlayers[0] || null;
}

function resetBallForGoalKick(
    goalKickSide: TeamKey,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
    ball: V2BallState,
    targetY?: number,
): { possession: TeamKey; carrier: V2PlayerState | null; position: SpatialPosition } {
    const goalKickPlayers = goalKickSide === 'home' ? homePlayers : awayPlayers;
    const goalKickCarrier = pickGoalKickCarrier(goalKickPlayers);
    const goalKickY = Math.max(18, Math.min(82, Number.isFinite(targetY as number) ? Number(targetY) : FIELD.WIDTH / 2));
    const goalKickPosition: SpatialPosition = {
        x: goalKickSide === 'home' ? 6 : FIELD.LENGTH - 6,
        y: goalKickY,
    };

    if (goalKickCarrier) {
        goalKickCarrier.position2D = { ...goalKickPosition };
        goalKickCarrier.targetPosition = { ...goalKickPosition };
        goalKickCarrier.velocity = { dx: 0, dy: 0 };
    }

    ball.position = { ...goalKickPosition };
    ball.velocity = { dx: 0, dy: 0 };
    ball.z = 0;
    ball.possession = goalKickSide;
    ball.carrier = goalKickCarrier;

    return {
        possession: goalKickSide,
        carrier: goalKickCarrier,
        position: goalKickPosition,
    };
}

function resetBallForKickoff(
    kickoffTeam: TeamKey,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
    ball: V2BallState,
): { possession: TeamKey; carrier: V2PlayerState | null } {
    const center = { x: FIELD.LENGTH / 2, y: FIELD.WIDTH / 2 };
    const kickoffPlayers = kickoffTeam === 'home' ? homePlayers : awayPlayers;
    const kickoffCarrier = pickKickoffCarrier(kickoffPlayers);

    normalizeKickoffHalfShape(homePlayers, awayPlayers, kickoffCarrier?.id);

    if (kickoffCarrier) {
        kickoffCarrier.position2D = { ...center };
        kickoffCarrier.targetPosition = { ...center };
        kickoffCarrier.velocity = { dx: 0, dy: 0 };
    }

    ball.position = { ...center };
    ball.velocity = { dx: 0, dy: 0 };
    ball.z = 0;
    ball.possession = kickoffTeam;
    ball.carrier = kickoffCarrier;

    return {
        possession: kickoffTeam,
        carrier: kickoffCarrier,
    };
}

function shouldResolveCarrierAction(
    absoluteTick: number,
    carrier: V2PlayerState,
    defenders: V2PlayerState[],
): boolean {
    // GK acts immediately — no throttle delay when goalkeeper has the ball
    if (carrier.position === 'GK') return true;

    if (absoluteTick % TUNING_PARAMS.actionDecisionIntervalTicks === 0) {
        return true;
    }

    const closePressure = findNearbyPlayers(carrier.position2D, defenders, TUNING_PARAMS.dribblePressureRadius);
    return closePressure.length > 0;
}

function applyFormationCoordinates(team: TeamState, players: V2PlayerState[], isHomeTeam: boolean): Record<string, SpatialPosition> {
    const baseCoords = assignFormationPositions(team, team.tactics.formation, isHomeTeam);
    const coords = baseCoords;
    const result: Record<string, SpatialPosition> = {};

    players.forEach((player) => {
        const coord = coords.get(player.id) || player.position2D;
        const clamped = clampToField(coord);
        player.position2D = { ...clamped };
        player.targetPosition = { ...clamped };
        result[player.id] = { ...clamped };
    });

    return result;
}

/**
 * Phase 1: Build team context for per-tick game state
 * This provides strategic framework for role-intent modules
 */
function buildTeamContext(
    tick: number,
    minute: number,
    possession: 'home' | 'away',
    score: { home: number; away: number },
    ballPosition: SpatialPosition,
    homeMentality: string,
    awayMentality: string,
): { home: TeamContext; away: TeamContext } {
    const homeScore = score.home;
    const awayScore = score.away;
    
    // Determine game phase (simplified model for Phase 1)
    // Will be expanded in Phase 2-3
    let gamePhase: GamePhase = 'SETTLED_DEFENSE';
    
    if (possession === 'home') {
        if (ballPosition.x < 35) {
            gamePhase = 'BUILD_UP';
        } else if (ballPosition.x > 65) {
            gamePhase = 'ATTACK';
        } else {
            gamePhase = 'ATTACK';
        }
    } else {
        if (ballPosition.x > 65) {
            gamePhase = 'BUILD_UP';
        } else if (ballPosition.x < 35) {
            gamePhase = 'DEFEND';
        } else {
            gamePhase = 'DEFEND';
        }
    }
    
    const homeProfile = getMentalityProfile(homeMentality);
    const awayProfile = getMentalityProfile(awayMentality);

    // Pressure/line: mentality aware (NORMAL should stay in zones, not collapse deep)
    const pressureHome = possession === 'home' ? homeProfile.possessPressure : homeProfile.defendPressure;
    const pressureAway = possession === 'away' ? awayProfile.possessPressure : awayProfile.defendPressure;
    const lineHeightHome = possession === 'home' ? homeProfile.possessLine : homeProfile.defendLine;
    const lineHeightAway = possession === 'away' ? awayProfile.possessLine : awayProfile.defendLine;
    
    // Transition mode based on recent possession change
    const transitionMode: 'FAST_BREAK' | 'SETTLED' | 'COUNTER_PRESS' = (tick % 20 < 5) ? 'FAST_BREAK' : 'SETTLED';
    
    // Score state affects mentality
    const homeScoreState = {
        isLeading: homeScore > awayScore,
        isDraw: homeScore === awayScore,
        isTrailing: homeScore < awayScore,
        minutesRemaining: 90 - minute,
    };
    
    const awayScoreState = {
        isLeading: awayScore > homeScore,
        isDraw: awayScore === homeScore,
        isTrailing: awayScore < homeScore,
        minutesRemaining: 90 - minute,
    };
    
    return {
        home: {
            tick,
            minute,
            phase: possession === 'home' ? gamePhase : 'SETTLED_DEFENSE',
            pressure: pressureHome,
            lineHeight: lineHeightHome,
            ballSide: ballPosition.x >= 50 ? 'ATTACKING' : 'DEFENSIVE',
            ballPosition: { ...ballPosition },
            transitionMode,
            scoreState: homeScoreState,
        },
        away: {
            tick,
            minute,
            phase: possession === 'away' ? gamePhase : 'SETTLED_DEFENSE',
            pressure: pressureAway,
            lineHeight: lineHeightAway,
            ballSide: ballPosition.x >= 50 ? 'ATTACKING' : 'DEFENSIVE',
            ballPosition: { ...ballPosition },
            transitionMode,
            scoreState: awayScoreState,
        },
    };
}

// ============================================================
// SUBSTITUTION HELPERS
// ============================================================

function isPlayerSentOff(player: V2PlayerState): boolean {
    return player.cards.red > 0;
}

function isPlayerActive(player: V2PlayerState): boolean {
    return player.tacticalPosition !== null && !isPlayerSentOff(player);
}

function getActivePlayers(players: V2PlayerState[]): V2PlayerState[] {
    return players.filter((player) => isPlayerActive(player));
}

function getPositionGroup(pos: string): string {
    if (pos === 'GK') return 'GK';
    if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos)) return 'DEF';
    if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos)) return 'MID';
    if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos)) return 'FWD';
    return 'MID';
}

function attemptV2Substitutions(
    players: V2PlayerState[],
    playerStats: Record<string, V2MatchState['playerStats'][string]>,
    events: VisualEvent[],
    minute: number,
    subsUsed: number,
    maxSubs: number = 5,
    teamId: string = '',
): number {
    if (subsUsed >= maxSubs) return subsUsed;
    if (minute < 55) return subsUsed;

    // Players that already came on should never be substituted out again
    const subbedInIds = new Set(
        events
            .filter((e) => e.type === 'SUBSTITUTION' && e.teamId === teamId)
            .map((e) => e.metadata?.playerInId)
            .filter(Boolean),
    );

    const starters = players.filter(
        (p) => p.tacticalPosition !== null && p.position !== 'GK' && !subbedInIds.has(p.id) && !isPlayerSentOff(p),
    );
    const availableBench = players.filter(
        (p) =>
            p.tacticalPosition === null &&
            p.position !== 'GK' &&
            !isPlayerSentOff(p) &&
            !p.isInjured &&
            !p.isSuspended,
    );

    if (availableBench.length === 0) return subsUsed;

    const tiredStarters = starters
        .filter((p) => p.condition < 70)
        .sort((a, b) => a.condition - b.condition);

    for (const outPlayer of tiredStarters) {
        if (subsUsed >= maxSubs) break;

        const slotBase = outPlayer.tacticalPosition ? outPlayer.tacticalPosition.split('_')[0] : outPlayer.position;
        const outGroup = getPositionGroup(slotBase);

        const samePosition = availableBench.filter((p) => p.position === slotBase);
        const sameGroup = availableBench.filter((p) => getPositionGroup(p.position) === outGroup);
        const midGroup = availableBench.filter((p) => getPositionGroup(p.position) === 'MID');

        const pickBest = (list: V2PlayerState[]) => list.sort((a, b) => b.condition - a.condition)[0];

        let bestBench = pickBest(samePosition);
        if (!bestBench) bestBench = pickBest(sameGroup);
        if (!bestBench && (outGroup === 'DEF' || outGroup === 'FWD')) bestBench = pickBest(midGroup);
        if (!bestBench) bestBench = pickBest(availableBench);

        if (!bestBench) continue;

        // Perform substitution
        const outSlot = outPlayer.tacticalPosition;
        outPlayer.tacticalPosition = null;
        bestBench.tacticalPosition = outSlot;

        // Update player stats
        if (playerStats[outPlayer.id]) {
            playerStats[outPlayer.id].minutes = Math.min(playerStats[outPlayer.id].minutes, minute);
        }
        if (playerStats[bestBench.id]) {
            playerStats[bestBench.id].minutes = Math.max(playerStats[bestBench.id].minutes, 90 - minute);
        }

        // Create substitution event
        const subEvent: VisualEvent = {
            id: `sub_${minute}_${outPlayer.id}`,
            type: 'SUBSTITUTION',
            minute,
            tick: 0,
            position: { ...outPlayer.position2D },
            playerId: bestBench.id,
            playerName: bestBench.name,
            teamId,
            metadata: {
                playerOutId: outPlayer.id,
                playerOutName: outPlayer.name,
                playerInId: bestBench.id,
                playerInName: bestBench.name,
                text: `🔄 Substitution: ${outPlayer.name} off, ${bestBench.name} on (${minute}')`,
            },
        };

        events.push(subEvent);
        subsUsed += 1;

        // Remove from available bench
        const removeIdx = availableBench.findIndex((p) => p.id === bestBench.id);
        if (removeIdx >= 0) {
            availableBench.splice(removeIdx, 1);
        }
    }

    return subsUsed;
}

function getSetPieceTaker(players: V2PlayerState[], kind: 'THROW' | 'CORNER' | 'FREE_KICK'): V2PlayerState | null {
    const onField = players.filter((p) => isPlayerActive(p));
    if (onField.length === 0) return null;

    if (kind === 'THROW') {
        const isPreferredThrowRole = (p: V2PlayerState) => {
            const role = String(p.position || '').toUpperCase();
            return role === 'DR' || role === 'DL' || role === 'DMR' || role === 'DML';
        };

        const preferred = onField.filter((p) => isPreferredThrowRole(p));
        const highThrow = onField.filter((p) => (p.attributes.throw || 0) >= 13);
        const candidates = preferred.length > 0 ? preferred : (highThrow.length > 0 ? highThrow : onField);

        return [...candidates].sort((a, b) => {
            const aRoleBonus = isPreferredThrowRole(a) ? 4 : 0;
            const bRoleBonus = isPreferredThrowRole(b) ? 4 : 0;
            const aScore = (a.attributes.throw || 0) + (a.attributes.passing || 0) * 0.35 + aRoleBonus;
            const bScore = (b.attributes.throw || 0) + (b.attributes.passing || 0) * 0.35 + bRoleBonus;
            return bScore - aScore;
        })[0] || null;
    }

    const sorted = [...onField].sort((a, b) => {
        if (kind === 'CORNER') {
            return (b.attributes.setPieces + b.attributes.crossing) - (a.attributes.setPieces + a.attributes.crossing);
        }
        return (b.attributes.setPieces + b.attributes.passing + b.attributes.shooting) - (a.attributes.setPieces + a.attributes.passing + a.attributes.shooting);
    });
    return sorted[0] || null;
}

function pickCornerBoxTarget(players: V2PlayerState[], takerId?: string): V2PlayerState | null {
    const onField = players.filter((p) => isPlayerActive(p) && p.id !== takerId);
    if (onField.length === 0) return null;

    const preferred = onField.filter((p) => {
        const role = String(p.position || '').toUpperCase();
        return role === 'DC' || role === 'DCL' || role === 'DCR' || role === 'FWC' || role === 'FWR' || role === 'FWL';
    });
    const candidates = preferred.length > 0 ? preferred : onField;

    return [...candidates].sort((a, b) => {
        const aScore = (a.attributes.heading || 0) * 0.55 + (a.attributes.positioning || 0) * 0.3 + (a.attributes.bravery || 0) * 0.15;
        const bScore = (b.attributes.heading || 0) * 0.55 + (b.attributes.positioning || 0) * 0.3 + (b.attributes.bravery || 0) * 0.15;
        return bScore - aScore;
    })[0] || null;
}

function applyCornerBoxShape(awardSide: TeamKey, players: V2PlayerState[], takerId?: string): void {
    const attackers = players
        .filter((p) => isPlayerActive(p) && p.id !== takerId)
        .filter((p) => {
            const role = String(p.position || '').toUpperCase();
            return role === 'DC' || role === 'DCL' || role === 'DCR' || role === 'FWC' || role === 'FWR' || role === 'FWL';
        })
        .sort((a, b) => ((b.attributes.heading || 0) + (b.attributes.positioning || 0)) - ((a.attributes.heading || 0) + (a.attributes.positioning || 0)))
        .slice(0, 4);

    const anchorX = awardSide === 'home' ? 90 : 10;
    const ySlots = [40, 47, 53, 60];
    attackers.forEach((player, idx) => {
        player.position2D = clampToField({ x: anchorX + (awardSide === 'home' ? idx * 0.8 : -idx * 0.8), y: ySlots[idx] ?? 50 });
    });
}

function resolveFreeKickRestartV2(
    awardSide: TeamKey,
    minute: number,
    foulPosition: SpatialPosition,
    homeTeam: TeamState,
    awayTeam: TeamState,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
): {
    possession: TeamKey;
    carrier: V2PlayerState | null;
    position: SpatialPosition;
    text: string;
} {
    const attackingTeam = awardSide === 'home' ? homeTeam : awayTeam;
    const players = awardSide === 'home' ? homePlayers : awayPlayers;
    const taker = getSetPieceTaker(players, 'FREE_KICK') || pickOnFieldTarget(players);
    if (!taker) {
        return {
            possession: awardSide,
            carrier: null,
            position: { ...foulPosition },
            text: `Free kick for ${attackingTeam.name}.`,
        };
    }

    const distanceToGoal = awardSide === 'home'
        ? Math.max(0, FIELD.LENGTH - foulPosition.x)
        : Math.max(0, foulPosition.x);

    // In shooting range -> taker keeps the ball for direct attempt next decision tick.
    if (distanceToGoal <= 24) {
        taker.position2D = { ...foulPosition };
        return {
            possession: awardSide,
            carrier: taker,
            position: { ...foulPosition },
            text: `${taker.name} stands over a direct free kick.`,
        };
    }

    // Too far to shoot -> long delivery into the box.
    const target = pickCornerBoxTarget(players, taker.id) || pickOnFieldTarget(players, taker.id) || taker;
    const deliveredPosition = clampToField({
        x: awardSide === 'home' ? Math.max(78, target.position2D.x) : Math.min(22, target.position2D.x),
        y: target.position2D.y,
    });

    target.position2D = deliveredPosition;

    return {
        possession: awardSide,
        carrier: target,
        position: deliveredPosition,
        text: `${taker.name} swings a long free kick into the box.`,
    };
}

function getDisciplineProfileV2(defender: V2PlayerState, team: TeamState) {
    const tacklingMode = team.tactics?.tackling || 'NORMAL';
    const tacklingMultiplier = tacklingMode === 'HARD' ? 1.3 : tacklingMode === 'SOFT' ? 0.7 : 1;
    const aggressionNorm = (defender.attributes.aggression || 10) / 20;
    const braveryNorm = (defender.attributes.bravery || 10) / 20;
    const teamworkNorm = (defender.attributes.teamwork || 10) / 20;
    const recklessIndex = clamp((aggressionNorm * 0.55) + (braveryNorm * 0.45), 0, 1);
    const compliance = 0.65 + (teamworkNorm * 0.35);
    const personalityRisk = 0.75 + (recklessIndex * 0.6);
    const foulMultiplier = clamp(tacklingMultiplier * compliance * personalityRisk, 0.55, 1.7);
    return { foulMultiplier, recklessIndex };
}

function applyCardFromFoulV2(
    defender: V2PlayerState,
    fouledPlayer: V2PlayerState,
    defenderTeam: TeamState,
    playerStats: V2MatchState['playerStats'],
    teamStats: { home: TeamMatchStats; away: TeamMatchStats },
    homeTeamId: string,
    minute: number,
    tick: number,
    position: SpatialPosition,
    frameEvents: VisualEvent[],
    visualEvents: VisualEvent[],
    events: V2MatchState['events'],
) {
    if (isPlayerSentOff(defender)) return;

    const defenderStats = playerStats[defender.id];
    if (!defenderStats) return;
    const teamKey: TeamKey = defenderStats.teamId === homeTeamId ? 'home' : 'away';
    const profile = getDisciplineProfileV2(defender, defenderTeam);
    const foulsInMatch = defenderStats.fouls || 0;
    const repeatFoulYellowBoost = foulsInMatch >= 2 ? (1 + Math.min(0.55, (foulsInMatch - 1) * 0.18)) : 1;
    const repeatFoulRedBoost = foulsInMatch >= 3 ? (1 + Math.min(0.45, (foulsInMatch - 2) * 0.15)) : 1;

    const yellowChance = BASE_YELLOW_CARD_CHANCE
        * profile.foulMultiplier
        * (0.85 + profile.recklessIndex * 0.35)
        * repeatFoulYellowBoost;
    const directRedChance = BASE_DIRECT_RED_CHANCE
        * profile.foulMultiplier
        * (0.7 + profile.recklessIndex * 0.6)
        * repeatFoulRedBoost;

    const secondYellowRiskBoost = defender.cards.yellow > 0 ? 1.05 : 1;
    const getsYellow = v2Random() < (yellowChance * secondYellowRiskBoost);
    const getsDirectRed = v2Random() < directRedChance;
    if (!getsYellow && !getsDirectRed) return;

    if (getsYellow && defender.cards.red === 0) {
        defender.cards.yellow += 1;
        defenderStats.yellowCards += 1;
        teamStats[teamKey].yellowCards += 1;
        const yellowEvent: VisualEvent = {
            id: `yellow_${minute}_${tick}_${defender.id}`,
            type: 'YELLOW_CARD',
            minute,
            tick,
            position: { ...position },
            playerId: defender.id,
            playerName: defender.name,
            teamId: defenderStats.teamId,
            metadata: { reason: `Foul on ${fouledPlayer.name}` },
        };
        frameEvents.push(yellowEvent);
        visualEvents.push(yellowEvent);
        events.push({
            minute,
            type: 'CARD_YELLOW',
            text: `${defender.name} is booked for fouling ${fouledPlayer.name} (Foul #${foulsInMatch}).`,
            teamId: defenderStats.teamId,
            playerId: defender.id,
        });
    }

    const secondYellowToRed = getsYellow && defender.cards.yellow >= 2;
    if (getsDirectRed || secondYellowToRed) {
        if (defender.cards.red === 0) {
            defender.cards.red = 1;
            defenderStats.redCards += 1;
            teamStats[teamKey].redCards += 1;
            defenderStats.minutes = Math.min(defenderStats.minutes || 90, minute);
            defender.tacticalPosition = null;
        }
        const redEvent: VisualEvent = {
            id: `red_${minute}_${tick}_${defender.id}`,
            type: 'RED_CARD',
            minute,
            tick,
            position: { ...position },
            playerId: defender.id,
            playerName: defender.name,
            teamId: defenderStats.teamId,
            metadata: { reason: secondYellowToRed ? 'Second yellow' : 'Straight red' },
        };
        frameEvents.push(redEvent);
        visualEvents.push(redEvent);
        events.push({
            minute,
            type: 'CARD_RED',
            text: secondYellowToRed
                ? `Second yellow! ${defender.name} is sent off after fouling ${fouledPlayer.name} (Foul #${foulsInMatch}).`
                : `Straight red card! ${defender.name} is sent off for a reckless foul on ${fouledPlayer.name} (Foul #${foulsInMatch}).`,
            teamId: defenderStats.teamId,
            playerId: defender.id,
        });
    }
}

function pickOnFieldTarget(players: V2PlayerState[], excludeId?: string): V2PlayerState | null {
    const candidates = players.filter((p) => p.tacticalPosition !== null && !isPlayerSentOff(p) && p.id !== excludeId);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(v2Random() * candidates.length)] || candidates[0] || null;
}

function executeThrowInV2(
    awardSide: TeamKey,
    minute: number,
    tick: number,
    ballPos: SpatialPosition,
    homeTeam: TeamState,
    awayTeam: TeamState,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
    playerStats: V2MatchState['playerStats'],
    teamStats: { home: TeamMatchStats; away: TeamMatchStats },
    frameEvents: VisualEvent[],
    visualEvents: VisualEvent[],
    events: V2MatchState['events'],
): { possession: TeamKey; carrier: V2PlayerState | null; position: SpatialPosition } {
    const attackingTeam = awardSide === 'home' ? homeTeam : awayTeam;
    const players = awardSide === 'home' ? homePlayers : awayPlayers;
    const oppPlayers = awardSide === 'home' ? awayPlayers : homePlayers;
    const taker = getSetPieceTaker(players, 'THROW');
    if (!taker) {
        return {
            possession: awardSide,
            carrier: pickOnFieldTarget(players),
            position: { ...ballPos },
        };
    }

    playerStats[taker.id].throws += 1;
    teamStats[awardSide].throws += 1;

    const throwEvent: VisualEvent = {
        id: `throw_${minute}_${tick}_${taker.id}`,
        type: 'THROW_IN',
        minute,
        tick,
        position: { ...ballPos },
        playerId: taker.id,
        playerName: taker.name,
        teamId: attackingTeam.id,
        metadata: { success: true },
    };
    frameEvents.push(throwEvent);
    visualEvents.push(throwEvent);
    events.push({
        minute,
        type: 'THROW_IN',
        text: `Throw-in for ${attackingTeam.name}.`,
        teamId: attackingTeam.id,
        playerId: taker.id,
    });

    const throwScore = ((taker.attributes.throw || 10) + (taker.attributes.passing || 10) + (taker.attributes.teamwork || 10)) / 3;
    const success = (throwScore * (Math.max(35, taker.condition) / 100)) > (v2Random() * 10);

    if (success) {
        const receiver = pickOnFieldTarget(players, taker.id) || taker;
        return {
            possession: awardSide,
            carrier: receiver,
            position: { ...receiver.position2D },
        };
    }

    const losingSide: TeamKey = awardSide === 'home' ? 'away' : 'home';
    const winner = pickOnFieldTarget(oppPlayers);
    return {
        possession: losingSide,
        carrier: winner,
        position: winner ? { ...winner.position2D } : { ...ballPos },
    };
}

function executeCornerV2(
    awardSide: TeamKey,
    minute: number,
    tick: number,
    ballPos: SpatialPosition,
    homeTeam: TeamState,
    awayTeam: TeamState,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
    playerStats: V2MatchState['playerStats'],
    teamStats: { home: TeamMatchStats; away: TeamMatchStats },
    frameEvents: VisualEvent[],
    visualEvents: VisualEvent[],
    events: V2MatchState['events'],
): { possession: TeamKey; carrier: V2PlayerState | null; position: SpatialPosition } {
    const attackingTeam = awardSide === 'home' ? homeTeam : awayTeam;
    const players = awardSide === 'home' ? homePlayers : awayPlayers;
    const taker = getSetPieceTaker(players, 'CORNER');
    if (!taker) {
        return {
            possession: awardSide,
            carrier: pickOnFieldTarget(players),
            position: { ...ballPos },
        };
    }

    playerStats[taker.id].corners += 1;
    teamStats[awardSide].corners += 1;

    const cornerEvent: VisualEvent = {
        id: `corner_${minute}_${tick}_${taker.id}`,
        type: 'CORNER',
        minute,
        tick,
        position: { ...ballPos },
        playerId: taker.id,
        playerName: taker.name,
        teamId: attackingTeam.id,
        metadata: { success: true },
    };
    frameEvents.push(cornerEvent);
    visualEvents.push(cornerEvent);
    events.push({
        minute,
        type: 'CORNER',
        text: `Corner kick for ${attackingTeam.name}.`,
        teamId: attackingTeam.id,
        playerId: taker.id,
    });

    // Bring key aerial targets (DC/FW) into the box before delivery.
    applyCornerBoxShape(awardSide, players, taker.id);
    const receiver = pickCornerBoxTarget(players, taker.id) || pickOnFieldTarget(players, taker.id) || taker;
    const cornerSpot: SpatialPosition = awardSide === 'home'
        ? { x: 96, y: ballPos.y < FIELD.WIDTH / 2 ? 4 : FIELD.WIDTH - 4 }
        : { x: 4, y: ballPos.y < FIELD.WIDTH / 2 ? 4 : FIELD.WIDTH - 4 };

    return {
        possession: awardSide,
        carrier: receiver,
        position: { ...cornerSpot },
    };
}

export function simulateMatch2D(
    homeTeam: TeamState,
    awayTeam: TeamState,
    _prepConfig?: unknown,
): V2MatchState {
    const replaySeed = typeof _prepConfig === 'object'
        && _prepConfig !== null
        && 'seed' in _prepConfig
        && typeof (_prepConfig as { seed?: unknown }).seed === 'string'
        ? (_prepConfig as { seed: string }).seed
        : undefined;
    const forcedDismissals = typeof _prepConfig === 'object'
        && _prepConfig !== null
        && 'forcedDismissals' in _prepConfig
        && Array.isArray((_prepConfig as { forcedDismissals?: unknown[] }).forcedDismissals)
        ? (_prepConfig as { forcedDismissals: ForcedDismissal[] }).forcedDismissals
        : [];

    return runWithV2Random(replaySeed ? createSeededRandom(replaySeed) : Math.random, () => {
    void _prepConfig;

    const homePlayers = homeTeam.players.map((player, index) => createV2Player(player, 'home', { x: 18 + index, y: 15 + (index * 6) % 70 }));
    const awayPlayers = awayTeam.players.map((player, index) => createV2Player(player, 'away', { x: 82 - index, y: 15 + (index * 6) % 70 }));

    const homeFormationCoordinates = applyFormationCoordinates(homeTeam, homePlayers, true);
    const awayFormationCoordinates = applyFormationCoordinates(awayTeam, awayPlayers, false);

    const playerStats = {} as V2MatchState['playerStats'];

    homePlayers.forEach((player) => {
        const isStarter = player.tacticalPosition !== null;
        playerStats[player.id] = {
            playerId: player.id,
            name: player.name,
            teamId: homeTeam.id,
            position: player.position,
            jerseyNumber: null,
            rating: isStarter ? 6 : 0,
            minutes: isStarter ? 90 : 0,
            goals: 0,
            assists: 0,
            saves: 0,
            passesAttempted: 0,
            passesCompleted: 0,
            crossesAttempted: 0,
            crossesCompleted: 0,
            shots: 0,
            shotsOnTarget: 0,
            tacklesAttempted: 0,
            tacklesWon: 0,
            dribblesAttempted: 0,
            dribblesWon: 0,
            fitnessEnd: player.condition,
            defensiveThirdTouches: 0,
            middleThirdTouches: 0,
            attackingThirdTouches: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            freeKicks: 0,
            corners: 0,
            throws: 0,
            offsides: 0,
        };
    });

    awayPlayers.forEach((player) => {
        const isStarter = player.tacticalPosition !== null;
        playerStats[player.id] = {
            playerId: player.id,
            name: player.name,
            teamId: awayTeam.id,
            position: player.position,
            jerseyNumber: null,
            rating: isStarter ? 6 : 0,
            minutes: isStarter ? 90 : 0,
            goals: 0,
            assists: 0,
            saves: 0,
            passesAttempted: 0,
            passesCompleted: 0,
            crossesAttempted: 0,
            crossesCompleted: 0,
            shots: 0,
            shotsOnTarget: 0,
            tacklesAttempted: 0,
            tacklesWon: 0,
            dribblesAttempted: 0,
            dribblesWon: 0,
            fitnessEnd: player.condition,
            defensiveThirdTouches: 0,
            middleThirdTouches: 0,
            attackingThirdTouches: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            freeKicks: 0,
            corners: 0,
            throws: 0,
            offsides: 0,
        };
    });

    const frames: MatchFrame[] = [];
    const visualEvents: VisualEvent[] = [];
    const ballTransitions: BallTransition[] = [];
    const events: V2MatchState['events'] = [];
    const teamStats = { home: createEmptyTeamStats(), away: createEmptyTeamStats() };
    const possessionTicks = { home: 0, away: 0 };
    const telemetryCollector = new V2TelemetryCollector(TUNING_PARAMS.telemetryPassSampleLimit);
    
    // Substitution tracking
    let homeSubsUsed = 0;
    let awaySubsUsed = 0;
    const maxSubs = 5;
    const appliedForcedDismissals = new Set<string>();

    const playerMovementAnalytics: NonNullable<V2MatchState['playerMovementAnalytics']> = {};
    [...homePlayers, ...awayPlayers].forEach((player) => {
        playerMovementAnalytics[player.id] = {
            movementDistance: 0,
            carryDistance: 0,
            carrySeconds: 0,
            zoneSeconds: {
                defensive: 0,
                middle: 0,
                attacking: 0,
            },
            samples: 0,
        };
    });

    const previousPositionByPlayer = new Map<string, SpatialPosition>();
    [...homePlayers, ...awayPlayers].forEach((player) => {
        previousPositionByPlayer.set(player.id, { ...player.position2D });
    });

    let homeScore = 0;
    let awayScore = 0;
    let activeTransition: ActiveTransition | null = null;
    let pendingKickoff: { executeAtTick: number; possession: TeamKey } | null = null;
    let actionCooldownUntilTick = -1;
    let possession: 'home' | 'away' = 'home';
    let carrier: V2PlayerState | null = homePlayers[Math.floor(homePlayers.length / 2)] || homePlayers[0] || null;

    const ball: V2BallState = {
        position: carrier ? { ...carrier.position2D } : { x: FIELD.LENGTH / 2, y: FIELD.WIDTH / 2 },
        velocity: { dx: 0, dy: 0 },
        z: 0,
        possession,
        carrier,
    };

    for (let absoluteTick = 0; absoluteTick < TOTAL_TICKS; absoluteTick += 1) {
        const minute = Math.floor(absoluteTick / TICKS_PER_MINUTE);
        const tick = absoluteTick % TICKS_PER_MINUTE;
        const frameEvents: VisualEvent[] = [];
        const frameTransitions: BallTransition[] = [];
        
        // Substitution check (once per minute, starting at minute 55)
        if (tick === 0 && minute >= 55 && minute < 90) {
            homeSubsUsed = attemptV2Substitutions(homePlayers, playerStats, frameEvents, minute, homeSubsUsed, maxSubs, homeTeam.id);
            awaySubsUsed = attemptV2Substitutions(awayPlayers, playerStats, frameEvents, minute, awaySubsUsed, maxSubs, awayTeam.id);
            visualEvents.push(...frameEvents);
        }

        forcedDismissals
            .filter((dismissal) => dismissal.minute === minute && !appliedForcedDismissals.has(dismissal.playerId))
            .forEach((dismissal, dismissalIndex) => {
                const dismissedPlayer = homePlayers.find((player) => player.id === dismissal.playerId)
                    || awayPlayers.find((player) => player.id === dismissal.playerId);
                if (!dismissedPlayer || isPlayerSentOff(dismissedPlayer)) {
                    appliedForcedDismissals.add(dismissal.playerId);
                    return;
                }

                dismissedPlayer.cards.red = 1;
                dismissedPlayer.tacticalPosition = null;

                const dismissedStats = playerStats[dismissal.playerId];
                if (dismissedStats) {
                    dismissedStats.redCards = Math.max(1, dismissedStats.redCards || 0);
                    dismissedStats.minutes = Math.min(dismissedStats.minutes || 90, minute);
                }

                const dismissalEvent: VisualEvent = {
                    id: `forced_red_${minute}_${tick}_${dismissal.playerId}_${dismissalIndex}`,
                    type: 'RED_CARD',
                    minute,
                    tick,
                    position: { ...dismissedPlayer.position2D },
                    playerId: dismissedPlayer.id,
                    playerName: dismissedPlayer.name,
                    teamId: dismissal.teamId || dismissedStats?.teamId || (dismissedPlayer.side === 'home' ? homeTeam.id : awayTeam.id),
                    metadata: { reason: dismissal.reason || 'Authoritative match dismissal' },
                };
                frameEvents.push(dismissalEvent);
                visualEvents.push(dismissalEvent);
                appliedForcedDismissals.add(dismissal.playerId);

                if (carrier?.id === dismissedPlayer.id) {
                    carrier = null;
                    ball.carrier = null;
                }
            });

        // Phase 1: Build team context for this tick
        const teamContexts = buildTeamContext(
            absoluteTick,
            minute,
            possession,
            { home: homeScore, away: awayScore },
            ball.position,
            homeTeam.tactics.mentality,
            awayTeam.tactics.mentality,
        );
        
        // Debug telemetry: Log team context every 10 minutes
        if (absoluteTick % (TICKS_PER_MINUTE * 10) === 0) {
            console.log(`[V2-Phase1] Minute ${minute}: Home phase=${teamContexts.home.phase} pressure=${teamContexts.home.pressure} line=${teamContexts.home.lineHeight} | Away phase=${teamContexts.away.phase} pressure=${teamContexts.away.pressure} line=${teamContexts.away.lineHeight}`);
        }

        const activeHomePlayers = getActivePlayers(homePlayers);
        const activeAwayPlayers = getActivePlayers(awayPlayers);
        const attackingPlayers: V2PlayerState[] = possession === 'home' ? activeHomePlayers : activeAwayPlayers;
        const defendingPlayers: V2PlayerState[] = possession === 'home' ? activeAwayPlayers : activeHomePlayers;
        const attackingTeamId = possession === 'home' ? homeTeam.id : awayTeam.id;
        const goalkeeper: V2PlayerState | null = defendingPlayers.find((player: V2PlayerState) => player.position === 'GK') || null;
        const pushCurrentFrameSnapshot = () => {
            const playerPositionsSnapshot: Record<string, SpatialPosition> = {};
            activeHomePlayers.forEach((player) => {
                playerPositionsSnapshot[player.id] = { ...player.position2D };
            });
            activeAwayPlayers.forEach((player) => {
                playerPositionsSnapshot[player.id] = { ...player.position2D };
            });

            const frameDebugSnapshot = buildFrameDebug(
                { minute, tick, ball: { ...ball }, playerPositions: playerPositionsSnapshot, events: frameEvents, ballTransitions: frameTransitions },
                homeIntents,
                awayIntents,
                homeDefensiveAssignment,
                awayDefensiveAssignment,
                lineHeightToX('home', teamContexts.home.lineHeight),
                lineHeightToX('away', teamContexts.away.lineHeight),
                activeHomePlayers,
                activeAwayPlayers,
            );

            frames.push({
                minute,
                tick,
                ball: {
                    ...ball,
                    position: { ...ball.position },
                    velocity: { ...ball.velocity },
                    carrier: ball.carrier,
                },
                playerPositions: playerPositionsSnapshot,
                events: frameEvents,
                ballTransitions: frameTransitions,
                debug: frameDebugSnapshot,
            });
            telemetryCollector.recordFrame();
        };
        const applyMajorEventCooldown = (fromTick: number) => {
            actionCooldownUntilTick = Math.max(
                actionCooldownUntilTick,
                fromTick + Math.max(0, Number(TUNING_PARAMS.majorEventCooldownTicks || 2)),
            );
        };
        const homeDefensiveAssignment: DefensiveAssignment = assignDefensiveRoles(activeHomePlayers, activeAwayPlayers, 'home', teamContexts.home, ball);
        const awayDefensiveAssignment: DefensiveAssignment = assignDefensiveRoles(activeAwayPlayers, activeHomePlayers, 'away', teamContexts.away, ball);
        telemetryCollector.countDefensiveAssignment(homeDefensiveAssignment);
        telemetryCollector.countDefensiveAssignment(awayDefensiveAssignment);

        if (carrier && !isPlayerActive(carrier)) {
            carrier = pickOnFieldTarget(attackingPlayers) || null;
            ball.carrier = carrier;
            if (carrier) {
                ball.position = { ...carrier.position2D };
            }
        }

        // Phase 2: Generate movement intents and update positions
        const homeIntents: Record<string, RoleIntent> = {};
        const awayIntents: Record<string, RoleIntent> = {};
        
        // Home team movement
        activeHomePlayers.forEach((player) => {
            const phaseState = getPlayerPhaseState(player, carrier, possession);
            const baseIntent = generateMovementIntent(
                player,
                'home',
                teamContexts.home,
                activeHomePlayers,
                activeAwayPlayers,
                ball,
                homeFormationCoordinates[player.id] || player.position2D,
            );
            const specialistIntent = generateSpecialistIntent({
                player,
                team: 'home',
                phaseState,
                teamContext: teamContexts.home,
                teammates: activeHomePlayers,
                opponents: activeAwayPlayers,
                ball,
                rolePosition: homeFormationCoordinates[player.id] || player.position2D,
            });
            const intent = blendRoleIntent(baseIntent, specialistIntent, TUNING_PARAMS.specialistBlendWeight);
            telemetryCollector.countIntent(intent);

            const isHomeDefending = possession !== 'home';
            let target = intent.targetPosition;
            if (isHomeDefending) {
                if (homeDefensiveAssignment.presser?.id === player.id && carrier) {
                    target = { ...carrier.position2D };
                    intent.job = 'PRESS';
                    intent.context = 'phase5 coordinated press';
                } else if (homeDefensiveAssignment.cover?.id === player.id && homeDefensiveAssignment.presser) {
                    target = {
                        x: Math.max(
                            TUNING_PARAMS.lineHoldClampHome.min,
                            Math.min(TUNING_PARAMS.lineHoldClampHome.max, homeDefensiveAssignment.presser.position2D.x - TUNING_PARAMS.coverOffsetX),
                        ),
                        y: (homeDefensiveAssignment.presser.position2D.y + FIELD.WIDTH / 2) / 2,
                    };
                    intent.job = 'COVER';
                    intent.context = 'phase5 cover presser lane';
                } else if (homeDefensiveAssignment.lineHolders.some((p) => p.id === player.id)) {
                    target = {
                        x: lineHeightToX('home', teamContexts.home.lineHeight),
                        y: intent.targetPosition.y,
                    };
                    intent.job = 'DEFEND';
                    intent.context = 'phase5 hold defensive line';
                }
            }
            homeIntents[player.id] = intent;
            
            // Apply role-clamped movement toward intent target
            const desiredX = clampRoleX(player, target.x, 'home', phaseState);
            // Apply offside safety check for attacking players
            const offsideSafeX = applyOffsideSafeX(player, desiredX, 'home', activeAwayPlayers);
            const desiredY = target.y;
            updatePlayerPosition(
                player,
                { x: offsideSafeX, y: desiredY },
                player.attributes,
                carrier?.id === player.id,
                minute,
                TUNING_PARAMS.movementTickSeconds,
            );
        });
        
        // Away team movement
        activeAwayPlayers.forEach((player) => {
            const phaseState = getPlayerPhaseState(player, carrier, possession);
            const baseIntent = generateMovementIntent(
                player,
                'away',
                teamContexts.away,
                activeAwayPlayers,
                activeHomePlayers,
                ball,
                awayFormationCoordinates[player.id] || player.position2D,
            );
            const specialistIntent = generateSpecialistIntent({
                player,
                team: 'away',
                phaseState,
                teamContext: teamContexts.away,
                teammates: activeAwayPlayers,
                opponents: activeHomePlayers,
                ball,
                rolePosition: awayFormationCoordinates[player.id] || player.position2D,
            });
            const intent = blendRoleIntent(baseIntent, specialistIntent, TUNING_PARAMS.specialistBlendWeight);
            telemetryCollector.countIntent(intent);

            const isAwayDefending = possession !== 'away';
            let target = intent.targetPosition;
            if (isAwayDefending) {
                if (awayDefensiveAssignment.presser?.id === player.id && carrier) {
                    target = { ...carrier.position2D };
                    intent.job = 'PRESS';
                    intent.context = 'phase5 coordinated press';
                } else if (awayDefensiveAssignment.cover?.id === player.id && awayDefensiveAssignment.presser) {
                    target = {
                        x: Math.max(
                            TUNING_PARAMS.lineHoldClampAway.min,
                            Math.min(TUNING_PARAMS.lineHoldClampAway.max, awayDefensiveAssignment.presser.position2D.x + TUNING_PARAMS.coverOffsetX),
                        ),
                        y: (awayDefensiveAssignment.presser.position2D.y + FIELD.WIDTH / 2) / 2,
                    };
                    intent.job = 'COVER';
                    intent.context = 'phase5 cover presser lane';
                } else if (awayDefensiveAssignment.lineHolders.some((p) => p.id === player.id)) {
                    target = {
                        x: lineHeightToX('away', teamContexts.away.lineHeight),
                        y: intent.targetPosition.y,
                    };
                    intent.job = 'DEFEND';
                    intent.context = 'phase5 hold defensive line';
                }
            }
            awayIntents[player.id] = intent;
            
            // Apply role-clamped movement toward intent target
            const desiredX = clampRoleX(player, target.x, 'away', phaseState);
            // Apply offside safety check for attacking players
            const offsideSafeX = applyOffsideSafeX(player, desiredX, 'away', activeHomePlayers);
            const desiredY = target.y;
            updatePlayerPosition(
                player,
                { x: offsideSafeX, y: desiredY },
                player.attributes,
                carrier?.id === player.id,
                minute,
                TUNING_PARAMS.movementTickSeconds,
            );
        });

        applyTeamSpacingGuard(activeHomePlayers, TUNING_PARAMS.minTeammateDistance);
        applyTeamSpacingGuard(activeAwayPlayers, TUNING_PARAMS.minTeammateDistance);
        
        // Phase 2.4: Movement telemetry - log intents on config interval
        if (absoluteTick % TUNING_PARAMS.telemetryLogIntervalTicks === 0 && carrier) {
            const teamKey = possession as 'home' | 'away';
            const intents = teamKey === 'home' ? homeIntents : awayIntents;
            const intent = intents[carrier.id];
            const defensiveTeam: TeamKey = teamKey === 'home' ? 'away' : 'home';
            const defensiveAssignment = defensiveTeam === 'home' ? homeDefensiveAssignment : awayDefensiveAssignment;
            
            if (intent) {
                console.log(
                    `[V2-Phase2] Minute ${minute}: ${teamKey.toUpperCase()} carrier (${carrier.position} id=${carrier.id.substring(0, 8)}) ` +
                    `targets (${intent.targetPosition.x.toFixed(1)}, ${intent.targetPosition.y.toFixed(1)}) ` +
                    `job=${intent.job} priority=${intent.priority} utility=${intent.utilityScore.toFixed(1)}`,
                );
            }

            if (defensiveAssignment.presser) {
                const lineX = lineHeightToX(defensiveTeam, defensiveTeam === 'home' ? teamContexts.home.lineHeight : teamContexts.away.lineHeight);
                console.log(
                    `[V2-Phase5] Minute ${minute}: ${defensiveTeam.toUpperCase()} press=${defensiveAssignment.presser.position}` +
                    `${defensiveAssignment.cover ? ` cover=${defensiveAssignment.cover.position}` : ''} lineX=${lineX.toFixed(1)}`,
                );
            }
        }
        
        possessionTicks[possession] += 1;

        if (pendingKickoff) {
            ball.velocity = { dx: 0, dy: 0 };
            ball.z = 0;
            ball.carrier = null;
            carrier = null;

            if (absoluteTick >= pendingKickoff.executeAtTick) {
                const kickoffReset = resetBallForKickoff(
                    pendingKickoff.possession,
                    homePlayers,
                    awayPlayers,
                    ball,
                );
                possession = kickoffReset.possession;
                carrier = kickoffReset.carrier;
                ball.possession = possession;
                ball.carrier = carrier;
                possessionTicks[possession] += 1;
                pendingKickoff = null;
                applyMajorEventCooldown(absoluteTick);
            }
        }

        if (!pendingKickoff && activeTransition) {
            const progressTick = absoluteTick - activeTransition.startedAtTick;
            const progressIndex = Math.max(0, Math.min(activeTransition.transition.trajectory.length - 1, progressTick));
            const progress = activeTransition.transition.duration <= 1 ? 1 : progressIndex / (activeTransition.transition.duration - 1);
            ball.position = { ...activeTransition.transition.trajectory[progressIndex] };
            ball.z = getHeightZ(activeTransition.transition.ballHeight, progress);
            ball.carrier = null;

            if (progressTick >= activeTransition.transition.duration - 1) {
                ball.position = { ...activeTransition.transition.toPosition };
                ball.z = 0;

                if (activeTransition.followUp) {
                    const pendingFollowUp: NonNullable<ActiveTransition['followUp']> = activeTransition.followUp;
                    ballTransitions.push(pendingFollowUp.transition);
                    frameTransitions.push(pendingFollowUp.transition);
                    possession = pendingFollowUp.resultingPossession;
                    ball.possession = possession;
                    carrier = null;
                    ball.carrier = null;
                    frameEvents.push(activeTransition.event);
                    activeTransition = {
                        transition: pendingFollowUp.transition,
                        startedAtTick: absoluteTick,
                        receivingPlayer: pendingFollowUp.receivingPlayer,
                        resultingPossession: pendingFollowUp.resultingPossession,
                        event: activeTransition.event,
                        outcome: activeTransition.outcome,
                    };
                    continue;
                }

                possession = activeTransition.resultingPossession;
                carrier = activeTransition.receivingPlayer;
                ball.possession = possession;
                ball.carrier = carrier;
                frameEvents.push(activeTransition.event);

                if (activeTransition.event.type === 'SHOT') {
                    applyMajorEventCooldown(absoluteTick);
                }

                if (activeTransition.outcome === 'OFF_TARGET') {
                    const goalKickSide: TeamKey = activeTransition.resultingPossession;
                    const goalKickRestart = resetBallForGoalKick(
                        goalKickSide,
                        homePlayers,
                        awayPlayers,
                        ball,
                        activeTransition.transition.toPosition.y,
                    );
                    possession = goalKickRestart.possession;
                    carrier = goalKickRestart.carrier;
                    ball.possession = goalKickRestart.possession;
                    ball.carrier = goalKickRestart.carrier;
                    ball.position = { ...goalKickRestart.position };

                    const goalKickTeamId = goalKickSide === 'home' ? homeTeam.id : awayTeam.id;
                    const goalKickEvent: VisualEvent = {
                        id: `goal_kick_${minute}_${tick}_${goalKickRestart.carrier?.id || goalKickTeamId}`,
                        type: 'GOAL_KICK',
                        minute,
                        tick,
                        position: { ...goalKickRestart.position },
                        playerId: goalKickRestart.carrier?.id,
                        playerName: goalKickRestart.carrier?.name,
                        teamId: goalKickTeamId,
                        metadata: { reason: 'OFF_TARGET_RESTART' },
                    };
                    frameEvents.push(goalKickEvent);
                    visualEvents.push(goalKickEvent);
                    events.push({
                        minute,
                        type: 'GOAL_KICK',
                        text: `Goal kick for ${goalKickSide === 'home' ? homeTeam.name : awayTeam.name}.`,
                        teamId: goalKickTeamId,
                        playerId: goalKickRestart.carrier?.id,
                    });

                    applyMajorEventCooldown(absoluteTick);
                }

                if (activeTransition.transition.type === 'GOAL') {
                    if (activeTransition.resultingPossession === 'away') homeScore += 1;
                    else awayScore += 1;

                    ball.carrier = null;
                    carrier = null;
                    ball.velocity = { dx: 0, dy: 0 };
                    pendingKickoff = {
                        executeAtTick: absoluteTick + 8,
                        possession: activeTransition.resultingPossession,
                    };
                }

                activeTransition = null;
            }
        }

        if (!pendingKickoff && !activeTransition && carrier) {
            const actingCarrier = carrier as V2PlayerState;
            if (absoluteTick < actionCooldownUntilTick && !isGoalkeeper(actingCarrier)) {
                ball.position = { ...actingCarrier.position2D };
                ball.carrier = actingCarrier;
                ball.possession = possession;
            } else if (!shouldResolveCarrierAction(absoluteTick, actingCarrier, defendingPlayers)) {
                ball.position = { ...actingCarrier.position2D };
                ball.carrier = actingCarrier;
                ball.possession = possession;
            } else {
            const distanceToGoal = possession === 'home' ? FIELD.LENGTH - actingCarrier.position2D.x : actingCarrier.position2D.x;
            const baseShootBias = distanceToGoal < 18 ? 0.34 : distanceToGoal < 26 ? 0.16 : distanceToGoal < 34 ? 0.06 : 0.015;
            const shootBias = canAttemptShot(actingCarrier, possession) ? baseShootBias : 0;

            // ── Phase 3: Tackle duel ────────────────────────────────────────
            // Check if a nearby defender can steal the ball before any action
            const nearDefenders = findNearbyPlayers(actingCarrier.position2D, defendingPlayers, TUNING_PARAMS.dribblePressureRadius);
            if (nearDefenders.length > 0) {
                const tackler = nearDefenders[0];
                const defTackling = (tackler.attributes?.tackling ?? 10);
                const carrDribbling = (carrier.attributes?.dribbling ?? 10);
                // Defender tackle bonus by role
                let tackleBonus = 0;
                if (TUNING_PARAMS.defenderTackleBonus && tackler.position && TUNING_PARAMS.defenderTackleBonus[tackler.position]) {
                    tackleBonus = TUNING_PARAMS.defenderTackleBonus[tackler.position];
                }
                // Max tackle win rate ~25% + bonus; scaled by attribute gap
                let tackleWinRate = (defTackling / (defTackling + carrDribbling)) * 0.25 + tackleBonus;
                // Clamp to [0, 0.98] to avoid 100% win
                tackleWinRate = Math.max(0, Math.min(0.98, tackleWinRate));
                playerStats[tackler.id].tacklesAttempted += 1;

                // V1 parity: tackle duel can produce foul + cards + free-kick
                const defendingTeamState = possession === 'home' ? awayTeam : homeTeam;
                const defendingTeamKey: TeamKey = possession === 'home' ? 'away' : 'home';
                const disciplineProfile = getDisciplineProfileV2(tackler, defendingTeamState);
                const baseFoulProb = (1 - tackleWinRate) * 0.12 + 0.02; // ~2%..14% before multipliers
                if (v2Random() < (baseFoulProb * disciplineProfile.foulMultiplier)) {
                    playerStats[tackler.id].fouls += 1;
                    teamStats[defendingTeamKey].fouls += 1;

                    const foulVisual: VisualEvent = {
                        id: `foul_duel_${absoluteTick}_${tackler.id}`,
                        type: 'FREE_KICK',
                        minute,
                        tick,
                        position: { ...carrier.position2D },
                        playerId: tackler.id,
                        playerName: tackler.name,
                        teamId: playerStats[tackler.id].teamId,
                        metadata: { reason: `Tackle foul on ${carrier.name}` },
                    };
                    frameEvents.push(foulVisual);
                    visualEvents.push(foulVisual);
                    events.push({
                        minute,
                        type: 'FOUL',
                        text: `${tackler.name} fouls ${carrier.name}.`,
                        teamId: playerStats[tackler.id].teamId,
                        playerId: tackler.id,
                    });

                    applyCardFromFoulV2(
                        tackler,
                        carrier,
                        defendingTeamState,
                        playerStats,
                        teamStats,
                        homeTeam.id,
                        minute,
                        tick,
                        carrier.position2D,
                        frameEvents,
                        visualEvents,
                        events,
                    );

                    playerStats[carrier.id].freeKicks += 1;
                    teamStats[possession].freeKicks += 1;
                    const freeKickRestart = resolveFreeKickRestartV2(
                        possession,
                        minute,
                        { ...carrier.position2D },
                        homeTeam,
                        awayTeam,
                        homePlayers,
                        awayPlayers,
                    );
                    carrier = freeKickRestart.carrier;
                    ball.possession = freeKickRestart.possession;
                    ball.carrier = freeKickRestart.carrier;
                    ball.position = { ...freeKickRestart.position };
                    events.push({
                        minute,
                        type: 'FREE_KICK',
                        text: freeKickRestart.text,
                        teamId: possession === 'home' ? homeTeam.id : awayTeam.id,
                        playerId: freeKickRestart.carrier?.id,
                    });
                    applyMajorEventCooldown(absoluteTick);
                    pushCurrentFrameSnapshot();
                    continue;
                }

                if (v2Random() < tackleWinRate) {
                    // Tackle succeeds — defender wins possession
                    playerStats[tackler.id].tacklesWon += 1;
                    playerStats[tackler.id].rating += 0.1;
                    possession = possession === 'home' ? 'away' : 'home';
                    carrier = tackler;
                    ball.possession = possession;
                    ball.carrier = carrier;
                    if (absoluteTick % TICKS_PER_MINUTE === 0) {
                        console.log(`[V2-Phase3] Minute ${minute}: TACKLE WON by ${tackler.position} (tackling=${defTackling}) vs ${carrier.position}`);
                    }
                    // Skip action this tick — possession just changed
                    ball.possession = possession;
                    const playerPositionsTackle: Record<string, SpatialPosition> = {};
                    activeHomePlayers.forEach((p) => { playerPositionsTackle[p.id] = { ...p.position2D }; });
                    activeAwayPlayers.forEach((p) => { playerPositionsTackle[p.id] = { ...p.position2D }; });
                    const frameDebugTackle = buildFrameDebug(
                        { minute, tick, ball: { ...ball }, playerPositions: playerPositionsTackle, events: frameEvents, ballTransitions: frameTransitions },
                        homeIntents,
                        awayIntents,
                        homeDefensiveAssignment,
                        awayDefensiveAssignment,
                        lineHeightToX('home', teamContexts.home.lineHeight),
                        lineHeightToX('away', teamContexts.away.lineHeight),
                        activeHomePlayers,
                        activeAwayPlayers,
                    );
                    frames.push({ minute, tick, ball: { ...ball, position: { ...ball.position }, velocity: { ...ball.velocity }, carrier: ball.carrier }, playerPositions: playerPositionsTackle, events: frameEvents, ballTransitions: frameTransitions, debug: frameDebugTackle });
                    telemetryCollector.recordFrame();
                    possessionTicks[possession] += 1;
                    continue;
                }
            }

            let action: ReplayAction;

            if (isGoalkeeper(actingCarrier)) {
                const quickTarget = pickQuickDistributionTarget(
                    actingCarrier,
                    attackingPlayers,
                    defendingPlayers,
                    possession,
                );
                action = {
                    kind: 'PASS',
                    from: actingCarrier,
                    to: quickTarget,
                    team: possession,
                };
            } else if (v2Random() < shootBias) {
                const shotOutcome = createShotOutcome(carrier, possession, goalkeeper);
                action = {
                    kind: 'SHOT',
                    from: carrier,
                    team: possession,
                    target: shotOutcome.target,
                    goalkeeper,
                    outcome: shotOutcome,
                };
            } else {
                const immediatePressure = findNearbyPlayers(carrier.position2D, defendingPlayers, TUNING_PARAMS.dribblePressureRadius);
                const pressureLevel = immediatePressure.length;
                const wideCarrier = isWideBallCarrier(carrier);
                const frontBlockers = countFrontBlockers(carrier, defendingPlayers, possession);

                const dribbleBase = wideCarrier ? 0.62 : 0.48;
                const dribbleChance = pressureLevel === 0
                    ? (frontBlockers === 0 ? 0.9 : dribbleBase)
                    : pressureLevel === 1
                        ? dribbleBase * 0.6
                        : dribbleBase * 0.28;

                const dribbleQuality = ((carrier.attributes.dribbling || 10) + (carrier.attributes.acceleration || 10)) / 40;

                if (v2Random() < dribbleChance) {
                    const configuredForwardStep = pressureLevel === 0
                        ? TUNING_PARAMS.dribbleStepNoPressure
                        : TUNING_PARAMS.dribbleStepUnderPressure;

                    // Cap dribble displacement to pace-based movement in this tick.
                    // This prevents unrealistic on-ball teleport and lets defenders chase effectively.
                    const maxDribbleStep = Math.max(
                        0.45,
                        (carrier.movementSpeed || 0) * TUNING_PARAMS.movementTickSeconds,
                    );
                    const forwardStep = Math.min(configuredForwardStep, maxDribbleStep);

                    const targetX: number = possession === 'home'
                        ? carrier.position2D.x + forwardStep
                        : carrier.position2D.x - forwardStep;
                    const lateralBias = wideCarrier
                        ? (carrier.position.includes('R') ? -0.4 : 0.4)
                        : 0;

                    const bylineCrossReady = isNearBylineCrossZone(carrier, possession);
                    if (bylineCrossReady && v2Random() < TUNING_PARAMS.crossChanceNearByline) {
                        const crossTarget = pickCrossTarget(attackingPlayers, possession, carrier.id);
                        if (crossTarget) {
                            action = {
                                kind: 'PASS',
                                from: carrier,
                                to: crossTarget,
                                team: possession,
                            };
                        } else {
                            const toPosition = clampToField({
                                x: targetX,
                                y: carrier.position2D.y + lateralBias,
                            });
                            const beatenDefender = findBeatenDefender(carrier.position2D, toPosition, defendingPlayers, possession);
                            action = {
                                kind: 'DRIBBLE',
                                from: carrier,
                                team: possession,
                                fromPosition: { ...carrier.position2D },
                                toPosition,
                                isDuel: pressureLevel > 0 || frontBlockers > 0,
                                beatenDefenderId: beatenDefender?.id,
                            };
                        }
                    } else {
                        const toPosition = clampToField({
                            x: targetX,
                            y: carrier.position2D.y + lateralBias,
                        });
                        const beatenDefender = findBeatenDefender(carrier.position2D, toPosition, defendingPlayers, possession);

                        action = {
                            kind: 'DRIBBLE',
                            from: carrier,
                            team: possession,
                            fromPosition: { ...carrier.position2D },
                            toPosition,
                            isDuel: pressureLevel > 0 || frontBlockers > 0,
                            beatenDefenderId: beatenDefender?.id,
                        };
                    }

                    // If heavily crowded, dribble can fail into turnover
                    if (pressureLevel >= 2) {
                        const avgTackle = immediatePressure.reduce((sum, p) => sum + (p.attributes.tackling || 10), 0) / Math.max(1, immediatePressure.length);
                        const dribbleSuccess = Math.max(0.18, Math.min(0.86, dribbleQuality - (avgTackle / 20) * 0.35 + 0.42));
                        if (action.kind === 'DRIBBLE' && v2Random() > dribbleSuccess) {
                            if (action.isDuel) {
                                playerStats[action.from.id].dribblesAttempted += 1;
                            }
                            const winner = immediatePressure[0] || defendingPlayers[0];
                            if (winner) {
                                const defendingTeamState = possession === 'home' ? awayTeam : homeTeam;
                                const defendingTeamKey: TeamKey = possession === 'home' ? 'away' : 'home';
                                const disciplineProfile = getDisciplineProfileV2(winner, defendingTeamState);
                                const baseFoulProb = 0.12;

                                if (v2Random() < (baseFoulProb * disciplineProfile.foulMultiplier)) {
                                    playerStats[winner.id].fouls += 1;
                                    teamStats[defendingTeamKey].fouls += 1;

                                    const foulEvent: VisualEvent = {
                                        id: `foul_${absoluteTick}_${winner.id}`,
                                        type: 'FREE_KICK',
                                        minute,
                                        tick,
                                        position: { ...action.from.position2D },
                                        playerId: winner.id,
                                        playerName: winner.name,
                                        teamId: playerStats[winner.id].teamId,
                                        metadata: { reason: `Foul on ${action.from.name}` },
                                    };
                                    frameEvents.push(foulEvent);
                                    visualEvents.push(foulEvent);
                                    events.push({
                                        minute,
                                        type: 'FOUL',
                                        text: `${winner.name} fouls ${action.from.name}.`,
                                        teamId: playerStats[winner.id].teamId,
                                        playerId: winner.id,
                                    });

                                    applyCardFromFoulV2(
                                        winner,
                                        action.from,
                                        defendingTeamState,
                                        playerStats,
                                        teamStats,
                                        homeTeam.id,
                                        minute,
                                        tick,
                                        action.from.position2D,
                                        frameEvents,
                                        visualEvents,
                                        events,
                                    );

                                    // Fouled team keeps possession for free-kick
                                    const attackingTeamKey: TeamKey = possession;
                                    playerStats[action.from.id].freeKicks += 1;
                                    teamStats[attackingTeamKey].freeKicks += 1;
                                    const freeKickRestart = resolveFreeKickRestartV2(
                                        attackingTeamKey,
                                        minute,
                                        { ...action.from.position2D },
                                        homeTeam,
                                        awayTeam,
                                        homePlayers,
                                        awayPlayers,
                                    );
                                    carrier = freeKickRestart.carrier;
                                    ball.possession = freeKickRestart.possession;
                                    ball.carrier = freeKickRestart.carrier;
                                    ball.position = { ...freeKickRestart.position };
                                    events.push({
                                        minute,
                                        type: 'FREE_KICK',
                                        text: freeKickRestart.text,
                                        teamId: attackingTeamKey === 'home' ? homeTeam.id : awayTeam.id,
                                        playerId: freeKickRestart.carrier?.id,
                                    });
                                    applyMajorEventCooldown(absoluteTick);
                                    pushCurrentFrameSnapshot();
                                    continue;
                                }

                                possession = possession === 'home' ? 'away' : 'home';
                                carrier = winner;
                                ball.possession = possession;
                                ball.carrier = winner;
                                ball.position = { ...winner.position2D };
                                const failedDribbleEvent: VisualEvent = {
                                    id: `dribble_fail_${absoluteTick}_${action.from.id}`,
                                    type: 'DRIBBLE',
                                    minute,
                                    tick,
                                    position: { ...action.from.position2D },
                                    playerId: action.from.id,
                                    playerName: action.from.name,
                                    teamId: attackingTeamId,
                                    metadata: { success: false, reason: 'TACKLED_UNDER_PRESSURE' },
                                };
                                frameEvents.push(failedDribbleEvent);
                                visualEvents.push(failedDribbleEvent);
                                continue;
                            }
                        }
                    }
                } else {
                const attackingContext = possession === 'home' ? teamContexts.home : teamContexts.away;
                const safePassCandidates = buildSafePassCandidates(
                    actingCarrier,
                    attackingPlayers,
                    defendingPlayers,
                    possession,
                );
                const passOption = choosePassOption(
                    actingCarrier,
                    safePassCandidates.length > 0 ? safePassCandidates : attackingPlayers,
                    defendingPlayers,
                    ball,
                    attackingContext,
                );
                const fallbackPool = safePassCandidates.length > 0 ? safePassCandidates : attackingPlayers.filter((player) => player.id !== actingCarrier.id);
                const fallbackTarget: V2PlayerState = fallbackPool
                    .slice()
                    .sort((left, right) => getDistance(actingCarrier.position2D, left.position2D) - getDistance(actingCarrier.position2D, right.position2D))[0]
                    || actingCarrier;
                const selectedTarget: V2PlayerState = passOption?.receiver || fallbackTarget;
                action = {
                    kind: 'PASS',
                    from: actingCarrier,
                    to: selectedTarget,
                    team: possession,
                };

                if (passOption && absoluteTick % TUNING_PARAMS.telemetryLogIntervalTicks === 0) {
                    telemetryCollector.recordPassSelection({
                        minute,
                        from: carrier.position,
                        to: selectedTarget.position,
                        utility: passOption.utility,
                        risk: passOption.riskLevel,
                        successProbability: passOption.successProbability,
                    });
                    console.log(
                        `[V2-Phase4] Minute ${minute}: Pass (${carrier.position}→${selectedTarget.position}) ` +
                        `score=${passOption.utility.toFixed(1)} dist=${passOption.distance.toFixed(1)} ` +
                        `succ=${(passOption.successProbability * 100).toFixed(0)}% risk=${passOption.riskLevel.toFixed(2)}`,
                    );
                }
                }
            }

            if (action.kind === 'PASS') {
                playerStats[action.from.id].passesAttempted += 1;
                teamStats[possession].passesAttempted += 1;

                const passDistance = getDistance(action.from.position2D, action.to.position2D);
                const isShortPass = passDistance <= Number(TUNING_PARAMS.passShortDistanceThreshold || 18);
                const passTravelTicks = getPassTravelTicks(passDistance);
                let turnoverWinner: V2PlayerState | null = null;
                let turnoverReason = '';

                if (isShortPass) {
                    const laneBlocker = findShortPassLaneBlocker(
                        action.from.position2D,
                        action.to.position2D,
                        defendingPlayers,
                    );
                    if (laneBlocker) {
                        turnoverWinner = laneBlocker;
                        turnoverReason = 'SHORT_PASS_BLOCKED';
                    } else {
                        const receiverContestWinner = resolveShortPassReceiverContest(
                            action.from,
                            action.to,
                            defendingPlayers,
                        );
                        if (receiverContestWinner) {
                            turnoverWinner = receiverContestWinner;
                            turnoverReason = 'SHORT_PASS_RECEIVER_CONTEST_LOST';
                        }
                    }
                } else {
                    const longPassContestWinner = resolveLongPassArrivalContest(
                        action.from,
                        action.to,
                        defendingPlayers,
                        minute,
                        passTravelTicks,
                    );
                    if (longPassContestWinner) {
                        turnoverWinner = longPassContestWinner;
                        turnoverReason = 'LONG_PASS_ARRIVAL_CONTEST_LOST';
                    }
                }

                if (turnoverWinner) {
                    possession = possession === 'home' ? 'away' : 'home';
                    carrier = turnoverWinner;
                    ball.possession = possession;
                    ball.carrier = carrier;
                    ball.position = { ...turnoverWinner.position2D };

                    const nearTouchline = action.to.position2D.y <= 2 || action.to.position2D.y >= FIELD.WIDTH - 2;
                    if (nearTouchline) {
                        const throwResult = executeThrowInV2(
                            possession,
                            minute,
                            tick,
                            { ...action.to.position2D },
                            homeTeam,
                            awayTeam,
                            homePlayers,
                            awayPlayers,
                            playerStats,
                            teamStats,
                            frameEvents,
                            visualEvents,
                            events,
                        );
                        possession = throwResult.possession;
                        carrier = throwResult.carrier;
                        ball.possession = throwResult.possession;
                        ball.carrier = throwResult.carrier;
                        ball.position = { ...throwResult.position };
                    }

                    const failedPassEvent: VisualEvent = {
                        id: `pass_fail_${absoluteTick}_${action.from.id}`,
                        type: 'PASS',
                        minute,
                        tick,
                        position: { ...action.from.position2D },
                        playerId: action.from.id,
                        playerName: action.from.name,
                        teamId: attackingTeamId,
                        targetPlayerId: action.to.id,
                        metadata: {
                            success: false,
                            reason: `${turnoverReason}:${isShortPass ? 'SHORT' : 'LONG'}:${turnoverWinner.id}`,
                            distance: passDistance,
                        },
                    };
                    frameEvents.push(failedPassEvent);
                    visualEvents.push(failedPassEvent);

                    if (absoluteTick % TUNING_PARAMS.telemetryLogIntervalTicks === 0) {
                        console.log(`[V2-PASS] Minute ${minute}: ${turnoverReason} by ${turnoverWinner.position}`);
                    }

                    const playerPositionsFail: Record<string, SpatialPosition> = {};
                    activeHomePlayers.forEach((p) => { playerPositionsFail[p.id] = { ...p.position2D }; });
                    activeAwayPlayers.forEach((p) => { playerPositionsFail[p.id] = { ...p.position2D }; });
                    const frameDebugFail = buildFrameDebug(
                        { minute, tick, ball: { ...ball }, playerPositions: playerPositionsFail, events: frameEvents, ballTransitions: frameTransitions },
                        homeIntents,
                        awayIntents,
                        homeDefensiveAssignment,
                        awayDefensiveAssignment,
                        lineHeightToX('home', teamContexts.home.lineHeight),
                        lineHeightToX('away', teamContexts.away.lineHeight),
                        activeHomePlayers,
                        activeAwayPlayers,
                    );
                    frames.push({ minute, tick, ball: { ...ball, position: { ...ball.position }, velocity: { ...ball.velocity }, carrier: ball.carrier }, playerPositions: playerPositionsFail, events: frameEvents, ballTransitions: frameTransitions, debug: frameDebugFail });
                    telemetryCollector.recordFrame();
                    continue;
                }

                // Pass succeeds
                const transition = createBallTransition(
                    'PASS',
                    action.from.position2D,
                    action.to.position2D,
                    action.from.id,
                    minute,
                    tick,
                    true,
                    action.to.id,
                );
                const event: VisualEvent = {
                    id: `pass_${absoluteTick}_${action.from.id}`,
                    type: 'PASS',
                    minute,
                    tick,
                    position: { ...action.from.position2D },
                    playerId: action.from.id,
                    playerName: action.from.name,
                    teamId: attackingTeamId,
                    targetPlayerId: action.to.id,
                    metadata: {
                        trajectory: transition.trajectory,
                        success: true,
                        distance: getDistance(action.from.position2D, action.to.position2D),
                    },
                };

                ballTransitions.push(transition);
                frameTransitions.push(transition);
                frameEvents.push(event);
                visualEvents.push(event);
                playerStats[action.from.id].passesCompleted += 1;
                action.from.stats.passes = playerStats[action.from.id].passesCompleted;
                teamStats[possession].passesCompleted += 1;
                activeTransition = {
                    transition,
                    startedAtTick: absoluteTick,
                    receivingPlayer: action.to,
                    resultingPossession: possession,
                    event,
                };
            } else if (action.kind === 'DRIBBLE') {
                action.from.position2D = { ...action.toPosition };
                ball.position = { ...action.toPosition };
                ball.carrier = action.from;
                ball.possession = action.team;

                const beatOpponent = !!action.beatenDefenderId;
                if (action.isDuel) {
                    playerStats[action.from.id].dribblesAttempted += 1;
                    if (beatOpponent) {
                        playerStats[action.from.id].dribblesWon += 1;
                        playerStats[action.from.id].rating += 0.04;
                    }
                }

                // Only emit DRIBBLE event when an opponent is actually beaten.
                // Simple lane-carry remains tracked as possession-space analytics.
                if (beatOpponent) {
                    const dribbleEvent: VisualEvent = {
                        id: `dribble_${absoluteTick}_${action.from.id}`,
                        type: 'DRIBBLE',
                        minute,
                        tick,
                        position: { ...action.toPosition },
                        playerId: action.from.id,
                        playerName: action.from.name,
                        teamId: attackingTeamId,
                        metadata: { success: true, reason: 'BEAT_OPPONENT' },
                    };

                    frameEvents.push(dribbleEvent);
                    visualEvents.push(dribbleEvent);
                }
            } else {
                const shotOutcome: ShotOutcome = action.outcome;
                const shotDistance = Math.round(getDistance(action.from.position2D, shotOutcome.target));
                const eventType: 'GOAL' | 'SHOT' = shotOutcome.outcome === 'GOAL' ? 'GOAL' : 'SHOT';
                let resultingPossession: 'home' | 'away' = shotOutcome.resultingPossession;
                let receivingPlayer: V2PlayerState | null = shotOutcome.receivingPlayer;
                const transition = createBallTransition(
                    eventType,
                    action.from.position2D,
                    shotOutcome.target,
                    action.from.id,
                    minute,
                    tick,
                    shotOutcome.outcome === 'GOAL',
                    receivingPlayer?.id,
                );
                const event: VisualEvent = {
                    id: `${eventType.toLowerCase()}_${absoluteTick}_${action.from.id}`,
                    type: eventType,
                    minute,
                    tick,
                    position: { ...action.from.position2D },
                    playerId: action.from.id,
                    playerName: action.from.name,
                    teamId: attackingTeamId,
                    targetPlayerId: receivingPlayer?.id,
                    metadata: {
                        trajectory: transition.trajectory,
                        success: shotOutcome.outcome === 'GOAL',
                        distance: getDistance(action.from.position2D, shotOutcome.target),
                        goalType: shotOutcome.outcome === 'GOAL' ? 'OPEN_PLAY' : undefined,
                        reason: shotOutcome.saveType ? `${shotOutcome.outcome}_${shotOutcome.saveType}` : shotOutcome.outcome,
                    },
                };

                let followUp: ActiveTransition['followUp'];
                if (shotOutcome.outcome === 'SAVED' && shotOutcome.saveType === 'PARRY' && shotOutcome.reboundTarget) {
                    const reboundReceiver = pickReboundReceiver(shotOutcome.reboundTarget, attackingPlayers, defendingPlayers);
                    const reboundTransition = createBallTransition(
                        'SAVE',
                        shotOutcome.target,
                        shotOutcome.reboundTarget,
                        action.goalkeeper?.id || action.from.id,
                        minute,
                        tick,
                        true,
                        reboundReceiver?.id,
                    );
                    followUp = {
                        transition: reboundTransition,
                        receivingPlayer: reboundReceiver,
                        resultingPossession: reboundReceiver?.side || resultingPossession,
                    };
                }

                // V1 parity: non-goal shots can concede corner kicks
                if (shotOutcome.outcome !== 'GOAL' && !followUp && v2Random() < 0.18) {
                    const cornerResult = executeCornerV2(
                        possession,
                        minute,
                        tick,
                        shotOutcome.target,
                        homeTeam,
                        awayTeam,
                        homePlayers,
                        awayPlayers,
                        playerStats,
                        teamStats,
                        frameEvents,
                        visualEvents,
                        events,
                    );
                    resultingPossession = cornerResult.possession;
                    receivingPlayer = cornerResult.carrier;
                    ball.position = { ...cornerResult.position };
                }

                ballTransitions.push(transition);
                frameTransitions.push(transition);
                visualEvents.push(event);
                events.push({
                    minute,
                    type: eventType,
                    text: shotOutcome.outcome === 'GOAL'
                        ? `⚽ GOAL! ${action.from.name} scores! (${shotDistance}m)`
                        : shotOutcome.outcome === 'SAVED'
                            ? shotOutcome.saveType === 'PARRY'
                                ? `🧤 ${action.goalkeeper?.name || 'Goalkeeper'} parries (shot by ${action.from.name}, ${shotDistance}m)`
                                : `🧤 Saved by ${action.goalkeeper?.name || 'Goalkeeper'} (shot by ${action.from.name}, ${shotDistance}m)`
                            : `❌ ${action.from.name} fires wide (${shotDistance}m)`,
                    teamId: attackingTeamId,
                    playerId: action.from.id,
                });

                playerStats[action.from.id].shots += 1;
                teamStats[possession].shots += 1;
                if (shotOutcome.outcome === 'GOAL' || shotOutcome.outcome === 'SAVED') {
                    playerStats[action.from.id].shotsOnTarget += 1;
                    teamStats[possession].shotsOnTarget += 1;
                }
                if (shotOutcome.outcome === 'GOAL') {
                    playerStats[action.from.id].goals += 1;
                    action.from.stats.goals = playerStats[action.from.id].goals;
                    playerStats[action.from.id].rating += 0.8;
                } else if (action.goalkeeper) {
                    playerStats[action.goalkeeper.id].saves += 1;
                    playerStats[action.goalkeeper.id].rating += 0.3;
                }

                activeTransition = {
                    transition,
                    startedAtTick: absoluteTick,
                    receivingPlayer,
                    resultingPossession,
                    event,
                    outcome: shotOutcome.outcome,
                    followUp,
                };
            }
            }
        } else if (!pendingKickoff && !activeTransition) {
            // Loose-ball recovery: if no carrier, quickly assign nearest winner
            // so simulation does not stall in permanent "Loose ball" state.
            const nearestHome = [...homePlayers]
                .sort((a, b) => getDistance(a.position2D, ball.position) - getDistance(b.position2D, ball.position))[0];
            const nearestAway = [...awayPlayers]
                .sort((a, b) => getDistance(a.position2D, ball.position) - getDistance(b.position2D, ball.position))[0];

            if (nearestHome || nearestAway) {
                const homeDistance = nearestHome ? getDistance(nearestHome.position2D, ball.position) : Number.POSITIVE_INFINITY;
                const awayDistance = nearestAway ? getDistance(nearestAway.position2D, ball.position) : Number.POSITIVE_INFINITY;

                const homeSpeed = nearestHome
                    ? ((nearestHome.attributes.pace || 10) + (nearestHome.attributes.acceleration || 10)) / 2
                    : 0;
                const awaySpeed = nearestAway
                    ? ((nearestAway.attributes.pace || 10) + (nearestAway.attributes.acceleration || 10)) / 2
                    : 0;

                const homeArrival = homeDistance / Math.max(1, homeSpeed);
                const awayArrival = awayDistance / Math.max(1, awaySpeed);

                const winner = homeArrival <= awayArrival
                    ? (nearestHome || nearestAway)
                    : (nearestAway || nearestHome);

                if (winner) {
                    carrier = winner;
                    possession = winner.side;
                    ball.carrier = winner;
                    ball.possession = possession;
                    ball.position = { ...winner.position2D };
                }
            }
        }

        enforcePerTickMovementCap(
            [...homePlayers, ...awayPlayers],
            previousPositionByPlayer,
            minute,
            carrier?.id || null,
        );

        if (carrier) {
            ball.position = { ...carrier.position2D };
            ball.carrier = carrier;
        }

        ball.possession = possession;

        if (carrier) {
            const stat = playerStats[carrier.id];
            if (carrier.position2D.x <= 30) stat.defensiveThirdTouches += 1;
            else if (carrier.position2D.x <= 70) stat.middleThirdTouches += 1;
            else stat.attackingThirdTouches += 1;
        }

        [...homePlayers, ...awayPlayers].forEach((player) => {
            const analytics = playerMovementAnalytics[player.id];
            if (!analytics) return;

            const previous = previousPositionByPlayer.get(player.id) || player.position2D;
            const movementDistance = getDistance(previous, player.position2D);
            analytics.movementDistance += movementDistance;
            analytics.samples += 1;

            if (player.position2D.x <= FIELD.DEFENSIVE_THIRD) analytics.zoneSeconds.defensive += TUNING_PARAMS.movementTickSeconds;
            else if (player.position2D.x <= FIELD.MIDDLE_THIRD) analytics.zoneSeconds.middle += TUNING_PARAMS.movementTickSeconds;
            else analytics.zoneSeconds.attacking += TUNING_PARAMS.movementTickSeconds;

            if (carrier?.id === player.id) {
                analytics.carrySeconds += TUNING_PARAMS.movementTickSeconds;
                analytics.carryDistance += movementDistance;
            }

            previousPositionByPlayer.set(player.id, { ...player.position2D });

            // --- Condition decay per tick ---
            // Only active (on-field) players lose condition; bench players stay at initial condition.
            if (player.tacticalPosition !== null || isPlayerSentOff(player)) {
                const staminaVal = clampAttribute20(player.attributes?.stamina);
                // staminaFactor: high stamina (20) → 0.70, average (10) → 1.00, low (5) → 1.15
                const staminaFactor = 1.30 - (staminaVal / 20) * 0.60;
                // Base decay per tick: 0.042 → ×900 ticks = 37.8 for avg stamina (final ~62)
                const baseDecay = 0.042 * staminaFactor;
                // Movement decay: each unit of distance per tick adds a tiny fatigue cost
                const movementDecay = movementDistance * 0.003;
                // Carrier bonus: ball carrier expends extra energy this tick
                const carrierDecay = carrier?.id === player.id ? 0.010 : 0;
                const totalDecay = baseDecay + movementDecay + carrierDecay;
                player.condition = Math.max(0, (player.condition || 100) - totalDecay);
            }
            // --------------------------------
        });

        const playerPositions: Record<string, SpatialPosition> = {};
        activeHomePlayers.forEach((player) => {
            playerPositions[player.id] = { ...player.position2D };
        });
        activeAwayPlayers.forEach((player) => {
            playerPositions[player.id] = { ...player.position2D };
        });

        const frameDebug = buildFrameDebug(
            { minute, tick, ball: { ...ball }, playerPositions, events: frameEvents, ballTransitions: frameTransitions },
            homeIntents,
            awayIntents,
            homeDefensiveAssignment,
            awayDefensiveAssignment,
            lineHeightToX('home', teamContexts.home.lineHeight),
            lineHeightToX('away', teamContexts.away.lineHeight),
            activeHomePlayers,
            activeAwayPlayers,
        );

        frames.push({
            minute,
            tick,
            ball: {
                ...ball,
                position: { ...ball.position },
                velocity: { ...ball.velocity },
                carrier: ball.carrier,
            },
            playerPositions,
            events: frameEvents,
            ballTransitions: frameTransitions,
            debug: frameDebug,
        });
        telemetryCollector.recordFrame();
    }

    // Write final decayed condition into playerStats.fitnessEnd for each player
    [...homePlayers, ...awayPlayers].forEach((player) => {
        if (playerStats[player.id]) {
            playerStats[player.id].fitnessEnd = Math.round(player.condition);
        }
    });

    // Clamp final ratings to realistic match range (1.0 - 10.0)
    Object.values(playerStats).forEach((stat) => {
        if ((stat.minutes || 0) <= 0) {
            stat.rating = 0;
            return;
        }
        const raw = typeof stat.rating === 'number' ? stat.rating : 6;
        const clamped = Math.max(1, Math.min(10, raw));
        stat.rating = Number(clamped.toFixed(2));
    });

    teamStats.home.possession = Math.round((possessionTicks.home / TOTAL_TICKS) * 100);
    teamStats.away.possession = 100 - teamStats.home.possession;

    // Aggregate per-player stats into team-level stats
    const aggregateTeamStats = (teamId: string): TeamMatchStats => {
        const baseStats = teamStats[teamId === homeTeam.id ? 'home' : 'away'];
        const stats = { ...baseStats } as unknown as Record<string, number>;
        const teamPlayers = Object.values(playerStats).filter(p => p.teamId === teamId);
        
        stats.tacklesAttempted = teamPlayers.reduce((sum, p) => sum + (p.tacklesAttempted || 0), 0);
        stats.tacklesWon = teamPlayers.reduce((sum, p) => sum + (p.tacklesWon || 0), 0);
        stats.dribblesAttempted = teamPlayers.reduce((sum, p) => sum + (p.dribblesAttempted || 0), 0);
        stats.dribblesWon = teamPlayers.reduce((sum, p) => sum + (p.dribblesWon || 0), 0);
        stats.fouls = teamPlayers.reduce((sum, p) => sum + (p.fouls || 0), 0);
        stats.yellowCards = teamPlayers.reduce((sum, p) => sum + (p.yellowCards || 0), 0);
        stats.redCards = teamPlayers.reduce((sum, p) => sum + (p.redCards || 0), 0);
        stats.corners = teamPlayers.reduce((sum, p) => sum + (p.corners || 0), 0);
        stats.freeKicks = teamPlayers.reduce((sum, p) => sum + (p.freeKicks || 0), 0);
        stats.throws = teamPlayers.reduce((sum, p) => sum + (p.throws || 0), 0);
        
        return stats as unknown as TeamMatchStats;
    };
    
    teamStats.home = aggregateTeamStats(homeTeam.id);
    teamStats.away = aggregateTeamStats(awayTeam.id);

    const teamIdByPlayerId = new Map<string, string>();
    Object.values(playerStats).forEach((stat) => {
        teamIdByPlayerId.set(stat.playerId, stat.teamId);
    });

    const v2ActionLogs: PlayerActionLog[] = [];
    frames.forEach((frame) => {
        const minute = Math.max(1, Number(frame.minute || 0) + 1);
        const tick = Number(frame.tick || 0);
        let sequence = 0;

        // One compact movement snapshot record per tick (all on-field players in metadata).
        const ballX = Number(frame.ball.position?.x ?? 50);
        const ballY = Number(frame.ball.position?.y ?? 50);
        const ballPosition = Math.max(0, Math.min(100, Math.round(ballX)));
        const homeTeamPlayers = Object.entries(frame.playerPositions || {})
            .filter(([playerId]) => teamIdByPlayerId.get(playerId) === homeTeam.id)
            .map(([playerId, position]) => ({
                playerId,
                role: (playerStats[playerId]?.position || 'UNK'),
                x: Number(position.x),
                y: Number(position.y),
            }));
        const awayTeamPlayers = Object.entries(frame.playerPositions || {})
            .filter(([playerId]) => teamIdByPlayerId.get(playerId) === awayTeam.id)
            .map(([playerId, position]) => ({
                playerId,
                role: (playerStats[playerId]?.position || 'UNK'),
                x: Number(position.x),
                y: Number(position.y),
            }));

        const snapshotPlayerId = frame.ball?.carrier?.id
            || homeTeamPlayers[0]?.playerId
            || awayTeamPlayers[0]?.playerId;
        const snapshotTeamId = snapshotPlayerId ? teamIdByPlayerId.get(snapshotPlayerId) : undefined;
        if (snapshotPlayerId && snapshotTeamId) {
            v2ActionLogs.push({
                playerId: snapshotPlayerId,
                teamId: snapshotTeamId,
                minute,
                snapshotMinute: minute,
                tick,
                sequence: sequence++,
                logType: 'MOVEMENT',
                x: ballX,
                y: ballY,
                ballPosition,
                zone: getZoneFromBallPosition(ballPosition),
                actionType: 'TICK_SNAPSHOT',
                trickGroup: 'MOVEMENT',
                trick: 'TEAM_POSITIONS',
                result: 'TRACK',
                isSuccessful: true,
                metadata: JSON.stringify({
                    source: 'V2_TICK_SNAPSHOT',
                    home_team: homeTeamPlayers,
                    away_team: awayTeamPlayers,
                    carrierPlayerId: frame.ball?.carrier?.id || null,
                }),
            });
        }

        [...homeTeamPlayers, ...awayTeamPlayers].forEach((playerPosition) => {
            const playerTeamId = teamIdByPlayerId.get(playerPosition.playerId);
            if (!playerTeamId) return;

            v2ActionLogs.push({
                playerId: playerPosition.playerId,
                teamId: playerTeamId,
                minute,
                snapshotMinute: minute,
                tick,
                sequence: sequence++,
                logType: 'MOVEMENT',
                x: playerPosition.x,
                y: playerPosition.y,
                ballPosition: Math.max(0, Math.min(100, Math.round(playerPosition.x))),
                zone: getZoneFromBallPosition(Math.max(0, Math.min(100, Math.round(playerPosition.x)))),
                actionType: 'POSITION_SAMPLE',
                trickGroup: 'MOVEMENT',
                trick: 'POSITION_SAMPLE',
                result: 'TRACK',
                isSuccessful: true,
                metadata: JSON.stringify({
                    source: 'V2_PLAYER_POSITION',
                    role: playerPosition.role,
                    carrierPlayerId: frame.ball?.carrier?.id || null,
                    isCarrier: frame.ball?.carrier?.id === playerPosition.playerId,
                    ballX,
                    ballY,
                }),
            });
        });

        (frame.events || []).forEach((event) => {
            if (!event.playerId || !event.teamId) return;

            // x/y in PlayerActionLog are reserved for BALL position only.
            const x = ballX;
            const y = ballY;
            const eventBallPosition = Math.max(0, Math.min(100, Math.round(x)));
            const eventResult = resolveEventResult(event);

            v2ActionLogs.push({
                playerId: event.playerId,
                teamId: String(event.teamId),
                minute,
                snapshotMinute: minute,
                tick,
                sequence: sequence++,
                logType: 'ACTION',
                x,
                y,
                ballPosition: eventBallPosition,
                zone: getZoneFromBallPosition(eventBallPosition),
                actionType: String(event.type || 'EVENT'),
                trickGroup: resolveEventTrickGroup(String(event.type || 'EVENT')),
                trick: String(event.type || 'EVENT'),
                result: eventResult,
                isSuccessful: eventResult === 'SUCCESS' || eventResult === 'GOAL',
                expectedSuccessRate: undefined,
                targetPlayerId: event.targetPlayerId,
                metadata: JSON.stringify({
                    source: 'V2_FRAME_EVENT',
                    eventId: event.id,
                    eventType: event.type,
                    eventMinute: event.minute,
                    frameTick: event.tick,
                    reason: event.metadata?.reason,
                    success: event.metadata?.success,
                    distance: event.metadata?.distance,
                }),
            });
        });
    });

    return {
        minute: TOTAL_MINUTES,
        homeScore,
        awayScore,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        teamStats,
        events,
        actionLogs: v2ActionLogs,
        isFinished: true,
        playerStats,
        frames,
        visualEvents,
        ballTransitions,
        homeFormationCoordinates,
        awayFormationCoordinates,
        telemetry: telemetryCollector.finalize(),
        playerMovementAnalytics,
    };
    });
}
