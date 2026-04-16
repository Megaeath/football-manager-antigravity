import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

type TeamPlayerForNumbering = {
    id: string;
    name: string;
    teamId: string | null;
    tacticalPosition: string | null;
    naturalPosition: string;
    condition: number;
    jerseyNumber: number | null;
    isRetired: boolean;
    passing: number;
    shooting: number;
    tackling: number;
    positioning: number;
    pace: number;
    stamina: number;
};

const STARTING_SLOTS = ['GK', 'DR', 'DL', 'DC_L', 'DC_R', 'MR', 'ML', 'MC_L', 'MC_R', 'FW_L', 'FW_R'] as const;

function estimatePower(player: TeamPlayerForNumbering): number {
    return (
        player.passing +
        player.shooting +
        player.tackling +
        player.positioning +
        player.pace +
        player.stamina
    ) / 6;
}

function pickStartingPlayers(players: TeamPlayerForNumbering[]): TeamPlayerForNumbering[] {
    const selected = new Set<string>();
    const starters: TeamPlayerForNumbering[] = [];

    // 1) Keep tactical slot order first if available
    for (const slot of STARTING_SLOTS) {
        const candidate = players.find((p) => p.tacticalPosition === slot && !selected.has(p.id));
        if (!candidate) continue;
        starters.push(candidate);
        selected.add(candidate.id);
    }

    // 2) Fill up to 11 with best available
    const remaining = players
        .filter((p) => !selected.has(p.id))
        .sort((a, b) => {
            if (b.condition !== a.condition) return b.condition - a.condition;
            return estimatePower(b) - estimatePower(a);
        });

    while (starters.length < 11 && remaining.length > 0) {
        const p = remaining.shift();
        if (!p) break;
        starters.push(p);
        selected.add(p.id);
    }

    return starters;
}

/**
 * Initial squad numbering:
 * - starting XI get 1..11
 * - remaining players get 12..
 */
export async function assignInitialJerseyNumbersForTeam(teamId: string, db: DbClient = prisma) {
    const players = await db.player.findMany({
        where: {
            teamId,
            isRetired: false,
        },
        select: {
            id: true,
            name: true,
            teamId: true,
            tacticalPosition: true,
            naturalPosition: true,
            condition: true,
            jerseyNumber: true,
            isRetired: true,
            passing: true,
            shooting: true,
            tackling: true,
            positioning: true,
            pace: true,
            stamina: true,
        },
    });

    if (players.length === 0) return;

    const starters = pickStartingPlayers(players);
    const starterIds = new Set(starters.map((p) => p.id));

    const bench = players
        .filter((p) => !starterIds.has(p.id))
        .sort((a, b) => {
            const aHas = a.jerseyNumber != null ? 0 : 1;
            const bHas = b.jerseyNumber != null ? 0 : 1;
            if (aHas !== bHas) return aHas - bHas;
            if ((a.jerseyNumber ?? 999) !== (b.jerseyNumber ?? 999)) return (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999);
            return a.name.localeCompare(b.name);
        });

    // Build target map first
    const targetMap = new Map<string, number>();
    starters.forEach((player, index) => {
        targetMap.set(player.id, index + 1);
    });
    bench.forEach((player, index) => {
        targetMap.set(player.id, 12 + index);
    });

    // Check if any changes needed
    const needsUpdate = [...targetMap.entries()].some(([id, target]) => {
        const player = players.find((p) => p.id === id);
        return player?.jerseyNumber !== target;
    });

    if (!needsUpdate) return;

    // Step 1: Clear all jersey numbers for the team to avoid unique constraint conflicts
    await db.player.updateMany({
        where: { teamId },
        data: { jerseyNumber: null },
    });

    // Step 2: Assign new numbers sequentially (safe since all are cleared)
    for (const [playerId, target] of targetMap.entries()) {
        await db.player.update({
            where: { id: playerId },
            data: { jerseyNumber: target },
        });
    }
}

/**
 * Assign number to incoming player:
 * - use lowest available number first (reuse vacated number)
 * - if none free, use next new number
 */
export async function assignIncomingPlayerJerseyNumber(
    playerId: string,
    teamId: string,
    db: DbClient = prisma
) {
    const used = await db.player.findMany({
        where: {
            teamId,
            isRetired: false,
            id: { not: playerId },
            jerseyNumber: { not: null },
        },
        select: { jerseyNumber: true },
    });

    const usedSet = new Set<number>(used.map((p) => p.jerseyNumber as number));

    let candidate = 1;
    while (usedSet.has(candidate)) {
        candidate += 1;
    }

    await db.player.update({
        where: { id: playerId },
        data: {
            teamId,
            jerseyNumber: candidate,
        },
    });

    return candidate;
}
