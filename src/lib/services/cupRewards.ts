import prisma from '@/lib/prisma';

const CUP_REWARD_TABLE = {
  CHAMPION: 15000000,
  RUNNER_UP: 8000000,
  SEMI_FINALIST: 3000000,
  QUARTER_FINALIST: 1500000,
  ROUND_OF_16: 500000
} as const;

type CupRewardRow = {
  teamId: string;
  teamName: string;
  stage: keyof typeof CUP_REWARD_TABLE;
  reward: number;
};

function winnerFromMatch(match: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
}) {
  if (match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;

  if (match.penaltyHome !== null && match.penaltyAway !== null) {
    return match.penaltyHome > match.penaltyAway ? match.homeTeamId : match.awayTeamId;
  }

  return null;
}

export async function calculateCupRewards(season: number): Promise<CupRewardRow[]> {
  const finalMatch = await prisma.match.findFirst({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 4,
      isPlayed: true
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  if (!finalMatch) return [];

  const finalWinnerId = winnerFromMatch(finalMatch);
  if (!finalWinnerId) return [];

  const champion = finalWinnerId === finalMatch.homeTeamId ? finalMatch.homeTeam : finalMatch.awayTeam;
  const runnerUp = finalWinnerId === finalMatch.homeTeamId ? finalMatch.awayTeam : finalMatch.homeTeam;

  const semiMatches = await prisma.match.findMany({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 3,
      isPlayed: true
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  const quarterMatches = await prisma.match.findMany({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 2,
      isPlayed: true
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  const round16Matches = await prisma.match.findMany({
    where: {
      season,
      competitionType: 'CUP',
      competitionPhase: 'KNOCKOUT',
      competitionRound: 1,
      isPlayed: true
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  const rows: CupRewardRow[] = [
    { teamId: champion.id, teamName: champion.name, stage: 'CHAMPION', reward: CUP_REWARD_TABLE.CHAMPION },
    { teamId: runnerUp.id, teamName: runnerUp.name, stage: 'RUNNER_UP', reward: CUP_REWARD_TABLE.RUNNER_UP }
  ];

  for (const m of semiMatches) {
    const winnerId = winnerFromMatch(m);
    if (!winnerId) continue;
    const loser = winnerId === m.homeTeamId ? m.awayTeam : m.homeTeam;
    rows.push({
      teamId: loser.id,
      teamName: loser.name,
      stage: 'SEMI_FINALIST',
      reward: CUP_REWARD_TABLE.SEMI_FINALIST
    });
  }

  for (const m of quarterMatches) {
    const winnerId = winnerFromMatch(m);
    if (!winnerId) continue;
    const loser = winnerId === m.homeTeamId ? m.awayTeam : m.homeTeam;
    rows.push({
      teamId: loser.id,
      teamName: loser.name,
      stage: 'QUARTER_FINALIST',
      reward: CUP_REWARD_TABLE.QUARTER_FINALIST
    });
  }

  for (const m of round16Matches) {
    const winnerId = winnerFromMatch(m);
    if (!winnerId) continue;
    const loser = winnerId === m.homeTeamId ? m.awayTeam : m.homeTeam;
    rows.push({
      teamId: loser.id,
      teamName: loser.name,
      stage: 'ROUND_OF_16',
      reward: CUP_REWARD_TABLE.ROUND_OF_16
    });
  }

  return rows;
}

export async function applyCupRewards(season: number, year: number) {
  const rewards = await calculateCupRewards(season);

  for (const reward of rewards) {
    const description = `Season ${season} Cup Reward (${reward.stage})`;

    const alreadyPaid = await prisma.financialEvent.findFirst({
      where: {
        teamId: reward.teamId,
        type: 'CUP_REWARD',
        description
      }
    });

    if (alreadyPaid) continue;

    await prisma.team.update({
      where: { id: reward.teamId },
      data: { balance: { increment: reward.reward } }
    });

    await prisma.financialEvent.create({
      data: {
        teamId: reward.teamId,
        type: 'CUP_REWARD',
        amount: reward.reward,
        description
      }
    });

    await prisma.news.create({
      data: {
        title: `${reward.teamName} earned cup reward`,
        content: `${reward.teamName} received ${reward.reward.toLocaleString()} from Cup (${reward.stage}) in season ${season}.`,
        type: 'CUP_REWARD',
        date: new Date(Date.UTC(year, 11, 31))
      }
    });
  }

  return rewards;
}
