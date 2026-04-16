/**
 * Role Movement Config — Single source of truth for V2 spatial movement biases.
 *
 * Each role key maps to a RoleMovementConfig that specialist modules read to
 * override/blend the base target X/Y for that tick.
 *
 * TUNING GUIDE:
 *  - targetXRange: [min, max] — the X corridor this role should occupy (0=own goal, 100=opp goal)
 *  - yBehavior:
 *      'track_ball'  — Y slides toward ball Y (strength controlled by yTrackStrength)
 *      'hug_left'    — stay near Y:5 (left touchline for home / right for away)
 *      'hug_right'   — stay near Y:95
 *      'center'      — aim for Y:50
 *      'half_width'  — aim for Y:25 or Y:75 (position-dependent; specialist decides left/right)
 *      'free'        — no Y bias, keep existing position
 *  - yTrackStrength: 0-1 (how tightly Y chases ball Y; 0=ignore, 1=mirror)
 *  - pressRadius: units from ball carrier before this role triggers pressing behavior
 *  - carryForwardBias: 0-1 tendency to dribble/carry upfield when on ball
 *  - holdLineX: if set, role anchors at this X even when ball is nearby (e.g. Anchor Man)
 *  - markingRadius: if set, role tries to man-mark nearest opponent within this radius
 */

export interface RoleMovementConfig {
  /** X coordinate range [min, max] this role occupies (0-100) */
  targetXRange: [number, number];
  /** Y positioning style */
  yBehavior: 'track_ball' | 'hug_left' | 'hug_right' | 'center' | 'half_width' | 'free';
  /** How strongly Y tracks ball Y (0=ignore, 1=tight) */
  yTrackStrength: number;
  /** Distance from ball carrier that triggers pressing behavior */
  pressRadius: number;
  /** Tendency to carry ball forward when on-ball (0=pass immediately, 1=dribble forward) */
  carryForwardBias: number;
  /** If set, role anchors at this X regardless of ball position */
  holdLineX?: number;
  /** If set, role tries to close within this radius of the nearest opponent */
  markingRadius?: number;
}

// ─────────────────────────────────────────────
//  GOALKEEPER
// ─────────────────────────────────────────────

/** GK attacking role: stay deep, long kicks upfield */
export const ROLE_CONFIG_traditional_distributor: RoleMovementConfig = {
  targetXRange: [2, 5],
  yBehavior: 'center',
  yTrackStrength: 0.1,
  pressRadius: 999, // GK never presses outfield
  carryForwardBias: 0.05,
};

/** GK attacking role: push up as extra CB in build-up */
export const ROLE_CONFIG_sweeper_support: RoleMovementConfig = {
  targetXRange: [15, 22],
  yBehavior: 'track_ball',
  yTrackStrength: 0.4,
  pressRadius: 999,
  carryForwardBias: 0.2,
};

/** GK defending role: hug goal line, angle narrowing */
export const ROLE_CONFIG_line_keeper: RoleMovementConfig = {
  targetXRange: [1, 3],
  yBehavior: 'track_ball',
  yTrackStrength: 0.9, // follow ball Y tightly for angle closing
  pressRadius: 999,
  carryForwardBias: 0.0,
  holdLineX: 2,
};

/** GK defending role: sweeper/libero — intercept through balls */
export const ROLE_CONFIG_sweeper_defender: RoleMovementConfig = {
  targetXRange: [10, 15],
  yBehavior: 'track_ball',
  yTrackStrength: 0.6,
  pressRadius: 25, // will charge out to intercept long balls
  carryForwardBias: 0.0,
};

// ─────────────────────────────────────────────
//  CENTER BACK (DC)
// ─────────────────────────────────────────────

/** DC attacking: anchor point, safe distribution */
export const ROLE_CONFIG_safe_passer: RoleMovementConfig = {
  targetXRange: [25, 35],
  yBehavior: 'half_width',
  yTrackStrength: 0.2,
  pressRadius: 15,
  carryForwardBias: 0.05,
};

/** DC attacking: ball-playing CB, drives forward */
export const ROLE_CONFIG_ball_carrier: RoleMovementConfig = {
  targetXRange: [45, 55],
  yBehavior: 'track_ball',
  yTrackStrength: 0.35,
  pressRadius: 10,
  carryForwardBias: 0.5,
};

/** DC defending: aggressive stopper, tight marking */
export const ROLE_CONFIG_stopper: RoleMovementConfig = {
  targetXRange: [18, 30],
  yBehavior: 'track_ball',
  yTrackStrength: 0.8,
  pressRadius: 8,
  carryForwardBias: 0.0,
  markingRadius: 10,
};

/** DC defending: coverage/sweeper behind stopper */
export const ROLE_CONFIG_cover: RoleMovementConfig = {
  targetXRange: [15, 22],
  yBehavior: 'track_ball',
  yTrackStrength: 0.5,
  pressRadius: 15,
  carryForwardBias: 0.0,
};

// ─────────────────────────────────────────────
//  FULL BACK (DL / DR)
// ─────────────────────────────────────────────

/** FB attacking: invert into midfield rather than overlapping */
export const ROLE_CONFIG_inverted_back: RoleMovementConfig = {
  targetXRange: [45, 100],
  yBehavior: 'half_width', // y:30 (left) or y:70 (right), specialist resolves
  yTrackStrength: 0.3,
  pressRadius: 12,
  carryForwardBias: 0.3,
};

/** FB attacking: overlap high up the flank */
export const ROLE_CONFIG_wing_back: RoleMovementConfig = {
  targetXRange: [70, 100],
  yBehavior: 'hug_left', // specialist swaps to hug_right for DR
  yTrackStrength: 0.2,
  pressRadius: 12,
  carryForwardBias: 0.55,
};

/** FB defending: hold defensive line, contain winger */
export const ROLE_CONFIG_defensive_fullback: RoleMovementConfig = {
  targetXRange: [20, 30],
  yBehavior: 'hug_left', // specialist swaps for DR
  yTrackStrength: 0.2,
  pressRadius: 10,
  carryForwardBias: 0.05,
  markingRadius: 12,
};

/** FB defending: sprint back, clear everything */
export const ROLE_CONFIG_no_nonsense_fullback: RoleMovementConfig = {
  targetXRange: [15, 22],
  yBehavior: 'hug_left',
  yTrackStrength: 0.15,
  pressRadius: 8,
  carryForwardBias: 0.0,
  markingRadius: 8,
};

// ─────────────────────────────────────────────
//  CENTRAL MIDFIELD (DMC / MC / AMC)
// ─────────────────────────────────────────────

/** DMC/MC attacking: quarterback distributor, stays deep */
export const ROLE_CONFIG_deep_lying_playmaker: RoleMovementConfig = {
  targetXRange: [35, 60],
  yBehavior: 'track_ball',
  yTrackStrength: 0.4,
  pressRadius: 20,
  carryForwardBias: 0.1,
};

/** MC attacking: box-to-box engine, late runs into box */
export const ROLE_CONFIG_box_to_box: RoleMovementConfig = {
  targetXRange: [40, 80],
  yBehavior: 'track_ball',
  yTrackStrength: 0.45,
  pressRadius: 14,
  carryForwardBias: 0.35,
};

/** AMC attacking: shadow striker / advanced playmaker */
export const ROLE_CONFIG_shadow_striker: RoleMovementConfig = {
  targetXRange: [65, 75],
  yBehavior: 'track_ball',
  yTrackStrength: 0.55,
  pressRadius: 10,
  carryForwardBias: 0.4,
};

/** DMC defending: protective screen, does NOT chase wide */
export const ROLE_CONFIG_anchor_man: RoleMovementConfig = {
  targetXRange: [30, 35],
  yBehavior: 'track_ball',
  yTrackStrength: 0.6,
  pressRadius: 18,
  carryForwardBias: 0.0,
  holdLineX: 32,
};

/** DMC/MC defending: aggressive ball winner, roams */
export const ROLE_CONFIG_ball_winning_mid: RoleMovementConfig = {
  targetXRange: [30, 60],
  yBehavior: 'track_ball',
  yTrackStrength: 0.7,
  pressRadius: 10,
  carryForwardBias: 0.05,
};

/** AMC defending: counter-press trigger in high line */
export const ROLE_CONFIG_enganche_presser: RoleMovementConfig = {
  targetXRange: [60, 100],
  yBehavior: 'track_ball',
  yTrackStrength: 0.7,
  pressRadius: 8,
  carryForwardBias: 0.0,
};

// ─────────────────────────────────────────────
//  WIDE MIDFIELD (ML / MR)
// ─────────────────────────────────────────────

/** ML/MR attacking: traditional winger, hug line and cross */
export const ROLE_CONFIG_traditional_winger: RoleMovementConfig = {
  targetXRange: [70, 100],
  yBehavior: 'hug_left', // specialist swaps to hug_right for MR
  yTrackStrength: 0.15,
  pressRadius: 20,
  carryForwardBias: 0.6,
};

/** ML/MR attacking: inside forward, cut inside to shoot */
export const ROLE_CONFIG_inside_forward: RoleMovementConfig = {
  targetXRange: [65, 100],
  yBehavior: 'half_width', // cuts inside toward Y:35 or Y:65
  yTrackStrength: 0.3,
  pressRadius: 18,
  carryForwardBias: 0.5,
};

/** ML/MR attacking: wide playmaker, tuck inside to create */
export const ROLE_CONFIG_wide_playmaker: RoleMovementConfig = {
  targetXRange: [50, 100],
  yBehavior: 'half_width',
  yTrackStrength: 0.35,
  pressRadius: 20,
  carryForwardBias: 0.2,
};

/** ML/MR defending: track back, double-up on fullback */
export const ROLE_CONFIG_wide_midfielder: RoleMovementConfig = {
  targetXRange: [30, 100],
  yBehavior: 'hug_left',
  yTrackStrength: 0.2,
  pressRadius: 10,
  carryForwardBias: 0.05,
  markingRadius: 14,
};

/** ML/MR defending: high press, counter outlet */
export const ROLE_CONFIG_high_presser: RoleMovementConfig = {
  targetXRange: [55, 100],
  yBehavior: 'track_ball',
  yTrackStrength: 0.5,
  pressRadius: 10,
  carryForwardBias: 0.1,
};

// ─────────────────────────────────────────────
//  CENTER FORWARD (FWC / ST)
// ─────────────────────────────────────────────

/** ST attacking: pin high, run in behind */
export const ROLE_CONFIG_advanced_forward: RoleMovementConfig = {
  targetXRange: [82, 100],
  yBehavior: 'track_ball',
  yTrackStrength: 0.4,
  pressRadius: 25,
  carryForwardBias: 0.7,
};

/** ST attacking: target man, hold-up and lay off */
export const ROLE_CONFIG_target_man: RoleMovementConfig = {
  targetXRange: [75, 100],
  yBehavior: 'center',
  yTrackStrength: 0.3,
  pressRadius: 20,
  carryForwardBias: 0.2,
  markingRadius: 5, // stay tight against DC to win headers
};

/** ST attacking: false 9, drops deep to link play */
export const ROLE_CONFIG_false_9: RoleMovementConfig = {
  targetXRange: [65, 100],
  yBehavior: 'track_ball',
  yTrackStrength: 0.5,
  pressRadius: 25,
  carryForwardBias: 0.3,
};

/** ST defending: pressing forward, chase DC/GK */
export const ROLE_CONFIG_pressing_forward: RoleMovementConfig = {
  targetXRange: [60, 100], // opponent's build-up zone (mirrored to opp coords in specialist)
  yBehavior: 'track_ball',
  yTrackStrength: 0.7,
  pressRadius: 12,
  carryForwardBias: 0.0,
};

/** ST defending: poacher/poised, wait for counter */
export const ROLE_CONFIG_poacher: RoleMovementConfig = {
  targetXRange: [55, 100],
  yBehavior: 'track_ball',
  yTrackStrength: 0.4,
  pressRadius: 30, // doesn't press actively
  carryForwardBias: 0.1,
  holdLineX: 60,
};

// ─────────────────────────────────────────────
//  LOOKUP MAP — role key → config
// ─────────────────────────────────────────────

export const ROLE_MOVEMENT_CONFIGS: Record<string, RoleMovementConfig> = {
  traditional_distributor: ROLE_CONFIG_traditional_distributor,
  sweeper_support: ROLE_CONFIG_sweeper_support,
  line_keeper: ROLE_CONFIG_line_keeper,
  sweeper_defender: ROLE_CONFIG_sweeper_defender,
  safe_passer: ROLE_CONFIG_safe_passer,
  ball_carrier: ROLE_CONFIG_ball_carrier,
  stopper: ROLE_CONFIG_stopper,
  cover: ROLE_CONFIG_cover,
  inverted_back: ROLE_CONFIG_inverted_back,
  wing_back: ROLE_CONFIG_wing_back,
  defensive_fullback: ROLE_CONFIG_defensive_fullback,
  no_nonsense_fullback: ROLE_CONFIG_no_nonsense_fullback,
  deep_lying_playmaker: ROLE_CONFIG_deep_lying_playmaker,
  box_to_box: ROLE_CONFIG_box_to_box,
  shadow_striker: ROLE_CONFIG_shadow_striker,
  anchor_man: ROLE_CONFIG_anchor_man,
  ball_winning_mid: ROLE_CONFIG_ball_winning_mid,
  enganche_presser: ROLE_CONFIG_enganche_presser,
  traditional_winger: ROLE_CONFIG_traditional_winger,
  inside_forward: ROLE_CONFIG_inside_forward,
  wide_playmaker: ROLE_CONFIG_wide_playmaker,
  wide_midfielder: ROLE_CONFIG_wide_midfielder,
  high_presser: ROLE_CONFIG_high_presser,
  advanced_forward: ROLE_CONFIG_advanced_forward,
  target_man: ROLE_CONFIG_target_man,
  false_9: ROLE_CONFIG_false_9,
  pressing_forward: ROLE_CONFIG_pressing_forward,
  poacher: ROLE_CONFIG_poacher,
};

/**
 * Resolve the active role key for a player given their current phase state.
 * Returns null when no config is assigned — callers should fall back to base behavior.
 */
export function getActiveRoleConfig(
  attackingRolePreset: string | null | undefined,
  defensiveRolePreset: string | null | undefined,
  phaseState: 'DEFENDING' | 'IN_POSSESSION' | 'ON_BALL'
): RoleMovementConfig | null {
  const key =
    phaseState === 'DEFENDING'
      ? defensiveRolePreset
      : attackingRolePreset;

  if (!key) return null;
  return ROLE_MOVEMENT_CONFIGS[key] ?? null;
}
