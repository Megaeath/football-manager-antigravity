import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const playerId = searchParams.get('playerId');
        const season = searchParams.get('season');
        const seasonInt = season ? parseInt(season) : null;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        let whereClause: any = {};
        if (teamId) {
            whereClause.OR = [
                { fromTeamId: teamId },
                { toTeamId: teamId }
            ];
        }
        if (playerId) {
            whereClause.playerId = playerId;
        }
        if (seasonInt !== null) {
            whereClause.season = seasonInt;
        }

        const skip = (page - 1) * limit;

        const [bids, total, seasons] = await Promise.all([
            prisma.bid.findMany({
                where: whereClause,
                include: {
                    player: {
                        select: {
                            id: true,
                            name: true,
                            naturalPosition: true,
                            transferStatus: true,
                            age: true,
                            avgRating: true,
                            goals: true,
                            assists: true
                        }
                    },
                    fromTeam: { select: { id: true, name: true } },
                    toTeam: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.bid.count({ where: whereClause }),
            prisma.bid.findMany({
                select: { season: true },
                distinct: ['season'],
                orderBy: { season: 'desc' }
            })
        ]);

        // Compute per-season AVG rating for players in current result set
        // (Player.avgRating can be stale/lifetime; market page needs season-aware value)
        const playerIds = Array.from(new Set(bids.map(b => b.player.id)));
        const seasonAvgMap = new Map<string, number>();

        if (playerIds.length > 0) {
            const grouped = await prisma.playerMatchStats.groupBy({
                by: ['playerId'],
                where: {
                    playerId: { in: playerIds },
                    ...(seasonInt !== null ? { match: { season: seasonInt } } : {})
                },
                _avg: {
                    rating: true
                }
            });

            for (const row of grouped) {
                seasonAvgMap.set(row.playerId, Number(row._avg.rating || 0));
            }
        }

        const bidsWithSeasonAvg = bids.map((bid) => ({
            ...bid,
            player: {
                ...bid.player,
                avgRating: seasonAvgMap.has(bid.player.id)
                    ? Number(seasonAvgMap.get(bid.player.id) || 0)
                    : Number(bid.player.avgRating || 0)
            }
        }));

        return NextResponse.json({ 
            bids: bidsWithSeasonAvg,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            availableSeasons: seasons.map(s => s.season)
        });
    } catch (error) {
        console.error('Failed to fetch bids:', error);
        return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
    }
}
