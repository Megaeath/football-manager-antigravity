export const YELLOW_SUSPENSION_THRESHOLD_DEFAULT = 4;
export const RED_CARD_SUSPENSION_MATCHES = 1;

export const BOOKED_TACKLE_SUCCESS_PENALTY_PER_YELLOW = 0.08;
export const BOOKED_TACKLE_SUCCESS_PENALTY_MAX = 0.25;

export const TEAM_DOWN_SUCCESS_PENALTY_PER_RED = 0.06;
export const TEAM_DOWN_SUCCESS_MIN_MULTIPLIER = 0.7;

export const BASE_YELLOW_CARD_CHANCE = 0.11;
export const BASE_DIRECT_RED_CHANCE = 0.0025;

export const INJURY_BASE_CHANCE = 0.03;
export const INJURY_MIN_CHANCE = 0.005;
export const INJURY_MAX_CHANCE = 0.12;

export const INJURY_LOW_CONDITION_THRESHOLD = 70;
export const INJURY_LOW_CONDITION_WEIGHT = 0.35;

export const INJURY_SEVERITY_RANGES: Record<'MINOR' | 'MODERATE' | 'MAJOR', { min: number; max: number }> = {
  MINOR: { min: 1, max: 2 },
  MODERATE: { min: 3, max: 5 },
  MAJOR: { min: 6, max: 12 },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getDurabilityScore(stamina: number, strength: number): number {
  return (stamina + strength) / 2;
}

export function getDurabilityNorm(stamina: number, strength: number): number {
  return clamp(getDurabilityScore(stamina, strength) / 20, 0, 1);
}

export function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
