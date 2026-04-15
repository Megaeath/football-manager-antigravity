import type { RoleIntent, V2PlayerState } from '../types2d';
import goalkeeperSpecialist from './goalkeeper';
import defenderSpecialist from './defender';
import midfielderSpecialist from './midfielder';
import attackingSpecialist from './attacking';
import forwardSpecialist from './forward';
import type { SpecialistInput } from './types';

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

    if (bucket === 'GK') return goalkeeperSpecialist.generateIntent(input);
    if (bucket === 'DEF') return defenderSpecialist.generateIntent(input);
    if (bucket === 'MID') return midfielderSpecialist.generateIntent(input);
    if (bucket === 'ATT') return attackingSpecialist.generateIntent(input);
    return forwardSpecialist.generateIntent(input);
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
