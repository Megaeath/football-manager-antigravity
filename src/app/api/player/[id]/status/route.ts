import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const body = await request.json();
        const { transferStatus, askingPrice } = body;

        if (transferStatus === 'LISTED') {
            const [settings, player] = await Promise.all([
                getGameTime(),
                prisma.player.findUnique({
                    where: { id: playerId },
                    select: { id: true, name: true, lastTransferredSeason: true }
                })
            ]);

            if (!player) {
                return NextResponse.json({ error: 'Player not found' }, { status: 404 });
            }

            if ((player.lastTransferredSeason ?? -1) >= settings.currentSeason) {
                return NextResponse.json(
                    {
                        error: `${player.name} moved this season and cannot be listed until next season.`
                    },
                    { status: 400 }
                );
            }
        }

        const updatedPlayer = await prisma.player.update({
            where: { id: playerId },
            data: {
                transferStatus,
                askingPrice: askingPrice || null
            }
        });

        return NextResponse.json({ success: true, player: updatedPlayer });
    } catch (error) {
        console.error('Error updating player status:', error);
        return NextResponse.json({ error: 'Failed to update player status' }, { status: 500 });
    }
}
