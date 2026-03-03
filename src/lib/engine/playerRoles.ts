import { Player } from '@prisma/client';
import { PlayerAttributes } from './types';

export interface RoleDefinition {
  name: string;
  displayName: string;
  positions: string[];  // e.g., ['DR', 'DL', 'DC']
  primaryAttributes: string[];
  effects: {
    description: string;
    actionModifiers?: Record<string, number>;  // e.g., { PASS_SHORT: 1.1, DRIBBLE: 1.1 }
    opponentPenalty?: Record<string, number>;  // e.g., { SHOOT: 0.85 }
  };
  conditionDrainMultiplier: number;  // 1.1 = +10%, 1.15 = +15%
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  // ========== DEFENDERS (DR, DL, DC) ==========
  NO_NONSENSE_DEFENDER: {
    name: 'NO_NONSENSE_DEFENDER',
    displayName: 'No-Nonsense Defender',
    positions: ['DR', 'DL', 'DC'],
    primaryAttributes: ['tackling', 'strength', 'heading', 'positioning'],
    effects: {
      description: 'Reduce opponent space -10%',
      opponentPenalty: { DRIBBLE: 0.9, PASS_SHORT: 0.9 }
    },
    conditionDrainMultiplier: 1.1
  },

  WINGBACK: {
    name: 'WINGBACK',
    displayName: 'Wingback',
    positions: ['DR', 'DL'],
    primaryAttributes: ['crossing', 'stamina', 'pace', 'dribbling'],
    effects: {
      description: 'Long Pass Success +10%',
      actionModifiers: { PASS_LONG: 1.1, crossing: 1.1 }
    },
    conditionDrainMultiplier: 1.1
  },

  MAN_MARKER: {
    name: 'MAN_MARKER',
    displayName: 'Man Marker (Shadow)',
    positions: ['DR', 'DL', 'DC'],
    primaryAttributes: ['aggression', 'bravery', 'tackling', 'positioning'],
    effects: {
      description: 'Opponent Shoot Chance -15%',
      opponentPenalty: { SHOOT: 0.85 }
    },
    conditionDrainMultiplier: 1.15
  },

  // ========== MIDFIELDERS (MC, MR, ML, DMC, AMC) ==========
  BALL_WINNING_MIDFIELDER: {
    name: 'BALL_WINNING_MIDFIELDER',
    displayName: 'Ball Winning Midfielder',
    positions: ['MC', 'DMC'],
    primaryAttributes: ['tackling', 'aggression', 'bravery', 'positioning'],
    effects: {
      description: 'Opponent Success (Pass/Dribble/Long shot) -10%',
      opponentPenalty: { PASS_SHORT: 0.9, PASS_LONG: 0.9, DRIBBLE: 0.9, SHOOT: 0.9 }
    },
    conditionDrainMultiplier: 1.1
  },

  PLAYMAKER: {
    name: 'PLAYMAKER',
    displayName: 'Playmaker',
    positions: ['MC', 'AMC'],
    primaryAttributes: ['passing', 'composure', 'vision', 'dribbling', 'positioning'],
    effects: {
      description: 'Short/Long Pass & Dribble Success +10%',
      actionModifiers: { PASS_SHORT: 1.1, PASS_LONG: 1.1, DRIBBLE: 1.1 }
    },
    conditionDrainMultiplier: 1.1
  },

  BOX_TO_BOX: {
    name: 'BOX_TO_BOX',
    displayName: 'Box-to-Box',
    positions: ['MC'],
    primaryAttributes: ['stamina', 'teamwork', 'positioning'],
    effects: {
      description: 'Long Shot & Short Pass Success +10%',
      actionModifiers: { SHOOT: 1.1, PASS_SHORT: 1.1 }
    },
    conditionDrainMultiplier: 1.1
  },

  TREQUARTISTA: {
    name: 'TREQUARTISTA',
    displayName: 'Trequartista (Free Role)',
    positions: ['AMC'],
    primaryAttributes: ['vision', 'dribbling', 'passing', 'acceleration', 'crossing'],
    effects: {
      description: 'Long Pass & Dribble Success +15%',
      actionModifiers: { PASS_LONG: 1.15, DRIBBLE: 1.15 }
    },
    conditionDrainMultiplier: 1.15
  },

  TRADITIONAL_WINGER: {
    name: 'TRADITIONAL_WINGER',
    displayName: 'Traditional Winger',
    positions: ['MR', 'ML'],
    primaryAttributes: ['crossing', 'dribbling', 'acceleration', 'pace'],
    effects: {
      description: 'Cross & Dribble Success +15%',
      actionModifiers: { crossing: 1.15, DRIBBLE: 1.15 }
    },
    conditionDrainMultiplier: 1.15
  },

  WIDE_PLAYMAKER: {
    name: 'WIDE_PLAYMAKER',
    displayName: 'Wide Playmaker',
    positions: ['MR', 'ML'],
    primaryAttributes: ['crossing', 'passing', 'vision', 'acceleration'],
    effects: {
      description: 'Key Pass & Long Pass Success +15%',
      actionModifiers: { PASS_LONG: 1.15, PASS_SHORT: 1.15 }
    },
    conditionDrainMultiplier: 1.1
  },

  // ========== FORWARDS (FC, FWR, FWL) ==========
  TARGET_MAN: {
    name: 'TARGET_MAN',
    displayName: 'Target Man',
    positions: ['FWC', 'FC'],
    primaryAttributes: ['strength', 'positioning', 'shooting', 'heading'],
    effects: {
      description: 'Hold Ball & Short Pass Success +10%',
      actionModifiers: { PASS_SHORT: 1.1, heading: 1.1 }
    },
    conditionDrainMultiplier: 1.1
  },

  COMPLETE_FORWARD: {
    name: 'COMPLETE_FORWARD',
    displayName: 'Complete Forward',
    positions: ['FWC', 'FC', 'FWR', 'FWL'],
    primaryAttributes: ['strength', 'pace', 'shooting', 'dribbling', 'heading', 'vision'],
    effects: {
      description: 'All Attack Action Success +10%',
      actionModifiers: { SHOOT: 1.1, DRIBBLE: 1.1, PASS_SHORT: 1.1, PASS_LONG: 1.1 }
    },
    conditionDrainMultiplier: 1.1
  },

  POACHER: {
    name: 'POACHER',
    displayName: 'Poacher',
    positions: ['FWC', 'FC'],
    primaryAttributes: ['shooting', 'composure', 'acceleration'],
    effects: {
      description: 'Finishing Success +3%',
      actionModifiers: { SHOOT: 1.03 }
    },
    conditionDrainMultiplier: 1.1
  },

  FALSE_9: {
    name: 'FALSE_9',
    displayName: 'False 9',
    positions: ['FWC', 'FC'],
    primaryAttributes: ['passing', 'dribbling', 'acceleration', 'vision'],
    effects: {
      description: 'Key Pass & Dribble Success +15%',
      actionModifiers: { PASS_SHORT: 1.15, PASS_LONG: 1.15, DRIBBLE: 1.15 }
    },
    conditionDrainMultiplier: 1.1
  },

  INVERTED_WINGER: {
    name: 'INVERTED_WINGER',
    displayName: 'Inverted Winger',
    positions: ['FWR', 'FWL'],
    primaryAttributes: ['crossing', 'dribbling', 'acceleration', 'shooting'],
    effects: {
      description: 'Dribble & Shooting Success +15%',
      actionModifiers: { DRIBBLE: 1.15, SHOOT: 1.15 }
    },
    conditionDrainMultiplier: 1.15
  }
};

/**
 * Get eligible roles for a natural position
 */
export function getEligibleRoles(naturalPosition: string): RoleDefinition[] {
  const basePosition = naturalPosition.split('_')[0]; // Extract base position (e.g., "FW" from "FW_L")
  
  return Object.values(ROLE_DEFINITIONS).filter(role => 
    role.positions.some(pos => 
      pos === basePosition || 
      pos === naturalPosition ||
      (basePosition === 'FW' && pos.startsWith('FW'))
    )
  );
}

/**
 * Calculate role suitability (1-5 stars) based on player power
 * Uses position-specific power calculation to better evaluate role fit
 * than simple attribute averaging
 */
export function calculateRoleSuitability(
  player: Player | (Player & { attributes?: PlayerAttributes }),
  roleName: string
): number {
  const role = ROLE_DEFINITIONS[roleName];
  if (!role) return 0;

  try {
    // Lazy import to avoid circular dependencies
    const { calculatePlayerPower, toPlayerAttributes } = require('./playerPower');
    
    // Calculate player power as if they were in this role's primary position
    const primaryPos = role.positions[0]; // Use first position in role's eligible positions
    
    // Build attributes object from player
    const attrs = toPlayerAttributes({
      handling: (player as any).handling,
      tackling: (player as any).tackling,
      passing: (player as any).passing,
      shooting: (player as any).shooting,
      heading: (player as any).heading,
      dribbling: (player as any).dribbling,
      crossing: (player as any).crossing,
      setPieces: (player as any).setPieces,
      throw: (player as any).throw,
      aggression: (player as any).aggression,
      positioning: (player as any).positioning,
      vision: (player as any).vision,
      bravery: (player as any).bravery,
      leadership: (player as any).leadership,
      teamwork: (player as any).teamwork,
      composure: (player as any).composure,
      pace: (player as any).pace,
      acceleration: (player as any).acceleration,
      stamina: (player as any).stamina,
      strength: (player as any).strength,
      agility: (player as any).agility,
      balance: (player as any).balance
    });

    const power = calculatePlayerPower({
      attributes: attrs,
      targetPosition: primaryPos,
      condition: (player as any).condition || 100,
      exp: (player as any).exp || 0
    }).powerWithExp;

    // Convert power (0-100 scale) to 1-5 stars
    // 0-20 = 1 star, 21-40 = 2 stars, 41-60 = 3 stars, 61-80 = 4 stars, 81-100 = 5 stars
    const stars = Math.max(1, Math.min(5, Math.ceil(power / 20)));
    
    return stars;
  } catch (error) {
    // Fallback to attribute-based calculation if power calculation fails
    const primaryAttrs = role.primaryAttributes;
    let totalScore = 0;
    let count = 0;

    for (const attr of primaryAttrs) {
      const value = (player as any)[attr];
      if (typeof value === 'number') {
        totalScore += value;
        count++;
      }
    }

    if (count === 0) return 0;

    const averageScore = totalScore / count;
    const stars = Math.max(1, Math.min(5, Math.ceil(averageScore / 4)));
    
    return stars;
  }
}

/**
 * Get role effects for match engine
 */
export function getRoleEffects(roleName: string): RoleDefinition['effects'] | null {
  const role = ROLE_DEFINITIONS[roleName];
  return role ? role.effects : null;
}

/**
 * Get condition drain multiplier for a role
 */
export function getRoleConditionDrain(roleName: string): number {
  const role = ROLE_DEFINITIONS[roleName];
  return role ? role.conditionDrainMultiplier : 1.0;
}

/**
 * Get all roles as array
 */
export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLE_DEFINITIONS);
}
