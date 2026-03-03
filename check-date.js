const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const settings = await prisma.globalGameSettings.findUnique({
    where: { id: 1 },
    select: { currentDate: true }
  });

  if (settings?.currentDate) {
    const date = new Date(settings.currentDate);
    console.log('Current date:', date.toISOString());
    console.log('Day of month:', date.getUTCDate());
    console.log('Month:', date.getUTCMonth() + 1);
    console.log('Year:', date.getUTCFullYear());
  }
  
  await prisma.$disconnect();
})();
