import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        let whereClause = {};
        if (teamId) {
            whereClause = {
                OR: [
                    { teamId: null },
                    { teamId }
                ]
            };
        } else {
            whereClause = { teamId: null };
        }

        const news = await prisma.news.findMany({
            where: whereClause,
            orderBy: { date: 'desc' },
            take: 50
        });

        return NextResponse.json({ news });
    } catch (error) {
        console.error('Failed to fetch news:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
