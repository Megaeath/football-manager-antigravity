// Script to fix duplicate legend player names in the database
// Each player name must be unique across the entire game

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Pool of legendary players by position to replace duplicates
const legendPoolByPosition = {
  GK: [
    "Peter Schmeichel", "Oliver Kahn", "Gianluigi Buffon", "Iker Casillas",
    "Edwin van der Sar", "Fabien Barthez", "Claudio Taffarel", "Jorge Campos",
    "Andoni Zubizarreta", "Sepp Maier", "Dino Zoff", "Gordon Banks",
    "Rinat Dasayev", "Jan Oblak", "Manuel Neuer", "Thibaut Courtois"
  ],
  RB: [
    "Cafu", "Dani Alves", "Javier Zanetti", "Phillip Lahm", "Carlos Alberto",
    "Gary Neville", "Jairzinho", "Sergio Ramos", "Cesar Azpilicueta",
    "Patrice Evra", "Maicon", "Dani Carvajal", "Kyle Walker", "Trent Alexander-Arnold"
  ],
  RCB: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique"
  ],
  LCB: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique"
  ],
  LB: [
    "Roberto Carlos", "Paolo Maldini", "Marcelo", "Giacinto Facchetti",
    "Junior", "Nilton Santos", "Bixente Lizarazu", "Filippo Inzaghi",
    "Leighton Baines", "Denis Irwin", "Andy Robertson", "Jordi Alba",
    "David Alaba", "Patrice Evra"
  ],
  DM: [
    "Claude Makelele", "Nolo Kante", "Sergio Busquets", "Rodri",
    "Casemiro", "Patrick Vieira", "Roy Keane", "Gennaro Gattuso",
    "Fernando Redondo", "Edgar Davids", "Makelele", "Javier Mascherano",
    "Nemanja Matic", "Fabinho", "Joshua Kimmich", "Toni Kroos"
  ],
  CM: [
    "Zinedine Zidane", "Andres Iniesta", "Xavi Hernandez", "Frank Lampard",
    "Steven Gerrard", "Paul Scholes", "Andrea Pirlo", "Luka Modric",
    "Kevin De Bruyne", "Michel Platini", "Johan Cruyff", "Bobby Charlton",
    "Lothar Matthaus", "Ruud Gullit", "Marco van Basten", "Zico"
  ],
  AM: [
    "Zinedine Zidane", "Diego Maradona", "Pele", "Ronaldinho",
    "Kaka", "Roberto Baggio", "Michel Platini", "Johan Cruyff",
    "Rivaldo", "Zico", "Socrates", "Hristo Stoichkov", "Gheorghe Hagi",
    "Ruud Gullit", "Luis Figo", "Rui Costa"
  ],
  RW: [
    "Lionel Messi", "Luis Figo", "Arjen Robben", "Mohamed Salah",
    "Gareth Bale", "Jadon Sancho", "Bukayo Saka", "Damuffay",
    "David Beckham", "Riyad Mahrez", "Serge Gnabry", "Kingsley Coman",
    "Hernan Crespo", "Garrincha", "George Best"
  ],
  LW: [
    "Cristiano Ronaldo", "Neymar Jr", "Eden Hazard", "Vinicius Junior",
    "Robert Pires", "Marc Overmars", "Ryan Giggs", "Gareth Bale",
    "Raheem Sterling", "Son Heung-min", "Sadio Mane", "Luis Diaz",
    "Raheem Sterling", "Anthony Martial", "Marcus Rashford"
  ],
  ST: [
    "Ronaldo Nazario", "Thierry Henry", "Marco van Basten", "Ruud van Nistelrooy",
    "Alessandro Del Piero", "Gabriel Batistuta", "Filippo Inzaghi", "David Trezeguet",
    "Samuel Eto'o", "Didier Drogba", "Fernando Torres", "Robin van Persie",
    "Alan Shearer", "Ian Wright", "Les Ferdinand", "Dennis Bergkamp"
  ],
  FW: [
    "Ronaldo Nazario", "Thierry Henry", "Marco van Basten", "Ruud van Nistelrooy",
    "Alessandro Del Piero", "Gabriel Batistuta", "Filippo Inzaghi", "David Trezeguet",
    "Samuel Eto'o", "Didier Drogba", "Fernando Torres", "Robin van Persie",
    "Alan Shearer", "Ian Wright", "Les Ferdinand", "Dennis Bergkamp"
  ],
  RWM: [
    "Lionel Messi", "Luis Figo", "Arjen Robben", "Mohamed Salah",
    "Gareth Bale", "Jadon Sancho", "Bukayo Saka", "Damuffay",
    "David Beckham", "Riyad Mahrez", "Serge Gnabry", "Kingsley Coman",
    "Hernan Crespo", "Garrincha", "George Best"
  ],
  LWM: [
    "Cristiano Ronaldo", "Neymar Jr", "Eden Hazard", "Vinicius Junior",
    "Robert Pires", "Marc Overmars", "Ryan Giggs", "Gareth Bale",
    "Raheem Sterling", "Son Heung-min", "Sadio Mane", "Luis Diaz",
    "Raheem Sterling", "Anthony Martial", "Marcus Rashford"
  ],
  AML: [
    "Cristiano Ronaldo", "Neymar Jr", "Eden Hazard", "Vinicius Junior",
    "Robert Pires", "Marc Overmars", "Ryan Giggs", "Gareth Bale",
    "Raheem Sterling", "Son Heung-min", "Sadio Mane", "Luis Diaz",
    "Raheem Sterling", "Anthony Martial", "Marcus Rashford"
  ],
  AMR: [
    "Lionel Messi", "Luis Figo", "Arjen Robben", "Mohamed Salah",
    "Gareth Bale", "Jadon Sancho", "Bukayo Saka", "Damuffay",
    "David Beckham", "Riyad Mahrez", "Serge Gnabry", "Kingsley Coman",
    "Hernan Crespo", "Garrincha", "George Best"
  ],
  RWB: [
    "Cafu", "Dani Alves", "Javier Zanetti", "Phillip Lahm", "Carlos Alberto",
    "Gary Neville", "Jairzinho", "Sergio Ramos", "Cesar Azpilicueta",
    "Patrice Evra", "Maicon", "Dani Carvajal", "Kyle Walker", "Trent Alexander-Arnold"
  ],
  LWB: [
    "Roberto Carlos", "Paolo Maldini", "Marcelo", "Giacinto Facchetti",
    "Junior", "Nilton Santos", "Bixente Lizarazu", "Filippo Inzaghi",
    "Leighton Baines", "Denis Irwin", "Andy Robertson", "Jordi Alba",
    "David Alaba", "Patrice Evra"
  ],
  DL: [
    "Roberto Carlos", "Paolo Maldini", "Marcelo", "Giacinto Facchetti",
    "Junior", "Nilton Santos", "Bixente Lizarazu", "Filippo Inzaghi",
    "Leighton Baines", "Denis Irwin", "Andy Robertson", "Jordi Alba",
    "David Alaba", "Patrice Evra"
  ],
  DR: [
    "Cafu", "Dani Alves", "Javier Zanetti", "Phillip Lahm", "Carlos Alberto",
    "Gary Neville", "Jairzinho", "Sergio Ramos", "Cesar Azpilicueta",
    "Patrice Evra", "Maicon", "Dani Carvajal", "Kyle Walker", "Trent Alexander-Arnold"
  ],
  DC: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique"
  ],
  MRC: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique"
  ],
  MLC: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique"
  ],
  MR: [
    "Lionel Messi", "Luis Figo", "Arjen Robben", "Mohamed Salah",
    "Gareth Bale", "Jadon Sancho", "Bukayo Saka", "Damuffay",
    "David Beckham", "Riyad Mahrez", "Serge Gnabry", "Kingsley Coman",
    "Hernan Crespo", "Garrincha", "George Best"
  ],
  ML: [
    "Cristiano Ronaldo", "Neymar Jr", "Eden Hazard", "Vinicius Junior",
    "Robert Pires", "Marc Overmars", "Ryan Giggs", "Gareth Bale",
    "Raheem Sterling", "Son Heung-min", "Sadio Mane", "Luis Diaz",
    "Raheem Sterling", "Anthony Martial", "Marcus Rashford"
  ]
};

// Track which names have been used globally
const usedNames = new Set();

function normalizePosition(position) {
  // Map position variations to standard keys
  const posMap = {
    'GK': 'GK',
    'RB': 'RB',
    'RCB': 'RCB',
    'LCB': 'LCB',
    'CB': 'RCB',
    'LB': 'LB',
    'DM': 'DM',
    'CM': 'CM',
    'AM': 'AM',
    'RW': 'RW',
    'RWM': 'RW',
    'AMR': 'RW',
    'LW': 'LW',
    'LWM': 'LW',
    'AML': 'LW',
    'ST': 'ST',
    'FW': 'FW',
    'RWB': 'RWB',
    'LWB': 'LWB',
    'DL': 'DL',
    'DR': 'DR',
    'DC': 'DC',
    'MRC': 'MRC',
    'MLC': 'MLC',
    'MR': 'MR',
    'ML': 'ML'
  };
  return posMap[position] || position;
}

function getUniqueNameForPosition(position, excludeNames = new Set()) {
  const normalizedPos = normalizePosition(position);
  const pool = legendPoolByPosition[normalizedPos] || legendPoolByPosition.CM;
  
  // Find a name that hasn't been used and is not in exclude list
  for (const name of pool) {
    if (!usedNames.has(name) && !excludeNames.has(name)) {
      return name;
    }
  }
  
  // If all names in pool are used, add a suffix
  const baseName = pool[0];
  let counter = 1;
  let newName = `${baseName} ${counter}`;
  while (usedNames.has(newName) || excludeNames.has(newName)) {
    counter++;
    newName = `${baseName} ${counter}`;
  }
  return newName;
}

async function fixDuplicateLegendPlayers() {
  console.log('🔍 Finding and fixing duplicate legend player names...\n');
  
  // Get all legend players from database
  const allPlayers = await prisma.legendPlayer.findMany({
    orderBy: [
      { teamId: 'asc' },
      { power: 'desc' }
    ]
  });
  
  console.log(`Found ${allPlayers.length} legend players in database\n`);
  
  // First pass: collect all unique names (keep first occurrence)
  const playersToFix = [];
  const nameOccurrences = new Map();
  
  for (const player of allPlayers) {
    const name = player.playerName.trim();
    
    if (!nameOccurrences.has(name)) {
      nameOccurrences.set(name, []);
    }
    nameOccurrences.get(name).push(player);
  }
  
  // Find duplicates
  const duplicates = Array.from(nameOccurrences.entries())
    .filter(([name, players]) => players.length > 1);
  
  console.log(`Found ${duplicates.length} duplicate player names:\n`);
  
  for (const [name, players] of duplicates) {
    console.log(`❌ "${name}" appears ${players.length} times:`);
    players.forEach((p, i) => {
      console.log(`   ${i + 1}. Team: ${p.teamName}, Position: ${p.position}, Power: ${p.power}`);
    });
    console.log();
  }
  
  // Second pass: mark first occurrence as keeper, rest need fixing
  const namesToKeep = new Set();
  const namesToFix = new Map(); // name -> [players to rename]
  
  for (const [name, players] of duplicates) {
    namesToKeep.add(name);
    namesToFix.set(name, players.slice(1)); // Keep first, fix rest
  }
  
  // Add all unique names to used set
  for (const player of allPlayers) {
    if (namesToKeep.has(player.playerName.trim())) {
      usedNames.add(player.playerName.trim());
    }
  }
  
  // Fix duplicates
  let fixedCount = 0;
  const updatePromises = [];
  
  for (const [originalName, players] of namesToFix.entries()) {
    for (const player of players) {
      const newName = getUniqueNameForPosition(player.position, namesToKeep);
      usedNames.add(newName);
      
      updatePromises.push(
        prisma.legendPlayer.update({
          where: { id: player.id },
          data: { playerName: newName }
        }).then(updated => {
          console.log(`✅ Fixed: "${originalName}" -> "${newName}" (${updated.teamName}, ${updated.position})`);
          fixedCount++;
        })
      );
    }
  }
  
  await Promise.all(updatePromises);
  
  console.log(`\n🎉 Fixed ${fixedCount} duplicate player names!`);
  console.log(`\nTotal unique player names: ${usedNames.size}`);
}

// Run the fix
fixDuplicateLegendPlayers()
  .then(() => {
    console.log('\n✨ Database updated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
