const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const playerId = 'cmm5qsa5q0003oh5j5f43t9hg'; // Kevin Palmer
    const arsenalId = 'cmm5qsa5n0002oh5jo1y109dc';
    const manUtdId = 'cmm5qsa6k0093oh5jp7dl4lps';

    try {
        // 1. Add Transfer History: Moved from Man Utd to Arsenal
        await prisma.transferHistory.create({
            data: {
                playerId,
                fromTeamId: manUtdId,
                toTeamId: arsenalId,
                season: 1,
                date: new Date('2026-02-15'),
                fee: 25000000
            }
        });

        // 2. Add Match Stats for Man Utd (Old Team)
        const match = await prisma.match.findFirst({ where: { isPlayed: true } });
        if (match) {
            await prisma.playerMatchStats.create({
                data: {
                    matchId: match.id,
                    playerId: playerId,
                    teamId: manUtdId,
                    rating: 8.5,
                    goals: 1,
                    assists: 1,
                    minutes: 90
                }
            });
            console.log("Added stat for Man Utd");
        }

        // 3. Add Match Stats for Arsenal (Current Team)
        const match2 = await prisma.match.findFirst({ where: { isPlayed: true, id: { not: match?.id } } });
        if (match2) {
            await prisma.playerMatchStats.create({
                data: {
                    matchId: match2.id,
                    playerId: playerId,
                    teamId: arsenalId,
                    rating: 7.2,
                    goals: 0,
                    assists: 0,
                    minutes: 45
                }
            });
            console.log("Added stat for Arsenal");
        }

        console.log("Successfully seeded history for Kevin Palmer");
    } catch (err) {
        console.error("Seed error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
