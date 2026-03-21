import { NextResponse } from 'next/server';
import { getGameTime } from '@/lib/services/gameTime';
import { getCupSwissTable, initializeCupTournamentForSeason } from '@/lib/services/SwissTournament';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const settings = await getGameTime();
    const season = searchParams.get('season') ? parseInt(searchParams.get('season') as string, 10) : settings.currentSeason;

    await initializeCupTournamentForSeason(season);
    const data = await getCupSwissTable(season);

    if (!data) {
      return NextResponse.json({ error: 'Cup tournament not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch cup standings', details: error.message }, { status: 500 });
  }
}
