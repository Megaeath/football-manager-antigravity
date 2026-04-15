import { NextResponse } from 'next/server';
import { simulateMatch2D } from '@/lib/engine/v2/match2d';
import { PlayerState, TeamState } from '@/lib/engine/types';
import type { Position } from '@/lib/engine/types';

/**
 * API endpoint to generate test V2 match data
 * 
 * This endpoint creates a sample match simulation for testing the canvas visualization.
 * It generates two teams with players and runs the V2 match engine.
 */
export async function GET() {
    try {
        // Create sample teams for testing
        const homeTeam = createSampleTeam('home', 'Test United', '4-4-2');
        const awayTeam = createSampleTeam('away', 'Sample FC', '4-3-3');
        
        // Run V2 simulation
        console.log('Running test V2 match simulation...');
        const startTime = Date.now();
        
        const matchResult = simulateMatch2D(homeTeam, awayTeam);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Test match simulated in ${duration}ms`);
        console.log(`   Frames: ${matchResult.frames.length}`);
        console.log(`   Events: ${matchResult.events.length}`);
        console.log(`   Score: ${matchResult.homeScore}-${matchResult.awayScore}`);
        
        return NextResponse.json({
            success: true,
            match: matchResult,
            teams: {
                home: { id: homeTeam.id, name: homeTeam.name, formation: homeTeam.tactics.formation },
                away: { id: awayTeam.id, name: awayTeam.name, formation: awayTeam.tactics.formation }
            },
            metadata: {
                duration,
                frameCount: matchResult.frames.length,
                eventCount: matchResult.events.length
            }
        });
        
    } catch (error) {
        console.error('Error simulating test match:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}

/**
 * Helper: Create a sample team for testing
 */
function createSampleTeam(side: 'home' | 'away', name: string, formation: string): TeamState {
    const players: PlayerState[] = [];
    
    // Define positions for 11 players
    const positions = [
        { role: 'GK', number: 1 },
        { role: 'DR', number: 2 },
        { role: 'DCR', number: 5 },
        { role: 'DCL', number: 6 },
        { role: 'DL', number: 3 },
        { role: 'MR', number: 7 },
        { role: 'MCR', number: 8 },
        { role: 'MCL', number: 10 },
        { role: 'ML', number: 11 },
        { role: 'FWR', number: 9 },
        { role: 'FWL', number: 14 }
    ];
    
    positions.forEach((pos, index) => {
        players.push({
            id: `${side}_player_${index}`,
            name: `${pos.role} ${pos.number}`,
            position: pos.role as Position,
            
            // Sample attributes (flat structure)
            attributes: {
                // Technical
                handling: pos.role === 'GK' ? 15 : 10,
                tackling: pos.role.startsWith('D') ? 14 : 10,
                passing: 12,
                shooting: pos.role.startsWith('FW') ? 14 : 10,
                heading: 11,
                dribbling: pos.role.includes('M') || pos.role.startsWith('FW') ? 13 : 10,
                crossing: pos.role.includes('R') || pos.role.includes('L') ? 12 : 10,
                setPieces: 10,
                throw: 10,
                // Mental
                aggression: 10,
                positioning: 12,
                vision: 11,
                bravery: 11,
                leadership: 10,
                teamwork: 12,
                composure: 11,
                // Physical
                pace: pos.role.startsWith('FW') ? 14 : 11,
                acceleration: 12,
                stamina: 13,
                strength: 12,
                agility: 12,
                balance: 12
            },
            
            // Physical state
            condition: 100,
            exp: 500,
            morale: 80,
            
            // Match state
            tacticalPosition: pos.role,
            cards: { yellow: 0, red: 0 },
            stats: { goals: 0, assists: 0, tackles: 0, passes: 0 }
        });
    });
    
    return {
        id: side,
        name: name,
        players: players,
        tactics: {
            formation: formation,
            mentality: 'NORMAL',
            passing: 'MIXED',
            tackling: 'NORMAL',
            attacking_focus: 'MIXED',
            creative_freedom: 'NORMAL'
        }
    };
}
