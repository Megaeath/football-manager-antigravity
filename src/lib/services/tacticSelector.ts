/**
 * Auto-selects optimal tactics for AI teams based on squad composition
 * Analyzes player strengths and recommends formation and mentality
 */

import type { Player } from '@prisma/client';

interface SquadAnalysis {
    avgPace: number;
    avgPassing: number;
    avgPhysical: number;
    avgTechnical: number;
    defenders: number;
    midfielders: number;
    forwards: number;
    wingers: number;
    hasStrongPassers: boolean;
    hasSpeedsters: boolean;
    hasPhysicalPlayers: boolean;
}

function getPositionGroup(position: string): string {
    if (position.startsWith('GK')) return 'GK';
    if (position.startsWith('D')) return 'D';
    if (position.startsWith('M') || position.startsWith('A')) return 'M';
    return 'F';
}

function analyzeSquad(players: Player[]): SquadAnalysis {
    const activePlayers = players.filter(p => !p.isRetired && p.condition > 40);
    
    if (activePlayers.length === 0) {
        return {
            avgPace: 10,
            avgPassing: 10,
            avgPhysical: 10,
            avgTechnical: 10,
            defenders: 0,
            midfielders: 0,
            forwards: 0,
            wingers: 0,
            hasStrongPassers: false,
            hasSpeedsters: false,
            hasPhysicalPlayers: false
        };
    }

    const avgPace = Math.round(activePlayers.reduce((sum, p) => sum + (p.pace || 0), 0) / activePlayers.length);
    const avgPassing = Math.round(activePlayers.reduce((sum, p) => sum + (p.passing || 0), 0) / activePlayers.length);
    const avgPhysical = Math.round(activePlayers.reduce((sum, p) => sum + (p.strength || 0), 0) / activePlayers.length);
    const avgTechnical = Math.round(activePlayers.reduce((sum, p) => sum + (p.shooting || 0), 0) / activePlayers.length);

    const posGroups = activePlayers.map(p => getPositionGroup(p.naturalPosition));
    const defenders = posGroups.filter(p => p === 'D').length;
    const midfielders = posGroups.filter(p => p === 'M').length;
    const forwards = posGroups.filter(p => p === 'F').length;
    
    const wingers = activePlayers.filter(p => 
        ['MR', 'ML', 'AMR', 'AML'].includes(p.naturalPosition)
    ).length;

    const hasStrongPassers = activePlayers.some(p => p.passing && p.passing >= 14);
    const hasSpeedsters = activePlayers.some(p => p.pace && p.pace >= 14);
    const hasPhysicalPlayers = activePlayers.some(p => p.strength && p.strength >= 14);

    return {
        avgPace,
        avgPassing,
        avgPhysical,
        avgTechnical,
        defenders,
        midfielders,
        forwards,
        wingers,
        hasStrongPassers,
        hasSpeedsters,
        hasPhysicalPlayers
    };
}

function selectFormation(analysis: SquadAnalysis): string {
    const { defenders, midfielders, forwards } = analysis;
    const totalOutfield = defenders + midfielders + forwards;
    
    if (totalOutfield < 3) return '4-4-2';

    // Ratio-based formation selection
    const defRatio = defenders / totalOutfield;
    const midRatio = midfielders / totalOutfield;
    const fwdRatio = forwards / totalOutfield;

    // Strong defense
    if (defRatio > 0.45) {
        return '4-5-1';
    }

    // Balanced
    if (defRatio > 0.35 && midRatio > 0.35) {
        return analysis.wingers >= 2 ? '4-3-3' : '4-4-2';
    }

    // Attack-oriented
    if (fwdRatio > 0.35) {
        return '4-3-3';
    }

    return '4-4-2';
}

function selectMentality(analysis: SquadAnalysis): string {
    const { avgPace, avgPhysical, avgTechnical, hasSpeedsters } = analysis;

    // High pace + technical = attacking
    if (hasSpeedsters && avgTechnical >= 11) return 'ATTACKING';
    if (avgPace > 12 && avgTechnical > 11) return 'ATTACKING';

    // Balanced attributes = balanced mentality
    if (avgPace >= 10 && avgPhysical >= 10 && avgTechnical >= 10) return 'NORMAL';

    // Low pace or weak technical = defensive
    if (avgPace < 10 || avgTechnical < 10) return 'DEFENSIVE';

    return 'NORMAL';
}

function selectPassing(analysis: SquadAnalysis): string {
    const { avgPassing, hasStrongPassers } = analysis;

    if (hasStrongPassers && avgPassing >= 13) return 'SHORT';
    if (avgPassing >= 12) return 'MIXED';
    return 'DIRECT';
}

function selectTackling(analysis: SquadAnalysis): string {
    const { avgPhysical, hasPhysicalPlayers } = analysis;

    if (hasPhysicalPlayers && avgPhysical >= 13) return 'HARD';
    if (avgPhysical >= 11) return 'NORMAL';
    return 'SOFT';
}

function selectAttackingFocus(analysis: SquadAnalysis): string {
    const { avgTechnical, hasSpeedsters, wingers } = analysis;

    if (hasSpeedsters && avgTechnical >= 12 && wingers >= 2) return 'WINGS';
    if (avgTechnical >= 13) return 'CENTER';
    if (hasSpeedsters) return 'WINGS';
    return 'MIXED';
}

function selectCreativeFreedom(analysis: SquadAnalysis): string {
    const { hasStrongPassers, avgPassing } = analysis;

    if (hasStrongPassers && avgPassing >= 14) return 'RESTRICTED';
    if (avgPassing >= 12) return 'NORMAL';
    return 'MAXIMUM';
}

export function autoSelectTactics(players: Player[]) {
    const analysis = analyzeSquad(players);

    return {
        formation: selectFormation(analysis),
        mentality: selectMentality(analysis),
        passing: selectPassing(analysis),
        tackling: selectTackling(analysis),
        attacking_focus: selectAttackingFocus(analysis),
        creative_freedom: selectCreativeFreedom(analysis)
    };
}
