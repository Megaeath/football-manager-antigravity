import { NextResponse } from 'next/server';
import { getTrainingState } from '@/lib/services/training';

export async function GET() {
  try {
    const data = await getTrainingState();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[GET /api/training] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch training state' }, { status: 500 });
  }
}
