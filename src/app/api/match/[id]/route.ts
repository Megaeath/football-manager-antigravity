import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function calculateAdjustedDisplayRating(ps: any, match: any): number {
    // Players who did not play should not be performance-rated
    if ((ps.minutes || 0) <= 0) return 6.0;

    let rating = 6.0;
    const isGoalkeeper = ps.player?.naturalPosition === 'GK';
    const isDefender = ['DC', 'DR', 'DL', 'DMC', 'DMR', 'DML'].includes(ps.player?.naturalPosition);

    const teamGoalsFor = ps.teamId === match.homeTeamId ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
    const teamGoalsAgainst = ps.teamId === match.homeTeamId ? (match.awayScore ?? 0) : (match.homeScore ?? 0);
    const goalDiff = teamGoalsFor - teamGoalsAgainst;

    rating += (ps.goals || 0) * 1.2;
    rating += (ps.assists || 0) * 0.7;
    rating += (ps.saves || 0) * (isGoalkeeper ? 0.15 : 0.2);
    rating += (ps.tacklesWon || 0) * 0.3;
    rating += (ps.passesCompleted || 0) * 0.01;
    rating += (ps.dribblesWon || 0) * 0.2;

    rating -= ((ps.shots || 0) - (ps.shotsOnTarget || 0)) * 0.1;
    rating -= ((ps.tacklesAttempted || 0) - (ps.tacklesWon || 0)) * 0.1;
    rating -= (ps.yellowCards || 0) * 0.5;
    rating -= (ps.redCards || 0) * 2.0;
    rating -= (ps.fouls || 0) * 0.1;

    if (goalDiff < 0) rating -= Math.min(2.5, Math.abs(goalDiff) * 0.35);
    else if (goalDiff > 0) rating += Math.min(0.8, goalDiff * 0.2);

    if (teamGoalsAgainst > 0) {
        if (isGoalkeeper) rating -= teamGoalsAgainst * 0.45;
        else if (isDefender) rating -= teamGoalsAgainst * 0.22;
        else rating -= Math.max(0, teamGoalsAgainst - 2) * 0.08;
    } else {
        if (isGoalkeeper) rating += 0.8;
        else if (isDefender) rating += 0.5;
    }

    let cap = 10;
    if (teamGoalsAgainst >= 10) cap = isGoalkeeper || isDefender ? 5.5 : 7.0;
    else if (teamGoalsAgainst >= 6) cap = isGoalkeeper || isDefender ? 6.5 : 8.0;

    return Math.max(1, Math.min(cap, Math.round(rating * 10) / 10));
}

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
                        player: { select: { name: true, naturalPosition: true, tacticalPosition: true } }
                    }
                }
            }
        });

        // Fetch player names for events
        const eventsWithPlayers = await Promise.all(
            (match?.events || []).map(async (event: any) => {
                if (event.playerId) {
                    const player = await prisma.player.findUnique({
                        where: { id: event.playerId },
                        select: { name: true }
                    });
                    return { ...event, playerName: player?.name || 'Unknown' };
                }
                return event;
            })
        );

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Format the response to match what MatchPage expects
        const formattedStats: Record<string, any> = {};
        match.playerStats.forEach((ps: any) => {
            const adjustedRating = calculateAdjustedDisplayRating(ps, match);
            formattedStats[ps.playerId] = {
                playerId: ps.playerId,
                name: ps.player.name,
                teamId: ps.teamId,
                position: ps.player.naturalPosition,
                               tacticalPosition: ps.player.tacticalPosition ?? null,
                rating: adjustedRating,
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
                defensiveThirdTouches: ps.defensiveThirdTouches || 0,
                middleThirdTouches: ps.middleThirdTouches || 0,
                attackingThirdTouches: ps.attackingThirdTouches || 0,
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
            homeTeam: (match as any).homeTeam,
            awayTeam: (match as any).awayTeam,
            isPlayed: match.isPlayed,
            teamStats: mergedTeamStats,
            events: eventsWithPlayers,
            playerStats: formattedStats,
            motmPlayerId: (match as any).motmPlayerId
        };

        return NextResponse.json(result);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch match details', details: e.message }, { status: 500 });
    }
}
