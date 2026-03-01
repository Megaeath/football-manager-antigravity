import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const playerId = searchParams.get('playerId');

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

        const bids = await prisma.bid.findMany({
            where: whereClause,
            include: {
                player: {
                    select: { id: true, name: true, naturalPosition: true, transferStatus: true }
                },
                fromTeam: { select: { id: true, name: true } },
                toTeam: { select: { id: true, name: true } }
            },
            orderBy: [
                { status: 'asc' }, // PENDING first
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json({ bids });
    } catch (error) {
        console.error('Failed to fetch bids:', error);
        return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
    }
}
