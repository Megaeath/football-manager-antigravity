import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const match = await prisma.match.findUnique({
            where: { id },
            include: {
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } },
                events: {
                    orderBy: { minute: 'asc' }
                },
                playerStats: {
                    include: {
                        player: { select: { name: true, naturalPosition: true } }
                    }
                }
            }
        });

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Format the response to match what MatchPage expects
        const formattedStats: Record<string, any> = {};
        match.playerStats.forEach((ps: any) => {
            formattedStats[ps.playerId] = {
                playerId: ps.playerId,
                name: ps.player.name,
                teamId: ps.teamId,
                position: ps.player.naturalPosition,
                rating: ps.rating,
                minutes: ps.minutes,
                goals: ps.goals,
                assists: ps.assists,
                shots: ps.shots,
                shotsOnTarget: ps.shotsOnTarget,
                passesAttempted: ps.passesAttempted,
                passesCompleted: ps.passesCompleted,
                crossesAttempted: ps.crossesAttempted,
                crossesCompleted: ps.crossesCompleted,
                tacklesAttempted: ps.tacklesAttempted,
                tacklesWon: ps.tacklesWon,
                yellowCards: ps.yellowCards,
                redCards: ps.redCards,
                fitnessEnd: ps.fitnessEnd,
                dribblesAttempted: ps.dribblesAttempted,
                dribblesWon: ps.dribblesWon,
                freeKicks: ps.freeKicks || 0,
                corners: ps.corners || 0,
                throws: ps.throws || 0
            };
        });

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
            throws: 0,
            tacklesAttempted: 0,
            tacklesWon: 0,
            dribblesAttempted: 0,
            dribblesWon: 0
        };

        const baseTeamStats = match.stats ? JSON.parse(match.stats) : null;
        const derivedTeamStats = {
            home: { ...defaultTeamStats },
            away: { ...defaultTeamStats }
        };

        match.playerStats.forEach((ps: any) => {
            const bucket = ps.teamId === match.homeTeamId ? derivedTeamStats.home : derivedTeamStats.away;
            bucket.shots += ps.shots || 0;
            bucket.shotsOnTarget += ps.shotsOnTarget || 0;
            bucket.passesAttempted += ps.passesAttempted || 0;
            bucket.passesCompleted += ps.passesCompleted || 0;
            bucket.crossesAttempted += ps.crossesAttempted || 0;
            bucket.crossesCompleted += ps.crossesCompleted || 0;
            bucket.yellowCards += ps.yellowCards || 0;
            bucket.redCards += ps.redCards || 0;
            bucket.freeKicks += ps.freeKicks || 0;
            bucket.corners += ps.corners || 0;
            bucket.throws += ps.throws || 0;
            bucket.tacklesAttempted += ps.tacklesAttempted || 0;
            bucket.tacklesWon += ps.tacklesWon || 0;
            bucket.dribblesAttempted += ps.dribblesAttempted || 0;
            bucket.dribblesWon += ps.dribblesWon || 0;
        });

        // Calculate possession based on passes completed
        const homePassesCompleted = derivedTeamStats.home.passesCompleted;
        const awayPassesCompleted = derivedTeamStats.away.passesCompleted;
        const totalPasses = homePassesCompleted + awayPassesCompleted;
        let homePossession = 50;
        if (totalPasses > 0) {
            homePossession = Math.round((homePassesCompleted / totalPasses) * 100);
        }

        const mergedTeamStats = {
            home: { ...defaultTeamStats, ...(baseTeamStats?.home ?? {}), ...derivedTeamStats.home, possession: homePossession },
            away: { ...defaultTeamStats, ...(baseTeamStats?.away ?? {}), ...derivedTeamStats.away, possession: 100 - homePossession }
        };

        const result = {
            id: match.id,
            date: match.date,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeTeamName: (match as any).homeTeam.name,
            awayTeamName: (match as any).awayTeam.name,
            isPlayed: match.isPlayed,
            teamStats: mergedTeamStats,
            events: match.events,
            playerStats: formattedStats,
            motmPlayerId: (match as any).motmPlayerId
        };

        return NextResponse.json(result);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch match details', details: e.message }, { status: 500 });
    }
}
