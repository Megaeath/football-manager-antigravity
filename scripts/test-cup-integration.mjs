import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SWISS_ROUNDS = 8;
const KNOCKOUT_ROUNDS = [1, 2, 3, 4]; // 16, 8, 4, final

function shuffle(arr) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function chooseCandidateOrder(baseTeamId, candidates, pointsMap, playedPairs) {
  return [...candidates].sort((a, b) => {
    const aRematch = playedPairs.has(pairKey(baseTeamId, a)) ? 1 : 0;
    const bRematch = playedPairs.has(pairKey(baseTeamId, b)) ? 1 : 0;
    if (aRematch !== bRematch) return aRematch - bRematch;

    const aDiff = Math.abs((pointsMap.get(baseTeamId) || 0) - (pointsMap.get(a) || 0));
    const bDiff = Math.abs((pointsMap.get(baseTeamId) || 0) - (pointsMap.get(b) || 0));
    if (aDiff !== bDiff) return aDiff - bDiff;

    return Math.random() < 0.5 ? -1 : 1;
  });
}

function buildSwissPairings(teamIds, pointsMap, playedPairs) {
  const sorted = [...teamIds].sort((a, b) => {
    const pd = (pointsMap.get(b) || 0) - (pointsMap.get(a) || 0);
    if (pd !== 0) return pd;
    return a.localeCompare(b);
  });

  const recurse = (pool) => {
    if (pool.length === 0) return [];
    const [base, ...rest] = pool;
    const candidates = chooseCandidateOrder(base, rest, pointsMap, playedPairs);

    for (const candidate of candidates) {
      const key = pairKey(base, candidate);
      if (playedPairs.has(key)) continue;

      const nextPool = rest.filter((x) => x !== candidate);
      const child = recurse(nextPool);
      if (child) return [{ homeTeamId: base, awayTeamId: candidate }, ...child];
    }

    return null;
  };

  const strict = recurse(sorted);
  if (!strict) {
    throw new Error('Swiss strict no-rematch pairing failed');
  }

  return strict.map((p) => (Math.random() < 0.5 ? p : { homeTeamId: p.awayTeamId, awayTeamId: p.homeTeamId }));
}

function swissSort(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamId.localeCompare(b.teamId);
  });
}

function randomSwissScore() {
  if (Math.random() < 0.22) {
    const g = Math.floor(Math.random() * 4);
    return { home: g, away: g };
  }

  let home = Math.floor(Math.random() * 5);
  let away = Math.floor(Math.random() * 5);
  if (home === away) {
    if (Math.random() < 0.5) home += 1;
    else away += 1;
  }
  return { home, away };
}

function randomKnockoutResult() {
  const home = Math.floor(Math.random() * 5);
  const away = Math.floor(Math.random() * 5);

  if (home !== away) {
    return {
      home,
      away,
      wentToExtraTime: false,
      wentToPenalties: false,
      penaltyHome: null,
      penaltyAway: null
    };
  }

  let penaltyHome = 3 + Math.floor(Math.random() * 4);
  let penaltyAway = 3 + Math.floor(Math.random() * 4);
  while (penaltyHome === penaltyAway) {
    penaltyHome = 3 + Math.floor(Math.random() * 4);
    penaltyAway = 3 + Math.floor(Math.random() * 4);
  }

  return {
    home,
    away,
    wentToExtraTime: true,
    wentToPenalties: true,
    penaltyHome,
    penaltyAway
  };
}

function winnerOf(match) {
  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;
  if (match.penaltyHome > match.penaltyAway) return match.homeTeamId;
  return match.awayTeamId;
}

async function recomputeSwiss(tournamentId) {
  const rows = await prisma.swissStanding.findMany({ where: { tournamentId }, select: { teamId: true } });
  const matches = await prisma.match.findMany({
    where: {
      cupTournamentId: tournamentId,
      competitionType: 'CUP',
      competitionPhase: 'SWISS',
      isPlayed: true
    },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true }
  });

  const map = new Map();
  const opps = new Map();
  for (const r of rows) {
    map.set(r.teamId, {
      teamId: r.teamId,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      points: 0,
      gd: 0,
      gf: 0,
      buchholzScore: 0,
      form: ''
    });
  }

  for (const m of matches) {
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away || m.homeScore == null || m.awayScore == null) continue;

    home.played += 1;
    away.played += 1;
    home.gf += m.homeScore;
    away.gf += m.awayScore;
    home.gd += m.homeScore - m.awayScore;
    away.gd += m.awayScore - m.homeScore;

    const hf = m.homeScore > m.awayScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L';
    const af = m.awayScore > m.homeScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L';
    home.form = `${home.form}${hf}`.slice(-5);
    away.form = `${away.form}${af}`.slice(-5);

    if (m.homeScore > m.awayScore) {
      home.win += 1;
      home.points += 3;
      away.loss += 1;
    } else if (m.awayScore > m.homeScore) {
      away.win += 1;
      away.points += 3;
      home.loss += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }

    opps.set(home.teamId, [...(opps.get(home.teamId) || []), away.teamId]);
    opps.set(away.teamId, [...(opps.get(away.teamId) || []), home.teamId]);
  }

  for (const [teamId, row] of map.entries()) {
    const foeIds = opps.get(teamId) || [];
    row.buchholzScore = foeIds.reduce((sum, foeId) => sum + (map.get(foeId)?.points || 0), 0);
  }

  await prisma.$transaction(
    [...map.values()].map((row) =>
      prisma.swissStanding.update({
        where: { tournamentId_teamId: { tournamentId, teamId: row.teamId } },
        data: {
          played: row.played,
          win: row.win,
          draw: row.draw,
          loss: row.loss,
          points: row.points,
          gd: row.gd,
          gf: row.gf,
          buchholzScore: row.buchholzScore,
          form: row.form
        }
      })
    )
  );

  return swissSort([...map.values()]);
}

async function main() {
  const season = 1;
  const report = {
    season,
    swissRounds: [],
    knockoutRounds: [],
    champion: null,
    assertions: []
  };

  await prisma.match.deleteMany({ where: { season, competitionType: 'CUP' } });
  await prisma.swissMatchHistory.deleteMany({ where: { tournament: { season } } });
  await prisma.swissStanding.deleteMany({ where: { tournament: { season } } });
  await prisma.cupTournament.deleteMany({ where: { season } });

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  if (teams.length !== 60) throw new Error(`Expected 60 teams, got ${teams.length}`);

  const lastLeague = await prisma.match.findFirst({
    where: { season, competitionType: 'LEAGUE' },
    orderBy: { date: 'desc' },
    select: { date: true }
  });

  const startDate = new Date(lastLeague?.date || new Date(Date.UTC(2026, 6, 1)));
  startDate.setUTCDate(startDate.getUTCDate() + 1);

  const tournament = await prisma.cupTournament.create({
    data: {
      season,
      status: 'ACTIVE',
      phase: 'SWISS',
      currentRound: 1,
      startDate
    }
  });

  await prisma.swissStanding.createMany({
    data: teams.map((t) => ({
      tournamentId: tournament.id,
      teamId: t.id,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      points: 0,
      gd: 0,
      gf: 0,
      buchholzScore: 0,
      form: ''
    }))
  });

  const round1 = shuffle(teams.map((t) => t.id));
  const r1Pairs = [];
  for (let i = 0; i < round1.length; i += 2) {
    r1Pairs.push({ homeTeamId: round1[i], awayTeamId: round1[i + 1] });
  }

  await prisma.match.createMany({
    data: r1Pairs.map((p) => ({
      date: startDate,
      season,
      competitionType: 'CUP',
      competitionPhase: 'SWISS',
      competitionRound: 1,
      cupTournamentId: tournament.id,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      isPlayed: false
    }))
  });

  await prisma.swissMatchHistory.createMany({
    data: r1Pairs.map((p) => {
      const [teamAId, teamBId] = p.homeTeamId < p.awayTeamId ? [p.homeTeamId, p.awayTeamId] : [p.awayTeamId, p.homeTeamId];
      return { tournamentId: tournament.id, teamAId, teamBId };
    })
  });

  for (let round = 1; round <= SWISS_ROUNDS; round++) {
    const matches = await prisma.match.findMany({
      where: {
        season,
        competitionType: 'CUP',
        competitionPhase: 'SWISS',
        competitionRound: round,
        cupTournamentId: tournament.id
      },
      orderBy: { id: 'asc' }
    });

    if (matches.length !== 30) {
      throw new Error(`Swiss round ${round} expected 30 matches, got ${matches.length}`);
    }

    for (const m of matches) {
      const s = randomSwissScore();
      await prisma.match.update({
        where: { id: m.id },
        data: {
          homeScore: s.home,
          awayScore: s.away,
          isPlayed: true
        }
      });
    }

    const standings = await recomputeSwiss(tournament.id);
    report.swissRounds.push({
      round,
      matchCount: matches.length,
      top5: standings.slice(0, 5).map((s) => ({ teamId: s.teamId, pts: s.points, bh: s.buchholzScore }))
    });

    if (round < SWISS_ROUNDS) {
      const historyRows = await prisma.swissMatchHistory.findMany({ where: { tournamentId: tournament.id } });
      const playedPairs = new Set(historyRows.map((h) => pairKey(h.teamAId, h.teamBId)));
      const pointsMap = new Map(standings.map((s) => [s.teamId, s.points]));

      const pairs = buildSwissPairings(standings.map((s) => s.teamId), pointsMap, playedPairs);
      const nextDate = new Date(matches[0].date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);

      await prisma.match.createMany({
        data: pairs.map((p) => ({
          date: nextDate,
          season,
          competitionType: 'CUP',
          competitionPhase: 'SWISS',
          competitionRound: round + 1,
          cupTournamentId: tournament.id,
          homeTeamId: p.homeTeamId,
          awayTeamId: p.awayTeamId,
          isPlayed: false
        }))
      });

      await prisma.swissMatchHistory.createMany({
        data: pairs.map((p) => {
          const [teamAId, teamBId] = p.homeTeamId < p.awayTeamId ? [p.homeTeamId, p.awayTeamId] : [p.awayTeamId, p.homeTeamId];
          return { tournamentId: tournament.id, teamAId, teamBId };
        })
      });
    }
  }

  const finalSwissTable = await recomputeSwiss(tournament.id);
  const top16 = finalSwissTable.slice(0, 16).map((r) => r.teamId);

  report.assertions.push({
    name: 'Each team played 8 Swiss rounds',
    passed: finalSwissTable.every((r) => r.played === 8)
  });

  const historyRows = await prisma.swissMatchHistory.findMany({ where: { tournamentId: tournament.id } });
  const uniquePairs = new Set(historyRows.map((h) => pairKey(h.teamAId, h.teamBId)));
  report.assertions.push({
    name: 'No duplicate Swiss pairings',
    passed: uniquePairs.size === historyRows.length
  });

  const shuffledTop16 = shuffle(top16);
  const lastSwissMatch = await prisma.match.findFirst({
    where: { season, competitionType: 'CUP', competitionPhase: 'SWISS' },
    orderBy: { date: 'desc' },
    select: { date: true }
  });
  const kDate = new Date(lastSwissMatch.date);
  kDate.setUTCDate(kDate.getUTCDate() + 7);

  const r16Pairs = [];
  for (let i = 0; i < shuffledTop16.length; i += 2) {
    r16Pairs.push({ homeTeamId: shuffledTop16[i], awayTeamId: shuffledTop16[i + 1] });
  }

  await prisma.match.createMany({
    data: r16Pairs.map((p) => ({
      date: kDate,
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 1,
      cupTournamentId: tournament.id,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      isPlayed: false
    }))
  });

  await prisma.cupTournament.update({
    where: { id: tournament.id },
    data: { phase: 'KNOCKOUT', currentRound: 1 }
  });

  for (const round of KNOCKOUT_ROUNDS) {
    const matches = await prisma.match.findMany({
      where: {
        season,
        competitionType: 'CUP',
        competitionPhase: 'KNOCKOUT',
        competitionRound: round,
        cupTournamentId: tournament.id
      },
      orderBy: { id: 'asc' }
    });

    const expected = round === 1 ? 8 : round === 2 ? 4 : round === 3 ? 2 : 1;
    if (matches.length !== expected) {
      throw new Error(`Knockout round ${round} expected ${expected}, got ${matches.length}`);
    }

    for (const m of matches) {
      const r = randomKnockoutResult();
      await prisma.match.update({
        where: { id: m.id },
        data: {
          homeScore: r.home,
          awayScore: r.away,
          isPlayed: true,
          wentToExtraTime: r.wentToExtraTime,
          wentToPenalties: r.wentToPenalties,
          penaltyHome: r.penaltyHome,
          penaltyAway: r.penaltyAway
        }
      });
    }

    const played = await prisma.match.findMany({
      where: {
        season,
        competitionType: 'CUP',
        competitionPhase: 'KNOCKOUT',
        competitionRound: round,
        cupTournamentId: tournament.id,
        isPlayed: true
      }
    });

    const winners = played.map((m) => winnerOf(m));

    report.knockoutRounds.push({
      round,
      matches: played.length,
      winners: winners.length
    });

    if (round < 4) {
      const nextRound = round + 1;
      const shuffledWinners = shuffle(winners);
      const nextDate = new Date(played[0].date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      const pairs = [];
      for (let i = 0; i < shuffledWinners.length; i += 2) {
        pairs.push({ homeTeamId: shuffledWinners[i], awayTeamId: shuffledWinners[i + 1] });
      }

      await prisma.match.createMany({
        data: pairs.map((p) => ({
          date: nextDate,
          season,
          competitionType: 'CUP',
          competitionPhase: 'KNOCKOUT',
          competitionRound: nextRound,
          cupTournamentId: tournament.id,
          homeTeamId: p.homeTeamId,
          awayTeamId: p.awayTeamId,
          isPlayed: false
        }))
      });

      await prisma.cupTournament.update({
        where: { id: tournament.id },
        data: { currentRound: nextRound }
      });
    }
  }

  const final = await prisma.match.findFirst({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 4,
      cupTournamentId: tournament.id,
      isPlayed: true
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  const championId = winnerOf(final);
  const champion = championId === final.homeTeamId ? final.homeTeam : final.awayTeam;

  await prisma.cupTournament.update({
    where: { id: tournament.id },
    data: { status: 'FINISHED', finishedAt: new Date(), currentRound: 4 }
  });

  report.champion = {
    id: champion.id,
    name: champion.name,
    finalScore: `${final.homeTeam.name} ${final.homeScore}-${final.awayScore} ${final.awayTeam.name}`,
    penalties: final.wentToPenalties ? `${final.penaltyHome}-${final.penaltyAway}` : null
  };

  report.assertions.push({
    name: 'Champion exists',
    passed: !!report.champion?.id
  });

  report.assertions.push({
    name: 'Knockout rounds count [8,4,2,1]',
    passed: JSON.stringify(report.knockoutRounds.map((r) => r.matches)) === JSON.stringify([8, 4, 2, 1])
  });

  const swissFlagLeakCount = await prisma.match.count({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'SWISS',
      OR: [
        { wentToExtraTime: true },
        { wentToPenalties: true },
        { penaltyHome: { not: null } },
        { penaltyAway: { not: null } }
      ]
    }
  });

  const leagueFlagLeakCount = await prisma.match.count({
    where: {
      season,
      competitionType: 'LEAGUE',
      OR: [
        { wentToExtraTime: true },
        { wentToPenalties: true },
        { penaltyHome: { not: null } },
        { penaltyAway: { not: null } }
      ]
    }
  });

  const knockoutPenaltyWithoutET = await prisma.match.count({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      wentToPenalties: true,
      wentToExtraTime: false
    }
  });

  report.assertions.push({
    name: 'No ET/Penalty flags leaked to Swiss phase',
    passed: swissFlagLeakCount === 0
  });

  report.assertions.push({
    name: 'No ET/Penalty flags leaked to League matches',
    passed: leagueFlagLeakCount === 0
  });

  report.assertions.push({
    name: 'Every penalty shootout implies extra-time (knockout)',
    passed: knockoutPenaltyWithoutET === 0
  });

  const allPassed = report.assertions.every((a) => a.passed);

  const reportLines = [];
  reportLines.push('# Cup Integration Test Report');
  reportLines.push('');
  reportLines.push(`- Season: ${season}`);
  reportLines.push(`- Swiss rounds simulated: ${SWISS_ROUNDS}`);
  reportLines.push(`- Result: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  reportLines.push('');
  reportLines.push('## Assertions');
  report.assertions.forEach((a) => {
    reportLines.push(`- ${a.passed ? '✅' : '❌'} ${a.name}`);
  });
  reportLines.push('');
  reportLines.push('## Swiss Round Snapshots (Top 5)');
  report.swissRounds.forEach((r) => {
    reportLines.push(`- Round ${r.round}: ${r.top5.map((x) => `${x.teamId.slice(0, 6)}(Pts:${x.pts},BH:${x.bh})`).join(' | ')}`);
  });
  reportLines.push('');
  reportLines.push('## Knockout Summary');
  report.knockoutRounds.forEach((r) => {
    const label = r.round === 1 ? 'Round of 16' : r.round === 2 ? 'Quarter-final' : r.round === 3 ? 'Semi-final' : 'Final';
    reportLines.push(`- ${label}: matches=${r.matches}, winners=${r.winners}`);
  });
  reportLines.push('');
  reportLines.push('## Champion');
  reportLines.push(`- ${report.champion.name}`);
  reportLines.push(`- Final: ${report.champion.finalScore}`);
  if (report.champion.penalties) {
    reportLines.push(`- Penalties: ${report.champion.penalties}`);
  }

  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, 'cup-integration-report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');

  console.log(JSON.stringify({
    ok: allPassed,
    reportPath,
    champion: report.champion,
    assertions: report.assertions
  }, null, 2));

  if (!allPassed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
