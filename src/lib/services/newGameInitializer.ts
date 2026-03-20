import prisma from '@/lib/prisma';
import { getDivisionName } from './divisionSystem';
import { AI_PLAYSTYLE_PROFILES } from './aiPlaystyleProfiles';

type PlayerAttributeSet = {
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
    throw: number;
    aggression: number;
    positioning: number;
    vision: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    composure: number;
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    balance: number;
};

const DIVISION_1_TEAM_NAMES = [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
    'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
    'Leicester City', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
    'Nottingham Forest', 'Southampton', 'Tottenham Hotspur', 'West Ham United', 'Wolves'
];

const DIVISION_2_TEAM_NAMES = [
    'Leeds United', 'Sunderland', 'Burnley', 'Sheffield United', 'Middlesbrough',
    'West Bromwich Albion', 'Norwich City', 'Watford', 'Coventry City', 'Stoke City',
    'Derby County', 'Blackburn Rovers', 'Portsmouth', 'Hull City', 'Swansea City',
    'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Girona', 'Athletic Bilbao'
];

const DIVISION_3_TEAM_NAMES = [
    'Real Sociedad', 'Real Betis', 'Sevilla', 'Valencia', 'Villarreal',
    'Bayern Munich', 'Bayer Leverkusen', 'Borussia Dortmund', 'RB Leipzig', 'VfB Stuttgart',
    'Paris Saint-Germain', 'Monaco', 'Lille', 'Marseille', 'Lyon',
    'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'AS Roma'
];

const DIVISION_TEAM_NAMES = [
    DIVISION_1_TEAM_NAMES,
    DIVISION_2_TEAM_NAMES,
    DIVISION_3_TEAM_NAMES
];

export const NEW_GAME_DIVISION_TEAMS = [
    { level: 1, name: 'Division 1', teams: DIVISION_1_TEAM_NAMES },
    { level: 2, name: 'Division 2', teams: DIVISION_2_TEAM_NAMES },
    { level: 3, name: 'Division 3', teams: DIVISION_3_TEAM_NAMES }
];

const FIRST_NAMES = [
    // Classic & Modern
    'James', 'Liam', 'Noah', 'Oliver', 'Mason', 'Ethan', 'Logan', 'Lucas', 'Aiden', 'Kai',
    'Jack', 'Phil', 'Trent', 'Cole', 'Ollie', 'Marcus', 'Bruno', 'Kevin', 'Erling', 'Martin',
    // European Style
    'Mateo', 'Rafael', 'Sergio', 'Pablo', 'Diego', 'Andres', 'Javier', 'Nicolas', 'Thiago', 'Rodrigo',
    'Lorenzo', 'Alessandro', 'Marco', 'Antonio', 'Giovanni', 'Luca', 'Hugo', 'Adrian', 'Leo', 'Stefan',
    // Diverse & International
    'Yusuf', 'Amir', 'Ibrahim', 'Kenji', 'Hiroshi', 'Seksan', 'Somchai', 'Kavin', 'Arjun', 'Zayn',
    'Milan', 'Ivan', 'Viktor', 'Marek', 'Kacper', 'Maksim', 'Luka', 'Nikola', 'Dimitri', 'Sven',
    // Short & Punchy
    'Ben', 'Dan', 'Sam', 'Tom', 'Max', 'Joe', 'Will', 'Rob', 'Ned', 'Guy',
    'Zac', 'Rex', 'Ian', 'Lee', 'Ray', 'Jay', 'Ash', 'Finn', 'Jude', 'Beau'
];

const LAST_NAMES = [
    // English Standard
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    // Football Inspired (Slightly altered)
    'Saka', 'De Bruyne', 'Haaland', 'Salah', 'Odegaard', 'Rashford', 'Fernandes', 'van Dijk', 'Rice', 'Palmer',
    'Watkins', 'Grealish', 'Foden', 'Alexander', 'Becker', 'Moraes', 'Dias', 'Saliba', 'Magalhaes', 'White',
    // Global Surnames
    'Rossi', 'Bianchi', 'Romano', 'Gallo', 'Conti', 'Moretti', 'Ricci', 'Marino', 'Greco', 'Lombardi',
    'Silva', 'Costa', 'Almeida', 'Pereira', 'Santos', 'Mendes', 'Nunes', 'Gomes', 'Ribeiro', 'Sosa',
    // Central & Eastern Europe
    'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffman', 'Schulz', 'Koch',
    'Novak', 'Horvat', 'Kovacic', 'Petrovic', 'Jovanovic', 'Popov', 'Ivanov', 'Kuznetsov', 'Sokolov', 'Pavlov'
];



const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function pickRandomAIPlaystyleId() {
    if (AI_PLAYSTYLE_PROFILES.length === 0) {
        return null;
    }
    return AI_PLAYSTYLE_PROFILES[randomInt(0, AI_PLAYSTYLE_PROFILES.length - 1)].id;
}

function buildUniqueName(usedNames: Set<string>) {
    let attempts = 0;

    while (attempts < 100) { // เพิ่มจำนวนรอบในการสุ่ม
        const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

        // เพิ่ม "อักษรย่อชื่อกลาง" สุ่ม 30% เพื่อลดการซ้ำ (เช่น James P. Smith)
        const hasMiddle = Math.random() < 0.3;
        const middle = hasMiddle ? ` ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}. ` : ' ';

        const fullName = `${first}${middle}${last}`.replace(/\s+/g, ' ').trim();

        if (!usedNames.has(fullName)) {
            usedNames.add(fullName);
            return fullName;
        }
        attempts++;
    }

    // กรณีฉุกเฉินถ้าสุ่ม 100 รอบแล้วยังซ้ำ (ซึ่งยากมาก) ให้เติมเลขสุ่ม 2 หลักต่อท้าย
    const emergencyName = `${FIRST_NAMES[0]} ${LAST_NAMES[0]} ${Math.floor(Math.random() * 99)}`;
    usedNames.add(emergencyName);
    return emergencyName;
}

function generateAttributes(position: string): PlayerAttributeSet {
    const base: PlayerAttributeSet = {
        handling: 1,
        tackling: 7,
        passing: 7,
        shooting: 7,
        heading: 7,
        dribbling: 7,
        crossing: 7,
        setPieces: 7,
        throw: 7,
        aggression: 7,
        positioning: 7,
        vision: 7,
        bravery: 7,
        leadership: 7,
        teamwork: 7,
        composure: 7,
        pace: 7,
        acceleration: 7,
        stamina: 12,
        strength: 7,
        agility: 7,
        balance: 7
    };
    const atts = [
        'tackling', 'passing', 'shooting', 'heading', 'dribbling', 'setPieces', 'throw',
        'aggression', 'positioning', 'vision', 'bravery', 'leadership',
        'teamwork', 'composure', 'pace', 'acceleration', 'strength', 'agility', 'balance'
    ];

    atts.forEach((a) => { (base[a as keyof PlayerAttributeSet] as number) = randomInt(7, 13); });

    base.handling = position === 'GK' ? randomInt(14, 20) : randomInt(1, 3);
    base.crossing = randomInt(7, 12);
    base.stamina = randomInt(12, 17);

    if (position === 'DC') {
        base.tackling = randomInt(15, 20);
        base.heading = randomInt(15, 20);
        base.strength = randomInt(15, 20);
        base.positioning = randomInt(14, 19);
    }

    if (position === 'MC') {
        base.passing = randomInt(15, 20);
        base.vision = randomInt(14, 20);
        base.teamwork = randomInt(14, 19);
    }

    if (position === 'FW') {
        base.shooting = randomInt(15, 20);
        base.pace = randomInt(13, 18);
        base.acceleration = randomInt(14, 19);
        base.composure = randomInt(14, 19);
    }

    const isWinger = position === 'MR' || position === 'ML';
    const isFullBack = position === 'DR' || position === 'DL';

    if (isWinger) {
        base.dribbling = randomInt(15, 20);
        base.crossing = randomInt(15, 20);
        base.pace = randomInt(15, 20);
        base.acceleration = randomInt(15, 20);
        base.agility = randomInt(14, 19);
    }

    if (isFullBack) {
        base.crossing = randomInt(13, 18);
        base.tackling = randomInt(13, 18);
        base.pace = randomInt(14, 19);
        base.stamina = randomInt(15, 20);
        base.throw = randomInt(15, 20);
    }

    return base;
}

export async function initializeNewGame(userTeamName: string) {
    await prisma.playerActionLog.deleteMany();
    await prisma.playerMatchStats.deleteMany();
    await prisma.matchEvent.deleteMany();

    await prisma.transferHistory.deleteMany();
    await prisma.bid.deleteMany();
    await prisma.news.deleteMany();

    await prisma.financialEvent.deleteMany();
    await prisma.clubFinance.deleteMany();
    await prisma.teamReputation.deleteMany();
    await prisma.playerReputation.deleteMany();
    await prisma.teamTactics.deleteMany();

    await prisma.match.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.seasonHistory.deleteMany();
    await prisma.league.deleteMany();
    await prisma.globalGameSettings.deleteMany();

    const leagues = await Promise.all(
        [1, 2, 3].map((level) => prisma.league.create({
            data: {
                name: getDivisionName(level),
                season: 1,
                ...({ level } as Record<string, number>)
            }
        }))
    );

    const usedNames = new Set<string>();

    for (const [index, divisionTeams] of DIVISION_TEAM_NAMES.entries()) {
        const league = leagues[index];
        for (const teamName of divisionTeams) {
            const team = await prisma.team.create({
                data: {
                    name: teamName,
                    leagueId: league.id,
                    formation: '4-4-2',
                    mentality: 'NORMAL',
                    passing: 'MIXED',
                    tackling: 'NORMAL',
                    attacking_focus: 'MIXED',
                    creative_freedom: 'NORMAL'
                }
            });

            const squadTemplate = [
                { pos: 'GK', nat: 'GK' }, { pos: 'GK', nat: 'GK' },
                { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' },
                { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' },
                { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' },
                { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' },
                { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' },
                { pos: 'GK', nat: 'GK' }, { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' }, { pos: 'MC', nat: 'MC' }, { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' }
            ];

            const assigned = { GK: 0, DR: 0, DL: 0, DC: 0, MR: 0, ML: 0, MC: 0, FW: 0 };

            const playersData = squadTemplate.map((p) => {
                const stats = generateAttributes(p.pos);

                let tacPos: string | null = null;
                if (p.pos === 'GK' && assigned.GK < 1) { tacPos = 'GK'; assigned.GK++; }
                else if (p.pos === 'DR' && assigned.DR < 1) { tacPos = 'DR'; assigned.DR++; }
                else if (p.pos === 'DL' && assigned.DL < 1) { tacPos = 'DL'; assigned.DL++; }
                else if (p.pos === 'DC' && assigned.DC < 2) { tacPos = assigned.DC === 0 ? 'DC_L' : 'DC_R'; assigned.DC++; }
                else if (p.pos === 'MR' && assigned.MR < 1) { tacPos = 'MR'; assigned.MR++; }
                else if (p.pos === 'ML' && assigned.ML < 1) { tacPos = 'ML'; assigned.ML++; }
                else if (p.pos === 'MC' && assigned.MC < 2) { tacPos = assigned.MC === 0 ? 'MC_L' : 'MC_R'; assigned.MC++; }
                else if (p.pos === 'FW' && assigned.FW < 2) { tacPos = assigned.FW === 0 ? 'FW_L' : 'FW_R'; assigned.FW++; }

                const age = randomInt(18, 35);
                return {
                    teamId: team.id,
                    name: buildUniqueName(usedNames),
                    age,
                    naturalPosition: p.nat,
                    retirementAge: randomInt(31, 33),
                    tacticalPosition: tacPos,
                    morale: 100,
                    condition: 100,
                    isRetired: false,
                    birthDate: new Date(2026 - age, randomInt(0, 11), randomInt(1, 28)),
                    ...stats
                };
            });

            await prisma.player.createMany({ data: playersData });
        }
    }

    const allTeams = await prisma.team.findMany({ select: { id: true, name: true } });

    const selectedUserTeam = allTeams.find((t) => t.name === userTeamName) || allTeams.find((t) => t.name === 'Arsenal') || allTeams[0];

    // Assign random AI playstyle profile to all AI teams on every new game start.
    // Exclude the selected user team from AI playstyle assignment.
    const aiTeams = allTeams.filter((team) => team.id !== selectedUserTeam?.id);
    if (aiTeams.length > 0 && AI_PLAYSTYLE_PROFILES.length > 0) {
        await prisma.$transaction(
            aiTeams.map((team) => prisma.team.update({
                where: { id: team.id },
                data: { aiPlaystyleProfileId: pickRandomAIPlaystyleId() }
            }))
        );
    }

    await prisma.globalGameSettings.create({
        data: {
            id: 1,
            currentDate: new Date('2026-01-01'),
            currentSeason: 1,
            isConfigured: true,
            userTeamId: selectedUserTeam?.id || null
        }
    });

    let matchCount = 0;
    for (const league of leagues) {
        const divisionTeams = await prisma.team.findMany({
            where: { leagueId: league.id },
            select: { id: true }
        });
        const teamIds = divisionTeams.map((t) => t.id);
        const fixtures: Array<{ date: Date; homeTeamId: string; awayTeamId: string; isPlayed: boolean; season: number }> = [];
        const seasonStart = new Date(Date.UTC(2026, 1, 1));

        for (let round = 0; round < 19; round++) {
            for (let i = 0; i < 10; i++) {
                const matchDate = new Date(seasonStart);
                matchDate.setUTCDate(seasonStart.getUTCDate() + (round * 7));
                fixtures.push({
                    date: matchDate,
                    homeTeamId: teamIds[i],
                    awayTeamId: teamIds[19 - i],
                    isPlayed: false,
                    season: 1
                });
            }
            teamIds.splice(1, 0, teamIds.pop() as string);
        }

        const secondHalf = fixtures.map((fixture) => {
            const date = new Date(fixture.date);
            date.setUTCDate(date.getUTCDate() + (20 * 7));
            return {
                ...fixture,
                date,
                homeTeamId: fixture.awayTeamId,
                awayTeamId: fixture.homeTeamId
            };
        });

        matchCount += fixtures.length * 2;
        await prisma.match.createMany({ data: [...fixtures, ...secondHalf] });
    }

    return {
        success: true,
        userTeamId: selectedUserTeam?.id || null,
        userTeamName: selectedUserTeam?.name || null,
        teams: allTeams.length,
        matches: matchCount
    };
}
