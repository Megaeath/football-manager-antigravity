import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateTrainingSlot } from '@/lib/services/training';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slotIndex: string }> }
) {
  try {
    const { slotIndex } = await params;
    const parsedSlot = Number(slotIndex);

    const body = await req.json();
    const { playerId, focusAttribute } = body || {};

    const settings = await prisma.globalGameSettings.findUnique({
      where: { id: 1 },
      select: { userTeamId: true }
    });

    if (!settings?.userTeamId) {
      return NextResponse.json({ error: 'User team not configured' }, { status: 400 });
    }

    const updated = await updateTrainingSlot({
      teamId: settings.userTeamId,
      slotIndex: parsedSlot,
      playerId: playerId || null,
      focusAttribute: focusAttribute || null
    });

    return NextResponse.json({ success: true, slot: updated });
  } catch (error: any) {
    console.error('[PATCH /api/training/slots/[slotIndex]] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update slot' }, { status: 500 });
  }
}
