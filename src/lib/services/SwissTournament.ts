import prisma from '@/lib/prisma';

type StandingRow = {
  teamId: string;
  teamName: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gd: number;
  gf: number;
  buchholzScore: number;
  form: string;
};

type Pairing = {
  homeTeamId: string;
  awayTeamId: string;
};

const SWISS_ROUNDS = 8;
const CUP_ROUND_INTERVAL_DAYS = 5;
const KNOCKOUT_ROUNDS = {
  ROUND_OF_16: 1,
  QUARTER_FINAL: 2,
  SEMI_FINAL: 3,
  FINAL: 4
} as const;

function normalizeUTCDate(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getCupRoundDate(startDate: Date, phase: 'SWISS' | 'KNOCKOUT', round: number) {
  const date = normalizeUTCDate(startDate);
  const offset = phase === 'SWISS'
    ? Math.max(0, round - 1)
    : 8 + Math.max(0, round - 1);
  date.setUTCDate(date.getUTCDate() + offset * CUP_ROUND_INTERVAL_DAYS);
  return date;
}

function resolveKnockoutWinner(match: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
}) {
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  if (home > away) return match.homeTeamId;
  if (away > home) return match.awayTeamId;
  const penHome = match.penaltyHome ?? -1;
  const penAway = match.penaltyAway ?? -1;
  return penHome >= penAway ? match.homeTeamId : match.awayTeamId;
}

type CupTournamentModel = typeof prisma extends { cupTournament: infer T } ? T : never;

function getCupTournamentModel() {
  const model = (prisma as unknown as { cupTournament?: CupTournamentModel }).cupTournament;
  return model ?? null;
}

export function isCupModelAvailable() {
  return !!getCupTournamentModel();
}

function normalizedPair(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sortSwissTable(rows: StandingRow[]) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamId.localeCompare(b.teamId);
  });
}

function chooseOpponent(
  baseTeamId: string,
  candidates: string[],
  pointsMap: Map<string, number>,
  playedPairs: Set<string>
): string[] {
  return [...candidates].sort((a, b) => {
    const aRematch = playedPairs.has(normalizedPair(baseTeamId, a)) ? 1 : 0;
    const bRematch = playedPairs.has(normalizedPair(baseTeamId, b)) ? 1 : 0;
    if (aRematch !== bRematch) return aRematch - bRematch;

    const aDiff = Math.abs((pointsMap.get(baseTeamId) || 0) - (pointsMap.get(a) || 0));
    const bDiff = Math.abs((pointsMap.get(baseTeamId) || 0) - (pointsMap.get(b) || 0));
    if (aDiff !== bDiff) return aDiff - bDiff;

    return Math.random() < 0.5 ? -1 : 1;
  });
}

function buildSwissPairingsBacktracking(
  teamIds: string[],
  pointsMap: Map<string, number>,
  playedPairs: Set<string>
): Pairing[] {
  const sortedPool = [...teamIds].sort((a, b) => {
    const pointDiff = (pointsMap.get(b) || 0) - (pointsMap.get(a) || 0);
    if (pointDiff !== 0) return pointDiff;
    return a.localeCompare(b);
  });

  const recurse = (pool: string[]): Pairing[] | null => {
    if (pool.length === 0) return [];

    const [base, ...rest] = pool;
    const orderedCandidates = chooseOpponent(base, rest, pointsMap, playedPairs);

    for (const candidate of orderedCandidates) {
      const key = normalizedPair(base, candidate);
      if (playedPairs.has(key)) continue;

      const nextPool = rest.filter((id) => id !== candidate);
      const result = recurse(nextPool);
      if (result) {
        return [{ homeTeamId: base, awayTeamId: candidate }, ...result];
      }
    }

    // Re-roll fallback: if strict no-rematch cannot solve current branch, allow one rematch.
    for (const candidate of rest) {
      const nextPool = rest.filter((id) => id !== candidate);
      const result = recurse(nextPool);
      if (result) {
        return [{ homeTeamId: base, awayTeamId: candidate }, ...result];
      }
    }

    return null;
  };

  const result = recurse(sortedPool);
  if (!result) throw new Error('Unable to generate Swiss pairings.');

  return result.map((p) => (Math.random() < 0.5 ? p : { homeTeamId: p.awayTeamId, awayTeamId: p.homeTeamId }));
}

export async function initializeCupTournamentForSeason(season: number) {
  const cupTournamentModel = getCupTournamentModel();
  // Graceful fallback: do not crash requests if runtime Prisma client is stale.
  if (!cupTournamentModel) {
    console.warn(
      '[SwissTournament] prisma.cupTournament is undefined. ' +
      'Run `npx prisma generate` and restart the dev server to pick up the latest schema.'
    );
    return null;
  }

  const existing = await cupTournamentModel.findUnique({
    where: { season }
  });
  if (existing) {
    const existingStandingsCount = await prisma.swissStanding.count({ where: { tournamentId: existing.id } });
    const isCorrupted = existingStandingsCount === 0;
    if (!isCorrupted) return existing;

    console.warn(
      `[SwissTournament] Detected corrupted tournament state for season ${season} ` +
      `(standings=${existingStandingsCount}). Rebuilding tournament state...`
    );

    const teams = await prisma.team.findMany({ select: { id: true } });
    if (teams.length < 2) throw new Error('Not enough teams to rebuild Cup tournament');

    await prisma.$transaction([
      prisma.match.deleteMany({ where: { cupTournamentId: existing.id, competitionType: 'CUP' } }),
      prisma.swissStanding.deleteMany({ where: { tournamentId: existing.id } }),
      prisma.swissMatchHistory.deleteMany({ where: { tournamentId: existing.id } })
    ]);

    await prisma.swissStanding.createMany({
      data: teams.map((t) => ({
        tournamentId: existing.id,
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

    return await cupTournamentModel.update({
      where: { id: existing.id },
      data: {
        status: 'ACTIVE',
        phase: 'SWISS',
        currentRound: 1,
        finishedAt: null
      }
    });
  }

  const teams = await prisma.team.findMany({ select: { id: true } });
  if (teams.length < 2) throw new Error('Not enough teams to initialize Cup tournament');

  // Cup tournament starts on September 1st of the season year
  // All teams from all divisions (D1, D2, D3) participate in the same cup tournament
  const startDate = new Date(Date.UTC(season, 8, 1)); // September 1st (month is 0-indexed: 8 = September)

  const tournament = await cupTournamentModel.create({
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

  // Important: do NOT create pairings now.
  // Cup schedule is pre-planned by dates; fixtures are drawn when round date is reached.
  return tournament;
}

export async function ensureCupFixturesForDate(season: number, currentDate: Date) {
  const cupTournamentModel = getCupTournamentModel();
  if (!cupTournamentModel) return null;

  const today = normalizeUTCDate(currentDate);
  let tournament = await cupTournamentModel.findUnique({ where: { season } });
  if (!tournament || tournament.status !== 'ACTIVE') return tournament;

  const roundMatches = await prisma.match.findMany({
    where: {
      cupTournamentId: tournament.id,
      competitionType: 'CUP',
      competitionPhase: tournament.phase,
      competitionRound: tournament.currentRound
    },
    orderBy: { date: 'asc' }
  });

  // If current round exists and is fully played, only progress state (no immediate pairing).
  if (roundMatches.length > 0 && roundMatches.every((m) => m.isPlayed)) {
    if (tournament.phase === 'SWISS') {
      await recomputeSwissStandings(tournament.id);
      if (tournament.currentRound >= SWISS_ROUNDS) {
        tournament = await cupTournamentModel.update({
          where: { id: tournament.id },
          data: { phase: 'KNOCKOUT', currentRound: KNOCKOUT_ROUNDS.ROUND_OF_16 }
        });
      } else {
        tournament = await cupTournamentModel.update({
          where: { id: tournament.id },
          data: { currentRound: tournament.currentRound + 1 }
        });
      }
    } else {
      if (tournament.currentRound >= KNOCKOUT_ROUNDS.FINAL) {
        tournament = await cupTournamentModel.update({
          where: { id: tournament.id },
          data: { status: 'FINISHED', finishedAt: new Date(today) }
        });
      } else {
        tournament = await cupTournamentModel.update({
          where: { id: tournament.id },
          data: { currentRound: tournament.currentRound + 1 }
        });
      }
    }
  }

  if (tournament.status !== 'ACTIVE') return tournament;

  // Do nothing until the planned round date arrives.
  const dueDate = getCupRoundDate(tournament.startDate, tournament.phase as 'SWISS' | 'KNOCKOUT', tournament.currentRound);
  if (today < dueDate) return tournament;

  const existingForRound = await prisma.match.count({
    where: {
      cupTournamentId: tournament.id,
      competitionType: 'CUP',
      competitionPhase: tournament.phase,
      competitionRound: tournament.currentRound
    }
  });
  if (existingForRound > 0) return tournament;

  if (tournament.phase === 'SWISS') {
    let pairings: Pairing[] = [];

    if (tournament.currentRound === 1) {
      const rows = await prisma.swissStanding.findMany({ where: { tournamentId: tournament.id }, select: { teamId: true } });
      const shuffled = shuffle(rows.map((r) => r.teamId));
      for (let i = 0; i < shuffled.length; i += 2) {
        if (!shuffled[i + 1]) break;
        pairings.push({ homeTeamId: shuffled[i], awayTeamId: shuffled[i + 1] });
      }
    } else {
      const standings = await recomputeSwissStandings(tournament.id);
      const historyRows = await prisma.swissMatchHistory.findMany({ where: { tournamentId: tournament.id } });
      const playedPairs = new Set<string>(historyRows.map((h) => normalizedPair(h.teamAId, h.teamBId)));
      const pointsMap = new Map(standings.map((s) => [s.teamId, s.points]));
      pairings = buildSwissPairingsBacktracking(standings.map((s) => s.teamId), pointsMap, playedPairs);
    }

    await prisma.match.createMany({
      data: pairings.map((p) => ({
        date: dueDate,
        season: tournament.season,
        competitionType: 'CUP',
        competitionPhase: 'SWISS',
        competitionRound: tournament.currentRound,
        cupTournamentId: tournament.id,
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        isPlayed: false
      }))
    });

    await prisma.swissMatchHistory.createMany({
      data: pairings.map((p) => {
        const [teamAId, teamBId] = p.homeTeamId < p.awayTeamId
          ? [p.homeTeamId, p.awayTeamId]
          : [p.awayTeamId, p.homeTeamId];
        return { tournamentId: tournament.id, teamAId, teamBId };
      })
    });

    return tournament;
  }

  // KNOCKOUT pairing on due date
  const knockoutPairings: Pairing[] = [];
  if (tournament.currentRound === KNOCKOUT_ROUNDS.ROUND_OF_16) {
    const standings = await recomputeSwissStandings(tournament.id);
    const top16 = standings.slice(0, 16).map((s) => s.teamId);
    const shuffled = shuffle(top16);
    if (shuffled.length < 16) throw new Error('Cannot draw R16: fewer than 16 teams qualified from Swiss phase');
    for (let i = 0; i < shuffled.length; i += 2) {
      knockoutPairings.push({ homeTeamId: shuffled[i], awayTeamId: shuffled[i + 1] });
    }
  } else {
    const prevRound = tournament.currentRound - 1;
    const prevMatches = await prisma.match.findMany({
      where: {
        cupTournamentId: tournament.id,
        competitionType: 'CUP',
        competitionPhase: 'KNOCKOUT',
        competitionRound: prevRound,
        isPlayed: true
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        penaltyHome: true,
        penaltyAway: true
      },
      orderBy: { homeTeamId: 'asc' }
    });

    const winners = prevMatches.map(resolveKnockoutWinner);
    const shuffledWinners = shuffle(winners);
    for (let i = 0; i < shuffledWinners.length; i += 2) {
      if (!shuffledWinners[i + 1]) break;
      knockoutPairings.push({ homeTeamId: shuffledWinners[i], awayTeamId: shuffledWinners[i + 1] });
    }
  }

  await prisma.match.createMany({
    data: knockoutPairings.map((m) => ({
      date: dueDate,
      season: tournament.season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: tournament.currentRound,
      cupTournamentId: tournament.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      isPlayed: false
    }))
  });

  return tournament;
}

export async function recomputeSwissStandings(tournamentId: string) {
  const standings = await prisma.swissStanding.findMany({
    where: { tournamentId },
    select: { teamId: true }
  });

  const cupMatches = await prisma.match.findMany({
    where: {
      cupTournamentId: tournamentId,
      competitionType: 'CUP',
      competitionPhase: 'SWISS',
      isPlayed: true
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true
    }
  });

  const map = new Map<string, StandingRow>();
  for (const s of standings) {
    map.set(s.teamId, {
      teamId: s.teamId,
      teamName: '',
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

  const opponents = new Map<string, string[]>();

  for (const m of cupMatches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.gf += m.homeScore;
    away.gf += m.awayScore;
    home.gd += m.homeScore - m.awayScore;
    away.gd += m.awayScore - m.homeScore;

    const homeForm = m.homeScore > m.awayScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L';
    const awayForm = m.awayScore > m.homeScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L';
    home.form = `${home.form}${homeForm}`.slice(-5);
    away.form = `${away.form}${awayForm}`.slice(-5);

    if (m.homeScore > m.awayScore) {
      home.win += 1;
      home.points += 3;
      away.loss += 1;
    } else if (m.homeScore < m.awayScore) {
      away.win += 1;
      away.points += 3;
      home.loss += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }

    opponents.set(home.teamId, [...(opponents.get(home.teamId) || []), away.teamId]);
    opponents.set(away.teamId, [...(opponents.get(away.teamId) || []), home.teamId]);
  }

  for (const [teamId, row] of map.entries()) {
    const foeIds = opponents.get(teamId) || [];
    row.buchholzScore = foeIds.reduce((sum, foeId) => sum + (map.get(foeId)?.points || 0), 0);
  }

  await prisma.$transaction(
    [...map.values()].map((row) =>
      prisma.swissStanding.update({
        where: {
          tournamentId_teamId: {
            tournamentId,
            teamId: row.teamId
          }
        },
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

  return sortSwissTable([...map.values()]);
}

export async function drawNextSwissRoundIfReady(tournamentId: string) {
  const cupTournamentModel = getCupTournamentModel();
  if (!cupTournamentModel) return null;

  const tournament = await cupTournamentModel.findUnique({
    where: { id: tournamentId }
  });
  if (!tournament || tournament.status !== 'ACTIVE' || tournament.phase !== 'SWISS') return null;

  const currentRoundMatches = await prisma.match.findMany({
    where: {
      cupTournamentId: tournamentId,
      competitionType: 'CUP',
      competitionPhase: tournament.phase,
      competitionRound: tournament.currentRound
    }
  });

  if (currentRoundMatches.length === 0) return null;
  if (currentRoundMatches.some((m) => !m.isPlayed)) return null;

  if (tournament.phase === 'SWISS') {
    await recomputeSwissStandings(tournamentId);

    if (tournament.currentRound >= SWISS_ROUNDS) {
      await cupTournamentModel.update({
        where: { id: tournamentId },
        data: {
          phase: 'KNOCKOUT',
          currentRound: KNOCKOUT_ROUNDS.ROUND_OF_16
        }
      });
      return { advancedTo: 'KNOCKOUT' };
    }

    await cupTournamentModel.update({
      where: { id: tournamentId },
      data: { currentRound: tournament.currentRound + 1 }
    });

    return { advancedTo: `SWISS_${tournament.currentRound + 1}` };
  }

  if (tournament.currentRound >= KNOCKOUT_ROUNDS.FINAL) {
    await cupTournamentModel.update({
      where: { id: tournamentId },
      data: { status: 'FINISHED', finishedAt: new Date() }
    });
    return { advancedTo: 'FINISHED' };
  }

  await cupTournamentModel.update({
    where: { id: tournamentId },
    data: { currentRound: tournament.currentRound + 1 }
  });

  return { advancedTo: `KNOCKOUT_${tournament.currentRound + 1}` };
}

export async function getCupSwissTable(season: number) {
  const cupTournamentModel = getCupTournamentModel();
  if (!cupTournamentModel) return null;

  const tournament = await cupTournamentModel.findUnique({
    where: { season }
  });
  if (!tournament) return null;

  const standings = await prisma.swissStanding.findMany({
    where: { tournamentId: tournament.id },
    include: {
      team: {
        select: { id: true, name: true }
      }
    }
  });

  const rows: StandingRow[] = standings.map((s) => ({
    teamId: s.teamId,
    teamName: s.team.name,
    played: s.played,
    win: s.win,
    draw: s.draw,
    loss: s.loss,
    points: s.points,
    gd: s.gd,
    gf: s.gf,
    buchholzScore: s.buchholzScore,
    form: s.form
  }));

  return {
    tournament,
    standings: sortSwissTable(rows)
  };
}
