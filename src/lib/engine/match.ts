import { TeamState, MatchState, PlayerState, EnginePlayerMatchStats, TeamMatchStats, PlayerActionLog, MatchPrepConfig } from './types';
import { calculateActionScore } from './formulas';
import { getRoleEffects, getRoleConditionDrain } from './playerRoles';
import {
    BASE_DIRECT_RED_CHANCE,
    BASE_YELLOW_CARD_CHANCE,
    BOOKED_TACKLE_SUCCESS_PENALTY_MAX,
    BOOKED_TACKLE_SUCCESS_PENALTY_PER_YELLOW,
    TEAM_DOWN_SUCCESS_MIN_MULTIPLIER,
    TEAM_DOWN_SUCCESS_PENALTY_PER_RED,
    clamp
} from '../constants/disciplineInjury';

type ActionType = 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT';
type Intensity = 'LOW' | 'MEDIUM' | 'HIGH';

interface BallState {
    position: number; // 0-100 (0=home goal, 100=away goal)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
}

type DefensiveActionKind = 'PRESS' | 'INTERCEPTION' | 'TACKLE' | 'BLOCK' | 'RECOVERY';

function clampRate(rate: number): number {
    return Math.max(0, Math.min(1, rate));
}

function isPlayerSentOff(player: PlayerState): boolean {
    return (player.cards?.red || 0) > 0;
}

function getTeamSentOffCount(team: TeamState): number {
    return team.players.reduce((count, player) => count + (isPlayerSentOff(player) ? 1 : 0), 0);
}

function getTeamDownSuccessMultiplier(team: TeamState): number {
    const reds = getTeamSentOffCount(team);
    if (reds <= 0) return 1;
    return Math.max(TEAM_DOWN_SUCCESS_MIN_MULTIPLIER, 1 - (TEAM_DOWN_SUCCESS_PENALTY_PER_RED * reds));
}

function getBookedTackleMultiplier(player: PlayerState): number {
    const yellow = player.cards?.yellow || 0;
    if (yellow <= 0) return 1;
    const penalty = Math.min(BOOKED_TACKLE_SUCCESS_PENALTY_MAX, yellow * BOOKED_TACKLE_SUCCESS_PENALTY_PER_YELLOW);
    return Math.max(0.6, 1 - penalty);
}

function getTacklingInstructionFactor(tackling: string): number {
    switch (tackling) {
        case 'SOFT':
            return 0.78;
        case 'HARD':
            return 1.35;
        default:
            return 1.0;
    }
}

function getDefenderDisciplineProfile(defender: PlayerState, defendingTeam: TeamState) {
    const tacklingBuff = getTacklingBuff(defendingTeam.tactics.tackling);

    const aggressionNorm = clamp((defender.attributes.aggression || 0) / 20, 0, 1);
    const braveryNorm = clamp((defender.attributes.bravery || 0) / 20, 0, 1);
    const teamworkNorm = clamp((defender.attributes.teamwork || 0) / 20, 0, 1);

    // Natural tendency (นิสัย): aggression + bravery
    const personalityRisk = 0.55 + (aggressionNorm * 0.3) + (braveryNorm * 0.25);

    // Tactical instruction strength (แผน) with stronger base influence than personality
    const instructionRisk = getTacklingInstructionFactor(defendingTeam.tactics.tackling);

    // Teamwork controls compliance: high teamwork => follow plan more
    const planWeight = clamp(0.55 + (teamworkNorm * 0.35), 0.55, 0.9);
    const personalityWeight = 1 - planWeight;

    const effectiveRisk = (instructionRisk * planWeight) + (personalityRisk * personalityWeight);
    const foulMultiplier = clamp(tacklingBuff.foul * effectiveRisk, 0.55, 1.7);
    const recklessIndex = clamp((aggressionNorm * 0.55) + (braveryNorm * 0.45), 0, 1);

    return {
        foulMultiplier,
        recklessIndex,
        planWeight,
        personalityWeight,
        instructionRisk,
        personalityRisk,
    };
}

function applyCardFromFoul(
    defender: PlayerState,
    attackingPlayer: PlayerState,
    defendingTeam: TeamState,
    matchState: MatchState,
    minute: number,
    foulZone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING',
    ballPosition: number
) {
    const defenderStats = matchState.playerStats[defender.id];
    const isHomeDefender = defenderStats.teamId === matchState.homeTeamId;
    const teamStats = isHomeDefender ? matchState.teamStats.home : matchState.teamStats.away;

    const disciplineProfile = getDefenderDisciplineProfile(defender, defendingTeam);
    const foulsInMatch = defenderStats.fouls || 0;
    const repeatFoulYellowBoost = foulsInMatch >= 2
        ? (1 + Math.min(0.55, (foulsInMatch - 1) * 0.18))
        : 1;
    const repeatFoulRedBoost = foulsInMatch >= 3
        ? (1 + Math.min(0.45, (foulsInMatch - 2) * 0.15))
        : 1;

    const yellowChance = BASE_YELLOW_CARD_CHANCE
        * disciplineProfile.foulMultiplier
        * (0.85 + disciplineProfile.recklessIndex * 0.35)
        * repeatFoulYellowBoost;
    const directRedChance = BASE_DIRECT_RED_CHANCE
        * disciplineProfile.foulMultiplier
        * (0.7 + disciplineProfile.recklessIndex * 0.6)
        * repeatFoulRedBoost;

    const secondYellowRiskBoost = (defender.cards.yellow > 0) ? 1.05 : 1;
    const getsYellow = Math.random() < (yellowChance * secondYellowRiskBoost);
    const getsDirectRed = Math.random() < directRedChance;

    if (!getsYellow && !getsDirectRed) return;

    if (getsYellow) {
        defender.cards.yellow += 1;
        defenderStats.yellowCards += 1;
        teamStats.yellowCards += 1;
    }

    const secondYellowToRed = getsYellow && defender.cards.yellow >= 2;
    if (getsDirectRed || secondYellowToRed) {
        if (defender.cards.red === 0) {
            defender.cards.red = 1;
            defenderStats.redCards += 1;
            teamStats.redCards += 1;

            // Keep played minutes aligned with dismissal timing.
            // Example: sent off at 72' => minutes should not remain 90.
            defenderStats.minutes = Math.min(defenderStats.minutes || 90, minute);
        }

        matchState.events.push({
            minute,
            type: 'CARD_RED',
            text: secondYellowToRed
                ? `Second yellow! ${defender.name} is sent off after fouling ${attackingPlayer.name} (Foul #${foulsInMatch}).`
                : `Straight red card! ${defender.name} is sent off for a reckless foul on ${attackingPlayer.name} (Foul #${foulsInMatch}).`,
            teamId: defenderStats.teamId,
            playerId: defender.id
        });
        return;
    }

    matchState.events.push({
        minute,
        type: 'CARD_YELLOW',
        text: `${defender.name} is booked for fouling ${attackingPlayer.name} (Foul #${foulsInMatch}).`,
        teamId: defenderStats.teamId,
        playerId: defender.id
    });

    pushActionLog(matchState, {
        playerId: defender.id,
        teamId: defenderStats.teamId,
        minute,
        ballPosition: Math.round(ballPosition),
        zone: foulZone,
        actionType: 'FOUL',
        result: 'FAIL',
        isSuccessful: false,
        targetPlayerId: attackingPlayer.id,
        metadata: JSON.stringify({
            card: 'YELLOW',
            foulsInMatch,
            repeatFoulYellowBoost,
            repeatFoulRedBoost,
            yellowChance,
            directRedChance,
            disciplineProfile
        })
    });
}

function getZoneFromPosition(ballPosition: number, isAttacking: boolean): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    const effectivePosition = isAttacking ? ballPosition : (100 - ballPosition);
    if (effectivePosition <= 30) return 'DEFENSIVE';
    if (effectivePosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
}

function trackFieldTouch(stat: EnginePlayerMatchStats, zone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING') {
    if (zone === 'DEFENSIVE') stat.defensiveThirdTouches++;
    else if (zone === 'MIDDLE') stat.middleThirdTouches++;
    else stat.attackingThirdTouches++;
}

function pushActionLog(matchState: MatchState, log: PlayerActionLog) {
    matchState.actionLogs.push(log);
}

function normalizePositionLabel(label: string | null | undefined): string | null {
    if (!label) return null;
    const base = label.split('_')[0].toUpperCase();
    if (base === 'FW') return 'FWC';
    return base;
}

function getPlayerLine(player: PlayerState): 'GK' | 'DEFENSE' | 'MIDFIELD' | 'ATTACK' {
    const normalized = normalizePositionLabel(player.tacticalPosition) || normalizePositionLabel(player.position);
    if (normalized === 'GK') return 'GK';
    if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(normalized || '')) return 'DEFENSE';
    if (['MR', 'ML', 'MC', 'AMC', 'AMR', 'AML'].includes(normalized || '')) return 'MIDFIELD';
    return 'ATTACK';
}

function getDistanceToOwnGoal(ballPosition: number, isHomeAttacking: boolean): number {
    return isHomeAttacking ? 100 - ballPosition : ballPosition;
}

function getDefensiveZoneWeight(
    player: PlayerState,
    distanceToOwnGoal: number,
    actionKind: DefensiveActionKind
): number {
    const line = getPlayerLine(player);
    if (line === 'GK') return actionKind === 'RECOVERY' ? 0.3 : 0.01;

    if (distanceToOwnGoal <= 18) {
        if (line === 'DEFENSE') return actionKind === 'BLOCK' ? 2.5 : 2.2;
        if (line === 'MIDFIELD') return 0.75;
        return 0.12;
    }

    if (distanceToOwnGoal <= 40) {
        if (line === 'DEFENSE') return 1.75;
        if (line === 'MIDFIELD') return actionKind === 'PRESS' ? 1.35 : 1.15;
        return 0.35;
    }

    if (distanceToOwnGoal <= 70) {
        if (line === 'DEFENSE') return 0.95;
        if (line === 'MIDFIELD') return 1.55;
        return actionKind === 'PRESS' ? 1.05 : 0.8;
    }

    if (line === 'DEFENSE') return 0.45;
    if (line === 'MIDFIELD') return actionKind === 'PRESS' ? 1.2 : 1.0;
    return actionKind === 'PRESS' || actionKind === 'INTERCEPTION' ? 1.55 : 0.55;
}

function getDefensiveActionAttributeWeight(player: PlayerState, actionKind: DefensiveActionKind): number {
    const attrs = player.attributes;

    switch (actionKind) {
        case 'TACKLE':
            return (attrs.tackling * 0.45) + (attrs.positioning * 0.2) + (attrs.strength * 0.2) + (attrs.aggression * 0.1) + (attrs.bravery * 0.05);
        case 'PRESS':
            return (attrs.aggression * 0.28) + (attrs.positioning * 0.24) + (attrs.tackling * 0.22) + (attrs.pace * 0.16) + (attrs.stamina * 0.1);
        case 'BLOCK':
            return (attrs.positioning * 0.35) + (attrs.tackling * 0.25) + (attrs.bravery * 0.2) + (attrs.strength * 0.2);
        case 'RECOVERY':
            return (attrs.positioning * 0.4) + (attrs.passing * 0.15) + (attrs.composure * 0.15) + (attrs.tackling * 0.15) + (attrs.pace * 0.15);
        case 'INTERCEPTION':
        default:
            return (attrs.positioning * 0.4) + (attrs.tackling * 0.22) + (attrs.pace * 0.16) + (attrs.bravery * 0.12) + (attrs.aggression * 0.1);
    }
}

function getDefensiveActionPlayer(
    team: TeamState,
    positions: string[],
    ballPosition: number,
    isHomeAttacking: boolean,
    actionKind: DefensiveActionKind
): PlayerState | undefined {
    const activePlayers = team.players.filter(p => p.tacticalPosition !== null && p.position !== 'GK' && !isPlayerSentOff(p));
    if (activePlayers.length === 0) {
        return team.players.find(p => p.position !== 'GK' && !isPlayerSentOff(p)) || team.players.find(p => !isPlayerSentOff(p)) || team.players[0];
    }

    const normalizedPositions = positions.map(pos => normalizePositionLabel(pos)).filter(Boolean) as string[];
    const candidatePool = activePlayers.filter(player => {
        const natural = normalizePositionLabel(player.position);
        const tactical = normalizePositionLabel(player.tacticalPosition);
        return normalizedPositions.includes(natural || '') || normalizedPositions.includes(tactical || '');
    });

    const pool = candidatePool.length > 0 ? candidatePool : activePlayers;
    const distanceToOwnGoal = getDistanceToOwnGoal(ballPosition, isHomeAttacking);

    const weightedCandidates = pool.map(player => {
        const zoneWeight = getDefensiveZoneWeight(player, distanceToOwnGoal, actionKind);
        const attributeWeight = getDefensiveActionAttributeWeight(player, actionKind);
        const conditionWeight = Math.max(0.45, player.condition / 100);
        const role = getActiveRolePreset(player, false);
        const roleBoost = role === 'BALL_WINNING_MIDFIELDER' || role === 'MAN_MARKER' || role === 'NO_NONSENSE_DEFENDER'
            ? 1.12
            : 1.0;
        const tacticalBase = normalizePositionLabel(player.tacticalPosition);
        const slotBoost = distanceToOwnGoal <= 40
            ? (['DC', 'DR', 'DL', 'DMC'].includes(tacticalBase || '') ? 1.12 : 1.0)
            : (distanceToOwnGoal >= 70 && ['FWC', 'AMR', 'AML', 'AMC', 'MR', 'ML'].includes(tacticalBase || '') ? 1.1 : 1.0);

        return {
            player,
            weight: Math.max(0.01, zoneWeight * ((attributeWeight / 20) + 0.35) * conditionWeight * roleBoost * slotBoost)
        };
    });

    const totalWeight = weightedCandidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    const roll = Math.random() * totalWeight;
    let cumulative = 0;

    for (const candidate of weightedCandidates) {
        cumulative += candidate.weight;
        if (roll <= cumulative) {
            return candidate.player;
        }
    }

    return weightedCandidates[0]?.player;
}

function getRoleInfluenceByCreativeFreedom(creativeFreedom?: string): number {
    switch (creativeFreedom) {
        case 'STRICT':
        case 'RESTRICTED':
            return 0.8; // follow preset role strongly
        case 'FREEDOM':
        case 'MAXIMUM':
            return 0.3; // rely more on individual attributes
        default:
            return 0.55;
    }
}

function getActiveRolePreset(player: PlayerState, inPossession: boolean): string | null {
    if (inPossession) {
        return player.attackingRolePreset || player.playerRole || null;
    }
    return player.defensiveRolePreset || player.playerRole || null;
}

function scaleRoleModifier(modifier: number, roleInfluence: number): number {
    // roleInfluence=0 => no role impact (1.0)
    // roleInfluence=1 => full modifier
    return 1 + ((modifier - 1) * roleInfluence);
}

function getRoleActionModifier(
    player: PlayerState,
    inPossession: boolean,
    teamTactics: any,
    actionType: ActionType
): number {
    const activeRole = getActiveRolePreset(player, inPossession);
    const roleEffects = activeRole ? getRoleEffects(activeRole) : null;
    const roleInfluence = getRoleInfluenceByCreativeFreedom(teamTactics?.creative_freedom);
    const actionModifiers = roleEffects?.actionModifiers || {};

    // Support aliases used in role definitions
    // - crossing -> long pass style actions
    // - heading -> shooting conversion/finishing context
    const direct = (actionModifiers as any)[actionType] || 1.0;
    const alias = actionType === 'PASS_LONG'
        ? ((actionModifiers as any).crossing || 1.0)
        : actionType === 'SHOOT'
            ? ((actionModifiers as any).heading || 1.0)
            : 1.0;

    return scaleRoleModifier(direct as number, roleInfluence)
        * scaleRoleModifier(alias as number, roleInfluence);
}

function getDefenderOpponentPenalty(
    defender: PlayerState | null | undefined,
    defendingTeamTactics: any,
    actionType: ActionType
): number {
    if (!defender) return 1.0;
    const defenderRole = getActiveRolePreset(defender, false);
    const defenderRoleEffects = defenderRole ? getRoleEffects(defenderRole) : null;
    const defenderRoleInfluence = getRoleInfluenceByCreativeFreedom(defendingTeamTactics?.creative_freedom);
    const rawPenalty = defenderRoleEffects?.opponentPenalty?.[actionType] ?? 1.0;
    return scaleRoleModifier(rawPenalty, defenderRoleInfluence);
}

// ============ MATCH PREP MODIFIERS ============

function tryGetRolePresser(defendingTeam: TeamState, roleName: string): PlayerState | null {
    const rolePool = defendingTeam.players.filter(p => {
        if (p.tacticalPosition === null) return false;
        const defensiveRole = p.defensiveRolePreset || p.playerRole || null;
        return defensiveRole === roleName;
    });

    if (rolePool.length === 0) return null;
    return rolePool[Math.floor(Math.random() * rolePool.length)];
}

function getPressureTriggerChance(presser: PlayerState): number {
    const pressureProfile = (
        (presser.attributes.aggression || 0) +
        (presser.attributes.bravery || 0) +
        (presser.attributes.tackling || 0) +
        (presser.attributes.positioning || 0)
    ) / 4;

    // 50% - 80% as requested
    return clampRate(0.5 + (Math.max(0, Math.min(20, pressureProfile)) / 20) * 0.3);
}

/**
 * Feature 1: Key Player Neutralization (Zone + Role Aware)
 * - Defensive zone: no dedicated pressure
 * - Middle zone: BALL_WINNING_MIDFIELDER attempts pressure
 * - Attacking zone: MAN_MARKER attempts pressure
 *
 * Pressure is probabilistic (50%-80%) so target can still find space at times.
 * Trade-off: defending role users spend extra condition when pressure is triggered.
 */
function applyNeutralizationEffect(
    player: PlayerState,
    prepConfig: MatchPrepConfig | null,
    defendingTeam: TeamState | undefined,
    zone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING',
    weights: Record<ActionType, number>
): Record<ActionType, number> {
    if (!prepConfig?.neutralization || !defendingTeam) {
        return weights;
    }

    const { targetPlayerIds, intensity } = prepConfig.neutralization;
    if (!targetPlayerIds.includes(player.id)) {
        return weights;
    }

    // As requested: no dedicated man-mark pressure in defensive third
    if (zone === 'DEFENSIVE') {
        return weights;
    }

    const requiredRole = zone === 'MIDDLE' ? 'BALL_WINNING_MIDFIELDER' : 'MAN_MARKER';
    const presser = tryGetRolePresser(defendingTeam, requiredRole);
    if (!presser) return weights;

    const triggerChance = getPressureTriggerChance(presser);
    if (Math.random() >= triggerChance) return weights;

    const intensityAmp = intensity === 'TIGHT' ? 0.9 : 1.0;
    const modifiedWeights: Record<ActionType, number> = zone === 'MIDDLE'
        ? {
            PASS_SHORT: weights.PASS_SHORT * 0.85 * intensityAmp,
            PASS_LONG: weights.PASS_LONG * 0.82 * intensityAmp,
            DRIBBLE: weights.DRIBBLE * 0.80 * intensityAmp,
            SHOOT: weights.SHOOT * 0.90 * intensityAmp
        }
        : {
            PASS_SHORT: weights.PASS_SHORT * 0.90 * intensityAmp,
            PASS_LONG: weights.PASS_LONG * 0.88 * intensityAmp,
            DRIBBLE: weights.DRIBBLE * 0.78 * intensityAmp,
            SHOOT: weights.SHOOT * 0.75 * intensityAmp
        };

    // Trade-off: extra condition drain for role users when pressure is executed
    presser.condition = Math.max(0, presser.condition - (requiredRole === 'MAN_MARKER' ? 0.18 : 0.14));
    const rolePool = defendingTeam.players.filter(p => {
        if (p.tacticalPosition === null) return false;
        const defensiveRole = p.defensiveRolePreset || p.playerRole || null;
        return defensiveRole === requiredRole;
    });
    for (const teammate of rolePool) {
        if (teammate.id === presser.id) continue;
        teammate.condition = Math.max(0, teammate.condition - 0.03);
    }

    return modifiedWeights;
}

/**
 * Feature 2: Press Trap
 * Increases interception/tackle success in specific zones
 * Trade-off: Counter-attack vulnerability
 */
function applyPressTrapEffect(
    prepConfig: MatchPrepConfig | null,
    zone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING',
    baseRate: number
): { modifiedRate: number; counterVulnerability: number } {
    if (!prepConfig?.pressTrap) {
        return { modifiedRate: baseRate, counterVulnerability: 0 };
    }

    const { commitment, triggerZones } = prepConfig.pressTrap;

    // Only apply if we're in an active trap zone
    if (!triggerZones.includes(zone)) {
        return { modifiedRate: baseRate, counterVulnerability: 0 };
    }

    // Apply bonuses based on commitment level
    let bonus = 0;
    let vulnerability = 0;

    switch (commitment) {
        case 'SAFE':
            bonus = 0.05;  // +5% interception/tackle
            vulnerability = 0;  // No counter risk
            break;
        case 'BALANCED':
            bonus = 0.10;  // +10%
            vulnerability = 0.10;  // +10% counter vulnerability
            break;
        case 'AGGRESSIVE':
            bonus = 0.15;  // +15%
            vulnerability = 0.20;  // +20% counter vulnerability
            break;
    }

    return {
        modifiedRate: baseRate * (1 + bonus),
        counterVulnerability: vulnerability
    };
}

/**
 * Feature 3: Transition Rules
 * Modifies action weights during possession changes
 */
function applyTransitionEffect(
    prepConfig: MatchPrepConfig | null,
    justWonPossession: boolean,
    weights: Record<ActionType, number>
): Record<ActionType, number> {
    if (!prepConfig?.transitionRules) {
        return weights;
    }

    const { defenseToAttack } = prepConfig.transitionRules;

    // When we just won the ball back
    if (justWonPossession) {
        switch (defenseToAttack) {
            case 'DIRECT':
                return {
                    ...weights,
                    PASS_LONG: weights.PASS_LONG * 1.40,  // +40% long ball tendency
                    PASS_SHORT: weights.PASS_SHORT * 0.70  // -30% short passes
                };
            case 'QUICK':
                return {
                    ...weights,
                    PASS_LONG: weights.PASS_LONG * 1.20,
                    DRIBBLE: weights.DRIBBLE * 1.15
                };
            case 'HOLD':
            default:
                return {
                    ...weights,
                    PASS_SHORT: weights.PASS_SHORT * 1.15  // +15% retention
                };
        }
    }

    return weights;
}

function calculateActionWeights(
    player: PlayerState,
    ballPosition: number,
    isAttacking: boolean,
    teamTactics?: any,
    teamSuccessMultiplier: number = 1,
    opponentPrepConfig?: MatchPrepConfig | null,
    defendingTeam?: TeamState,
    ownPrepConfig?: MatchPrepConfig | null,
    justWonPossession?: boolean
): Record<ActionType, number> {
    const distance = isAttacking ? 100 - ballPosition : ballPosition;
    const distanceToGoal = distance;

    // Get passing style buff
    const passingBuff = teamTactics ? getPassingStyleBuff(teamTactics.passing) : { shortPass: 1.0, longPass: 1.0 };
    const creativeBuff = teamTactics ? getCreativeFreedomBuff(teamTactics.creative_freedom) : { shooting: 1.0, dribble: 1.0, riskTaking: 1.0 };

    const passShortRoleMod = getRoleActionModifier(player, true, teamTactics, 'PASS_SHORT');
    const passLongRoleMod = getRoleActionModifier(player, true, teamTactics, 'PASS_LONG');
    const dribbleRoleMod = getRoleActionModifier(player, true, teamTactics, 'DRIBBLE');
    const shootRoleMod = getRoleActionModifier(player, true, teamTactics, 'SHOOT');

    const weights = {
        PASS_SHORT: player.attributes.passing * 0.5 * passingBuff.shortPass * passShortRoleMod,
        PASS_LONG: (player.attributes.passing + player.attributes.vision) * 0.3 * passingBuff.longPass * passLongRoleMod,
        DRIBBLE: player.attributes.dribbling * 0.4 * creativeBuff.dribble * dribbleRoleMod,
        SHOOT: 0
    };

    // Shooting zones: 0-10 = penalty area (tightened), 10-25 = long shots (reduced), >25 = no shooting
    if (distanceToGoal <= 10) {
        // Penalty area only - full shooting weight
        weights.SHOOT = player.attributes.shooting * 1.0 * creativeBuff.shooting * shootRoleMod;
    } else if (distanceToGoal <= 25) {
        // Long shot zone - much reduced weight
        weights.SHOOT = player.attributes.shooting * 0.2 * creativeBuff.shooting * shootRoleMod;
    }
    // Beyond 25 yards: SHOOT weight stays at 0 (no shooting)

    // Apply condition multiplier to all weights
    const conditionFactor = player.condition / 100;
    Object.keys(weights).forEach(key => {
        weights[key as ActionType] *= (conditionFactor * teamSuccessMultiplier);
    });

    // === MATCH PREP HOOK 1: Neutralization (Zone + Role Aware) ===
    // Opponent tries to pressure this key player based on zone + defensive roles.
    let finalWeights = { ...weights };

    if (opponentPrepConfig) {
        const currentZone = getZoneFromPosition(ballPosition, isAttacking);
        finalWeights = applyNeutralizationEffect(player, opponentPrepConfig, defendingTeam, currentZone, finalWeights);
    }

    // === MATCH PREP HOOK 3: Transition Rules ===
    // Apply transition effects when we just won possession
    if (ownPrepConfig && justWonPossession) {
        finalWeights = applyTransitionEffect(ownPrepConfig, true, finalWeights);
    }

    return finalWeights;
}

function chooseAction(weights: Record<ActionType, number>): ActionType {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total === 0) return 'PASS_SHORT';

    const roll = Math.random() * total;
    let cumulative = 0;

    for (const [action, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll <= cumulative) return action as ActionType;
    }

    return 'PASS_SHORT';
}

function getMentalityBuff(mentality: string) {
    switch (mentality) {
        case 'ALL_OUT_ATTACK':
            return { shooting: 1.0, dribble: 1.5, tackling: 0.7, save: 1.0, attackChance: 1.5, fatigue: 1.3 };
        case 'ATTACKING':
            return { shooting: 1.0, dribble: 1.3, tackling: 0.8, save: 1.0, attackChance: 1.25, fatigue: 1.2 };
        case 'ULTRA_DEFENSIVE':
            return { shooting: 1.0, dribble: 0.7, tackling: 1.4, save: 1.0, attackChance: 0.8, fatigue: 1.3 };
        case 'DEFENSIVE':
            return { shooting: 1.0, dribble: 0.8, tackling: 1.2, save: 1.0, attackChance: 0.9, fatigue: 1.2 };
        default:
            return { shooting: 1.0, dribble: 1.0, tackling: 1.0, save: 1.0, attackChance: 1.0, fatigue: 1.0 };
    }
}

function getPassingStyleBuff(passing: string) {
    // Affects pass weight distribution and success rates
    switch (passing) {
        case 'SHORT':
            return { shortPass: 1.3, longPass: 0.7 };
        case 'LONG':
        case 'DIRECT':
            return { shortPass: 0.7, longPass: 1.3 };
        default: // MIXED
            return { shortPass: 1.0, longPass: 1.0 };
    }
}

function getTacklingBuff(tackling: string) {
    // Affects tackle success rate and foul probability
    switch (tackling) {
        case 'SOFT':
            return { tackle: 0.85, foul: 0.7 };
        case 'HARD':
            return { tackle: 1.15, foul: 1.3 };
        default: // NORMAL
            return { tackle: 1.0, foul: 1.0 };
    }
}

function getAttackingFocusBuff(attackingFocus: string, playerPosition: string) {
    // Returns weight modifier for position selection in attack
    // Supports both natural positions (e.g. FW) and tactical slots (e.g. FW_R)
    const normalized = (playerPosition || '').replace('_', '').toUpperCase();

    const centerSet = new Set(['MC', 'AMC', 'FWC', 'DMC', 'DC', 'FW']);
    const wingSet = new Set(['MR', 'ML', 'AMR', 'AML', 'FWR', 'FWL', 'DR', 'DL', 'DMR', 'DML']);

    const isCenter = centerSet.has(normalized);
    const isWing = wingSet.has(normalized);

    switch (attackingFocus) {
        case 'CENTER':
        case 'CENTRAL':
        case 'FORWARD':
            return isCenter ? 1.4 : (isWing ? 0.7 : 1.0);
        case 'WINGS':
        case 'LEFT':
        case 'RIGHT':
            return isWing ? 1.4 : (isCenter ? 0.7 : 1.0);
        default: // MIXED
            return 1.0;
    }
}

function getCreativeFreedomBuff(creativeFreeze: string) {
    // Affects how much player deviates from team tactical instructions
    // STRICT: Follows team plan closely, less individual action
    // NORMAL: Balanced between team plan and individual decision
    // FREEDOM: Prioritizes individual skill and decision-making
    switch (creativeFreeze) {
        case 'STRICT':
        case 'RESTRICTED':
            return { shooting: 0.85, dribble: 0.8, riskTaking: 0.7 };
        case 'FREEDOM':
        case 'MAXIMUM':
            return { shooting: 1.2, dribble: 1.2, riskTaking: 1.3 };
        default: // NORMAL
            return { shooting: 1.0, dribble: 1.0, riskTaking: 1.0 };
    }
}

function getActiveTacticByScore(team: TeamState, goalsFor: number, goalsAgainst: number) {
    if (!team.tacticalPlans) return team.tactics;
    if (goalsFor > goalsAgainst) return team.tacticalPlans.leading;
    if (goalsFor < goalsAgainst) return team.tacticalPlans.behind;
    return team.tacticalPlans.normal;
}

function getDrainForIntensity(intensity: Intensity) {
    if (intensity === 'HIGH') return 0.22;
    if (intensity === 'MEDIUM') return 0.12;
    return 0.06;
}

function applyActionDrain(player: PlayerState, intensity: Intensity, fatigueMultiplier: number) {
    const base = getDrainForIntensity(intensity) * fatigueMultiplier;
    const staminaFactor = Math.max(0.7, 1 - (player.attributes.stamina - 10) * 0.02);
    const drain = base * staminaFactor;
    player.condition = Math.max(0, player.condition - drain);
}

function executePassShort(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    const startBallPosition = ball.position;

    stats.passesAttempted++;
    teamStats.passesAttempted++;
    trackFieldTouch(stats, zone);

    const passScore = calculateActionScore('short_pass', player.attributes, 'attacker', player.condition);
    const attackerRoleMod = getRoleActionModifier(player, true, attackingTeam.tactics, 'PASS_SHORT');
    const pressDefender = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL', 'MR', 'ML'], ball.position, isHomeAttacking, 'PRESS') || null;
    const defenderPenalty = getDefenderOpponentPenalty(pressDefender, defendingTeam.tactics, 'PASS_SHORT');
    const attackingTeamSuccess = getTeamDownSuccessMultiplier(attackingTeam);
    const defendingTeamSuccess = getTeamDownSuccessMultiplier(defendingTeam);
    const effectivePassScore = passScore * attackerRoleMod * defenderPenalty;
    // Bug fix #3: Defense strength scales with number of defenders on field
    // Fewer defenders = weaker defense = easier to pass
    const defenseScore = (Math.random() * 10) / defendingTeamSuccess;

    const skillBonus = player.attributes.passing > 15 ? 1.15 : 1.0;
    const adjustedPassScore = effectivePassScore * skillBonus * attackingTeamSuccess;
    const success = adjustedPassScore > defenseScore;
    const expectedSuccessRate = clampRate(adjustedPassScore / (adjustedPassScore + defenseScore + 0.0001));

    let isBackwardPass: boolean | null = null;
    let movement: number | null = null;
    let targetPosition: number | null = null;

    if (success) {
        stats.passesCompleted++;
        teamStats.passesCompleted++;

        // 30% chance of backward/sideways pass when under pressure (realistic play)
        isBackwardPass = Math.random() < 0.3;
        movement = isBackwardPass
            ? -(0.5 + Math.random() * 1.5) // -0.5 to -2 (backward)
            : (0.5 + Math.random() * 1.5); // +0.5 to +2 (forward)

        targetPosition = isHomeAttacking
            ? Math.max(0, Math.min(100, ball.position + movement))
            : Math.max(0, Math.min(100, ball.position - movement));

        ball.position = targetPosition;
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed pass - possession changes
        const interceptor = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL', 'MR', 'ML', 'AMC'], ball.position, isHomeAttacking, 'INTERCEPTION') || null;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = interceptor;

        if (interceptor) {
            const interceptorStats = matchState.playerStats[interceptor.id];
            const interceptionZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(interceptorStats, interceptionZone);
            pushActionLog(matchState, {
                playerId: interceptor.id,
                teamId: defendingTeam.id,
                minute: matchState.minute,
                ballPosition: Math.round(ball.position),
                zone: interceptionZone,
                actionType: 'INTERCEPTION',
                result: 'SUCCESS',
                isSuccessful: true,
                expectedSuccessRate: undefined,
                targetPlayerId: player.id,
                metadata: JSON.stringify({ sourceAction: 'PASS_SHORT' })
            });
        }
    }

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(startBallPosition),
        zone,
        actionType: 'PASS_SHORT',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        metadata: JSON.stringify({
            passScore,
            effectivePassScore,
            attackingTeamSuccess,
            defenseScore,
            skillBonus,
            attackerRoleMod,
            defenderPenalty,
            isBackwardPass,
            movement,
            targetPosition
        })
    });

    // console.log(`Short pass executed. Success: ${success}, New Position: ${ball.position.toFixed(1)}`);

    // Potentially trigger throw-in on failure (simplified out of bounds)
    if (!success && Math.random() < 0.2) {
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + 2)
            : Math.max(0, ball.position - 2);
        executeThrowIn(ball, matchState, isHomeAttacking ? defendingTeam : attackingTeam, isHomeAttacking ? attackingTeam : defendingTeam, !isHomeAttacking);
        return;
    }

    applyActionDrain(player, 'LOW', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
}

function executePassLong(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    const startBallPosition = ball.position;

    stats.crossesAttempted++;
    teamStats.crossesAttempted++;
    trackFieldTouch(stats, zone);

    // Calculate intended pass distance (before execution)
    const movement = 2 + Math.random() * 3; // +2 to +5 yards
    const passDistance = movement;

    // Distance penalty: longer passes are exponentially harder
    // Formula: penalty = 1.0 - (distance / maxDistance)^1.5
    // At 2 yards: penalty = 0.85 (15% harder)
    // At 3.5 yards (avg): penalty = 0.70 (30% harder)  
    // At 5 yards: penalty = 0.55 (45% harder)
    const maxPassDistance = 5.0;
    const distanceRatio = Math.min(1.0, passDistance / maxPassDistance);
    const distancePenalty = 1.0 - Math.pow(distanceRatio, 1.5) * 0.45; // 0.55 to 1.0 range

    const basePassScore = calculateActionScore('long_pass', player.attributes, 'attacker', player.condition);
    const attackerRoleMod = getRoleActionModifier(player, true, attackingTeam.tactics, 'PASS_LONG');
    const pressDefender = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL', 'MR', 'ML'], ball.position, isHomeAttacking, 'PRESS') || null;
    const defenderPenalty = getDefenderOpponentPenalty(pressDefender, defendingTeam.tactics, 'PASS_LONG');
    const attackingTeamSuccess = getTeamDownSuccessMultiplier(attackingTeam);

    // Apply distance penalty to pass score (lower attributes = bigger impact from distance)
    // High skill players (passing+vision > 30) suffer less from distance
    const attributeSum = player.attributes.passing + player.attributes.vision;
    const skillLevel = Math.min(1.0, attributeSum / 40); // 0.0 to 1.0 (max at 40)
    const distanceImpact = 0.5 + (skillLevel * 0.5); // 0.5 to 1.0 (high skill = less distance penalty)
    const effectiveDistancePenalty = distancePenalty + ((1.0 - distancePenalty) * distanceImpact);

    const passScore = basePassScore * effectiveDistancePenalty * attackerRoleMod * defenderPenalty;
    const defendingTeamSuccess = getTeamDownSuccessMultiplier(defendingTeam);
    // Bug fix #3: Defense strength scales with number of defenders on field
    // Fewer defenders = weaker defense = easier to pass
    const defenseScore = (Math.random() * 14) / defendingTeamSuccess;

    const skillBonus = (player.attributes.passing > 15 && player.attributes.vision > 15) ? 1.1 : 1.0; // Reduced from 1.2
    const adjustedPassScore = passScore * skillBonus * attackingTeamSuccess;
    const success = adjustedPassScore > defenseScore;
    const expectedSuccessRate = clampRate(adjustedPassScore / (adjustedPassScore + defenseScore + 0.0001));

    const targetPosition = isHomeAttacking
        ? Math.min(100, ball.position + passDistance)
        : Math.max(0, ball.position - passDistance);

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(startBallPosition),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        metadata: JSON.stringify({
            passScore: passScore.toFixed(2),
            basePassScore: basePassScore.toFixed(2),
            defenseScore: defenseScore.toFixed(2),
            skillBonus,
            attackingTeamSuccess,
            passDistance: passDistance.toFixed(2),
            distancePenalty: distancePenalty.toFixed(2),
            effectiveDistancePenalty: effectiveDistancePenalty.toFixed(2),
            attackerRoleMod,
            defenderPenalty,
            attributeSum,
            targetPosition: Number(targetPosition.toFixed(2))
        })
    });

    if (success) {
        stats.crossesCompleted++;
        teamStats.crossesCompleted++;
        ball.position = targetPosition;
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed long pass - possession changes at target position
        ball.position = targetPosition;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        const interceptor = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL', 'MR', 'ML', 'AMC'], ball.position, isHomeAttacking, 'INTERCEPTION') || null;
        ball.carrier = interceptor;

        if (interceptor) {
            const interceptorStats = matchState.playerStats[interceptor.id];
            const interceptionZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(interceptorStats, interceptionZone);
            pushActionLog(matchState, {
                playerId: interceptor.id,
                teamId: defendingTeam.id,
                minute: matchState.minute,
                ballPosition: Math.round(ball.position),
                zone: interceptionZone,
                actionType: 'INTERCEPTION',
                result: 'SUCCESS',
                isSuccessful: true,
                targetPlayerId: player.id,
                metadata: JSON.stringify({ sourceAction: 'PASS_LONG' })
            });
        }
    }
    // console.log(`Long pass executed. Success: ${success}, Target Position: ${targetPosition.toFixed(1)}`);
    applyActionDrain(player, 'LOW', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
}

function executeDribble(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    homeTeam: TeamState,
    awayTeam: TeamState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const defender = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL', 'MR', 'ML'], ball.position, isHomeAttacking, 'TACKLE');

    if (!defender) return;

    const dribbleZone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, dribbleZone);

    stats.dribblesAttempted++;
    matchState.playerStats[defender.id].tacklesAttempted++;

    const dribbleScore = calculateActionScore('dribble', player.attributes, 'attacker', player.condition)
        * getMentalityBuff(attackingTeam.tactics.mentality).dribble;
    const tacklingBuff = getTacklingBuff(defendingTeam.tactics.tackling);
    const attackingTeamSuccess = getTeamDownSuccessMultiplier(attackingTeam);
    const defendingTeamSuccess = getTeamDownSuccessMultiplier(defendingTeam);
    const bookedTacklePenalty = getBookedTackleMultiplier(defender);
    const tackleScore = calculateActionScore('dribble', defender.attributes, 'defender', defender.condition)
        * getMentalityBuff(defendingTeam.tactics.mentality).tackling
        * tacklingBuff.tackle
        * defendingTeamSuccess
        * bookedTacklePenalty;

    const defenderRole = getActiveRolePreset(defender, false);
    const defenderRoleEffects = defenderRole ? getRoleEffects(defenderRole) : null;
    const defenderRoleInfluence = getRoleInfluenceByCreativeFreedom(defendingTeam.tactics.creative_freedom);
    const defenderPenaltyRaw = defenderRoleEffects?.opponentPenalty?.DRIBBLE ?? 1.0;
    const defenderPenalty = scaleRoleModifier(defenderPenaltyRaw, defenderRoleInfluence);

    const effectiveDribbleScore = dribbleScore * defenderPenalty;

    const skillBonus = player.attributes.dribbling > 15 ? 1.15 : 1.0;
    const adjustedDribbleScore = effectiveDribbleScore * skillBonus * attackingTeamSuccess;
    const success = (adjustedDribbleScore * (0.8 + Math.random() * 0.4)) > (tackleScore * (0.8 + Math.random() * 0.4));
    const expectedSuccessRate = clampRate(adjustedDribbleScore / (adjustedDribbleScore + tackleScore + 0.0001));

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone: dribbleZone,
        actionType: 'DRIBBLE',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        targetPlayerId: defender.id,
        metadata: JSON.stringify({ dribbleScore, tackleScore, defenderRole, defenderPenalty, attackingTeamSuccess, defendingTeamSuccess, bookedTacklePenalty })
    });

    if (success) {
        stats.dribblesWon++;
        const movement = 1 + Math.random() * 2; // +1 to +3 (further reduced for realism)
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + movement)
            : Math.max(0, ball.position - movement);
        // Keep same carrier after dribble (they beat the defender)
        // No reassignment needed
    } else {
        matchState.playerStats[defender.id].tacklesWon++;
        const defenderStats = matchState.playerStats[defender.id];
        const tackleZone = getZoneFromPosition(ball.position, !isHomeAttacking);
        trackFieldTouch(defenderStats, tackleZone);
        pushActionLog(matchState, {
            playerId: defender.id,
            teamId: defendingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: tackleZone,
            actionType: 'TACKLE',
            result: 'SUCCESS',
            isSuccessful: true,
            expectedSuccessRate: clampRate(tackleScore / (tackleScore + dribbleScore + 0.0001)),
            targetPlayerId: player.id,
            metadata: JSON.stringify({ dribbleScore, tackleScore })
        });
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = defender;

        // Push ball backward on interception (realistic defensive action)
        const pushBack = 2 + Math.random() * 3; // -2 to -5 yards
        ball.position = isHomeAttacking
            ? Math.max(0, ball.position - pushBack)
            : Math.min(100, ball.position + pushBack);
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(defender, 'MEDIUM', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);

    // Potentially trigger foul/free kick
    // Foul probability is driven by: tactic instruction + player personality + teamwork compliance.
    // Plan has stronger weight than personality, and high teamwork increases plan compliance.
    const disciplineProfile = getDefenderDisciplineProfile(defender, defendingTeam);
    const baseFoulProb = !success ? 0.12 : 0.015;
    if (Math.random() < baseFoulProb * disciplineProfile.foulMultiplier) {
        matchState.playerStats[defender.id].fouls++;
        if (matchState.playerStats[defender.id].teamId === matchState.homeTeamId) {
            matchState.teamStats.home.fouls++;
        } else {
            matchState.teamStats.away.fouls++;
        }
        const foulZone = getZoneFromPosition(ball.position, !isHomeAttacking);

        matchState.events.push({
            minute: matchState.minute,
            type: 'FOUL',
            text: `${defender.name} fouls ${player.name}.`,
            teamId: matchState.playerStats[defender.id].teamId,
            playerId: defender.id
        });

        pushActionLog(matchState, {
            playerId: defender.id,
            teamId: defendingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: foulZone,
            actionType: 'FOUL',
            result: 'FAIL',
            isSuccessful: false,
            targetPlayerId: player.id,
            metadata: JSON.stringify({
                foulMultiplier: disciplineProfile.foulMultiplier,
                recklessIndex: disciplineProfile.recklessIndex,
                planWeight: disciplineProfile.planWeight,
                personalityWeight: disciplineProfile.personalityWeight,
                instructionRisk: disciplineProfile.instructionRisk,
                personalityRisk: disciplineProfile.personalityRisk,
            })
        });

        applyCardFromFoul(defender, player, defendingTeam, matchState, matchState.minute, foulZone, ball.position);

        // Foul restores possession to fouled team for the set piece.
        ball.possession = isHomeAttacking ? 'home' : 'away';
        ball.carrier = player;

        if (isPlayerSentOff(defender)) {
            defender.tacticalPosition = null;
            if (ball.carrier?.id === defender.id) {
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
            }
        }

        const distanceToGoal = isHomeAttacking ? 100 - ball.position : ball.position;
        if (distanceToGoal < 25) {
            executeFreeKickShort(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
        } else {
            executeFreeKickLong(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
        }
    }
}

function executeShoot(
    ball: BallState,
    player: PlayerState,
    minute: number,
    matchState: MatchState,
    homeTeam: TeamState,
    awayTeam: TeamState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean,
    defendingPrepConfig?: MatchPrepConfig | null
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
    const shootZone = getZoneFromPosition(ball.position, isHomeAttacking);

    stats.shots++;
    teamStats.shots++;
    trackFieldTouch(stats, shootZone);

    // Find goalkeeper
    const gk = defendingTeam.players.find(p => p.position === 'GK' && p.tacticalPosition === 'GK')
        || defendingTeam.players.find(p => p.position === 'GK')
        || defendingTeam.players[0];

    // Calculate distance to goal
    const distanceToGoal = isHomeAttacking ? 100 - ball.position : ball.position;
    const positionFactor = Math.max(0.3, (100 - distanceToGoal) / 100);

    // Shooting effectiveness decreases with distance
    const shootScore = calculateActionScore('shoot', player.attributes, 'attacker', player.condition)
        * getMentalityBuff(attackingTeam.tactics.mentality).shooting
        * positionFactor;
    const attackerShootRoleMod = getRoleActionModifier(player, true, attackingTeam.tactics, 'SHOOT');
    const shotDefender = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL'], ball.position, isHomeAttacking, 'BLOCK') || null;
    const defenderShootPenalty = getDefenderOpponentPenalty(shotDefender, defendingTeam.tactics, 'SHOOT');
    const effectiveShootScore = shootScore * attackerShootRoleMod * defenderShootPenalty;

    // GK save effectiveness increases with distance (easier saves from far)
    const saveEffectiveness = distanceToGoal < 20 ? 1.0 : (distanceToGoal < 10 ? 0.9 : 1.1);
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition)
        * getMentalityBuff(defendingTeam.tactics.mentality).save
        * saveEffectiveness;
    const attackingTeamSuccess = getTeamDownSuccessMultiplier(attackingTeam);
    const defendingTeamSuccess = getTeamDownSuccessMultiplier(defendingTeam);

    // Apply variance
    const variance = minute >= 80 ? 0.35 : 0.2;
    let finalShoot = effectiveShootScore * attackingTeamSuccess * (1 - variance / 2 + Math.random() * variance);
    let finalSave = saveScore * defendingTeamSuccess * (1 - variance / 2 + Math.random() * variance);

    // Man Marker encounter on key-targeted shooter in ATTACKING zone
    let markerEncountered = false;
    let markerId: string | null = null;
    if (
        defendingPrepConfig?.neutralization?.targetPlayerIds?.includes(player.id) &&
        shootZone === 'ATTACKING'
    ) {
        const marker = tryGetRolePresser(defendingTeam, 'MAN_MARKER');
        if (marker) {
            const encounterChance = getPressureTriggerChance(marker);
            if (Math.random() < encounterChance) {
                markerEncountered = true;
                markerId = marker.id;
                finalShoot *= 0.85; // -15% immediate shooting effectiveness when tightly marked
                marker.condition = Math.max(0, marker.condition - 0.12); // trade-off for intense pressure
            }
        }
    }

    // Miracle/blunder chances
    const miracleChance = minute >= 80 ? 0.03 : 0.02;
    const blunderChance = minute >= 80 ? 0.03 : 0.02;
    const miracle = Math.random() < miracleChance;
    const blunder = Math.random() < blunderChance;

    if (blunder) {
        finalSave *= 0.4;
    }

    if (miracle) {
        finalSave = Math.max(0.1, finalSave);
        if (finalShoot <= finalSave) {
            finalShoot = finalSave * 1.6 + 0.01;
        }
    }

    console.log("ballposition: " + distanceToGoal + "->" + player.name + "->finalshoot: " + finalShoot + "," + gk.name + "->finalsave: " + finalSave);

    if (finalShoot > finalSave) {
        // GOAL!
        stats.goals++;
        stats.shotsOnTarget++;
        teamStats.shotsOnTarget++;

        matchState.events.push({
            minute,
            type: 'GOAL',
            text: miracle
                ? `MIRACLE GOAL! ${player.name} scores from ${distanceToGoal.toFixed(0)}m out!`
                : `GOAL! ${player.name} scores with a clinical finish from ${distanceToGoal.toFixed(0)}m!`,
            teamId: attackingTeam.id,
            playerId: player.id
        });

        pushActionLog(matchState, {
            playerId: player.id,
            teamId: attackingTeam.id,
            minute,
            ballPosition: Math.round(ball.position),
            zone: shootZone,
            actionType: 'SHOOT',
            result: 'GOAL',
            isSuccessful: true,
            expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
            targetPlayerId: gk?.id,
            metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, miracle, blunder, markerEncountered, markerId, attackerShootRoleMod, defenderShootPenalty, shotDefenderId: shotDefender?.id || null })
        });

        // Potential assist
        if (Math.random() > 0.4) {
            const assistPlayer = getRandomPlayer(attackingTeam, ['MC', 'AMC', 'MR', 'ML', 'AMR', 'AML']);
            if (assistPlayer && assistPlayer.id !== player.id) {
                matchState.playerStats[assistPlayer.id].assists++;
            }
        }

        // Reset ball to center, kick-off from non-GK
        ball.position = 50;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        const kickoffIsHomeAttacking = ball.possession === 'home';
        const kickoffTeam = kickoffIsHomeAttacking ? attackingTeam : defendingTeam;
        ball.carrier = getCarrierByPosition(kickoffTeam, 50, kickoffIsHomeAttacking);
    } else {
        // Save or miss
        const isOnTarget = Math.random() > 0.4;

        if (isOnTarget) {
            matchState.playerStats[gk.id].saves++;
            stats.shotsOnTarget++;
            teamStats.shotsOnTarget++;
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${player.name} shoots from ${distanceToGoal.toFixed(0)}m... but ${gk.name} makes the save!`,
                teamId: attackingTeam.id,
                playerId: player.id
            });

            const gkStats = matchState.playerStats[gk.id];
            const saveZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(gkStats, saveZone);
            pushActionLog(matchState, {
                playerId: gk.id,
                teamId: defendingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: saveZone,
                actionType: 'SAVE',
                result: 'SUCCESS',
                isSuccessful: true,
                expectedSuccessRate: clampRate(finalSave / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: player.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, markerEncountered, markerId, attackerShootRoleMod, defenderShootPenalty, shotDefenderId: shotDefender?.id || null })
            });

            pushActionLog(matchState, {
                playerId: player.id,
                teamId: attackingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: shootZone,
                actionType: 'SHOOT',
                result: 'SAVED',
                isSuccessful: false,
                expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: gk.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, onTarget: true, markerEncountered, markerId, attackerShootRoleMod, defenderShootPenalty, shotDefenderId: shotDefender?.id || null })
            });
        } else {
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${player.name} shoots wide from ${distanceToGoal.toFixed(0)}m!`,
                teamId: attackingTeam.id,
                playerId: player.id
            });

            pushActionLog(matchState, {
                playerId: player.id,
                teamId: attackingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: shootZone,
                actionType: 'SHOOT',
                result: 'OFF_TARGET',
                isSuccessful: false,
                expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: gk?.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, onTarget: false, markerEncountered, markerId, attackerShootRoleMod, defenderShootPenalty, shotDefenderId: shotDefender?.id || null })
            });
        }

        // GK distributes to defender immediately (goal kick / distribution)
        ball.possession = ball.possession === 'home' ? 'away' : 'home';

        // Corner kick chance on save (reduced from 30% to 15% for realism)
        if (isOnTarget && Math.random() < 0.15) {
            executeCornerKick(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
            return;
        }

        const defender = getDefensiveActionPlayer(defendingTeam, ['DC', 'DR', 'DL', 'DMC', 'MC'], ball.position, isHomeAttacking, 'RECOVERY') || defendingTeam.players[1]; // Avoid GK at index 0
        ball.carrier = defender;
        ball.position = isHomeAttacking ? 10 : 90; // Slightly further up field
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(gk, 'LOW', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);
}

function getSetPieceTaker(team: TeamState, type: 'SHORT_FK' | 'LONG_FK' | 'CORNER' | 'THROW'): PlayerState {
    const starters = team.players.filter(p => p.tacticalPosition !== null);

    if (type === 'THROW') {
        // Pick top 3 by throw attribute
        const takers = starters
            .map(p => ({ player: p, score: p.attributes.throw || 0 }))
            .sort((a, b) => b.score - a.score);
        const topCandidates = takers.slice(0, 3);
        return topCandidates[Math.floor(Math.random() * topCandidates.length)].player;
    }

    const takers = starters.map(p => {
        let score = 0;
        if (type === 'SHORT_FK') score = p.attributes.setPieces + p.attributes.shooting;
        else if (type === 'LONG_FK') score = p.attributes.setPieces + p.attributes.passing + p.attributes.crossing;
        else if (type === 'CORNER') score = p.attributes.setPieces + p.attributes.crossing;
        return { player: p, score };
    }).sort((a, b) => b.score - a.score);

    // Pick from top 3
    const topCandidates = takers.slice(0, 3);
    return topCandidates[Math.floor(Math.random() * topCandidates.length)].player;
}

function executeFreeKickShort(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'SHORT_FK');
    const stats = matchState.playerStats[taker.id];

    stats.freeKicks++;
    isHomeAttacking ? matchState.teamStats.home.freeKicks++ : matchState.teamStats.away.freeKicks++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    matchState.events.push({
        minute: matchState.minute,
        type: 'FREE_KICK',
        text: `Free kick in a dangerous position! ${taker.name} steps up...`,
        teamId: attackingTeam.id,
        playerId: taker.id
    });

    const gk = defendingTeam.players.find(p => p.position === 'GK') || defendingTeam.players[0];
    const attackingTeamSuccess = getTeamDownSuccessMultiplier(attackingTeam);
    const defendingTeamSuccess = getTeamDownSuccessMultiplier(defendingTeam);
    const shootScore = calculateActionScore('free_kick_short', taker.attributes, 'attacker', taker.condition) * attackingTeamSuccess;
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition) * defendingTeamSuccess;

    if (shootScore > saveScore * 1.1) {
        stats.goals++;
        stats.shots++;
        stats.shotsOnTarget++;
        isHomeAttacking ? matchState.homeScore++ : matchState.awayScore++;
        matchState.events.push({
            minute: matchState.minute,
            type: 'GOAL',
            text: `GOAL! ${taker.name} curls a magnificent free kick into the top corner!`,
            teamId: attackingTeam.id,
            playerId: taker.id
        });
        pushActionLog(matchState, {
            playerId: taker.id,
            teamId: attackingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone,
            actionType: 'SHOOT',
            result: 'GOAL',
            isSuccessful: true,
            expectedSuccessRate: clampRate(shootScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: gk.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        ball.position = 50;
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getCarrierByPosition(isHomeAttacking ? awayTeam : homeTeam, 50, !isHomeAttacking);
    } else {
        matchState.events.push({
            minute: matchState.minute,
            type: 'MISS',
            text: `${taker.name}'s free kick is saved by ${gk.name}!`,
            teamId: attackingTeam.id,
            playerId: taker.id
        });
        const gkStats = matchState.playerStats[gk.id];
        const saveZone = getZoneFromPosition(ball.position, !isHomeAttacking);
        trackFieldTouch(gkStats, saveZone);
        pushActionLog(matchState, {
            playerId: taker.id,
            teamId: attackingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone,
            actionType: 'SHOOT',
            result: 'SAVED',
            isSuccessful: false,
            expectedSuccessRate: clampRate(shootScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: gk.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        pushActionLog(matchState, {
            playerId: gk.id,
            teamId: defendingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: saveZone,
            actionType: 'SAVE',
            result: 'SUCCESS',
            isSuccessful: true,
            expectedSuccessRate: clampRate(saveScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: taker.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = gk;
        ball.position = isHomeAttacking ? 5 : 95;
    }
}

function executeFreeKickLong(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'LONG_FK');
    const stats = matchState.playerStats[taker.id];

    stats.freeKicks++;
    isHomeAttacking ? matchState.teamStats.home.freeKicks++ : matchState.teamStats.away.freeKicks++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    const passScore = calculateActionScore('free_kick_long', taker.attributes, 'attacker', taker.condition)
        * getTeamDownSuccessMultiplier(attackingTeam);
    const success = passScore > Math.random() * 15;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'LONG_FK', passScore })
    });

    if (success) {
        ball.position = isHomeAttacking ? Math.min(95, ball.position + 20) : Math.max(5, ball.position - 20);
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking) as PlayerState;
    } else {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getDefensiveActionPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL'], ball.position, isHomeAttacking, 'RECOVERY') || null;
    }
}

function executeCornerKick(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'CORNER');
    const stats = matchState.playerStats[taker.id];

    stats.corners++;
    isHomeAttacking ? matchState.teamStats.home.corners++ : matchState.teamStats.away.corners++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    matchState.events.push({
        minute: matchState.minute,
        type: 'CORNER',
        text: `Corner kick for ${attackingTeam.name}. ${taker.name} to take it...`,
        teamId: attackingTeam.id,
        playerId: taker.id
    });

    const cornerScore = calculateActionScore('corner', taker.attributes, 'attacker', taker.condition)
        * getTeamDownSuccessMultiplier(attackingTeam);
    const success = cornerScore > Math.random() * 18;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'CORNER', cornerScore })
    });

    if (success) {
        ball.position = isHomeAttacking ? 92 : 8;
        const target = getRandomPlayer(attackingTeam, ['FWC', 'DC', 'MC']);
        if (target && Math.random() < 0.3) {
            // Header attempt
            const headerScore = (target.attributes.heading + target.attributes.strength) * 0.5 * getTeamDownSuccessMultiplier(attackingTeam);
            if (headerScore > Math.random() * 20) {
                matchState.playerStats[target.id].goals++;
                matchState.playerStats[taker.id].assists++;
                isHomeAttacking ? matchState.homeScore++ : matchState.awayScore++;
                matchState.events.push({
                    minute: matchState.minute,
                    type: 'GOAL',
                    text: `GOAL! ${target.name} heads home from the corner!`,
                    teamId: attackingTeam.id,
                    playerId: target.id
                });
                ball.position = 50;
                ball.possession = isHomeAttacking ? 'away' : 'home';
            }
        }
    }

    if (ball.position !== 50) {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = defendingTeam.players.find(p => p.position === 'GK') || defendingTeam.players[0];
    }
}

function executeThrowIn(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const taker = getSetPieceTaker(attackingTeam, 'THROW');
    const stats = matchState.playerStats[taker.id];

    stats.throws++;
    isHomeAttacking ? matchState.teamStats.home.throws++ : matchState.teamStats.away.throws++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    const throwScore = calculateActionScore('throw_in', taker.attributes, 'attacker', taker.condition)
        * getTeamDownSuccessMultiplier(attackingTeam);
    const success = throwScore > Math.random() * 10;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_SHORT',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'THROW_IN', throwScore })
    });

    if (success) {
        ball.carrier = getRandomPlayer(attackingTeam, ['MC', 'MR', 'ML', 'FWC']) || null;
    } else {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getDefensiveActionPlayer(isHomeAttacking ? awayTeam : homeTeam, ['MC', 'DC', 'DR', 'DL', 'DMC'], ball.position, isHomeAttacking, 'RECOVERY') || null;
    }
}

function checkDefensiveInterruption(
    ball: BallState,
    defendingTeam: TeamState,
    matchState: MatchState,
    defendingTeamId: string,
    isDefendingFromHomePerspective: boolean,
    defendingPrepConfig?: MatchPrepConfig | null
): boolean {
    const defenderPool = defendingTeam.players.filter(p => p.tacticalPosition !== null);
    if (defenderPool.length === 0) return false;

    // Calculate average defensive capability
    const avgTackling = defenderPool.reduce((sum, p) => sum + p.attributes.tackling, 0) / defenderPool.length;
    const avgPositioning = defenderPool.reduce((sum, p) => sum + p.attributes.positioning, 0) / defenderPool.length;

    // Base intercept chance around 8% per tick
    let interruptChance = ((avgTackling + avgPositioning) / 40) * 0.08;

    // === MATCH PREP HOOK 2: Press Trap ===
    const currentZone = getZoneFromPosition(ball.position, isDefendingFromHomePerspective);
    const pressTrapResult = applyPressTrapEffect(defendingPrepConfig ?? null, currentZone, interruptChance);
    interruptChance = pressTrapResult.modifiedRate;
    // Counter vulnerability is tracked but not applied in this function (affects opponent flow later)

    if (Math.random() < interruptChance) {
        // Interception! Pick a defender based on zone and proximity to own goal
        const interceptor = getDefensiveActionPlayer(
            defendingTeam,
            ['DC', 'DR', 'DL', 'DMC', 'MC', 'MR', 'ML', 'AMC', 'AMR', 'AML', 'FWC', 'FWR', 'FWL'],
            ball.position,
            !isDefendingFromHomePerspective,
            'INTERCEPTION'
        ) || defenderPool[Math.floor(Math.random() * defenderPool.length)];
        const interceptorStats = matchState.playerStats[interceptor.id];
        const interceptionZone = getZoneFromPosition(ball.position, isDefendingFromHomePerspective);
        trackFieldTouch(interceptorStats, interceptionZone);
        pushActionLog(matchState, {
            playerId: interceptor.id,
            teamId: defendingTeamId,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: interceptionZone,
            actionType: 'INTERCEPTION',
            result: 'SUCCESS',
            isSuccessful: true,
            metadata: JSON.stringify({ interruptChance, avgTackling, avgPositioning })
        });
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = interceptor;
        return true;
    }

    return false;
}

function initializePlayerStats(team: TeamState): Record<string, EnginePlayerMatchStats> {
    const stats: Record<string, EnginePlayerMatchStats> = {};
    team.players.forEach(p => {
        stats[p.id] = {
            playerId: p.id,
            name: p.name,
            teamId: team.id,
            position: p.position,
            rating: 6.0,
            minutes: 0,
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
            fitnessEnd: 100,
            defensiveThirdTouches: 0,
            middleThirdTouches: 0,
            attackingThirdTouches: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            freeKicks: 0,
            corners: 0,
            throws: 0,
            offsides: 0
        };
    });
    return stats;
}

function initTeamStats(): TeamMatchStats {
    return {
        possession: 50,
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
        throws: 0
    };
}

export function simulateMatch(
    homeTeam: TeamState,
    awayTeam: TeamState,
    matchPrep?: { home: MatchPrepConfig | null; away: MatchPrepConfig | null }
): MatchState {
    const matchState: MatchState = {
        minute: 0,
        homeScore: 0,
        awayScore: 0,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        teamStats: { home: initTeamStats(), away: initTeamStats() },
        events: [],
        actionLogs: [],
        isFinished: false,
        playerStats: {
            ...initializePlayerStats(homeTeam),
            ...initializePlayerStats(awayTeam)
        }
    };

    // Set 90 minutes for starters
    [...homeTeam.players, ...awayTeam.players].forEach(p => {
        if (p.tacticalPosition !== null) {
            matchState.playerStats[p.id].minutes = 90;
        }
    });

    // Initialize ball state
    const ball: BallState = {
        position: 50,
        possession: 'home',
        carrier: null
    };

    // Track possession changes for transition effects
    let previousPossession: 'home' | 'away' | null = null;
    let justWonPossession = false;

    let homeSubsUsed = 0;
    let awaySubsUsed = 0;
    const maxSubs = 5;

    // BALL PROGRESSION SYSTEM: 90 minutes, 12 ticks per minute (every 5 seconds) = 1080 game ticks
    // This provides more realistic pass volume (600+ passes per match)
    for (let minute = 1; minute <= 90; minute++) {
        matchState.minute = minute;

        // Dynamic tactical plan switching for both teams based on live score
        homeTeam.tactics = getActiveTacticByScore(homeTeam, matchState.homeScore, matchState.awayScore);
        awayTeam.tactics = getActiveTacticByScore(awayTeam, matchState.awayScore, matchState.homeScore);

        const ticksPerMinute = 12; // 1 tick = 5 seconds (60s / 12 = 5s)
        for (let tick = 0; tick < ticksPerMinute; tick++) {
            const isHomeAttacking = ball.possession === 'home';
            const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
            const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;

            // Get prep configs for both teams
            const attackingPrepConfig = matchPrep ? (isHomeAttacking ? matchPrep.home : matchPrep.away) : null;
            const defendingPrepConfig = matchPrep ? (isHomeAttacking ? matchPrep.away : matchPrep.home) : null;

            // Track possession changes for transition effects
            if (previousPossession !== null && previousPossession !== ball.possession) {
                justWonPossession = true;
            } else {
                justWonPossession = false;
            }
            previousPossession = ball.possession;

            // Assign carrier based on ball position (never GK)
            if (!ball.carrier || isPlayerSentOff(ball.carrier)) {
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
            }

            // Skip if carrier is somehow still GK (safety check)
            if (ball.carrier && ball.carrier.position === 'GK') {
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking) as PlayerState;
            }

            // If we cannot find a valid on-pitch carrier (extreme red-card scenario), skip this tick.
            if (!ball.carrier || isPlayerSentOff(ball.carrier)) {
                continue;
            }

            // Check for defensive interruption (interception) with press trap effects
            if (checkDefensiveInterruption(ball, defendingTeam, matchState, defendingTeam.id, !isHomeAttacking, defendingPrepConfig)) {
                continue; // Possession changed, skip this tick
            }

            // AI chooses action based on player attributes, ball position, and match prep
            const weights = calculateActionWeights(
                ball.carrier,
                ball.position,
                isHomeAttacking,
                attackingTeam.tactics,
                getTeamDownSuccessMultiplier(attackingTeam),
                defendingPrepConfig,  // Opponent's prep (for neutralization)
                defendingTeam,
                attackingPrepConfig,  // Own prep (for transition rules)
                justWonPossession
            );
            const action = chooseAction(weights);

            // Execute the chosen action
            switch (action) {
                case 'PASS_SHORT':
                    executePassShort(ball, ball.carrier, matchState, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'PASS_LONG':
                    executePassLong(ball, ball.carrier, matchState, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'DRIBBLE':
                    executeDribble(ball, ball.carrier, matchState, homeTeam, awayTeam, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'SHOOT':
                    executeShoot(ball, ball.carrier, minute, matchState, homeTeam, awayTeam, attackingTeam, defendingTeam, isHomeAttacking, defendingPrepConfig);
                    break;
            }

            // Clamp ball position to field boundaries
            if (ball.possession === 'home' && ball.position >= 100) {
                ball.position = 100;
            } else if (ball.possession === 'away' && ball.position <= 0) {
                ball.position = 0;
            }
        }

        updateFitness(homeTeam);
        updateFitness(awayTeam);

        homeSubsUsed = attemptSubstitutions(homeTeam, matchState, minute, ball, homeSubsUsed, maxSubs);
        awaySubsUsed = attemptSubstitutions(awayTeam, matchState, minute, ball, awaySubsUsed, maxSubs);
    }

    // Capture end-of-match fitness for all players
    [...homeTeam.players, ...awayTeam.players].forEach(p => {
        if (matchState.playerStats[p.id]) {
            matchState.playerStats[p.id].fitnessEnd = Math.round(p.condition);
        }
    });

    // Recalculate score from player goals to avoid mismatches
    const goalTotals = Object.values(matchState.playerStats).reduce(
        (acc, stat) => {
            if (stat.teamId === matchState.homeTeamId) acc.home += stat.goals;
            if (stat.teamId === matchState.awayTeamId) acc.away += stat.goals;
            return acc;
        },
        { home: 0, away: 0 }
    );
    matchState.homeScore = goalTotals.home;
    matchState.awayScore = goalTotals.away;

    // Calculate final possession % based on successful passes completed
    const homePassesCompleted = matchState.teamStats.home.passesCompleted;
    const awayPassesCompleted = matchState.teamStats.away.passesCompleted;
    const totalPasses = homePassesCompleted + awayPassesCompleted;

    if (totalPasses > 0) {
        matchState.teamStats.home.possession = Math.round((homePassesCompleted / totalPasses) * 100);
        matchState.teamStats.away.possession = 100 - matchState.teamStats.home.possession;
    } else {
        matchState.teamStats.home.possession = 50;
        matchState.teamStats.away.possession = 50;
    }

    // Finalize Ratings
    calculateRatings(matchState);

    matchState.isFinished = true;
    return matchState;
}

function getCarrierByPosition(team: TeamState, ballPosition: number, isAttacking: boolean): PlayerState {
    // Calculate which zone the ball is in relative to attacking direction
    const effectivePosition = isAttacking ? ballPosition : (100 - ballPosition);

    let positionWeights: { positions: string[], weight: number }[] = [];

    if (effectivePosition < 35) {
        // Defensive third - defenders dominate
        positionWeights = [
            { positions: ['DC', 'DR', 'DL', 'DMC'], weight: 60 },
            { positions: ['MC', 'MR', 'ML'], weight: 30 },
            { positions: ['AMC', 'AMR', 'AML'], weight: 8 },
            { positions: ['FWC', 'FWR', 'FWL'], weight: 2 }
        ];
    } else if (effectivePosition < 70) {
        // Middle third - midfielders dominate
        positionWeights = [
            { positions: ['MC', 'MR', 'ML', 'DMC', 'AMC'], weight: 65 },
            { positions: ['AMR', 'AML'], weight: 20 },
            { positions: ['DC', 'DR', 'DL'], weight: 10 },
            { positions: ['FWC', 'FWR', 'FWL'], weight: 5 }
        ];
    } else {
        // Attacking third - forwards dominate but defenders can join attack
        positionWeights = [
            { positions: ['FWC', 'FWR', 'FWL', 'AMC', 'AMR', 'AML'], weight: 70 },
            { positions: ['MC', 'MR', 'ML'], weight: 20 },
            { positions: ['DMC'], weight: 7 },
            { positions: ['DC', 'DR', 'DL'], weight: 3 }
        ];
    }

    // Build weighted candidate list
    const weightedCandidates: { player: PlayerState, weight: number }[] = [];

    for (const group of positionWeights) {
        const candidates = team.players.filter(p =>
            group.positions.includes(p.position) &&
            p.tacticalPosition !== null &&
            p.position !== 'GK' &&
            !isPlayerSentOff(p)
        );

        for (const player of candidates) {
            const focusWeight = getAttackingFocusBuff(
                team.tactics?.attacking_focus || 'MIXED',
                player.tacticalPosition || player.position
            );
            weightedCandidates.push({ player, weight: group.weight * focusWeight });
        }
    }

    if (weightedCandidates.length === 0) {
        // Fallback to any non-GK player
        return team.players.find(p => p.position !== 'GK' && !isPlayerSentOff(p)) || team.players.find(p => !isPlayerSentOff(p)) || team.players[1];
    }

    // Weighted random selection
    const totalWeight = weightedCandidates.reduce((sum, c) => sum + c.weight, 0);
    const roll = Math.random() * totalWeight;

    let cumulative = 0;
    for (const candidate of weightedCandidates) {
        cumulative += candidate.weight;
        if (roll <= cumulative) {
            return candidate.player;
        }
    }

    return weightedCandidates[0].player;
}

function getRandomPlayer(team: TeamState, positions: string[]): PlayerState | undefined {
    // Strictly use on-pitch players only (tacticalPosition !== null)
    const activePlayers = team.players.filter(p => p.tacticalPosition !== null && !isPlayerSentOff(p));

    // Primary selection: active players matching requested positions
    const activeCandidates = activePlayers.filter(p => positions.includes(p.position));
    if (activeCandidates.length > 0) {
        return activeCandidates[Math.floor(Math.random() * activeCandidates.length)];
    }

    // Fallback: any active player (keeps simulation running even with odd formations)
    if (activePlayers.length > 0) {
        return activePlayers[Math.floor(Math.random() * activePlayers.length)];
    }

    // Emergency fallback only when no active player exists (should not happen)
    if (team.players.length === 0) return undefined;
    const notSentOff = team.players.filter(p => !isPlayerSentOff(p));
    if (notSentOff.length > 0) {
        return notSentOff[Math.floor(Math.random() * notSentOff.length)];
    }
    return team.players[Math.floor(Math.random() * team.players.length)];
}

function updateFitness(team: TeamState) {
    team.players.forEach(p => {
        if (p.tacticalPosition !== null && !isPlayerSentOff(p)) {
            const baseDrain = 0.4;
            const staminaFactor = Math.max(0.7, 1 - (p.attributes.stamina - 10) * 0.02);
            const attackingRole = getActiveRolePreset(p, true);
            const defensiveRole = getActiveRolePreset(p, false);
            const attackingDrain = attackingRole ? getRoleConditionDrain(attackingRole) : 1.0;
            const defensiveDrain = defensiveRole ? getRoleConditionDrain(defensiveRole) : 1.0;
            const roleDrain = Math.max(attackingDrain, defensiveDrain);
            const drain = baseDrain * staminaFactor * getMentalityBuff(team.tactics.mentality).fatigue * roleDrain;
            p.condition = Math.max(0, p.condition - drain);
        }
    });
}

function performSubstitution(
    team: TeamState,
    matchState: MatchState,
    minute: number,
    ball: BallState,
    outPlayer: PlayerState,
    inPlayer: PlayerState
) {
    const outSlot = outPlayer.tacticalPosition;
    outPlayer.tacticalPosition = null;
    inPlayer.tacticalPosition = outSlot;

    if (matchState.playerStats[outPlayer.id]) {
        matchState.playerStats[outPlayer.id].minutes = Math.min(matchState.playerStats[outPlayer.id].minutes, minute);
    }
    if (matchState.playerStats[inPlayer.id]) {
        matchState.playerStats[inPlayer.id].minutes = Math.max(matchState.playerStats[inPlayer.id].minutes, 90 - minute);
    }

    if (ball.carrier?.id === outPlayer.id) {
        ball.carrier = inPlayer;
    }

    matchState.events.push({
        minute,
        type: 'SUB',
        text: `Substitution: ${outPlayer.name} off, ${inPlayer.name} on.`,
        teamId: team.id,
        playerId: inPlayer.id
    });
}

function attemptSubstitutions(
    team: TeamState,
    matchState: MatchState,
    minute: number,
    ball: BallState,
    subsUsed: number,
    maxSubs: number
): number {
    if (subsUsed >= maxSubs) return subsUsed;
    if (minute < 55) return subsUsed;

    // Players that already came on should never be substituted out again
    const subbedInIds = new Set(
        (matchState.events || [])
            .filter((e: any) => e.type === 'SUB' && e.teamId === team.id && e.playerId)
            .map((e: any) => e.playerId as string)
    );

    const starters = team.players.filter(
        p => p.tacticalPosition !== null && p.position !== 'GK' && !subbedInIds.has(p.id) && !isPlayerSentOff(p)
    );
    const availableBench = team.players.filter(p => p.tacticalPosition === null && p.position !== 'GK' && !isPlayerSentOff(p) && !p.isInjured && !p.isSuspended);
    const availableBenchGK = team.players.filter(p => p.tacticalPosition === null && p.position === 'GK' && !isPlayerSentOff(p) && !p.isInjured && !p.isSuspended);
    if (availableBench.length === 0 && availableBenchGK.length === 0) return subsUsed;

    const tiredStarters = starters
        .filter(p => p.condition < 70)
        .sort((a, b) => a.condition - b.condition);

    const getPositionGroup = (pos: string) => {
        if (pos === 'GK') return 'GK';
        if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos)) return 'DEF';
        if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos)) return 'MID';
        if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos)) return 'FWD';
        return 'MID';
    };

    for (const outPlayer of tiredStarters) {
        if (subsUsed >= maxSubs) break;
        const slotBase = outPlayer.tacticalPosition ? outPlayer.tacticalPosition.split('_')[0] : outPlayer.position;
        const outGroup = getPositionGroup(slotBase);

        const samePosition = availableBench.filter(p => p.position === slotBase);
        const sameGroup = availableBench.filter(p => getPositionGroup(p.position) === outGroup);
        const midGroup = availableBench.filter(p => getPositionGroup(p.position) === 'MID');

        const pickBest = (list: PlayerState[]) => list.sort((a, b) => b.condition - a.condition)[0];

        let bestBench = pickBest(samePosition);
        if (!bestBench) bestBench = pickBest(sameGroup);
        if (!bestBench && (outGroup === 'DEF' || outGroup === 'FWD')) bestBench = pickBest(midGroup);
        if (!bestBench) bestBench = pickBest(availableBench);

        if (!bestBench) continue;

        performSubstitution(team, matchState, minute, ball, outPlayer, bestBench);
        subsUsed += 1;

        const removeIdx = availableBench.findIndex(p => p.id === bestBench.id);
        if (removeIdx >= 0) {
            availableBench.splice(removeIdx, 1);
        }
    }

    // Emergency GK substitution only (late game + very low condition)
    // Goalkeeper should be last option and typically not changed.
    if (subsUsed < maxSubs && minute >= 70 && availableBenchGK.length > 0) {
        const currentGK = team.players.find(
            p => p.tacticalPosition !== null && p.position === 'GK' && !subbedInIds.has(p.id) && !isPlayerSentOff(p)
        );

        if (currentGK) {
            const gkEmergencyThreshold = 22; // only very low condition
            if (currentGK.condition <= gkEmergencyThreshold) {
                const bestBenchGK = [...availableBenchGK].sort((a, b) => b.condition - a.condition)[0];
                if (bestBenchGK && bestBenchGK.condition >= currentGK.condition + 5) {
                    performSubstitution(team, matchState, minute, ball, currentGK, bestBenchGK);
                    subsUsed += 1;
                }
            }
        }
    }

    return subsUsed;
}

function calculateRatings(matchState: MatchState) {
    Object.values(matchState.playerStats).forEach(stat => {
        // Players who did not play should not be performance-rated
        if ((stat.minutes || 0) <= 0) {
            stat.rating = 6.0;
            return;
        }

        let rating = 6.0;

        // Check if player is goalkeeper by position
        const isGoalkeeper = stat.position === 'GK';
        const isDefender = ['DC', 'DR', 'DL', 'DMC', 'DMR', 'DML'].includes(stat.position);

        const teamGoalsFor = stat.teamId === matchState.homeTeamId ? matchState.homeScore : matchState.awayScore;
        const teamGoalsAgainst = stat.teamId === matchState.homeTeamId ? matchState.awayScore : matchState.homeScore;
        const goalDiff = teamGoalsFor - teamGoalsAgainst;

        rating += (stat.goals * 1.2);
        rating += (stat.assists * 0.7);

        // Reduce goalkeeper save rating bonus from 0.2 to 0.15 to balance saves
        // Goalkeepers should get credit for good saves but not dominate MOM every match
        if (isGoalkeeper) {
            rating += (stat.saves * 0.15);
        } else {
            rating += (stat.saves * 0.2); // Non-GK rarely get saves, keep original
        }

        rating += (stat.tacklesWon * 0.3);
        rating += (stat.passesCompleted * 0.01); // Reduced from 0.05 due to 4x more passes from 12 ticks/min
        rating += (stat.dribblesWon * 0.2);

        rating -= ((stat.shots - stat.shotsOnTarget) * 0.1);
        rating -= ((stat.tacklesAttempted - stat.tacklesWon) * 0.1);
        rating -= (stat.yellowCards * 0.5);
        rating -= (stat.redCards * 2.0);
        rating -= (stat.fouls * 0.1);

        // Team performance penalties/bonuses for realism
        if (goalDiff < 0) {
            // Losing team penalty scales with margin (capped)
            rating -= Math.min(2.5, Math.abs(goalDiff) * 0.35);
        } else if (goalDiff > 0) {
            // Small boost for winners
            rating += Math.min(0.8, goalDiff * 0.2);
        }

        // Conceded goals impact (strong for GK/DEF, light for others)
        if (teamGoalsAgainst > 0) {
            if (isGoalkeeper) {
                rating -= teamGoalsAgainst * 0.45;
            } else if (isDefender) {
                rating -= teamGoalsAgainst * 0.22;
            } else {
                rating -= Math.max(0, teamGoalsAgainst - 2) * 0.08;
            }
        } else {
            // Clean sheet reward (mainly defensive players)
            if (isGoalkeeper) rating += 0.8;
            else if (isDefender) rating += 0.5;
        }

        // Hard cap for extreme collapses to avoid unrealistic 10.0 in big defeats
        let ratingCap = 10;
        if (teamGoalsAgainst >= 10) ratingCap = isGoalkeeper || isDefender ? 5.5 : 7.0;
        else if (teamGoalsAgainst >= 6) ratingCap = isGoalkeeper || isDefender ? 6.5 : 8.0;

        stat.rating = Math.max(1, Math.min(ratingCap, Math.round(rating * 10) / 10));
    });
}
