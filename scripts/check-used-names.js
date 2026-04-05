// Find which names are already in use
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsedNames() {
  const allPlayers = await prisma.legendPlayer.findMany({
    select: { playerName: true }
  });
  
  const usedNames = new Set(allPlayers.map(p => p.playerName));
  
  console.log('📝 Names currently in use that conflict with our new names:\n');
  
  const conflictNames = [
    "Mario Kempes", "Marco van Basten", "Raymond Kopa", "Alfredo Di Stefano",
    "Fritz Walter", "Eusebio", "Diego Maradona", "Alessandro Del Piero",
    "Jean-Pierre Papin", "Demetrio Albertini", "Michel Platini", "Giancarlo Antognoni"
  ];
  
  for (const name of conflictNames) {
    if (usedNames.has(name)) {
      const players = await prisma.legendPlayer.findMany({
        where: { playerName: name },
        select: { teamName: true, position: true, power: true }
      });
      console.log(`❌ "${name}" already used by:`);
      players.forEach(p => console.log(`   - ${p.teamName} (${p.position}, P${p.power})`));
      console.log();
    } else {
      console.log(`✅ "${name}" is available`);
    }
  }
}

checkUsedNames()
  .then(() => prisma.$disconnect())
  .catch(console.error);
