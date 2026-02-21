import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get game settings and all seasons
        const settings = await prisma.globalGameSettings.findUnique({
            where: { id: 1 }
        });
        const currentSeason = settings?.currentSeason || 1;

        const player = await prisma.player.findUnique({
            where: { id },
            include: {
                team: true,
                matchStats: {
                    include: { match: { include: { homeTeam: true, awayTeam: true } } },
                    orderBy: { match: { date: 'desc' } },
                    take: 15
                }
            }
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Get all seasons for this player
        const allSeasons = await prisma.playerMatchStats.findMany({
            where: { playerId: id },
            distinct: ['matchId'],
            select: {
                match: { select: { season: true } }
            }
        });

        const seasons = [...new Set(allSeasons.map(s => s.match.season))].sort((a, b) => b - a);

        // Get stats for each season
        const seasonStatsArray = await Promise.all(
            seasons.map(async (season) => {
                const stats = await prisma.playerMatchStats.aggregate({
                    where: {
                        playerId: id,
                        match: {
                            season: season,
                            isPlayed: true
                        }
                    },
                    _sum: {
                        goals: true,
                        assists: true,
                        yellowCards: true,
                        redCards: true,
                        minutes: true,
                        shots: true,
                        shotsOnTarget: true,
                        passesAttempted: true,
                        passesCompleted: true,
                        crossesAttempted: true,
                        crossesCompleted: true,
                        tacklesAttempted: true,
                        tacklesWon: true,
                        dribblesAttempted: true,
                        dribblesWon: true
                    },
                    _avg: {
                        rating: true
                    },
                    _count: {
                        id: true
                    }
                });

                return {
                    season,
                    goals: stats._sum.goals || 0,
                    assists: stats._sum.assists || 0,
                    yellowCards: stats._sum.yellowCards || 0,
                    redCards: stats._sum.redCards || 0,
                    minutes: stats._sum.minutes || 0,
                    shots: stats._sum.shots || 0,
                    shotsOnTarget: stats._sum.shotsOnTarget || 0,
                    passesAttempted: stats._sum.passesAttempted || 0,
                    passesCompleted: stats._sum.passesCompleted || 0,
                    crossesAttempted: stats._sum.crossesAttempted || 0,
                    crossesCompleted: stats._sum.crossesCompleted || 0,
                    tacklesAttempted: stats._sum.tacklesAttempted || 0,
                    tacklesWon: stats._sum.tacklesWon || 0,
                    dribblesAttempted: stats._sum.dribblesAttempted || 0,
                    dribblesWon: stats._sum.dribblesWon || 0,
                    avgRating: stats._avg.rating ? Number(stats._avg.rating).toFixed(2) : '0.00',
                    matches: stats._count.id
                };
            })
        );

        // Calculate career average rating from latest season or all seasons
        const latestSeasonStats = seasonStatsArray[0];
        const careerAvgRating = latestSeasonStats?.avgRating || '0.00';

        return NextResponse.json({
            ...player,
            avgRating: parseFloat(String(careerAvgRating)),
            currentSeason,
            availableSeasons: seasons,
            seasonStats: seasonStatsArray
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch player', details: e.message }, { status: 500 });
    }
}
