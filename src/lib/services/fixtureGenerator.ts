import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generates a full season schedule using a Round Robin algorithm.
 * Each team plays every other team twice (Home and Away).
 */
export async function generateSeasonFixtures(leagueId: string, season: number, startYear: number) {
    const teams = await prisma.team.findMany({
        where: { leagueId },
        select: { id: true }
    });

    if (teams.length < 2) return;

    const teamIds = teams.map(t => t.id);
    if (teamIds.length % 2 !== 0) {
        teamIds.push('BYE'); // Placeholder for odd number of teams
    }

    const numTeams = teamIds.length;
    const numRounds = numTeams - 1;
    const halfSize = numTeams / 2;

    const fixtures = [];
    const startDate = new Date(Date.UTC(startYear, 0, 1)); // Jan 1st UTC

    // Round Robin - First half of season
    for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
            const home = teamIds[i];
            const away = teamIds[numTeams - 1 - i];

            if (home !== 'BYE' && away !== 'BYE') {
                // Schedule on Saturdays (simplified) - Always UTC midnight
                const matchDate = new Date(startDate.getTime());
                matchDate.setUTCDate(startDate.getUTCDate() + (round * 7));

                fixtures.push({
                    date: matchDate,
                    season,
                    homeTeamId: home,
                    awayTeamId: away,
                    isPlayed: false
                });
            }
        }
        // Rotate teamIds (keep first team fixed)
        teamIds.splice(1, 0, teamIds.pop()!);
    }

    // Second half of season (Reverse Home/Away)
    const secondHalfFixtures = fixtures.map(f => {
        const reverseDate = new Date(f.date.getTime());
        reverseDate.setUTCDate(f.date.getUTCDate() + (numRounds * 7));
        return {
            ...f,
            date: reverseDate,
            homeTeamId: f.awayTeamId,
            awayTeamId: f.homeTeamId
        };
    });

    const allFixtures = [...fixtures, ...secondHalfFixtures];

    // Batch insert
    await prisma.match.createMany({
        data: allFixtures
    });

    console.log(`Generated ${allFixtures.length} matches for season ${season}`);
}
