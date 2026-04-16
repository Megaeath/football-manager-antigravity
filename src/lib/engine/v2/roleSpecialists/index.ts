import type { RoleIntent, V2PlayerState } from '../types2d';
import goalkeeperSpecialist from './goalkeeper';
import defenderSpecialist from './defender';
import midfielderSpecialist from './midfielder';
import attackingSpecialist from './attacking';
import forwardSpecialist from './forward';
import type { SpecialistInput } from './types';
import { getActiveRoleConfig } from '../roleMovementConfig';

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
            baseIntent = applyRoleMovementConfig(baseIntent, roleConfig, input.player);
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
    player: SpecialistInput['player'],
): RoleIntent {
    if (!roleConfig) return baseIntent;

    // If role has explicit X-range, bias target toward that range
    if (roleConfig.targetXRange) {
        const targetX = (roleConfig.targetXRange[0] + roleConfig.targetXRange[1]) / 2;
        baseIntent.targetPosition.x = baseIntent.targetPosition.x * 0.4 + targetX * 0.6; // Blend 60% role, 40% base
    }

    // If role has Y behavior, apply it
    if (roleConfig.yBehavior && typeof baseIntent.targetPosition.y === 'number') {
        if (roleConfig.yBehavior === 'center') {
            baseIntent.targetPosition.y = 50;
        } else if (roleConfig.yBehavior === 'hug_left') {
            baseIntent.targetPosition.y = 25;
        } else if (roleConfig.yBehavior === 'hug_right') {
            baseIntent.targetPosition.y = 75;
        } else if (roleConfig.yBehavior === 'half_width') {
            baseIntent.targetPosition.y = player.position === 'MR' || player.position === 'DR' || player.position === 'FWR' ? 75 : 25;
        }
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
