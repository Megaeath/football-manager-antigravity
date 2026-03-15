import { NextRequest, NextResponse } from 'next/server';
import { getTrainingState } from '@/lib/services/training';

export async function GET(req: NextRequest) {
  try {
    // ?teamId=xxx lets the UI fetch training state for any team (AI read-only view)
    const teamId = req.nextUrl.searchParams.get('teamId') || undefined;
    const data = await getTrainingState(teamId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[GET /api/training] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch training state' }, { status: 500 });
  }
}
