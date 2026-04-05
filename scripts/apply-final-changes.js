// Fix Zinedine Zidane numbered names with real legendary player names
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const finalChanges = [
  { oldName: "Zinedine Zidane 1", team: "Valencia", position: "FWC", newName: "Walter Pandiani" },
  { oldName: "Zinedine Zidane 2", team: "Monaco", position: "FWC", newName: "Dado Prso" },
  { oldName: "Zinedine Zidane 3", team: "Lyon", position: "MC", newName: "Soni" },
  { oldName: "Zinedine Zidane 4", team: "Borussia Dortmund", position: "FWC", newName: "Stéphane Chapuisat" },
  { oldName: "Zinedine Zidane 5", team: "VfB Stuttgart", position: "FWC", newName: "Rudi Völler" },
  { oldName: "Zinedine Zidane 6", team: "RB Leipzig", position: "FWC", newName: "Olaf Marschall" },
  { oldName: "Zinedine Zidane 7", team: "Napoli", position: "FWC", newName: "Careca" },
  { oldName: "Zinedine Zidane 8", team: "Juventus", position: "FWC", newName: "Roberto Bettega" },
  { oldName: "Zinedine Zidane 9", team: "Marseille", position: "FWC", newName: "Toni Polster" },  // Changed to avoid duplicate
  { oldName: "Zinedine Zidane 10", team: "Juventus", position: "DMC", newName: "Antonio Conte" },
  { oldName: "Zinedine Zidane 11", team: "Juventus", position: "AMC", newName: "Pavel Nedvěd" },
  { oldName: "Zinedine Zidane 12", team: "Juventus", position: "MC", newName: "Giancarlo Antognoni" }
];

async function applyChanges() {
  console.log('🔧 Applying final legend name changes...\n');
  console.log('='.repeat(80));
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const change of finalChanges) {
    try {
      const player = await prisma.legendPlayer.findFirst({
        where: {
          playerName: change.oldName,
          teamName: change.team,
          position: change.position
        }
      });
      
      if (player) {
        await prisma.legendPlayer.update({
          where: { id: player.id },
          data: { playerName: change.newName }
        });
        
        console.log(`✅ ${change.oldName.padEnd(20)} → "${change.newName.padEnd(25)}" (${change.team.padEnd(25)} ${change.position})`);
        successCount++;
      } else {
        console.log(`⚠️  Not found: ${change.oldName} (${change.team}, ${change.position})`);
        errorCount++;
      }
    } catch (error) {
      console.log(`❌ Error: ${change.oldName} → ${change.newName}`);
      console.log(`   ${error.message}\n`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✨ Success: ${successCount}, Errors: ${errorCount}`);
  
  // Final verification
  const numberedZidane = await prisma.legendPlayer.findMany({
    where: {
      playerName: {
        contains: 'Zinedine Zidane'
      }
    }
  });
  
  if (numberedZidane.length === 0) {
    console.log('\n✅ SUCCESS! No more "Zinedine Zidane X" names in database!');
  } else {
    console.log(`\n⚠️  Still found ${numberedZidane.length} numbered Zidane names`);
    numberedZidane.forEach(p => {
      console.log(`   - ${p.playerName} (${p.teamName}, ${p.position})`);
    });
  }
  
  // Check for any duplicate names
  const allPlayers = await prisma.legendPlayer.findMany();
  const nameCount = {};
  
  for (const player of allPlayers) {
    if (!nameCount[player.playerName]) {
      nameCount[player.playerName] = [];
    }
    nameCount[player.playerName].push(player);
  }
  
  const duplicates = Object.entries(nameCount).filter(([name, players]) => players.length > 1);
  
  if (duplicates.length === 0) {
    console.log('✅ All player names are UNIQUE!');
  } else {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate names:`);
    for (const [name, players] of duplicates) {
      console.log(`   "${name}": ${players.map(p => p.teamName).join(', ')}`);
    }
  }
}

applyChanges()
  .then(() => prisma.$disconnect())
  .catch(console.error);
