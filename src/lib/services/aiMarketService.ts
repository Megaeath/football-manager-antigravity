import prisma from '@/lib/prisma';
import { calculateSeasonStandings } from './seasonAwards';
import { calculatePlayerPower, toPlayerAttributes } from '../engine/playerPower';
import { evaluateMarketValue } from '../engine/financial';
import { submitBid } from '../engine/market';
import { getGameTime } from './gameTime';

export async function processAIMarketMovements(logCollector?: string[]) {
    const log = (msg: string) => {
        console.log(msg);
        if (logCollector) logCollector.push(msg);
    };

    log('[AI Market] Starting monthly AI transfer movements...');
    try {
        const settings = await getGameTime();
        const leagues = await prisma.league.findMany();

        for (const league of leagues) {
            log(`[AI Market] Processing league: ${league.name}`);

            let standings;
            try {
                standings = await calculateSeasonStandings(league.id, settings.currentSeason);
            } catch (err: any) {
                log(`[AI Market] Error calculating standings: ${err.message}`);
                continue;
            }

            const topTeams = standings.slice(0, 3).map(s => s.id);
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
                await processAIBuyingLogic(teamId, isTopTier, playersWithPower, settings.currentSeason, log);
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

    for (const player of team.players) {
        if (player.transferStatus === 'LISTED') continue;

        const playerPower = calculatePlayerPower({
            attributes: toPlayerAttributes(player),
            targetPosition: player.naturalPosition.split('_')[0],
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;

        let shouldList = false;
        if (player.age > 30) shouldList = true;
        if (!shouldList && playerPower < 68) {
            const depth = team.players.filter(p => p.naturalPosition === player.naturalPosition).length;
            if (depth > 2) shouldList = true;
        }

        if (shouldList) {
            const value = await evaluateMarketValue(player);
            await prisma.player.update({
                where: { id: player.id },
                data: { transferStatus: 'LISTED', askingPrice: value }
            });
            log(`[AI Market] ${team.name} listed ${player.name} for $${value.toLocaleString()}`);
        }
    }
}

async function processAIBuyingLogic(
    teamId: string,
    isTopTier: boolean,
    listedPlayers: { player: any, power: number }[],
    currentSeason: number,
    log: (msg: string) => void
) {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: { where: { isRetired: false } } }
    });
    if (!team || team.balance < 1000000) return;

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

    const maxBudget = isTopTier ? team.balance * 0.8 : team.balance * 0.5;

    // Fixed filter with safe season check
    const targets = allAvailable.filter(lp =>
        lp.player.teamId !== teamId &&
        (lp.player.lastTransferredSeason ?? -1) < currentSeason
    );

    if (targets.length === 0) return;

    if (isTopTier) {
        const bestTargets = targets.filter(lp => lp.power > 72 && (lp.player.askingPrice || 0) <= maxBudget);
        if (bestTargets.length > 0) {
            const t = bestTargets[Math.floor(Math.random() * bestTargets.length)];
            const isFreeAgent = !t.player.teamId;
            const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
            const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
            log(`[AI Market] ${team.name} (Top) bid for ${t.player.name} (${source}, P:${t.power}): ${res.success ? 'Success' : res.message}`);
        }
    } else {
        // Fill weak positions
        const positions = ['GK', 'DC', 'MC', 'FWC'];
        for (const pos of positions) {
            const posPlayers = team.players.filter(p => p.naturalPosition.startsWith(pos));
            const bestPower = posPlayers.length > 0 ? Math.max(...posPlayers.map(p => calculatePlayerPower({ attributes: toPlayerAttributes(p), targetPosition: p.naturalPosition.split('_')[0], condition: 100, exp: p.exp || 0 }).powerWithExp)) : 0;

            if (bestPower < 70) {
                const posTargets = targets.filter(lp => lp.player.naturalPosition.startsWith(pos) && lp.power > 65 && (lp.player.askingPrice || 0) <= maxBudget);
                if (posTargets.length > 0) {
                    const t = posTargets[Math.floor(Math.random() * posTargets.length)];
                    const isFreeAgent = !t.player.teamId;
                    const res = await submitBid(t.player.id, teamId, isFreeAgent ? 0 : (t.player.askingPrice || 0), 0, isFreeAgent);
                    const source = t.player.teamId ? `${t.player.team?.name}` : 'Free Agent';
                    log(`[AI Market] ${team.name} bid for ${t.player.name} (${pos}, ${source}, P:${t.power}): ${res.success ? 'Success' : res.message}`);
                    break;
                }
            }
        }
    }
}
