import prisma from '@/lib/prisma';
import { generateSeasonFixtures } from './fixtureGenerator';

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
    const birthdayPlayers: any[] = await prisma.$queryRawUnsafe(
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

    // Check if it's a new year (New Season)
    const isNewYear = nextDate.getUTCFullYear() > settings.currentDate.getUTCFullYear();

    if (isNewYear) {
        return await startNewSeason(settings);
    }

    return await prisma.globalGameSettings.update({
        where: { id: settings.id },
        data: { currentDate: nextDate }
    });
}

async function startNewSeason(settings: any) {
    const currentSeason = settings.currentSeason;
    const nextSeason = currentSeason + 1;
    const currentYear = settings.currentDate.getFullYear();
    const nextYear = currentYear + 1;
    const nextDate = new Date(nextYear, 0, 1);

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
        }
    }

    // 5. Update Global Settings
    return await prisma.globalGameSettings.update({
        where: { id: settings.id },
        data: {
            currentDate: nextDate,
            currentSeason: nextSeason
        }
    });
}
