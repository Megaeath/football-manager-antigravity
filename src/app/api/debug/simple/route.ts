import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const bids = await prisma.bid.findMany({
            include: {
                player: { select: { name: true } },
                fromTeam: { select: { name: true } },
                toTeam: { select: { name: true } }
            },
            take: 5
        });

        return NextResponse.json({
            success: true,
            bids
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
