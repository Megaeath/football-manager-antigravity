'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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

export async function clearTacticalPosition(teamId: string, position: string) {
    await prisma.player.updateMany({
        where: {
            teamId: teamId,
            tacticalPosition: position
        },
        data: { tacticalPosition: null }
    });

    revalidatePath('/squad');
}

export async function clearAllTacticalPositions(teamId: string) {
    await prisma.player.updateMany({
        where: { teamId },
        data: { tacticalPosition: null }
    });

    revalidatePath('/squad');
}

export async function bulkAssignTacticalPositions(
    teamId: string,
    assignments: { playerId: string; position: string }[]
) {
    await prisma.$transaction(async (tx) => {
        await tx.player.updateMany({
            where: { teamId },
            data: { tacticalPosition: null }
        });

        for (const assignment of assignments) {
            await tx.player.update({
                where: { id: assignment.playerId },
                data: { tacticalPosition: assignment.position }
            });
        }
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
