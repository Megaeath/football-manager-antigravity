// Generate detailed report of all legend player name changes
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateReport() {
  console.log('📊 LEGEND PLAYER NAME CHANGE REPORT\n');
  console.log('='.repeat(80));
  
  const allPlayers = await prisma.legendPlayer.findMany({
    orderBy: [
      { teamName: 'asc' },
      { position: 'asc' }
    ]
  });
  
  // Group by team
  const teams = {};
  for (const player of allPlayers) {
    if (!teams[player.teamName]) {
      teams[player.teamName] = [];
    }
    teams[player.teamName].push(player);
  }
  
  console.log(`\nTotal: ${allPlayers.length} legend players across ${Object.keys(teams).length} teams\n`);
  console.log('='.repeat(80));
  
  // Show all players by team
  for (const [teamName, players] of Object.entries(teams)) {
    console.log(`\n🏟️  ${teamName} (${players.length} players)`);
    console.log('-'.repeat(60));
    
    players.forEach((p, i) => {
      const pos = p.position.padEnd(6);
      const name = p.playerName.padEnd(25);
      const power = `P${p.power}`.padStart(4);
      const age = `A${p.age}`.padStart(4);
      console.log(`  ${String(i + 1).padStart(2)}. ${pos} ${name} ${power} ${age}`);
    });
  }
  
  // Find all unique names and check for duplicates
  console.log('\n\n' + '='.repeat(80));
  console.log('🔍 DUPLICATE CHECK');
  console.log('='.repeat(80));
  
  const nameCount = {};
  for (const player of allPlayers) {
    if (!nameCount[player.playerName]) {
      nameCount[player.playerName] = [];
    }
    nameCount[player.playerName].push(player);
  }
  
  const duplicates = Object.entries(nameCount).filter(([name, players]) => players.length > 1);
  
  if (duplicates.length === 0) {
    console.log('\n✅ NO DUPLICATES FOUND! All player names are unique.');
  } else {
    console.log(`\n❌ Found ${duplicates.length} duplicate names:`);
    for (const [name, players] of duplicates) {
      console.log(`\n  "${name}" appears ${players.length} times:`);
      players.forEach(p => {
        console.log(`    - ${p.teamName} (${p.position}, Power: ${p.power})`);
      });
    }
  }
  
  await prisma.$disconnect();
}

generateReport()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
