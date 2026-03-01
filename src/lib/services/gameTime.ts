import prisma from '@/lib/prisma';
import type { GlobalGameSettings } from '@prisma/client';
import { generateSeasonFixtures } from './fixtureGenerator';
import { processWeeklyFinances, autoRenewContracts } from '../engine/financial';
import { applySeasonRewards } from './seasonAwards';
import { processBiddingRules } from '../engine/market';

const FIRST_NAMES = ['Anan', 'Somchai', 'Kittipong', 'Narin', 'Phumin', 'Thanin', 'Soran', 'Kawin', 'Pinit', 'Chaiyaphum'];
const LAST_NAMES = ['Srisuk', 'Wattanakul', 'Boonmee', 'Rattanakorn', 'Sombat', 'Ritthichai', 'Chaiyo', 'Sanguan', 'Prasert', 'Kanan'];

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomName = () => `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`;

type YouthAttributes = {
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
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

function generateYouthAttributes(naturalPosition: string): YouthAttributes {
    const base: YouthAttributes = {
        handling: randomInt(1, 3),
        tackling: randomInt(6, 13),
        passing: randomInt(6, 13),
        shooting: randomInt(6, 13),
        heading: randomInt(6, 13),
        dribbling: randomInt(6, 13),
        crossing: randomInt(6, 12),
        setPieces: randomInt(6, 13),
        aggression: randomInt(6, 13),
        positioning: randomInt(6, 13),
        vision: randomInt(6, 13),
        bravery: randomInt(6, 13),
        leadership: randomInt(6, 13),
        teamwork: randomInt(6, 13),
        composure: randomInt(6, 13),
        pace: randomInt(6, 13),
        acceleration: randomInt(6, 13),
        stamina: randomInt(11, 17),
        strength: randomInt(6, 13),
        agility: randomInt(6, 13),
        balance: randomInt(6, 13)
    };

    base.handling = naturalPosition === 'GK' ? randomInt(12, 18) : randomInt(1, 3);

    if (naturalPosition === 'DC') {
        base.tackling = randomInt(12, 18);
        base.heading = randomInt(12, 18);
        base.strength = randomInt(12, 18);
        base.positioning = randomInt(11, 17);
    }
    if (naturalPosition === 'MC') {
        base.passing = randomInt(12, 18);
        base.vision = randomInt(11, 17);
        base.teamwork = randomInt(11, 17);
    }
    if (['FWC', 'FWR', 'FWL', 'FW'].includes(naturalPosition)) {
        base.shooting = randomInt(12, 18);
        base.pace = randomInt(11, 17);
        base.acceleration = randomInt(11, 17);
        base.composure = randomInt(10, 16);
    }
    if (['MR', 'ML', 'AMR', 'AML'].includes(naturalPosition)) {
        base.dribbling = randomInt(12, 18);
        base.crossing = randomInt(12, 18);
        base.pace = randomInt(12, 18);
        base.acceleration = randomInt(12, 18);
    }
    if (['DR', 'DL'].includes(naturalPosition)) {
        base.tackling = randomInt(11, 17);
        base.pace = randomInt(11, 17);
        base.stamina = randomInt(12, 18);
        base.crossing = randomInt(10, 16);
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

    // 6. Add Young Prospects (5 per team)
    console.log('[StartNewSeason] Step 6: Adding young prospects to all teams');
    const POSITIONS = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];
    const allTeams = await prisma.team.findMany();

    for (const team of allTeams) {
        // Add 5 random young players to each team
        for (let i = 0; i < 5; i++) {
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
                    ...generateYouthAttributes(randomPosition)
                }
            });
        }
        console.log(`[StartNewSeason] Added 5 young prospects to ${team.name}`);
    }

    // 7. Update Global Settings
    const finalDate = nextDate ?? seasonStartDate;
    console.log('[StartNewSeason] Step 7: Updating global settings');
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
