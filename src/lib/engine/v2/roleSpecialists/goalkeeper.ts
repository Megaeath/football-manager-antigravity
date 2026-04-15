import { clampToField } from '../formation';
import { FIELD } from '../config';
import type { RoleIntent } from '../types2d';
import type { SpecialistInput, SpecialistModule } from './types';
import { applyRoleCorridor } from './corridors';

const goalkeeperSpecialist: SpecialistModule = {
    generateIntent(input: SpecialistInput): RoleIntent {
        const { team, phaseState, ball, teamContext, rolePosition } = input;
        const isDefending = phaseState === 'DEFENDING';
        const isOnBall = phaseState === 'ON_BALL';

        const baseX = team === 'home' ? 5 : 95;
        const defendDepth = teamContext.lineHeight < 45 ? 8 : 11;
        const sweepDepth = teamContext.pressure > 65 ? 16 : 13;
        const targetX = isDefending ? defendDepth : isOnBall ? 7 : sweepDepth;

        const x = team === 'home'
            ? Math.max(2, Math.min(20, targetX))
            : Math.max(80, Math.min(98, 100 - targetX));

        const yFollow = ball.position.y;
        const y = Math.max(
            FIELD.WIDTH / 2 - FIELD.PENALTY_AREA.WIDTH / 2,
            Math.min(FIELD.WIDTH / 2 + FIELD.PENALTY_AREA.WIDTH / 2, yFollow),
        );

        const corridorTarget = applyRoleCorridor(clampToField({ x, y }), 'GK', team, phaseState);

        return {
            job: isOnBall ? 'SUPPORT' : isDefending ? 'DEFEND' : 'POSITION',
            targetPosition: corridorTarget,
            priority: isOnBall ? 72 : isDefending ? 82 : 62,
            utilityScore: isOnBall ? 74 : isDefending ? 86 : 68,
            context: isDefending
                ? `GK angle play (base=${baseX.toFixed(0)})`
                : isOnBall
                    ? `GK on-ball outlet (${rolePosition.x.toFixed(0)})`
                    : `GK outlet support from ${rolePosition.x.toFixed(0)}`,
            intensity: isOnBall ? 52 : isDefending ? 72 : 45,
            confidence: 0.88,
        };
    },
};

export default goalkeeperSpecialist;
