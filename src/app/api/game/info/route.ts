import { NextResponse } from 'next/server';
import { getGameTime } from '@/lib/services/gameTime';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const settings = await getGameTime();
        const userTeamName = settings.userTeamId
            ? (await prisma.team.findUnique({
                where: { id: settings.userTeamId },
                select: { name: true }
            }))?.name ?? null
            : null;

        return NextResponse.json({
            ...settings,
            userTeamName
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch game info' }, { status: 500 });
    }
}
