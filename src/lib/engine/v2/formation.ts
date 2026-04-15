/**
 * Match Engine V2 - Formation Position Mapper
 * 
 * Converts tactical positions to 2D field coordinates based on formation
 */

import type { SpatialPosition } from './types2d';
import type { TeamState } from '../types';
import { FORMATION_POSITIONS, MENTALITY_POSITION_MODIFIERS } from './config';

// ============================================================
// POSITION MAPPING
// ============================================================

/**
 * Maps a tactical position to 2D coordinates for a given formation
 * 
 * @param tacticalPosition - Position code (e.g., "DC_L", "FW_R", "MC")
 * @param formation - Formation string (e.g., "4-4-2", "4-3-3")
 * @param isHomeTeam - Whether this is the home team (affects X-axis orientation)
 * @returns 2D position on the field
 */
export function mapTacticalPositionTo2D(
    tacticalPosition: string | null,
    formation: string,
    isHomeTeam: boolean = true
): SpatialPosition {
    // Default to center if no tactical position
    if (!tacticalPosition) {
        return { x: 50, y: 50 };
    }
    
    // Get formation template
    const formationMap = FORMATION_POSITIONS[formation];
    if (!formationMap) {
        console.warn(`Unknown formation: ${formation}, defaulting to 4-4-2`);
        return mapTacticalPositionTo2D(tacticalPosition, '4-4-2', isHomeTeam);
    }
    
    // Normalize tactical position (remove underscores, handle variations)
    const normalizedPosition = normalizeTacticalPosition(tacticalPosition);
    
    // Find position in formation
    let basePosition = formationMap[normalizedPosition];
    
    // Fallback: try without suffix
    if (!basePosition) {
        const baseRole = normalizedPosition.replace(/_[LRC]$/, '');
        basePosition = formationMap[baseRole];
    }
    
    // Final fallback
    if (!basePosition) {
        console.warn(`Position ${tacticalPosition} not found in ${formation}, using center`);
        basePosition = { x: 50, y: 50 };
    }
    
    // Mirror position for away team
    if (!isHomeTeam) {
        return {
            x: 100 - basePosition.x,  // Mirror X-axis
            y: basePosition.y,
        };
    }
    
    return { ...basePosition };
}

/**
 * Normalizes tactical position strings to match formation keys
 */
function normalizeTacticalPosition(position: string): string {
    // Remove "FW_" prefix variations and standardize
    const normalized = position
        .replace(/^MC_C$/, 'MC')    // "MC_C" -> "MC"
        .replace(/^DC_C$/, 'DC')    // "DC_C" -> "DC"
        .replace(/^AM_C$/, 'AMC')   // "AM_C" -> "AMC"
        .replace(/^FW_/, 'FW')   // "FW_L" → "FWL"
        .replace(/^DC_/, 'DC')   // "DC_R" → "DCR"
        .replace(/^MC_/, 'MC')   // "MC_L" → "MCL"
        .replace(/^DM_/, 'DM')   // "DM_C" → "DMC"
        .replace(/^AM_/, 'AM')   // "AM_R" → "AMR"
        .replace(/_/g, '');      // Remove remaining underscores
    
    return normalized;
}

// ============================================================
// TEAM INITIALIZATION
// ============================================================

/**
 * Assigns starting positions to all players based on formation
 * 
 * @param team - Team state with players
 * @param formation - Formation string
 * @param isHomeTeam - Whether this is the home team
 * @returns Map of player ID → starting position
 */
export function assignFormationPositions(
    team: TeamState,
    formation: string,
    isHomeTeam: boolean = true
): Map<string, SpatialPosition> {
    const positions = new Map<string, SpatialPosition>();
    
    team.players.forEach(player => {
        const position = mapTacticalPositionTo2D(
            player.tacticalPosition,
            formation,
            isHomeTeam
        );
        positions.set(player.id, position);
    });
    
    return positions;
}

// ============================================================
// TACTICAL ADJUSTMENTS
// ============================================================

/**
 * Adjusts formation positions based on team mentality
 * 
 * @param basePositions - Base formation positions
 * @param mentality - Team mentality (e.g., "ATTACKING", "DEFENSIVE")
 * @param isHomeTeam - Whether this is the home team
 * @returns Adjusted positions
 */
export function applyMentalityAdjustment(
    basePositions: Map<string, SpatialPosition>,
    mentality: string,
    isHomeTeam: boolean = true
): Map<string, SpatialPosition> {
    const modifiers = MENTALITY_POSITION_MODIFIERS[mentality as keyof typeof MENTALITY_POSITION_MODIFIERS];
    if (!modifiers) return basePositions;
    
    const { xShift, compactness } = modifiers;
    const adjustedPositions = new Map<string, SpatialPosition>();
    
    // Calculate team center point
    const positions = Array.from(basePositions.values());
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    
    basePositions.forEach((pos, playerId) => {
        // Apply X-axis shift (attacking/defensive)
        const newX = isHomeTeam 
            ? Math.min(92, Math.max(4, pos.x + xShift))
            : Math.min(96, Math.max(8, pos.x - xShift));
        
        // Apply compactness (pull toward center or spread)
        const deltaY = pos.y - centerY;
        const newY = centerY + (deltaY * compactness);
        
        adjustedPositions.set(playerId, {
            x: newX,
            y: Math.min(92, Math.max(8, newY)),
        });
    });
    
    return adjustedPositions;
}

// ============================================================
// POSITION UTILITIES
// ============================================================

/**
 * Gets the formation role for a player (GK, DEFENDER, MIDFIELDER, FORWARD)
 */
export function getFormationRole(tacticalPosition: string | null): string {
    if (!tacticalPosition) return 'MIDFIELDER';
    
    const pos = tacticalPosition.toUpperCase();
    
    if (pos.startsWith('GK')) return 'GOALKEEPER';
    if (pos.startsWith('D')) return 'DEFENDER';
    if (pos.startsWith('M')) return 'MIDFIELDER';
    if (pos.startsWith('F') || pos.startsWith('A')) return 'FORWARD';
    
    return 'MIDFIELDER';
}

/**
 * Checks if a tactical position is a wing position
 */
export function isWingPosition(tacticalPosition: string | null): boolean {
    if (!tacticalPosition) return false;
    
    const pos = tacticalPosition.toUpperCase();
    return pos.endsWith('L') || pos.endsWith('R') || pos.includes('W');
}

/**
 * Checks if a tactical position is a central position
 */
export function isCentralPosition(tacticalPosition: string | null): boolean {
    if (!tacticalPosition) return true;
    
    const pos = tacticalPosition.toUpperCase();
    return pos.endsWith('C') || pos === 'GK' || (!pos.endsWith('L') && !pos.endsWith('R'));
}

/**
 * Gets the preferred Y-position for a role (left/center/right)
 */
export function getPreferredYPosition(tacticalPosition: string | null): number {
    if (!tacticalPosition) return 50;
    
    const pos = tacticalPosition.toUpperCase();
    
    if (pos.endsWith('L')) return 25;  // Left side
    if (pos.endsWith('R')) return 75;  // Right side
    return 50;  // Center
}

/**
 * Calculates Euclidean distance between two positions
 */
export function getDistance(pos1: SpatialPosition, pos2: SpatialPosition): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds nearest position to a target position from a list
 */
export function findNearestPosition(
    target: SpatialPosition,
    candidates: SpatialPosition[]
): SpatialPosition | null {
    if (candidates.length === 0) return null;
    
    let nearest = candidates[0];
    let minDistance = getDistance(target, nearest);
    
    for (let i = 1; i < candidates.length; i++) {
        const distance = getDistance(target, candidates[i]);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = candidates[i];
        }
    }
    
    return nearest;
}

/**
 * Clamps a position to stay within field bounds
 */
export function clampToField(position: SpatialPosition): SpatialPosition {
    return {
        x: Math.min(100, Math.max(0, position.x)),
        y: Math.min(100, Math.max(0, position.y)),
    };
}

/**
 * Interpolates between two positions
 */
export function interpolatePosition(
    start: SpatialPosition,
    end: SpatialPosition,
    t: number  // 0-1
): SpatialPosition {
    return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
    };
}
