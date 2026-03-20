import prisma from '@/lib/prisma';

export const DIVISION_LEVELS = [1, 2, 3] as const;

export const DIVISION_REWARD_MULTIPLIER: Record<number, number> = {
    1: 1,
    2: 0.7,
    3: 0.5
};

export const DIVISION_FINANCE_MULTIPLIER: Record<number, number> = {
    1: 1,
    2: 0.7,
    3: 0.5
};

export function getDivisionName(level: number) {
    return `Division ${level}`;
}

export function getDivisionRewardMultiplier(level: number) {
    return DIVISION_REWARD_MULTIPLIER[level] ?? 1;
}

export function getDivisionFinanceMultiplier(level: number) {
    return DIVISION_FINANCE_MULTIPLIER[level] ?? 1;
}

export async function ensureDivisionLeagues(season: number) {
    const existing = await prisma.league.findMany({
        where: { season },
        orderBy: { level: 'asc' }
    });

    const byLevel = new Map(existing.map((league) => [league.level, league]));

    for (const level of DIVISION_LEVELS) {
        if (!byLevel.has(level)) {
            const created = await prisma.league.create({
                data: {
                    name: getDivisionName(level),
                    level,
                    season
                }
            });
            byLevel.set(level, created);
        }
    }

    const divisionOne = byLevel.get(1);
    if (divisionOne) {
        await prisma.team.updateMany({
            where: { leagueId: null },
            data: { leagueId: divisionOne.id }
        });
    }

    return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

export async function getLeagueByDivisionLevel(level: number, season?: number) {
    return prisma.league.findFirst({
        where: {
            level,
            ...(season ? { season } : {})
        },
        orderBy: { season: 'desc' }
    });
}