import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';

/**
 * API for managing incoming bids (Accept/Reject/Negotiate)
 * Used by team receiving the bid offer
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bidId, action, counterAmount } = body;

        if (!bidId || !action) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Get the bid with all related data
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            include: {
                player: true,
                fromTeam: true,
                toTeam: true
            }
        });

        if (!bid) {
            return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
        }

        if (bid.status !== 'PENDING') {
            return NextResponse.json({ error: 'Bid is no longer pending' }, { status: 400 });
        }

        const settings = await getGameTime();
        const currentDate = settings.currentDate;

        if (action === 'ACCEPT') {
            const existingAccepted = await prisma.bid.findFirst({
                where: {
                    playerId: bid.playerId,
                    status: 'ACCEPTED',
                    id: { not: bidId },
                    windowEnds: { gte: currentDate }
                }
            });

            if (existingAccepted) {
                return NextResponse.json({
                    error: `${bid.player.name} already has an agreed transfer and cannot accept another offer.`
                }, { status: 400 });
            }

            await prisma.$transaction(async (tx) => {
                await tx.bid.update({
                    where: { id: bidId },
                    data: { status: 'ACCEPTED' }
                });

                await tx.bid.updateMany({
                    where: {
                        playerId: bid.playerId,
                        id: { not: bidId },
                        status: { in: ['PENDING', 'HIJACKED'] }
                    },
                    data: { status: 'REJECTED' }
                });

                await tx.player.update({
                    where: { id: bid.playerId },
                    data: {
                        transferStatus: 'NOT_LISTED',
                        askingPrice: null
                    }
                });

                await tx.news.create({
                    data: {
                        title: `Bid Accepted: ${bid.player.name}`,
                        content: `${bid.toTeam?.name || 'The club'} has accepted ${bid.fromTeam.name}'s bid of $${bid.amount.toLocaleString()} for ${bid.player.name}. The transfer will be completed when the window closes.`,
                        date: currentDate,
                        teamId: bid.toTeamId,
                        type: 'TRANSFER'
                    }
                });
            });

            return NextResponse.json({
                success: true,
                message: `Bid accepted. ${bid.player.name} will transfer to ${bid.fromTeam.name} when the window closes.`
            });
        } else if (action === 'REJECT') {
            await prisma.$transaction(async (tx) => {
                // Reject the bid
                await tx.bid.update({
                    where: { id: bidId },
                    data: { status: 'REJECTED' }
                });

                if (!bid.isFreeAgent && bid.amount > 0) {
                    await tx.team.update({
                        where: { id: bid.fromTeamId },
                        data: { balance: { increment: bid.amount } }
                    });

                    await tx.financialEvent.create({
                        data: {
                            teamId: bid.fromTeamId,
                            type: 'OTHER',
                            amount: bid.amount,
                            description: `Transfer reserve released for ${bid.player.name}: offer rejected by selling club`,
                            date: currentDate
                        }
                    });
                }

                // Create news event
                await tx.news.create({
                    data: {
                        title: `Bid Rejected: ${bid.player.name}`,
                        content: `${bid.toTeam?.name || 'The club'} has rejected ${bid.fromTeam.name}'s bid of $${bid.amount.toLocaleString()} for ${bid.player.name}.`,
                        date: currentDate,
                        teamId: bid.toTeamId,
                        type: 'TRANSFER'
                    }
                });
            });

            return NextResponse.json({
                success: true,
                message: `Bid rejected for ${bid.player.name}.`
            });
        } else if (action === 'NEGOTIATE') {
            // Counter-offer with higher price
            if (!counterAmount || counterAmount <= bid.amount) {
                return NextResponse.json({
                    error: 'Counter amount must be higher than current bid'
                }, { status: 400 });
            }

            // Check if bidding team has enough remaining balance to lock the additional reserve
            const fromTeam = bid.fromTeam;
            const additionalReserve = counterAmount - bid.amount;
            if (additionalReserve > 0 && fromTeam.balance < additionalReserve) {
                // AI cannot afford - auto-reject
                await prisma.$transaction(async (tx) => {
                    await tx.bid.update({
                        where: { id: bidId },
                        data: { status: 'REJECTED' }
                    });

                    if (!bid.isFreeAgent && bid.amount > 0) {
                        await tx.team.update({
                            where: { id: bid.fromTeamId },
                            data: { balance: { increment: bid.amount } }
                        });

                        await tx.financialEvent.create({
                            data: {
                                teamId: bid.fromTeamId,
                                type: 'OTHER',
                                amount: bid.amount,
                                description: `Transfer reserve released for ${bid.player.name}: counter-offer unaffordable`,
                                date: currentDate
                            }
                        });
                    }

                    await tx.news.create({
                        data: {
                            title: `Negotiation Failed: ${bid.player.name}`,
                            content: `${bid.toTeam?.name || 'The club'} requested $${counterAmount.toLocaleString()} for ${bid.player.name}, but ${fromTeam.name} cannot afford this amount. The bid has been rejected.`,
                            date: currentDate,
                            teamId: bid.toTeamId,
                            type: 'TRANSFER'
                        }
                    });
                });

                return NextResponse.json({
                    success: false,
                    message: `${fromTeam.name} cannot afford $${counterAmount.toLocaleString()}. Bid rejected.`,
                    aiRejected: true
                });
            }

            await prisma.$transaction(async (tx) => {
                if (!bid.isFreeAgent && additionalReserve > 0) {
                    const lockResult = await tx.team.updateMany({
                        where: {
                            id: bid.fromTeamId,
                            balance: { gte: additionalReserve }
                        },
                        data: { balance: { decrement: additionalReserve } }
                    });

                    if (lockResult.count === 0) {
                        throw new Error('Failed to lock additional transfer reserve for counter-offer.');
                    }

                    await tx.financialEvent.create({
                        data: {
                            teamId: bid.fromTeamId,
                            type: 'PLAYER_BOUGHT',
                            amount: -additionalReserve,
                            description: `Additional transfer reserve locked for ${bid.player.name} (counter-offer accepted)`,
                            date: currentDate
                        }
                    });
                }

                // AI team has enough money - they will accept the counter-offer
                // Update bid amount and keep as PENDING
                await tx.bid.update({
                    where: { id: bidId },
                    data: {
                        amount: counterAmount,
                        status: 'PENDING' // Keep pending so it goes through normal transfer process
                    }
                });

                // Create news event
                await tx.news.create({
                    data: {
                        title: `Counter-Offer Accepted: ${bid.player.name}`,
                        content: `${fromTeam.name} has accepted the counter-offer of $${counterAmount.toLocaleString()} for ${bid.player.name}. The transfer will proceed when the window closes.`,
                        date: currentDate,
                        teamId: bid.toTeamId,
                        type: 'TRANSFER'
                    }
                });
            });

            return NextResponse.json({
                success: true,
                message: `${fromTeam.name} accepted your counter-offer of $${counterAmount.toLocaleString()}!`,
                newAmount: counterAmount
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error managing bid:', error);
        return NextResponse.json({
            error: 'Internal server error while managing bid'
        }, { status: 500 });
    }
}
