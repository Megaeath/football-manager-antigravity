const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// --- CONFIGURATION & DATA ---

const TEAM_NAMES = [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town",
    "Leicester City", "Liverpool", "Manchester City", "Manchester United", "Newcastle United",
    "Nottingham Forest", "Southampton", "Tottenham Hotspur", "West Ham United", "Wolves"
]

const FIRST_NAMES = [
    "James", "Bukayo", "Kevin", "Erling", "Mohamed", "Martin", "Marcus", "Bruno", "Virgil", "Declan",
    "Cole", "Ollie", "Jack", "Phil", "Trent", "Alisson", "Ederson", "Ruben", "William", "Gabriel",
    "Liam", "Noah", "Oliver", "Elijah", "Lucas", "Mason", "Ethan", "Logan", "Aiden", "Kai",
    "Leo", "Hugo", "Mateo", "Adrian", "Rafael", "Sergio", "Pablo", "Diego", "Andres", "Javier",
    "Nicolas", "Thiago", "Rodrigo", "Federico", "Lorenzo", "Matteo", "Alessandro", "Marco", "Antonio", "Giovanni",
    "Alex", "Daniel", "Benjamin", "Samuel", "Isaac", "Jacob", "Ryan", "Oscar", "Adam", "Nathan",
    "Aaron", "Milan", "Ivan", "Viktor", "Marek", "Kacper", "Maksim", "Yusuf", "Amir", "Ibrahim"
]

const LAST_NAMES = [
    "Smith", "Saka", "De Bruyne", "Haaland", "Salah", "Odegaard", "Rashford", "Fernandes", "van Dijk", "Rice",
    "Palmer", "Watkins", "Grealish", "Foden", "Alexander-Arnold", "Becker", "Moraes", "Dias", "Saliba", "Magalhaes",
    "Johnson", "Brown", "Taylor", "Wilson", "Davies", "Evans", "Roberts", "Walker", "Hall", "Turner",
    "Parker", "Morgan", "Hughes", "Bennett", "Carter", "Ward", "Cooper", "Murphy", "Bailey", "Bell",
    "Silva", "Costa", "Almeida", "Fernandez", "Martinez", "Lopez", "Garcia", "Santos", "Pereira", "Ramos",
    "Torres", "Vargas", "Navarro", "Castro", "Mendes", "Nunes", "Goncalves", "Sousa", "Ribeiro", "Correia",
    "Rossi", "Bianchi", "Romano", "Gallo", "Conti", "Moretti", "Ricci", "Marino", "Greco", "Lombardi",
    "Kovacic", "Novak", "Horvat", "Petrovic", "Jovanovic", "Muller", "Schneider", "Weber", "Fischer", "Wagner"
]

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const USED_NAMES = new Set()
const randomName = () => {
    let name = ''
    let attempts = 0

    while (attempts < 25) {
        name = `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`
        if (!USED_NAMES.has(name)) {
            USED_NAMES.add(name)
            return name
        }
        attempts++
    }

    const fallback = `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]} ${randomInt(1, 999)}`
    USED_NAMES.add(fallback)
    return fallback
}

// --- ATTRIBUTE GENERATOR LOGIC ---

function generateAttributes(position) {
    const base = {}
    const atts = [
        'tackling', 'passing', 'shooting', 'heading', 'dribbling', 'setPieces', 'throw',
        'aggression', 'positioning', 'vision', 'bravery', 'leadership',
        'teamwork', 'composure', 'pace', 'acceleration', 'strength', 'agility', 'balance'
    ]

    // 1. กำหนดค่าพื้นฐานให้นักเตะทุกคน (7-13)
    atts.forEach(a => base[a] = randomInt(7, 13))

    // Schema defaults
    base.handling = (position === 'GK') ? randomInt(14, 20) : randomInt(1, 3)
    base.crossing = randomInt(7, 12)
    base.stamina = randomInt(12, 17)

    // 2. ปรับแต่งตามตำแหน่งเฉพาะ
    if (position === 'DC') {
        base.tackling = randomInt(15, 20); base.heading = randomInt(15, 20);
        base.strength = randomInt(15, 20); base.positioning = randomInt(14, 19)
    }

    if (position === 'MC') {
        base.passing = randomInt(15, 20); base.vision = randomInt(14, 20);
        base.teamwork = randomInt(14, 19)
    }

    if (position === 'FW') {
        base.shooting = randomInt(15, 20); base.pace = randomInt(13, 18);
        base.acceleration = randomInt(14, 19); base.composure = randomInt(14, 19)
    }

    // 3. ปรับแต่งนักเตะริมเส้น (Winger & Full-back) ตามที่ขอ
    const isWinger = position === 'MR' || position === 'ML'
    const isFullBack = position === 'DR' || position === 'DL'

    if (isWinger) {
        base.dribbling = randomInt(15, 20) // เลี้ยงบอลเก่ง
        base.crossing = randomInt(15, 20)  // เปิดบอลแม่น
        base.pace = randomInt(15, 20)      // วิ่งเร็วมาก
        base.acceleration = randomInt(15, 20)
        base.agility = randomInt(14, 19)
    }

    if (isFullBack) {
        base.crossing = randomInt(13, 18)  // เติมเกมมาเปิด
        base.tackling = randomInt(13, 18)  // เกมรับยังดี
        base.pace = randomInt(14, 19)      // ต้องวิ่งทันปีก
        base.stamina = randomInt(15, 20)   // ความอึดสูง
        base.throw = randomInt(15, 20)     // ทุ่มบอลเก่ง
    }

    return base
}

// --- MAIN SEED FUNCTION ---

async function main() {
    console.log('--- 🚀 Starting Full Seed (Premier League 2026) ---')

    // 1. ล้างข้อมูลเก่าตามลำดับ (ป้องกัน FK Constraint Error)
    // หมายเหตุ: Match มี relation จาก PlayerActionLog/MatchEvent/PlayerMatchStats
    // และ Team มี relation จากหลายตาราง (เช่น TransferHistory)
    await prisma.playerActionLog.deleteMany()
    await prisma.playerMatchStats.deleteMany()
    await prisma.matchEvent.deleteMany()

    await prisma.transferHistory.deleteMany()
    await prisma.bid.deleteMany()
    await prisma.news.deleteMany()

    await prisma.financialEvent.deleteMany()
    await prisma.clubFinance.deleteMany()
    await prisma.teamReputation.deleteMany()
    await prisma.playerReputation.deleteMany()
    await prisma.teamTactics.deleteMany()

    await prisma.match.deleteMany()
    await prisma.player.deleteMany()
    await prisma.team.deleteMany()
    await prisma.seasonHistory.deleteMany()
    await prisma.league.deleteMany()
    await prisma.globalGameSettings.deleteMany()

    // 2. สร้างลีค
    const league = await prisma.league.create({
        data: { name: 'Premier League', season: 2026 }
    })

    // 3. สร้างทีมและนักเตะ
    for (const teamName of TEAM_NAMES) {
        const team = await prisma.team.create({
            data: {
                name: teamName,
                leagueId: league.id,
                formation: "4-4-2",
                mentality: "NORMAL",
                passing: "MIXED",
                tackling: "NORMAL",
                attacking_focus: "MIXED",
                creative_freedom: "NORMAL"
            }
        })

        // เทมเพลตนักเตะในทีม (23 คน)
        const squadTemplate = [
            { pos: 'GK', nat: 'GK' }, { pos: 'GK', nat: 'GK' },
            { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' },
            { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' },
            { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' },
            { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' },
            { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' },
            { pos: 'GK', nat: 'GK' }, { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' }, { pos: 'MC', nat: 'MC' }, { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' }
        ]

        const assigned = { GK: 0, DR: 0, DL: 0, DC: 0, MR: 0, ML: 0, MC: 0, FW: 0 }

        const playersData = squadTemplate.map(p => {
            const stats = generateAttributes(p.pos)

            // จัดการ Tactical Position สำหรับแผน 4-4-2 (ตัวจริง 11 คนแรก)
            let tacPos = null
            if (p.pos === 'GK' && assigned.GK < 1) { tacPos = 'GK'; assigned.GK++ }
            else if (p.pos === 'DR' && assigned.DR < 1) { tacPos = 'DR'; assigned.DR++ }
            else if (p.pos === 'DL' && assigned.DL < 1) { tacPos = 'DL'; assigned.DL++ }
            else if (p.pos === 'DC' && assigned.DC < 2) { tacPos = assigned.DC === 0 ? 'DC_L' : 'DC_R'; assigned.DC++ }
            else if (p.pos === 'MR' && assigned.MR < 1) { tacPos = 'MR'; assigned.MR++ }
            else if (p.pos === 'ML' && assigned.ML < 1) { tacPos = 'ML'; assigned.ML++ }
            else if (p.pos === 'MC' && assigned.MC < 2) { tacPos = assigned.MC === 0 ? 'MC_L' : 'MC_R'; assigned.MC++ }
            else if (p.pos === 'FW' && assigned.FW < 2) { tacPos = assigned.FW === 0 ? 'FW_L' : 'FW_R'; assigned.FW++ }

            const age = randomInt(18, 35)
            return {
                teamId: team.id,
                name: randomName(),
                age,
                naturalPosition: p.nat,
                retirementAge: randomInt(30, 40),
                tacticalPosition: tacPos,
                morale: 100,
                condition: 100,
                isRetired: false,
                birthDate: new Date(2026 - age, randomInt(0, 11), randomInt(1, 28)),
                ...stats
            }
        })

        await prisma.player.createMany({ data: playersData })
        console.log(`✓ ${teamName} created with ${playersData.length} players`)
    }

    // 4. ตั้งค่า Global Game Settings (Arsenal เป็นทีมเริ่มต้น)
    const userTeam = await prisma.team.findFirst({ where: { name: 'Arsenal' } })
    await prisma.globalGameSettings.create({
        data: {
            id: 1,
            currentDate: new Date('2026-01-01'),
            currentSeason: 1,
            isConfigured: true,
            userTeamId: userTeam?.id
        }
    })

    // 5. สร้างตารางการแข่งขัน (Fixtures) - 38 นัดต่อทีม
    const allTeams = await prisma.team.findMany({ select: { id: true } })
    let teamIds = allTeams.map(t => t.id)
    const fixtures = []
    const seasonStart = new Date(Date.UTC(2026, 1, 1)) 

    // Round Robin Algorithm
    for (let r = 0; r < 19; r++) {
        for (let i = 0; i < 10; i++) {
            const matchDate = new Date(seasonStart)
            matchDate.setUTCDate(seasonStart.getUTCDate() + (r * 7))
            fixtures.push({
                date: matchDate,
                homeTeamId: teamIds[i],
                awayTeamId: teamIds[19 - i],
                isPlayed: false,
                season: 1
            })
        }
        teamIds.splice(1, 0, teamIds.pop()) // หมุนทีม
    }

    // นัดที่ 2 (สลับเจ้าบ้าน)
    const secondHalf = fixtures.map(f => {
        const d = new Date(f.date)
        d.setUTCDate(d.getUTCDate() + (20 * 7))
        return {
            ...f,
            date: d,
            homeTeamId: f.awayTeamId,
            awayTeamId: f.homeTeamId
        }
    })

    await prisma.match.createMany({ data: [...fixtures, ...secondHalf] })

    console.log(`--- 🌱 Seed Completed! Generated ${TEAM_NAMES.length} teams and ${fixtures.length * 2} matches. ---`)
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