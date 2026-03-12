export type TrainingFacilityConfig = {
  level: number;
  upgradeCost: number;
  weeklyFee: number;
  maxGain: number;
};

export const TRAINING_MAX_LEVEL = 9;
export const TRAINING_SLOT_COUNT = 5;

export const TRAINING_FACILITY_LEVELS: TrainingFacilityConfig[] = [
  { level: 1, upgradeCost: 0, weeklyFee: 40000, maxGain: 0.1 },
  { level: 2, upgradeCost: 5000000, weeklyFee: 60000, maxGain: 0.15 },
  { level: 3, upgradeCost: 7500000, weeklyFee: 90000, maxGain: 0.2 },
  { level: 4, upgradeCost: 15000000, weeklyFee: 135000, maxGain: 0.25 },
  { level: 5, upgradeCost: 30000000, weeklyFee: 202500, maxGain: 0.3 },
  { level: 6, upgradeCost: 60000000, weeklyFee: 303750, maxGain: 0.35 },
  { level: 7, upgradeCost: 120000000, weeklyFee: 455625, maxGain: 0.4 },
  { level: 8, upgradeCost: 240000000, weeklyFee: 683438, maxGain: 0.45 },
  { level: 9, upgradeCost: 480000000, weeklyFee: 1025156, maxGain: 0.5 }
];

export const TRAINABLE_ATTRIBUTES = [
  'handling', 'tackling', 'passing', 'shooting', 'heading', 'dribbling',
  'crossing', 'setPieces', 'throw',
  'aggression', 'positioning', 'vision', 'bravery', 'leadership', 'teamwork', 'composure',
  'pace', 'acceleration', 'stamina', 'strength', 'agility', 'balance'
] as const;

export type TrainableAttribute = (typeof TRAINABLE_ATTRIBUTES)[number];

export const TRAINABLE_ATTRIBUTE_LABELS: Record<TrainableAttribute, string> = {
  handling: 'Handling',
  tackling: 'Tackling',
  passing: 'Passing',
  shooting: 'Shooting',
  heading: 'Heading',
  dribbling: 'Dribbling',
  crossing: 'Crossing',
  setPieces: 'Set Pieces',
  throw: 'Throw',
  aggression: 'Aggression',
  positioning: 'Positioning',
  vision: 'Vision',
  bravery: 'Bravery',
  leadership: 'Leadership',
  teamwork: 'Teamwork',
  composure: 'Composure',
  pace: 'Pace',
  acceleration: 'Acceleration',
  stamina: 'Stamina',
  strength: 'Strength',
  agility: 'Agility',
  balance: 'Balance'
};

export function getFacilityByLevel(level: number): TrainingFacilityConfig {
  const found = TRAINING_FACILITY_LEVELS.find((l) => l.level === level);
  return found || TRAINING_FACILITY_LEVELS[0];
}
