import prisma from '@/lib/prisma';
import { getGameTime } from '../services/gameTime';

const getGlobalDate = async () => (await getGameTime()).currentDate;

/**
 * Calculates the base chance for a player to accept a bid based on their squad status.
 */
function getBaseAcceptanceChance(squadStatus: string): number {
    switch (squadStatus) {
        case 'ROTATION':
        case 'BACKUP':
            return 60;
        case 'KEY_PLAYER':
        case 'STAR':
            return 40;
        case 'WORLD_CLASS':
            return Math.floor(Math.random() * (20 - 10 + 1) + 10); // 10-20% chance
        default:
            return 50;
    }
}

/**
 * Submits a bid for a player from a team.
 */
export async function submitBid(
    playerId: string,
    fromTeamId: string,
    amount: number,
    signOnBonus: number = 0,
    isFreeAgent: boolean = false
) {
    const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: { team: true, bids: { where: { fromTeamId, status: 'REJECTED' }, orderBy: { amount: 'desc' }, take: 1 } }
    });

    if (!player) return { success: false, message: 'Player not found' };

    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;

    // Check if player already moved this season
    if (player.lastTransferredSeason >= currentSeason) {
        return { success: false, message: `${player.name} has already transferred this season and cannot move again until next season.` };
    }

    const fromTeam = await prisma.team.findUnique({
        where: { id: fromTeamId }
    });

    if (!fromTeam) return { success: false, message: 'Bidding team not found' };

    // Enforce budget limit
    if (amount > fromTeam.balance) {
        return { success: false, message: `Bid amount exceeds current balance ($${fromTeam.balance.toLocaleString()})` };
    }

    const currentDate = await getGlobalDate();

    // Default window ends 1 month from now
    const windowEnds = new Date(currentDate);
    windowEnds.setMonth(windowEnds.getMonth() + 1);

    if (isFreeAgent || !player.teamId) {
        // Free Agent logic
        const newBid = await prisma.bid.create({
            data: {
                playerId,
                fromTeamId,
                toTeamId: fromTeamId, // free agent, no 'toTeam' so just themselves to avoid null, though realistically might need nullable
                amount: 0,
                signOnBonus,
                isFreeAgent: true,
                status: 'PENDING',
                createdAt: currentDate,
                windowEnds
            }
        });

        // Broadcast news
        await createNewsEvent(
            `Free Agent Offer: ${fromTeam.name} has offered a contract to ${player.name}.`,
            fromTeamId
        );

        return { success: true, message: 'Contract offer submitted to Free Agent', bid: newBid };
    }

    // Normal Transfer logic
    const toTeamId = player.teamId;

    // 15% rule for previously rejected bids
    if (player.bids.length > 0) {
        const lastRejectedAmount = player.bids[0].amount;
        const requiredAmount = lastRejectedAmount * 1.15;
        if (amount < requiredAmount) {
            return {
                success: false,
                message: `Bid rejected. Must be at least 15% higher than previous rejected bid of $${lastRejectedAmount.toLocaleString()}`
            };
        }
    }

    // Checking Asking Price & Listed Status
    let acceptanceChance = getBaseAcceptanceChance(player.squadStatus);

    if (player.transferStatus === 'LISTED' && player.askingPrice) {
        if (amount >= player.askingPrice) {
            acceptanceChance = 100; // 100% if meets asking price
        } else if (amount <= player.askingPrice * 0.8) {
            // Low-ball penalty! Bids 20% lower only have 30% chance to be considered
            // Technically prompt says "30% chance of being considered" which means chance = chance * 0.3
            const randomCheck = Math.random() * 100;
            if (randomCheck > 30) {
                return { success: false, message: `The club immediately rejected the low-ball offer for ${player.name}.` };
            }
        }
    }

    // Roll for acceptance
    const acceptRoll = Math.floor(Math.random() * 100) + 1;
    if (acceptRoll > acceptanceChance) {
        // Log rejected bid
        await prisma.bid.create({
            data: { playerId, fromTeamId, toTeamId, amount, signOnBonus, status: 'REJECTED', createdAt: currentDate, windowEnds: currentDate }
        });
        return { success: false, message: `Bid of $${amount.toLocaleString()} was rejected.` };
    }

    // Accepted, create pending bid
    const newBid = await prisma.bid.create({
        data: {
            playerId,
            fromTeamId,
            toTeamId,
            amount,
            signOnBonus,
            status: 'PENDING',
            createdAt: currentDate,
            windowEnds
        }
    });

    await createNewsEvent(
        `Transfer Bid Accepted: ${fromTeam.name} had a bid of $${amount.toLocaleString()} accepted for ${player.name}. Awaiting player decision / bidding war.`,
        fromTeamId
    );

    // Simulate AI Hijack attempts
    await triggerBiddingWar(player, fromTeam, amount, newBid.id, currentDate, windowEnds);

    return { success: true, message: 'Bid accepted by club. Entered 1-month negotiation window.', bid: newBid };
}

async function triggerBiddingWar(player: any, originalTeam: any, currentAmount: number, currentBidId: string, currentDate: Date, windowEnds: Date) {
    // Only highly skilled players (e.g. STAR, WORLD_CLASS, KEY_PLAYER) trigger wars frequently
    let warChance = 0;
    if (player.squadStatus === 'WORLD_CLASS') warChance = 80;
    else if (player.squadStatus === 'STAR') warChance = 50;
    else if (player.squadStatus === 'KEY_PLAYER') warChance = 30;
    else warChance = 10;

    if (Math.random() * 100 > warChance) return;

    // Find AI teams that have the balance and need the position
    // (Simplified logic: grab 1-3 random AI teams with enough money)
    const numHijackers = Math.floor(Math.random() * 3) + 1;
    const requiredAmount = currentAmount * 1.2; // 20% higher bid

    const potentialTeams = await prisma.team.findMany({
        where: { id: { notIn: [originalTeam.id, player.teamId] }, balance: { gte: requiredAmount } },
        take: numHijackers * 3 // grab more than we need then filter in code
    });

    let hijackCount = 0;
    for (const aiTeam of potentialTeams) {
        if (hijackCount >= numHijackers) break;

        // AI evaluates if it "needs" the naturalPosition
        const teamPlayersInPos = await prisma.player.count({ where: { teamId: aiTeam.id, naturalPosition: player.naturalPosition } });

        // If team has fewer than 3 players in this position, they will bid
        if (teamPlayersInPos < 3) {
            // They join the bidding war
            await prisma.bid.create({
                data: {
                    playerId: player.id,
                    fromTeamId: aiTeam.id,
                    toTeamId: player.teamId,
                    amount: requiredAmount, // counter-bid 20% higher
                    status: 'PENDING',
                    createdAt: currentDate,
                    windowEnds: new Date(windowEnds.getTime() + (30 * 24 * 60 * 60 * 1000)) // delay by 1 month approx
                }
            });
            hijackCount++;

            await createNewsEvent(
                `Bidding War! ${aiTeam.name} has hijacked the deal for ${player.name} with a bid of $${requiredAmount.toLocaleString()}!`,
                aiTeam.id
            );
        }
    }

    if (hijackCount > 0) {
        // Optionally update the original bid to reflect it's been counter-offered or hijacked
        await prisma.bid.update({
            where: { id: currentBidId },
            data: { status: 'HIJACKED' }
        });
    }
}

async function createNewsEvent(text: string, teamId: string | null = null, isGlobal: boolean = true) {
    const currentDate = await getGlobalDate();
    await prisma.news.create({
        data: {
            title: isGlobal ? 'Global Transfer News' : 'Club Transfer News',
            content: text,
            date: currentDate,
            teamId: isGlobal ? null : teamId,
            type: 'TRANSFER'
        }
    });
}

export async function processBiddingRules() {
    // Process all bids where windowEnds <= currentDate
    const currentDate = await getGlobalDate();

    const expiredPendingBids = await prisma.bid.findMany({
        where: { windowEnds: { lte: currentDate }, status: 'PENDING' },
        include: { player: true, fromTeam: true, toTeam: true }
    });

    // Group by player
    const bidsByPlayer = expiredPendingBids.reduce((acc, bid) => {
        if (!acc[bid.playerId]) acc[bid.playerId] = [];
        acc[bid.playerId].push(bid);
        return acc;
    }, {} as Record<string, typeof expiredPendingBids>);

    for (const playerId in bidsByPlayer) {
        const bids = bidsByPlayer[playerId];

        // Find highest bid / best free agent offer
        if (bids.length > 0) {
            const player = bids[0].player;
            let winningBid;

            if (bids[0].isFreeAgent) {
                // Free Agent chooses by reputation or highest sign on bonus
                winningBid = bids.sort((a, b) => {
                    const aRep = a.fromTeam.reputation;
                    const bRep = b.fromTeam.reputation;
                    if (aRep !== bRep) return bRep - aRep; // Higher repo wins
                    return b.signOnBonus - a.signOnBonus; // Tiebreaker
                })[0];
            } else {
                // Highest amount wins
                winningBid = bids.sort((a, b) => b.amount - a.amount)[0];
            }

            // Execute transfer
            await prisma.$transaction(async (tx) => {
                // Reject all other bids
                const otherBids = bids.filter(b => b.id !== winningBid.id);
                for (const b of otherBids) {
                    await tx.bid.update({ where: { id: b.id }, data: { status: 'REJECTED' } });
                }

                // Set winning bid to ACCEPTED
                await tx.bid.update({ where: { id: winningBid.id }, data: { status: 'ACCEPTED' } });

                // Transfer money if not free agent
                if (!winningBid.isFreeAgent) {
                    await tx.team.update({
                        where: { id: winningBid.fromTeamId },
                        data: { balance: { decrement: winningBid.amount } }
                    });

                    await tx.team.update({
                        where: { id: winningBid.toTeamId },
                        data: { balance: { increment: winningBid.amount } }
                    });

                    // Fin events
                    await tx.financialEvent.create({
                        data: {
                            teamId: winningBid.fromTeamId,
                            type: 'PLAYER_BOUGHT',
                            amount: -winningBid.amount,
                            description: `Bought ${player.name}`,
                            date: currentDate
                        }
                    });
                    await tx.financialEvent.create({
                        data: {
                            teamId: winningBid.toTeamId,
                            type: 'PLAYER_SOLD',
                            amount: winningBid.amount,
                            description: `Sold ${player.name}`,
                            date: currentDate
                        }
                    });
                } else if (winningBid.signOnBonus > 0) {
                    // Deduct sign on bonus
                    await tx.team.update({
                        where: { id: winningBid.fromTeamId },
                        data: { balance: { decrement: winningBid.signOnBonus } }
                    });
                    await tx.financialEvent.create({
                        data: {
                            teamId: winningBid.fromTeamId,
                            type: 'WAGE',
                            amount: -winningBid.signOnBonus,
                            description: `Sign-on bonus for ${player.name}`,
                            date: currentDate
                        }
                    });
                }

                // Move player
                await tx.player.update({
                    where: { id: playerId },
                    data: {
                        teamId: winningBid.fromTeamId,
                        transferStatus: 'NOT_LISTED',
                        askingPrice: null,
                        lastTransferredSeason: (await getGameTime()).currentSeason
                    }
                });

                // Record History
                await tx.transferHistory.create({
                    data: {
                        playerId,
                        fromTeamId: winningBid.isFreeAgent ? null : winningBid.toTeamId,
                        toTeamId: winningBid.fromTeamId,
                        season: (await getGameTime()).currentSeason,
                        date: currentDate,
                        fee: winningBid.isFreeAgent ? 0 : winningBid.amount
                    }
                });
            });

            await createNewsEvent(
                `Transfer Completed: ${player.name} has joined ${winningBid.fromTeam.name} ${winningBid.isFreeAgent ? 'on a free transfer' : `for $${winningBid.amount.toLocaleString()}`}.`,
                winningBid.fromTeam.id
            );
        }
    }
}
