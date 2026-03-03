const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateBids() {
  const settings = await prisma.globalGameSettings.findFirst();
  const currentSeason = settings?.currentSeason || 1;
  
  const allBids = await prisma.bid.findMany();
  console.log(`Found ${allBids.length} bids`);
  
  let updated = 0;
  for (const bid of allBids) {
    if (!bid.season || bid.season === 0 || bid.season === 1) {
      await prisma.bid.update({
        where: { id: bid.id },
        data: { season: currentSeason }
      });
      updated++;
    }
  }
  
  console.log(`Updated ${updated} bids to season ${currentSeason}`);
  await prisma.$disconnect();
}

updateBids().catch(console.error);
