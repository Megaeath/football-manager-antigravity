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
    const { playerRole } = body;

    // Validate role name
    if (playerRole && !ROLE_DEFINITIONS[playerRole]) {
      return Response.json(
        { error: 'Invalid player role' },
        { status: 400 }
      );
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
    if (playerRole) {
      const role = ROLE_DEFINITIONS[playerRole];
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
            rolePositions: role.positions
          },
          { status: 400 }
        );
      }
    }

    // Update player role
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { playerRole: playerRole || null }
    });

    return Response.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        playerRole: updatedPlayer.playerRole
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
