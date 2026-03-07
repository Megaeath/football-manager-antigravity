import prisma from '@/lib/prisma';
import { getEligibleRoles, calculateRoleSuitability, getSuggestedRolePresets } from '@/lib/engine/playerRoles';

/**
 * Auto-assign player roles for AI teams based on suitability
 * 
 * Logic:
 * 1. Get all players in team
 * 2. For each player, find eligible roles based on natural position
 * 3. Calculate suitability (1-5 stars) for each eligible role
 * 4. Assign role with highest suitability
 * 5. If multiple roles have same suitability, pick one randomly
 * 
 * @param teamId - Team ID to assign roles for
 * @returns Number of players assigned roles
 */
export async function autoAssignPlayerRoles(teamId: string): Promise<number> {
  try {
    // Fetch all players in team
    const players = await prisma.player.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        naturalPosition: true,
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

    if (players.length === 0) {
      return 0;
    }

    let assignedCount = 0;

    for (const player of players) {
      // Get eligible roles for this player's position
      const eligibleRoles = getEligibleRoles(player.naturalPosition);

      if (eligibleRoles.length === 0) {
        // No roles available for this position (e.g., GK)
        continue;
      }

      // Calculate suitability for each eligible role
      const roleSuitability: Array<{ roleName: string; stars: number }> = [];

      for (const role of eligibleRoles) {
        const stars = calculateRoleSuitability(player as any, role.name);
        roleSuitability.push({ roleName: role.name, stars });
      }

      // Find highest suitability (legacy single role)
      const maxStars = Math.max(...roleSuitability.map(r => r.stars));
      const bestRoles = roleSuitability.filter(r => r.stars === maxStars);

      // Pick one randomly if multiple have same suitability
      const selectedRole = bestRoles[Math.floor(Math.random() * bestRoles.length)];
      const suggested = getSuggestedRolePresets(player.naturalPosition);

      // Assign role to player
      await prisma.player.update({
        where: { id: player.id },
        data: {
          playerRole: selectedRole.roleName,
          attackingRolePreset: suggested.attackingRolePreset || selectedRole.roleName,
          defensiveRolePreset: suggested.defensiveRolePreset || selectedRole.roleName
        } as any
      });

      assignedCount++;
    }

    return assignedCount;
  } catch (error) {
    console.error(`[aiRoleSelector] Error assigning roles for team ${teamId}:`, error);
    throw error;
  }
}

/**
 * Auto-assign roles for all AI teams in the league
 * 
 * @param excludeTeamId - Team ID to exclude (typically user's team)
 * @returns Number of teams processed
 */
export async function autoAssignRolesForAllAITeams(excludeTeamId?: string): Promise<number> {
  try {
    const teams = await prisma.team.findMany({
      where: excludeTeamId ? { id: { not: excludeTeamId } } : {},
      select: { id: true, name: true }
    });

    let teamsProcessed = 0;

    for (const team of teams) {
      await autoAssignPlayerRoles(team.id);
      teamsProcessed++;
    }

    console.log(`[aiRoleSelector] Assigned roles for ${teamsProcessed} AI teams`);
    return teamsProcessed;
  } catch (error) {
    console.error('[aiRoleSelector] Error assigning roles for AI teams:', error);
    throw error;
  }
}

/**
 * Re-assign player role after transfer
 * 
 * @param playerId - Player ID who was transferred
 * @returns Assigned role name or null
 */
export async function reassignRoleAfterTransfer(playerId: string): Promise<string | null> {
  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        name: true,
        naturalPosition: true,
        teamId: true,
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
      console.warn(`[aiRoleSelector] Player ${playerId} not found`);
      return null;
    }

    const eligibleRoles = getEligibleRoles(player.naturalPosition);

    if (eligibleRoles.length === 0) {
      return null;
    }

    // Calculate suitability for each eligible role
    const roleSuitability: Array<{ roleName: string; stars: number }> = [];

    for (const role of eligibleRoles) {
      const stars = calculateRoleSuitability(player as any, role.name);
      roleSuitability.push({ roleName: role.name, stars });
    }

    // Find highest suitability
    const maxStars = Math.max(...roleSuitability.map(r => r.stars));
    const bestRoles = roleSuitability.filter(r => r.stars === maxStars);

    // Pick one randomly if multiple have same suitability
    const selectedRole = bestRoles[Math.floor(Math.random() * bestRoles.length)];
    const suggested = getSuggestedRolePresets(player.naturalPosition);

    // Assign role to player
    await prisma.player.update({
      where: { id: player.id },
      data: {
        playerRole: selectedRole.roleName,
        attackingRolePreset: suggested.attackingRolePreset || selectedRole.roleName,
        defensiveRolePreset: suggested.defensiveRolePreset || selectedRole.roleName
      } as any
    });

    console.log(`[aiRoleSelector] Assigned role ${selectedRole.roleName} to ${player.name}`);
    return selectedRole.roleName;
  } catch (error) {
    console.error(`[aiRoleSelector] Error reassigning role for player ${playerId}:`, error);
    throw error;
  }
}
