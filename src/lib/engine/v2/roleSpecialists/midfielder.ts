import { clampToField, getDistance } from '../formation';
import type { RoleIntent } from '../types2d';
import type { SpecialistInput, SpecialistModule } from './types';
import { applyRoleCorridor } from './corridors';

function getOpenLaneTarget(
    rolePosition: { x: number; y: number },
    ball: { x: number; y: number },
    opponents: SpecialistInput['opponents'],
    team: 'home' | 'away',
): { x: number; y: number } {
    const nearestOpponent = opponents.reduce<{ x: number; y: number } | null>((best, candidate) => {
        if (!best) return candidate.position2D;
        const bestDist = Math.hypot(rolePosition.x - best.x, rolePosition.y - best.y);
        const candDist = Math.hypot(rolePosition.x - candidate.position2D.x, rolePosition.y - candidate.position2D.y);
        return candDist < bestDist ? candidate.position2D : best;
    }, null);

    const supportX = team === 'home'
        ? Math.max(rolePosition.x - 2, ball.x + 5)
        : Math.min(rolePosition.x + 2, ball.x - 5);

    if (!nearestOpponent) {
        return { x: supportX, y: (rolePosition.y + ball.y) / 2 };
    }

    const lateralEscape = rolePosition.y >= nearestOpponent.y ? 6 : -6;
    return {
        x: supportX,
        y: rolePosition.y * 0.6 + ball.y * 0.4 + lateralEscape,
    };
}

const midfielderSpecialist: SpecialistModule = {
    generateIntent(input: SpecialistInput): RoleIntent {
        const { player, team, phaseState, ball, teamContext, rolePosition, opponents } = input;
        const inPossession = phaseState === 'IN_POSSESSION';
        const isOnBall = phaseState === 'ON_BALL';
        const isDmc = player.position === 'DMC' || player.position === 'DML' || player.position === 'DMR';
        const corridorBucket = isDmc ? 'DMC' : 'CM';
        const toBall = getDistance(player.position2D, ball.position);

        if (phaseState === 'DEFENDING' && toBall < (isDmc ? 10 : 13)) {
            const pressTarget = isDmc
                ? { x: ball.position.x + (team === 'home' ? -8 : 8), y: ball.position.y }
                : { ...ball.position };
            return {
                job: 'PRESS',
                targetPosition: applyRoleCorridor(clampToField(pressTarget), corridorBucket, team, phaseState),
                priority: 84,
                utilityScore: 80,
                context: isDmc ? 'DMC shield/press trigger' : 'CM press trigger',
                intensity: 74,
                confidence: 0.82,
            };
        }

        const supportXShift = inPossession || isOnBall
            ? (team === 'home' ? 6 : -6)
            : (team === 'home' ? -3 : 3);

        const openLaneTarget = getOpenLaneTarget(rolePosition, ball.position, opponents, team);

        const supportTarget = isDmc
            ? {
                x: rolePosition.x + (phaseState === 'DEFENDING' ? (team === 'home' ? -2 : 2) : supportXShift * 0.5),
                y: (rolePosition.y * 0.7) + (ball.position.y * 0.3),
            }
            : {
                x: openLaneTarget.x + supportXShift * 0.25,
                y: openLaneTarget.y,
            };

        return {
            job: isOnBall ? 'SUPPORT' : inPossession ? 'SUPPORT' : 'DEFEND',
            targetPosition: applyRoleCorridor(clampToField(supportTarget), corridorBucket, team, phaseState),
            priority: isOnBall ? 78 : inPossession ? 74 : 72,
            utilityScore: isOnBall ? 79 : inPossession ? 76 : 74,
            context: isOnBall
                ? `${isDmc ? 'DMC' : 'CM'} recycle/through decision`
                : inPossession
                    ? `Mid finds open support lane (${teamContext.transitionMode || 'SETTLED'})`
                    : 'Mid block coverage',
            intensity: isOnBall ? 66 : inPossession ? 62 : 64,
            confidence: 0.8,
        };
    },
};

export default midfielderSpecialist;
