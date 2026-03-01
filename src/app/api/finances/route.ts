import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

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

        // Calculate attendance: 60% base + up to 35% from reputation
        const attendanceRate = 0.60 + (reputation / 100) * 0.35;

        const settings = await prisma.globalGameSettings.findFirst();
        const currentDate = settings?.currentDate || new Date();
        const weekStart = new Date(currentDate);
        weekStart.setUTCDate(weekStart.getUTCDate() - 7);

        const seasonRewardAgg = await prisma.financialEvent.aggregate({
            where: {
                teamId,
                type: 'SEASON_REWARD',
                date: { gte: weekStart, lte: currentDate }
            },
            _sum: { amount: true }
        });
        const seasonRewards = seasonRewardAgg._sum.amount || 0;

        const transferIncomeAgg = await prisma.financialEvent.aggregate({
            where: { teamId, type: 'PLAYER_SOLD', date: { gte: weekStart, lte: currentDate } },
            _sum: { amount: true }
        });
        const playerSales = transferIncomeAgg._sum.amount || 0;

        const transferExpenseAgg = await prisma.financialEvent.aggregate({
            where: { teamId, type: 'PLAYER_BOUGHT', date: { gte: weekStart, lte: currentDate } },
            _sum: { amount: true }
        });
        const playerPurchases = transferExpenseAgg._sum.amount || 0;

        // Revenue calculation
        const sponsorship = 20000 * (1 + reputation / 100);
        const ticketSales = stadiumCapacity * attendanceRate * 10;
        const averagePopularity = team.players.length > 0
            ? team.players.reduce((sum, p) => sum + (p.popularity || 50), 0) / team.players.length
            : 50;
        const jerseySales = 500 * (averagePopularity / 100) * team.players.length;

        const totalIncome = sponsorship + ticketSales + jerseySales + seasonRewards + playerSales;
        const totalExpenses = totalWages + maintenanceCost + playerPurchases;
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

        return NextResponse.json({
            teamId: team.id,
            teamName: team.name,
            balance: team.balance,
            reputation: team.reputation,
            stadiumCapacity: team.stadiumCapacity,
            weeklyData: {
                income: totalIncome,
                expenses: totalExpenses,
                netBalance: netBalance,
                breakdown: {
                    sponsorship: Math.round(sponsorship),
                    ticketSales: Math.round(ticketSales),
                    jerseySales: Math.round(jerseySales),
                    seasonRewards: Math.round(seasonRewards),
                    playerSales: Math.round(playerSales),
                    wages: Math.round(totalWages),
                    maintenance: Math.round(maintenanceCost),
                    playerPurchases: Math.round(playerPurchases)
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
