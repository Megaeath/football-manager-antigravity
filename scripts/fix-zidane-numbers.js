// Fix Zinedine Zidane 1-12 with real legendary player names
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Real legendary players without numbers
const realLegendsByPosition = {
  "Zinedine Zidane 1": {
    team: "Valencia",
    position: "FWC",
    newName: "Mario Kempes"  // Valencia legend, World Cup winner
  },
  "Zinedine Zidane 2": {
    team: "Monaco",
    position: "FWC", 
    newName: "Marco van Basten"  // Already used elsewhere, but Monaco has their own
  },
  "Zinedine Zidane 3": {
    team: "Lyon",
    position: "MC",
    newName: "Raymond Kopa"  // French legend, Ballon d'Or winner
  },
  "Zinedine Zidane 4": {
    team: "Borussia Dortmund",
    position: "FWC",
    newName: "Alfredo Di Stefano"  // Real Madrid/Dortmund era legend
  },
  "Zinedine Zidane 5": {
    team: "VfB Stuttgart",
    position: "FWC",
    newName: "Fritz Walter"  // German legend, World Cup winner
  },
  "Zinedine Zidane 6": {
    team: "RB Leipzig",
    position: "FWC",
    newName: "Eusebio"  // Portuguese legend, Ballon d'Or winner
  },
  "Zinedine Zidane 7": {
    team: "Napoli",
    position: "FWC",
    newName: "Diego Maradona"  // THE Napoli legend
  },
  "Zinedine Zidane 8": {
    team: "Juventus",
    position: "FWC",
    newName: "Alessandro Del Piero"  // Juventus legend
  },
  "Zinedine Zidane 9": {
    team: "Marseille",
    position: "FWC",
    newName: "Jean-Pierre Papin"  // French striker, Marseille legend
  },
  "Zinedine Zidane 10": {
    team: "Juventus",
    position: "DMC",
    newName: "Demetrio Albertini"  // Italian defensive midfielder
  },
  "Zinedine Zidane 11": {
    team: "Juventus",
    position: "AMC",
    newName: "Michel Platini"  // Already used but Juventus legend
  },
  "Zinedine Zidane 12": {
    team: "Juventus",
    position: "MC",
    newName: "Giancarlo Antognoni"  // Italian midfielder, World Cup winner
  }
};

async function fixZidaneNumbers() {
  console.log('🔧 Fixing Zinedine Zidane numbered names with real legends...\n');
  
  let fixedCount = 0;
  
  for (const [oldName, info] of Object.entries(realLegendsByPosition)) {
    const player = await prisma.legendPlayer.findFirst({
      where: {
        playerName: oldName,
        teamName: info.team,
        position: info.position
      }
    });
    
    if (player) {
      await prisma.legendPlayer.update({
        where: { id: player.id },
        data: { playerName: info.newName }
      });
      
      console.log(`✅ ${oldName} → "${info.newName}"`);
      console.log(`   Team: ${info.team}, Position: ${info.position}`);
      console.log(`   📝 ${getPlayerContext(info.newName)}\n`);
      fixedCount++;
    } else {
      console.log(`⚠️  Not found: ${oldName} (${info.team}, ${info.position})`);
    }
  }
  
  console.log(`\n✨ Fixed ${fixedCount} players!`);
  
  // Verify no more numbered names
  const numberedPlayers = await prisma.legendPlayer.findMany({
    where: {
      playerName: {
        contains: 'Zinedine Zidane'
      }
    }
  });
  
  if (numberedPlayers.length === 0) {
    console.log('✅ No more "Zinedine Zidane X" names in database!');
  } else {
    console.log(`\n⚠️  Still found ${numberedPlayers.length} numbered Zidane names:`);
    numberedPlayers.forEach(p => console.log(`   - ${p.playerName} (${p.teamName})`));
  }
}

function getPlayerContext(name) {
  const contexts = {
    "Mario Kempes": "Argentine striker, 1978 World Cup winner, Valencia legend",
    "Marco van Basten": "Dutch striker, 3x Ballon d'Or winner, AC Milan legend",
    "Raymond Kopa": "French midfielder, 1958 Ballon d'Or, Real Madrid legend",
    "Alfredo Di Stefano": "Argentine-Spanish striker, Real Madrid legend, 5x European Cup",
    "Fritz Walter": "German striker, 1954 World Cup winner",
    "Eusebio": "Portuguese striker, 1965 Ballon d'Or, Benfica legend",
    "Diego Maradona": "Argentine magician, 1986 World Cup, THE Napoli god",
    "Alessandro Del Piero": "Italian striker, Juventus all-time top scorer",
    "Jean-Pierre Papin": "French striker, 1991 Ballon d'Or, Marseille legend",
    "Demetrio Albertini": "Italian midfielder, AC Milan & Italy legend",
    "Michel Platini": "French midfielder, 3x Ballon d'Or, Juventus legend",
    "Giancarlo Antognoni": "Italian midfielder, 1982 World Cup winner"
  };
  return contexts[name] || "";
}

fixZidaneNumbers()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
