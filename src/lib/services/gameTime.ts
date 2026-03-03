import prisma from '@/lib/prisma';
import type { GlobalGameSettings } from '@prisma/client';
import { generateSeasonFixtures } from './fixtureGenerator';
import { processWeeklyFinances, autoRenewContracts, processInactivePlayerPopularityDecay, processAgeBasedExpDecay } from '../engine/financial';
import { applySeasonRewards } from './seasonAwards';
import { processBiddingRules } from '../engine/market';

const TH_FIRST_NAMES = ['Anan', 'Somchai', 'Kittipong', 'Narin', 'Phumin', 'Thanin', 'Soran', 'Kawin', 'Pinit', 'Chaiyaphum'];
const TH_LAST_NAMES = ['Srisuk', 'Wattanakul', 'Boonmee', 'Rattanakorn', 'Sombat', 'Ritthichai', 'Chaiyo', 'Sanguan', 'Prasert', 'Kanan'];
const INTL_FIRST_NAMES = ['Luca', 'Mateo', 'Noah', 'Ethan', 'Hugo', 'Leo', 'Milan', 'Oscar', 'Rafael', 'Adrian'];
const INTL_LAST_NAMES = ['Silva', 'Fernandez', 'Martinez', 'Kovacic', 'Rossi', 'Novak', 'Almeida', 'Costa', 'Muller', 'Nielsen'];

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

function generateYouthAttributes(naturalPosition: string, quality: 'normal' | 'talented' = 'normal'): YouthAttributes {
    const base: YouthAttributes = {
        handling: randomInt(5, 11),
        tackling: randomInt(5, 11),
        passing: randomInt(5, 11),
        shooting: randomInt(5, 11),
        heading: randomInt(5, 11),
        dribbling: randomInt(5, 11),
        crossing: randomInt(5, 11),
        setPieces: randomInt(5, 11),
        throw: randomInt(5, 11),
        aggression: randomInt(5, 11),
        positioning: randomInt(5, 11),
        vision: randomInt(5, 11),
        bravery: randomInt(5, 11),
        leadership: randomInt(5, 11),
        teamwork: randomInt(5, 11),
        composure: randomInt(5, 11),
        pace: randomInt(5, 11),
        acceleration: randomInt(5, 11),
        stamina: randomInt(7, 13),
        strength: randomInt(5, 11),
        agility: randomInt(5, 11),
        balance: randomInt(5, 11)
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

    // Talented prospects: boost mainly relevant profile stats (not every stat)
    if (quality === 'talented') {
        const boostKeys: Array<keyof YouthAttributes> = naturalPosition === 'GK'
            ? ['handling', 'positioning', 'agility', 'composure', 'throw', 'vision']
            : ['passing', 'vision', 'composure', 'pace', 'acceleration', 'stamina', 'positioning', 'agility'];

        for (const key of boostKeys) {
            base[key] = Math.min(20, base[key] + randomInt(1, 3));
        }
    }

    return base;
}

export async function getGameTime() {
    let settings = await prisma.globalGameSettings.findFirst();
    if (!settings) {
        // Try to find a default user team (e.g., Red FC)
        const defaultTeam = await prisma.team.findFirst({
            where: { name: { contains: 'Red FC' } }
        });

        settings = await prisma.globalGameSettings.create({
            data: {
                currentDate: new Date('2026-01-01'),
                currentSeason: 1,
                isConfigured: true,
                userTeamId: defaultTeam?.id || null
            }
        });

        // Initial fixture generation for all leagues
        const leagues = await prisma.league.findMany();
        for (const league of leagues) {
            await generateSeasonFixtures(league.id, 1, 2026);
        }
    }
    return settings;
}

export async function advanceDay() {
    const settings = await getGameTime();
    const nextDate = new Date(settings.currentDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    // 1. Birthday Check
    const monthDay = `${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
    const birthdayPlayers: Array<{ id: string; name: string; age: number }> = await prisma.$queryRawUnsafe(
        `SELECT id, name, age FROM Player WHERE strftime('%m-%d', birthDate) = ? AND isRetired = 0`,
        monthDay
    );

    for (const p of birthdayPlayers) {
        await prisma.player.update({
            where: { id: p.id },
            data: { age: p.age + 1 }
        });
        console.log(`Birthday! ${p.name} is now ${p.age + 1}`);
    }

    // 2. Daily Fitness Recovery (based on stamina with randomness)
    const activePlayers = await prisma.player.findMany({
        where: { isRetired: false },
        select: { id: true, condition: true, stamina: true }
    });

    for (const p of activePlayers) {
        if (p.condition >= 100) continue;

        const staminaFactor = p.stamina / 20;
        const baseRecovery = 2 + staminaFactor * 2;
        const variance = Math.random() * 1; // 0 - 4
        const bonus = Math.random() < 0.15 ? 1 + Math.random() * 1 : 0; // occasional big recovery
        const recovery = baseRecovery + variance + bonus;

        const newCondition = Math.min(100, Math.round(p.condition + recovery));
        await prisma.player.update({
            where: { id: p.id },
            data: { condition: newCondition }
        });
    }

    // Process expired bids and transfers
    try {
        await processBiddingRules();

        // Process age-based EXP decay for players 31+ (monthly trigger, prevents multiple per month)
        await processAgeBasedExpDecay();

        // Trigger AI Market Movements on the 1st of the month
        if (nextDate.getUTCDate() === 1) {
            const { processAIMarketMovements } = await import('./aiMarketService');
            await processAIMarketMovements();
        }
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
        // Process weekly finances for all teams
        const allTeams = await prisma.team.findMany();
        for (const team of allTeams) {
            try {
                await processWeeklyFinances(team.id, Math.floor(nextDate.getTime() / (1000 * 60 * 60 * 24 * 7)));
                await processInactivePlayerPopularityDecay(team.id);
                // Auto-renew contracts for AI teams (if not user team)
                const settings = await getGameTime();
                if (team.id !== settings.userTeamId) {
                    await autoRenewContracts(team.id);
                }
            } catch (error) {
                console.error(`Failed to process financials for team ${team.id}:`, error);
            }
        }
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
    const seasonStartDate = new Date(Date.UTC(nextYear, 0, 1));

    console.log('[StartNewSeason] Current season:', currentSeason, 'Next season:', nextSeason);
    console.log('[StartNewSeason] Current year:', currentYear, 'Next year:', nextYear);
    console.log('[StartNewSeason] Season start date:', seasonStartDate.toISOString());

    // 1. Archive Standings
    const leagues = await prisma.league.findMany();
    for (const league of leagues) {
        const teams = await prisma.team.findMany({
            where: { leagueId: league.id },
            include: {
                homeMatches: { where: { season: currentSeason, isPlayed: true } },
                awayMatches: { where: { season: currentSeason, isPlayed: true } }
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

    // 5. Handle Retirements
    const playersToRetire = await prisma.player.findMany({
        where: {
            isRetired: false,
            OR: [
                { age: { gte: 35 } } // Potential retirement starts at 35
            ]
        }
    });

    for (const player of playersToRetire) {
        if (player.age >= player.retirementAge) {
            await prisma.player.update({
                where: { id: player.id },
                data: { isRetired: true }
            });
            console.log(`Player Retired: ${player.name} (Age: ${player.age})`);

            const youthAge = randomInt(18, 22);
            await prisma.player.create({
                data: {
                    teamId: player.teamId,
                    name: randomName(),
                    age: youthAge,
                    naturalPosition: player.naturalPosition,
                    retirementAge: randomInt(30, 40),
                    morale: 100,
                    condition: 100,
                    isRetired: false,
                    birthDate: new Date(Date.UTC(nextYear - youthAge, randomInt(0, 11), randomInt(1, 28))),
                    ...generateYouthAttributes(player.naturalPosition)
                }
            });
        }
    }

    // 6. Add Young Prospects (based on ranking)
    console.log('[StartNewSeason] Step 6: Adding young prospects based on league ranking');
    const POSITIONS = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];
    const allTeams = await prisma.team.findMany();

    // Get standings from last season
    const lastSeason = currentSeason - 1;
    type StandingEntry = { teamId: string; ranking: number; points: number };
    let standings: StandingEntry[] = [];

    if (lastSeason > 0) {
        const matches = await prisma.match.findMany({
            where: { season: lastSeason, isPlayed: true }
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

    // Determine youth count based on ranking
    const getYouthCount = (ranking: number): number => {
        if (ranking <= 5) return 1;
        if (ranking <= 10) return 2;
        if (ranking <= 15) return 3;
        return 4;
    };

    for (const team of allTeams) {
        const teamStanding = standings.find(s => s.teamId === team.id);
        const ranking = teamStanding?.ranking || allTeams.indexOf(team) + 1;
        const youthCount = getYouthCount(ranking);

        for (let i = 0; i < youthCount; i++) {
            const randomPosition = POSITIONS[randomInt(0, POSITIONS.length - 1)];
            const youthAge = randomInt(16, 20);
            const youthName = randomName();

            await prisma.player.create({
                data: {
                    teamId: team.id,
                    name: youthName,
                    age: youthAge,
                    naturalPosition: randomPosition,
                    retirementAge: randomInt(32, 38),
                    morale: 100,
                    condition: 100,
                    isRetired: false,
                    birthDate: new Date(Date.UTC(nextYear - youthAge, randomInt(0, 11), randomInt(1, 28))),
                    popularity: randomInt(10, 30),
                    weeklyWage: randomInt(5000, 15000),
                    ...generateYouthAttributes(randomPosition, 'talented')
                }
            });
        }
        console.log(`[StartNewSeason] Added ${youthCount} talented young prospects to ${team.name} (Ranking: ${ranking})`);
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
