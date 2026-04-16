/**
 * Match Engine V2 - Spatial Movement Engine
 * 
 * Handles player movement AI, ball physics, and collision detection
 */

import type { 
    SpatialPosition, 
    V2PlayerState, 
    V2BallState,
    PlayerCollision,
    TeamContext,
    RoleIntent,
    PassOption,
    DefensiveAssignment,
} from './types2d';
import type { PlayerAttributes } from '../types';
import { 
    ROLE_MOVEMENT_CONFIG, 
    MOVEMENT_SPEED,
    PACE_SPEED_TABLE,
    COLLISION,
    FIELD,
    TUNING_PARAMS,
} from './config';
import { 
    getDistance, 
    clampToField, 
    getFormationRole 
} from './formation';
import { v2Random } from './random';

// ============================================================
// PLAYER MOVEMENT AI
// ============================================================

/**
 * Calculates target position for a player based on multiple factors
 */
export function calculateTargetPosition(
    player: V2PlayerState,
    ball: V2BallState,
    teammates: V2PlayerState[],
    opponents: V2PlayerState[],
    rolePosition: SpatialPosition
): SpatialPosition {
    const role = getFormationRole(player.tacticalPosition);
    const roleConfig = ROLE_MOVEMENT_CONFIG[role] || ROLE_MOVEMENT_CONFIG['MIDFIELDER'];
    
    // Get component forces
    const ballPull = calculateBallAttraction(player, ball, roleConfig);
    const rolePull = calculateRolePositioning(player, rolePosition, roleConfig);
    const spacingPull = calculateTeammateSpacing(player, teammates);
    const markingPull = calculateMarking(player, opponents);
    
    // Weighted average
    const weights = roleConfig.weights;
    const target = {
        x: (ballPull.x * weights.ballAttraction +
            rolePull.x * weights.rolePosition +
            spacingPull.x * weights.spacing +
            markingPull.x * weights.marking),
        y: (ballPull.y * weights.ballAttraction +
            rolePull.y * weights.rolePosition +
            spacingPull.y * weights.spacing +
            markingPull.y * weights.marking),
    };
    
    // Clamp to field
    return clampToField(target);
}

/**
 * Phase 2: Generate movement intent for a player
 * Wraps calculateTargetPosition() with RoleIntent metadata
 */
export function generateMovementIntent(
    player: V2PlayerState,
    team: 'home' | 'away',
    teamContext: TeamContext,
    teammates: V2PlayerState[],
    opponents: V2PlayerState[],
    ball: V2BallState,
    rolePosition: SpatialPosition,
): RoleIntent {
    // Calculate target position (existing logic)
    const targetPosition = calculateTargetPosition(
        player,
        ball,
        teammates,
        opponents,
        rolePosition,
    );
    
    // Determine job based on context and role
    let job: RoleIntent['job'] = 'POSITION';
    let context = 'moving to position';
    let priority = 50;
    let intensity = 50;
    
    const distanceToBall = getDistance(player.position2D, ball.position);
    
    // Job selection logic (simplified for Phase 2)
    if (ball.possession === team) {
        // Possession: support or attack
        if (distanceToBall < 15) {
            job = 'SUPPORT';
            context = 'support ball carrier';
            priority = 75;
        } else {
            job = 'ATTACK';
            context = 'move forward to attack';
            priority = 60;
        }
    } else {
        // Defending
        if (distanceToBall < 10) {
            job = 'PRESS';
            context = 'press ball carrier';
            priority = 80;
            intensity = 70;
        } else {
            job = 'DEFEND';
            context = 'hold defensive position';
            priority = 70;
        }
    }
    
    // Pressure and line height modifiers
    intensity = Math.min(100, intensity + (teamContext.pressure - 50) * 0.2);
    priority = Math.min(100, priority + (teamContext.pressure - 50) * 0.1);
    
    // Utility score (0-100)
    const utilityScore = Math.max(0, Math.min(100, priority + (100 - distanceToBall)));
    
    return {
        job,
        targetPosition,
        priority,
        utilityScore,
        context,
        intensity,
        confidence: 0.7 + v2Random() * 0.2,  // 0.7-0.9
    };
}

/**
 * Ball attraction force - pull toward ball if within radius
 */
function calculateBallAttraction(
    player: V2PlayerState,
    ball: V2BallState,
    roleConfig: typeof ROLE_MOVEMENT_CONFIG['MIDFIELDER']
): SpatialPosition {
    const distanceToBall = getDistance(player.position2D, ball.position);
    
    // Only attracted if within radius
    if (distanceToBall > roleConfig.ballAttractionRadius) {
        return player.position2D;  // Stay where you are
    }
    
    // Stronger pull when closer
    const strength = 1 - (distanceToBall / roleConfig.ballAttractionRadius);
    
    return {
        x: player.position2D.x + (ball.position.x - player.position2D.x) * strength,
        y: player.position2D.y + (ball.position.y - player.position2D.y) * strength,
    };
}

/**
 * Role positioning force - pull toward tactical position
 */
function calculateRolePositioning(
    player: V2PlayerState,
    rolePosition: SpatialPosition,
    roleConfig: typeof ROLE_MOVEMENT_CONFIG['MIDFIELDER']
): SpatialPosition {
    const distanceFromRole = getDistance(player.position2D, rolePosition);
    
    // Don't wander too far from role
    if (distanceFromRole > roleConfig.maxDistanceFromRole) {
        // Strong pull back
        return rolePosition;
    }
    
    // Gentle drift toward role
    return rolePosition;
}

/**
 * Teammate spacing force - avoid crowding
 */
function calculateTeammateSpacing(
    player: V2PlayerState,
    teammates: V2PlayerState[]
): SpatialPosition {
    let repulsionX = 0;
    let repulsionY = 0;
    const SPACING_RADIUS = 8;  // Minimum desired spacing
    
    teammates.forEach(teammate => {
        if (teammate.id === player.id) return;
        
        const distance = getDistance(player.position2D, teammate.position2D);
        
        if (distance < SPACING_RADIUS && distance > 0) {
            // Push away
            const strength = (SPACING_RADIUS - distance) / SPACING_RADIUS;
            const dx = player.position2D.x - teammate.position2D.x;
            const dy = player.position2D.y - teammate.position2D.y;
            
            repulsionX += (dx / distance) * strength * 5;
            repulsionY += (dy / distance) * strength * 5;
        }
    });
    
    return {
        x: player.position2D.x + repulsionX,
        y: player.position2D.y + repulsionY,
    };
}

/**
 * Marking force - follow assigned opponent
 */
function calculateMarking(
    player: V2PlayerState,
    opponents: V2PlayerState[]
): SpatialPosition {
    if (!player.isMarking) {
        return player.position2D;  // No marking assignment
    }
    
    const target = opponents.find(opp => opp.id === player.isMarking);
    if (!target) {
        return player.position2D;
    }
    
    // Follow target with slight offset
    return {
        x: target.position2D.x - 3,  // Stay 3 yards behind
        y: target.position2D.y,
    };
}

// ============================================================
// MOVEMENT EXECUTION
// ============================================================

/**
 * Updates player position based on target and speed
 */
export function updatePlayerPosition(
    player: V2PlayerState,
    target: SpatialPosition,
    attributes: PlayerAttributes,
    hasBall: boolean,
    minute: number = 0,
    tickSeconds: number = TUNING_PARAMS.movementTickSeconds,
): void {
    // Safety check: ensure target is valid
    if (!target || isNaN(target.x) || isNaN(target.y)) {
        // Invalid target, don't move
        player.velocity = { dx: 0, dy: 0 };
        return;
    }
    
    // Safety check: ensure player position is valid
    if (isNaN(player.position2D.x) || isNaN(player.position2D.y)) {
        // Reset to safe position
        player.position2D = { x: 50, y: 50 };
    }
    
    // Calculate top speed based on pace table (units/sec)
    const pace = clampStat(attributes.pace || 10);
    const acceleration = clampStat(attributes.acceleration || pace);
    const stamina = clampStat(attributes.stamina || 10);

    let topSpeed = getTopSpeedFromPace(pace);

    // Dribbling penalty: keep 85% speed when carrying ball
    if (hasBall) {
        topSpeed *= TUNING_PARAMS.onBallSpeedMultiplier;
    }

    // Condition multiplier (0-100% fitness/condition)
    const conditionFactor = Math.max(0.55, Math.min(1, player.condition / 100));
    topSpeed *= conditionFactor;

    // Stamina/fatigue factor after minute 70
    if (minute >= 70) {
        const fatigueProgress = Math.min(1, (minute - 70) / 20); // 70'..90'
        const staminaResilience = 0.7 + (stamina / 20) * 0.3; // 0.7..1.0
        const lateGameFactor = 1 - fatigueProgress * (1 - staminaResilience);
        topSpeed *= lateGameFactor;
    }
    
    // Calculate distance to target
    const dx = target.x - player.position2D.x;
    const dy = target.y - player.position2D.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.5) {
        // Already at target
        player.movementSpeed = Math.max(0, player.movementSpeed - 6 * tickSeconds);
        player.velocity = { dx: 0, dy: 0 };
        player.isSprinting = false;
        return;
    }

    // Acceleration ramp: low acceleration takes ~2-3s to hit top speed
    const accelerationTime =
        TUNING_PARAMS.accelerationTimeMaxSec -
        ((acceleration - 1) / 19) * (TUNING_PARAMS.accelerationTimeMaxSec - TUNING_PARAMS.accelerationTimeMinSec);

    const accelPerSecond = topSpeed / Math.max(0.1, accelerationTime);
    const accelPerTick = accelPerSecond * tickSeconds;

    const desiredSpeed = Math.min(topSpeed, Math.max(0, distance / Math.max(0.01, tickSeconds)));
    const currentSpeed = Math.max(0, player.movementSpeed || 0);
    const nextSpeed = desiredSpeed > currentSpeed
        ? Math.min(desiredSpeed, currentSpeed + accelPerTick)
        : Math.max(desiredSpeed, currentSpeed - accelPerTick * 1.2);

    player.movementSpeed = nextSpeed;
    
    // Move toward target
    // Direction vector normalization keeps diagonal speed fair (no diagonal boost)
    // Hard anti-warp guard: per-tick displacement may never exceed
    // pace-table top speed adjusted by ball-carry, condition, and stamina.
    const maxStepPerTick = Math.max(0, topSpeed * tickSeconds);
    const step = Math.min(nextSpeed * tickSeconds, maxStepPerTick, distance);
    const moveX = (dx / distance) * step;
    const moveY = (dy / distance) * step;
    
    player.position2D.x += moveX;
    player.position2D.y += moveY;
    player.velocity = { dx: moveX, dy: moveY };
    
    // Update facing direction (in degrees)
    player.facingDirection = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Determine if sprinting
    player.isSprinting = nextSpeed > MOVEMENT_SPEED.RUNNING;
    
    // Clamp to field bounds
    const clamped = clampToField(player.position2D);
    player.position2D.x = clamped.x;
    player.position2D.y = clamped.y;
    player.targetPosition = { ...target };
}

function clampStat(value: number): number {
    return Math.max(1, Math.min(20, Math.round(value)));
}

function getTopSpeedFromPace(pace: number): number {
    return PACE_SPEED_TABLE[pace] ?? (5 + pace * 0.25);
}

// ============================================================
// BALL PHYSICS
// ============================================================

/**
 * Simulates ball physics for a pass
 */
export function simulatePassTrajectory(
    from: SpatialPosition,
    to: SpatialPosition,
    strength: number  // 0-1 (short pass = 0.3, long pass = 1.0)
): { trajectory: SpatialPosition[]; time: number } {
    const trajectory: SpatialPosition[] = [];
    const STEPS = 10;  // Number of trajectory points
    
    // Simple linear interpolation (future: add arc for long passes)
    for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        trajectory.push({
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
        });
    }
    
    // Time based on distance and strength
    const distance = getDistance(from, to);
    const time = distance / (strength * 50);  // Arbitrary speed
    
    return { trajectory, time };
}

/**
 * Simulates ball physics for a shot
 */
export function simulateShotTrajectory(
    from: SpatialPosition,
    target: SpatialPosition,
    power: number  // 0-1
): { trajectory: SpatialPosition[]; height: number[] } {
    const trajectory: SpatialPosition[] = [];
    const height: number[] = [];
    const STEPS = 15;
    
    const distance = getDistance(from, target);
    const maxHeight = Math.min(power * 20, distance * 0.3);  // Arc height
    
    for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        
        // Horizontal movement
        trajectory.push({
            x: from.x + (target.x - from.x) * t,
            y: from.y + (target.y - from.y) * t,
        });
        
        // Vertical arc (parabola)
        const h = maxHeight * Math.sin(t * Math.PI);
        height.push(h);
    }
    
    return { trajectory, height };
}

/**
 * Simulates ball physics for a dribble
 */
export function simulateDribbleMovement(
    player: V2PlayerState,
    direction: number  // Degrees (0 = right, 90 = up)
): SpatialPosition {
    const DRIBBLE_DISTANCE = 2;  // Yards per tick
    
    const radians = direction * (Math.PI / 180);
    const newPosition = {
        x: player.position2D.x + Math.cos(radians) * DRIBBLE_DISTANCE,
        y: player.position2D.y + Math.sin(radians) * DRIBBLE_DISTANCE,
    };
    
    return clampToField(newPosition);
}

// ============================================================
// COLLISION DETECTION
// ============================================================

/**
 * Checks for collision between two players
 */
export function checkPlayerCollision(
    p1: V2PlayerState,
    p2: V2PlayerState
): PlayerCollision | null {
    const distance = getDistance(p1.position2D, p2.position2D);
    
    if (distance < COLLISION.MIN_PLAYER_DISTANCE) {
        const dx = p2.position2D.x - p1.position2D.x;
        const dy = p2.position2D.y - p1.position2D.y;
        
        return {
            player1Id: p1.id,
            player2Id: p2.id,
            position: {
                x: (p1.position2D.x + p2.position2D.x) / 2,
                y: (p1.position2D.y + p2.position2D.y) / 2,
            },
            separationVector: {
                dx: (dx / distance) * COLLISION.PUSH_FORCE,
                dy: (dy / distance) * COLLISION.PUSH_FORCE,
            },
            tackleAttempted: distance < COLLISION.TACKLE_RANGE,
        };
    }
    
    return null;
}

/**
 * Resolves collision by pushing players apart
 */
export function resolveCollision(
    p1: V2PlayerState,
    p2: V2PlayerState,
    collision: PlayerCollision
): void {
    // Push players apart
    p1.position2D.x -= collision.separationVector.dx / 2;
    p1.position2D.y -= collision.separationVector.dy / 2;
    
    p2.position2D.x += collision.separationVector.dx / 2;
    p2.position2D.y += collision.separationVector.dy / 2;
    
    // Clamp to field
    p1.position2D = clampToField(p1.position2D);
    p2.position2D = clampToField(p2.position2D);
}

/**
 * Finds all players within tackle range of a position
 */
export function findNearbyPlayers(
    position: SpatialPosition,
    allPlayers: V2PlayerState[],
    radius: number
): V2PlayerState[] {
    return allPlayers.filter(p => {
        const distance = getDistance(position, p.position2D);
        return distance <= radius;
    });
}

/**
 * Pushes teammates apart when unnaturally clustered.
 */
export function applyTeamSpacingGuard(
    players: V2PlayerState[],
    minDistance: number = TUNING_PARAMS.minTeammateDistance,
): void {
    for (let i = 0; i < players.length; i += 1) {
        for (let j = i + 1; j < players.length; j += 1) {
            const p1 = players[i];
            const p2 = players[j];
            const dx = p2.position2D.x - p1.position2D.x;
            const dy = p2.position2D.y - p1.position2D.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0 && distance < minDistance) {
                const push = (minDistance - distance) * 0.5;
                const nx = dx / distance;
                const ny = dy / distance;
                p1.position2D = clampToField({ x: p1.position2D.x - nx * push, y: p1.position2D.y - ny * push });
                p2.position2D = clampToField({ x: p2.position2D.x + nx * push, y: p2.position2D.y + ny * push });
            }
        }
    }
}

export function calculatePassFailureProbability(
    from: SpatialPosition,
    to: SpatialPosition,
    passer: V2PlayerState,
    receiver: V2PlayerState,
    opponents: V2PlayerState[],
): number {
    const nearestToPasser = getNearestOpponentDistance(from, opponents);
    const nearestToReceiver = getNearestOpponentDistance(to, opponents);
    const distance = getDistance(from, to);

    const passerSkill = (passer.attributes.passing || 10) / 20;
    const receiverControl = ((receiver.attributes.composure || receiver.attributes.dribbling || 10) / 20);

    const pressureFactor = clamp01(1 - nearestToPasser / 10);

    // Receiver-space window (configurable):
    // - > open radius => mostly safe first touch
    // - 2..5 units => contested control/tackle risk
    // - < 2 units => heavy pressure
    const openR = TUNING_PARAMS.receiverOpenSpaceRadius;
    const contestMin = TUNING_PARAMS.receiverContestMinRadius;
    const contestMax = TUNING_PARAMS.receiverContestMaxRadius;

    let receiverCrowdFactor = 0;
    if (nearestToReceiver < contestMin) {
        receiverCrowdFactor = 1;
    } else if (nearestToReceiver <= contestMax) {
        receiverCrowdFactor = clamp01((contestMax - nearestToReceiver) / Math.max(0.1, contestMax - contestMin));
    } else if (nearestToReceiver <= openR) {
        receiverCrowdFactor = clamp01((openR - nearestToReceiver) / Math.max(0.1, openR - contestMax)) * 0.45;
    }

    const distanceFactor = clamp01((distance - 10) / 35);

    const raw =
        TUNING_PARAMS.passErrorBase +
        pressureFactor * TUNING_PARAMS.passErrorPressureWeight +
        distanceFactor * TUNING_PARAMS.passErrorDistanceWeight +
        receiverCrowdFactor * (TUNING_PARAMS.passErrorReceiverCrowdedWeight + 0.08) -
        passerSkill * 0.14 -
        receiverControl * 0.1;

    return clamp01(raw);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function getNearestOpponentDistance(position: SpatialPosition, opponents: V2PlayerState[]): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (const opponent of opponents) {
        const distance = getDistance(position, opponent.position2D);
        if (distance < nearest) nearest = distance;
    }
    return Number.isFinite(nearest) ? nearest : 40;
}

// ============================================================
// PHASE 4: PASS OPTION SCORING
// ============================================================

/**
 * Scores all teammate pass options based on openness, progression, lane risk,
 * and game context (build-up vs fast-break).
 */
export function scorePassTargets(
    carrier: V2PlayerState,
    teammates: V2PlayerState[],
    opponents: V2PlayerState[],
    ball: V2BallState,
    teamContext: TeamContext,
): PassOption[] {
    const candidates = teammates.filter((player) => player.id !== carrier.id);
    const isHome = ball.possession === 'home';
    const nearestToCarrier = getNearestOpponentDistance(carrier.position2D, opponents);
    const urgency = clamp01((teamContext.pressure / 100) * 0.6 + (1 - clamp01(nearestToCarrier / 14)) * 0.4);

    const options: PassOption[] = candidates.map((receiver) => {
        const distance = getDistance(carrier.position2D, receiver.position2D);

        const preferredDistance = teamContext.transitionMode === 'FAST_BREAK' ? 19 : 12;
        const tolerance = teamContext.transitionMode === 'FAST_BREAK' ? 18 : 12;
        const distanceScore = clamp01(1 - Math.abs(distance - preferredDistance) / tolerance);

        const nearestOpponentDistance = getNearestOpponentDistance(receiver.position2D, opponents);
        const openness = clamp01((nearestOpponentDistance - 3) / 16);

        const forwardProgressRaw = isHome
            ? receiver.position2D.x - carrier.position2D.x
            : carrier.position2D.x - receiver.position2D.x;
        const forwardProgress = clamp01((forwardProgressRaw + 12) / 36);

        const riskLevel = calculatePassLaneRisk(carrier.position2D, receiver.position2D, opponents, 4);

        const successProbability = clamp01(
            openness * 0.44 +
            distanceScore * 0.24 +
            (1 - riskLevel) * 0.24 +
            forwardProgress * 0.08,
        );

        const directBonus = teamContext.transitionMode === 'FAST_BREAK' ? forwardProgress * 10 : 0;
        const safeBonus = teamContext.phase === 'BUILD_UP' ? (1 - riskLevel) * 10 : 0;

        const backwardPenalty = forwardProgressRaw < -3
            ? Math.min(24, Math.abs(forwardProgressRaw) * 1.2)
            : 0;
        const progressionWeight = teamContext.scoreState?.isTrailing
            ? 26
            : teamContext.transitionMode === 'FAST_BREAK'
                ? 24
                : 20;

        const utility =
            successProbability * 52 +
            openness * 18 +
            forwardProgress * progressionWeight +
            distanceScore * 8 +
            urgency * 8 +
            directBonus +
            safeBonus -
            riskLevel * 28 -
            backwardPenalty;

        return {
            receiver,
            distance,
            successProbability,
            riskLevel,
            urgency,
            utility,
        };
    });

    return options.sort((a, b) => b.utility - a.utility);
}

// ============================================================
// PHASE 5: DEFENSIVE COORDINATION
// ============================================================

function isDefenderLike(player: V2PlayerState): boolean {
    const pos = player.position;
    return pos === 'DC' || pos === 'DL' || pos === 'DR' || pos === 'DMC' || pos === 'DML' || pos === 'DMR';
}

function isMidfielderLike(player: V2PlayerState): boolean {
    const pos = player.position;
    return pos === 'MC' || pos === 'ML' || pos === 'MR' || pos === 'AMC' || pos === 'AMR' || pos === 'AML';
}

/**
 * Produces coordinated pressing/cover/line-holder assignments for one team.
 */
export function assignDefensiveRoles(
    defenseTeam: V2PlayerState[],
    attackTeam: V2PlayerState[],
    defenseTeamKey: 'home' | 'away',
    teamContext: TeamContext,
    ball: V2BallState,
): DefensiveAssignment {
    const assigner = defenseTeam.find((p) => p.position === 'DC' || p.position === 'DMC') || defenseTeam[0];
    const outOfPossession = ball.possession !== defenseTeamKey;

    const pressure = Math.max(0, Math.min(100, teamContext.pressure));
    if (!assigner || !outOfPossession) {
        return {
            assigner: assigner || defenseTeam[0],
            lineHolders: defenseTeam,
            priority: pressure,
        };
    }

    const opponentCarrier = ball.carrier && attackTeam.some((p) => p.id === ball.carrier?.id)
        ? ball.carrier
        : attackTeam.reduce((best, player) => {
            const playerDistance = getDistance(player.position2D, ball.position);
            const bestDistance = getDistance(best.position2D, ball.position);
            return playerDistance < bestDistance ? player : best;
        }, attackTeam[0]);

    const eligiblePressers = defenseTeam.filter((p) => p.position !== 'GK');

    let presser: V2PlayerState | undefined;
    if (pressure > 72) {
        presser = eligiblePressers.reduce((best, player) => {
            const playerDistance = getDistance(player.position2D, opponentCarrier.position2D);
            const bestDistance = getDistance(best.position2D, opponentCarrier.position2D);
            return playerDistance < bestDistance ? player : best;
        }, eligiblePressers[0]);
    } else if (pressure >= 46) {
        const midBlockPresser = eligiblePressers
            .filter((p) => isDefenderLike(p) || isMidfielderLike(p))
            .sort((a, b) => getDistance(a.position2D, opponentCarrier.position2D) - getDistance(b.position2D, opponentCarrier.position2D))[0];
        if (midBlockPresser && getDistance(midBlockPresser.position2D, opponentCarrier.position2D) <= 15) {
            presser = midBlockPresser;
        }
    }

    let cover: V2PlayerState | undefined;
    if (presser) {
        cover = defenseTeam
            .filter((p) => p.id !== presser?.id && p.position !== 'GK' && (isDefenderLike(p) || isMidfielderLike(p)))
            .sort((a, b) => getDistance(a.position2D, presser.position2D) - getDistance(b.position2D, presser.position2D))[0];
    }

    // Keep defensive line ownership to defenders/DM only to avoid full-team collapse.
    const lineHolders = defenseTeam.filter((p) => isDefenderLike(p) && p.id !== presser?.id && p.id !== cover?.id);

    return {
        assigner,
        presser,
        cover,
        lineHolders,
        priority: pressure,
    };
}

// ============================================================
// SPATIAL OPTIMIZATION
// ============================================================

/**
 * Spatial grid for efficient nearest-neighbor queries
 */
export class SpatialGrid {
    private grid: Map<string, V2PlayerState[]>;
    private cellSize: number;
    
    constructor(cellSize: number = 10) {
        this.grid = new Map();
        this.cellSize = cellSize;
    }
    
    private getGridKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    
    insert(player: V2PlayerState): void {
        const key = this.getGridKey(player.position2D.x, player.position2D.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(player);
    }
    
    getNearby(x: number, y: number, radius: number): V2PlayerState[] {
        const nearby: V2PlayerState[] = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        
        const centerCellX = Math.floor(x / this.cellSize);
        const centerCellY = Math.floor(y / this.cellSize);
        
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const key = `${centerCellX + dx},${centerCellY + dy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    nearby.push(...cell);
                }
            }
        }
        
        return nearby;
    }
    
    clear(): void {
        this.grid.clear();
    }
}

// ============================================================
// PHASE 3: PASS LANE RISK
// ============================================================

/**
 * Calculates interception risk for a pass from → to.
 * Projects each defending player onto the pass segment and measures
 * perpendicular distance.  Players within laneWidth units of the
 * segment midpoint raise the risk proportional to their tackling.
 *
 * Returns 0–0.55 probability of interception.
 */
export function calculatePassLaneRisk(
    from: SpatialPosition,
    to: SpatialPosition,
    opponents: V2PlayerState[],
    laneWidth = 4,
): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) return 0;

    let totalRisk = 0;

    for (const opp of opponents) {
        const px = opp.position2D.x - from.x;
        const py = opp.position2D.y - from.y;
        // Scalar projection onto pass vector (0=from, 1=to)
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
        // Perpendicular distance from opponent to pass line
        const perpX = from.x + t * dx - opp.position2D.x;
        const perpY = from.y + t * dy - opp.position2D.y;
        const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

        if (perpDist < laneWidth) {
            const tackling = (opp.attributes?.tackling ?? 10) / 20; // 0–1
            const proximity = 1 - perpDist / laneWidth;            // 1=on-line, 0=edge
            totalRisk += tackling * proximity * 0.18;
        }
    }

    return Math.min(0.55, totalRisk);
}

// ============================================================
// OUT OF BOUNDS DETECTION
// ============================================================

/**
 * Checks if ball is out of bounds and determines set piece type
 */
export function checkBallOutOfBounds(
    ball: V2BallState,
    lastTouchTeam: 'home' | 'away'
): { type: 'CORNER' | 'GOAL_KICK' | 'THROW_IN'; position: SpatialPosition } | null {
    const { x, y } = ball.position;
    
    // Sideline (Y out of bounds)
    if (y < 0 || y > FIELD.WIDTH) {
        return {
            type: 'THROW_IN',
            position: {
                x: x,
                y: y < 0 ? 0 : FIELD.WIDTH,
            },
        };
    }
    
    // Goal line (X out of bounds)
    if (x < 0) {
        // Home end
        return lastTouchTeam === 'away' ? {
            type: 'CORNER',
            position: { x: 0, y: y > 50 ? 100 : 0 },
        } : {
            type: 'GOAL_KICK',
            position: { x: 6, y: 50 },
        };
    }
    
    if (x > FIELD.LENGTH) {
        // Away end
        return lastTouchTeam === 'home' ? {
            type: 'CORNER',
            position: { x: 100, y: y > 50 ? 100 : 0 },
        } : {
            type: 'GOAL_KICK',
            position: { x: 94, y: 50 },
        };
    }
    
    return null;  // Ball in play
}
