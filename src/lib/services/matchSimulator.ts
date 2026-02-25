import prisma from '@/lib/prisma';
import { simulateMatch } from '../engine/match';
import { calculateSuitability } from '../engine/suitability';
import { TeamState, PlayerState, Position, EnginePlayerMatchStats, PlayerAttributes } from '../engine/types';

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
        { id: 'MC_R' },
        { id: 'MC' },
        { id: 'MC_L' },
        { id: 'FW_R' },
        { id: 'FW' },
        { id: 'FW_L' }
    ],
    '5-3-2': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MC_R' },
        { id: 'MC' },
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
        { id: 'MC' },
        { id: 'MC_L' },
        { id: 'ML' },
        { id: 'FW' }
    ]
};

function mapAttributes(p: any): PlayerAttributes {
    return {
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
    };
}

function getFitnessSuitability(attributes: PlayerAttributes, targetPosition: string, condition: number): number {
    const base = calculateSuitability(attributes, targetPosition);
    const factor = Math.pow(Math.max(0, Math.min(1, condition / 100)), 1.2);
    return Math.round(base * factor);
}

function autoSelectLineup(team: any) {
    const slots = FORMATIONS[team.formation] || FORMATIONS['4-4-2'];
    const usedPlayers = new Set<string>();
    const assignments: { playerId: string; position: string }[] = [];

    for (const slot of slots) {
        const slotBase = slot.id.split('_')[0];
        const bestPlayer = team.players
            .filter((p: any) => !usedPlayers.has(p.id))
            .map((p: any) => ({
                playerId: p.id,
                position: slot.id,
                suitability: getFitnessSuitability(mapAttributes(p), slotBase, p.condition)
            }))
            .sort((a: any, b: any) => b.suitability - a.suitability)[0];

        if (bestPlayer) {
            assignments.push({ playerId: bestPlayer.playerId, position: bestPlayer.position });
            usedPlayers.add(bestPlayer.playerId);
        }
    }

    return assignments;
}

function mapPlayer(p: any): PlayerState {
    return {
        id: p.id,
        name: p.name,
        position: p.naturalPosition as Position,
        attributes: {
            handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
            heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces, crossing: p.crossing,
            throw: p.throw || 10,
            aggression: p.aggression, positioning: p.positioning, vision: p.vision, bravery: p.bravery,
            leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
            pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
            agility: p.agility, balance: p.balance,
        },
        condition: p.condition,
        morale: p.morale,
        tacticalPosition: p.tacticalPosition,
        cards: { yellow: 0, red: 0 },
        stats: { goals: p.goals, assists: p.assists, tackles: 0, passes: 0 }
    };
}

export async function processMatch(matchId: string) {
    const matchDB = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            homeTeam: { include: { players: { where: { isRetired: false } } } },
            awayTeam: { include: { players: { where: { isRetired: false } } } }
        }
    }) as any;

    if (!matchDB || matchDB.isPlayed) return null;

    const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    const userTeamId = settings?.userTeamId ?? null;

    const homeHasManual = matchDB.homeTeam.id === userTeamId
        && matchDB.homeTeam.players.some((p: any) => p.tacticalPosition);
    const awayHasManual = matchDB.awayTeam.id === userTeamId
        && matchDB.awayTeam.players.some((p: any) => p.tacticalPosition);

    const homeAssignments = homeHasManual ? [] : autoSelectLineup(matchDB.homeTeam);
    const awayAssignments = awayHasManual ? [] : autoSelectLineup(matchDB.awayTeam);

    await prisma.$transaction(async (tx) => {
        if (!homeHasManual) {
            await tx.player.updateMany({
                where: { teamId: matchDB.homeTeam.id },
                data: { tacticalPosition: null }
            });

            for (const assignment of homeAssignments) {
                await tx.player.update({
                    where: { id: assignment.playerId },
                    data: { tacticalPosition: assignment.position }
                });
            }
        }

        if (!awayHasManual) {
            await tx.player.updateMany({
                where: { teamId: matchDB.awayTeam.id },
                data: { tacticalPosition: null }
            });

            for (const assignment of awayAssignments) {
                await tx.player.update({
                    where: { id: assignment.playerId },
                    data: { tacticalPosition: assignment.position }
                });
            }
        }
    });

    // Update in-memory players for simulation
    if (!homeHasManual) {
        matchDB.homeTeam.players.forEach((p: any) => {
            const found = homeAssignments.find(a => a.playerId === p.id);
            p.tacticalPosition = found ? found.position : null;
        });
    }

    if (!awayHasManual) {
        matchDB.awayTeam.players.forEach((p: any) => {
            const found = awayAssignments.find(a => a.playerId === p.id);
            p.tacticalPosition = found ? found.position : null;
        });
    }

    const homeTeam: TeamState = {
        id: matchDB.homeTeam.id,
        name: matchDB.homeTeam.name,
        tactics: {
            formation: matchDB.homeTactics_formation || matchDB.homeTeam.formation,
            mentality: matchDB.homeTactics_mentality || matchDB.homeTeam.mentality,
            passing: matchDB.homeTactics_passing || matchDB.homeTeam.passing,
            tackling: matchDB.homeTactics_tackling || matchDB.homeTeam.tackling,
            attacking_focus: matchDB.homeTactics_attacking_focus || matchDB.homeTeam.attacking_focus,
            creative_freedom: matchDB.homeTactics_creative_freedom || matchDB.homeTeam.creative_freedom
        },
        players: matchDB.homeTeam.players.map(mapPlayer)
    };

    const awayTeam: TeamState = {
        id: matchDB.awayTeam.id,
        name: matchDB.awayTeam.name,
        tactics: {
            formation: matchDB.awayTactics_formation || matchDB.awayTeam.formation,
            mentality: matchDB.awayTactics_mentality || matchDB.awayTeam.mentality,
            passing: matchDB.awayTactics_passing || matchDB.awayTeam.passing,
            tackling: matchDB.awayTactics_tackling || matchDB.awayTeam.tackling,
            attacking_focus: matchDB.awayTactics_attacking_focus || matchDB.awayTeam.attacking_focus,
            creative_freedom: matchDB.awayTactics_creative_freedom || matchDB.awayTeam.creative_freedom
        },
        players: matchDB.awayTeam.players.map(mapPlayer)
    };

    const result = simulateMatch(homeTeam, awayTeam);

    const defaultTeamStats = {
        possession: 50,
        corners: 0,
        offsides: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        shots: 0,
        shotsOnTarget: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        crossesAttempted: 0,
        crossesCompleted: 0,
        freeKicks: 0,
        throws: 0
    };

    const derivedTeamStats = {
        home: { ...defaultTeamStats },
        away: { ...defaultTeamStats }
    };

    Object.values(result.playerStats).forEach((stat: EnginePlayerMatchStats) => {
        const bucket = stat.teamId === result.homeTeamId ? derivedTeamStats.home : derivedTeamStats.away;
        bucket.shots += stat.shots || 0;
        bucket.shotsOnTarget += stat.shotsOnTarget || 0;
        bucket.passesAttempted += stat.passesAttempted || 0;
        bucket.passesCompleted += stat.passesCompleted || 0;
        bucket.crossesAttempted += stat.crossesAttempted || 0;
        bucket.crossesCompleted += stat.crossesCompleted || 0;
        bucket.yellowCards += stat.yellowCards || 0;
        bucket.redCards += stat.redCards || 0;
        bucket.freeKicks += stat.freeKicks || 0;
        bucket.corners += stat.corners || 0;
        bucket.throws += stat.throws || 0;
    });

    const mergedTeamStats = {
        home: { ...defaultTeamStats, ...result.teamStats.home, ...derivedTeamStats.home },
        away: { ...defaultTeamStats, ...result.teamStats.away, ...derivedTeamStats.away }
    };
    let motm: EnginePlayerMatchStats | null = null;

    await prisma.$transaction(async (tx) => {
        // Determine Man of the Match (highest rating)
        const playerStats = Object.values(result.playerStats) as EnginePlayerMatchStats[];
        if (playerStats.length > 0) {
            motm = playerStats.reduce((prev, current) => (prev.rating > current.rating) ? prev : current);
        }

        await (tx.match as any).update({
            where: { id: matchId },
            data: {
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                isPlayed: true,
                stats: JSON.stringify(mergedTeamStats),
                motmPlayerId: motm ? motm.playerId : null
            }
        });

        if (motm) {
            await (tx.player as any).update({
                where: { id: motm.playerId },
                data: { motmCount: { increment: 1 } }
            });
        }

        if (result.events.length > 0) {
            await tx.matchEvent.createMany({
                data: result.events.map(e => ({
                    matchId: matchId,
                    minute: e.minute,
                    text: e.text,
                    type: e.type,
                    teamId: e.teamId,
                    playerId: e.playerId
                }))
            });
        }

        const statsToCreate = playerStats.map((stat: EnginePlayerMatchStats) => ({
            matchId: matchId,
            playerId: stat.playerId,
            teamId: stat.teamId,
            rating: stat.rating,
            minutes: stat.minutes,
            goals: stat.goals,
            assists: stat.assists,
            passesAttempted: stat.passesAttempted,
            passesCompleted: stat.passesCompleted,
            crossesAttempted: stat.crossesAttempted,
            crossesCompleted: stat.crossesCompleted,
            shots: stat.shots,
            shotsOnTarget: stat.shotsOnTarget,
            tacklesAttempted: stat.tacklesAttempted,
            tacklesWon: stat.tacklesWon,
            dribblesAttempted: stat.dribblesAttempted,
            dribblesWon: stat.dribblesWon,
            saves: stat.saves,
            fitnessEnd: stat.fitnessEnd,
            yellowCards: stat.yellowCards,
            redCards: stat.redCards,
            freeKicks: stat.freeKicks || 0,
            corners: stat.corners || 0,
            throws: stat.throws || 0
        }));

        if (statsToCreate.length > 0) {
            await tx.playerMatchStats.createMany({ data: statsToCreate });
        }

        for (const stat of playerStats) {
            await (tx.player as any).update({
                where: { id: stat.playerId },
                data: {
                    goals: { increment: stat.goals },
                    assists: { increment: stat.assists },
                    apps: { increment: stat.minutes > 0 ? 1 : 0 },
                    yellowCards: { increment: stat.yellowCards },
                    redCards: { increment: stat.redCards },
                    condition: stat.fitnessEnd,
                    passesAttempted: { increment: stat.passesAttempted },
                    passesCompleted: { increment: stat.passesCompleted },
                    crossesAttempted: { increment: stat.crossesAttempted },
                    crossesCompleted: { increment: stat.crossesCompleted },
                    freeKicks: { increment: stat.freeKicks || 0 },
                    corners: { increment: stat.corners || 0 },
                    throws: { increment: stat.throws || 0 }
                }
            });
        }
    });

    return {
        ...result,
        teamStats: mergedTeamStats,
        homeTeamName: (matchDB as any).homeTeam.name,
        awayTeamName: (matchDB as any).awayTeam.name,
        motmPlayerId: (motm as any)?.playerId || null
    };
}
