const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
  const teamId = settings?.userTeamId;

  if (!teamId) {
    console.log('No userTeamId configured');
    return;
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, balance: true }
  });

  const clubFinanceLatest = await prisma.clubFinance.findFirst({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true, week: true, createdAt: true }
  });

  console.log('User Team:', team);
  console.log('Latest ClubFinance:', clubFinanceLatest);

  const now = settings?.currentDate || new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const recentTransferEvents = await prisma.financialEvent.findMany({
    where: {
      teamId,
      type: { in: ['PLAYER_BOUGHT', 'PLAYER_SOLD'] }
    },
    orderBy: { date: 'desc' },
    take: 30,
    select: { type: true, amount: true, date: true, description: true }
  });

  console.log('\nRecent transfer events:');
  for (const e of recentTransferEvents) {
    console.log(`${e.type}\t${e.amount}\t${new Date(e.date).toISOString().slice(0, 10)}\t${e.description}`);
  }

  const weekBought = await prisma.financialEvent.aggregate({
    where: {
      teamId,
      type: 'PLAYER_BOUGHT',
      date: { gte: weekStart, lte: now }
    },
    _sum: { amount: true },
    _count: { _all: true }
  });

  const seasonBought = await prisma.financialEvent.aggregate({
    where: {
      teamId,
      type: 'PLAYER_BOUGHT',
      date: {
        gte: new Date(Date.UTC(new Date(now).getUTCFullYear(), 0, 1)),
        lte: now
      }
    },
    _sum: { amount: true },
    _count: { _all: true }
  });

  console.log('\nWeek range:', weekStart.toISOString(), '->', new Date(now).toISOString());
  console.log('Week PLAYER_BOUGHT agg:', weekBought);
  console.log('Year-to-date PLAYER_BOUGHT agg:', seasonBought);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
