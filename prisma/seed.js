const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Positions distribution
const SQUAD_COMPOSITION = {
    GK: 3,
    DF: 8,
    MF: 7,
    FW: 5
}

// Team Names (20 Premier League inspired generic names)
const TEAM_NAMES = [
    "Red FC", "Blue United", "North London", "West Ham", "East City",
    "Southampton Saints", "Villa Park", "Wolves Wanderers", "Leicester Foxes", "Everton Toffees",
    "Leeds Whites", "Newcastle Stripes", "Brighton Gulls", "Burnley Clarets", "Palace Eagles",
    "Fulham Cottagers", "Brentford Bees", "Norwich Canaries", "Watford Hornets", "Sheffield Blades"
]

const LAST_NAMES = [
    "Smith", "Jones", "Williams", "Brown", "Taylor", "Davies", "Evans", "Wilson", "Thomas", "Roberts",
    "Johnson", "Lewis", "Walker", "Robinson", "Wood", "Thompson", "White", "Watson", "Jackson", "Wright",
    "Silva", "Santos", "Fernandes", "Martinez", "Garcia", "Rodriguez", "Lopez", "Gonzalez", "Perez", "Sanchez"
]

const FIRST_NAMES = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
    "Daniel", "Matthew", "Anthony", "Donald", "Mark", "Paul", "Steven", "Andrew", "Kenneth", "Joshua",
    "Jorge", "Luis", "Carlos", "Juan", "Pedro", "Antonio", "Miguel", "Jose", "Manuel", "Paulo"
]

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomName() {
    return `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`
}

function generateAttributes(position) {
    const base = {}

    // Initialize all with average
    const atts = [
        'handling', 'tackling', 'passing', 'shooting', 'heading', 'dribbling', 'setPieces',
        'aggression', 'positioning', 'vision', 'bravery', 'leadership', 'teamwork', 'composure',
        'pace', 'acceleration', 'stamina', 'strength', 'agility', 'balance'
    ]

    atts.forEach(a => base[a] = randomInt(5, 15))

    // Boost based on position
    if (position === 'GK') {
        base.handling = randomInt(14, 20)
        base.positioning = randomInt(12, 18)
        base.agility = randomInt(12, 18)
    } else if (position.includes('D')) {
        base.tackling = randomInt(14, 19)
        base.heading = randomInt(14, 19)
        base.positioning = randomInt(13, 18)
        base.strength = randomInt(13, 18)
    } else if (position.includes('M')) {
        base.passing = randomInt(14, 19)
        base.vision = randomInt(14, 19)
        base.teamwork = randomInt(13, 18)
        base.stamina = randomInt(14, 19)
    } else if (position.includes('F')) {
        base.shooting = randomInt(14, 20)
        base.dribbling = randomInt(13, 18)
        base.pace = randomInt(14, 19)
        base.acceleration = randomInt(14, 19)
        base.composure = randomInt(12, 18)
    }

    return base
}

async function main() {
    console.log('Clearing database...')
    try {
        await prisma.matchEvent.deleteMany()
        await prisma.playerMatchStats.deleteMany()
        await prisma.match.deleteMany()
        await prisma.player.deleteMany()
        await prisma.team.deleteMany()
        await prisma.league.deleteMany()
    } catch (e) {
        console.log('Database might be empty or table missing, continuing...')
    }

    console.log('Creating League...')
    const league = await prisma.league.create({
        data: {
            name: 'Premier League',
            season: 2026
        }
    })

    console.log('Creating 20 Teams and Players...')

    for (const teamName of TEAM_NAMES) {
        const team = await prisma.team.create({
            data: {
                name: teamName,
                leagueId: league.id,
                formation: "4-4-2",
                mentality: "NORMAL"
            }
        })

        const playersToCreate = []

        // 3 GK
        for (let i = 0; i < 3; i++) playersToCreate.push({ pos: 'GK', natural: 'GK' })
        // 8 DF (Mix of DC, DR, DL)
        for (let i = 0; i < 4; i++) playersToCreate.push({ pos: 'DC', natural: 'DC' })
        for (let i = 0; i < 2; i++) playersToCreate.push({ pos: 'DR', natural: 'DR' })
        for (let i = 0; i < 2; i++) playersToCreate.push({ pos: 'DL', natural: 'DL' })
        // 7 MF (Mix of MC, MR, ML)
        for (let i = 0; i < 3; i++) playersToCreate.push({ pos: 'MC', natural: 'MC' })
        for (let i = 0; i < 2; i++) playersToCreate.push({ pos: 'MR', natural: 'MR' })
        for (let i = 0; i < 2; i++) playersToCreate.push({ pos: 'ML', natural: 'ML' })
        // 5 FW
        for (let i = 0; i < 5; i++) playersToCreate.push({ pos: 'FW', natural: 'FWC' })

        const assignedPositions = {
            GK: 0, DR: 0, DL: 0, DC: 0,
            MR: 0, ML: 0, MC: 0,
            FW: 0
        };

        for (const p of playersToCreate) {
            const stats = generateAttributes(p.pos)

            // AUTO-PICK TACTICAL POSITION for 4-4-2
            let tacticalPos = null;
            if (p.pos === 'GK' && assignedPositions.GK < 1) { tacticalPos = 'GK'; assignedPositions.GK++; }
            else if (p.pos === 'DR' && assignedPositions.DR < 1) { tacticalPos = 'DR'; assignedPositions.DR++; }
            else if (p.pos === 'DL' && assignedPositions.DL < 1) { tacticalPos = 'DL'; assignedPositions.DL++; }
            else if (p.pos === 'DC' && assignedPositions.DC < 2) { tacticalPos = assignedPositions.DC === 0 ? 'DC_L' : 'DC_R'; assignedPositions.DC++; }
            else if (p.pos === 'MR' && assignedPositions.MR < 1) { tacticalPos = 'MR'; assignedPositions.MR++; }
            else if (p.pos === 'ML' && assignedPositions.ML < 1) { tacticalPos = 'ML'; assignedPositions.ML++; }
            else if (p.pos === 'MC' && assignedPositions.MC < 2) { tacticalPos = assignedPositions.MC === 0 ? 'MC_L' : 'MC_R'; assignedPositions.MC++; }
            else if (p.pos === 'FW' && assignedPositions.FW < 2) { tacticalPos = assignedPositions.FW === 0 ? 'FW_L' : 'FW_R'; assignedPositions.FW++; }

            const age = randomInt(18, 35);
            const birthDate = new Date();
            birthDate.setFullYear(birthDate.getFullYear() - age);
            birthDate.setDate(birthDate.getDate() - randomInt(0, 365));

            await prisma.player.create({
                data: {
                    teamId: team.id,
                    name: randomName(),
                    age: age,
                    birthDate: birthDate,
                    retirementAge: randomInt(35, 40),
                    naturalPosition: p.natural,
                    tacticalPosition: tacticalPos, // NEW FIELD
                    // Technical
                    handling: stats.handling || randomInt(1, 10), // Only high for GK
                    tackling: stats.tackling,
                    passing: stats.passing,
                    shooting: stats.shooting,
                    heading: stats.heading,
                    dribbling: stats.dribbling,
                    setPieces: stats.setPieces,
                    // Mental
                    aggression: stats.aggression,
                    positioning: stats.positioning,
                    vision: stats.vision,
                    bravery: stats.bravery,
                    leadership: stats.leadership,
                    teamwork: stats.teamwork,
                    composure: stats.composure,
                    // Physical
                    pace: stats.pace,
                    acceleration: stats.acceleration,
                    stamina: stats.stamina,
                    strength: stats.strength,
                    agility: stats.agility,
                    balance: stats.balance
                }
            })
        }
        console.log(`Created ${teamName} with ${playersToCreate.length} players.`)
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
