const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function adjusted(ps, match) {
  let r = 6;
  const pos = ps.player.naturalPosition;
  const gk = pos === 'GK';
  const def = ['DC', 'DR', 'DL', 'DMC', 'DMR', 'DML'].includes(pos);
  const teamGoalsFor = ps.teamId === match.homeTeamId ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
  const teamGoalsAgainst = ps.teamId === match.homeTeamId ? (match.awayScore ?? 0) : (match.homeScore ?? 0);
  const goalDiff = teamGoalsFor - teamGoalsAgainst;

  r += (ps.goals || 0) * 1.2;
  r += (ps.assists || 0) * 0.7;
  r += (ps.saves || 0) * (gk ? 0.15 : 0.2);
  r += (ps.tacklesWon || 0) * 0.3;
  r += (ps.passesCompleted || 0) * 0.01;
  r += (ps.dribblesWon || 0) * 0.2;

  r -= ((ps.shots || 0) - (ps.shotsOnTarget || 0)) * 0.1;
  r -= ((ps.tacklesAttempted || 0) - (ps.tacklesWon || 0)) * 0.1;
  r -= (ps.yellowCards || 0) * 0.5;
  r -= (ps.redCards || 0) * 2.0;
  r -= (ps.fouls || 0) * 0.1;

  if (goalDiff < 0) r -= Math.min(2.5, Math.abs(goalDiff) * 0.35);
  else if (goalDiff > 0) r += Math.min(0.8, goalDiff * 0.2);

  if (teamGoalsAgainst > 0) {
    if (gk) r -= teamGoalsAgainst * 0.45;
    else if (def) r -= teamGoalsAgainst * 0.22;
    else r -= Math.max(0, teamGoalsAgainst - 2) * 0.08;
  } else {
    if (gk) r += 0.8;
    else if (def) r += 0.5;
  }

  let cap = 10;
  if (teamGoalsAgainst >= 10) cap = gk || def ? 5.5 : 7.0;
  else if (teamGoalsAgainst >= 6) cap = gk || def ? 6.5 : 8.0;

  return Math.max(1, Math.min(cap, Math.round(r * 10) / 10));
}

(async () => {
  const matchId = process.argv[2] || 'cmmj863008fusoh642zz2i0fx';
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      playerStats: {
        include: {
          player: { select: { name: true, naturalPosition: true } }
        }
      }
    }
  });

  if (!m) {
    console.log('match not found');
    return;
  }

  console.log(`${m.homeTeam.name} ${m.homeScore}-${m.awayScore} ${m.awayTeam.name}`);
  const home = m.playerStats.filter(ps => ps.teamId === m.homeTeamId).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  console.log('\nHome team old vs new rating:');
  for (const ps of home.slice(0, 11)) {
    console.log(`${ps.player.name.padEnd(20)} ${ps.player.naturalPosition.padEnd(4)} old=${String(ps.rating).padEnd(4)} new=${adjusted(ps, m)}`);
  }
})();
