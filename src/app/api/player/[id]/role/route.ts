import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ROLE_DEFINITIONS } from '@/lib/engine/playerRoles';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const body = await request.json();
    const { playerRole, attackingRolePreset, defensiveRolePreset } = body;

    const requestedAttackingRole = attackingRolePreset !== undefined
      ? attackingRolePreset
      : (playerRole !== undefined ? playerRole : undefined);

    const requestedDefensiveRole = defensiveRolePreset !== undefined
      ? defensiveRolePreset
      : (playerRole !== undefined ? playerRole : undefined);

    const requestedRoles = [requestedAttackingRole, requestedDefensiveRole].filter(r => r !== undefined);

    // Validate role name
    for (const roleName of requestedRoles) {
      if (roleName && !ROLE_DEFINITIONS[roleName]) {
        return Response.json(
          { error: `Invalid player role: ${roleName}` },
          { status: 400 }
        );
      }
    }

    // Fetch player to validate position compatibility
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { naturalPosition: true }
    });

    if (!player) {
      return Response.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Validate role is compatible with player position
    for (const roleName of requestedRoles) {
      if (!roleName) continue;
      const role = ROLE_DEFINITIONS[roleName];
      const basePosition = player.naturalPosition.split('_')[0]; // Extract base position
      
      const isCompatible = role.positions.some(pos => 
        pos === basePosition || 
        pos === player.naturalPosition ||
        (basePosition === 'FW' && pos.startsWith('FW'))
      );

      if (!isCompatible) {
        return Response.json(
          { 
            error: 'Role not compatible with player position',
            playerPosition: player.naturalPosition,
            role: roleName,
            rolePositions: role.positions
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, string | null> = {};

    if (requestedAttackingRole !== undefined) {
      data.attackingRolePreset = requestedAttackingRole || null;
    }
    if (requestedDefensiveRole !== undefined) {
      data.defensiveRolePreset = requestedDefensiveRole || null;
    }

    // Keep legacy field for compatibility.
    // Priority: explicit playerRole, otherwise mirror attacking preset when provided.
    if (playerRole !== undefined) {
      data.playerRole = playerRole || null;
    } else if (requestedAttackingRole !== undefined) {
      data.playerRole = requestedAttackingRole || null;
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: 'No role fields provided' },
        { status: 400 }
      );
    }

    // Update player role
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data
    });

    return Response.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        playerRole: updatedPlayer.playerRole,
        attackingRolePreset: (updatedPlayer as any).attackingRolePreset,
        defensiveRolePreset: (updatedPlayer as any).defensiveRolePreset
      }
    });
  } catch (error: any) {
    console.error('[PATCH /api/player/[id]/role] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to update player role' },
      { status: 500 }
    );
  }
}
