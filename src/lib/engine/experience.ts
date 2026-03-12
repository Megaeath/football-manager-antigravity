/**
 * Experience System for Player Evolution
 * Based on "The 1.8 Rule" - players gain stat bonuses from accumulated EXP
 */

/**
 * Calculate the stat multiplier bonus from EXP
 * Simple rule: Every 100 EXP = +0.1 multiplier (no rounding up)
 * 
 * @param exp - Total accumulated EXP (0-1000)
 * @returns Multiplier value (1.0 - 2.0)
 */
export function getExpMultiplier(exp: number): number {
  const tiers = getExpTiersBy18Rule(exp);
  return 1.0 + (tiers * 0.1);
}

/**
 * Calculate the flat stat bonus to add to all player attributes
 * Simple rule: Every 100 EXP = +1 to all stats (no rounding up)
 * 
 * @param exp - Total accumulated EXP (0-1000)
 * @returns Flat bonus to add to each stat (0-10)
 */
export function getExpBonus(exp: number): number {
  return getExpTiersBy18Rule(exp);
}

/**
 * "1.8 Rule" EXP tiering used by this project:
 * - 0..179 => 0 tier
 * - 180..279 => 2 tiers
 * - 280..379 => 3 tiers
 * - ...
 * - 980..1000 => 10 tiers
 *
 * Supports negative values symmetrically.
 */
function getExpTiersBy18Rule(exp: number): number {
  const clampedExp = Math.min(Math.max(exp, -1000), 1000);
  const sign = clampedExp < 0 ? -1 : 1;
  const absExp = Math.abs(clampedExp);

  if (absExp < 180) return 0;

  // 180 starts at tier 2, then +1 tier per additional 100 EXP.
  const positiveTiers = Math.floor((absExp - 80) / 100) + 1;
  return sign * Math.min(10, positiveTiers);
}

/**
 * Apply EXP bonus to a single stat value
 * 
 * @param baseStat - The base stat value (0-20)
 * @param exp - Total accumulated EXP
 * @returns The stat value with EXP bonus applied (capped at 20)
 */
export function applyExpToStat(baseStat: number, exp: number): number {
  const bonus = getExpBonus(exp);
  return Math.max(0, Math.min(baseStat + bonus, 20));
}

/**
 * Calculate EXP gained from a single match performance
 * Based on match stats and player role
 * 
 * @param stats - Player match statistics
 * @returns EXP gained (can be negative for poor performance)
 */
export interface MatchExpGain {
  playerId: string;
  baseGain: number;      // Starter/sub bonus
  performanceGain: number; // Rating-based gain
  actionGain: number;    // Goals/assists
  penaltyLoss: number;   // Discipline/bad performance
  totalGain: number;
}

export function calculateMatchExp(stats: {
  playerId: string;
  minutes: number;
  rating: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  position?: string;
  cleanSheet?: boolean;
  isMotm?: boolean;
  ownGoals?: number;
  penaltiesConceded?: number;
}): MatchExpGain {
  let baseGain = 0;
  let performanceGain = 0;
  let actionGain = 0;
  let penaltyLoss = 0;

  // Base gain: Starter vs Substitute
  if (stats.minutes >= 45) {
    baseGain += 1; // Starter
  } else if (stats.minutes > 0) {
    baseGain += 0.5; // Substitute
  }

  // MOTM bonus
  if (stats.isMotm) {
    performanceGain += 5;
  }

  // Rating-based gains
  if (stats.rating >= 9.0) {
    performanceGain += 3;
  } else if (stats.rating >= 7.5) {
    performanceGain += 1.5;
  }

  // Rating-based penalties
  if (stats.rating < 5.0) {
    penaltyLoss += 5;
  } else if (stats.rating <= 5.5) {
    penaltyLoss += 2;
  }

  // Goals & Assists (max +3 per match)
  const totalActions = stats.goals + stats.assists;
  actionGain = Math.min(totalActions, 3);

  // Clean sheet bonus (GK/DF only)
  if (stats.cleanSheet && stats.position) {
    const pos = stats.position.toUpperCase();
    if (pos.includes('GK') || pos.includes('D')) {
      performanceGain += 1.5;
    }
  }

  // Discipline penalties
  if (stats.redCards > 0) {
    penaltyLoss += 10;
  }
  if (stats.yellowCards > 0) {
    penaltyLoss += 2 * stats.yellowCards;
  }

  // Optional penalties (if tracked by simulation pipeline)
  if ((stats.ownGoals || 0) > 0) {
    penaltyLoss += 5 * (stats.ownGoals || 0);
  }
  if ((stats.penaltiesConceded || 0) > 0) {
    penaltyLoss += 3 * (stats.penaltiesConceded || 0);
  }

  const totalGain = baseGain + performanceGain + actionGain - penaltyLoss;

  return {
    playerId: stats.playerId,
    baseGain,
    performanceGain,
    actionGain,
    penaltyLoss,
    totalGain
  };
}

/**
 * Apply age efficiency to EXP gain
 * 
 * @param rawGain - Raw EXP gained before age modifier
 * @param age - Player's age
 * @returns Adjusted EXP gain after age efficiency
 */
export function applyAgeEfficiency(rawGain: number, age: number): number {
  let efficiency = 1.0;
  
  if (age >= 16 && age <= 21) {
    efficiency = 1.0; // 100%
  } else if (age >= 22 && age <= 28) {
    efficiency = 0.7; // 70%
  } else if (age >= 29 && age <= 33) {
    efficiency = 0.4; // 40%
  } else if (age >= 34) {
    efficiency = 0.1; // 10%
  }
  
  return rawGain * efficiency;
}

/**
 * Get seasonal EXP cap based on age
 * 
 * @param age - Player's age
 * @returns Maximum EXP gain allowed per season
 */
export function getSeasonalExpCap(age: number): number {
  if (age >= 16 && age <= 21) return 80;
  if (age >= 22 && age <= 28) return 50;
  if (age >= 29 && age <= 33) return 20;
  if (age >= 34) return 10;
  return 0;
}

/**
 * Get annual decay based on age
 * 
 * @param age - Player's age
 * @returns EXP lost per year due to aging
 */
export function getAnnualDecay(age: number): number {
  if (age >= 29 && age <= 33) return 40;
  if (age >= 34) return 80;
  return 0;
}
