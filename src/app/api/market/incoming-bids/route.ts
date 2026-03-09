import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Get incoming bids for a team (bids they received for their players)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // Get all pending bids where this team is the seller (toTeam)
        const incomingBids = await prisma.bid.findMany({
            where: {
                toTeamId: teamId,
                status: 'PENDING'
            },
            include: {
                player: {
                    select: {
                        id: true,
                        name: true,
                        naturalPosition: true,
                        age: true
                    }
                },
                fromTeam: {
                    select: {
                        id: true,
                        name: true,
                        reputation: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({
            success: true,
            bids: incomingBids,
            count: incomingBids.length
        });
    } catch (error) {
        console.error('Error fetching incoming bids:', error);
        return NextResponse.json({
            error: 'Failed to fetch incoming bids'
        }, { status: 500 });
    }
}
