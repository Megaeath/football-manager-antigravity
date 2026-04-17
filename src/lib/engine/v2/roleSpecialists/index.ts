import type { RoleIntent, V2PlayerState } from '../types2d';
import goalkeeperSpecialist from './goalkeeper';
import defenderSpecialist from './defender';
import midfielderSpecialist from './midfielder';
import attackingSpecialist from './attacking';
import forwardSpecialist from './forward';
import type { SpecialistInput } from './types';
import { getActiveRoleConfig } from '../roleMovementConfig';

const BPF_DISTANCE_MULTIPLIER = 24;
const BPF_X_LERP = 0.45;
const BPF_Y_LERP = 0.35;
const OFFSIDE_GUARD_GAP = 1.4;

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function clampSignedUnit(value: number): number {
    return Math.max(-1, Math.min(1, value));
}

function clamp100(value: number): number {
    return Math.max(0, Math.min(100, value));
}

function getRoleXBoundsForTeam(targetXRange: [number, number], team: 'home' | 'away'): { minX: number; maxX: number } {
    const [homeMin, homeMax] = targetXRange;
    if (team === 'home') {
        return { minX: homeMin, maxX: homeMax };
    }

    // Mirror home-oriented ranges to away orientation.
    return {
        minX: 100 - homeMax,
        maxX: 100 - homeMin,
    };
}

function getEnemyDefensiveLineX(opponents: V2PlayerState[], attackingTeam: 'home' | 'away'): number {
    const activeOpponents = opponents.filter((player) => (player.cards?.red || 0) < 1);
    if (activeOpponents.length === 0) {
        return attackingTeam === 'home' ? 95 : 5;
    }

    const xs = activeOpponents.map((player) => player.position2D.x).sort((a, b) => a - b);
    if (xs.length === 1) {
        return xs[0];
    }

    return attackingTeam === 'home'
        ? xs[xs.length - 2] // second-last nearest to away goal line
        : xs[1]; // second-last nearest to home goal line
}

function getRoleBucket(position: string): 'GK' | 'DEF' | 'MID' | 'ATT' | 'FW' {
    if (position === 'GK') return 'GK';
    if (position === 'DMC' || position === 'DMR' || position === 'DML') return 'MID';
    if (position.startsWith('D')) return 'DEF';
    if (position.startsWith('M')) return 'MID';
    if (position.startsWith('AM')) return 'ATT';
    return 'FW';
}

export function generateSpecialistIntent(input: SpecialistInput): RoleIntent {
    const bucket = getRoleBucket(input.player.position);

    let baseIntent: RoleIntent;
    if (bucket === 'GK') baseIntent = goalkeeperSpecialist.generateIntent(input);
    else if (bucket === 'DEF') baseIntent = defenderSpecialist.generateIntent(input);
    else if (bucket === 'MID') baseIntent = midfielderSpecialist.generateIntent(input);
    else if (bucket === 'ATT') baseIntent = attackingSpecialist.generateIntent(input);
    else baseIntent = forwardSpecialist.generateIntent(input);

    // Apply active role movement config if role preset is set
    try {
        const roleConfig = getActiveRoleConfig(
            input.player.attackingRolePreset,
            input.player.defensiveRolePreset,
            input.phaseState,
        );
        if (roleConfig) {
            baseIntent = applyRoleMovementConfig(baseIntent, roleConfig, input);
        }
    } catch {
        // Role config not available, use base intent
    }

    return baseIntent;
}

/**
 * Apply role movement config to modify specialist intent
 * Role config provides X-range targets, Y behaviors, and other spatial guidance
 */
function applyRoleMovementConfig(
    baseIntent: RoleIntent,
    roleConfig: ReturnType<typeof getActiveRoleConfig>,
    input: SpecialistInput,
): RoleIntent {
    if (!roleConfig) return baseIntent;

    const { player, team, phaseState, ball, opponents } = input;
    const inPossession = phaseState === 'IN_POSSESSION' || phaseState === 'ON_BALL';
    const phaseBpf = clampSignedUnit(inPossession ? roleConfig.bpf_attack : roleConfig.bpf_defense);
    const directionalSign = team === 'home' ? 1 : -1;

    // Dynamic Relative Positioning (BPF): targetX = ball.x + (bpf_factor * distance_multiplier)
    const bpfRawTargetX = ball.position.x + directionalSign * phaseBpf * BPF_DISTANCE_MULTIPLIER;

    // Hard X bounds per role (mirrored for away side)
    const { minX, maxX } = getRoleXBoundsForTeam(roleConfig.targetXRange, team);
    let computedTargetX = Math.max(minX, Math.min(maxX, bpfRawTargetX));

    // Optional absolute anchor line
    if (typeof roleConfig.holdLineX === 'number' && Number.isFinite(roleConfig.holdLineX)) {
        const holdLine = team === 'home' ? roleConfig.holdLineX : 100 - roleConfig.holdLineX;
        computedTargetX = Math.max(minX, Math.min(maxX, holdLine));
    }

    // Offside guard: only for attacking-positive BPF in possession phases
    if (inPossession && phaseBpf > 0) {
        const enemyDefLineX = getEnemyDefensiveLineX(opponents, team);
        if (team === 'home') {
            computedTargetX = Math.min(computedTargetX, enemyDefLineX - OFFSIDE_GUARD_GAP);
        } else {
            computedTargetX = Math.max(computedTargetX, enemyDefLineX + OFFSIDE_GUARD_GAP);
        }
        computedTargetX = Math.max(minX, Math.min(maxX, computedTargetX));
    }

    // Smooth blend to avoid visual jump / warp-like target snaps
    const xLerp = clamp01(BPF_X_LERP);
    baseIntent.targetPosition.x = baseIntent.targetPosition.x * (1 - xLerp) + computedTargetX * xLerp;
    baseIntent.targetPosition.x = clamp100(baseIntent.targetPosition.x);

    // Y behavior with smoothing
    if (roleConfig.yBehavior && typeof baseIntent.targetPosition.y === 'number') {
        let desiredY = baseIntent.targetPosition.y;

        if (roleConfig.yBehavior === 'center') {
            desiredY = 50;
        } else if (roleConfig.yBehavior === 'hug_left') {
            desiredY = team === 'home' ? 25 : 75;
        } else if (roleConfig.yBehavior === 'hug_right') {
            desiredY = team === 'home' ? 75 : 25;
        } else if (roleConfig.yBehavior === 'half_width') {
            const rightSided = player.position === 'MR' || player.position === 'DR' || player.position === 'FWR' || player.position === 'AMR';
            desiredY = rightSided ? 75 : 25;
        } else if (roleConfig.yBehavior === 'track_ball') {
            const trackStrength = clamp01(roleConfig.yTrackStrength);
            desiredY = baseIntent.targetPosition.y * (1 - trackStrength) + ball.position.y * trackStrength;
        }

        const yLerp = clamp01(BPF_Y_LERP);
        baseIntent.targetPosition.y = baseIntent.targetPosition.y * (1 - yLerp) + desiredY * yLerp;
        baseIntent.targetPosition.y = clamp100(baseIntent.targetPosition.y);
    }

    return baseIntent;
}

export function blendRoleIntent(base: RoleIntent, specialist: RoleIntent, specialistWeight = 0.7): RoleIntent {
    const w = Math.max(0, Math.min(1, specialistWeight));
    const baseWeight = 1 - w;

    return {
        ...base,
        job: specialist.job,
        targetPosition: {
            x: base.targetPosition.x * baseWeight + specialist.targetPosition.x * w,
            y: base.targetPosition.y * baseWeight + specialist.targetPosition.y * w,
        },
        priority: Math.round(base.priority * baseWeight + specialist.priority * w),
        utilityScore: base.utilityScore * baseWeight + specialist.utilityScore * w,
        context: `spec:${specialist.context}`,
        intensity: Math.round((base.intensity || 50) * baseWeight + (specialist.intensity || 50) * w),
        confidence: Math.max(base.confidence || 0.7, specialist.confidence || 0.7),
        markingTarget: specialist.markingTarget || base.markingTarget,
        supportTarget: specialist.supportTarget || base.supportTarget,
    };
}

export function getPlayerTeamKey(player: V2PlayerState): 'home' | 'away' {
    return player.side;
}
