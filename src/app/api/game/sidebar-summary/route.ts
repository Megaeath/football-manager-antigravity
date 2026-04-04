import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import { getExpiringContracts } from '@/lib/engine/financial';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // Fetch everything in parallel
        const [gameTime, incomingBidsCount, expiringContracts] = await Promise.all([
            getGameTime(),
            prisma.bid.count({
                where: {
                    toTeamId: teamId,
                    status: 'PENDING'
                }
            }),
            getExpiringContracts(teamId)
        ]);

        return NextResponse.json({
            success: true,
            gameTime: {
                currentDate: gameTime.currentDate,
                currentSeason: gameTime.currentSeason,
                isConfigured: gameTime.isConfigured
            },
            notifications: {
                incomingBids: incomingBidsCount,
                expiringContracts: expiringContracts.length
            }
        });
    } catch (error) {
        console.error('Sidebar Summary API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
