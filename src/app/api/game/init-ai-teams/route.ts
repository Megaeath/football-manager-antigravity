import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';

/**
 * Initializes AI team assignments (roles and tactical positions)
 * Called on game startup to ensure all AI teams have proper assignments
 * Only assigns if teams are missing assignments
 */
export async function POST() {
    try {
        const settings = await getGameTime();
        if (!settings) {
            return NextResponse.json({ error: 'Game not initialized' }, { status: 400 });
        }

        const userTeamId = settings.userTeamId;

        // Check if any AI teams are missing player roles
        const teamsWithoutRoles = await prisma.team.findMany({
            where: {
                id: { not: userTeamId || undefined },
                players: {
                    none: {
                        playerRole: { not: null }
                    }
                }
            },
            select: { id: true, name: true }
        });

        if (teamsWithoutRoles.length > 0) {
            console.log(`[InitializeAITeams] Found ${teamsWithoutRoles.length} teams without role assignments. Assigning now...`);
            
            try {
                const { autoAssignRolesForAllAITeams } = await import('@/lib/services/aiRoleSelector');
                await autoAssignRolesForAllAITeams(userTeamId || undefined);
                console.log('[InitializeAITeams] Player roles assigned successfully');
            } catch (error) {
                console.error('[InitializeAITeams] Failed to assign player roles:', error);
            }
        }

        // Check if any AI teams are missing tactical positions
        const teamsWithoutTacticalPositions = await prisma.team.findMany({
            where: {
                id: { not: userTeamId || undefined },
                players: {
                    none: {
                        tacticalPosition: { not: null }
                    }
                }
            },
            select: { id: true, name: true }
        });

        if (teamsWithoutTacticalPositions.length > 0) {
            console.log(`[InitializeAITeams] Found ${teamsWithoutTacticalPositions.length} teams without tactical position assignments. Assigning now...`);
            
            try {
                const { autoAssignTacticalPositionsForAllAITeams } = await import('@/lib/services/autoTacticalPositionSelector');
                await autoAssignTacticalPositionsForAllAITeams(userTeamId || undefined);
                console.log('[InitializeAITeams] Tactical positions assigned successfully');
            } catch (error) {
                console.error('[InitializeAITeams] Failed to assign tactical positions:', error);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'AI team initialization complete',
            rolesAssigned: teamsWithoutRoles.length,
            tacPositionsAssigned: teamsWithoutTacticalPositions.length
        });
    } catch (error) {
        console.error('[InitializeAITeams] Error:', error);
        return NextResponse.json(
            { error: 'Failed to initialize AI teams', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
