import prisma from '@/lib/prisma';
import { assignInitialJerseyNumbersForTeam } from '@/lib/services/jerseyNumberService';

async function main() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  for (const team of teams) {
    await assignInitialJerseyNumbersForTeam(team.id);
    console.log(`[Jersey] assigned ${team.name}`);
  }
  console.log(`[Jersey] done for ${teams.length} teams`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
