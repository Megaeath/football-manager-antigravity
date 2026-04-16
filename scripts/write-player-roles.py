content = r"""import { Player } from '@prisma/client';
import { PlayerAttributes } from './types';

export interface RoleDefinition {
  name: string;
  displayName: string;
  positions: string[];
  state: 'attacking' | 'defending';
  primaryAttributes: string[];
  effects: {
    description: string;
    actionModifiers?: Record<string, number>;
    opponentPenalty?: Record<string, number>;
  };
  conditionDrainMultiplier: number;
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  traditional_distributor: { name: 'traditional_distributor', displayName: 'Traditional Distributor', positions: ['GK'], state: 'attacking', primaryAttributes: ['handling', 'passing', 'composure'], effects: { description: 'Safety-first: X:2-5, long kick upfield immediately', actionModifiers: { PASS_LONG: 1.15 } }, conditionDrainMultiplier: 1.0 },
  sweeper_support: { name: 'sweeper_support', displayName: 'Sweeper Support', positions: ['GK'], state: 'attacking', primaryAttributes: ['handling', 'passing', 'vision', 'pace'], effects: { description: 'Push to X:15-22; short-pass build-up', actionModifiers: { PASS_SHORT: 1.1 } }, conditionDrainMultiplier: 1.05 },
  line_keeper: { name: 'line_keeper', displayName: 'Line Keeper', positions: ['GK'], state: 'defending', primaryAttributes: ['handling', 'agility', 'composure', 'positioning'], effects: { description: 'Stay on line X:1-3; angle narrowing; reaction saves', opponentPenalty: { SHOOT: 0.9 } }, conditionDrainMultiplier: 1.0 },
  sweeper_defender: { name: 'sweeper_defender', displayName: 'Sweeper Defender', positions: ['GK'], state: 'defending', primaryAttributes: ['handling', 'pace', 'positioning', 'bravery'], effects: { description: 'Proactive X:10-15; charge out to intercept through balls', opponentPenalty: { PASS_LONG: 0.9 } }, conditionDrainMultiplier: 1.05 },
  safe_passer: { name: 'safe_passer', displayName: 'Safe Passer', positions: ['DC'], state: 'attacking', primaryAttributes: ['passing', 'composure', 'positioning', 'teamwork'], effects: { description: 'Anchor point X:25-35; always choose safest short pass', actionModifiers: { PASS_SHORT: 1.1 } }, conditionDrainMultiplier: 1.0 },
  ball_carrier: { name: 'ball_carrier', displayName: 'Ball Carrier / Playmaker', positions: ['DC'], state: 'attacking', primaryAttributes: ['passing', 'dribbling', 'pace', 'vision'], effects: { description: 'Drive to X:45-55; killer passes or carry into space', actionModifiers: { DRIBBLE: 1.1, PASS_LONG: 1.1 } }, conditionDrainMultiplier: 1.1 },
  stopper: { name: 'stopper', displayName: 'The Stopper', positions: ['DC'], state: 'defending', primaryAttributes: ['tackling', 'strength', 'bravery', 'aggression'], effects: { description: 'Aggressive proximity; tight marking 1-2 units; front-foot tackle', opponentPenalty: { DRIBBLE: 0.85, SHOOT: 0.9 } }, conditionDrainMultiplier: 1.15 },
  cover: { name: 'cover', displayName: 'The Cover', positions: ['DC'], state: 'defending', primaryAttributes: ['positioning', 'heading', 'composure', 'teamwork'], effects: { description: 'Safety net X:15-20; sweep behind stopper; check offside line', opponentPenalty: { PASS_LONG: 0.9 } }, conditionDrainMultiplier: 1.05 },
  inverted_back: { name: 'inverted_back', displayName: 'Inverted Back', positions: ['DL', 'DR'], state: 'attacking', primaryAttributes: ['passing', 'vision', 'dribbling', 'positioning'], effects: { description: 'Tuck inside X:45-60; midfield support; diagonal passes', actionModifiers: { PASS_SHORT: 1.1, PASS_LONG: 1.05 } }, conditionDrainMultiplier: 1.1 },
  wing_back: { name: 'wing_back', displayName: 'Wing Back', positions: ['DL', 'DR'], state: 'attacking', primaryAttributes: ['crossing', 'stamina', 'pace', 'dribbling'], effects: { description: 'Overlap to X:70-85; hug touchline; cross from byline', actionModifiers: { PASS_LONG: 1.1, crossing: 1.15 } }, conditionDrainMultiplier: 1.15 },
  defensive_fullback: { name: 'defensive_fullback', displayName: 'Defensive Full Back', positions: ['DL', 'DR'], state: 'defending', primaryAttributes: ['tackling', 'positioning', 'composure', 'teamwork'], effects: { description: 'Hold line X:20-30; jockey winger; contain wide threats', opponentPenalty: { DRIBBLE: 0.9, crossing: 0.9 } }, conditionDrainMultiplier: 1.05 },
  no_nonsense_fullback: { name: 'no_nonsense_fullback', displayName: 'No-Nonsense Full Back', positions: ['DL', 'DR'], state: 'defending', primaryAttributes: ['strength', 'heading', 'tackling', 'bravery'], effects: { description: 'Sprint back to X:15; man-mark winger; clear long when ball won', opponentPenalty: { DRIBBLE: 0.85 } }, conditionDrainMultiplier: 1.1 },
  deep_lying_playmaker: { name: 'deep_lying_playmaker', displayName: 'Deep-Lying Playmaker', positions: ['DMC', 'MC'], state: 'attacking', primaryAttributes: ['passing', 'vision', 'composure', 'positioning'], effects: { description: 'Quarterback X:35-45; distribute wide or vertical; no forward carries', actionModifiers: { PASS_SHORT: 1.15, PASS_LONG: 1.1 } }, conditionDrainMultiplier: 1.05 },
  box_to_box: { name: 'box_to_box', displayName: 'Box-to-Box Midfielder', positions: ['MC'], state: 'attacking', primaryAttributes: ['stamina', 'teamwork', 'positioning', 'shooting'], effects: { description: 'Roam X:40-80; late run into box X:85 Y:40-60', actionModifiers: { SHOOT: 1.1, PASS_SHORT: 1.05 } }, conditionDrainMultiplier: 1.15 },
  shadow_striker: { name: 'shadow_striker', displayName: 'Shadow Striker / Advanced Playmaker', positions: ['AMC'], state: 'attacking', primaryAttributes: ['vision', 'dribbling', 'passing', 'composure', 'acceleration'], effects: { description: 'Pocket space X:65-75; creative pivot; final-third passes', actionModifiers: { PASS_SHORT: 1.1, DRIBBLE: 1.1, SHOOT: 1.05 } }, conditionDrainMultiplier: 1.1 },
  anchor_man: { name: 'anchor_man', displayName: 'Anchor Man', positions: ['DMC'], state: 'defending', primaryAttributes: ['positioning', 'tackling', 'strength', 'composure'], effects: { description: 'Protective screen X:30-35; block passing lanes; does not chase wide', opponentPenalty: { PASS_SHORT: 0.9, PASS_LONG: 0.9 } }, conditionDrainMultiplier: 1.05 },
  ball_winning_mid: { name: 'ball_winning_mid', displayName: 'Ball Winning Midfielder', positions: ['DMC', 'MC'], state: 'defending', primaryAttributes: ['tackling', 'aggression', 'bravery', 'stamina'], effects: { description: 'High pressure; chase ball carrier when ball crosses X:50', opponentPenalty: { PASS_SHORT: 0.9, PASS_LONG: 0.9, DRIBBLE: 0.85 } }, conditionDrainMultiplier: 1.2 },
  enganche_presser: { name: 'enganche_presser', displayName: 'Enganche / Advanced Presser', positions: ['AMC'], state: 'defending', primaryAttributes: ['aggression', 'stamina', 'positioning', 'teamwork'], effects: { description: 'Counter-press trigger X:60-65; block GK distribution lines', opponentPenalty: { PASS_LONG: 0.9, PASS_SHORT: 0.9 } }, conditionDrainMultiplier: 1.15 },
  traditional_winger: { name: 'traditional_winger', displayName: 'Traditional Winger', positions: ['ML', 'MR'], state: 'attacking', primaryAttributes: ['crossing', 'dribbling', 'acceleration', 'pace'], effects: { description: 'Hug touchline to X:80-95; cross into box Y:50', actionModifiers: { crossing: 1.15, DRIBBLE: 1.1 } }, conditionDrainMultiplier: 1.1 },
  inside_forward: { name: 'inside_forward', displayName: 'Inside Forward', positions: ['ML', 'MR'], state: 'attacking', primaryAttributes: ['shooting', 'dribbling', 'acceleration', 'composure'], effects: { description: 'Diagonal run X:60-85 cutting inside; finish or short lay-off', actionModifiers: { SHOOT: 1.15, DRIBBLE: 1.1 } }, conditionDrainMultiplier: 1.1 },
  wide_playmaker: { name: 'wide_playmaker', displayName: 'Wide Playmaker', positions: ['ML', 'MR'], state: 'attacking', primaryAttributes: ['passing', 'vision', 'crossing', 'composure'], effects: { description: 'Tuck inside X:50-70; early cross or through ball to ST/AMC', actionModifiers: { PASS_LONG: 1.15, PASS_SHORT: 1.1 } }, conditionDrainMultiplier: 1.05 },
  wide_midfielder: { name: 'wide_midfielder', displayName: 'Wide Midfielder', positions: ['ML', 'MR'], state: 'defending', primaryAttributes: ['stamina', 'teamwork', 'tackling', 'positioning'], effects: { description: 'Track back X:30-40; double-up with fullback on wide threats', opponentPenalty: { DRIBBLE: 0.9, crossing: 0.9 } }, conditionDrainMultiplier: 1.1 },
  high_presser: { name: 'high_presser', displayName: 'High Presser / Raumdeuter', positions: ['ML', 'MR'], state: 'defending', primaryAttributes: ['positioning', 'pace', 'stamina', 'vision'], effects: { description: 'Hold X:55-65; be counter-attack outlet when ball is won', opponentPenalty: { PASS_LONG: 0.9 } }, conditionDrainMultiplier: 1.1 },
  advanced_forward: { name: 'advanced_forward', displayName: 'Advanced Forward', positions: ['FWC', 'FC', 'ST'], state: 'attacking', primaryAttributes: ['pace', 'acceleration', 'shooting', 'composure'], effects: { description: 'Pin high X:85-95; run in behind; 1v1 finisher', actionModifiers: { SHOOT: 1.15, DRIBBLE: 1.05 } }, conditionDrainMultiplier: 1.1 },
  target_man: { name: 'target_man', displayName: 'Target Man', positions: ['FWC', 'FC', 'ST'], state: 'attacking', primaryAttributes: ['strength', 'heading', 'positioning', 'shooting'], effects: { description: 'Hold-up X:75-85; lay off to AMC/wingers', actionModifiers: { heading: 1.15, PASS_SHORT: 1.1 } }, conditionDrainMultiplier: 1.1 },
  false_9: { name: 'false_9', displayName: 'False 9 / Deep Lying Forward', positions: ['FWC', 'FC', 'ST'], state: 'attacking', primaryAttributes: ['passing', 'dribbling', 'vision', 'acceleration', 'composure'], effects: { description: 'Drop to X:65-75; link play; surge into box only at last moment', actionModifiers: { PASS_SHORT: 1.15, PASS_LONG: 1.1, DRIBBLE: 1.1 } }, conditionDrainMultiplier: 1.05 },
  pressing_forward: { name: 'pressing_forward', displayName: 'Pressing Forward', positions: ['FWC', 'FC', 'ST'], state: 'defending', primaryAttributes: ['stamina', 'aggression', 'bravery', 'teamwork'], effects: { description: 'Chase DC/GK at X:15-30; close passing lanes', opponentPenalty: { PASS_SHORT: 0.9, PASS_LONG: 0.85 } }, conditionDrainMultiplier: 1.2 },
  poacher: { name: 'poacher', displayName: 'Poacher / Poised Striker', positions: ['FWC', 'FC', 'ST'], state: 'defending', primaryAttributes: ['positioning', 'composure', 'acceleration', 'pace'], effects: { description: 'Wait X:55-65; save stamina for counter-attack sprint', opponentPenalty: {} }, conditionDrainMultiplier: 0.95 },
};

const POSITION_ROLE_MAP: Record<string, string[]> = {
  GK:  ['traditional_distributor', 'sweeper_support', 'line_keeper', 'sweeper_defender'],
  DC:  ['safe_passer', 'ball_carrier', 'stopper', 'cover'],
  DL:  ['inverted_back', 'wing_back', 'defensive_fullback', 'no_nonsense_fullback'],
  DR:  ['inverted_back', 'wing_back', 'defensive_fullback', 'no_nonsense_fullback'],
  DMC: ['deep_lying_playmaker', 'anchor_man', 'ball_winning_mid'],
  MC:  ['deep_lying_playmaker', 'box_to_box', 'ball_winning_mid'],
  AMC: ['shadow_striker', 'enganche_presser'],
  ML:  ['traditional_winger', 'inside_forward', 'wide_playmaker', 'wide_midfielder', 'high_presser'],
  MR:  ['traditional_winger', 'inside_forward', 'wide_playmaker', 'wide_midfielder', 'high_presser'],
  FWC: ['advanced_forward', 'target_man', 'false_9', 'pressing_forward', 'poacher'],
  FC:  ['advanced_forward', 'target_man', 'false_9', 'pressing_forward', 'poacher'],
  ST:  ['advanced_forward', 'target_man', 'false_9', 'pressing_forward', 'poacher'],
};

const PREFERRED_ATTACKING: Record<string, string[]> = {
  GK:  ['traditional_distributor', 'sweeper_support'],
  DC:  ['safe_passer', 'ball_carrier'],
  DL:  ['wing_back', 'inverted_back'],
  DR:  ['wing_back', 'inverted_back'],
  DMC: ['deep_lying_playmaker'],
  MC:  ['box_to_box', 'deep_lying_playmaker'],
  AMC: ['shadow_striker'],
  ML:  ['traditional_winger', 'inside_forward', 'wide_playmaker'],
  MR:  ['traditional_winger', 'inside_forward', 'wide_playmaker'],
  FWC: ['advanced_forward', 'target_man', 'false_9'],
  FC:  ['advanced_forward', 'target_man', 'false_9'],
  ST:  ['advanced_forward', 'target_man', 'false_9'],
};

const PREFERRED_DEFENDING: Record<string, string[]> = {
  GK:  ['line_keeper', 'sweeper_defender'],
  DC:  ['stopper', 'cover'],
  DL:  ['defensive_fullback', 'no_nonsense_fullback'],
  DR:  ['defensive_fullback', 'no_nonsense_fullback'],
  DMC: ['anchor_man', 'ball_winning_mid'],
  MC:  ['ball_winning_mid', 'anchor_man'],
  AMC: ['enganche_presser'],
  ML:  ['wide_midfielder', 'high_presser'],
  MR:  ['wide_midfielder', 'high_presser'],
  FWC: ['pressing_forward', 'poacher'],
  FC:  ['pressing_forward', 'poacher'],
  ST:  ['pressing_forward', 'poacher'],
};

function resolveBasePosition(naturalPosition: string): string {
  return naturalPosition.split('_')[0];
}

export function getEligibleRoles(naturalPosition: string): RoleDefinition[] {
  const base = resolveBasePosition(naturalPosition);
  const names = POSITION_ROLE_MAP[base] ?? [];
  return names.map(n => ROLE_DEFINITIONS[n]).filter(Boolean);
}

export function getEligibleRolesByState(naturalPosition: string, state: 'attacking' | 'defending'): RoleDefinition[] {
  return getEligibleRoles(naturalPosition).filter(r => r.state === state);
}

export function getSuggestedRolePresets(naturalPosition: string): { attackingRolePreset: string | null; defensiveRolePreset: string | null } {
  const base = resolveBasePosition(naturalPosition);
  return {
    attackingRolePreset: PREFERRED_ATTACKING[base]?.[0] ?? null,
    defensiveRolePreset: PREFERRED_DEFENDING[base]?.[0] ?? null,
  };
}

export function calculateRoleSuitability(player: Player | (Player & { attributes?: PlayerAttributes }), roleName: string): number {
  const role = ROLE_DEFINITIONS[roleName];
  if (!role) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { calculatePlayerPower, toPlayerAttributes } = require('./playerPower');
    const primaryPos = role.positions[0];
    const attrs = toPlayerAttributes({
      handling: (player as any).handling, tackling: (player as any).tackling,
      passing: (player as any).passing, shooting: (player as any).shooting,
      heading: (player as any).heading, dribbling: (player as any).dribbling,
      crossing: (player as any).crossing, setPieces: (player as any).setPieces,
      throw: (player as any).throw, aggression: (player as any).aggression,
      positioning: (player as any).positioning, vision: (player as any).vision,
      bravery: (player as any).bravery, leadership: (player as any).leadership,
      teamwork: (player as any).teamwork, composure: (player as any).composure,
      pace: (player as any).pace, acceleration: (player as any).acceleration,
      stamina: (player as any).stamina, strength: (player as any).strength,
      agility: (player as any).agility, balance: (player as any).balance,
    });
    const power = calculatePlayerPower({ attributes: attrs, targetPosition: primaryPos, condition: (player as any).condition || 100, exp: (player as any).exp || 0 }).powerWithExp;
    return Math.max(1, Math.min(5, Math.ceil(power / 20)));
  } catch {
    let total = 0; let count = 0;
    for (const attr of role.primaryAttributes) {
      const v = (player as any)[attr];
      if (typeof v === 'number') { total += v; count++; }
    }
    if (count === 0) return 0;
    return Math.max(1, Math.min(5, Math.ceil((total / count) / 4)));
  }
}

export function getRoleEffects(roleName: string): RoleDefinition['effects'] | null {
  return ROLE_DEFINITIONS[roleName]?.effects ?? null;
}

export function getRoleConditionDrain(roleName: string): number {
  return ROLE_DEFINITIONS[roleName]?.conditionDrainMultiplier ?? 1.0;
}

export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLE_DEFINITIONS);
}

export function getPreferredRoleNamesForPhase(phase: 'attacking' | 'defensive'): string[] {
  const all = new Set<string>();
  const map = phase === 'attacking' ? PREFERRED_ATTACKING : PREFERRED_DEFENDING;
  for (const list of Object.values(map)) list.forEach(n => all.add(n));
  return [...all];
}
"""

with open('/Users/auii/Project/game/src/lib/engine/playerRoles.ts', 'w') as f:
    f.write(content)

print('Written', len(content), 'chars')
