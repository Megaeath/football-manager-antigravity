/**
 * Auto-selects optimal tactics for AI teams based on squad composition
 * Analyzes player strengths and recommends formation and mentality
 */

import type { Player } from '@prisma/client';
import type { AIPlaystyleProfile } from './aiPlaystyleProfiles';
import { normalizePlaystyleTactics } from './aiPlaystyleService';

type TacticFormation = '4-4-2' | '4-3-3' | '4-5-1';
type TacticMentality = 'ALL_OUT_ATTACK' | 'ATTACKING' | 'NORMAL' | 'DEFENSIVE' | 'ULTRA_DEFENSIVE';
type TacticPassing = 'SHORT' | 'MIXED' | 'DIRECT';
type TacticTackling = 'SOFT' | 'NORMAL' | 'HARD';
type TacticAttackingFocus = 'CENTER' | 'MIXED' | 'WINGS';
type TacticCreativeFreedom = 'RESTRICTED' | 'NORMAL' | 'MAXIMUM';

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

function selectFormation(analysis: SquadAnalysis): TacticFormation {
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

function selectMentality(analysis: SquadAnalysis): TacticMentality {
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

function selectPassing(analysis: SquadAnalysis): TacticPassing {
    const { avgPassing, hasStrongPassers } = analysis;

    if (hasStrongPassers && avgPassing >= 13) return 'SHORT';
    if (avgPassing >= 12) return 'MIXED';
    return 'DIRECT';
}

function selectTackling(analysis: SquadAnalysis): TacticTackling {
    const { avgPhysical, hasPhysicalPlayers } = analysis;

    if (hasPhysicalPlayers && avgPhysical >= 13) return 'HARD';
    if (avgPhysical >= 11) return 'NORMAL';
    return 'SOFT';
}

function selectAttackingFocus(analysis: SquadAnalysis): TacticAttackingFocus {
    const { avgTechnical, hasSpeedsters, wingers } = analysis;

    if (hasSpeedsters && avgTechnical >= 12 && wingers >= 2) return 'WINGS';
    if (avgTechnical >= 13) return 'CENTER';
    if (hasSpeedsters) return 'WINGS';
    return 'MIXED';
}

function selectCreativeFreedom(analysis: SquadAnalysis): TacticCreativeFreedom {
    const { hasStrongPassers, avgPassing } = analysis;

    if (hasStrongPassers && avgPassing >= 14) return 'RESTRICTED';
    if (avgPassing >= 12) return 'NORMAL';
    return 'MAXIMUM';
}

export function autoSelectTactics(players: Player[], playstyle?: AIPlaystyleProfile | null) {
    const analysis = analyzeSquad(players);

    const baseFromSquad = {
        formation: selectFormation(analysis),
        mentality: selectMentality(analysis),
        passing: selectPassing(analysis),
        tackling: selectTackling(analysis),
        attacking_focus: selectAttackingFocus(analysis),
        creative_freedom: selectCreativeFreedom(analysis)
    };

    if (!playstyle) {
        return baseFromSquad;
    }

    const styleBase = normalizePlaystyleTactics(playstyle.tactics);

    // Blend style identity + current squad reality
    const finalTactics = {
        formation: styleBase.formation,
        mentality: styleBase.mentality,
        passing: styleBase.passing,
        tackling: styleBase.tackling,
        attacking_focus: styleBase.attacking_focus,
        creative_freedom: styleBase.creative_freedom
    };

    // If squad strongly favors another shape, allow tactical correction.
    if (analysis.defenders < 5 && styleBase.formation === '4-5-1') {
        finalTactics.formation = baseFromSquad.formation;
    }

    // Possession styles still need passers; otherwise relax to mixed/direct.
    if (styleBase.passing === 'SHORT' && !analysis.hasStrongPassers) {
        finalTactics.passing = analysis.avgPassing >= 11 ? 'MIXED' : 'DIRECT';
    }

    // Aggressive style without physical capacity becomes normal tackling.
    if (styleBase.tackling === 'HARD' && analysis.avgPhysical < 11) {
        finalTactics.tackling = 'NORMAL';
    }

    // Creative restrictive style should loosen if technical level is low.
    if (styleBase.creative_freedom === 'RESTRICTED' && analysis.avgTechnical < 10) {
        finalTactics.creative_freedom = 'NORMAL';
    }

    // Wing-focused style requires some width in squad.
    if (styleBase.attacking_focus === 'WINGS' && analysis.wingers < 2) {
        finalTactics.attacking_focus = 'MIXED';
    }

    return finalTactics;
}
