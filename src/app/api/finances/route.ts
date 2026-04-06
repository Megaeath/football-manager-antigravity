import { NextRequest, NextResponse } from 'next/server';
import { getDivisionFinanceMultiplier } from '@/lib/services/divisionSystem';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        if (!teamId) {
            return NextResponse.json(
                { error: 'teamId is required' },
                { status: 400 }
            );
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                players: true,
                league: { select: { level: true, name: true } },
                ClubFinance: {
                    orderBy: { createdAt: 'desc' },
                    take: 4, // Last 4 weeks
                },
                TeamReputation: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            }
        });

        if (!team) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        // Calculate current week accounting
        const totalWages = team.players.reduce((sum, p) => sum + (p.weeklyWage || 0), 0);
        const stadiumCapacity = team.stadiumCapacity || 50000;
        const maintenanceCost = stadiumCapacity * 0.5;
        const reputation = team.reputation || 50;
        const divisionMultiplier = getDivisionFinanceMultiplier(team.league?.level || 1);

        // Get training facility level and weekly fee
        const trainingFacilityLevel = team.trainingFacilityLevel || 1;
        const trainingFeeMap: Record<number, number> = {
          1: 20000, 2: 25000, 3: 30000, 4: 35000, 5: 42000,
          6: 50000, 7: 60000, 8: 75000, 9: 90000
        };
        const weeklyTrainingFee = trainingFeeMap[trainingFacilityLevel] || 20000;

        const settings = await prisma.globalGameSettings.findFirst();
        const currentDate = settings?.currentDate || new Date();
        const weekStart = new Date(currentDate);
        weekStart.setUTCDate(weekStart.getUTCDate() - 7);
        const seasonStart = new Date(Date.UTC(new Date(currentDate).getUTCFullYear(), 0, 1));

        const seasonRewardAgg = await prisma.financialEvent.aggregate({
            where: {
                teamId,
                type: 'SEASON_REWARD',
                date: { gte: weekStart, lte: currentDate }
            },
            _sum: { amount: true }
        });
        const seasonRewards = seasonRewardAgg._sum.amount || 0;

        const matchdayAgg = await prisma.financialEvent.aggregate({
            where: {
                teamId,
                type: 'MATCHDAY',
                date: { gte: weekStart, lte: currentDate }
            },
            _sum: { amount: true }
        });
        const matchdayIncome = matchdayAgg._sum.amount || 0;

        // Transfer values are shown as season-to-date (more meaningful than a strict 7-day window)
        const transferIncomeAgg = await prisma.financialEvent.aggregate({
            where: { teamId, type: 'PLAYER_SOLD', date: { gte: seasonStart, lte: currentDate } },
            _sum: { amount: true }
        });
        const playerSales = transferIncomeAgg._sum.amount || 0;

        const transferExpenseAgg = await prisma.financialEvent.aggregate({
            where: { teamId, type: 'PLAYER_BOUGHT', date: { gte: seasonStart, lte: currentDate } },
            _sum: { amount: true }
        });
        const playerPurchases = Math.abs(transferExpenseAgg._sum.amount || 0);

        // Pending transfer reservations (funds already locked in team.balance)
        const pendingBidsAgg = await prisma.bid.aggregate({
            where: {
                fromTeamId: teamId,
                status: { in: ['PENDING', 'ACCEPTED', 'HIJACKED'] },
                windowEnds: { gte: currentDate }
            },
            _sum: { amount: true }
        });
        const pendingTransferReserved = pendingBidsAgg._sum.amount || 0;

        // Revenue calculation (balanced model)
        const sponsorship = (50000 + (reputation / 100) * 150000) * divisionMultiplier;
        const ticketSales = 0; // moved to per-match MATCHDAY events
        const famousPlayers = team.players.filter((p) => (p.popularity || 0) >= 60).length;
        const averagePopularity = team.players.length > 0
            ? team.players.reduce((sum, p) => sum + (p.popularity || 50), 0) / team.players.length
            : 50;
        const jerseySales = ((famousPlayers * 8000) + (averagePopularity * 200)) * divisionMultiplier;

        const totalIncome = sponsorship + ticketSales + jerseySales + matchdayIncome + seasonRewards + playerSales;
        const totalExpenses = totalWages + maintenanceCost + playerPurchases + weeklyTrainingFee;
        const netBalance = totalIncome - totalExpenses;

        // FFP Status
        const wagePercentage = totalIncome > 0 ? (totalWages / totalIncome) * 100 : 0;
        let ffpStatus: 'healthy' | 'warning' | 'danger' | 'critical' = 'healthy';
        let ffpMessage = '';

        if (totalIncome === 0) {
            ffpStatus = 'critical';
            ffpMessage = 'No revenue generated - club is at risk!';
        } else if (wagePercentage > 90) {
            ffpStatus = 'critical';
            ffpMessage = `Critical: Wages exceed 90% of revenue (${wagePercentage.toFixed(1)}%). Immediate action required!`;
        } else if (wagePercentage > 70) {
            ffpStatus = 'danger';
            ffpMessage = `Danger: Wages are ${wagePercentage.toFixed(1)}% of revenue. Consider wage cuts.`;
        } else if (wagePercentage > 50) {
            ffpStatus = 'warning';
            ffpMessage = `Warning: Wages are ${wagePercentage.toFixed(1)}% of revenue. Monitor carefully.`;
        } else {
            ffpStatus = 'healthy';
            ffpMessage = `Healthy: Wages are ${wagePercentage.toFixed(1)}% of revenue. Stable financial position.`;
        }

        // Calculate facility upgrade information
        const FACILITY_UPGRADE_COSTS = [0, 5000000, 7500000, 15000000, 30000000, 60000000, 120000000, 240000000, 480000000];
        const nextFacilityLevel = trainingFacilityLevel < 9 ? trainingFacilityLevel + 1 : null;
        const nextUpgradeCost = nextFacilityLevel ? FACILITY_UPGRADE_COSTS[nextFacilityLevel - 1] : 0;

        return NextResponse.json({
            teamId: team.id,
            teamName: team.name,
            balance: team.balance,
            reputation: team.reputation,
            stadiumCapacity: team.stadiumCapacity,
            pendingTransferReserved,
            training: {
                facilityLevel: trainingFacilityLevel,
                weeklyFee: Math.round(weeklyTrainingFee),
                nextUpgradeCost: nextUpgradeCost,
                isMaxLevel: trainingFacilityLevel === 9
            },
            division: {
                level: team.league?.level || 1,
                name: team.league?.name || 'Division 1',
                multiplier: divisionMultiplier
            },
            weeklyData: {
                income: totalIncome,
                expenses: totalExpenses,
                netBalance: netBalance,
                breakdown: {
                    sponsorship: Math.round(sponsorship),
                    ticketSales: Math.round(ticketSales),
                    jerseySales: Math.round(jerseySales),
                    matchday: Math.round(matchdayIncome),
                    seasonRewards: Math.round(seasonRewards),
                    playerSales: Math.round(playerSales),
                    wages: Math.round(totalWages),
                    maintenance: Math.round(maintenanceCost),
                    playerPurchases: Math.round(playerPurchases),
                    trainingWeekly: Math.round(weeklyTrainingFee)
                }
            },
            ffp: {
                status: ffpStatus,
                wagePercentage: Math.round(wagePercentage),
                message: ffpMessage
            },
            history: team.ClubFinance || []
        });
    } catch (error) {
        console.error('Finances API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
