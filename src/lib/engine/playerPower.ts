import { calculateSuitability } from './suitability';
import type { PlayerAttributes } from './types';
import { getExpBonus } from './experience';

type AttributeLike = Partial<PlayerAttributes>;

const ATTR_KEYS: (keyof PlayerAttributes)[] = [
  'handling', 'tackling', 'passing', 'shooting', 'heading', 'dribbling',
  'crossing', 'setPieces', 'throw',
  'aggression', 'positioning', 'vision', 'bravery', 'leadership', 'teamwork', 'composure',
  'pace', 'acceleration', 'stamina', 'strength', 'agility', 'balance'
];

function clampStat(value: number): number {
  return Math.max(0, Math.min(20, Math.round(value)));
}

export function toPlayerAttributes(source: AttributeLike): PlayerAttributes {
  return {
    handling: Number(source.handling ?? 0),
    tackling: Number(source.tackling ?? 0),
    passing: Number(source.passing ?? 0),
    shooting: Number(source.shooting ?? 0),
    heading: Number(source.heading ?? 0),
    dribbling: Number(source.dribbling ?? 0),
    crossing: Number(source.crossing ?? 0),
    setPieces: Number(source.setPieces ?? 0),
    throw: Number(source.throw ?? 0),
    aggression: Number(source.aggression ?? 0),
    positioning: Number(source.positioning ?? 0),
    vision: Number(source.vision ?? 0),
    bravery: Number(source.bravery ?? 0),
    leadership: Number(source.leadership ?? 0),
    teamwork: Number(source.teamwork ?? 0),
    composure: Number(source.composure ?? 0),
    pace: Number(source.pace ?? 0),
    acceleration: Number(source.acceleration ?? 0),
    stamina: Number(source.stamina ?? 0),
    strength: Number(source.strength ?? 0),
    agility: Number(source.agility ?? 0),
    balance: Number(source.balance ?? 0)
  };
}

export function getEffectiveAttributes(attrs: PlayerAttributes, exp: number): PlayerAttributes {
  const bonus = getExpBonus(exp);
  const next = { ...attrs } as PlayerAttributes;

  for (const key of ATTR_KEYS) {
    next[key] = clampStat((attrs[key] ?? 0) + bonus);
  }

  return next;
}

export function getFitnessFactor(condition: number): number {
  return Math.pow(Math.max(0, Math.min(1, condition / 100)), 1.2);
}

export function calculatePlayerPower(params: {
  attributes: PlayerAttributes;
  targetPosition: string;
  naturalPosition?: string;
  condition?: number;
  exp?: number;
}) {
  const { attributes, targetPosition, naturalPosition, condition = 100, exp = 0 } = params;
  const effectiveAttributes = getEffectiveAttributes(attributes, exp);
  const fitnessFactor = getFitnessFactor(condition);

  const getPosAffinity = (naturalPos?: string, targetPos?: string) => {
    if (!naturalPos || !targetPos) return 0;
    const nat = naturalPos.split('_')[0];
    const tgt = targetPos.split('_')[0];

    if (nat === 'DMC') {
      if (tgt === 'DMC') return 10;
      if (tgt === 'MC') return 8;
      if (tgt === 'AMC') return 3;
      if (tgt === 'DC') return -8;
      if (tgt === 'DR' || tgt === 'DL') return -6;
    }

    if (nat === 'MC') {
      if (tgt === 'MC') return 10;
      if (tgt === 'DMC') return 8;
      if (tgt === 'AMC') return 5;
      if (tgt === 'DC') return -7;
    }

    if (nat === 'DC') {
      if (tgt === 'DC') return 10;
      if (tgt === 'DMC') return -4;
      if (tgt === 'MC') return -8;
    }

    return 0;
  };

  const affinity = getPosAffinity(naturalPosition, targetPosition);

  const baseSuitabilityNoExp = calculateSuitability(attributes, targetPosition);
  const baseSuitabilityWithExp = calculateSuitability(effectiveAttributes, targetPosition);

  const adjustedNoExp = Math.max(0, Math.min(100, baseSuitabilityNoExp + affinity));
  const adjustedWithExp = Math.max(0, Math.min(100, baseSuitabilityWithExp + affinity));

  return {
    expBonus: getExpBonus(exp),
    fitnessFactor,
    effectiveAttributes,
    baseSuitabilityNoExp: adjustedNoExp,
    baseSuitabilityWithExp: adjustedWithExp,
    powerNoExpNoFitness: Math.round(adjustedNoExp),
    powerWithExpNoFitness: Math.round(adjustedWithExp),
    powerNoExp: Math.round(adjustedNoExp * fitnessFactor),
    powerWithExp: Math.round(adjustedWithExp * fitnessFactor)
  };
}
