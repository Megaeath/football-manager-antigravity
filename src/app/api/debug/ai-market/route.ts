import { NextResponse } from 'next/server';
import { processAIMarketMovements } from '@/lib/services/aiMarketService';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const trigger = searchParams.get('trigger') === 'true';
        const logs: string[] = [];

        if (trigger) {
            console.log('[Debug API] Manually triggering AI market movements...');
            // We wrap this in a way that if it times out, we still might get some info
            // But for now let's just await it.
            await processAIMarketMovements(logs);
        }

        const listedCount = await prisma.player.count({ where: { transferStatus: 'LISTED' } });
        const bidCount = await prisma.bid.count();
        const bids = await prisma.bid.findMany({
            include: {
                player: { select: { name: true } },
                fromTeam: { select: { name: true } },
                toTeam: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        const listed = await prisma.player.findMany({
            where: { transferStatus: 'LISTED' },
            select: { name: true, team: { select: { name: true } }, askingPrice: true },
            take: 10
        });

        return NextResponse.json({
            success: true,
            trigger,
            listedCount,
            bidCount,
            logs,
            recentBids: bids,
            listedPlayers: listed
        });
    } catch (error: any) {
        console.error('Debug API Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
