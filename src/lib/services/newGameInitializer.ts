import prisma from '@/lib/prisma';
import { getDivisionName } from './divisionSystem';
import { AI_PLAYSTYLE_PROFILES } from './aiPlaystyleProfiles';
import { generateSeasonFixtures } from './fixtureGenerator';
import { initializeCupTournamentForSeason } from './SwissTournament';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';

export type NewGameMode = 'normal' | 'legend';

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

type SquadTemplateSlot = {
    pos: string;
    nat: string;
};

type LegendCatalogEntry = {
    teamName: string;
    playerName: string;
    position: string;
    age: number;
    power: number;
    division: number;
    sourceFile: string;
};

type SeedPlayerRecord = {
    name: string;
    age: number;
    naturalPosition: string;
    retirementAge: number;
    tacticalPosition: string | null;
    morale: number;
    condition: number;
    isRetired: boolean;
    popularity: number;
    exp: number;
    birthDate: Date;
    power: number;
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

const SQUAD_TEMPLATE: SquadTemplateSlot[] = [
    { pos: 'GK', nat: 'GK' }, { pos: 'GK', nat: 'GK' },
    { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' },
    { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' }, { pos: 'DC', nat: 'DC' },
    { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' },
    { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' }, { pos: 'MC', nat: 'MC' },
    { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' }, { pos: 'FW', nat: 'FWC' },
    { pos: 'GK', nat: 'GK' }, { pos: 'DR', nat: 'DR' }, { pos: 'DL', nat: 'DL' }, { pos: 'MC', nat: 'MC' }, { pos: 'MR', nat: 'MR' }, { pos: 'ML', nat: 'ML' }
];

const STARTING_TACTICAL_SLOTS = ['GK', 'DR', 'DL', 'DC_L', 'DC_R', 'MR', 'ML', 'MC_L', 'MC_R', 'FW_L', 'FW_R'] as const;

const POSITION_FALLBACKS: Record<string, string[]> = {
    GK: ['GK'],
    DR: ['DR', 'DL', 'DC', 'DMC'],
    DL: ['DL', 'DR', 'DC', 'DMC'],
    DC: ['DC', 'DMC', 'DR', 'DL'],
    DMC: ['DMC', 'MC', 'DC'],
    MC: ['MC', 'DMC', 'AMC', 'MR', 'ML'],
    AMC: ['AMC', 'MC', 'FWC', 'MR', 'ML'],
    MR: ['MR', 'ML', 'AMC', 'MC', 'FWC'],
    ML: ['ML', 'MR', 'AMC', 'MC', 'FWC'],
    FWC: ['FWC', 'AMC', 'MR', 'ML']
};

const TACTICAL_SLOT_PREFERENCES: Record<(typeof STARTING_TACTICAL_SLOTS)[number], string[]> = {
    GK: ['GK'],
    DR: ['DR', 'DL', 'DC', 'DMC'],
    DL: ['DL', 'DR', 'DC', 'DMC'],
    DC_L: ['DC', 'DMC', 'DR', 'DL'],
    DC_R: ['DC', 'DMC', 'DR', 'DL'],
    MR: ['MR', 'ML', 'AMC', 'MC', 'FWC'],
    ML: ['ML', 'MR', 'AMC', 'MC', 'FWC'],
    MC_L: ['MC', 'DMC', 'AMC', 'MR', 'ML'],
    MC_R: ['MC', 'DMC', 'AMC', 'MR', 'ML'],
    FW_L: ['FWC', 'AMC', 'MR', 'ML'],
    FW_R: ['FWC', 'AMC', 'MR', 'ML']
};

const LEGEND_PRIMARY_ATTRS: Record<string, Array<keyof PlayerAttributeSet>> = {
    GK: ['handling', 'positioning', 'agility', 'composure', 'throw', 'teamwork'],
    DR: ['pace', 'acceleration', 'crossing', 'tackling', 'stamina', 'agility', 'positioning'],
    DL: ['pace', 'acceleration', 'crossing', 'tackling', 'stamina', 'agility', 'positioning'],
    DC: ['tackling', 'heading', 'positioning', 'strength', 'bravery', 'balance', 'teamwork'],
    DMC: ['passing', 'vision', 'tackling', 'teamwork', 'positioning', 'composure', 'stamina'],
    MC: ['passing', 'vision', 'stamina', 'teamwork', 'dribbling', 'composure', 'positioning'],
    AMC: ['passing', 'dribbling', 'vision', 'shooting', 'positioning', 'composure', 'teamwork'],
    MR: ['pace', 'acceleration', 'dribbling', 'crossing', 'agility', 'passing', 'stamina'],
    ML: ['pace', 'acceleration', 'dribbling', 'crossing', 'agility', 'passing', 'stamina'],
    FWC: ['shooting', 'heading', 'pace', 'composure', 'positioning', 'balance', 'acceleration']
};

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

const clampStat = (value: number) => Math.max(1, Math.min(20, Math.round(value)));

function normalizeLegendPosition(position: string) {
    const upper = position.toUpperCase();
    if (upper === 'FW' || upper === 'ST') return 'FWC';
    return upper;
}

function getGeneratorPosition(position: string) {
    const normalized = normalizeLegendPosition(position);
    if (normalized === 'FWC') return 'FW';
    if (normalized === 'AMC' || normalized === 'DMC') return 'MC';
    return normalized;
}

function getRelevantAttributes(position: string) {
    const normalized = normalizeLegendPosition(position);
    return LEGEND_PRIMARY_ATTRS[normalized] || LEGEND_PRIMARY_ATTRS[getGeneratorPosition(normalized)] || LEGEND_PRIMARY_ATTRS.MC;
}

function getPositionPreferences(position: string) {
    const normalized = normalizeLegendPosition(position);
    return POSITION_FALLBACKS[normalized] || [normalized, getGeneratorPosition(normalized)];
}

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

function calculatePlayerSeedPower(attrs: PlayerAttributeSet, naturalPosition: string, exp = 0): number {
    return calculatePlayerPower({
        attributes: toPlayerAttributes(attrs),
        targetPosition: normalizeLegendPosition(naturalPosition),
        naturalPosition: normalizeLegendPosition(naturalPosition),
        condition: 100,
        exp
    }).powerWithExp;
}

function getCandidateSlotIndex(remainingSlots: SquadTemplateSlot[], naturalPosition: string) {
    const preferences = getPositionPreferences(naturalPosition);

    for (const preferred of preferences) {
        const exactIndex = remainingSlots.findIndex((slot) => slot.nat === preferred);
        if (exactIndex >= 0) {
            return exactIndex;
        }
    }

    const normalizedGenerator = getGeneratorPosition(naturalPosition);
    return remainingSlots.findIndex((slot) => slot.pos === normalizedGenerator);
}

function assignStartingTacticalPositions(players: SeedPlayerRecord[]) {
    const assignedPlayers = new Set<number>();

    for (const tacticalSlot of STARTING_TACTICAL_SLOTS) {
        const preferences = TACTICAL_SLOT_PREFERENCES[tacticalSlot];
        let bestPlayerIndex = -1;
        let bestScore = Number.NEGATIVE_INFINITY;

        players.forEach((player, index) => {
            if (assignedPlayers.has(index)) return;

            const normalizedPosition = normalizeLegendPosition(player.naturalPosition);
            const preferenceIndex = preferences.indexOf(normalizedPosition);
            if (preferenceIndex === -1) return;

            const preferenceScore = (preferences.length - preferenceIndex) * 1000;
            const score = preferenceScore + player.power;

            if (score > bestScore) {
                bestScore = score;
                bestPlayerIndex = index;
            }
        });

        if (bestPlayerIndex >= 0) {
            players[bestPlayerIndex].tacticalPosition = tacticalSlot;
            assignedPlayers.add(bestPlayerIndex);
        }
    }
}

function createLegendSeedAttributes(naturalPosition: string, targetPower: number, expBonus: number): PlayerAttributeSet {
    const generatorPosition = getGeneratorPosition(naturalPosition);
    const attrs = generateAttributes(generatorPosition);
    const relevantAttributes = getRelevantAttributes(naturalPosition);
    const weightedBase = clampStat(targetPower / 5 - expBonus + 1);
    const supportBase = clampStat(weightedBase - 2);
    const neutralBase = clampStat(weightedBase - 4);

    (Object.keys(attrs) as Array<keyof PlayerAttributeSet>).forEach((key) => {
        if (key === 'handling' && generatorPosition !== 'GK') {
            attrs[key] = randomInt(1, 3);
            return;
        }

        if (relevantAttributes.includes(key)) {
            attrs[key] = clampStat(weightedBase + randomInt(-2, 2));
            return;
        }

        if (['stamina', 'teamwork', 'composure', 'positioning', 'balance'].includes(key)) {
            attrs[key] = clampStat(supportBase + randomInt(-2, 2));
            return;
        }

        attrs[key] = clampStat(neutralBase + randomInt(-3, 2));
    });

    return attrs;
}

function optimizeAttributesForTargetPower(attrs: PlayerAttributeSet, naturalPosition: string, targetPower: number, exp: number) {
    const relevantKeys = getRelevantAttributes(naturalPosition);
    const supportKeys: Array<keyof PlayerAttributeSet> = ['stamina', 'teamwork', 'composure', 'positioning', 'balance', 'strength', 'agility'];
    const allKeys = Array.from(new Set<keyof PlayerAttributeSet>([...relevantKeys, ...supportKeys, ...(Object.keys(attrs) as Array<keyof PlayerAttributeSet>)]));

    for (let iteration = 0; iteration < 320; iteration++) {
        const currentPower = calculatePlayerSeedPower(attrs, naturalPosition, exp);
        if (currentPower === targetPower) {
            break;
        }

        const direction = currentPower < targetPower ? 1 : -1;
        let bestKey: keyof PlayerAttributeSet | null = null;
        let bestValue = 0;
        let bestError = Math.abs(currentPower - targetPower);

        for (const key of allKeys) {
            const nextValue = attrs[key] + direction;
            if (nextValue < 1 || nextValue > 20) continue;
            if (key === 'handling' && getGeneratorPosition(naturalPosition) !== 'GK' && direction > 0 && nextValue > 5) continue;

            const candidate = { ...attrs, [key]: nextValue };
            const nextPower = calculatePlayerSeedPower(candidate, naturalPosition, exp);
            const nextError = Math.abs(nextPower - targetPower);

            if (nextError < bestError) {
                bestError = nextError;
                bestKey = key;
                bestValue = nextValue;
                if (nextError === 0) {
                    break;
                }
            }
        }

        if (!bestKey) {
            break;
        }

        attrs[bestKey] = bestValue;
    }

    return attrs;
}

function buildLegendPlayerAttributes(naturalPosition: string, targetPower: number) {
    let bestAttrs = createLegendSeedAttributes(naturalPosition, targetPower, 0);
    let bestExp = 0;
    let bestPower = calculatePlayerSeedPower(bestAttrs, naturalPosition, bestExp);
    let bestError = Math.abs(bestPower - targetPower);

    for (const expBonus of [0, 1, 2, 3]) {
        const exp = expBonus * 100;

        for (let seed = 0; seed < 18; seed++) {
            const candidate = optimizeAttributesForTargetPower(
                createLegendSeedAttributes(naturalPosition, targetPower, expBonus),
                naturalPosition,
                targetPower,
                exp
            );
            const power = calculatePlayerSeedPower(candidate, naturalPosition, exp);
            const error = Math.abs(power - targetPower);

            if (error < bestError) {
                bestAttrs = candidate;
                bestExp = exp;
                bestPower = power;
                bestError = error;
            }

            if (power === targetPower) {
                return { attrs: candidate, exp, power };
            }
        }
    }

    return { attrs: bestAttrs, exp: bestExp, power: bestPower };
}

async function snapshotLegendCatalog(): Promise<LegendCatalogEntry[]> {
    const legends = await prisma.legendPlayer.findMany({
        select: {
            teamName: true,
            playerName: true,
            position: true,
            age: true,
            power: true,
            division: true,
            sourceFile: true
        }
    });

    return legends.map((legend) => ({
        ...legend,
        position: normalizeLegendPosition(legend.position)
    }));
}

async function restoreLegendCatalog(teams: Array<{ id: string; name: string }>, snapshot: LegendCatalogEntry[]) {
    if (snapshot.length === 0) {
        return;
    }

    const teamIdByName = new Map(teams.map((team) => [team.name, team.id]));
    const rows = snapshot
        .map((legend) => {
            const teamId = teamIdByName.get(legend.teamName);
            if (!teamId) return null;

            return {
                teamId,
                teamName: legend.teamName,
                playerName: legend.playerName,
                position: legend.position,
                age: legend.age,
                power: legend.power,
                division: legend.division,
                sourceFile: legend.sourceFile
            };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length > 0) {
        await prisma.legendPlayer.createMany({ data: rows });
    }
}

function createRandomSeedPlayer(usedNames: Set<string>, naturalPosition: string, isSuperstar = false): SeedPlayerRecord {
    const generatorPosition = getGeneratorPosition(naturalPosition);
    const superstar = isSuperstar ? generateSuperstarAttributes(generatorPosition, normalizeLegendPosition(naturalPosition)) : null;
    const stats = superstar?.attrs || generateAttributes(generatorPosition);
    const exp = superstar?.exp || 0;
    const power = calculatePlayerSeedPower(stats, naturalPosition, exp);
    const age = isSuperstar ? randomInt(26, 33) : randomInt(18, 35);

    return {
        name: buildUniqueName(usedNames),
        age,
        naturalPosition: normalizeLegendPosition(naturalPosition),
        retirementAge: isSuperstar ? randomInt(Math.max(age + 3, 35), 40) : randomInt(31, 38),
        tacticalPosition: null,
        morale: 100,
        condition: 100,
        isRetired: false,
        popularity: isSuperstar ? randomInt(10, 30) : randomInt(0, 10),
        exp,
        birthDate: new Date(2026 - age, randomInt(0, 11), randomInt(1, 28)),
        power,
        ...stats
    };
}

function createLegendSeedPlayer(legend: LegendCatalogEntry): SeedPlayerRecord {
    const build = buildLegendPlayerAttributes(legend.position, legend.power);
    const age = Math.max(18, legend.age);
    const popularityFloor = Math.max(25, Math.min(90, Math.round(legend.power * 0.7)));

    return {
        name: legend.playerName,
        age,
        naturalPosition: normalizeLegendPosition(legend.position),
        retirementAge: randomInt(Math.max(age + 8, 34), 40),
        tacticalPosition: null,
        morale: 100,
        condition: 100,
        isRetired: false,
        popularity: randomInt(popularityFloor, Math.min(99, popularityFloor + 8)),
        exp: build.exp,
        birthDate: new Date(2026 - age, randomInt(0, 11), randomInt(1, 28)),
        power: build.power,
        ...build.attrs
    };
}

function buildNormalModeSquad(usedNames: Set<string>) {
    const superstarIndex = randomInt(0, SQUAD_TEMPLATE.length - 1);
    const players = SQUAD_TEMPLATE.map((slot, index) =>
        createRandomSeedPlayer(usedNames, slot.nat, index === superstarIndex)
    );

    assignStartingTacticalPositions(players);
    return players;
}

function buildLegendModeSquad(usedNames: Set<string>, teamLegends: LegendCatalogEntry[]) {
    const legends = [...teamLegends]
        .sort((left, right) => right.power - left.power)
        .slice(0, SQUAD_TEMPLATE.length)
        .map((legend) => createLegendSeedPlayer(legend));

    const remainingSlots = [...SQUAD_TEMPLATE];
    for (const legend of legends) {
        const slotIndex = getCandidateSlotIndex(remainingSlots, legend.naturalPosition);
        if (slotIndex >= 0) {
            remainingSlots.splice(slotIndex, 1);
        }
    }

    const fillersNeeded = Math.max(0, SQUAD_TEMPLATE.length - legends.length);
    const fillers = Array.from({ length: fillersNeeded }, (_, index) => {
        const slot = remainingSlots[index] || SQUAD_TEMPLATE[index % SQUAD_TEMPLATE.length];
        return createRandomSeedPlayer(usedNames, slot.nat);
    });

    const squad = [...legends, ...fillers];
    assignStartingTacticalPositions(squad);
    return squad;
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
        base.tackling = randomInt(11, 20);
        base.heading = randomInt(11, 18);
        base.strength = randomInt(7, 18);
        base.positioning = randomInt(14, 18);
        base.teamwork = randomInt(7, 18);
        base.balance = randomInt(13, 18);
    }

    if (position === 'MC') {
        base.passing = randomInt(15, 20);
        base.vision = randomInt(14, 20);
        base.teamwork = randomInt(5, 19);
        base.dribbling = randomInt(5, 15);
        base.stamina = randomInt(12, 17);
        base.bravery = randomInt(5, 17);
        base.tackling = randomInt(5, 15);
    }

    if (position === 'FW') {
        base.shooting = randomInt(13, 20);
        base.pace = randomInt(11, 18);
        base.acceleration = randomInt(11, 19);
        base.composure = randomInt(11, 19);
        base.agility = randomInt(13, 18);
        base.positioning = randomInt(5, 18);
        base.balance = randomInt(7, 17);
    }

    const isWinger = position === 'MR' || position === 'ML';
    const isFullBack = position === 'DR' || position === 'DL';

    if (isWinger) {
        base.dribbling = randomInt(11, 20);
        base.crossing = randomInt(11, 20);
        base.pace = randomInt(11, 20);
        base.acceleration = randomInt(11, 20);
        base.agility = randomInt(11, 19);
    }

    if (isFullBack) {
        base.crossing = randomInt(11, 18);
        base.tackling = randomInt(11, 18);
        base.pace = randomInt(11, 19);
        base.stamina = randomInt(7, 20);
        base.throw = randomInt(15, 20);
    }

    return base;
}

function generateSuperstarAttributes(position: string, naturalPosition: string): { attrs: PlayerAttributeSet; exp: number } {
    let bestAttrs = generateAttributes(position);
    let bestExp = 0;
    let bestPower = calculatePlayerSeedPower(bestAttrs, naturalPosition, bestExp);

    for (let i = 0; i < 50; i++) {
        const exp = randomInt(50, 110);
        const candidate = generateAttributes(position);

        // // Global boost for elite baseline
        // (Object.keys(candidate) as Array<keyof PlayerAttributeSet>).forEach((k) => {
        //     if (k === 'handling' && position !== 'GK') return;
        //     candidate[k] = clampStat(candidate[k] + randomInt(2, 5));
        // });

        // Position-specific elite profile
        if (position === 'GK') {
            candidate.handling = randomInt(18, 20);
            candidate.positioning = randomInt(16, 20);
            candidate.composure = randomInt(16, 20);
            candidate.bravery = randomInt(16, 20);
            candidate.agility = randomInt(16, 20);
            candidate.stamina = randomInt(14, 20);
        } else if (position === 'DC') {
            candidate.tackling = randomInt(17, 20);
            candidate.heading = randomInt(17, 20);
            candidate.strength = randomInt(16, 20);
            candidate.positioning = randomInt(16, 20);
            candidate.composure = randomInt(15, 20);
            candidate.stamina = randomInt(15, 20);
            candidate.balance = randomInt(15, 20);
            candidate.strength = randomInt(16, 20);
        } else if (position === 'MC') {
            candidate.passing = randomInt(17, 20);
            candidate.vision = randomInt(17, 20);
            candidate.teamwork = randomInt(16, 20);
            candidate.composure = randomInt(16, 20);
            candidate.stamina = randomInt(16, 20);
            candidate.dribbling = randomInt(14, 20);
            candidate.teamwork = randomInt(16, 20);
            candidate.bravery = randomInt(14, 20);
            candidate.tackling = randomInt(14, 20);
        } else if (position === 'FW') {
            candidate.shooting = randomInt(18, 20);
            candidate.composure = randomInt(17, 20);
            candidate.positioning = randomInt(14, 20);
            candidate.acceleration = randomInt(14, 20);
            candidate.pace = randomInt(14, 20);
            candidate.agility = randomInt(14, 20);
            candidate.stamina = randomInt(14, 20);
            candidate.heading = randomInt(14, 20);
            candidate.balance = randomInt(14, 20);
            candidate.strength = randomInt(14, 20);
        } else if (position === 'DR' || position === 'DL') {
 candidate.pace = randomInt(16, 20);
            candidate.acceleration = randomInt(16, 20);
            candidate.crossing = randomInt(16, 20);
            candidate.stamina = randomInt(16, 20);
            candidate.agility = randomInt(16, 20);
            candidate.strength = randomInt(16, 20);
            candidate.throw = randomInt(16, 20);
            candidate.balance = randomInt(16, 20);
            candidate.positioning = randomInt(14, 20);
            candidate.tackling = randomInt(14, 20);
        } else {
            // MR/ML
            candidate.pace = randomInt(16, 20);
            candidate.acceleration = randomInt(16, 20);
            candidate.dribbling = randomInt(16, 20);
            candidate.crossing = randomInt(16, 20);
            candidate.stamina = randomInt(16, 20);
            candidate.agility = randomInt(16, 20);
            candidate.strength = randomInt(16, 20);
            candidate.vision = randomInt(16, 20);
            candidate.passing = randomInt(16, 20);
        }

        const power = calculatePlayerSeedPower(candidate, naturalPosition, exp);
        if (power > bestPower) {
            bestAttrs = candidate;
            bestExp = exp;
            bestPower = power;
        }
        if (power >= 80) {
            return { attrs: candidate, exp };
        }
    }

    return { attrs: bestAttrs, exp: bestExp };
}

export async function initializeNewGame(userTeamName: string, mode: NewGameMode = 'normal') {
    const legendCatalogSnapshot = await snapshotLegendCatalog();

    if (mode === 'legend' && legendCatalogSnapshot.length === 0) {
        throw new Error('Legend mode requires imported legend players in the database');
    }

    // Match-level and action-level state
    await prisma.playerActionLog.deleteMany();
    await prisma.playerMatchStats.deleteMany();
    await prisma.matchEvent.deleteMany();

    // Market / news state
    await prisma.transferHistory.deleteMany();
    await prisma.bid.deleteMany();
    await prisma.news.deleteMany();

    // Finance / reputation state
    await prisma.financialEvent.deleteMany();
    await prisma.clubFinance.deleteMany();
    await prisma.teamReputation.deleteMany();
    await prisma.playerReputation.deleteMany();
    await prisma.teamTactics.deleteMany();

    // Training state
    await prisma.trainingWeeklyLedger.deleteMany();
    await prisma.trainingAssignment.deleteMany();
    await prisma.playerTrainingFraction.deleteMany();

    // Fixtures and matches
    await prisma.match.deleteMany();

    // Cup / Swiss tournament state (must be cleared so a new game starts from round 1)
    await prisma.swissMatchHistory.deleteMany();
    await prisma.swissStanding.deleteMany();
    if ((prisma as any).cupTournament) {
        await (prisma as any).cupTournament.deleteMany();
    }

    // Core entities
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
    const createdTeams: Array<{ id: string; name: string; leagueId: string }> = [];

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

            createdTeams.push({ id: team.id, name: team.name, leagueId: league.id });
        }
    }

    await restoreLegendCatalog(
        createdTeams.map((team) => ({ id: team.id, name: team.name })),
        legendCatalogSnapshot
    );

    const legendCatalogByTeam = legendCatalogSnapshot.reduce((map, legend) => {
        const current = map.get(legend.teamName) || [];
        current.push(legend);
        map.set(legend.teamName, current);
        return map;
    }, new Map<string, LegendCatalogEntry[]>());

    for (const team of createdTeams) {
        const playersData = mode === 'legend'
            ? buildLegendModeSquad(usedNames, legendCatalogByTeam.get(team.name) || [])
            : buildNormalModeSquad(usedNames);

        await prisma.player.createMany({
            data: playersData.map(({ power, ...player }) => ({
                teamId: team.id,
                ...player
            }))
        });
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

    await prisma.globalGameSettings.upsert({
        where: { id: 1 },
        update: {
            currentDate: new Date('2026-01-01'),
            currentSeason: 1,
            isConfigured: true,
            userTeamId: selectedUserTeam?.id || null
        },
        create: {
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
        await generateSeasonFixtures(league.id, 1, 2026);
        const teamCount = divisionTeams.length;
        matchCount += teamCount * (teamCount - 1);
    }

    // Initialize Cup tournament state for season 1 so schedule/fixtures are available immediately.
    await initializeCupTournamentForSeason(1);

    return {
        success: true,
        userTeamId: selectedUserTeam?.id || null,
        userTeamName: selectedUserTeam?.name || null,
        teams: allTeams.length,
        matches: matchCount
    };
}
