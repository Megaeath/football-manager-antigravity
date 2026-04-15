import { clampToField, getDistance } from '../formation';
import type { RoleIntent } from '../types2d';
import type { SpecialistInput, SpecialistModule } from './types';
import { applyRoleCorridor } from './corridors';

function getSupportPocketY(roleY: number, ballY: number, position: string): number {
    const channelBias = position.includes('R') ? 6 : position.includes('L') ? -6 : 0;
    return roleY * 0.55 + ballY * 0.45 + channelBias;
}

const forwardSpecialist: SpecialistModule = {
    generateIntent(input: SpecialistInput): RoleIntent {
        const { player, team, phaseState, ball, rolePosition, teamContext } = input;
        const inPossession = phaseState === 'IN_POSSESSION';
        const isOnBall = phaseState === 'ON_BALL';
        const ballDistance = getDistance(player.position2D, ball.position);

        if (inPossession || isOnBall) {
            const ballIsDeeper = team === 'home'
                ? ball.position.x < rolePosition.x - 8
                : ball.position.x > rolePosition.x + 8;
            const receivePocketX = team === 'home'
                ? Math.max(rolePosition.x - 14, ball.position.x + 4)
                : Math.min(rolePosition.x + 14, ball.position.x - 4);
            const linePinX = team === 'home'
                ? Math.max(rolePosition.x, ball.position.x + 9)
                : Math.min(rolePosition.x, ball.position.x - 9);
            const targetX = !isOnBall && ballIsDeeper ? receivePocketX : linePinX;
            const targetY = getSupportPocketY(rolePosition.y, ball.position.y, player.position);

            return {
                job: isOnBall ? 'SUPPORT' : 'ATTACK',
                targetPosition: applyRoleCorridor(clampToField({
                    x: targetX,
                    y: targetY,
                }), 'ST', team, phaseState),
                priority: isOnBall ? 90 : ballIsDeeper ? 84 : teamContext.scoreState?.isTrailing ? 88 : 82,
                utilityScore: isOnBall ? 86 : ballIsDeeper ? 83 : 82,
                context: isOnBall
                    ? 'ST hold-up / finish zone'
                    : ballIsDeeper
                        ? 'FW drops short into receive pocket'
                        : 'FW pin line + channel run',
                intensity: isOnBall ? 82 : ballIsDeeper ? 72 : 78,
                confidence: 0.83,
            };
        }

        const pressDepthX = team === 'home'
            ? Math.max(rolePosition.x - 24, ball.position.x - 7)
            : Math.min(rolePosition.x + 24, ball.position.x + 7);
        const pressY = rolePosition.y * 0.5 + ball.position.y * 0.5;

        return {
            job: 'PRESS',
            targetPosition: applyRoleCorridor(clampToField({ x: pressDepthX, y: pressY }), 'ST', team, phaseState),
            priority: ballDistance < 16 ? 82 : 75,
            utilityScore: ballDistance < 16 ? 78 : 73,
            context: 'FW drops deeper to press and collect second balls',
            intensity: ballDistance < 16 ? 82 : 74,
            confidence: 0.78,
        };
    },
};

export default forwardSpecialist;
