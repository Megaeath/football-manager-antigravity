import prisma from '@/lib/prisma';
import type { GlobalGameSettings, Prisma } from '@prisma/client';
import { generateSeasonFixtures } from './fixtureGenerator';
import { processWeeklyFinances, autoRenewContracts, processInactivePlayerPopularityDecay, processAgeBasedExpDecay } from '../engine/financial';
import { applyPromotionRelegation, applySeasonExpAdjustments, applySeasonRewards } from './seasonAwards';
import { applyCupRewards } from './cupRewards';
import { processBiddingRules, processAcceptedTransfers } from '../engine/market';
import { processWeeklyTraining } from './training';
import { processAllAITeamsWeeklyTraining, upgradeAITeamFacilities } from './aiTrainingService';
import { ensureDivisionLeagues } from './divisionSystem';
import { initializeCupTournamentForSeason } from './SwissTournament';

const TH_FIRST_NAMES = ['Anan', 'Somchai', 'Kittipong', 'Narin', 'Phumin', 'Thanin', 'Soran', 'Kawin', 'Pinit', 'Chaiyaphum'];
const TH_LAST_NAMES = ['Srisuk', 'Wattanakul', 'Boonmee', 'Rattanakorn', 'Sombat', 'Ritthichai', 'Chaiyo', 'Sanguan', 'Prasert', 'Kanan'];
const INTL_FIRST_NAMES = ['Luca', 'Mateo', 'Noah', 'Ethan', 'Hugo', 'Leo', 'Milan', 'Oscar', 'Rafael', 'Adrian'];
const INTL_LAST_NAMES = ['Silva', 'Fernandez', 'Martinez', 'Kovacic', 'Rossi', 'Novak', 'Almeida', 'Costa', 'Muller', 'Nielsen'];
const PLAYER_POSITIONS = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomName = () => {
    // Keep local flavor but avoid 100% Thai names every season
    const useThaiPool = Math.random() < 0.1;
    const firstNames = useThaiPool ? TH_FIRST_NAMES : INTL_FIRST_NAMES;
    const lastNames = useThaiPool ? TH_LAST_NAMES : INTL_LAST_NAMES;
    return `${firstNames[randomInt(0, firstNames.length - 1)]} ${lastNames[randomInt(0, lastNames.length - 1)]}`;
};

type YouthAttributes = {
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
    throw: number;
    aggression: number;
    positioning: number;
    vision: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    composure: number;
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    balance: number;
};

function generateYouthAttributes(naturalPosition: string, quality: 'talented' | 'normal' = 'normal'): YouthAttributes {
    const base: YouthAttributes = {
        handling: randomInt(5, 17),
        tackling: randomInt(5, 17),
        passing: randomInt(5, 17),
        shooting: randomInt(5, 17),
        heading: randomInt(5, 17),
        dribbling: randomInt(5, 17),
        crossing: randomInt(5, 17),
        setPieces: randomInt(5, 17),
        throw: randomInt(5, 17),
        aggression: randomInt(5, 17),
        positioning: randomInt(5, 17),
        vision: randomInt(5, 17),
        bravery: randomInt(5, 17),
        leadership: randomInt(5, 17),
        teamwork: randomInt(5, 17),
        composure: randomInt(5, 17),
        pace: randomInt(5, 17),
        acceleration: randomInt(5, 17),
        stamina: randomInt(7, 13),
        strength: randomInt(5, 17),
        agility: randomInt(5, 17),
        balance: randomInt(5, 17)
    };

    // Position-focused profiles: allow good prospects but keep strengths relevant to role
    const applyRange = (stats: Array<keyof YouthAttributes>, min: number, max: number) => {
        for (const stat of stats) base[stat] = randomInt(min, max);
    };

    if (naturalPosition === 'GK') {
        applyRange(['handling', 'positioning', 'agility', 'composure', 'throw'], 12, 18);
        applyRange(['tackling', 'crossing', 'dribbling', 'shooting', 'heading'], 1, 6);
        applyRange(['passing', 'vision', 'leadership', 'bravery', 'strength', 'balance'], 6, 12);
        applyRange(['pace', 'acceleration', 'stamina'], 4, 10);
    } else if (naturalPosition === 'DC') {
        applyRange(['tackling', 'heading', 'strength', 'positioning', 'bravery'], 12, 18);
        applyRange(['passing', 'composure', 'leadership', 'aggression'], 8, 14);
        applyRange(['shooting', 'dribbling', 'crossing', 'handling'], 2, 8);
        applyRange(['pace', 'acceleration', 'stamina', 'agility', 'balance'], 7, 13);
    } else if (['DR', 'DL'].includes(naturalPosition)) {
        applyRange(['tackling', 'pace', 'acceleration', 'stamina', 'crossing'], 11, 17);
        applyRange(['passing', 'positioning', 'teamwork', 'agility', 'balance'], 8, 14);
        applyRange(['shooting', 'handling', 'heading'], 3, 9);
    } else if (['DMC'].includes(naturalPosition)) {
        applyRange(['tackling', 'positioning', 'stamina', 'passing', 'strength'], 11, 17);
        applyRange(['vision', 'teamwork', 'composure', 'aggression'], 8, 14);
        applyRange(['shooting', 'crossing', 'handling'], 3, 9);
    } else if (['MC', 'AMC'].includes(naturalPosition)) {
        applyRange(['passing', 'vision', 'teamwork', 'composure'], 12, 18);
        applyRange(['dribbling', 'stamina', 'positioning', 'setPieces'], 9, 15);
        applyRange(['tackling', 'heading', 'handling'], 3, 9);
    } else if (['MR', 'ML', 'AMR', 'AML'].includes(naturalPosition)) {
        applyRange(['dribbling', 'crossing', 'pace', 'acceleration'], 12, 18);
        applyRange(['passing', 'agility', 'balance', 'stamina'], 9, 15);
        applyRange(['handling', 'heading', 'strength'], 3, 9);
    } else if (['FWC', 'FWR', 'FWL', 'FW'].includes(naturalPosition)) {
        applyRange(['shooting', 'composure', 'positioning', 'pace', 'acceleration'], 12, 18);
        applyRange(['heading', 'dribbling', 'agility', 'balance'], 8, 14);
        applyRange(['tackling', 'handling', 'crossing'], 2, 8);
    }

    // Quality boost for talented prospects
    if (quality === 'talented') {
        const boostKeys: Array<keyof YouthAttributes> = naturalPosition === 'GK'
            ? ['handling', 'positioning', 'agility', 'composure', 'throw', 'vision']
            : ['passing', 'vision', 'composure', 'pace', 'acceleration', 'stamina', 'positioning', 'agility'];

        // Talented: +2 to +6 boost on key attributes
        for (const key of boostKeys) {
            base[key] = Math.min(20, base[key] + randomInt(2, 6));
        }
    }
    // Normal: no boost (base attributes only)

    return base;
}

async function generateMonthlyFreeAgentProspects(currentDate: Date, count: number = 3) {
    let talentedCount = 0;
    let normalCount = 0;
    const month = currentDate.getUTCMonth() + 1;
    const canGenerateTalented = month % 2 === 0; // talented only in even months: 2,4,...,12
    const talentedSlots = canGenerateTalented ? 1 : 0; // even month: exactly 1 talented, odd month: 0

    for (let i = 0; i < count; i++) {
        const position = PLAYER_POSITIONS[randomInt(0, PLAYER_POSITIONS.length - 1)];
        const age = randomInt(16, 19);
        const quality: 'talented' | 'normal' = i < talentedSlots ? 'talented' : 'normal';

        await prisma.player.create({
            data: {
                teamId: null, // free agent
                name: randomName(),
                age,
                naturalPosition: position,
                retirementAge: randomInt(31, 33),
                morale: 100,
                condition: 100,
                isRetired: false,
                birthDate: new Date(Date.UTC(currentDate.getUTCFullYear() - age, randomInt(0, 11), randomInt(1, 28))),
                popularity: randomInt(8, 35),
                weeklyWage: randomInt(3000, 12000),
                transferStatus: 'NOT_LISTED',
                squadStatus: 'BACKUP',
                ...generateYouthAttributes(position, quality)
            }
        });

        if (quality === 'talented') talentedCount++;
        else normalCount++;
    }

    console.log(`[GameTime] Added ${count} free-agent youth prospects (age 16-19): talented=${talentedCount}, normal=${normalCount}, month=${month}`);
}

export async function getGameTime() {
    let settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
        // Try to find a default user team (e.g., Red FC)
        const defaultTeam = await prisma.team.findFirst({
            where: { name: { contains: 'Red FC' } }
        });

        settings = await prisma.globalGameSettings.upsert({
            where: { id: 1 },
            update: {
                currentDate: new Date('2026-01-01'),
                currentSeason: 1,
                isConfigured: true,
                userTeamId: defaultTeam?.id || null
            },
            create: {
                id: 1,
                currentDate: new Date('2026-01-01'),
                currentSeason: 1,
                isConfigured: true,
                userTeamId: defaultTeam?.id || null
            }
        });

        // Initial fixture generation for all leagues
        const leagues = await ensureDivisionLeagues(1);
        for (const league of leagues) {
            await generateSeasonFixtures(league.id, 1, 2026);
        }
        await initializeCupTournamentForSeason(1);
    } else {
        await ensureDivisionLeagues(settings.currentSeason);

        // Ensure cup exists for current season (safe no-op when already initialized)
        try {
            await initializeCupTournamentForSeason(settings.currentSeason);
        } catch (error) {
            console.error('[GameTime] Failed to ensure cup tournament for current season:', error);
        }
    }
    return settings;
}

export async function advanceDay() {
    const settings = await getGameTime();
    const nextDate = new Date(settings.currentDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    // 1. Age update (UTC-safe): recalculate from birthDate and correct stale ages.
    // NOTE: SQLite `strftime` can return NULL for ISO strings like `2011-09-10T00:00:00.000Z`.
    // We avoid SQL date parsing and compute age in TypeScript using UTC fields.
    const playersForAgeUpdate = await prisma.player.findMany({
        where: { isRetired: false },
        select: { id: true, name: true, age: true, birthDate: true }
    });

    const getAgeAtDateUTC = (birthDate: Date, atDate: Date): number => {
        const yearDiff = atDate.getUTCFullYear() - birthDate.getUTCFullYear();
        const atMonth = atDate.getUTCMonth();
        const birthMonth = birthDate.getUTCMonth();
        const atDay = atDate.getUTCDate();
        const birthDay = birthDate.getUTCDate();
        const beforeBirthday = atMonth < birthMonth || (atMonth === birthMonth && atDay < birthDay);
        return Math.max(0, yearDiff - (beforeBirthday ? 1 : 0));
    };

    const ageUpdateOps: { id: string; newAge: number; name: string; oldAge: number }[] = [];
    for (const p of playersForAgeUpdate) {
        const correctedAge = getAgeAtDateUTC(p.birthDate, nextDate);
        if (correctedAge !== p.age) {
            ageUpdateOps.push({ id: p.id, newAge: correctedAge, name: p.name, oldAge: p.age });
        }
    }
    if (ageUpdateOps.length > 0) {
        await prisma.$transaction(
            ageUpdateOps.map(u => prisma.player.update({ where: { id: u.id }, data: { age: u.newAge } }))
        );
        for (const u of ageUpdateOps) {
            if (u.newAge > u.oldAge) {
                console.log(`Birthday! ${u.name} is now ${u.newAge}`);
            } else {
                console.log(`[AgeCorrection] ${u.name}: ${u.oldAge} -> ${u.newAge}`);
            }
        }
    }

    // 2. Daily Fitness Recovery (based on stamina with randomness)
    const activePlayers = await prisma.player.findMany({
        where: { isRetired: false },
        select: { id: true, condition: true, stamina: true }
    });

    const conditionUpdates: { id: string; condition: number }[] = [];
    for (const p of activePlayers) {
        if (p.condition >= 100) continue;

        const staminaFactor = p.stamina / 20;
        // Recovery goal (from ~60 condition, over ~5 days between matches):
        //   stamina=20 → avg ~7.2/day → ~95-100 ✓
        //   stamina=14 → avg ~6.0/day → ~90 ✓
        //   stamina=10 → avg ~5.2/day → ~86
        //   stamina=5  → avg ~4.2/day → ~81
        const baseRecovery = 2 + staminaFactor * 4; // stamina=0:2, stamina=10:4, stamina=14:4.8, stamina=20:6
        const variance = Math.random() * 2;          // 0-2
        const bonus = Math.random() < 0.1 ? 1 + Math.random() * 2 : 0; // 10% chance of 1-3 bonus
        const recovery = baseRecovery + variance + bonus;
        conditionUpdates.push({ id: p.id, condition: Math.min(100, Math.round(p.condition + recovery)) });
    }
    if (conditionUpdates.length > 0) {
        await prisma.$transaction(
            conditionUpdates.map(u => prisma.player.update({ where: { id: u.id }, data: { condition: u.condition } }))
        );
    }

    // Process expired bids and transfers (daily)
    try {
        await processBiddingRules();
        await processAcceptedTransfers();

        // Process age-based EXP decay for players 31+ (monthly trigger, prevents multiple per month)
        await processAgeBasedExpDecay();
    } catch (error) {
        console.error('Error processing market rules:', error);
    }

    // Check if it's a new year (New Season)
    const isNewYear = nextDate.getUTCFullYear() > settings.currentDate.getUTCFullYear();

    console.log('[GameTime] Advancing from', settings.currentDate.toISOString(), 'to', nextDate.toISOString());
    console.log('[GameTime] Is new year?', isNewYear);

    // Check if it's a new week (Sunday to Sunday) - process finances every week
    const currentWeek = Math.floor(settings.currentDate.getUTCDate() / 7);
    const nextWeek = Math.floor(nextDate.getUTCDate() / 7);
    const weekChanged = nextWeek !== currentWeek || nextDate.getUTCMonth() !== settings.currentDate.getUTCMonth();

    if (weekChanged) {
        const weekKey = Math.floor(nextDate.getTime() / (1000 * 60 * 60 * 24 * 7));

        // Weekly injury recovery progression
        await prisma.player.updateMany({
            where: { injuryWeeksRemaining: { gt: 0 } },
            data: { injuryWeeksRemaining: { decrement: 1 } }
        });
        await prisma.player.updateMany({
            where: { injuryWeeksRemaining: 0, injurySeverity: { not: null } },
            data: { injurySeverity: null }
        });

        // Process weekly finances for all teams
        const allTeams = await prisma.team.findMany();
        for (const team of allTeams) {
            try {
                await processWeeklyFinances(team.id, weekKey);
                await processInactivePlayerPopularityDecay(team.id);
                // Auto-renew contracts for AI teams (if not user team)
                if (team.id !== settings.userTeamId) {
                    await autoRenewContracts(team.id);
                }
            } catch (error) {
                console.error(`Failed to process financials for team ${team.id}:`, error);
            }
        }

        // Training: process user team
        if (settings.userTeamId) {
            try {
                await processWeeklyTraining(settings.userTeamId, weekKey);
            } catch (error) {
                console.error(`Failed to process weekly training for team ${settings.userTeamId}:`, error);
            }
        }

        // Training: process all AI teams (init slots + weekly gain, parallel)
        try {
            await processAllAITeamsWeeklyTraining(weekKey, settings.userTeamId);
        } catch (error) {
            console.error('[AI Training] Failed weekly processing:', error);
        }

    }

    // Trigger monthly free-agent youth generation on day 15
    const isProspectGenerationDay = nextDate.getUTCDate() === 15;
    if (isProspectGenerationDay) {
        try {
            console.log('[GameTime] Generating monthly free-agent youth prospects (3 players) on day 15...');
            await generateMonthlyFreeAgentProspects(nextDate, 3);

        } catch (error) {
            console.error('[GameTime] Error generating monthly free-agent prospects:', error);
        }
    }

    // Distributed AI Market Movements - process overdue teams daily
    try {
        // Find teams that haven't been processed in the last 30 days
        // Find teams that haven't been processed in the last 14 days
        const fourteenDaysAgo = new Date(nextDate);
        fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

        const overdueTeams = await prisma.team.findMany({
            where: {
                id: { not: settings.userTeamId || undefined },
                OR: [
                    { lastAIMarketProcessedDate: null },
                    { lastAIMarketProcessedDate: { lt: fourteenDaysAgo } }
                ]
            },
            orderBy: { lastAIMarketProcessedDate: 'asc' },
            select: { id: true }
        });

        if (overdueTeams.length > 0) {
            // Shuffle and take batch from .env (default 5)
            const batchSize = parseInt(process.env.AI_MARKET_BATCH_SIZE || '5', 10);
            const shuffled = overdueTeams.sort(() => Math.random() - 0.5);
            const toProcess = shuffled.slice(0, Math.min(batchSize, shuffled.length));

            console.log(`[GameTime] Processing AI Market for ${toProcess.length}/${overdueTeams.length} overdue teams...`);

            const { processAIMarketForTeam } = await import('./aiMarketService');

            // Process in series with atomic date updates to avoid race conditions
            for (const team of toProcess) {
                try {
                    await processAIMarketForTeam(team.id);
                    // Update timestamp only after successful processing
                    await prisma.team.update({
                        where: { id: team.id },
                        data: { lastAIMarketProcessedDate: nextDate }
                    });
                } catch (teamError) {
                    console.error(`[GameTime] Failed to process AI market for team ${team.id}:`, teamError);
                    // Don't update timestamp on failure - team will be retried next day
                }
            }

            console.log('[GameTime] ✓ Distributed AI Market processing complete');
        }
    } catch (error) {
        console.error('[GameTime] Error in distributed AI Market processing:', error);
    }

    if (isNewYear) {
        console.log('[GameTime] *** STARTING NEW SEASON ***');
        return await startNewSeason(settings, nextDate);
    }


    return await prisma.globalGameSettings.update({
        where: { id: settings.id },
        data: { currentDate: nextDate }
    });
}

async function startNewSeason(settings: GlobalGameSettings, nextDate: Date) {
    const currentSeason = settings.currentSeason;
    const nextSeason = currentSeason + 1;
    const currentYear = settings.currentDate.getUTCFullYear();
    const nextYear = currentYear + 1;
    const seasonStartDate = new Date(Date.UTC(nextYear, 1, 1));

    console.log('[StartNewSeason] Current season:', currentSeason, 'Next season:', nextSeason);
    console.log('[StartNewSeason] Current year:', currentYear, 'Next year:', nextYear);
    console.log('[StartNewSeason] Season start date:', seasonStartDate.toISOString());

    // 1. Archive Standings
    const leagues = await ensureDivisionLeagues(currentSeason);
    for (const league of leagues) {
        const teams = await prisma.team.findMany({
            where: { leagueId: league.id },
            include: {
                homeMatches: { where: { season: currentSeason, isPlayed: true, competitionType: 'LEAGUE' } },
                awayMatches: { where: { season: currentSeason, isPlayed: true, competitionType: 'LEAGUE' } }
            }
        });

        const standings = teams.map(team => {
            let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;
            const processMatch = (homeScore: number, awayScore: number, isHome: boolean) => {
                played++;
                gf += isHome ? homeScore : awayScore; ga += isHome ? awayScore : homeScore;
                const myScore = isHome ? homeScore : awayScore; const opScore = isHome ? awayScore : homeScore;
                if (myScore > opScore) { won++; points += 3; } else if (myScore === opScore) { drawn++; points += 1; } else { lost++; }
            };
            team.homeMatches.forEach(m => m.homeScore !== null && m.awayScore !== null && processMatch(m.homeScore, m.awayScore, true));
            team.awayMatches.forEach(m => m.homeScore !== null && m.awayScore !== null && processMatch(m.homeScore, m.awayScore, false));
            return { id: team.id, name: team.name, played, won, drawn, lost, gf, ga, gd: gf - ga, points };
        });
        standings.sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf));

        await prisma.seasonHistory.create({
            data: {
                leagueId: league.id,
                season: currentSeason,
                year: currentYear,
                standings: JSON.stringify(standings),
                winnerId: standings[0]?.id
            }
        });
    }

    // 2. Apply End-of-Season Rewards
    await applySeasonRewards(currentSeason, currentYear);
    await applyCupRewards(currentSeason, currentYear);

    // 2.1 Apply end-of-season EXP rules (age efficiency, seasonal cap, bonuses/penalties, annual decay)
    await applySeasonExpAdjustments(currentSeason, currentYear);

    // 2.2 Promotion / relegation between divisions
    await applyPromotionRelegation(currentSeason);

    // 3. Reset Player Season Stats
    await prisma.player.updateMany({
        data: {
            goals: 0,
            assists: 0,
            apps: 0,
            yellowCards: 0,
            redCards: 0,
            avgRating: 0
        }
    });

    // 4. Increment League Seasons and Generate New Fixtures
    console.log('[StartNewSeason] Step 4: Generating fixtures for', leagues.length, 'leagues');
    for (const league of leagues) {
        await prisma.league.update({
            where: { id: league.id },
            data: { season: nextSeason }
        });
        console.log('[StartNewSeason] Generating fixtures for league:', league.id, 'Season:', nextSeason, 'Year:', nextYear);
        await generateSeasonFixtures(league.id, nextSeason, nextYear);
    }

    // Initialize cup tournament after all league fixtures are generated
    await initializeCupTournamentForSeason(nextSeason);

    // 5. Handle Retirements
    const playersToRetire = await prisma.player.findMany({
        where: {
            isRetired: false,
            OR: [
                { age: { gte: 31 } } // Potential retirement starts at 31
            ]
        }
    });

    const retiredPlayerIds: string[] = [];
    const retirementReplacements: Prisma.PlayerCreateManyInput[] = [];
    for (const player of playersToRetire) {
        if (player.age >= player.retirementAge) {
            retiredPlayerIds.push(player.id);
            console.log(`Player Retired: ${player.name} (Age: ${player.age})`);
            const youthAge = randomInt(18, 22);
            retirementReplacements.push({
                teamId: player.teamId,
                name: randomName(),
                age: youthAge,
                naturalPosition: player.naturalPosition,
                retirementAge: randomInt(31, 33),
                morale: 100,
                condition: 100,
                isRetired: false,
                birthDate: new Date(Date.UTC(nextYear - youthAge, randomInt(0, 11), randomInt(1, 28))),
                ...generateYouthAttributes(player.naturalPosition)
            });
        }
    }
    if (retiredPlayerIds.length > 0) {
        await prisma.player.updateMany({ where: { id: { in: retiredPlayerIds } }, data: { isRetired: true } });
        await prisma.player.createMany({ data: retirementReplacements });
    }

    // 6. Add Young Prospects (based on ranking)
    console.log('[StartNewSeason] Step 6: Adding young prospects based on league ranking');
    const POSITIONS = PLAYER_POSITIONS;
    const allTeams = await prisma.team.findMany();

    // Get standings from last season
    const lastSeason = currentSeason - 1;
    type StandingEntry = { teamId: string; ranking: number; points: number };
    let standings: StandingEntry[] = [];

    if (lastSeason > 0) {
        const matches = await prisma.match.findMany({
            where: { season: lastSeason, isPlayed: true, competitionType: 'LEAGUE' }
        });

        // Calculate standings (points per team)
        const pointsMap: Record<string, number> = {};

        for (const match of matches) {
            if (!pointsMap[match.homeTeamId]) pointsMap[match.homeTeamId] = 0;
            if (!pointsMap[match.awayTeamId]) pointsMap[match.awayTeamId] = 0;

            if (match.homeScore! > match.awayScore!) {
                pointsMap[match.homeTeamId] += 3;
            } else if (match.homeScore! < match.awayScore!) {
                pointsMap[match.awayTeamId] += 3;
            } else {
                pointsMap[match.homeTeamId] += 1;
                pointsMap[match.awayTeamId] += 1;
            }
        }

        // Sort by points (descending) and assign rankings
        const sorted = Object.entries(pointsMap)
            .sort(([, a], [, b]) => b - a)
            .map(([teamId, points], idx) => ({ teamId, points, ranking: idx + 1 }));

        standings = sorted;
    }

    // Determine number of talented youth based on ranking
    // Best ranking (1st) = 1 talented + 2 normal
    // Worst ranking (last) = 3 talented + 0 normal
    // Linear progression between ranks
    const getTalentedYouthCount = (ranking: number, totalTeams: number): number => {
        // Formula: Linear interpolation from 1 (best) to 3 (worst)
        // rank 1 → 1 talented, rank 20 → 3 talented
        const normalized = (ranking - 1) / (totalTeams - 1); // 0 to 1
        const talented = Math.round(1 + (normalized * 2)); // 1 to 3
        return Math.max(1, Math.min(3, talented));
    };

    // All teams get 3 youth players
    const YOUTH_PLAYERS_PER_TEAM = 3;

    const allYouthToCreate: Prisma.PlayerCreateManyInput[] = [];
    for (const team of allTeams) {
        const teamStanding = standings.find(s => s.teamId === team.id);
        const ranking = teamStanding?.ranking || allTeams.indexOf(team) + 1;
        const talentedCount = getTalentedYouthCount(ranking, allTeams.length);
        const normalCount = YOUTH_PLAYERS_PER_TEAM - talentedCount;

        // Add talented youth players
        for (let i = 0; i < talentedCount; i++) {
            const randomPosition = POSITIONS[randomInt(0, POSITIONS.length - 1)];
            const youthAge = randomInt(16, 20);
            allYouthToCreate.push({
                teamId: team.id,
                name: randomName(),
                age: youthAge,
                naturalPosition: randomPosition,
                retirementAge: randomInt(31, 33),
                morale: 100,
                condition: 100,
                isRetired: false,
                birthDate: new Date(Date.UTC(nextYear - youthAge, randomInt(0, 11), randomInt(1, 28))),
                popularity: randomInt(10, 30),
                weeklyWage: randomInt(5000, 15000),
                ...generateYouthAttributes(randomPosition, 'talented')
            });
        }

        // Add normal youth players (fill remaining slots)
        for (let i = 0; i < normalCount; i++) {
            const randomPosition = POSITIONS[randomInt(0, POSITIONS.length - 1)];
            const youthAge = randomInt(16, 20);
            allYouthToCreate.push({
                teamId: team.id,
                name: randomName(),
                age: youthAge,
                naturalPosition: randomPosition,
                retirementAge: randomInt(31, 33),
                morale: 100,
                condition: 100,
                isRetired: false,
                birthDate: new Date(Date.UTC(nextYear - youthAge, randomInt(0, 11), randomInt(1, 28))),
                popularity: randomInt(10, 30),
                weeklyWage: randomInt(5000, 15000),
                ...generateYouthAttributes(randomPosition, 'normal')
            });
        }

        console.log(`[StartNewSeason] Added ${YOUTH_PLAYERS_PER_TEAM} youth to ${team.name} (Ranking: ${ranking}) - ${talentedCount} talented, ${normalCount} normal`);
    }
    if (allYouthToCreate.length > 0) {
        await prisma.player.createMany({ data: allYouthToCreate });
    }

    // 6.5 AI Training: upgrade facilities based on season-end reputation + balance
    console.log('[StartNewSeason] Step 6.5: AI Training Facility Upgrades');
    try {
        await upgradeAITeamFacilities(settings.userTeamId);
    } catch (error) {
        console.error('[StartNewSeason] Failed AI training facility upgrades:', error);
    }

    // 7. AI Role & Tactical Position Auto-Assignment
    const finalDate = nextDate ?? seasonStartDate;
    console.log('[StartNewSeason] Step 7: AI Role Auto-Assignment');

    // Auto-assign player roles for all AI teams
    try {
        const { autoAssignRolesForAllAITeams } = await import('./aiRoleSelector');
        const teamsProcessed = await autoAssignRolesForAllAITeams(settings.userTeamId || undefined);
        console.log(`[StartNewSeason] Auto-assigned roles for ${teamsProcessed} AI teams`);
    } catch (error) {
        console.error('[StartNewSeason] Failed to auto-assign AI roles:', error);
    }

    // Auto-assign tactical positions for all AI teams
    console.log('[StartNewSeason] Step 7b: AI Tactical Position Auto-Assignment');
    try {
        const { autoAssignTacticalPositionsForAllAITeams } = await import('./autoTacticalPositionSelector');
        const teamsProcessed = await autoAssignTacticalPositionsForAllAITeams(settings.userTeamId || undefined);
        console.log(`[StartNewSeason] Auto-assigned tactical positions for ${teamsProcessed} AI teams`);
    } catch (error) {
        console.error('[StartNewSeason] Failed to auto-assign tactical positions:', error);
    }

    console.log('[StartNewSeason] Step 8: Updating global settings');
    console.log('[StartNewSeason] Final date:', finalDate.toISOString());
    console.log('[StartNewSeason] New season:', nextSeason);

    const result = await prisma.globalGameSettings.update({
        where: { id: settings.id },
        data: {
            currentDate: finalDate,
            currentSeason: nextSeason
        }
    });

    console.log('[StartNewSeason] *** NEW SEASON STARTED SUCCESSFULLY ***');
    return result;
}
