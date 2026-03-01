import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const body = await request.json();
        const { transferStatus, askingPrice } = body;

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
