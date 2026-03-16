const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const playerId = 'cmmnkz7oq6ml4ohrs4m5s19hp';
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, name: true, age: true, birthDate: true }
  });

  const raw = await prisma.$queryRawUnsafe(
    "SELECT id, name, age, birthDate, strftime('%m-%d', birthDate) as md FROM Player WHERE id = ?",
    playerId
  );

  const matchBySql = await prisma.$queryRawUnsafe(
    "SELECT id, name, age FROM Player WHERE strftime('%m-%d', birthDate) = ? AND isRetired = 0 LIMIT 10",
    '09-10'
  );

  console.log(JSON.stringify({ player, raw, matchBySqlCount: matchBySql.length, matchBySql }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
