import { PrismaClient, Player, Team } from '@prisma/client';
import { calculatePlayerPower, toPlayerAttributes } from './playerPower';
import type { PlayerAttributes } from './types';
import { getDivisionFinanceMultiplier } from '../services/divisionSystem';

const prisma = new PrismaClient();

const envNum = (key: string, fallback: number) => {
    const raw = process.env[key];
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
};

const MV_SUPERSTAR_THRESHOLD = envNum('MV_SUPERSTAR_THRESHOLD', 70);
const MV_SUPERSTAR_BASE = envNum('MV_SUPERSTAR_BASE', 100_000_000);
const MV_SUPERSTAR_PER_POWER = envNum('MV_SUPERSTAR_PER_POWER', 8_000_000);

const MV_BAND_85_BASE = envNum('MV_BAND_85_BASE', 50_000_000);
const MV_BAND_85_PER_POWER = envNum('MV_BAND_85_PER_POWER', 6_000_000);

const MV_BAND_80_BASE = envNum('MV_BAND_80_BASE', 30_000_000);
const MV_BAND_80_PER_POWER = envNum('MV_BAND_80_PER_POWER', 4_000_000);

const MV_BAND_70_BASE = envNum('MV_BAND_70_BASE', 5_000_000);
const MV_BAND_70_PER_POWER = envNum('MV_BAND_70_PER_POWER', 2_000_000);

const MV_BAND_60_MIN = envNum('MV_BAND_60_MIN', 1_000_000);
const MV_BAND_60_MAX = envNum('MV_BAND_60_MAX', 5_000_000);

const MV_CAP = envNum('MV_CAP', 400_000_000);

/**
 * Calculate overall player rating (1-20) from attributes
 */
export function calculatePlayerOverall(player: Player): number {
    const technical = (player.handling + player.tackling + player.passing + player.shooting + 
                       player.heading + player.dribbling + player.crossing + player.setPieces) / 8;
    const mental = (player.aggression + player.positioning + player.vision + player.bravery + 
                    player.leadership + player.teamwork + player.composure) / 7;
    const physical = (player.pace + player.acceleration + player.stamina + player.strength + 
                      player.agility + player.balance) / 6;
    
    return (technical + mental + physical) / 3;
}

export function applyMarketValuePowerBands(rawValue: number, power: number): number {
    let value = Math.round(rawValue);

    // Main premium rule (now configurable; default starts at 70+)
    if (power >= MV_SUPERSTAR_THRESHOLD) {
        const floor = MV_SUPERSTAR_BASE + Math.round((power - MV_SUPERSTAR_THRESHOLD) * MV_SUPERSTAR_PER_POWER);
        value = Math.max(value, floor);
    } else if (power >= 85) {
        const floor = MV_BAND_85_BASE + Math.round((power - 85) * MV_BAND_85_PER_POWER);
        value = Math.max(value, floor);
    } else if (power >= 80) {
        const floor = MV_BAND_80_BASE + Math.round((power - 80) * MV_BAND_80_PER_POWER);
        value = Math.max(value, floor);
    } else if (power >= 70) {
        const floor = MV_BAND_70_BASE + Math.round((power - 70) * MV_BAND_70_PER_POWER);
        value = Math.max(value, floor);
    } else if (power >= 60) {
        // 60-70 range: configurable clamp
        const t = (power - 60) / 10;
        const floor = Math.round(MV_BAND_60_MIN + t * (MV_BAND_60_MAX - MV_BAND_60_MIN));
        value = Math.max(value, floor);
        value = Math.min(value, MV_BAND_60_MAX);
    }

    return Math.min(value, MV_CAP);
}

/**
 * Update player popularity after match
 * Position-balanced system:
 * - Forwards: Goals (+0.5), Assists (+0.5), MOTM (+1.5)
 * - Defenders: Clean sheet contribution (+0.5), Tackles/Interceptions (+0.3), MOTM (+1.5)
 * - Goalkeepers: Saves/Clean sheet (+0.5), MOTM (+1.5)
 * - All: Appearance (+0.2), Rating bonus (8+: +0.5)
 * - Diminishing returns: gains reduced by 50% when popularity > 80
 * 
 * Negative: Bad form (rating < 4: -1), Red card (-2)
 */
export async function updatePlayerPopularity(
    playerId: string,
    matchStats: {
        goals?: number;
        assists?: number;
        isMotm: boolean;
        played: boolean;
        rating: number;
        redCards: number;
        isImportantMatch?: boolean;
        tackles?: number;
        saves?: number;
        naturalPosition?: string; // For position-specific bonuses
    }
): Promise<number> {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return 0;

    const position = matchStats.naturalPosition || player.naturalPosition;
    const isGK = position === 'GK';
    const isDefender = ['DC', 'DR', 'DL'].includes(position);
    const isMidfield = ['MC', 'AMC', 'DMC', 'MR', 'ML'].includes(position);
    const isForward = position.startsWith('FW');

    let popularityChange = 0;

    // Base: Appearance + Rating bonus (equal for all positions)
    if (matchStats.played) popularityChange += 0.2;
    if (matchStats.rating >= 8) popularityChange += 0.5;
    else if (matchStats.rating >= 7) popularityChange += 0.3;

    // Position-specific bonuses
    if (isGK) {
        // GK: Clean sheet contribution (0.5), Saves (0.2 per 3 saves)
        if (matchStats.saves) {
            const saveBonuses = Math.floor((matchStats.saves || 0) / 3) * 0.2;
            popularityChange += Math.min(0.5, saveBonuses);
        }
    } else if (isDefender) {
        // Defenders: Tackles (+0.3 per 2), Interceptions/Clean sheet (+0.3)
        if (matchStats.tackles) {
            const tackleBonuses = Math.floor((matchStats.tackles || 0) / 2) * 0.3;
            popularityChange += Math.min(0.5, tackleBonuses);
        }
    } else if (isForward || isMidfield) {
        // Forwards & Midfielders: Goals (+0.5), Assists (+0.5)
        if (matchStats.goals && matchStats.goals > 0) {
            popularityChange += Math.min(1.0, matchStats.goals * 0.5); // Max +1.0 per match
        }
        if (matchStats.assists && matchStats.assists > 0) {
            popularityChange += Math.min(0.5, matchStats.assists * 0.5);
        }
    }

    // MOTM (all positions)
    if (matchStats.isMotm) popularityChange += 1.5;

    // Important match bonus (all positions)
    if (matchStats.isImportantMatch) popularityChange += 0.8;

    // Negative changes
    if (matchStats.rating < 4) popularityChange -= 1.0; // Bad form (reduced from 1.5)
    if (matchStats.redCards > 0) popularityChange -= 2; // Red card (reduced from 3)

    // Diminishing returns: gains reduced by 50% when popularity > 80
    if (player.popularity > 80) {
        popularityChange *= 0.5;
    }

    // Update player popularity (clamp 0-100)
    const newPopularity = Math.max(0, Math.min(100, player.popularity + popularityChange));
    
    await prisma.player.update({
        where: { id: playerId },
        data: { popularity: newPopularity }
    });

    return newPopularity;
}

/**
 * Update team reputation based on recent performance
 */
export async function updateTeamReputation(
    teamId: string,
    matchResult: 'win' | 'draw' | 'loss'
): Promise<number> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return 0;

    let reputationChange = 0;

    // Match result impact
    if (matchResult === 'win') reputationChange += 1;
    else if (matchResult === 'draw') reputationChange += 0;
    else reputationChange -= 1.5; // Loss hurts more

    // Check for superstar players (popularity > 80)
    const superstars = await prisma.player.count({
        where: { teamId, popularity: { gte: 80 } }
    });
    if (superstars > 2) reputationChange += 1; // Boost for having superstars

    // Update team reputation (clamp 0-100)
    const newReputation = Math.max(0, Math.min(100, team.reputation + reputationChange));
    
    await prisma.team.update({
        where: { id: teamId },
        data: { reputation: newReputation }
    });

    return newReputation;
}

/**
 * Calculate weekly accounting: revenue and expenses
 */
export async function calculateWeeklyAccounting(teamId: string): Promise<{
    income: number;
    expenses: number;
    netBalance: number;
    breakdown: {
        sponsorship: number;
        ticketSales: number;
        jerseySales: number;
        wages: number;
        maintenance: number;
    };
}> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            players: true,
            league: { select: { level: true } }
        }
    });

    if (!team) {
        throw new Error(`Team ${teamId} not found`);
    }

    // ===== INCOME =====

    // Sponsorship: guaranteed weekly base + reputation scaling
    // Range target: 50,000 (low reputation) -> 200,000 (elite reputation)
    const divisionMultiplier = getDivisionFinanceMultiplier(team.league?.level || 1);
    const sponsorship = (50000 + (team.reputation / 100) * 150000) * divisionMultiplier;

    // Ticket sales are now matchday-based (handled in processMatchFinancials as MATCHDAY events)
    // Keep weekly ticket sales at 0 to avoid double-counting.
    const ticketSales = 0;

    // Jersey sales: based on famous player ratio + average popularity
    const famousPlayers = team.players.filter((p) => p.popularity >= 60).length;
    const totalPopularity = team.players.reduce((sum, p) => sum + p.popularity, 0);
    const avgPopularity = team.players.length > 0 ? totalPopularity / team.players.length : 0;
    const jerseySales = ((famousPlayers * 8000) + (avgPopularity * 200)) * divisionMultiplier;

    const totalIncome = sponsorship + ticketSales + jerseySales;

    // ===== EXPENSES =====

    // Wages: Sum of all player weekly wages
    const wages = team.players.reduce((sum, p) => sum + p.weeklyWage, 0);

    // Maintenance: stadium size × maintenance cost per seat
    const maintenancePerSeat = 0.5;
    const maintenance = team.stadiumCapacity * maintenancePerSeat;

    const totalExpenses = wages + maintenance;

    // ===== NET =====
    const netBalance = totalIncome - totalExpenses;

    return {
        income: Math.round(totalIncome),
        expenses: Math.round(totalExpenses),
        netBalance: Math.round(netBalance),
        breakdown: {
            sponsorship: Math.round(sponsorship),
            ticketSales: Math.round(ticketSales),
            jerseySales: Math.round(jerseySales),
            wages: Math.round(wages),
            maintenance: Math.round(maintenance)
        }
    };
}

/**
 * Evaluate player market value
 * Formula: power² × 1000 × multipliers (age, popularity, club reputation, form)
 * Includes age boost for young players and penalty for older players
 */
export async function evaluateMarketValue(player: Player): Promise<number> {
    // Calculate power
    const attrs: PlayerAttributes = toPlayerAttributes({
        handling: player.handling,
        tackling: player.tackling,
        passing: player.passing,
        shooting: player.shooting,
        heading: player.heading,
        dribbling: player.dribbling,
        setPieces: player.setPieces,
        throw: player.throw,
        aggression: player.aggression,
        positioning: player.positioning,
        vision: player.vision,
        bravery: player.bravery,
        leadership: player.leadership,
        teamwork: player.teamwork,
        composure: player.composure,
        pace: player.pace,
        acceleration: player.acceleration,
        stamina: player.stamina,
        strength: player.strength,
        agility: player.agility,
        balance: player.balance,
        crossing: player.crossing
    });
    
    const natPos = player.naturalPosition.split('_')[0];
    const power = calculatePlayerPower({
        attributes: attrs,
        targetPosition: natPos,
        condition: 100,
        exp: player.exp || 0
    }).powerWithExp;

    // Get team reputation (if player has a team)
    const team = player.teamId ? await prisma.team.findUnique({
        where: { id: player.teamId }
    }) : null;

    // Calculate average rating from match stats
    const matchStats = await prisma.playerMatchStats.findMany({
        where: { playerId: player.id },
        select: { rating: true }
    });
    
    const avgRating = matchStats.length > 0
        ? Number((matchStats.reduce((sum, stat) => sum + stat.rating, 0) / matchStats.length).toFixed(2))
        : 0;

    // Calculate market value with multiple factors
    const basePrice = power * power * 1000;
    const ageMultiplier = player.age <= 25 ? 1.2 : player.age >= 32 ? 0.6 : 1.0;
    
    const playerPopularityMultiplier = 0.8 + (player.popularity / 100) * 1.0;
    const clubReputationMultiplier = 0.7 + ((team?.reputation || 50) / 100) * 0.8;
    
    const formMultiplier = 0.5 + (avgRating / 10) * 1.0;
    
    let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
    marketValue = applyMarketValuePowerBands(marketValue, power);

    return marketValue;
}

/**
 * Check FFP compliance
 */
export async function checkFFPCompliance(teamId: string): Promise<{
    status: 'healthy' | 'warning' | 'danger' | 'critical';
    wagePercentage: number;
    message: string;
}> {
    const accounting = await calculateWeeklyAccounting(teamId);
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { stadiumCapacity: true }
    });

    // Ticket sales moved to matchday events; include conservative estimated matchday income
    // for weekly FFP health calculations.
    const estimatedMatchdayIncome = Math.round((team?.stadiumCapacity || 50000) * 0.3 * 10);
    const effectiveIncome = accounting.income + estimatedMatchdayIncome;

    if (effectiveIncome === 0) {
        return {
            status: 'critical',
            wagePercentage: 100,
            message: 'No income! Immediate action required.'
        };
    }

    const wagePercentage = (accounting.breakdown.wages / effectiveIncome) * 100;

    if (wagePercentage > 90) {
        return {
            status: 'critical',
            wagePercentage: Math.round(wagePercentage),
            message: `CRITICAL: Wages are ${Math.round(wagePercentage)}% of income! Risk of bankruptcy.`
        };
    } else if (wagePercentage > 70) {
        return {
            status: 'danger',
            wagePercentage: Math.round(wagePercentage),
            message: `WARNING: Wages are ${Math.round(wagePercentage)}% of income. Reduce spending or increase revenue.`
        };
    } else if (wagePercentage > 50) {
        return {
            status: 'warning',
            wagePercentage: Math.round(wagePercentage),
            message: `Wages are ${Math.round(wagePercentage)}% of income. Stable but monitor closely.`
        };
    } else {
        return {
            status: 'healthy',
            wagePercentage: Math.round(wagePercentage),
            message: `Healthy financial position: Wages are ${Math.round(wagePercentage)}% of income.`
        };
    }
}

/**
 * Process weekly accounting: deduct expenses, add income, update balance
 */
export async function processWeeklyFinances(teamId: string, week: number): Promise<void> {
    // Idempotency guard: this function may be triggered more than once for the same
    // calendar boundary (e.g., month-change path). If already processed, skip entirely
    // to avoid duplicate balance updates and unique constraint errors.
    const existingWeekRecord = await prisma.clubFinance.findUnique({
        where: {
            teamId_week: {
                teamId,
                week
            }
        }
    });

    if (existingWeekRecord) {
        return;
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
        console.warn(`[Weekly Finance] Team ${teamId} not found, skipping.`);
        return;
    }

    // 1. Handle contract expiration (release free agents)
    const expiredContracts = await handleContractExpiration(teamId);
    if (expiredContracts.releasedCount > 0) {
        console.log(`[Weekly Finance] Week ${week}: Released ${expiredContracts.releasedCount} players to free agency`, expiredContracts.releasedPlayers);
    }

    // 2. Decrement contract weeks for remaining players
    await prisma.player.updateMany({
        where: { teamId },
        data: {
            contractEndWeek: {
                decrement: 1
            }
        }
    });

    const accounting = await calculateWeeklyAccounting(teamId);

    // Update team balance
    const newBalance = team.balance + accounting.netBalance;
    await prisma.team.update({
        where: { id: teamId },
        data: { balance: newBalance }
    });

    // Create/update financial record (defensive against race conditions)
    await prisma.clubFinance.upsert({
        where: {
            teamId_week: {
                teamId,
                week
            }
        },
        create: {
            teamId,
            week,
            balance: newBalance,
            weeklyIncome: accounting.income,
            weeklyExpenses: accounting.expenses
        },
        update: {
            balance: newBalance,
            weeklyIncome: accounting.income,
            weeklyExpenses: accounting.expenses
        }
    });

    // Create financial events (batched: 1 createMany instead of N sequential creates)
    const financialEventsData: { teamId: string; type: string; amount: number; description: string }[] = [];
    if (accounting.breakdown.sponsorship > 0) {
        financialEventsData.push({ teamId, type: 'SPONSORSHIP', amount: accounting.breakdown.sponsorship, description: `Sponsorship income (week ${week})` });
    }
    if (accounting.breakdown.ticketSales > 0) {
        financialEventsData.push({ teamId, type: 'TICKET', amount: accounting.breakdown.ticketSales, description: `Ticket sales (week ${week})` });
    }
    if (accounting.breakdown.jerseySales > 0) {
        financialEventsData.push({ teamId, type: 'JERSEY', amount: accounting.breakdown.jerseySales, description: `Jersey and merchandise sales (week ${week})` });
    }
    if (accounting.breakdown.wages > 0) {
        financialEventsData.push({ teamId, type: 'WAGE', amount: -accounting.breakdown.wages, description: `Player wages (week ${week})` });
    }
    if (accounting.breakdown.maintenance > 0) {
        financialEventsData.push({ teamId, type: 'MAINTENANCE', amount: -accounting.breakdown.maintenance, description: `Stadium maintenance (week ${week})` });
    }
    if (financialEventsData.length > 0) {
        await prisma.financialEvent.createMany({ data: financialEventsData });
    }
}

/**
 * Handle contract expiration: Release players when contract ends (week <= 0)
 * Players become free agents (teamId set to null)
 */
export async function handleContractExpiration(teamId: string): Promise<{
    releasedCount: number;
    releasedPlayers: string[];
}> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: true }
    });

    if (!team) return { releasedCount: 0, releasedPlayers: [] };

    const releasedPlayers: string[] = [];

    // Find players whose contract has expired (contractEndWeek <= 0)
    for (const player of team.players) {
        if (player.contractEndWeek <= 0) {
            // Release player to free agency
            await prisma.player.update({
                where: { id: player.id },
                data: {
                    teamId: null, // Remove from team
                    playerRole: null, // Clear role assignment
                    attackingRolePreset: null,
                    defensiveRolePreset: null,
                    tacticalPosition: null, // Clear tactical position
                    transferStatus: 'NOT_LISTED'
                }
            });

            releasedPlayers.push(`${player.name} (${player.naturalPosition})`);
            console.log(`[Contract] Player released to free agency: ${player.name}`);
        }
    }

    return { releasedCount: releasedPlayers.length, releasedPlayers };
}

/**
 * Monthly EXP decay for aging players
 * Rule:
 * - Players aged 31+ start losing experience
 * - Loss increases with age: -10 at 31, -15 at 32, -20 at 33, etc.
 * - Formula: -(10 + (age - 31) * 5)
 * - EXP can go negative (reducing power)
 * - Prevents multiple decays in the same month using lastExpDecayMonth
 */
export async function processAgeBasedExpDecay(): Promise<void> {
    const settings = await prisma.globalGameSettings.findUnique({
        where: { id: 1 },
        select: { currentDate: true, lastExpDecayMonth: true }
    });

    if (!settings?.currentDate) return;

    const currentMonth = settings.currentDate.getUTCMonth();
    
    // Skip if already processed this month
    if (settings.lastExpDecayMonth === currentMonth) {
        return;
    }

    // Legacy monthly decay is disabled.
    // EXP decay is now applied in seasonal processing (startNewSeason -> applySeasonExpAdjustments)
    // using age table rules from experience.ts.

    // Update the last decay month
    await prisma.globalGameSettings.update({
        where: { id: 1 },
        data: { lastExpDecayMonth: currentMonth }
    });
}

/**
 * Weekly popularity decay for inactive players
 * Rule:
 * - If a player misses 4+ consecutive team matches, lose 2 popularity per week
 * - If player appears in a match, streak resets automatically
 */
export async function processInactivePlayerPopularityDecay(teamId: string): Promise<void> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });

    if (!team || team.players.length === 0) return;

    const recentMatches = await prisma.match.findMany({
        where: {
            isPlayed: true,
            OR: [
                { homeTeamId: teamId },
                { awayTeamId: teamId }
            ]
        },
        orderBy: { date: 'desc' },
        take: 20,
        select: { id: true }
    });

    if (recentMatches.length === 0) return;

    const recentMatchIds = recentMatches.map(m => m.id);
    const stats = await prisma.playerMatchStats.findMany({
        where: {
            matchId: { in: recentMatchIds },
            playerId: { in: team.players.map(p => p.id) }
        },
        select: {
            playerId: true,
            matchId: true,
            minutes: true
        }
    });

    const statMap = new Map<string, number>();
    for (const s of stats) {
        statMap.set(`${s.playerId}:${s.matchId}`, s.minutes);
    }

    const popularityDecayUpdates: { id: string; popularity: number }[] = [];
    for (const player of team.players) {
        let missedStreak = 0;

        for (const match of recentMatches) {
            const minutes = statMap.get(`${player.id}:${match.id}`) ?? 0;
            if (minutes > 0) {
                break;
            }
            missedStreak++;
        }

        if (missedStreak >= 4) {
            const newPopularity = Math.max(0, player.popularity - 2);
            if (newPopularity !== player.popularity) {
                popularityDecayUpdates.push({ id: player.id, popularity: newPopularity });
            }
        }
    }
    if (popularityDecayUpdates.length > 0) {
        await prisma.$transaction(
            popularityDecayUpdates.map(u => prisma.player.update({ where: { id: u.id }, data: { popularity: u.popularity } }))
        );
    }
}

/**
 * Check if player contract is expiring soon
 */
export async function getExpiringContracts(teamId: string): Promise<Player[]> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: true }
    });

    if (!team) return [];

    // Return players expiring within 10 weeks
    return team.players.filter(p => p.contractEndWeek <= 10 && p.contractEndWeek > 0);
}

/**
 * Handle contract renewal: extend for 2 years and apply 25% wage increase
 */
export async function handleContractRenewal(playerId: string, weeks: number = 104): Promise<{
    success: boolean;
    newWage?: number;
    newEndWeek?: number;
    message: string;
}> {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
        return { success: false, message: 'Player not found' };
    }

    // Extend contract for specified weeks (default 2 years = 104 weeks)
    const newWage = Math.round(player.weeklyWage * 1.25);
    const newEndWeek = player.contractEndWeek + weeks;

    await prisma.player.update({
        where: { id: playerId },
        data: {
            weeklyWage: newWage,
            contractEndWeek: newEndWeek
        }
    });

    return {
        success: true,
        newWage,
        newEndWeek,
        message: `Contract renewed: ${player.name} now earns $${newWage} per week (+25% increase) until week ${newEndWeek}`
    };
}

/**
 * Auto-renew contracts for AI teams with smart logic:
 * - Check if player is the best in their position on the team
 * - If best + age <= 30 → Renew contract
 * - If best + age > 30 → Can release (near retirement)
 * - If not best + position depth <= 2 → Renew contract
 * - If not best + position depth > 2 → Can release
 */
export async function autoRenewContracts(teamId: string): Promise<{
    renewed: number;
    failures: number;
    details: string[];
}> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });

    if (!team) return { renewed: 0, failures: 0, details: [] };

    const details: string[] = [];
    let renewed = 0;
    let failures = 0;

    // Group players by position and calculate power
    const playersByPosition = new Map<string, Array<{ player: Player; power: number }>>();
    
    for (const player of team.players) {
        // Skip players with long contracts remaining
        if (player.contractEndWeek > 52) continue;
        
        // Skip retired players
        if (player.isRetired) continue;
        
        const pos = player.naturalPosition.split('_')[0];
        const power = calculatePlayerPower({
            attributes: toPlayerAttributes(player),
            targetPosition: pos,
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;
        
        if (!playersByPosition.has(pos)) {
            playersByPosition.set(pos, []);
        }
        playersByPosition.get(pos)!.push({ player, power });
    }

    // Sort each position by power (highest first)
    for (const [pos, players] of playersByPosition.entries()) {
        players.sort((a, b) => b.power - a.power);
    }

    // Process renewal decisions
    const renewalOps: Array<{ id: string; name: string; newWage: number; newEndWeek: number; reason: string }> = [];
    const releaseOps: Array<{ id: string; name: string; position: string; power: number; age: number; reason: string }> = [];

    for (const [pos, players] of playersByPosition.entries()) {
        for (let i = 0; i < players.length; i++) {
            const { player, power } = players[i];
            const isBestInPosition = i === 0;
            const positionDepth = players.length;
            
            // Decision logic
            let shouldRenew = false;
            let reason = '';
            
            if (isBestInPosition) {
                // Best player in position
                if (player.age <= 30) {
                    shouldRenew = true;
                    reason = `Best ${pos} (Power: ${power.toFixed(1)}, Age: ${player.age})`;
                } else {
                    // Best but old - release for youth
                    releaseOps.push({
                        id: player.id,
                        name: player.name,
                        position: pos,
                        power,
                        age: player.age,
                        reason: `Best ${pos} but age ${player.age} > 30 (near retirement)`
                    });
                    failures++;
                    continue;
                }
            } else {
                // Not best in position
                if (positionDepth <= 2) {
                    shouldRenew = true;
                    reason = `Backup ${pos} (Depth: ${positionDepth}, Power: ${power.toFixed(1)})`;
                } else {
                    // Excess depth - release
                    releaseOps.push({
                        id: player.id,
                        name: player.name,
                        position: pos,
                        power,
                        age: player.age,
                        reason: `Excess ${pos} (Depth: ${positionDepth}, Power: ${power.toFixed(1)})`
                    });
                    failures++;
                    continue;
                }
            }
            
            if (shouldRenew) {
                renewalOps.push({
                    id: player.id,
                    name: player.name,
                    newWage: Math.round(player.weeklyWage * 1.25),
                    newEndWeek: player.contractEndWeek + 104,
                    reason
                });
            }
        }
    }

    // Execute renewals in batch
    if (renewalOps.length > 0) {
        await prisma.$transaction(
            renewalOps.map(r => prisma.player.update({
                where: { id: r.id },
                data: { weeklyWage: r.newWage, contractEndWeek: r.newEndWeek }
            }))
        );
        for (const r of renewalOps) {
            renewed++;
            details.push(`✓ ${r.name}: ${r.reason} → Renewed until week ${r.newEndWeek} ($${r.newWage.toLocaleString()}/week)`);
        }
    }

    // Execute releases in batch
    if (releaseOps.length > 0) {
        await prisma.$transaction(
            releaseOps.map(r => prisma.player.update({
                where: { id: r.id },
                data: {
                    teamId: null,
                    transferStatus: 'FREE_AGENT',
                    askingPrice: null,
                    tacticalPosition: null,
                    contractEndWeek: 0,
                    playerRole: null,
                    attackingRolePreset: null,
                    defensiveRolePreset: null
                }
            }))
        );
        for (const r of releaseOps) {
            details.push(`✗ ${r.name}: ${r.reason} → Released to free agency`);
        }
    }

    if (renewalOps.length === 0 && releaseOps.length === 0) {
        details.push('No contract actions needed');
    }

    return { renewed, failures, details };
}

export default {
    calculatePlayerOverall,
    updatePlayerPopularity,
    updateTeamReputation,
    calculateWeeklyAccounting,
    evaluateMarketValue,
    checkFFPCompliance,
    processWeeklyFinances,
    processInactivePlayerPopularityDecay,
    processAgeBasedExpDecay,
    getExpiringContracts,
    handleContractRenewal
};
