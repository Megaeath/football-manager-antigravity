import prisma from '@/lib/prisma';
import { calculateSeasonStandings } from './seasonAwards';
import { calculatePlayerPower, toPlayerAttributes } from '../engine/playerPower';
import { evaluateMarketValue } from '../engine/financial';
import { submitBid } from '../engine/market';
import { getGameTime } from './gameTime';
import { resolveAIPlaystyleForTeam } from './aiPlaystyleService';
import type { AIPlaystyleProfile } from './aiPlaystyleProfiles';

type MarketTarget = { player: any; power: number };

// Memoization caches for session-wide calculations
const powerCache = new Map<string, number>();
const marketValueCache = new Map<string, number>();
const rankingCache = new Map<number, Set<string>>(); // Cache ranking by season

function getPlayerPowerCacheKey(player: any): string {
    return `${player.id}-${player.exp}-${player.naturalPosition}`;
}

function getMarketValueCacheKey(player: any): string {
    return `${player.id}-${player.age}-${player.popularity}`;
}

const MIN_POSITION_DEPTH = 2;
const MIN_SQUAD_SIZE = 22;
const MAX_SQUAD_SIZE = 30;
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

function getPlayerPowerValue(player: any): number {
    const key = getPlayerPowerCacheKey(player);
    if (powerCache.has(key)) {
        return powerCache.get(key)!;
    }
    
    const power = calculatePlayerPower({
        attributes: toPlayerAttributes(player),
        targetPosition: player.naturalPosition.split('_')[0],
        condition: 100,
        exp: player.exp || 0
    }).powerWithExp;
    
    powerCache.set(key, power);
    return power;
}

function getStyleTransferFitScore(player: any, style: AIPlaystyleProfile): number {
    const age = Number(player.age || 0);
    const ageInBand = age >= style.transferPolicy.preferAgeMin && age <= style.transferPolicy.preferAgeMax;
    const ageDistance = age < style.transferPolicy.preferAgeMin
        ? style.transferPolicy.preferAgeMin - age
        : age > style.transferPolicy.preferAgeMax
            ? age - style.transferPolicy.preferAgeMax
            : 0;

    const ageScore = ageInBand ? 14 : Math.max(0, 12 - ageDistance * 2);

    const weightedAttributes = Object.entries(style.transferPolicy.attributeWeights || {}).reduce((sum, [k, w]) => {
        const value = Number(player[k] || 0);
        return sum + (value * Number(w || 0));
    }, 0);

    const riskMod = style.transferPolicy.riskBias === 'HIGH'
        ? 1.12
        : style.transferPolicy.riskBias === 'LOW'
            ? 0.94
            : 1.0;

    return (ageScore + weightedAttributes) * riskMod;
}

// Memoized version of evaluateMarketValue
async function getCachedMarketValue(player: any): Promise<number> {
    const key = getMarketValueCacheKey(player);
    if (marketValueCache.has(key)) {
        return marketValueCache.get(key)!;
    }
    
    const value = await evaluateMarketValue(player);
    marketValueCache.set(key, value);
    return value;
}

async function getTopRankingPlayerIds(currentSeason: number, log: (msg: string) => void): Promise<Set<string>> {
    // Check cache first
    if (rankingCache.has(currentSeason)) {
        log(`[AI Market] Using cached ranking for season ${currentSeason}`);
        return rankingCache.get(currentSeason)!;
    }

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
        
        // Cache the result
        rankingCache.set(currentSeason, topIds);
        
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

            // 0. Revalue existing listings based on current market conditions (BATCH UPDATE)
            const listedPlayers = await prisma.player.findMany({
                where: { transferStatus: 'LISTED', isRetired: false }
            });
            
            // Calculate new values in parallel (no DB calls yet)
            const updates = await Promise.all(
                listedPlayers.map(async (player) => ({
                    id: player.id,
                    currentValue: await getCachedMarketValue(player)
                }))
            );
            
            // Filter only players with changed prices
            const changedUpdates = updates.filter((u, i) => 
                u.currentValue !== listedPlayers[i].askingPrice
            );
            
            // Batch update in single transaction
            if (changedUpdates.length > 0) {
                await prisma.$transaction(
                    changedUpdates.map(u =>
                        prisma.player.update({
                            where: { id: u.id },
                            data: { askingPrice: u.currentValue }
                        })
                    )
                );
                log(`[AI Market] Revalued ${changedUpdates.length} listed players (batch update)`);
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

    // Only release for hard cap enforcement.
    if (team.players.length <= MAX_SQUAD_SIZE) return;

    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;

    const depthMap = buildPositionDepthMap(team.players, team.formation);

    let releasedCount = 0;
    let currentSquadSize = team.players.length;

    const candidates = team.players
        .filter((player) => {
            if (player.transferStatus === 'LISTED') return false;
            if (player.age <= 21) return false;
            if ((player.lastTransferredSeason || 0) >= currentSeason) return false;
            const playerPosition = normalizeDepthPosition(player.naturalPosition);
            const currentDepth = getPositionDepth(depthMap, playerPosition);
            return currentDepth > MIN_POSITION_DEPTH;
        })
        .map((player) => {
            const playerPower = getPlayerPowerValue(player);
            const ageScore = player.age >= 34 ? 5 : player.age >= 32 ? 4 : player.age >= 30 ? 3 : player.age >= 28 ? 2 : 1;
            const powerScore = playerPower < 45 ? 5 : playerPower < 55 ? 4 : playerPower < 62 ? 3 : playerPower < 68 ? 2 : 1;
            const wageScore = (player.weeklyWage || 0) >= 35000 ? 3 : (player.weeklyWage || 0) >= 25000 ? 2 : (player.weeklyWage || 0) >= 18000 ? 1 : 0;
            const priority = (ageScore * 100) + (powerScore * 25) + (wageScore * 10);
            return { player, playerPower, priority };
        })
        .sort((a, b) => b.priority - a.priority);

    // Collect players to release for batch update
    const playersToRelease: Array<{ player: any; playerPower: number }> = [];
    let projectedSquadSize = team.players.length;

    for (const candidate of candidates) {
        if (projectedSquadSize <= MAX_SQUAD_SIZE) break;
        if (projectedSquadSize <= MIN_SQUAD_SIZE) break;

        const player = candidate.player;
        // Don't release if already listed or in process
        if (player.transferStatus === 'LISTED') continue;

        const playerPosition = normalizeDepthPosition(player.naturalPosition);
        const currentDepth = getPositionDepth(depthMap, playerPosition);
        if (currentDepth <= MIN_POSITION_DEPTH) continue;

        playersToRelease.push({ player, playerPower: candidate.playerPower });
        projectedSquadSize--;
    }

    // Batch update: Release all selected players in one transaction
    if (playersToRelease.length > 0) {
        await prisma.$transaction(
            playersToRelease.map(({ player }) =>
                prisma.player.update({
                    where: { id: player.id },
                    data: {
                        teamId: null,
                        transferStatus: 'FREE_AGENT',
                        askingPrice: null,
                        tacticalPosition: null,
                        contractEndWeek: 0
                    }
                })
            ),

        );

        releasedCount = playersToRelease.length;
        for (const { player, playerPower } of playersToRelease) {
            log(`[AI Market] ${team.name} released ${player.name} (Age ${player.age}, Power ${playerPower.toFixed(1)}) to free agent pool for squad cap`);
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

    // Collect players to list/release/retire for batch update
    const playersToList: Array<{ player: any; playerPower: number; value: number; position: string; depth: number }> = [];
    const playersToRelease: Array<{ player: any; playerPower: number; position: string; depth: number }> = [];
    const playersToRetire: Array<{ player: any; playerPower: number; position: string; age: number }> = []; // NEW: Auto-retire
    let projectedSquad = team.players.length;

    // Group players by position to find weakest in each position
    const playersByPosition = new Map<string, Array<{ player: any; power: number; depth: number }>>();
    
    for (const player of team.players) {
        if (player.transferStatus === 'LISTED') continue;
        if ((player.lastTransferredSeason ?? -1) === currentSeason) continue;

        const playerPosition = normalizeDepthPosition(player.naturalPosition);
        const currentDepth = getPositionDepth(depthMap, playerPosition);
        const playerPower = getPlayerPowerValue(player);

        if (!playersByPosition.has(playerPosition)) {
            playersByPosition.set(playerPosition, []);
        }
        playersByPosition.get(playerPosition)!.push({ player, power: playerPower, depth: currentDepth });
    }

    // Find weakest players in each position
    const weakestPlayersByPos = new Map<string, { player: any; power: number; depth: number }>();
    for (const [pos, players] of playersByPosition.entries()) {
        const weakest = players.reduce((min, p) => p.power < min.power ? p : min, players[0]);
        weakestPlayersByPos.set(pos, weakest);
    }

    for (const player of team.players) {
        if (projectedSquad <= MIN_SQUAD_SIZE) break;
        if (player.transferStatus === 'LISTED') continue;
        if ((player.lastTransferredSeason ?? -1) === currentSeason) continue;

        const playerPosition = normalizeDepthPosition(player.naturalPosition);
        const currentDepth = getPositionDepth(depthMap, playerPosition);
        const playerPower = getPlayerPowerValue(player);

        let shouldList = false;
        let shouldRelease = false;
        let shouldRetire = false; // NEW: Auto-retire flag

        // === NEW: Auto-retire for very weak old players (power < 60, age > 31) ===
        // These players are too old and weak to continue playing professionally
        if (playerPower < 60 && player.age > 31) {
            shouldRetire = true;
        }

        // Release weak excess players for FREE (power < 55, age > 25, depth > 2)
        if (!shouldRetire && playerPower < 55 && player.age > 25 && currentDepth > 2) {
            shouldRelease = true;
        }

        // Very weak players: always list regardless of depth/age
        if (!shouldRetire && !shouldRelease && playerPower < 50) shouldList = true;

        // Very old players: always list if squad not already at minimum
        if (!shouldRetire && !shouldRelease && !shouldList && player.age > 35 && projectedSquad > MIN_SQUAD_SIZE) shouldList = true;

        // Old + below average: list
        if (!shouldRetire && !shouldRelease && !shouldList && player.age > 30 && playerPower < 72) shouldList = true;
        if (!shouldRetire && !shouldRelease && !shouldList && player.age > 33) shouldList = true;

        // Weak at excess depth
        if (!shouldRetire && !shouldRelease && !shouldList && playerPower < 62) {
            if (currentDepth > MIN_POSITION_DEPTH) shouldList = true;
        }

        // Even at minimum depth, list if notably weak (frees up wage budget)
        if (!shouldRetire && !shouldRelease && !shouldList && playerPower < 55 && currentDepth >= MIN_POSITION_DEPTH) shouldList = true;

        if (shouldRetire) {
            playersToRetire.push({ player, playerPower, position: playerPosition, age: player.age });
            projectedSquad--;
        } else if (shouldRelease) {
            playersToRelease.push({ player, playerPower, position: playerPosition, depth: currentDepth });
            projectedSquad--;
        } else if (shouldList) {
            playersToList.push({ player, playerPower, value: 0, position: playerPosition, depth: currentDepth });
            projectedSquad--;
        }
    }

    // Calculate market values in parallel (no DB calls yet)
    const playersWithValues = await Promise.all(
        playersToList.map(async (p) => ({
            ...p,
            value: await getCachedMarketValue(p.player)
        }))
    );

    // Batch update: Auto-retire players first (honorably exit)
    if (playersToRetire.length > 0) {
        await prisma.$transaction(
            playersToRetire.map(p =>
                prisma.player.update({
                    where: { id: p.player.id },
                    data: {
                        isRetired: true,
                        teamId: null,
                        transferStatus: 'NOT_LISTED',
                        askingPrice: null,
                        tacticalPosition: null,
                        contractEndWeek: 0,
                        playerRole: null,
                        attackingRolePreset: null,
                        defensiveRolePreset: null
                    }
                })
            )
        );
        for (const p of playersToRetire) {
            log(`[AI Market] ${team.name} 🏆 RETIRED: ${p.player.name} (Age ${p.age}, Power ${p.playerPower.toFixed(1)}, Pos: ${p.position}) - Honorable exit`);
        }
        log(`[AI Market] ${team.name} retired ${playersToRetire.length} players (too old and weak to continue)`);
    }

    // Batch update: Release players to free agency
    if (playersToRelease.length > 0) {
        await prisma.$transaction(
            playersToRelease.map(p =>
                prisma.player.update({
                    where: { id: p.player.id },
                    data: {
                        teamId: null,
                        transferStatus: 'FREE_AGENT',
                        askingPrice: null,
                        tacticalPosition: null,
                        contractEndWeek: 0,
                        playerRole: null,
                        attackingRolePreset: null,
                        defensiveRolePreset: null
                    }
                })
            )
        );
        for (const p of playersToRelease) {
            log(`[AI Market] ${team.name} released ${p.player.name} (Age ${p.player.age}, Power ${p.playerPower.toFixed(1)}, Pos: ${p.position}, Depth: ${p.depth}) to FREE AGENCY`);
        }
        log(`[AI Market] ${team.name} released ${playersToRelease.length} weak excess players to free agency`);
    }

    // Batch update: List players for transfer
    if (playersWithValues.length > 0) {
        await prisma.$transaction(
            playersWithValues.map(p =>
                prisma.player.update({
                    where: { id: p.player.id },
                    data: { transferStatus: 'LISTED', askingPrice: p.value }
                })
            )
        );

        for (const p of playersWithValues) {
            log(`[AI Market] ${team.name} listed ${p.player.name} (Age ${p.player.age}, Power ${p.playerPower.toFixed(1)}) for $${p.value.toLocaleString()}`);
        }
        log(`[AI Market] ${team.name} listed ${playersWithValues.length} total players`);
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

    // Collect players to list for batch update
    const playersToList: Array<{ player: any; playerPower: number; value: number }> = [];

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
            playersToList.push({ player, playerPower, value: 0 });
        }
    }

    // Calculate market values in parallel (no DB calls yet)
    const playersWithValues = await Promise.all(
        playersToList.map(async (p) => ({
            ...p,
            value: await getCachedMarketValue(p.player)
        }))
    );

    // Batch update: List all selected players in one transaction
    if (playersWithValues.length > 0) {
        await prisma.$transaction(
            playersWithValues.map(p =>
                prisma.player.update({
                    where: { id: p.player.id },
                    data: { transferStatus: 'LISTED', askingPrice: p.value }
                })
            ),

        );
        
        for (const p of playersWithValues) {
            log(`[AI Market] ${team.name} auto-listed backup ${p.player.name} (Age ${p.player.age}, Power ${p.playerPower.toFixed(1)}) for $${p.value.toLocaleString()}`);
        }
        log(`[AI Market] ${team.name} auto-listed ${playersWithValues.length} backup players for transfer market`);
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

    const style = resolveAIPlaystyleForTeam(team);

    // Teams with low balance should still be allowed to sign free agents for depth repairs.
    // Paid transfers will be constrained separately via maxBudget.
    const canDoPaidTransfers = team.balance >= 500000;
    if (!canDoPaidTransfers) {
        log(`[AI Market] ${team.name} has low balance ($${team.balance.toLocaleString()}) - free-agent only mode`);
    }

    // === SEPARATE: Free Agents vs Listed Players ===
    // Fetch free agents separately for priority handling
    const freeAgents = await prisma.player.findMany({
        where: { teamId: null, isRetired: false },
        include: { team: true }
    });

    const freeAgentIds = freeAgents.map(p => p.id);
    const freeAgentHistoryRows = freeAgentIds.length > 0
        ? await prisma.transferHistory.findMany({
            where: { playerId: { in: freeAgentIds } },
            orderBy: { date: 'desc' },
            select: { playerId: true, toTeamId: true, date: true }
        })
        : [];

    // Latest known club for each free agent (most recent transfer destination)
    const freeAgentLatestClub = new Map<string, string>();
    for (const row of freeAgentHistoryRows) {
        if (!freeAgentLatestClub.has(row.playerId)) {
            freeAgentLatestClub.set(row.playerId, row.toTeamId);
        }
    }

    const freeAgentsWithPower = freeAgents.map(p => ({
        player: p,
        power: calculatePlayerPower({
            attributes: toPlayerAttributes(p),
            targetPosition: p.naturalPosition.split('_')[0],
            condition: 100,
            exp: p.exp || 0
        }).powerWithExp
    }));

    const teamDepthMap = buildPositionDepthMap(team.players, team.formation);

    const profileBudgetUsage = Math.max(0.35, Math.min(0.95, style.transferPolicy.budgetUsage || 0.8));
    const maxBudget = canDoPaidTransfers
        ? (isTopTier ? team.balance : team.balance * profileBudgetUsage)
        : 0;

    // === SEPARATE TARGETS: Free Agents vs Paid ===
    // Free agents: No budget limit (free!)
    const freeAgentTargets = freeAgentsWithPower.filter(p =>
        (p.player.lastTransferredSeason ?? -1) < currentSeason &&
        !(freeAgentLatestClub.get(p.player.id) === teamId) // Avoid return to previous club
    );

    // Listed players: Must fit budget
    let listedTargets = listedPlayers.filter(lp =>
        lp.player.teamId !== teamId &&
        (lp.player.lastTransferredSeason ?? -1) < currentSeason &&
        (lp.player.askingPrice || 0) <= maxBudget
    );

    const requiredPositions = getRequiredPositionsForFormation(team.formation);
    const urgentPositions = requiredPositions.filter(pos => getPositionDepth(teamDepthMap, pos) < MIN_POSITION_DEPTH);
    const urgentMissingCount = requiredPositions.reduce((sum, pos) => {
        const depth = getPositionDepth(teamDepthMap, pos);
        return sum + Math.max(0, MIN_POSITION_DEPTH - depth);
    }, 0);
    const squadShortage = Math.max(0, MIN_SQUAD_SIZE - team.players.length);

    // Emergency sourcing: if urgent positions have zero market candidates,
    // allow scouting non-listed players from other teams for those positions.
    const uncoveredUrgentPositions = urgentPositions.filter((pos) => {
        const hasFreeAgent = freeAgentTargets.some(
            (p) => normalizeDepthPosition(p.player.naturalPosition) === pos
        );
        const hasListed = listedTargets.some(
            (p) => normalizeDepthPosition(p.player.naturalPosition) === pos
        );
        return !hasFreeAgent && !hasListed;
    });

    if (canDoPaidTransfers && uncoveredUrgentPositions.length > 0) {
        const emergencyCandidatesRaw = await prisma.player.findMany({
            where: {
                isRetired: false,
                lastTransferredSeason: { lt: currentSeason },
                AND: [
                    { teamId: { not: null } },
                    { teamId: { not: teamId } }
                ]
            },
            include: { team: true }
        });

        const listedIdSet = new Set(listedTargets.map((t) => t.player.id));
        const emergencyCandidates = emergencyCandidatesRaw.filter((p) => {
            const pos = normalizeDepthPosition(p.naturalPosition);
            return uncoveredUrgentPositions.includes(pos) && !listedIdSet.has(p.id);
        });

        if (emergencyCandidates.length > 0) {
            const emergencyTargets = await Promise.all(
                emergencyCandidates.map(async (player) => {
                    const estimatedPrice = await getCachedMarketValue(player);
                    const power = calculatePlayerPower({
                        attributes: toPlayerAttributes(player),
                        targetPosition: player.naturalPosition.split('_')[0],
                        condition: 100,
                        exp: player.exp || 0,
                    }).powerWithExp;

                    return {
                        player: {
                            ...player,
                            askingPrice: estimatedPrice,
                            transferStatus: player.transferStatus || 'NOT_LISTED',
                        },
                        power,
                    };
                })
            );

            listedTargets = [...listedTargets, ...emergencyTargets.filter((t) => (t.player.askingPrice || 0) <= maxBudget)];
            log(`[AI Market] ${team.name} emergency scout added ${emergencyTargets.length} candidates for urgent positions: ${uncoveredUrgentPositions.join('/')}`);
        } else {
            log(`[AI Market] ${team.name} no emergency candidates found for urgent positions: ${uncoveredUrgentPositions.join('/')}`);
        }
    }

    // Keep roster in 22-30 range unless there is urgent structural shortage.
    if (team.players.length >= MAX_SQUAD_SIZE && urgentMissingCount === 0) {
        log(`[AI Market] ${team.name} skipped buying (squad at cap ${team.players.length}/${MAX_SQUAD_SIZE})`);
        return;
    }

    const bidsToMake = Math.max(1, Math.min(4, Math.max(squadShortage, urgentMissingCount, urgentPositions.length > 0 ? 1 : 0)));
    let bidsPlaced = 0;

    // === PRIORITY 1: Sign talented FREE AGENTS first (no cost!) ===
    // Filter for high-power free agents (power >= 65 is decent)
    const talentedFreeAgents = freeAgentTargets.filter(p => p.power >= 65);
    
    if (talentedFreeAgents.length > 0) {
        // Sort by power (highest first)
        const sortedTalent = [...talentedFreeAgents].sort((a, b) => b.power - a.power);
        
        for (const t of sortedTalent) {
            if (bidsPlaced >= bidsToMake) break;
            if ((team.players.length + bidsPlaced) >= MAX_SQUAD_SIZE) break;

            const targetPos = normalizeDepthPosition(t.player.naturalPosition);
            
            // Prioritize urgent positions, but take any talent if no urgent need
            if (urgentPositions.length > 0 && !urgentPositions.includes(targetPos)) {
                continue;
            }

            const res = await submitBid(t.player.id, teamId, 0, 0, true); // Free agent!
            log(`[AI Market] ${team.name} ⭐ SIGNED TALENT (FREE): ${t.player.name} (Power: ${t.power.toFixed(1)}, Pos: ${targetPos})`);

            if (res.success) {
                teamDepthMap.set(targetPos, getPositionDepth(teamDepthMap, targetPos) + 1);
                bidsPlaced++;
            }
        }
    }

    // === PRIORITY 2: Fill urgent positions with remaining free agents ===
    if (bidsPlaced < bidsToMake && urgentPositions.length > 0) {
        const urgentFreeAgents = freeAgentTargets.filter(p =>
            urgentPositions.includes(normalizeDepthPosition(p.player.naturalPosition))
        );

        for (const t of urgentFreeAgents) {
            if (bidsPlaced >= bidsToMake) break;
            if ((team.players.length + bidsPlaced) >= MAX_SQUAD_SIZE) break;

            const targetPos = normalizeDepthPosition(t.player.naturalPosition);
            const res = await submitBid(t.player.id, teamId, 0, 0, true);
            log(`[AI Market] ${team.name} 🆓 FREE: ${t.player.name} (Pos: ${targetPos}, Power: ${t.power.toFixed(1)})`);

            if (res.success) {
                teamDepthMap.set(targetPos, getPositionDepth(teamDepthMap, targetPos) + 1);
                bidsPlaced++;
            }
        }
    }

    // === PRIORITY 3: Buy listed players if still need depth ===
    if (bidsPlaced < bidsToMake) {
        const remainingBids = bidsToMake - bidsPlaced;
        
        if (isTopTier) {
            // Title contenders: prioritize famous + in-form + Top 3 ranking players
            const rankedTargets = listedTargets.filter(lp => rankingTop3Ids.has(lp.player.id));
            const qualityTargets = listedTargets.filter(lp =>
                (lp.player.popularity || 0) >= 70 ||
                (lp.player.avgRating || 0) >= 7.0 ||
                (lp.player.motmCount || 0) >= 2 ||
                (lp.player.goals || 0) >= 5 ||
                (lp.player.assists || 0) >= 5
            );

            const preferredPool = rankedTargets.length > 0
                ? rankedTargets
                : (qualityTargets.length > 0 ? qualityTargets : listedTargets);

            const urgentPool = urgentPositions.length > 0
                ? preferredPool.filter(lp => urgentPositions.includes(normalizeDepthPosition(lp.player.naturalPosition)))
                : preferredPool;

            const finalPool = urgentPool.length > 0 ? urgentPool : preferredPool;

            const sortedPreferred = [...finalPool].sort((a, b) => {
                const styleScoreA = getStyleTransferFitScore(a.player, style);
                const styleScoreB = getStyleTransferFitScore(b.player, style);
                const scoreA = (rankingTop3Ids.has(a.player.id) ? 100 : 0)
                    + Number(a.player.popularity || 0)
                    + Number(a.player.avgRating || 0) * 10
                    + Number(a.player.motmCount || 0) * 3
                    + Number(a.player.goals || 0)
                    + Number(a.player.assists || 0)
                    + styleScoreA;
                const scoreB = (rankingTop3Ids.has(b.player.id) ? 100 : 0)
                    + Number(b.player.popularity || 0)
                    + Number(b.player.avgRating || 0) * 10
                    + Number(b.player.motmCount || 0) * 3
                    + Number(b.player.goals || 0)
                    + Number(b.player.assists || 0)
                    + styleScoreB;
                return scoreB - scoreA;
            });

            const shortList = sortedPreferred.slice(0, Math.min(8, sortedPreferred.length));
            if (shortList.length > 0) {
                for (const t of shortList) {
                    if (bidsPlaced >= bidsToMake) break;
                    if ((team.players.length + bidsPlaced) >= MAX_SQUAD_SIZE) break;

                    const targetPos = normalizeDepthPosition(t.player.naturalPosition);
                    if (urgentPositions.length > 0 && !urgentPositions.includes(targetPos)) {
                        continue;
                    }

                    const isFreeAgent = !t.player.teamId;
                    const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
                    const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
                    const urgentNote = urgentPositions.length > 0 ? `, Urgent:${urgentPositions.join('/')}` : '';
                    log(`[AI Market] ${team.name} (Top 1-5) bid for ${t.player.name} (${source}, Pop:${t.player.popularity || 50}, RankTop3:${rankingTop3Ids.has(t.player.id) ? 'Y' : 'N'}${urgentNote}): ${res.success ? 'Success' : res.message}`);

                    if (res.success) {
                        teamDepthMap.set(targetPos, getPositionDepth(teamDepthMap, targetPos) + 1);
                        bidsPlaced++;
                    }
                }
            }
        } else {
            // All non-top teams: Evaluate positions and buy strategically
            // Priority: 1) Urgent positions (< 2 players), 2) Upgrades (higher power than average)

            const positionToTeamPowers = new Map<string, { powers: number[]; avgPower: number }>();
            for (const p of team.players) {
                const pos = normalizeDepthPosition(p.naturalPosition);
                const pwr = calculatePlayerPower({
                    attributes: toPlayerAttributes(p),
                    targetPosition: p.naturalPosition.split('_')[0],
                    condition: 100,
                    exp: p.exp || 0,
                }).powerWithExp;

                if (!positionToTeamPowers.has(pos)) {
                    positionToTeamPowers.set(pos, { powers: [], avgPower: 0 });
                }
                positionToTeamPowers.get(pos)!.powers.push(pwr);
            }

            // Calculate average power for each position
            for (const [pos, data] of positionToTeamPowers.entries()) {
                data.avgPower = data.powers.length > 0
                    ? data.powers.reduce((sum, p) => sum + p, 0) / data.powers.length
                    : 0;
            }

            const allPositions = new Set<string>([
                ...Array.from(positionToTeamPowers.keys()),
                ...listedTargets.map(t => normalizeDepthPosition(t.player.naturalPosition)),
            ]);

            // Build position priority list
            const positionPriority = Array.from(allPositions).map(pos => {
                const posData = positionToTeamPowers.get(pos) || { powers: [], avgPower: 0 };
                const depth = getPositionDepth(teamDepthMap, pos);
                const isUrgent = depth < MIN_POSITION_DEPTH;
                const hasNoDepth = posData.powers.length === 0;

                return {
                    pos,
                    avgPower: posData.avgPower,
                    depth,
                    hasNoDepth,
                    isUrgent,
                    powers: posData.powers
                };
            }).sort((a, b) => {
                // Priority 1: Urgent positions (depth < 2)
                if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
                // Priority 2: Positions with no players
                if (a.hasNoDepth !== b.hasNoDepth) return a.hasNoDepth ? -1 : 1;
                // Priority 3: Lower depth first
                if (a.depth !== b.depth) return a.depth - b.depth;
                // Priority 4: Lower average power first (weaker positions need upgrades)
                return a.avgPower - b.avgPower;
            });

            // Determine budget based on urgency
            const urgentPriorityPositions = positionPriority.filter(p => p.isUrgent);
            const hasUrgentNeed = urgentPriorityPositions.length > 0;

            // Budget: 90% for urgent needs, otherwise follow profile
            const effectiveMaxBudget = hasUrgentNeed
                ? team.balance * 0.90
                : team.balance * profileBudgetUsage;

            for (const { pos, avgPower, hasNoDepth, depth, isUrgent, powers } of positionPriority) {
                if (bidsPlaced >= bidsToMake) break;
                if ((team.players.length + bidsPlaced) >= MAX_SQUAD_SIZE && !isUrgent) break;

                // Filter targets for this position
                const posTargets = listedTargets.filter(lp => {
                    const targetPos = getPositionKey(lp.player.naturalPosition);
                    const normalizedTargetPos = normalizeDepthPosition(targetPos);
                    if (normalizedTargetPos !== pos) return false;

                    // Urgent positions: accept any available player
                    if (isUrgent || hasNoDepth) return true;

                    // Non-urgent (upgrade): Must have higher power than team average for this position
                    // This ensures we only buy upgrades, not lateral moves
                    return lp.power > avgPower;
                });

                if (posTargets.length > 0) {
                    // Sort by power + style fit, prioritize higher power
                    const sortedTargets = [...posTargets].sort((a, b) => {
                        const scoreA = a.power * 1.2 + getStyleTransferFitScore(a.player, style) * 0.3;
                        const scoreB = b.power * 1.2 + getStyleTransferFitScore(b.player, style) * 0.3;
                        return scoreB - scoreA;
                    });

                    // Take top 3 candidates
                    const pool = sortedTargets.slice(0, Math.min(3, sortedTargets.length));

                    // Check if we can afford any of them
                    const affordableTargets = pool.filter(t => {
                        const price = t.player.askingPrice || 0;
                        return price <= effectiveMaxBudget;
                    });

                    if (affordableTargets.length === 0) {
                        // Can't afford any upgrade for this position
                        // If urgent, log warning; if not urgent, skip silently (save money for next round)
                        if (isUrgent) {
                            const cheapestPrice = pool[0]?.player.askingPrice || 0;
                            log(`[AI Market] ${team.name} [Style:${style.id}] ⚠️ URGENT: Cannot afford ${pos} upgrade. Need $${cheapestPrice.toLocaleString()}, Budget: $${effectiveMaxBudget.toLocaleString()}. Saving money for next round.`);
                        }
                        continue; // Skip this position, try next
                    }

                    // Pick random from affordable targets
                    const t = affordableTargets[Math.floor(Math.random() * affordableTargets.length)];
                    const res = await submitBid(t.player.id, teamId, t.player.askingPrice || 0, 0, false);
                    const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
                    const powerDiff = t.power - avgPower;
                    log(`[AI Market] ${team.name} [Style:${style.id}] bid for ${t.player.name} (${pos}, ${source}, P:${t.power.toFixed(1)} > TeamAvg:${avgPower.toFixed(1)} ${powerDiff > 0 ? '+' + powerDiff.toFixed(1) : powerDiff.toFixed(1)}, Depth:${depth}, Urgent:${isUrgent ? 'Y' : 'N'}): ${res.success ? 'Success' : res.message}`);

                    if (res.success) {
                        teamDepthMap.set(pos, getPositionDepth(teamDepthMap, pos) + 1);
                        bidsPlaced++;
                    }
                }
            }
        }
    }
}

/**
 * Process AI Market movements for a single team (distributed processing)
 * Called by gameTime.ts as part of daily distributed market processing
 * 
 * @param teamId - The AI team to process market movements for
 */
export async function processAIMarketForTeam(teamId: string) {
    const logCollector: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logCollector.push(msg);
    };

    try {
        const settings = await getGameTime();
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        if (!team) {
            log(`[AI Market] Team not found: ${teamId}`);
            return;
        }

        if (team.id === settings.userTeamId) {
            log(`[AI Market] Skipping user team: ${team.name}`);
            return;
        }

        log(`[AI Market] Processing team: ${team.name}`);

        // 0. Revalue existing listings (BATCH UPDATE)
        const existingListings = await prisma.player.findMany({
            where: { transferStatus: 'LISTED', isRetired: false }
        });
        
        if (existingListings.length > 0) {
            // Calculate new values in parallel
            const updates = await Promise.all(
                existingListings.map(async (player) => ({
                    id: player.id,
                    currentValue: await getCachedMarketValue(player)
                }))
            );
            
            // Filter only changed prices
            const changedUpdates = updates.filter((u, i) => 
                u.currentValue !== existingListings[i].askingPrice
            );
            
            // Batch update in single transaction
            if (changedUpdates.length > 0) {
                await prisma.$transaction(
                    changedUpdates.map(u =>
                        prisma.player.update({
                            where: { id: u.id },
                            data: { askingPrice: u.currentValue }
                        })
                    ),
        
                );
                log(`[AI Market] Revalued ${changedUpdates.length} existing listings (batch)`);
            }
        }

        // Get standings to determine if team is top tier
        const standings = team.leagueId
            ? await calculateSeasonStandings(team.leagueId, settings.currentSeason)
            : [];
        const topTeams = standings.slice(0, 5).map(s => s.id);
        const isTopTier = topTeams.includes(teamId);

        // Get ranking top 3 players for bid comparison
        const rankingTop3Ids = await getTopRankingPlayerIds(settings.currentSeason, log);

        // 0.5. Release old/weak players
        await processAIReleasingLogic(teamId, log);

        // 1. Selling logic - list surplus players
        await processAISellingLogic(teamId, log);

        // 2. Get available players on market (excluding locked bids)
        const acceptedLockedPlayerIds = new Set(
            (await prisma.bid.findMany({
                where: {
                    status: 'ACCEPTED',
                    windowEnds: { gte: settings.currentDate }
                },
                select: { playerId: true }
            })).map(b => b.playerId)
        );

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

        // 3. Buying logic - bid on suitable players
        await processAIBuyingLogic(teamId, isTopTier, playersWithPower, settings.currentSeason, rankingTop3Ids, log);

        log(`[AI Market] ✓ Team market processing complete: ${team.name}`);
    } catch (err: any) {
        log(`[AI Market] Error processing team ${teamId}: ${err.message}`);
        throw err; // Re-throw so gameTime can catch and not update timestamp
    }
}
