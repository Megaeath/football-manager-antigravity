'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function updateTacticalPosition(playerId: string, teamId: string, position: string) {
    // 1. If another player in the same team has this position, clear it
    await prisma.player.updateMany({
        where: {
            teamId: teamId,
            tacticalPosition: position,
            id: { not: playerId }
        },
        data: { tacticalPosition: null }
    });

    // 2. Assign position to the player
    await prisma.player.update({
        where: { id: playerId },
        data: { tacticalPosition: position }
    });

    revalidatePath('/squad');
}

export async function updateTeamTactics(teamId: string, tactics: { formation?: string, mentality?: string, passing?: string, tackling?: string }) {
    await prisma.team.update({
        where: { id: teamId },
        data: tactics
    });

    revalidatePath('/squad');
}
