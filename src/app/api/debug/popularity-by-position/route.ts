import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const players = await prisma.player.findMany({
            where: { isRetired: false, teamId: { not: null } },
            select: {
                id: true,
                name: true,
                naturalPosition: true,
                popularity: true,
                age: true,
                goals: true,
                assists: true,
                apps: true,
                avgRating: true,
                team: { select: { name: true } }
            },
            orderBy: [{ naturalPosition: 'asc' }, { popularity: 'desc' }]
        });

        // Group by position and calculate stats
        const positions = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];
        const positionStats: Record<string, any> = {};

        for (const pos of positions) {
            const posPlayers = players.filter(p => p.naturalPosition === pos);
            if (posPlayers.length === 0) continue;

            const popularities = posPlayers.map(p => p.popularity);
            const avgPopularity = popularities.reduce((a, b) => a + b, 0) / popularities.length;
            const minPopularity = Math.min(...popularities);
            const maxPopularity = Math.max(...popularities);
            const medianPopularity = popularities.sort((a, b) => a - b)[Math.floor(popularities.length / 2)];

            // Weighted popularity (players with more apps get more weight)
            const weighted = posPlayers.reduce((sum, p) => sum + (p.popularity * Math.max(1, p.apps)), 0) /
                posPlayers.reduce((sum, p) => sum + Math.max(1, p.apps), 0);

            positionStats[pos] = {
                count: posPlayers.length,
                avgPopularity: parseFloat(avgPopularity.toFixed(2)),
                medianPopularity,
                minPopularity,
                maxPopularity,
                weightedPopularity: parseFloat(weighted.toFixed(2)),
                topPlayers: posPlayers.slice(0, 5).map(p => ({
                    name: p.name,
                    team: p.team?.name || 'Unknown',
                    popularity: p.popularity,
                    age: p.age,
                    goals: p.goals,
                    assists: p.assists,
                    apps: p.apps,
                    avgRating: p.avgRating
                }))
            };
        }

        // Overall stats
        const allPopularities = players.map(p => p.popularity);
        const avgAll = allPopularities.reduce((a, b) => a + b, 0) / allPopularities.length;

        return Response.json({
            summary: {
                totalPlayers: players.length,
                avgPopularityAllPositions: parseFloat(avgAll.toFixed(2)),
                positionBreakdown: positionStats
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching popularity stats:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
