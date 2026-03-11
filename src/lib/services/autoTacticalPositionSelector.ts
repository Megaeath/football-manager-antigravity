import prisma from '@/lib/prisma';
import { calculatePlayerPower, toPlayerAttributes } from '../engine/playerPower';
import type { PlayerAttributes } from '../engine/types';

/**
 * Map player database attributes to PlayerAttributes object
 */
function mapAttributes(p: any): PlayerAttributes {
    return toPlayerAttributes({
        handling: p.handling,
        tackling: p.tackling,
        passing: p.passing,
        shooting: p.shooting,
        heading: p.heading,
        dribbling: p.dribbling,
        crossing: p.crossing,
        setPieces: p.setPieces,
        throw: p.throw || 10,
        aggression: p.aggression,
        positioning: p.positioning,
        vision: p.vision,
        bravery: p.bravery,
        leadership: p.leadership,
        teamwork: p.teamwork,
        composure: p.composure,
        pace: p.pace,
        acceleration: p.acceleration,
        stamina: p.stamina,
        strength: p.strength,
        agility: p.agility,
        balance: p.balance
    });
}

/**
 * Formations mapping for tactical position assignment
 */
const FORMATIONS: Record<string, { id: string }[]> = {
    '4-4-2': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MR' },
        { id: 'MC_R' },
        { id: 'MC_L' },
        { id: 'ML' },
        { id: 'FW_R' },
        { id: 'FW_L' }
    ],
    '4-3-3': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'DMC' },
        { id: 'MC_R' },
        { id: 'MC_L' },
        { id: 'FW_R' },
        { id: 'FW_C' },
        { id: 'FW_L' }
    ],
    '5-3-2': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_C' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MC_R' },
        { id: 'MC_C' },
        { id: 'MC_L' },
        { id: 'FW_R' },
        { id: 'FW_L' }
    ],
    '4-5-1': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MR' },
        { id: 'MC_R' },
        { id: 'MC_C' },
        { id: 'MC_L' },
        { id: 'ML' },
        { id: 'FW_C' }
    ]
};

/**
 * Auto-select best lineup for a team based on player suitability
 * Uses the same logic as match simulator but can be called for pre-season assignment
 */
function autoSelectLineup(team: any) {
    const slots = FORMATIONS[team.formation] || FORMATIONS['4-4-2'];
    const usedPlayers = new Set<string>();
    const assignments: { playerId: string; position: string }[] = [];

    for (const slot of slots) {
        const slotBase = slot.id.split('_')[0];
        
        // For GK position, prioritize actual goalkeepers
        let availablePlayers = team.players.filter((p: any) => !usedPlayers.has(p.id));
        
        if (slotBase === 'GK') {
            const goalkeepers = availablePlayers.filter((p: any) => p.naturalPosition === 'GK');
            // Only use actual GK if available, otherwise fallback to any player
            if (goalkeepers.length > 0) {
                availablePlayers = goalkeepers;
            }
        }
        
        const bestPlayer = availablePlayers
            .map((p: any) => ({
                playerId: p.id,
                position: slot.id,
                suitability: (() => {
                    const basePower = calculatePlayerPower({
                        attributes: mapAttributes(p),
                        targetPosition: slotBase,
                        naturalPosition: p.naturalPosition,
                        condition: p.condition,
                        exp: p.exp || 0
                    }).powerWithExp;

                    // DMC specific preference: choose midfield connectors over center-backs/full-backs
                    if (slotBase === 'DMC') {
                        const nat = p.naturalPosition;
                        if (nat === 'DMC') return basePower + 18;
                        if (nat === 'MC' || nat === 'AMC') return basePower + 12;
                        if (nat === 'DMR' || nat === 'DML') return basePower + 8;
                        if (nat === 'DC' || nat === 'DR' || nat === 'DL') return basePower - 15;
                    }

                    return basePower;
                })()
            }))
            .sort((a: any, b: any) => b.suitability - a.suitability)[0];

        if (bestPlayer) {
            assignments.push({ playerId: bestPlayer.playerId, position: bestPlayer.position });
            usedPlayers.add(bestPlayer.playerId);
        }
    }

    return assignments;
}

/**
 * Auto-assign tactical positions for a single team
 * Clears existing assignments and assigns new positions based on player suitability
 * 
 * @param teamId - Team ID to assign tactical positions for
 * @returns Number of players assigned tactical positions
 */
export async function autoAssignTacticalPositions(teamId: string): Promise<number> {
    try {
        // Fetch team with formation and players
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                players: {
                    where: { isRetired: false },
                    select: {
                        id: true,
                        naturalPosition: true,
                        condition: true,
                        exp: true,
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
                }
            }
        });

        if (!team || team.players.length === 0) {
            return 0;
        }

        // Get auto-selected lineup
        const assignments = autoSelectLineup({
            formation: team.formation,
            players: team.players
        });

        // Apply assignments to database
        await prisma.$transaction(async (tx) => {
            // Clear all existing tactical positions for this team
            await tx.player.updateMany({
                where: { teamId },
                data: { tacticalPosition: null }
            });

            // Assign new tactical positions
            for (const assignment of assignments) {
                await tx.player.update({
                    where: { id: assignment.playerId },
                    data: { tacticalPosition: assignment.position }
                });
            }
        });

        return assignments.length;
    } catch (error) {
        console.error(`[autoTacticalPositionSelector] Error assigning tactical positions for team ${teamId}:`, error);
        throw error;
    }
}

/**
 * Auto-assign tactical positions for all AI teams
 * Useful for season starts and pre-match preparation
 * 
 * @param excludeTeamId - Team ID to exclude (typically user's team)
 * @returns Number of teams processed
 */
export async function autoAssignTacticalPositionsForAllAITeams(excludeTeamId?: string): Promise<number> {
    try {
        const teams = await prisma.team.findMany({
            where: excludeTeamId ? { id: { not: excludeTeamId } } : {},
            select: { id: true, name: true }
        });

        let teamsProcessed = 0;

        for (const team of teams) {
            await autoAssignTacticalPositions(team.id);
            teamsProcessed++;
        }

        console.log(`[autoTacticalPositionSelector] Assigned tactical positions for ${teamsProcessed} AI teams`);
        return teamsProcessed;
    } catch (error) {
        console.error('[autoTacticalPositionSelector] Error assigning tactical positions for AI teams:', error);
        throw error;
    }
}
