import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date');

        const query: any = {
            include: {
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } }
            },
            orderBy: { date: 'asc' }
        };

        if (dateStr) {
            const date = new Date(dateStr);
            const utcYear = date.getUTCFullYear();
            const utcMonth = date.getUTCMonth();
            const utcDate = date.getUTCDate();

            // Create strictly UTC range from midnight to midnight
            const startDate = new Date(Date.UTC(utcYear, utcMonth, utcDate));
            const endDate = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1));

            query.where = {
                date: {
                    gte: startDate,
                    lt: endDate
                }
            };
        }

        const matches = await prisma.match.findMany(query);
        return NextResponse.json(matches);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
    }
}
