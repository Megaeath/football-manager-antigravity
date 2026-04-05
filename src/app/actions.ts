'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { initializeNewGame, type NewGameMode } from '@/lib/services/newGameInitializer';
import { AI_PLAYSTYLE_PROFILE_MAP } from '@/lib/services/aiPlaystyleProfiles';

async function assertPlayerAvailableForSelection(playerId: string, teamId: string) {
    const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
            id: true,
            teamId: true,
            isRetired: true,
            suspensionMatchesRemaining: true,
            injuryWeeksRemaining: true
        }
    });

    if (!player || player.teamId !== teamId || player.isRetired) {
        throw new Error('Player not eligible for tactical assignment');
    }

    if ((player.suspensionMatchesRemaining || 0) > 0) {
        throw new Error('Player is suspended and cannot be selected');
    }

    if ((player.injuryWeeksRemaining || 0) > 0) {
        throw new Error('Player is injured and cannot be selected');
    }
}

export async function updateTacticalPosition(playerId: string, teamId: string, position: string) {
    await assertPlayerAvailableForSelection(playerId, teamId);

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
    for (const assignment of assignments) {
        await assertPlayerAvailableForSelection(assignment.playerId, teamId);
    }

    await prisma.$transaction(async (tx) => {
        await tx.player.updateMany({
            where: {
                teamId,
                OR: [
                    { suspensionMatchesRemaining: { gt: 0 } },
                    { injuryWeeksRemaining: { gt: 0 } }
                ]
            } as any,
            data: { tacticalPosition: null }
        });

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

export async function updateTeamTactics(teamId: string, tactics: { formation?: string, mentality?: string, passing?: string, tackling?: string, attacking_focus?: string, creative_freedom?: string }) {
    await prisma.team.update({
        where: { id: teamId },
        data: tactics
    });

    revalidatePath('/squad');
}

export async function resetGameWithSelectedTeam(teamName: string, mode: NewGameMode = 'normal') {
    if (!teamName) {
        throw new Error('Team is required');
    }

    const result = await initializeNewGame(teamName, mode);

    revalidatePath('/', 'layout');
    revalidatePath('/');
    revalidatePath('/squad');
    revalidatePath('/fixtures');
    revalidatePath('/league');
    revalidatePath('/market');
    revalidatePath('/news');

    return result;
}

export async function updateYellowSuspensionThreshold(threshold: number) {
    const normalized = Math.max(1, Math.min(10, Math.round(threshold || 4)));
    await (prisma.globalGameSettings as any).upsert({
        where: { id: 1 },
        update: { yellowSuspensionThreshold: normalized },
        create: {
            id: 1,
            currentDate: new Date('2026-01-01T00:00:00.000Z'),
            currentSeason: 1,
            isConfigured: false,
            yellowSuspensionThreshold: normalized
        }
    });

    revalidatePath('/settings');
    revalidatePath('/squad');
}

export async function updateTeamPlaystyleProfile(teamId: string, profileId: string) {
    if (!teamId) {
        throw new Error('Team is required');
    }

    if (!AI_PLAYSTYLE_PROFILE_MAP.has(profileId)) {
        throw new Error('Invalid AI playstyle profile');
    }

    await prisma.team.update({
        where: { id: teamId },
        data: { aiPlaystyleProfileId: profileId }
    });

    revalidatePath('/settings');
    revalidatePath('/squad');
}
