import prisma from './src/lib/prisma';

// Configuration
const SLOW_QUERY_THRESHOLD = 100; // ms - query ที่ช้ากว่านี้จะแสดง

// Enable query logging
const prismaSlow = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

const slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];

prismaSlow.$on('query', (e) => {
  if (e.duration > SLOW_QUERY_THRESHOLD) {
    slowQueries.push({
      query: e.query,
      duration: e.duration,
      timestamp: new Date()
    });
    
    console.log(`\n🐌 SLOW QUERY (${e.duration.toFixed(2)}ms):`);
    console.log(e.query);
    console.log('Params:', e.params);
    console.log('---');
  }
});

async function runWithTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`✅ ${name}: ${duration}ms`);
    if (duration > 1000) {
      console.log(`⚠️  WARNING: ${name} took more than 1 second!`);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ ${name}: ${duration}ms (FAILED)`);
    throw error;
  }
}

async function debugAIMarketPerformance() {
  console.log('🔍 AI Market Performance Debug\n');
  console.log(`Slow query threshold: ${SLOW_QUERY_THRESHOLD}ms\n`);
  
  const totalStart = Date.now();
  
  try {
    // Get a test team
    const team = await runWithTiming('Get AI Team', async () => {
      return await prismaSlow.team.findFirst({
        where: { id: { not: 'your-user-team-id' } }, // แก้ตรงนี้
        include: { players: { where: { isRetired: false } } }
      });
    });
    
    if (!team) {
      console.log('No AI team found');
      return;
    }
    
    console.log(`\n📊 Testing with team: ${team.name} (${team.id})`);
    console.log(`   Players: ${team.players.length}`);
    console.log(`   Balance: $${team.balance.toLocaleString()}\n`);
    
    // Test individual operations
    await runWithTiming('Fetch Listed Players', async () => {
      return await prismaSlow.player.findMany({
        where: { transferStatus: 'LISTED', isRetired: false }
      });
    });
    
    await runWithTiming('Fetch Free Agents', async () => {
      return await prismaSlow.player.findMany({
        where: { teamId: null, isRetired: false }
      });
    });
    
    await runWithTiming('Fetch Locked Bids', async () => {
      return await prismaSlow.bid.findMany({
        where: {
          status: 'ACCEPTED',
          windowEnds: { gte: new Date() }
        }
      });
    });
    
    await runWithTiming('Calculate Player Powers', async () => {
      // Simulate power calculations
      const players = team.players.slice(0, 10);
      return Promise.all(players.map(p => {
        // Power calculation logic here
        return p.power;
      }));
    });
    
    // Run full process
    console.log('\n🚀 Running full AI Market process...\n');
    const { processAIMarketForTeam } = await import('./src/lib/services/aiMarketService');
    
    await runWithTiming('processAIMarketForTeam (FULL)', async () => {
      return await processAIMarketForTeam(team.id);
    });
    
    const totalTime = Date.now() - totalStart;
    
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Total time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`Slow queries found: ${slowQueries.length}`);
    
    if (slowQueries.length > 0) {
      console.log('\n🐌 TOP 10 SLOWEST QUERIES:');
      slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .forEach((q, i) => {
          console.log(`\n#${i + 1}: ${q.duration.toFixed(2)}ms`);
          console.log(q.query.substring(0, 200) + '...');
        });
    }
    
  } catch (error) {
    console.error('\n❌ Debug failed:', error);
  } finally {
    await prismaSlow.$disconnect();
  }
}

runWithTiming('Total Debug Session', () => debugAIMarketPerformance());
