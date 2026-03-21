import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import { initializeCupTournamentForSeason, isCupModelAvailable } from '@/lib/services/SwissTournament';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const settings = await getGameTime();
    const season = searchParams.get('season') ? parseInt(searchParams.get('season') as string, 10) : settings.currentSeason;

    if (!isCupModelAvailable()) {
      return NextResponse.json(
        { error: 'Cup model is not available in current runtime. Please restart dev server after prisma generate.' },
        { status: 503 }
      );
    }

    await initializeCupTournamentForSeason(season);

    const tournament = await prisma.cupTournament.findUnique({
      where: { season }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Cup tournament not found' }, { status: 404 });
    }

    const currentRoundMatches = await prisma.match.findMany({
      where: {
        cupTournamentId: tournament.id,
        competitionType: 'CUP',
        competitionPhase: tournament.phase,
        competitionRound: tournament.currentRound
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } }
      },
      orderBy: { date: 'asc' }
    });

    const playedCount = currentRoundMatches.filter((m) => m.isPlayed).length;

    return NextResponse.json({
      tournament,
      progress: {
        totalMatches: currentRoundMatches.length,
        playedMatches: playedCount,
        waitingForDraw: playedCount < currentRoundMatches.length
      },
      currentRoundMatches
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch cup state', details: message }, { status: 500 });
  }
}
