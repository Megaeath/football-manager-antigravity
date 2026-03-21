import SwissTable from '@/components/cup/SwissTable';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import { getCupSwissTable, initializeCupTournamentForSeason } from '@/lib/services/SwissTournament';

export const revalidate = 0;

export default async function CupPage() {
  const settings = await getGameTime();
  const season = settings.currentSeason;

  await initializeCupTournamentForSeason(season);
  const tableData = await getCupSwissTable(season);

  if (!tableData) {
    return <div className="card">Cup is not initialized.</div>;
  }

  const { tournament, standings } = tableData;

  const roundMatches = await prisma.match.count({
    where: {
      cupTournamentId: tournament.id,
      competitionType: 'CUP',
      competitionPhase: tournament.phase,
      competitionRound: tournament.currentRound
    }
  });

  const roundPlayed = await prisma.match.count({
    where: {
      cupTournamentId: tournament.id,
      competitionType: 'CUP',
      competitionPhase: tournament.phase,
      competitionRound: tournament.currentRound,
      isPlayed: true
    }
  });

  const waiting = roundMatches > 0 && roundPlayed < roundMatches;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="hero-gradient" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>🏆 Cup Tournament</h1>
          <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9 }}>
            Season {season} · {tournament.phase === 'SWISS' ? `Swiss Round ${tournament.currentRound}/8` : 'Knockout Stage'}
          </p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '0.6rem 0.9rem' }}>
          {waiting ? '⏳ Waiting for all matches to finish before next draw' : '✅ Draw is ready / round complete'}
        </div>
      </div>

      <SwissTable
        rows={standings}
        currentRound={tournament.phase === 'SWISS' ? tournament.currentRound : 8}
        userTeamId={settings.userTeamId}
      />
    </div>
  );
}
