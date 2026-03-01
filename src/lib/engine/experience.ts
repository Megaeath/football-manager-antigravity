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
  // Clamp to [-1000, 1000] to support negative EXP penalties
  const clampedExp = Math.min(Math.max(exp, -1000), 1000);
  
  // Simple calculation: every 100 EXP = +0.1 multiplier
  // 0-99 = 1.0, 100-199 = 1.1, 200-299 = 1.2, 300-399 = 1.3, etc.
  const hundreds = Math.trunc(clampedExp / 100);
  return 1.0 + (hundreds * 0.1);
}

/**
 * Calculate the flat stat bonus to add to all player attributes
 * Simple rule: Every 100 EXP = +1 to all stats (no rounding up)
 * 
 * @param exp - Total accumulated EXP (0-1000)
 * @returns Flat bonus to add to each stat (0-10)
 */
export function getExpBonus(exp: number): number {
  // Simple calculation: every 100 EXP = +1 bonus
  // 0-99 = +0, 100-199 = +1, 200-299 = +2, 300-399 = +3, etc.
  // -100..-199 = -1, -200..-299 = -2, etc.
  const clampedExp = Math.min(Math.max(exp, -1000), 1000);
  return Math.trunc(clampedExp / 100);
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
