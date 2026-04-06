// One-time reconciliation: lock funds for PENDING/ACCEPTED bids created before reserve-lock fix
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const gs = await p.globalGameSettings.findFirst({ select: { currentDate: true, userTeamId: true } });
  const now = gs.currentDate || new Date();

  // Find all active PENDING/ACCEPTED bids still within window
  const activeBids = await p.bid.findMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED'] },
      windowEnds: { gte: now }
    },
    include: {
      fromTeam: { select: { id: true, name: true, balance: true } },
      player: { select: { name: true } }
    }
  });

  console.log('Active bids to check:', activeBids.length);

  let reconciled = 0;
  for (const bid of activeBids) {
    // Check if a reserve lock event already exists for this specific bid team
    const existing = await p.financialEvent.findFirst({
      where: {
        teamId: bid.fromTeamId,
        type: 'PLAYER_BOUGHT',
        description: { contains: 'Transfer reserve locked' }
      }
    });

    if (!existing) {
      console.log(`RECONCILING: bid=${bid.id} player="${bid.player?.name}" amount=${bid.amount} team="${bid.fromTeam?.name}" balance=${bid.fromTeam?.balance}`);
      await p.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: bid.fromTeamId },
          data: { balance: { decrement: bid.amount } }
        });
        await tx.financialEvent.create({
          data: {
            teamId: bid.fromTeamId,
            type: 'PLAYER_BOUGHT',
            amount: -bid.amount,
            description: `Transfer reserve locked for ${bid.player?.name || 'player'} (reconciled: pre-fix bid)`,
            date: now
          }
        });
      });
      reconciled++;
    } else {
      console.log(`Already reserved: bid=${bid.id} team="${bid.fromTeam?.name}"`);
    }
  }

  console.log(`\nDone. Reconciled ${reconciled} bid(s).`);

  // Final balance check for user team
  const team = await p.team.findUnique({
    where: { id: gs.userTeamId },
    select: { name: true, balance: true }
  });
  console.log('User team balance now:', team?.name, team?.balance);

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
