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
        match.playerStats.forEach(ps => {
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
                tacklesAttempted: ps.tacklesAttempted,
                tacklesWon: ps.tacklesWon,
                yellowCards: ps.yellowCards,
                redCards: ps.redCards
            };
        });

        const result = {
            id: match.id,
            date: match.date,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeTeamName: match.homeTeam.name,
            awayTeamName: match.awayTeam.name,
            isPlayed: match.isPlayed,
            teamStats: match.stats ? JSON.parse(match.stats) : null,
            events: match.events,
            playerStats: formattedStats,
            motmPlayerId: match.motmPlayerId
        };

        return NextResponse.json(result);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch match details', details: e.message }, { status: 500 });
    }
}
