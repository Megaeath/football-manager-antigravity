import prisma from '@/lib/prisma';
import type { GlobalGameSettings } from '@prisma/client';
import { generateSeasonFixtures } from './fixtureGenerator';

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

    // Check if it's a new year (New Season)
    const isNewYear = nextDate.getUTCFullYear() > settings.currentDate.getUTCFullYear();

    if (isNewYear) {
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

    // 2. Reset Player Season Stats
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

    // 3. Increment League Seasons and Generate New Fixtures
    for (const league of leagues) {
        await prisma.league.update({
            where: { id: league.id },
            data: { season: nextSeason }
        });
        await generateSeasonFixtures(league.id, nextSeason, nextYear);
    }

    // 4. Handle Retirements
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

    // 5. Update Global Settings
    return await prisma.globalGameSettings.update({
        where: { id: settings.id },
        data: {
            currentDate: nextDate ?? seasonStartDate,
            currentSeason: nextSeason
        }
    });
}
