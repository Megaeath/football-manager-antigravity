import prisma from './src/lib/prisma';

// Enable Prisma query logging
const prismaDebug = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
  ],
});

prismaDebug.$on('query', (e) => {
  console.log('⏱️  Query:', e.query);
  console.log('📝 Params:', e.params);
  console.log('⏰ Duration:', e.duration, 'ms');
  console.log('---');
});

prismaDebug.$on('error', (e) => {
  console.error('❌ Error:', e);
});

async function debugAIMarket() {
  console.log('🔍 Starting AI Market debug...');
  const startTime = Date.now();
  
  try {
    const { processAIMarketForTeam } = await import('./src/lib/services/aiMarketService');
    
    // Get first AI team
    const team = await prisma.team.findFirst({
      where: { id: { not: 'user-team-id' } } // แก้เป็น user team ID จริง
    });
    
    if (team) {
      console.log(`\n📊 Processing team: ${team.name}`);
      await processAIMarketForTeam(team.id);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Total time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prismaDebug.$disconnect();
  }
}

debugAIMarket();
