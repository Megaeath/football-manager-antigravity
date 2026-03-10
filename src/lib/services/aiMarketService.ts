import prisma from '@/lib/prisma';
import { calculateSeasonStandings } from './seasonAwards';
import { calculatePlayerPower, toPlayerAttributes } from '../engine/playerPower';
import { evaluateMarketValue } from '../engine/financial';
import { submitBid } from '../engine/market';
import { getGameTime } from './gameTime';

type MarketTarget = { player: any; power: number };

const MIN_POSITION_DEPTH = 2;
const FORMATION_POSITION_REQUIREMENTS: Record<string, string[]> = {
    '4-4-2': ['GK', 'DR', 'DC', 'DL', 'MR', 'MC', 'ML', 'FW'],
    '4-3-3': ['GK', 'DR', 'DC', 'DL', 'MC', 'FW'],
    '4-5-1': ['GK', 'DR', 'DC', 'DL', 'MR', 'MC', 'ML', 'FW']
};

function getPositionKey(position: string): string {
    return (position || '').trim().toUpperCase();
}

function normalizeDepthPosition(position: string): string {
    const pos = getPositionKey(position);

    if (pos.startsWith('FW')) return 'FW';
    if (pos.startsWith('DC')) return 'DC';
    if (pos.startsWith('MC')) return 'MC';
    return pos;
}

function getRequiredPositionsForFormation(formation?: string | null) {
    return FORMATION_POSITION_REQUIREMENTS[formation || ''] || FORMATION_POSITION_REQUIREMENTS['4-4-2'];
}

function buildPositionDepthMap(players: Array<{ naturalPosition: string }>, formation?: string | null) {
    const depthMap = new Map<string, number>();
    const requiredPositions = getRequiredPositionsForFormation(formation);

    for (const pos of requiredPositions) {
        depthMap.set(pos, 0);
    }

    for (const player of players) {
        const pos = normalizeDepthPosition(player.naturalPosition);
        depthMap.set(pos, (depthMap.get(pos) || 0) + 1);
    }

    return depthMap;
}

function getPositionDepth(depthMap: Map<string, number>, position: string) {
    return depthMap.get(normalizeDepthPosition(position)) || 0;
}

async function getTopRankingPlayerIds(currentSeason: number, log: (msg: string) => void): Promise<Set<string>> {
    try {
        const rows: any[] = await prisma.$queryRaw`
            SELECT
                p.id as playerId,
                SUM(pms.goals) as goals,
                SUM(pms.assists) as assists,
                SUM(pms.minutes) as minutes,
                SUM(pms.passesCompleted) as passesCompleted,
                SUM(pms.passesAttempted) as passesAttempted,
                SUM(pms.crossesCompleted) as crossesCompleted,
                SUM(pms.dribblesWon) as dribblesWon,
                SUM(pms.tacklesWon) as tacklesWon,
                AVG(pms.rating) as avgRating,
                p.motmCount as motmCount
            FROM PlayerMatchStats pms
            JOIN Match m ON pms.matchId = m.id
            JOIN Player p ON pms.playerId = p.id
            WHERE m.season = ${currentSeason}
            GROUP BY p.id
            HAVING SUM(pms.minutes) > 0
        `;

        const stats = rows.map((r: any) => ({
            playerId: String(r.playerId),
            goals: Number(r.goals || 0),
            assists: Number(r.assists || 0),
            passesCompleted: Number(r.passesCompleted || 0),
            passesAttempted: Number(r.passesAttempted || 0),
            crossesCompleted: Number(r.crossesCompleted || 0),
            dribblesWon: Number(r.dribblesWon || 0),
            tacklesWon: Number(r.tacklesWon || 0),
            avgRating: Number(r.avgRating || 0),
            motmCount: Number(r.motmCount || 0),
            passAccuracy: Number(r.passesAttempted || 0) > 0
                ? (Number(r.passesCompleted || 0) / Number(r.passesAttempted || 0)) * 100
                : 0,
        }));

        const topIds = new Set<string>();
        const top3 = (arr: typeof stats, selector: (x: (typeof stats)[number]) => number) => {
            return [...arr].sort((a, b) => selector(b) - selector(a)).slice(0, 3);
        };

        [
            top3(stats, s => s.goals),
            top3(stats, s => s.assists),
            top3(stats, s => s.passAccuracy),
            top3(stats, s => s.crossesCompleted),
            top3(stats, s => s.dribblesWon),
            top3(stats, s => s.tacklesWon),
            top3(stats, s => s.motmCount),
            top3(stats, s => s.avgRating),
        ].forEach(group => {
            group.forEach(p => topIds.add(p.playerId));
        });

        log(`[AI Market] Ranking spotlight pool (Top 3 across categories): ${topIds.size} players`);
        return topIds;
    } catch (err: any) {
        log(`[AI Market] Failed to build ranking spotlight pool: ${err.message}`);
        return new Set<string>();
    }
}

export async function processAIMarketMovements(logCollector?: string[]) {
    const log = (msg: string) => {
        console.log(msg);
        if (logCollector) logCollector.push(msg);
    };

    log('[AI Market] Starting monthly AI transfer movements...');
    try {
        const settings = await getGameTime();
        const leagues = await prisma.league.findMany();
        const rankingTop3Ids = await getTopRankingPlayerIds(settings.currentSeason, log);

        for (const league of leagues) {
            log(`[AI Market] Processing league: ${league.name}`);

            let standings;
            try {
                standings = await calculateSeasonStandings(league.id, settings.currentSeason);
            } catch (err: any) {
                log(`[AI Market] Error calculating standings: ${err.message}`);
                continue;
            }

            const topTeams = standings.slice(0, 5).map(s => s.id);
            const aiTeamIds = standings.map(s => s.id).filter(id => id !== settings.userTeamId);

            // 0. Revalue existing listings based on current market conditions
            const listedPlayers = await prisma.player.findMany({
                where: { transferStatus: 'LISTED', isRetired: false }
            });
            for (const player of listedPlayers) {
                const currentValue = await evaluateMarketValue(player);
                if (player.askingPrice !== currentValue) {
                    await prisma.player.update({
                        where: { id: player.id },
                        data: { askingPrice: currentValue }
                    });
                    log(`[AI Market] Revalued ${player.name} from $${player.askingPrice?.toLocaleString() || 'N/A'} to $${currentValue.toLocaleString()}`);
                }
            }

            // 0.5. AI Teams Releasing Logic: Release old/weak players to free agent pool
            for (const teamId of aiTeamIds) {
                await processAIReleasingLogic(teamId, log);
            }

            // 1. AI Teams Selling Logic
            for (const teamId of aiTeamIds) {
                await processAISellingLogic(teamId, log);
            }

            // 1.5. User Team: Evaluate fringe players for auto-listing
            // This gives AI opportunities to bid on user's team
            if (settings.userTeamId) {
                await evaluatePlayerTeamForListing(settings.userTeamId, log);
            }

            const acceptedLockedPlayerIds = new Set(
                (await prisma.bid.findMany({
                    where: {
                        status: 'ACCEPTED',
                        windowEnds: { gte: settings.currentDate }
                    },
                    select: { playerId: true }
                })).map(b => b.playerId)
            );

            // 2. Pre-fetch listed players
            const allListed = await prisma.player.findMany({
                where: { transferStatus: 'LISTED', isRetired: false },
                include: { team: true }
            });
            const availablePlayers = allListed.filter(p => p.teamId !== null && !acceptedLockedPlayerIds.has(p.id));

            const playersWithPower = availablePlayers.map(p => ({
                player: p,
                power: calculatePlayerPower({ 
                    attributes: toPlayerAttributes(p), 
                    targetPosition: p.naturalPosition.split('_')[0],
                    condition: 100,
                    exp: p.exp || 0
                }).powerWithExp
            }));

            log(`[AI Market] ${availablePlayers.length} players available on market`);

            // 3. AI Teams Buying Logic
            for (const teamId of aiTeamIds) {
                const isTopTier = topTeams.includes(teamId);
                await processAIBuyingLogic(teamId, isTopTier, playersWithPower, settings.currentSeason, rankingTop3Ids, log);
            }
        }
        log('[AI Market] Monthly AI transfer movements completed.');
    } catch (err: any) {
        log(`[AI Market] Critical error: ${err.message}`);
    }
}

async function processAIReleasingLogic(teamId: string, log: (msg: string) => void) {
    /**
     * Release old/weak/excess players to free agent pool
     * Criteria:
     * - Team has > 20 players (squad bloat)
     * - Player is old (age >= 33) AND weak (power < 55) 
     * - OR very old (age >= 33) regardless of power
     * - OR backup/weak (power < 45) regardless of age
     */
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });
    if (!team) return;

    // Only release if squad is oversized (>20 players to capture typical squads)
    if (team.players.length <= 20) return;

    const depthMap = buildPositionDepthMap(team.players, team.formation);

    let releasedCount = 0;
    for (const player of team.players) {
        // Don't release if already listed or in process
        if (player.transferStatus === 'LISTED') continue;

        const playerPosition = normalizeDepthPosition(player.naturalPosition);
        const currentDepth = getPositionDepth(depthMap, playerPosition);
        if (currentDepth <= MIN_POSITION_DEPTH) continue;

        const playerPower = calculatePlayerPower({
            attributes: toPlayerAttributes(player),
            targetPosition: player.naturalPosition.split('_')[0],
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;

        let shouldRelease = false;

        // Very old (age >= 33): always release 
        if (player.age >= 33) shouldRelease = true;

        // Old-ish and weak (age >= 30 AND power < 55)
        if (!shouldRelease && player.age >= 30 && playerPower < 55) shouldRelease = true;

        // Backup/Weak (power < 45) - fringe squad member
        if (!shouldRelease && playerPower < 45) shouldRelease = true;

        if (shouldRelease) {
            // Release to free agent pool (set teamId to null, clear listing)
            await prisma.player.update({
                where: { id: player.id },
                data: { 
                    teamId: null,
                    transferStatus: 'FREE_AGENT',
                    contractEndWeek: 0 // Clear remaining contract
                }
            });
            depthMap.set(playerPosition, currentDepth - 1);
            log(`[AI Market] ${team.name} released ${player.name} (Age ${player.age}, Power ${playerPower.toFixed(1)}) to free agent pool`);
            releasedCount++;
        }
    }

    if (releasedCount > 0) {
        log(`[AI Market] ${team.name} released ${releasedCount} players to free agent pool (squad: ${team.players.length} → ${team.players.length - releasedCount})`);
    }
}

async function processAISellingLogic(teamId: string, log: (msg: string) => void) {
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });
    if (!team) return;

    const depthMap = buildPositionDepthMap(team.players, team.formation);

    let listedCount = 0;
    for (const player of team.players) {
        if (player.transferStatus === 'LISTED') continue;
        if ((player.lastTransferredSeason ?? -1) === currentSeason) continue;

        const playerPosition = normalizeDepthPosition(player.naturalPosition);
        const currentDepth = getPositionDepth(depthMap, playerPosition);
        if (currentDepth <= MIN_POSITION_DEPTH) continue;

        const playerPower = calculatePlayerPower({
            attributes: toPlayerAttributes(player),
            targetPosition: player.naturalPosition.split('_')[0],
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;

        let shouldList = false;
        
        // More aggressive listing criteria
        if (player.age > 30 && playerPower < 72) shouldList = true; // Old and weak
        if (player.age > 33) shouldList = true; // Very old, regardless of power
        
        if (!shouldList && playerPower < 65) { // Lower threshold (was 68)
            if (currentDepth > MIN_POSITION_DEPTH) shouldList = true; // Excess depth
        }

        if (shouldList) {
            const value = await evaluateMarketValue(player);
            await prisma.player.update({
                where: { id: player.id },
                data: { transferStatus: 'LISTED', askingPrice: value }
            });
            depthMap.set(playerPosition, currentDepth - 1);
            log(`[AI Market] ${team.name} listed ${player.name} (Age ${player.age}, Power ${playerPower.toFixed(1)}) for $${value.toLocaleString()}`);
            listedCount++;
        }
    }
    
    if (listedCount > 0) {
        log(`[AI Market] ${team.name} listed ${listedCount} total players`);
    }
}

async function evaluatePlayerTeamForListing(userTeamId: string, log: (msg: string) => void) {
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;

    /**
     * For user team: Evaluate fringe/backup players for listing
     * This gives AI teams opportunities to bid on user's squad
     */
    const team = await prisma.team.findUnique({
        where: { id: userTeamId },
        include: { players: { where: { isRetired: false } } }
    });
    if (!team) return;

    let listedCount = 0;
    for (const player of team.players) {
        if (player.transferStatus === 'LISTED') continue;
        if ((player.lastTransferredSeason ?? -1) === currentSeason) continue;

        const playerPower = calculatePlayerPower({
            attributes: toPlayerAttributes(player),
            targetPosition: player.naturalPosition.split('_')[0],
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;

        let shouldList = false;

        // User team: list backup/fringe players (lower bar than AI teams)
        // - Very old: always list
        if (player.age > 35) shouldList = true;

        // - Old + weak: list
        if (!shouldList && player.age > 28 && playerPower < 68) shouldList = true;

        // - Backup player (low power): list if excess depth
        if (!shouldList && playerPower < 62) {
            const depth = team.players.filter(p => p.naturalPosition === player.naturalPosition).length;
            if (depth > 2) shouldList = true;
        }

        // - Very low power: always list excess players
        if (!shouldList && playerPower < 55) shouldList = true;

        if (shouldList) {
            const value = await evaluateMarketValue(player);
            await prisma.player.update({
                where: { id: player.id },
                data: { transferStatus: 'LISTED', askingPrice: value }
            });
            log(`[AI Market] ${team.name} auto-listed backup ${player.name} (Age ${player.age}, Power ${playerPower.toFixed(1)}) for $${value.toLocaleString()}`);
            listedCount++;
        }
    }

    if (listedCount > 0) {
        log(`[AI Market] ${team.name} auto-listed ${listedCount} backup players for transfer market`);
    }
}

async function processAIBuyingLogic(
    teamId: string,
    isTopTier: boolean,
    listedPlayers: MarketTarget[],
    currentSeason: number,
    rankingTop3Ids: Set<string>,
    log: (msg: string) => void
) {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });
    
    if (!team) {
        log(`[AI Market] Team ${teamId} not found - skipping`);
        return;
    }
    
    // Lower minimum balance to allow more transfers (was 1,000,000)
    if (team.balance < 500000) {
        log(`[AI Market] ${team.name} has insufficient balance ($${team.balance.toLocaleString()}) - skipping`);
        return;
    }

    // Include free agents in the pool
    const freeAgents = await prisma.player.findMany({
        where: { teamId: null, isRetired: false },
        include: { team: true }
    });

    const freeAgentsWithPower = freeAgents.map(p => ({
        player: p,
        power: calculatePlayerPower({ 
            attributes: toPlayerAttributes(p), 
            targetPosition: p.naturalPosition.split('_')[0],
            condition: 100,
            exp: p.exp || 0
        }).powerWithExp
    }));

    const allAvailable = [...listedPlayers, ...freeAgentsWithPower];
    const teamDepthMap = buildPositionDepthMap(team.players, team.formation);

    const maxBudget = isTopTier ? team.balance : team.balance * 0.8;

    // Respect one-transfer-per-season rule
    const targets = allAvailable.filter(lp =>
        lp.player.teamId !== teamId &&
        (lp.player.lastTransferredSeason ?? -1) < currentSeason &&
        (lp.player.askingPrice || 0) <= maxBudget
    );

    if (targets.length === 0) return;

    const requiredPositions = getRequiredPositionsForFormation(team.formation);
    const urgentPositions = requiredPositions.filter(pos => getPositionDepth(teamDepthMap, pos) < MIN_POSITION_DEPTH);

    if (isTopTier) {
        // Title contenders: prioritize famous + in-form + Top 3 ranking players, ignore power gate
        const rankedTargets = targets.filter(lp => rankingTop3Ids.has(lp.player.id));
        const qualityTargets = targets.filter(lp =>
            (lp.player.popularity || 0) >= 70 ||
            (lp.player.avgRating || 0) >= 7.0 ||
            (lp.player.motmCount || 0) >= 2 ||
            (lp.player.goals || 0) >= 5 ||
            (lp.player.assists || 0) >= 5
        );

        const preferredPool = rankedTargets.length > 0
            ? rankedTargets
            : (qualityTargets.length > 0 ? qualityTargets : targets);

        const urgentPool = urgentPositions.length > 0
            ? preferredPool.filter(lp => urgentPositions.includes(normalizeDepthPosition(lp.player.naturalPosition)))
            : preferredPool;

        const finalPool = urgentPool.length > 0 ? urgentPool : preferredPool;

        const sortedPreferred = [...finalPool].sort((a, b) => {
            const scoreA = (rankingTop3Ids.has(a.player.id) ? 100 : 0)
                + Number(a.player.popularity || 0)
                + Number(a.player.avgRating || 0) * 10
                + Number(a.player.motmCount || 0) * 3
                + Number(a.player.goals || 0)
                + Number(a.player.assists || 0);
            const scoreB = (rankingTop3Ids.has(b.player.id) ? 100 : 0)
                + Number(b.player.popularity || 0)
                + Number(b.player.avgRating || 0) * 10
                + Number(b.player.motmCount || 0) * 3
                + Number(b.player.goals || 0)
                + Number(b.player.assists || 0);
            return scoreB - scoreA;
        });

        const shortList = sortedPreferred.slice(0, Math.min(5, sortedPreferred.length));
        if (shortList.length > 0) {
            const t = shortList[Math.floor(Math.random() * shortList.length)];
            const isFreeAgent = !t.player.teamId;
            const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
            const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
            const urgentNote = urgentPositions.length > 0 ? `, Urgent:${urgentPositions.join('/')}` : '';
            log(`[AI Market] ${team.name} (Top 1-5) bid for ${t.player.name} (${source}, Pop:${t.player.popularity || 50}, RankTop3:${rankingTop3Ids.has(t.player.id) ? 'Y' : 'N'}${urgentNote}): ${res.success ? 'Success' : res.message}`);
        }
    } else {
        // All non-top teams: evaluate every position in current game data
        const positionToTeamPowers = new Map<string, number[]>();
        for (const p of team.players) {
            const pos = normalizeDepthPosition(p.naturalPosition);
            const pwr = calculatePlayerPower({
                attributes: toPlayerAttributes(p),
                targetPosition: p.naturalPosition.split('_')[0],
                condition: 100,
                exp: p.exp || 0,
            }).powerWithExp;

            if (!positionToTeamPowers.has(pos)) positionToTeamPowers.set(pos, []);
            positionToTeamPowers.get(pos)!.push(pwr);
        }

        const allPositions = new Set<string>([
            ...Array.from(positionToTeamPowers.keys()),
            ...targets.map(t => normalizeDepthPosition(t.player.naturalPosition)),
        ]);

        const positionPriority = Array.from(allPositions).map(pos => {
            const powers = positionToTeamPowers.get(pos) || [];
            const avgPower = powers.length > 0
                ? powers.reduce((sum, p) => sum + p, 0) / powers.length
                : 0;
            const depth = getPositionDepth(teamDepthMap, pos);
            return { pos, avgPower, depth, hasNoDepth: powers.length === 0, isUrgent: depth < MIN_POSITION_DEPTH };
        }).sort((a, b) => {
            if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
            if (a.depth !== b.depth) return a.depth - b.depth;
            if (a.hasNoDepth !== b.hasNoDepth) return a.hasNoDepth ? -1 : 1;
            return a.avgPower - b.avgPower;
        });

        for (const { pos, avgPower, hasNoDepth, depth, isUrgent } of positionPriority) {
            const posTargets = targets.filter(lp => {
                const targetPos = getPositionKey(lp.player.naturalPosition);
                const normalizedTargetPos = normalizeDepthPosition(targetPos);
                return normalizedTargetPos === pos && lp.power > avgPower;
            });

            if (posTargets.length > 0) {
                const sortedTargets = [...posTargets].sort((a, b) => b.power - a.power);
                const pool = sortedTargets.slice(0, Math.min(3, sortedTargets.length));
                const t = pool[Math.floor(Math.random() * pool.length)];
                const isFreeAgent = !t.player.teamId;
                const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
                const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
                log(`[AI Market] ${team.name} bid for ${t.player.name} (${pos}, ${source}, P:${t.power.toFixed(1)} > TeamAvg:${avgPower.toFixed(1)}, Depth:${depth}, Need2:${isUrgent ? 'Y' : 'N'}, NoDepth:${hasNoDepth ? 'Y' : 'N'}): ${res.success ? 'Success' : res.message}`);
                break;
            }
        }
    }
}
