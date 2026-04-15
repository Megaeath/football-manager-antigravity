import { TUNING_PARAMS } from '../config';
import { clampToField } from '../formation';
import type { PlayerPhaseState, SpatialPosition } from '../types2d';

type TeamKey = 'home' | 'away';
type Corridor = { xMin: number; xMax: number; yMin: number; yMax: number };

type CorridorGroup = Record<PlayerPhaseState, Corridor>;

function mirrorForAway(corridor: Corridor): Corridor {
    return {
        xMin: 100 - corridor.xMax,
        xMax: 100 - corridor.xMin,
        yMin: corridor.yMin,
        yMax: corridor.yMax,
    };
}

function getCorridorOverflow(
    bucket: keyof typeof TUNING_PARAMS.roleCorridors,
    phaseState: PlayerPhaseState,
): { x: number; y: number } {
    if (bucket === 'GK' || phaseState === 'DEFENDING') {
        return { x: 0, y: 0 };
    }

    if (phaseState === 'ON_BALL') {
        if (bucket === 'ST' || bucket === 'WINGER' || bucket === 'AMC' || bucket === 'WM') {
            return { x: 14, y: 10 };
        }
        if (bucket === 'CM' || bucket === 'FB') {
            return { x: 10, y: 8 };
        }
        return { x: 7, y: 6 };
    }

    // IN_POSSESSION (off-ball support): moderate freedom beyond base corridor
    if (bucket === 'ST' || bucket === 'WINGER' || bucket === 'AMC' || bucket === 'WM') {
        return { x: 8, y: 6 };
    }
    if (bucket === 'CM' || bucket === 'FB') {
        return { x: 6, y: 5 };
    }
    return { x: 4, y: 4 };
}

function expandCorridor(corridor: Corridor, overflow: { x: number; y: number }): Corridor {
    return {
        xMin: Math.max(0, corridor.xMin - overflow.x),
        xMax: Math.min(100, corridor.xMax + overflow.x),
        yMin: Math.max(0, corridor.yMin - overflow.y),
        yMax: Math.min(100, corridor.yMax + overflow.y),
    };
}

function clampInCorridor(target: SpatialPosition, corridor: Corridor): SpatialPosition {
    return clampToField({
        x: Math.max(corridor.xMin, Math.min(corridor.xMax, target.x)),
        y: Math.max(corridor.yMin, Math.min(corridor.yMax, target.y)),
    });
}

export function applyRoleCorridor(
    target: SpatialPosition,
    bucket: keyof typeof TUNING_PARAMS.roleCorridors,
    team: TeamKey,
    phaseState: PlayerPhaseState,
): SpatialPosition {
    const group = TUNING_PARAMS.roleCorridors[bucket] as CorridorGroup;
    const homeCorridor = group[phaseState];
    const overflow = getCorridorOverflow(bucket, phaseState);
    const expandedHomeCorridor = expandCorridor(homeCorridor, overflow);
    const corridor = team === 'home' ? expandedHomeCorridor : mirrorForAway(expandedHomeCorridor);
    return clampInCorridor(target, corridor);
}
