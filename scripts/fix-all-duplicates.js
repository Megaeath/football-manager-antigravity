// Complete fix: Remove ALL duplicate legend names
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Pool of REAL legendary players - no numbers, no duplicates
const realLegends = {
  GK: [
    "Peter Schmeichel", "Oliver Kahn", "Gianluigi Buffon", "Iker Casillas",
    "Edwin van der Sar", "Fabien Barthez", "Claudio Taffarel", "Jorge Campos",
    "Andoni Zubizarreta", "Sepp Maier", "Dino Zoff", "Gordon Banks",
    "Rinat Dasayev", "Jan Oblak", "Manuel Neuer", "Thibaut Courtois",
    "Ricardo Zamora", "Frantisek Planicka", "Giuseppe Meazza", "Lev Yashin"
  ],
  RB: [
    "Cafu", "Dani Alves", "Javier Zanetti", "Phillip Lahm", "Carlos Alberto",
    "Gary Neville", "Jairzinho", "Sergio Ramos", "Cesar Azpilicueta",
    "Patrice Evra", "Maicon", "Dani Carvajal", "Kyle Walker", "Trent Alexander-Arnold",
    "Lilian Thuram", "Giuseppe Bergomi", "Carlos Puyol"
  ],
  RCB: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique",
    "Bobby Moore", "Fabio Cannavaro", "Daniel Passarella"
  ],
  LCB: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique",
    "Bobby Moore", "Fabio Cannavaro", "Daniel Passarella"
  ],
  LB: [
    "Roberto Carlos", "Paolo Maldini", "Marcelo", "Giacinto Facchetti",
    "Junior", "Nilton Santos", "Bixente Lizarazu", "Filippo Inzaghi",
    "Leighton Baines", "Denis Irwin", "Andy Robertson", "Jordi Alba",
    "David Alaba", "Patrice Evra", "Andrea Pirlo"
  ],
  DM: [
    "Claude Makelele", "Nolo Kante", "Sergio Busquets", "Rodri",
    "Casemiro", "Patrick Vieira", "Roy Keane", "Gennaro Gattuso",
    "Fernando Redondo", "Edgar Davids", "Makelele", "Javier Mascherano",
    "Nemanja Matic", "Fabinho", "Joshua Kimmich", "Toni Kroos",
    "Claude Makelele", "Lothar Matthaus", "Raul Albiol"
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
  DMC: [
    "Claude Makelele", "Sergio Busquets", "Casemiro", "Roy Keane",
    "Patrick Vieira", "Gennaro Gattuso", "Fernando Redondo", "Edgar Davids",
    "Javier Mascherano", "Nemanja Matic", "Fabinho", "Joshua Kimmich",
    "Toni Kroos", "Lothar Matthaus", "Raul Albiol", "Carles Rexach",
    "Didier Deschamps", "Dunga", "Demetrio Albertini"
  ],
  MC: [
    "Zinedine Zidane", "Andres Iniesta", "Xavi Hernandez", "Frank Lampard",
    "Steven Gerrard", "Paul Scholes", "Andrea Pirlo", "Luka Modric",
    "Kevin De Bruyne", "Michel Platini", "Johan Cruyff", "Bobby Charlton",
    "Lothar Matthaus", "Ruud Gullit", "Marco van Basten", "Zico",
    "Raymond Kopa", "Socrates", "Zico", "Juninho Pernambucano"
  ],
  FWC: [
    "Ronaldo Nazario", "Thierry Henry", "Marco van Basten", "Ruud van Nistelrooy",
    "Alessandro Del Piero", "Gabriel Batistuta", "Filippo Inzaghi", "David Trezeguet",
    "Samuel Eto'o", "Didier Drogba", "Fernando Torres", "Robin van Persie",
    "Alan Shearer", "Ian Wright", "Les Ferdinand", "Dennis Bergkamp",
    "Mario Kempes", "Romario", "Hugo Sanchez", "Karl-Heinz Rummenigge"
  ],
  AMC: [
    "Zinedine Zidane", "Diego Maradona", "Pele", "Ronaldinho",
    "Kaka", "Roberto Baggio", "Michel Platini", "Johan Cruyff",
    "Rivaldo", "Zico", "Socrates", "Hristo Stoichkov", "Gheorghe Hagi",
    "Ruud Gullit", "Luis Figo", "Rui Costa"
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
  ],
  DR: [
    "Cafu", "Dani Alves", "Javier Zanetti", "Phillip Lahm", "Carlos Alberto",
    "Gary Neville", "Jairzinho", "Sergio Ramos", "Cesar Azpilicueta",
    "Patrice Evra", "Maicon", "Dani Carvajal", "Kyle Walker", "Trent Alexander-Arnold",
    "Lilian Thuram", "Giuseppe Bergomi", "Carlos Puyol"
  ],
  DL: [
    "Roberto Carlos", "Paolo Maldini", "Marcelo", "Giacinto Facchetti",
    "Junior", "Nilton Santos", "Bixente Lizarazu", "Filippo Inzaghi",
    "Leighton Baines", "Denis Irwin", "Andy Robertson", "Jordi Alba",
    "David Alaba", "Patrice Evra", "Andrea Pirlo"
  ],
  DC: [
    "Franco Baresi", "Alessandro Nesta", "Paolo Maldini", "Sergio Ramos",
    "Rio Ferdinand", "John Terry", "Carles Puyol", "Virgil van Dijk",
    "Matthias Sammer", "Ronald Koeman", "Ruud Krol", "Karl-Heinz Schnellinger",
    "Jaap Stam", "Lucio", "Mats Hummels", "Gerard Pique",
    "Bobby Moore", "Fabio Cannavaro", "Daniel Passarella"
  ]
};

const usedNames = new Set();

async function fixAllDuplicates() {
  console.log('🔧 Fixing ALL duplicate legend names...\n');
  console.log('='.repeat(80));
  
  // Get all players
  const allPlayers = await prisma.legendPlayer.findMany();
  console.log(`Total players: ${allPlayers.length}\n`);
  
  // Find duplicates
  const nameMap = {};
  for (const player of allPlayers) {
    if (!nameMap[player.playerName]) {
      nameMap[player.playerName] = [];
    }
    nameMap[player.playerName].push(player);
  }
  
  const duplicates = Object.entries(nameMap).filter(([name, players]) => players.length > 1);
  console.log(`Found ${duplicates.length} duplicate names\n`);
  
  // Mark first occurrence as keeper
  const namesToKeep = new Set();
  const playersToRename = [];
  
  for (const [name, players] of duplicates) {
    namesToKeep.add(name);
    playersToRename.push(...players.slice(1));
  }
  
  // Add all existing names to usedNames
  for (const name of Object.keys(nameMap)) {
    usedNames.add(name);
  }
  
  // Rename duplicates
  let successCount = 0;
  let failCount = 0;
  
  for (const player of playersToRename) {
    const posKey = player.position;
    const pool = realLegends[posKey];
    
    if (!pool) {
      console.log(`⚠️  No pool for position: ${player.position} (${player.playerName})`);
      failCount++;
      continue;
    }
    
    // Find unique name
    let newName = null;
    for (const name of pool) {
      if (!usedNames.has(name)) {
        newName = name;
        break;
      }
    }
    
    if (!newName) {
      // Try all pools
      for (const [pos, names] of Object.entries(realLegends)) {
        for (const name of names) {
          if (!usedNames.has(name)) {
            newName = name;
            break;
          }
        }
        if (newName) break;
      }
    }
    
    if (newName) {
      usedNames.add(newName);
      
      await prisma.legendPlayer.update({
        where: { id: player.id },
        data: { playerName: newName }
      });
      
      console.log(`✅ ${player.playerName.padEnd(25)} → "${newName.padEnd(25)}" (${player.teamName.padEnd(25)} ${player.position})`);
      successCount++;
    } else {
      console.log(`❌ No available name for: ${player.playerName} (${player.teamName}, ${player.position})`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✨ Results: ${successCount} renamed, ${failCount} failed\n`);
  
  // Final verification
  const finalPlayers = await prisma.legendPlayer.findMany();
  const finalNameMap = {};
  
  for (const player of finalPlayers) {
    if (!finalNameMap[player.playerName]) {
      finalNameMap[player.playerName] = [];
    }
    finalNameMap[player.playerName].push(player);
  }
  
  const finalDuplicates = Object.entries(finalNameMap).filter(([name, players]) => players.length > 1);
  
  if (finalDuplicates.length === 0) {
    console.log('✅ SUCCESS! All player names are now UNIQUE!');
  } else {
    console.log(`⚠️  Still have ${finalDuplicates.length} duplicates`);
    for (const [name, players] of finalDuplicates) {
      console.log(`   "${name}": ${players.map(p => p.teamName).join(', ')}`);
    }
  }
}

fixAllDuplicates()
  .then(() => prisma.$disconnect())
  .catch(console.error);
