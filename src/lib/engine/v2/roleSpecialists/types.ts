import type { PlayerPhaseState, RoleIntent, SpatialPosition, TeamContext, V2BallState, V2PlayerState } from '../types2d';

export type SpecialistTeamKey = 'home' | 'away';

export interface SpecialistInput {
    player: V2PlayerState;
    team: SpecialistTeamKey;
    phaseState: PlayerPhaseState;
    teamContext: TeamContext;
    teammates: V2PlayerState[];
    opponents: V2PlayerState[];
    ball: V2BallState;
    rolePosition: SpatialPosition;
}

export interface SpecialistModule {
    generateIntent(input: SpecialistInput): RoleIntent;
}
