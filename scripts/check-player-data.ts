import prisma from '../src/lib/prisma';

async function main() {
    const player = await prisma.player.findUnique({
        where: { id: 'cmm5qsa5q0003oh5j5f43t9hg' },
        include: {
            transferHistory: {
                include: {
                    fromTeam: true,
                    toTeam: true
                },
                orderBy: { date: 'desc' }
            },
            matchStats: {
                include: {
                    match: {
                        include: {
                            homeTeam: true,
                            awayTeam: true
                        }
                    }
                }
            }
        }
    });

    if (!player) {
        console.log('Player not found');
        return;
    }

    console.log(`Player: ${player.name}`);
    console.log(`\nTransfer History (${player.transferHistory.length} records):`);
    player.transferHistory.forEach(transfer => {
        console.log(`  - Season ${transfer.season}: ${transfer.fromTeam?.name || 'Free Agent'} → ${transfer.toTeam.name} | Fee: ${transfer.fee} | Date: ${transfer.date}`);
    });

    // Group match stats by season and team
    const statsGrouped: Record<string, any> = {};
    player.matchStats.forEach(stat => {
        const key = `${stat.match.season}-${stat.teamId}`;
        if (!statsGrouped[key]) {
            statsGrouped[key] = {
                season: stat.match.season,
                teamId: stat.teamId,
                teamName: stat.teamId === stat.match.homeTeamId ? stat.match.homeTeam.name : stat.match.awayTeam.name,
                goals: 0,
                assists: 0,
                apps: 0,
                ratingSum: 0
            };
        }
        statsGrouped[key].goals += stat.goals;
        statsGrouped[key].assists += stat.assists;
        statsGrouped[key].apps += 1;
        statsGrouped[key].ratingSum += stat.rating;
    });

    console.log(`\nSeasonal Stats (${Object.values(statsGrouped).length} records):`);
    Object.values(statsGrouped).sort((a, b) => b.season - a.season).forEach((stat: any) => {
        const avgRating = (stat.ratingSum / stat.apps).toFixed(2);
        console.log(`  - Season ${stat.season} (${stat.teamName}): ${stat.apps} apps, ${stat.goals}G ${stat.assists}A, Avg: ${avgRating}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
