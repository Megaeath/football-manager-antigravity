import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getEligibleRoles, calculateRoleSuitability } from '@/lib/engine/playerRoles';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;

    // Fetch player with all attributes
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        name: true,
        naturalPosition: true,
        playerRole: true,
        // Technical attributes
        handling: true,
        tackling: true,
        passing: true,
        shooting: true,
        heading: true,
        dribbling: true,
        crossing: true,
        setPieces: true,
        throw: true,
        // Mental attributes
        aggression: true,
        positioning: true,
        vision: true,
        bravery: true,
        leadership: true,
        teamwork: true,
        composure: true,
        // Physical attributes
        pace: true,
        acceleration: true,
        stamina: true,
        strength: true,
        agility: true,
        balance: true
      }
    });

    if (!player) {
      return Response.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get eligible roles for player's position
    const eligibleRoles = getEligibleRoles(player.naturalPosition);

    // Calculate suitability for each role
    const roleSuitability = eligibleRoles.map(role => {
      const stars = calculateRoleSuitability(player as any, role.name);
      return {
        roleName: role.name,
        displayName: role.displayName,
        description: role.effects.description,
        suitability: stars,
        primaryAttributes: role.primaryAttributes,
        conditionDrainMultiplier: role.conditionDrainMultiplier
      };
    });

    // Sort by suitability (highest first)
    roleSuitability.sort((a, b) => b.suitability - a.suitability);

    return Response.json({
      playerId: player.id,
      playerName: player.name,
      naturalPosition: player.naturalPosition,
      playerRole: player.playerRole,
      roles: roleSuitability
    });
  } catch (error: any) {
    console.error('[GET /api/player/[id]/role-suitability] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to get role suitability' },
      { status: 500 }
    );
  }
}
