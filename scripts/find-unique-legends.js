// Fix Zinedine Zidane numbered names with UNIQUE real legendary player names
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Need to check all these against current database
const potentialReplacements = {
  "Zinedine Zidane 1": {
    team: "Valencia",
    position: "FWC",
    options: ["Gaizka Mendieta", "Mario Kempes", "Walter Pandiani"]  // Valencia legends
  },
  "Zinedine Zidane 2": {
    team: "Monaco",
    position: "FWC",
    options: ["Sonny Anderson", "Dado Prso", "Jürgen Klinsmann"]  // Monaco strikers
  },
  "Zinedine Zidane 3": {
    team: "Lyon",
    position: "MC",
    options: ["Juninho Pernambucano", "Soni", "Raymond Domenech"]  // Lyon midfielders
  },
  "Zinedine Zidane 4": {
    team: "Borussia Dortmund",
    position: "FWC",
    options: ["Stéphane Chapuisat", "Karl-Heinz Riedle", "Fredi Bobic"]  // Dortmund strikers
  },
  "Zinedine Zidane 5": {
    team: "VfB Stuttgart",
    position: "FWC",
    options: ["Giovane Elber", "Kevin Kuranyi", "Rudy Völler"]  // Stuttgart strikers
  },
  "Zinedine Zidane 6": {
    team: "RB Leipzig",
    position: "FWC",
    options: ["Olaf Marschall", "Matthias Sammer", "Rainer Ernst"]  // East German legends
  },
  "Zinedine Zidane 7": {
    team: "Napoli",
    position: "FWC",
    options: ["Careca", "Ciro Ferrara", "Edinson Cavani"]  // Napoli legends (but Cavani used)
  },
  "Zinedine Zidane 8": {
    team: "Juventus",
    position: "FWC",
    options: ["Roberto Bettega", "Pietro Anastasi", "Omar Sívori"]  // Juventus strikers
  },
  "Zinedine Zidane 9": {
    team: "Marseille",
    position: "FWC",
    options: ["Basile Boli", "Chris Waddle", "Rudi Völler"]  // Marseille forwards
  },
  "Zinedine Zidane 10": {
    team: "Juventus",
    position: "DMC",
    options: ["Antonio Conte", "Didier Deschamps", "Sergio Almirón"]  // Juventus defensive mids
  },
  "Zinedine Zidane 11": {
    team: "Juventus",
    position: "AMC",
    options: ["Roberto Baggio", "Pavel Nedvěd", "Zbigniew Boniek"]  // Juventus attacking mids
  },
  "Zinedine Zidane 12": {
    team: "Juventus",
    position: "MC",
    options: ["Giancarlo Antognoni", "Fabio Capello", "Massimo Bonini"]  // Juventus midfielders
  }
};

async function checkAvailableNames() {
  console.log('🔍 Checking available legendary names...\n');
  
  const allPlayers = await prisma.legendPlayer.findMany({
    select: { playerName: true }
  });
  
  const usedNames = new Set(allPlayers.map(p => p.playerName));
  
  console.log(`Total players in database: ${allPlayers.length}\n`);
  
  const selected = {};
  
  for (const [oldName, info] of Object.entries(potentialReplacements)) {
    console.log(`${oldName} (${info.team}, ${info.position}):`);
    
    let found = false;
    for (const option of info.options) {
      if (!usedNames.has(option)) {
        console.log(`  ✅ "${option}" - AVAILABLE`);
        selected[oldName] = { ...info, newName: option };
        usedNames.add(option);  // Mark as used for next checks
        found = true;
        break;
      } else {
        const players = await prisma.legendPlayer.findMany({
          where: { playerName: option },
          select: { teamName: true }
        });
        console.log(`  ❌ "${option}" - Used by ${players.map(p => p.teamName).join(', ')}`);
      }
    }
    
    if (!found) {
      console.log(`  ⚠️  NO AVAILABLE OPTIONS - Need new name`);
    }
    console.log();
  }
  
  console.log('\n\n📋 SUMMARY OF CHANGES TO MAKE:');
  console.log('='.repeat(80));
  
  for (const [oldName, info] of Object.entries(selected)) {
    console.log(`${oldName} → "${info.newName}" (${info.team}, ${info.position})`);
  }
  
  return selected;
}

checkAvailableNames()
  .then(() => prisma.$disconnect())
  .catch(console.error);
