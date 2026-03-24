/**
 * Experience System for Player Evolution
 * Players gain stat bonuses from accumulated EXP.
 */

/**
 * Calculate the stat multiplier bonus from EXP.
 * Simple rule: Every 100 EXP = +0.1 multiplier (no rounding up)
 * - Caps at ×2.0 at 1000 EXP
 *
 * @param exp - Total accumulated EXP (0-1000)
 * @returns Multiplier value (1.0 – 2.0)
 */
export function getExpMultiplier(exp: number): number {
  const tiers = getExpTiersBy18Rule(exp);
  return 1.0 + (tiers * 0.1);
}

/**
 * Calculate the flat stat bonus to add to all player attributes.
 * Simple rule: Every 100 EXP = +1 to all stats (no rounding up)
 * - Caps at +10 at 1000 EXP
 *
 * @param exp - Total accumulated EXP (0-1000)
 * @returns Flat bonus to add to each attribute (0–10)
 */
export function getExpBonus(exp: number): number {
  return getExpTiersBy18Rule(exp);
}

/**
 * EXP tiering:
 * - 0..99 => 0 tier
 * - 100..199 => 1 tier
 * - 200..299 => 2 tiers
 * - ...
 * - 1000 => 10 tiers
 *
 * Supports negative values symmetrically.
 */
function getExpTiersBy18Rule(exp: number): number {
  const clampedExp = Math.min(Math.max(exp, -1000), 1000);
  const sign = clampedExp < 0 ? -1 : 1;
  const absExp = Math.abs(clampedExp);

  if (absExp < 100) return 0;

  // Every 100 EXP gives +1 tier.
  const positiveTiers = Math.floor(absExp / 100);
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
  saves?: number;
  teamShotsOnTargetConceded?: number;
  goalsConceded?: number;
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
  } else if (stats.rating >= 7.0) {
    performanceGain += 1.5;
  }

  // Rating-based penalties
  if (stats.rating < 5.0) {
    penaltyLoss += 2;
  } else if (stats.rating <= 5.5) {
    penaltyLoss += 1;
  }

  // Goals & Assists: +1 per goal, +1 per assist (no cap)
  actionGain = (stats.goals || 0) + (stats.assists || 0);

  // Clean sheet bonus (GK/DF only)
  if (stats.cleanSheet && stats.position) {
    const pos = stats.position.toUpperCase();
    if (pos.includes('GK') || pos.includes('D')) {
      performanceGain += 1.5;
    }
  }

  // GK save bonus (if stat.saves exists, use it; else use team shotsOnTarget - goalsAgainst)
  if (stats.position && stats.position.toUpperCase().includes('GK')) {
    let saveBonus = 0;
    if (typeof stats.saves === 'number') {
      saveBonus = stats.saves * 0.1;
    } else if (
      typeof stats.teamShotsOnTargetConceded === 'number' &&
      typeof stats.goalsConceded === 'number'
    ) {
      const saves = stats.teamShotsOnTargetConceded - stats.goalsConceded;
      if (saves > 0) saveBonus = saves * 0.1;
    }
    performanceGain += saveBonus;
  }

  // Discipline penalties
  if (stats.redCards > 0) {
    penaltyLoss += 5;
  }
  if (stats.yellowCards > 0) {
    penaltyLoss += 1 * stats.yellowCards;
  }

  // Optional penalties (if tracked by simulation pipeline)
  if ((stats.ownGoals || 0) > 0) {
    penaltyLoss += 5 * (stats.ownGoals || 0);
  }
  if ((stats.penaltiesConceded || 0) > 0) {
    penaltyLoss += 2 * (stats.penaltiesConceded || 0);
  }

  const totalGain = baseGain + performanceGain + actionGain - penaltyLoss;

  // EXP cannot be negative - minimum is 0
  // Players always gain at least 0 EXP from a match (no negative EXP)
  const adjustedTotalGain = Math.max(0, totalGain);

  // Cap maximum EXP gain per match at 3 to prevent players from improving too quickly
  // This ensures gradual development and prevents "too good too soon" syndrome
  const cappedTotalGain = Math.min(3, adjustedTotalGain);

  return {
    playerId: stats.playerId,
    baseGain,
    performanceGain,
    actionGain,
    penaltyLoss,
    totalGain: cappedTotalGain
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
