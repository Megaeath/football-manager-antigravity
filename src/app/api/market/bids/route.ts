import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const playerId = searchParams.get('playerId');
        const season = searchParams.get('season');
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
        if (season) {
            whereClause.season = parseInt(season);
        }

        const skip = (page - 1) * limit;

        const [bids, total, seasons] = await Promise.all([
            prisma.bid.findMany({
                where: whereClause,
                include: {
                    player: {
                        select: { id: true, name: true, naturalPosition: true, transferStatus: true }
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

        return NextResponse.json({ 
            bids,
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
