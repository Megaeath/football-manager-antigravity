// ============================================================
// DEFENDER TACKLE BONUS
// ============================================================

/**
 * Defender tackle success bonus by role
 * Applied in match2d.ts when resolving tackle duels
 */
export const DEFENDER_TACKLE_BONUS: Record<string, number> = {
    DC: 0.5,   // Center Back
    DCR: 0.5,
    DCL: 0.5,
    DR: 0.5,   // Right Back
    DL: 0.5,   // Left Back
    FB: 0.5,   // Fullback (generic)
};

// ============================================================
// GOALKEEPER SAVE PROBABILITIES BY DISTANCE ZONE
// ============================================================

/**
 * Goalkeeper save probabilities and parameters by distance zone
 */
export const GK_SAVE_ZONES = {
    // Zone 1: Penalty Box (very close, 18m from goal)
    zone1_penaltyBox: {
        xThresholdHome: 82,
        xThresholdAway: 18,
        baseSaveChance: 0.35,
        skillBonus: 0.20,
        angleBonus: 0.25,
        simpleShot: 0.70,
    },
    // Zone 2: Free Kick Box (medium range, 26-35m)
    zone2_freeKickBox: {
        xThresholdHome: 68,
        xThresholdAway: 32,
        baseSaveChance: 0.60,
        skillBonus: 0.15,
        angleBonus: 0.20,
        simpleShot: 0.75,
    },
    // Zone 3: Distance (long range, 35m+)
    zone3_distance: {
        xThresholdHome: 0,
        xThresholdAway: 100,
        baseSaveChance: 0.92,
        skillBonus: 0.06,
        angleBonus: 0.08,
        simpleShot: 0.98,
    },
};

// ============================================================
// SHOT TARGET SELECTION (Y-AXIS BY SHOOTING SKILL)
// ============================================================

/**
 * Shot target selection probabilities by shooting skill
 */
export const SHOT_TARGET_SELECTION = {
    goalWidthHalf: 4,
    centerGoalY: 50,
    veryGood: {
        cornerChance: 0.35,
        midChance: 0.35,
        offTargetChance: 0.15,
        blastChance: 0.15,
    },
    normal: {
        cornerChance: 0.15,
        midChance: 0.50,
        offTargetChance: 0.20,
        blastChance: 0.15,
    },
    poor: {
        cornerChance: 0.05,
        midChance: 0.30,
        offTargetChance: 0.40,
        blastChance: 0.25,
    },
};

/**
 * Match Engine V2 - Configuration Constants
 * 
 * Centralized configuration for formation positions, movement AI weights,
 * set piece templates, and field dimensions.
 */

import type { SpatialPosition, MovementWeights, RoleMovementConfig } from './types2d';

// ============================================================
// FIELD DIMENSIONS
// ============================================================

/**
 * Field dimensions (normalized 0-100 in both axes)
 */
export const FIELD = {
    WIDTH: 100,        // Y-axis (touchline to touchline)
    LENGTH: 100,       // X-axis (goal to goal)
    
    // Display aspect ratio (real football pitch ~105m × 68m ≈ 3:2)
    ASPECT_RATIO: 1.5,  // Width:Height ratio for canvas rendering
    
    // Zones
    DEFENSIVE_THIRD: 30,   // X <= 30
    MIDDLE_THIRD: 70,      // 30 < X <= 70
    ATTACKING_THIRD: 100,  // X > 70
    
    // Penalty areas
    PENALTY_AREA: {
        WIDTH: 40,   // Y-axis width
        LENGTH: 18,  // X-axis depth
    },
    
    // Goal dimensions
    GOAL: {
        WIDTH: 8,    // Y-axis (between posts)
        HEIGHT: 3,   // Z-axis (ground to crossbar)
        POSITION_HOME: 0,    // X position
        POSITION_AWAY: 100,  // X position
    },
    SIX_YARD_BOX: {
        LENGTH: 6,
        WIDTH: 20,
    },
} as const;

// ============================================================
// FORMATION COORDINATE MAPPINGS
// ============================================================

/**
 * Starting positions for all formations
 * Coordinates represent resting position when ball is at center
 */
export const FORMATION_POSITIONS: Record<string, Record<string, SpatialPosition>> = {
    // ========================================
    // 4-4-2 Formation
    // ========================================
    '4-4-2': {
        // Goalkeeper
        'GK': { x: 4, y: 50 },
        
        // Back 4
        'DR': { x: 16, y: 84 },    // Right Back
        'DCR': { x: 14, y: 59 },   // Center Back Right
        'DCL': { x: 14, y: 41 },   // Center Back Left
        'DL': { x: 16, y: 16 },    // Left Back
        
        // Midfield 4
        'MR': { x: 41, y: 82 },    // Right Midfielder
        'MCR': { x: 38, y: 58 },   // Center Mid Right
        'MCL': { x: 38, y: 42 },   // Center Mid Left
        'ML': { x: 41, y: 18 },    // Left Midfielder
        
        // Forward 2
        'FWR': { x: 64, y: 56 },   // Right Forward
        'FWL': { x: 64, y: 44 },   // Left Forward
    },
    
    // ========================================
    // 4-3-3 Formation
    // ========================================
    '4-3-3': {
        // Goalkeeper
        'GK': { x: 4, y: 50 },
        
        // Back 4
        'DR': { x: 16, y: 84 },
        'DCR': { x: 14, y: 60 },
        'DCL': { x: 14, y: 40 },
        'DL': { x: 16, y: 16 },
        
        // Midfield 3
        'DMC': { x: 30, y: 50 },   // Defensive Mid (center)
        'MCR': { x: 43, y: 63 },   // Center Mid Right
        'MCL': { x: 43, y: 37 },   // Center Mid Left
        
        // Forward 3
        'FWC': { x: 62, y: 50 },   // Center Forward
        'FWR': { x: 59, y: 74 },   // Right Winger
        'FWL': { x: 59, y: 26 },   // Left Winger
    },
    
    // ========================================
    // 5-3-2 Formation
    // ========================================
    '5-3-2': {
        // Goalkeeper
        'GK': { x: 4, y: 50 },
        
        // Back 5
        'DR': { x: 18, y: 88 },    // Right Wing Back
        'DCR': { x: 14, y: 66 },   // Center Back Right
        'DC': { x: 12, y: 50 },    // Center Back Center
        'DCL': { x: 14, y: 34 },   // Center Back Left
        'DL': { x: 18, y: 12 },    // Left Wing Back
        
        // Midfield 3
        'MCR': { x: 39, y: 63 },
        'MC': { x: 36, y: 50 },
        'MCL': { x: 39, y: 37 },
        
        // Forward 2
        'FWR': { x: 61, y: 56 },
        'FWL': { x: 61, y: 44 },
    },
    
    // ========================================
    // 4-5-1 Formation
    // ========================================
    '4-5-1': {
        // Goalkeeper
        'GK': { x: 4, y: 50 },
        
        // Back 4
        'DR': { x: 16, y: 84 },
        'DCR': { x: 14, y: 60 },
        'DCL': { x: 14, y: 40 },
        'DL': { x: 16, y: 16 },
        
        // Midfield 5
        'MR': { x: 41, y: 86 },    // Wide Right
        'MCR': { x: 35, y: 65 },
        'MC': { x: 32, y: 50 },
        'MCL': { x: 35, y: 35 },
        'ML': { x: 41, y: 14 },    // Wide Left
        
        // Forward 1
        'FWC': { x: 61, y: 50 },   // Lone Striker
    },

    // ========================================
    // 3-4-3 Formation
    // ========================================
    '3-4-3': {
        'GK': { x: 4, y: 50 },
        'DCR': { x: 14, y: 66 },
        'DC': { x: 12, y: 50 },
        'DCL': { x: 14, y: 34 },
        'MR': { x: 39, y: 82 },
        'MCR': { x: 37, y: 60 },
        'MCL': { x: 37, y: 40 },
        'ML': { x: 39, y: 18 },
        'FWR': { x: 62, y: 74 },
        'FWC': { x: 65, y: 50 },
        'FWL': { x: 62, y: 26 },
    },

    // ========================================
    // 3-5-2 Formation
    // ========================================
    '3-5-2': {
        'GK': { x: 4, y: 50 },
        'DCR': { x: 14, y: 66 },
        'DC': { x: 12, y: 50 },
        'DCL': { x: 14, y: 34 },
        'MR': { x: 39, y: 84 },
        'MCR': { x: 37, y: 63 },
        'MC': { x: 34, y: 50 },
        'MCL': { x: 37, y: 37 },
        'ML': { x: 39, y: 16 },
        'FWR': { x: 62, y: 56 },
        'FWL': { x: 62, y: 44 },
    },

    // ========================================
    // 4-2-4 Formation
    // ========================================
    '4-2-4': {
        'GK': { x: 4, y: 50 },
        'DR': { x: 16, y: 84 },
        'DCR': { x: 14, y: 60 },
        'DCL': { x: 14, y: 40 },
        'DL': { x: 16, y: 16 },
        'MCR': { x: 35, y: 60 },
        'MCL': { x: 35, y: 40 },
        'FWR': { x: 62, y: 80 },
        'FWRC': { x: 64, y: 58 },
        'FWLC': { x: 64, y: 42 },
        'FWL': { x: 62, y: 20 },
    },

    // ========================================
    // 5-3-1 Formation
    // ========================================
    '5-3-1': {
        'GK': { x: 4, y: 50 },
        'DR': { x: 18, y: 88 },
        'DCR': { x: 14, y: 66 },
        'DC': { x: 12, y: 50 },
        'DCL': { x: 14, y: 34 },
        'DL': { x: 18, y: 12 },
        'MCR': { x: 37, y: 63 },
        'MC': { x: 34, y: 50 },
        'MCL': { x: 37, y: 37 },
        'AMC': { x: 50, y: 50 },
        'FWC': { x: 66, y: 50 },
    },

    // ========================================
    // 5-4-1 Formation
    // ========================================
    '5-4-1': {
        'GK': { x: 4, y: 50 },
        'DR': { x: 18, y: 88 },
        'DCR': { x: 14, y: 66 },
        'DC': { x: 12, y: 50 },
        'DCL': { x: 14, y: 34 },
        'DL': { x: 18, y: 12 },
        'MR': { x: 39, y: 84 },
        'MCR': { x: 35, y: 60 },
        'MCL': { x: 35, y: 40 },
        'ML': { x: 39, y: 16 },
        'FWC': { x: 63, y: 50 },
    },
};

// ============================================================
// MOVEMENT AI WEIGHTS
// ============================================================

/**
 * Base movement weights (sum should equal 1.0)
 */
export const BASE_MOVEMENT_WEIGHTS: MovementWeights = {
    ballAttraction: 0.4,   // Pull toward ball
    rolePosition: 0.3,     // Stay near tactical position
    spacing: 0.2,          // Avoid crowding teammates
    marking: 0.1,          // Man-marking pull
};

/**
 * Role-specific movement configurations
 */
export const ROLE_MOVEMENT_CONFIG: Record<string, RoleMovementConfig> = {
    // Goalkeeper - stays near goal
    'GOALKEEPER': {
        weights: { ballAttraction: 0.2, rolePosition: 0.7, spacing: 0.05, marking: 0.05 },
        maxDistanceFromRole: 18,  // Stays in penalty area
        ballAttractionRadius: 30,
    },
    
    // Defenders - hold position, man-mark
    'DEFENDER': {
        weights: { ballAttraction: 0.3, rolePosition: 0.4, spacing: 0.15, marking: 0.15 },
        maxDistanceFromRole: 25,
        ballAttractionRadius: 40,
    },
    
    // Midfielders - balanced
    'MIDFIELDER': {
        weights: { ballAttraction: 0.4, rolePosition: 0.3, spacing: 0.2, marking: 0.1 },
        maxDistanceFromRole: 35,
        ballAttractionRadius: 50,
    },
    
    // Forwards - chase ball, make runs
    'FORWARD': {
        weights: { ballAttraction: 0.5, rolePosition: 0.2, spacing: 0.25, marking: 0.05 },
        maxDistanceFromRole: 45,
        ballAttractionRadius: 60,
    },
    
    // Wingers - width maintenance
    'WINGER': {
        weights: { ballAttraction: 0.45, rolePosition: 0.25, spacing: 0.25, marking: 0.05 },
        maxDistanceFromRole: 40,
        ballAttractionRadius: 55,
    },
};

// ============================================================
// MOVEMENT SPEED CONSTANTS
// ============================================================

/**
 * Movement speeds (units per tick, pace-modified)
 */
export const MOVEMENT_SPEED = {
    STATIONARY: 0,
    WALKING: 1,      // Positional adjustments
    JOGGING: 3,      // Normal movement
    RUNNING: 5,      // Chasing ball
    SPRINTING: 8,    // Full pace (stamina drain)
    
    // Ball carrier speed reduction
    WITH_BALL_MODIFIER: 0.7,  // 70% of max speed when carrying ball
} as const;

/**
 * Pace -> top speed table (units/sec), tuned from gameplay reference sheet.
 * Keys are player pace attribute values (1..20).
 */
export const PACE_SPEED_TABLE: Record<number, number> = {
    1: 5.0,
    2: 5.5,
    3: 5.8,
    4: 6.0,
    5: 6.3,
    6: 6.5,
    7: 6.8,
    8: 7.0,
    9: 7.3,
    10: 7.5,
    11: 7.8,
    12: 8.0,
    13: 8.3,
    14: 8.5,
    15: 8.8,
    16: 9.0,
    17: 9.3,
    18: 9.5,
    19: 9.8,
    20: 10.0,
};

/**
 * Collision detection constants
 */
export const COLLISION = {
    MIN_PLAYER_DISTANCE: 2,   // Minimum distance between players (yards)
    TACKLE_RANGE: 3,          // Distance to attempt tackle
    PUSH_FORCE: 1.5,          // Separation force on collision
} as const;

// ============================================================
// SET PIECE TEMPLATES
// ============================================================

/**
 * Corner kick positioning templates
 */
export const CORNER_POSITIONS = {
    // Attacking team (near post run)
    ATTACKING_NEAR_POST: [
        { x: 92, y: 45 },  // Near post striker
        { x: 90, y: 55 },  // Central header
        { x: 88, y: 35 },  // Edge of box
        { x: 85, y: 50 },  // Late runner
    ],
    
    // Attacking team (far post run)
    ATTACKING_FAR_POST: [
        { x: 92, y: 55 },  // Far post striker
        { x: 90, y: 45 },  // Central header
        { x: 88, y: 65 },  // Edge of box
        { x: 85, y: 50 },  // Late runner
    ],
    
    // Defending team (zonal)
    DEFENDING_ZONAL: [
        { x: 90, y: 45 },  // Near post zone
        { x: 90, y: 50 },  // Central zone
        { x: 90, y: 55 },  // Far post zone
        { x: 87, y: 40 },  // Edge zone
        { x: 87, y: 60 },  // Edge zone
        { x: 94, y: 50 },  // Goal line
    ],
} as const;

/**
 * Free kick wall positioning
 */
export const FREE_KICK_WALL = {
    // Number of players in wall based on distance
    PLAYERS_BY_DISTANCE: {
        CLOSE: 5,    // < 25 yards
        MEDIUM: 3,   // 25-35 yards
        FAR: 0,      // > 35 yards (no wall)
    },
    
    // Wall distance from ball (FIFA rules: 10 yards)
    WALL_DISTANCE: 10,
} as const;

/**
 * Throw-in positioning
 */
export const THROW_IN_POSITIONS = {
    // Receivers spread along line
    RECEIVER_SPACING: 10,     // Yards between receivers
    MAX_RECEIVERS: 3,         // Number of players to position
    BACK_DISTANCE: 5,         // Distance back from thrower
} as const;

// ============================================================
// TACTICAL MODIFIERS
// ============================================================

/**
 * Mentality affects on positioning
 */
export const MENTALITY_POSITION_MODIFIERS = {
    'ALL_OUT_ATTACK': { xShift: 15, compactness: 0.8 },
    'ATTACKING': { xShift: 10, compactness: 0.9 },
    'NORMAL': { xShift: 0, compactness: 1.0 },
    'DEFENSIVE': { xShift: -10, compactness: 1.1 },
    'ULTRA_DEFENSIVE': { xShift: -15, compactness: 1.2 },
} as const;

/**
 * Pressing intensity affects movement
 */
export const PRESSING_INTENSITY = {
    HIGH: { ballAttractionBonus: 0.2, maxPressingDistance: 40 },
    MEDIUM: { ballAttractionBonus: 0.1, maxPressingDistance: 30 },
    LOW: { ballAttractionBonus: 0, maxPressingDistance: 20 },
} as const;

// ============================================================
// ANIMATION CONSTANTS
// ============================================================

/**
 * Canvas animation settings
 */
export const ANIMATION = {
    POSITION_TRANSITION_MS: 500,   // Smooth movement duration
    BALL_TRANSITION_MS: 300,       // Ball movement speed
    EVENT_FADE_MS: 2000,           // Event marker fade out
    
    // Playback speeds
    SPEED_MULTIPLIERS: [0.5, 1, 2, 5, 10] as const,
} as const;

// ============================================================
// PERFORMANCE OPTIMIZATION
// ============================================================

/**
 * Spatial grid for collision detection optimization
 */
export const SPATIAL_GRID = {
    CELL_SIZE: 10,              // Grid cell size (10x10 yards)
    CELLS_X: 10,                // 100 / 10
    CELLS_Y: 10,                // 100 / 10
} as const;

/**
 * Lazy update thresholds
 */
export const LAZY_UPDATE = {
    BALL_DISTANCE_THRESHOLD: 30,   // Don't update players > 30 yards from ball
    UPDATE_FREQUENCY: 1,            // Update every N ticks (1 = every tick)
} as const;

// ============================================================
// PHASE 7: TUNING PARAMETERS
// ============================================================

/**
 * Runtime tuning knobs for movement/decision/defense.
 * Keep values conservative to avoid replay instability.
 */
export const TUNING_PARAMS = {
    // Simulation cadence (strict spec: 10 ticks/min = 6 sec/tick)
    simulationTicksPerMinute: 10,
    movementTickSeconds: 6.0,
    // Hard anti-warp clamp (absolute max displacement for any player per tick)
    // Applies to normal movement + post-action safety clamp in match2d.
    maxPlayerDisplacementPerTick: 5.0,
    // Defender tackle bonus (applied in match2d)
    defenderTackleBonus: DEFENDER_TACKLE_BONUS,

    // Dribbling pace penalty (85% speed with ball)
    onBallSpeedMultiplier: 0.85,

    // Acceleration curve (time to reach top speed)
    accelerationTimeMinSec: 0.9,
    accelerationTimeMaxSec: 3.0,

    // Movement interpolation
    movementLerpX: 0.18,
    movementLerpY: 0.16,

    // Specialist intent blend (0=base intent only, 1=specialist only)
    specialistBlendWeight: 0.7,

    // Pass option selection
    passTopOptions: 5,
    passLaneWidth: 4,
    passShortDistanceThreshold: 18,
    passLaneBlockRadius: 2,
    passReceiverContestRadius: 2,
    longPassArrivalContestRadius: 2,

    // Defensive coordination
    coverOffsetX: 5,
    lineHoldClampHome: { min: 6, max: 44 },
    lineHoldClampAway: { min: 56, max: 94 },

    // Telemetry
    telemetryLogIntervalTicks: 300,
    telemetryPassSampleLimit: 160,

    // Carrier action cadence (evaluate every tick)
    actionDecisionIntervalTicks: 1,

    // Cooldown after major incidents (GOAL/SHOT/FOUL/CARDS) to keep replay readable
    majorEventCooldownTicks: 2,

    // Anti-collapse
    minTeammateDistance: 3.2,

    // Role/state corridors (home orientation; away mirrored on X)
    roleCorridors: {
        GK: {
            DEFENDING: { xMin: 1, xMax: 18, yMin: 30, yMax: 70 },
            IN_POSSESSION: { xMin: 4, xMax: 10, yMin: 44, yMax: 56 },
            ON_BALL: { xMin: 3, xMax: 12, yMin: 34, yMax: 66 },
        },
        DC: {
            DEFENDING: { xMin: 10, xMax: 40, yMin: 20, yMax: 80 },
            IN_POSSESSION: { xMin: 18, xMax: 36, yMin: 24, yMax: 76 },
            ON_BALL: { xMin: 18, xMax: 42, yMin: 20, yMax: 80 },
        },
        FB: {
            DEFENDING: { xMin: 10, xMax: 90, yMin: 5, yMax: 95 },
            IN_POSSESSION: { xMin: 25, xMax: 82, yMin: 5, yMax: 95 },
            ON_BALL: { xMin: 20, xMax: 90, yMin: 5, yMax: 95 },
        },
        DMC: {
            DEFENDING: { xMin: 22, xMax: 58, yMin: 24, yMax: 76 },
            IN_POSSESSION: { xMin: 30, xMax: 52, yMin: 32, yMax: 68 },
            ON_BALL: { xMin: 30, xMax: 62, yMin: 28, yMax: 72 },
        },
        CM: {
            DEFENDING: { xMin: 28, xMax: 66, yMin: 18, yMax: 82 },
            IN_POSSESSION: { xMin: 42, xMax: 72, yMin: 20, yMax: 80 },
            ON_BALL: { xMin: 38, xMax: 78, yMin: 20, yMax: 80 },
        },
        AMC: {
            DEFENDING: { xMin: 58, xMax: 78, yMin: 28, yMax: 72 },
            IN_POSSESSION: { xMin: 66, xMax: 88, yMin: 30, yMax: 70 },
            ON_BALL: { xMin: 62, xMax: 94, yMin: 28, yMax: 72 },
        },
        WM: {
            DEFENDING: { xMin: 34, xMax: 90, yMin: 5, yMax: 95 },
            IN_POSSESSION: { xMin: 52, xMax: 84, yMin: 5, yMax: 95 },
            ON_BALL: { xMin: 42, xMax: 90, yMin: 5, yMax: 95 },
        },
        WINGER: {
            DEFENDING: { xMin: 58, xMax: 84, yMin: 8, yMax: 92 },
            IN_POSSESSION: { xMin: 74, xMax: 94, yMin: 10, yMax: 90 },
            ON_BALL: { xMin: 64, xMax: 96, yMin: 10, yMax: 90 },
        },
        ST: {
            DEFENDING: { xMin: 54, xMax: 74, yMin: 28, yMax: 72 },
            IN_POSSESSION: { xMin: 78, xMax: 96, yMin: 24, yMax: 76 },
            ON_BALL: { xMin: 68, xMax: 98, yMin: 24, yMax: 76 },
        },
    },

    // Role-specific shot realism gates
    shotMinXHomeByRole: {
        GK: 96,
        DC: 90,
        DR: 82,
        DL: 82,
        DMC: 76,
        DMR: 74,
        DML: 74,
        MC: 68,
        MR: 64,
        ML: 64,
        AMC: 56,
        AMR: 60,
        AML: 60,
        FWR: 44,
        FWL: 44,
        FWC: 46,
    },

    // Pass realism
    passErrorBase: 0.06,
    passErrorPressureWeight: 0.22,
    passErrorDistanceWeight: 0.16,
    passErrorReceiverCrowdedWeight: 0.18,

    // Dribble / pressure realism
    dribblePressureRadius: 2,
    dribbleLookAheadDistance: 10,
    dribbleLaneHalfWidth: 3,
    dribbleStepNoPressure: 4.8,
    dribbleStepUnderPressure: 2.2,

    // Receiver-space realism
    receiverOpenSpaceRadius: 5,
    receiverContestMinRadius: 2,
    receiverContestMaxRadius: 5,

    // Byline cross behavior
    crossBylineXHome: 94,
    crossBylineXAway: 6,
    crossWideYThreshold: 22,
    crossChanceNearByline: 0.62,
} as const;
