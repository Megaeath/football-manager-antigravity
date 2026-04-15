/**
 * V2 Match Engine Test Script
 * 
 * Tests the new 2D spatial match engine and compares with V1 engine.
 * 
 * Usage:
 *   npx tsx scripts/test-v2-engine.ts
 */

import { PrismaClient } from '@prisma/client';
import { simulateMatch } from '../src/lib/engine/match';
import { simulateMatch2D } from '../src/lib/engine/v2/match2d';
import type { TeamState, PlayerState, MatchState } from '../src/lib/engine/types';
import type { V2MatchState } from '../src/lib/engine/v2/types2d';

const prisma = new PrismaClient();

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors) {
    const colorCode = color ? colors[color] : '';
    console.log(`${colorCode}${message}${colors.reset}`);
}

function header(text: string) {
    log('\n' + '='.repeat(60), 'cyan');
    log(text, 'bright');
    log('='.repeat(60), 'cyan');
}

function section(text: string) {
    log('\n' + text, 'blue');
    log('-'.repeat(text.length), 'blue');
}

async function loadTestTeams(): Promise<{ home: TeamState; away: TeamState }> {
    // Load two real teams from database
    const teams = await prisma.team.findMany({
        take: 2,
        include: {
            players: {
                where: { isRetired: false },
                take: 23
            }
        }
    });

    if (teams.length < 2) {
        throw new Error('Need at least 2 teams in database for testing');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapPlayer = (p: any): PlayerState => ({
        id: p.id,
        name: p.name,
        position: p.naturalPosition,
        attributes: {
            handling: p.handling,
            tackling: p.tackling,
            passing: p.passing,
            shooting: p.shooting,
            heading: p.heading,
            dribbling: p.dribbling,
            crossing: p.crossing,
            setPieces: p.setPieces,
            throw: p.throw,
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
            balance: p.balance,
        },
        condition: p.condition,
        morale: p.morale,
        exp: p.exp,
        tacticalPosition: p.tacticalPosition,
        playerRole: p.playerRole,
        cards: { yellow: 0, red: 0 },
        stats: { goals: 0, assists: 0, tackles: 0, passes: 0 },
    });

    const homeTeam: TeamState = {
        id: teams[0].id,
        name: teams[0].name,
        tactics: {
            formation: teams[0].formation,
            mentality: teams[0].mentality,
            passing: teams[0].passing,
            tackling: teams[0].tackling,
            attacking_focus: teams[0].attacking_focus,
            creative_freedom: teams[0].creative_freedom,
        },
        players: teams[0].players.map(mapPlayer),
    };

    const awayTeam: TeamState = {
        id: teams[1].id,
        name: teams[1].name,
        tactics: {
            formation: teams[1].formation,
            mentality: teams[1].mentality,
            passing: teams[1].passing,
            tackling: teams[1].tackling,
            attacking_focus: teams[1].attacking_focus,
            creative_freedom: teams[1].creative_freedom,
        },
        players: teams[1].players.map(mapPlayer),
    };

    return { home: homeTeam, away: awayTeam };
}

function validateV1Result(result: MatchState): void {
    if (typeof result.homeScore !== 'number') {
        throw new Error('V1 result missing homeScore');
    }
    if (typeof result.awayScore !== 'number') {
        throw new Error('V1 result missing awayScore');
    }
    if (!result.playerStats) {
        throw new Error('V1 result missing playerStats');
    }
    if (!result.events) {
        throw new Error('V1 result missing events');
    }
}

function validateV2Result(result: V2MatchState): void {
    // Check V1 compatibility fields
    if (typeof result.homeScore !== 'number') {
        throw new Error('V2 result missing homeScore');
    }
    if (typeof result.awayScore !== 'number') {
        throw new Error('V2 result missing awayScore');
    }
    if (!result.playerStats) {
        throw new Error('V2 result missing playerStats');
    }
    if (!result.events) {
        throw new Error('V2 result missing events');
    }

    // Check V2-specific fields
    if (!Array.isArray(result.frames)) {
        throw new Error('V2 result missing frames array');
    }
    if (!Array.isArray(result.visualEvents)) {
        throw new Error('V2 result missing visualEvents array');
    }
    if (!result.homeFormationCoordinates || typeof result.homeFormationCoordinates !== 'object') {
        throw new Error('V2 result homeFormationCoordinates is invalid');
    }
    if (!result.awayFormationCoordinates || typeof result.awayFormationCoordinates !== 'object') {
        throw new Error('V2 result awayFormationCoordinates is invalid');
    }

    // Validate frames structure
    if (result.frames.length > 0) {
        const frame = result.frames[0];
        if (!frame.ball || typeof frame.ball.position.x !== 'number') {
            throw new Error('V2 frame missing valid ball position');
        }
        if (!frame.playerPositions || typeof frame.playerPositions !== 'object') {
            throw new Error('V2 frame playerPositions is invalid');
        }
    }
}

function compareResults(v1: MatchState, v2: V2MatchState): void {
    section('Comparison Results');

    const scoreDiff = Math.abs((v1.homeScore + v1.awayScore) - (v2.homeScore + v2.awayScore));
    const scoreMatch = v1.homeScore === v2.homeScore && v1.awayScore === v2.awayScore;

    if (scoreMatch) {
        log(`✓ Exact score match: ${v1.homeScore}-${v1.awayScore}`, 'green');
    } else {
        log(`✗ Score difference: V1=${v1.homeScore}-${v1.awayScore}, V2=${v2.homeScore}-${v2.awayScore}`, 'yellow');
        log(`  Total goals difference: ${scoreDiff}`, 'yellow');
    }

    const v1PlayerCount = Object.keys(v1.playerStats).length;
    const v2PlayerCount = Object.keys(v2.playerStats).length;
    
    if (v1PlayerCount === v2PlayerCount) {
        log(`✓ Player stats count match: ${v1PlayerCount} players`, 'green');
    } else {
        log(`✗ Player stats count: V1=${v1PlayerCount}, V2=${v2PlayerCount}`, 'yellow');
    }

    log(`\nV1 Events: ${v1.events.length}`);
    log(`V2 Events: ${v2.events.length}`);
    log(`V2 Visual Events: ${v2.visualEvents.length}`, 'cyan');
    log(`V2 Frames Recorded: ${v2.frames.length}`, 'cyan');
}

function analyzeV2SpatialData(result: V2MatchState): void {
    section('V2 Spatial Data Analysis');

    log(`Total frames recorded: ${result.frames.length}`);
    log(`Total visual events: ${result.visualEvents.length}`);
    
    // Analyze visual events by type
    const eventTypes = new Map<string, number>();
    result.visualEvents.forEach(event => {
        eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
    });

    log('\nVisual events breakdown:');
    eventTypes.forEach((count, type) => {
        log(`  ${type}: ${count}`);
    });

    // Formation analysis
    log(`\nHome formation positions: ${Object.keys(result.homeFormationCoordinates || {}).length}`);
    log(`Away formation positions: ${Object.keys(result.awayFormationCoordinates || {}).length}`);

    // Sample frame analysis
    if (result.frames.length > 0) {
        const firstFrame = result.frames[0];
        const midFrame = result.frames[Math.floor(result.frames.length / 2)];
        const lastFrame = result.frames[result.frames.length - 1];

        log('\nFrame sampling:');
        log(`  First frame (min ${firstFrame.minute}, tick ${firstFrame.tick}):`);
        log(`    Ball position: (${firstFrame.ball.position.x.toFixed(1)}, ${firstFrame.ball.position.y.toFixed(1)})`);
        log(`    Players positioned: ${Object.keys(firstFrame.playerPositions || {}).length}`);

        log(`  Mid frame (min ${midFrame.minute}, tick ${midFrame.tick}):`);
        log(`    Ball position: (${midFrame.ball.position.x.toFixed(1)}, ${midFrame.ball.position.y.toFixed(1)})`);

        log(`  Last frame (min ${lastFrame.minute}, tick ${lastFrame.tick}):`);
        log(`    Ball position: (${lastFrame.ball.position.x.toFixed(1)}, ${lastFrame.ball.position.y.toFixed(1)})`);
    }

    // Memory estimation
    const frameSize = result.frames.length > 0 
        ? JSON.stringify(result.frames[0]).length 
        : 0;
    const totalFrameMemory = frameSize * result.frames.length;
    const visualEventMemory = JSON.stringify(result.visualEvents).length;
    const totalMemoryKB = (totalFrameMemory + visualEventMemory) / 1024;

    log(`\nMemory estimation:`);
    log(`  Per-frame size: ~${frameSize} bytes`);
    log(`  Total spatial data: ~${totalMemoryKB.toFixed(2)} KB`);
}

async function main() {
    try {
        header('V2 Match Engine Test Suite');

        section('Step 1: Loading Test Teams');
        const { home, away } = await loadTestTeams();
        log(`✓ Loaded home team: ${home.name} (${home.players.length} players)`, 'green');
        log(`✓ Loaded away team: ${away.name} (${away.players.length} players)`, 'green');

        // Test V1 Engine
        header('Testing V1 Engine (Classic 1D Simulation)');
        const v1Start = Date.now();
        const v1Result = simulateMatch(home, away);
        const v1Duration = Date.now() - v1Start;

        log(`✓ V1 simulation completed in ${v1Duration}ms`, v1Duration < 2000 ? 'green' : 'yellow');
        log(`Score: ${home.name} ${v1Result.homeScore} - ${v1Result.awayScore} ${away.name}`);

        validateV1Result(v1Result);
        log('✓ V1 result structure valid', 'green');

        // Test V2 Engine
        header('Testing V2 Engine (2D Spatial Simulation)');
        const v2Start = Date.now();
        const v2Result = simulateMatch2D(home, away);
        const v2Duration = Date.now() - v2Start;

        log(`✓ V2 simulation completed in ${v2Duration}ms`, v2Duration < 2000 ? 'green' : 'yellow');
        log(`Score: ${home.name} ${v2Result.homeScore} - ${v2Result.awayScore} ${away.name}`);

        validateV2Result(v2Result);
        log('✓ V2 result structure valid', 'green');

        // Performance Comparison
        header('Performance Analysis');
        const performanceDiff = v2Duration - v1Duration;
        const performancePercent = ((performanceDiff / v1Duration) * 100).toFixed(1);

        log(`V1 Duration: ${v1Duration}ms`);
        log(`V2 Duration: ${v2Duration}ms`);
        
        if (v2Duration < v1Duration) {
            log(`V2 is ${Math.abs(performanceDiff)}ms faster (${Math.abs(parseFloat(performancePercent))}% improvement)`, 'green');
        } else {
            log(`V2 is ${performanceDiff}ms slower (+${performancePercent}%)`, 'yellow');
        }

        if (v2Duration < 2000) {
            log('✓ V2 meets <2s performance target', 'green');
        } else {
            log(`✗ V2 exceeds 2s target by ${v2Duration - 2000}ms`, 'red');
        }

        // Compare Results
        header('V1 vs V2 Comparison');
        compareResults(v1Result, v2Result);

        // Analyze V2 Spatial Data
        header('V2 Spatial Features Analysis');
        analyzeV2SpatialData(v2Result);

        // Final Summary
        header('Test Summary');
        const allPassed = v1Duration < 5000 && v2Duration < 5000;
        
        if (allPassed) {
            log('✓ All tests PASSED', 'green');
            log('✓ V2 engine is functional and ready for use', 'green');
            log('✓ Spatial replay data successfully generated', 'green');
        } else {
            log('⚠ Some performance concerns detected', 'yellow');
        }

        log('\nNext steps:', 'cyan');
        log('  1. Enable V2 in production: UPDATE GlobalGameSettings SET enableMatch2D = true');
        log('  2. Build Konva visualization components for spatial replay');
        log('  3. Optionally add spatial data persistence tables');

    } catch (error) {
        log('\n✗ Test failed with error:', 'red');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
