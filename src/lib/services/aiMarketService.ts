import prisma from '@/lib/prisma';
import { calculateSeasonStandings } from './seasonAwards';
import { calculatePlayerPower, toPlayerAttributes } from '../engine/playerPower';
import { evaluateMarketValue } from '../engine/financial';
import { submitBid } from '../engine/market';
import { getGameTime } from './gameTime';

type MarketTarget = { player: any; power: number };

function getPositionKey(position: string): string {
    return (position || '').trim().toUpperCase();
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

            // 1. AI Teams Selling Logic
            for (const teamId of aiTeamIds) {
                await processAISellingLogic(teamId, log);
            }

            // 2. Pre-fetch listed players
            const allListed = await prisma.player.findMany({
                where: { transferStatus: 'LISTED', isRetired: false },
                include: { team: true }
            });
            const availablePlayers = allListed.filter(p => p.teamId !== null);

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

async function processAISellingLogic(teamId: string, log: (msg: string) => void) {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });
    if (!team) return;

    let listedCount = 0;
    for (const player of team.players) {
        if (player.transferStatus === 'LISTED') continue;

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
            const depth = team.players.filter(p => p.naturalPosition === player.naturalPosition).length;
            if (depth > 2) shouldList = true; // Excess depth
        }

        if (shouldList) {
            const value = await evaluateMarketValue(player);
            await prisma.player.update({
                where: { id: player.id },
                data: { transferStatus: 'LISTED', askingPrice: value }
            });
            log(`[AI Market] ${team.name} listed ${player.name} (Age ${player.age}, Power ${playerPower.toFixed(1)}) for $${value.toLocaleString()}`);
            listedCount++;
        }
    }
    
    if (listedCount > 0) {
        log(`[AI Market] ${team.name} listed ${listedCount} total players`);
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

    const maxBudget = isTopTier ? team.balance : team.balance * 0.8;

    // Fixed filter with safe season check
    const targets = allAvailable.filter(lp =>
        lp.player.teamId !== teamId &&
        (lp.player.lastTransferredSeason ?? -1) < currentSeason &&
        (lp.player.askingPrice || 0) <= maxBudget
    );

    if (targets.length === 0) return;

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

        const sortedPreferred = [...preferredPool].sort((a, b) => {
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
            log(`[AI Market] ${team.name} (Top 1-5) bid for ${t.player.name} (${source}, Pop:${t.player.popularity || 50}, RankTop3:${rankingTop3Ids.has(t.player.id) ? 'Y' : 'N'}): ${res.success ? 'Success' : res.message}`);
        }
    } else {
        // All non-top teams: evaluate every position in current game data
        const positionToTeamPowers = new Map<string, number[]>();
        for (const p of team.players) {
            const pos = getPositionKey(p.naturalPosition);
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
            ...targets.map(t => getPositionKey(t.player.naturalPosition)),
        ]);

        const positionPriority = Array.from(allPositions).map(pos => {
            const powers = positionToTeamPowers.get(pos) || [];
            const avgPower = powers.length > 0
                ? powers.reduce((sum, p) => sum + p, 0) / powers.length
                : 0;
            return { pos, avgPower, hasNoDepth: powers.length === 0 };
        }).sort((a, b) => {
            if (a.hasNoDepth !== b.hasNoDepth) return a.hasNoDepth ? -1 : 1;
            return a.avgPower - b.avgPower;
        });

        for (const { pos, avgPower, hasNoDepth } of positionPriority) {
            const posTargets = targets.filter(lp => {
                const targetPos = getPositionKey(lp.player.naturalPosition);
                return targetPos === pos && lp.power > avgPower;
            });

            if (posTargets.length > 0) {
                const sortedTargets = [...posTargets].sort((a, b) => b.power - a.power);
                const pool = sortedTargets.slice(0, Math.min(3, sortedTargets.length));
                const t = pool[Math.floor(Math.random() * pool.length)];
                const isFreeAgent = !t.player.teamId;
                const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
                const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
                log(`[AI Market] ${team.name} bid for ${t.player.name} (${pos}, ${source}, P:${t.power.toFixed(1)} > TeamAvg:${avgPower.toFixed(1)}, NoDepth:${hasNoDepth ? 'Y' : 'N'}): ${res.success ? 'Success' : res.message}`);
                break;
            }
        }
    }
}
