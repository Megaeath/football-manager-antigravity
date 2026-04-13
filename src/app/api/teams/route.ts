import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const teams = await prisma.team.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return NextResponse.json(teams);
    } catch (error) {
        console.error('Teams API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
