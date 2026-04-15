import { clampToField } from '../formation';
import type { RoleIntent } from '../types2d';
import type { SpecialistInput, SpecialistModule } from './types';
import { applyRoleCorridor } from './corridors';

function isWide(position: string): boolean {
    return position.includes('R') || position.includes('L');
}

const attackingSpecialist: SpecialistModule = {
    generateIntent(input: SpecialistInput): RoleIntent {
        const { player, team, phaseState, ball, rolePosition } = input;
        const inPossession = phaseState === 'IN_POSSESSION';
        const isOnBall = phaseState === 'ON_BALL';
        const wide = isWide(player.position);
        const isAmc = player.position === 'AMC' || player.position === 'AMR' || player.position === 'AML';
        const corridorBucket = wide ? (player.position.startsWith('M') ? 'WM' : 'WINGER') : 'AMC';

        if (inPossession || isOnBall) {
            const dropToLink = isAmc && (team === 'home'
                ? ball.position.x < rolePosition.x - 6
                : ball.position.x > rolePosition.x + 6);
            const targetX = dropToLink
                ? (team === 'home'
                    ? Math.max(rolePosition.x - 10, ball.position.x + 4)
                    : Math.min(rolePosition.x + 10, ball.position.x - 4))
                : (team === 'home'
                    ? Math.max(rolePosition.x, ball.position.x + (isAmc ? 4 : 7))
                    : Math.min(rolePosition.x, ball.position.x - (isAmc ? 4 : 7)));
            const targetY = wide
                ? (player.position.includes('R') ? 80 : 20)
                : isAmc
                    ? (rolePosition.y * 0.6 + ball.position.y * 0.4)
                    : (rolePosition.y + ball.position.y) / 2;

            return {
                job: isOnBall ? 'SUPPORT' : 'ATTACK',
                targetPosition: applyRoleCorridor(clampToField({ x: targetX, y: targetY }), corridorBucket, team, phaseState),
                priority: isOnBall ? 82 : 79,
                utilityScore: isOnBall ? 81 : 78,
                context: isAmc
                    ? (isOnBall ? 'AMC killer-pass platform' : dropToLink ? 'AMC drops between lines to link play' : 'AMC between-lines pocket')
                    : wide
                        ? 'Wide lane / half-space run'
                        : 'ATT support',
                intensity: isOnBall ? 74 : 70,
                confidence: 0.8,
            };
        }

        return {
            job: 'DEFEND',
            targetPosition: applyRoleCorridor(clampToField({
                x: team === 'home' ? rolePosition.x - 5 : rolePosition.x + 5,
                y: rolePosition.y,
            }), corridorBucket, team, phaseState),
            priority: 66,
            utilityScore: 64,
            context: isAmc ? 'AMC high press recovery' : 'Wide defensive recovery',
            intensity: 58,
            confidence: 0.76,
        };
    },
};

export default attackingSpecialist;
