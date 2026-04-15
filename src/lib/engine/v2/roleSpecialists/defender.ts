import { clampToField, getDistance } from '../formation';
import type { RoleIntent, V2PlayerState } from '../types2d';
import type { SpecialistInput, SpecialistModule } from './types';
import { applyRoleCorridor } from './corridors';

function nearestOpponent(player: V2PlayerState, opponents: V2PlayerState[]): V2PlayerState | null {
    if (opponents.length === 0) return null;
    return opponents.reduce((best, candidate) => {
        const cDist = getDistance(player.position2D, candidate.position2D);
        const bDist = getDistance(player.position2D, best.position2D);
        return cDist < bDist ? candidate : best;
    }, opponents[0]);
}

const defenderSpecialist: SpecialistModule = {
    generateIntent(input: SpecialistInput): RoleIntent {
        const { player, team, phaseState, ball, opponents, teamContext, rolePosition } = input;
        const isDefending = phaseState === 'DEFENDING';
        const isOnBall = phaseState === 'ON_BALL';
        const isFullBack = player.position === 'DR' || player.position === 'DL';
        const marker = nearestOpponent(player, opponents);

        const corridorBucket = isFullBack ? 'FB' : 'DC';

        if (isDefending && marker) {
            const d = getDistance(player.position2D, marker.position2D);
            if (d <= 9) {
                return {
                    job: 'MARK',
                    targetPosition: applyRoleCorridor(clampToField({
                        x: marker.position2D.x + (team === 'home' ? -2 : 2),
                        y: marker.position2D.y,
                    }), corridorBucket, team, phaseState),
                    priority: 85,
                    utilityScore: 82,
                    context: `Def mark ${marker.position}`,
                    markingTarget: marker.id,
                    intensity: 75,
                    confidence: 0.84,
                };
            }
        }

        const lineX = team === 'home'
            ? 8 + teamContext.lineHeight * 0.36
            : 92 - teamContext.lineHeight * 0.36;
        const ballIsAdvanced = team === 'home' ? ball.position.x >= 62 : ball.position.x <= 38;

        const roleShiftX = isFullBack
            ? (team === 'home'
                ? (phaseState === 'IN_POSSESSION' ? (ballIsAdvanced ? 18 : 10) : 2)
                : (phaseState === 'IN_POSSESSION' ? (ballIsAdvanced ? -18 : -10) : -2))
            : (team === 'home' ? (phaseState === 'IN_POSSESSION' ? 4 : 0) : (phaseState === 'IN_POSSESSION' ? -4 : 0));
        const touchlineBiasY = isFullBack
            ? (player.position === 'DR' ? 86 : 14)
            : rolePosition.y;
        const nearestPressure = marker && phaseState === 'IN_POSSESSION'
            ? (touchlineBiasY >= marker.position2D.y ? 5 : -5)
            : 0;
        const supportY = isFullBack
            ? (touchlineBiasY * 0.78 + ball.position.y * 0.22 + nearestPressure)
            : rolePosition.y + nearestPressure * 0.45;

        return {
            job: isOnBall ? 'SUPPORT' : 'DEFEND',
            targetPosition: applyRoleCorridor(
                clampToField({ x: lineX + roleShiftX, y: supportY }),
                corridorBucket,
                team,
                phaseState,
            ),
            priority: isDefending ? 80 : isOnBall ? 68 : 62,
            utilityScore: isDefending ? 78 : isOnBall ? 70 : 64,
            context: isDefending ? 'Def line hold' : isOnBall ? 'Def safe outlet' : isFullBack && ballIsAdvanced ? 'FB overlaps high to support attack' : 'Def steps into free passing lane',
            intensity: isDefending ? 66 : isOnBall ? 55 : 48,
            confidence: 0.8,
        };
    },
};

export default defenderSpecialist;
