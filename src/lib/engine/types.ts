export type Position =
    | 'GK'
    | 'DR' | 'DL' | 'DC'
    | 'DMR' | 'DML' | 'DMC'
    | 'MR' | 'ML' | 'MC'
    | 'AMR' | 'AML' | 'AMC'
    | 'FWR' | 'FWL' | 'FWC';

export interface PlayerAttributes {
    // Technical
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
    throw: number;

    // Mental
    aggression: number;
    positioning: number;
    vision: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    composure: number;

    // Physical
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    balance: number;
}

export interface PlayerState {
    id: string;
    name: string;
    position: Position;
    attributes: PlayerAttributes;
    condition: number; // 0-100
    morale: number;    // 0-100
    exp: number;       // Total accumulated EXP (0-1000)
    tacticalPosition: string | null; // e.g. "GK", "FW_L"
    playerRole?: string | null; // e.g. "PLAYMAKER", "TARGET_MAN"
    attackingRolePreset?: string | null;
    defensiveRolePreset?: string | null;
    cards: { yellow: number; red: number };
    stats: { goals: number; assists: number; tackles: number; passes: number };
    isInjured?: boolean;
    isSuspended?: boolean;
}

export interface TeamState {
    id: string;
    name: string;
    players: PlayerState[];
    tactics: {
        formation: string;
        mentality: string;
        passing: string;
        tackling: string;
        attacking_focus: string;
        creative_freedom: string;
    };
    tacticalPlans?: {
        normal: {
            formation: string;
            mentality: string;
            passing: string;
            tackling: string;
            attacking_focus: string;
            creative_freedom: string;
        };
        behind: {
            formation: string;
            mentality: string;
            passing: string;
            tackling: string;
            attacking_focus: string;
            creative_freedom: string;
        };
        leading: {
            formation: string;
            mentality: string;
            passing: string;
            tackling: string;
            attacking_focus: string;
            creative_freedom: string;
        };
    };
}

export interface EnginePlayerMatchStats {
    playerId: string;
    name: string;
    teamId: string;
    position: Position;

    rating: number;
    minutes: number;
    goals: number;
    assists: number;
    saves: number;

    passesAttempted: number;
    passesCompleted: number;
    crossesAttempted: number;
    crossesCompleted: number;
    shots: number;
    shotsOnTarget: number;
    tacklesAttempted: number;
    tacklesWon: number;
    dribblesAttempted: number;
    dribblesWon: number;
    fitnessEnd: number; // 0-100 end-of-match fitness
    defensiveThirdTouches: number;
    middleThirdTouches: number;
    attackingThirdTouches: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    freeKicks: number;
    corners: number;
    throws: number;
    offsides: number;

}

export interface PlayerActionLog {
    playerId: string;
    teamId: string;
    minute: number;
    ballPosition: number;
    zone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING';
    actionType: 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT' | 'TACKLE' | 'SAVE' | 'INTERCEPTION' | 'FOUL';
    result: 'SUCCESS' | 'FAIL' | 'GOAL' | 'SAVED' | 'BLOCKED' | 'OFF_TARGET';
    isSuccessful: boolean;
    expectedSuccessRate?: number;
    targetPlayerId?: string;
    metadata?: string;
}

export interface TeamMatchStats {
    possession: number;
    corners: number;
    offsides: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    shots: number;
    shotsOnTarget: number;
    passesAttempted: number;
    passesCompleted: number;
    crossesAttempted: number;
    crossesCompleted: number;
    freeKicks: number;
    throws: number;
}


export interface MatchState {
    minute: number;
    homeScore: number;
    awayScore: number;
    homeTeamId: string;
    awayTeamId: string;
    teamStats: { home: TeamMatchStats; away: TeamMatchStats };
    events: MatchEventLog[];
    actionLogs: PlayerActionLog[];
    isFinished: boolean;
    playerStats: Record<string, EnginePlayerMatchStats>;
}

export interface MatchEventLog {
    minute: number;
    text: string;
    type: string;
    teamId?: string;
    playerId?: string;
}

// ============ MATCH PREP CONFIG ============

export type NeutralizationIntensity = 'MODERATE' | 'TIGHT';
export type PressCommitment = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';
export type FieldZone = 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING';
export type TransitionSpeed = 'HOLD' | 'QUICK' | 'DIRECT';
export type RecoveryUrgency = 'URGENT' | 'CONTROLLED';

export interface NeutralizationConfig {
    targetPlayerIds: string[];  // Up to 3 players
    intensity: NeutralizationIntensity;
}

export interface PressTrapConfig {
    commitment: PressCommitment;
    triggerZones: FieldZone[];  // Which zones to activate press traps
}

export interface TransitionRulesConfig {
    defenseToAttack: TransitionSpeed;   // When winning ball back
    attackToDefense: RecoveryUrgency;   // When losing possession
}

export interface MatchPrepConfig {
    neutralization?: NeutralizationConfig;
    pressTrap?: PressTrapConfig;
    transitionRules?: TransitionRulesConfig;
}

// Runtime state during match simulation
export interface ActiveMatchPrep {
    home: MatchPrepConfig | null;
    away: MatchPrepConfig | null;
}
