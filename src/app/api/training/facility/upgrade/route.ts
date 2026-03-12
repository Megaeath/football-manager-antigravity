import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { upgradeTrainingFacility } from '@/lib/services/training';

export async function POST() {
  try {
    const settings = await prisma.globalGameSettings.findUnique({
      where: { id: 1 },
      select: { userTeamId: true }
    });

    if (!settings?.userTeamId) {
      return NextResponse.json({ error: 'User team not configured' }, { status: 400 });
    }

    const result = await upgradeTrainingFacility(settings.userTeamId);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[POST /api/training/facility/upgrade] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upgrade facility' }, { status: 500 });
  }
}
