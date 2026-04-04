async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });

  if (!settings?.userTeamId) {
    console.log(JSON.stringify({ settings, error: 'No userTeamId configured' }, null, 2));
    return;
  }

  const team = await prisma.team.findUnique({
    where: { id: settings.userTeamId },
    select: {
      id: true,
      name: true,
      balance: true,
      leagueId: true,
      trainingFacilityLevel: true,
    },
  });

  const latestClubFinance = await prisma.clubFinance.findFirst({
    where: { teamId: settings.userTeamId },
    orderBy: { createdAt: 'desc' },
    select: {
      teamId: true,
      balance: true,
      createdAt: true,
      weeklyIncome: true,
      weeklyExpenses: true,
    },
  });

  console.log(JSON.stringify({
    settings: {
      userTeamId: settings.userTeamId,
      currentSeason: settings.currentSeason,
      currentDate: settings.currentDate,
    },
    team,
    latestClubFinance,
  }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
