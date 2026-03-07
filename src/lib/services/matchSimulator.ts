import prisma from '@/lib/prisma';
import { simulateMatch } from '../engine/match';
import { TeamState, PlayerState, Position, EnginePlayerMatchStats, PlayerAttributes, MatchPrepConfig } from '../engine/types';
import { updatePlayerPopularity, updateTeamReputation } from '../engine/financial';
import { calculateMatchExp } from '../engine/experience';
import { calculatePlayerPower, getEffectiveAttributes, toPlayerAttributes } from '../engine/playerPower';

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

function getFitnessSuitability(attributes: PlayerAttributes, targetPosition: string, condition: number): number {
    return calculatePlayerPower({
        attributes,
        targetPosition,
        condition,
        exp: 0
    }).powerWithExp;
}

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
                suitability: calculatePlayerPower({
                    attributes: mapAttributes(p),
                    targetPosition: slotBase,
                    condition: p.condition,
                    exp: p.exp || 0
                }).powerWithExp
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
    // Apply EXP bonus to all attributes
    const exp = p.exp || 0;
    const effectiveAttributes = getEffectiveAttributes(mapAttributes(p), exp);
    
    return {
        id: p.id,
        name: p.name,
        position: p.naturalPosition as Position,
        attributes: effectiveAttributes,
        condition: p.condition,
        morale: p.morale,
        exp: exp,
        tacticalPosition: p.tacticalPosition,
        playerRole: p.playerRole || null,
        attackingRolePreset: p.attackingRolePreset || p.playerRole || null,
        defensiveRolePreset: p.defensiveRolePreset || p.playerRole || null,
        cards: { yellow: 0, red: 0 },
        stats: { goals: p.goals, assists: p.assists, tackles: 0, passes: 0 }
    };
}

export async function processMatch(matchId: string) {
    const matchDB = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            homeTeam: { include: { players: { where: { isRetired: false } }, tactics: true } },
            awayTeam: { include: { players: { where: { isRetired: false } }, tactics: true } }
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
            formation: matchDB.homeTeam.formation,
            mentality: matchDB.homeTactics_mentality || matchDB.homeTeam.mentality,
            passing: matchDB.homeTactics_passing || matchDB.homeTeam.passing,
            tackling: matchDB.homeTactics_tackling || matchDB.homeTeam.tackling,
            attacking_focus: matchDB.homeTactics_attacking_focus || matchDB.homeTeam.attacking_focus,
            creative_freedom: matchDB.homeTactics_creative_freedom || matchDB.homeTeam.creative_freedom
        },
        tacticalPlans: {
            normal: {
                formation: matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.normalMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.normalPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.normalTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.normalAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.normalCreative_freedom || matchDB.homeTeam.creative_freedom
            },
            behind: {
                formation: matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.behindMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.behindPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.behindTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.behindAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.behindCreative_freedom || matchDB.homeTeam.creative_freedom
            },
            leading: {
                formation: matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.leadingMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.leadingPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.leadingTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.leadingAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.leadingCreative_freedom || matchDB.homeTeam.creative_freedom
            }
        },
        players: matchDB.homeTeam.players.map(mapPlayer)
    };

    const awayTeam: TeamState = {
        id: matchDB.awayTeam.id,
        name: matchDB.awayTeam.name,
        tactics: {
            formation: matchDB.awayTeam.formation,
            mentality: matchDB.awayTactics_mentality || matchDB.awayTeam.mentality,
            passing: matchDB.awayTactics_passing || matchDB.awayTeam.passing,
            tackling: matchDB.awayTactics_tackling || matchDB.awayTeam.tackling,
            attacking_focus: matchDB.awayTactics_attacking_focus || matchDB.awayTeam.attacking_focus,
            creative_freedom: matchDB.awayTactics_creative_freedom || matchDB.awayTeam.creative_freedom
        },
        tacticalPlans: {
            normal: {
                formation: matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.normalMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.normalPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.normalTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.normalAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.normalCreative_freedom || matchDB.awayTeam.creative_freedom
            },
            behind: {
                formation: matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.behindMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.behindPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.behindTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.behindAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.behindCreative_freedom || matchDB.awayTeam.creative_freedom
            },
            leading: {
                formation: matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.leadingMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.leadingPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.leadingTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.leadingAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.leadingCreative_freedom || matchDB.awayTeam.creative_freedom
            }
        },
        players: matchDB.awayTeam.players.map(mapPlayer)
    };

    // Parse match prep configs
    const homePrep: MatchPrepConfig | null = matchDB.homePrepConfig 
        ? JSON.parse(matchDB.homePrepConfig) 
        : null;
    const awayPrep: MatchPrepConfig | null = matchDB.awayPrepConfig 
        ? JSON.parse(matchDB.awayPrepConfig) 
        : null;

    const result = simulateMatch(homeTeam, awayTeam, { home: homePrep, away: awayPrep });

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
            defensiveThirdTouches: stat.defensiveThirdTouches || 0,
            middleThirdTouches: stat.middleThirdTouches || 0,
            attackingThirdTouches: stat.attackingThirdTouches || 0,
            yellowCards: stat.yellowCards,
            redCards: stat.redCards,
            freeKicks: stat.freeKicks || 0,
            corners: stat.corners || 0,
            throws: stat.throws || 0
        }));

        if (statsToCreate.length > 0) {
            try {
                await (tx.playerMatchStats as any).createMany({ data: statsToCreate });
            } catch (err: any) {
                const msg = String(err?.message || '');
                // Backward compatibility: schema/client not migrated yet
                if (msg.includes('defensiveThirdTouches') || msg.includes('middleThirdTouches') || msg.includes('attackingThirdTouches')) {
                    const legacyStatsToCreate = statsToCreate.map((s) => {
                        const { defensiveThirdTouches, middleThirdTouches, attackingThirdTouches, ...legacy } = s as any;
                        return legacy;
                    });
                    await (tx.playerMatchStats as any).createMany({ data: legacyStatsToCreate });
                } else {
                    throw err;
                }
            }
        }

        const actionLogsToCreate = (result.actionLogs || []).map((log: any) => ({
            matchId: matchId,
            playerId: log.playerId,
            teamId: log.teamId,
            minute: log.minute,
            ballPosition: log.ballPosition,
            zone: log.zone,
            actionType: log.actionType,
            result: log.result,
            isSuccessful: log.isSuccessful,
            expectedSuccessRate: typeof log.expectedSuccessRate === 'number' ? log.expectedSuccessRate : null,
            targetPlayerId: log.targetPlayerId || null,
            metadata: log.metadata || null
        }));

        if (actionLogsToCreate.length > 0) {
            try {
                await ((tx as any).playerActionLog).createMany({ data: actionLogsToCreate });
            } catch (err: any) {
                const msg = String(err?.message || '');
                // Backward compatibility: action log table/model not available yet
                if (msg.includes('playerActionLog') || msg.includes('PlayerActionLog') || msg.includes('Unknown argument')) {
                    console.warn('[MatchSimulator] Skipping PlayerActionLog persistence (migration/client not ready yet).');
                } else {
                    throw err;
                }
            }
        }

        for (const stat of playerStats) {
            // Calculate EXP gain from match performance
            const player = await tx.player.findUnique({
                where: { id: stat.playerId },
                select: { naturalPosition: true, age: true, exp: true }
            });
            
                if (!player) continue; // Skip if player not found
            
                const isMotm = motm?.playerId === stat.playerId;
            const cleanSheet = (stat.teamId === matchDB.homeTeamId && result.awayScore === 0) ||
                              (stat.teamId === matchDB.awayTeamId && result.homeScore === 0);
            
            const expGain = calculateMatchExp({
                playerId: stat.playerId,
                minutes: stat.minutes,
                rating: stat.rating,
                goals: stat.goals,
                assists: stat.assists,
                yellowCards: stat.yellowCards,
                redCards: stat.redCards,
                    position: player.naturalPosition,
                cleanSheet: cleanSheet,
                isMotm: isMotm
            });
            
                // Calculate exp increment - allow negative EXP (for age-based decay penalties)
                // System supports -1000 to +1000 range for getExpBonus/getExpMultiplier
                const currentExp = player.exp || 0;
                const newExp = currentExp + expGain.totalGain;
            
            // Update player stats including EXP
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
                    throws: { increment: stat.throws || 0 },
                        exp: newExp
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

/**
 * Update player reputation and team reputation after match
 */
export async function processMatchFinancials(matchId: string) {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            playerStats: true,
            homeTeam: true,
            awayTeam: true
        }
    });

    if (!match || match.homeScore === null || match.awayScore === null) return null;

    // Determine match result
    const homeResult = match.homeScore > match.awayScore ? 'win' : match.homeScore === match.awayScore ? 'draw' : 'loss';
    const awayResult = match.awayScore > match.homeScore ? 'win' : match.homeScore === match.awayScore ? 'draw' : 'loss';

    // Update player popularity for all players in the match
    for (const stat of match.playerStats) {
        const player = await prisma.player.findUnique({
            where: { id: stat.playerId },
            select: { naturalPosition: true }
        });

        await updatePlayerPopularity(stat.playerId, {
            goals: stat.goals,
            assists: stat.assists,
            isMotm: stat.id === match.motmPlayerId,
            played: stat.minutes > 0,
            rating: stat.rating,
            redCards: stat.redCards,
            tackles: stat.tacklesWon,
            saves: stat.saves,
            naturalPosition: player?.naturalPosition,
            isImportantMatch: false // Can be enhanced to detect derby matches, cup finals, etc.
        });
    }

    // Update team reputation
    await updateTeamReputation(match.homeTeamId, homeResult);
    await updateTeamReputation(match.awayTeamId, awayResult);

    return {
        homeResult,
        awayResult
    };
}
