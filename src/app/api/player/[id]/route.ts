import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { PlayerAttributes } from '@/lib/engine/types';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get game settings and all seasons
        const settings = await prisma.globalGameSettings.findUnique({
            where: { id: 1 }
        });
        const currentSeason = settings?.currentSeason || 1;

        const player = await prisma.player.findUnique({
            where: { id },
            include: {
                team: true,
                transferHistory: {
                    include: { fromTeam: true, toTeam: true },
                    orderBy: { date: 'desc' }
                },
                matchStats: {
                    include: { match: { select: { id: true, date: true, season: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } } },
                    orderBy: { match: { date: 'desc' } },
                    take: 100
                }
            }
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Get all seasons for this player
        const allSeasons = await prisma.playerMatchStats.findMany({
            where: { playerId: id },
            distinct: ['matchId'],
            select: {
                match: { select: { season: true } }
            }
        });

        const seasons = [...new Set(allSeasons.map(s => s.match.season))].sort((a, b) => b - a);

        // Overall average rating (same basis used for players list pricing consistency)
        const overallRatingAgg = await prisma.playerMatchStats.aggregate({
            where: { playerId: id },
            _avg: { rating: true }
        });
        const overallAvgRating = overallRatingAgg._avg.rating
            ? Number(overallRatingAgg._avg.rating.toFixed(2))
            : 0;

        // Get stats for each season
        const seasonStatsArray = await Promise.all(
            seasons.map(async (season) => {
                const stats = await prisma.playerMatchStats.aggregate({
                    where: {
                        playerId: id,
                        match: {
                            season: season,
                            isPlayed: true
                        }
                    },
                    _sum: {
                        goals: true,
                        assists: true,
                        yellowCards: true,
                        redCards: true,
                        minutes: true,
                        shots: true,
                        shotsOnTarget: true,
                        passesAttempted: true,
                        passesCompleted: true,
                        crossesAttempted: true,
                        crossesCompleted: true,
                        tacklesAttempted: true,
                        tacklesWon: true,
                        dribblesAttempted: true,
                        dribblesWon: true
                    },
                    _avg: {
                        rating: true
                    },
                    _count: {
                        id: true
                    }
                });

                return {
                    season,
                    goals: stats._sum.goals || 0,
                    assists: stats._sum.assists || 0,
                    yellowCards: stats._sum.yellowCards || 0,
                    redCards: stats._sum.redCards || 0,
                    minutes: stats._sum.minutes || 0,
                    shots: stats._sum.shots || 0,
                    shotsOnTarget: stats._sum.shotsOnTarget || 0,
                    passesAttempted: stats._sum.passesAttempted || 0,
                    passesCompleted: stats._sum.passesCompleted || 0,
                    crossesAttempted: stats._sum.crossesAttempted || 0,
                    crossesCompleted: stats._sum.crossesCompleted || 0,
                    tacklesAttempted: stats._sum.tacklesAttempted || 0,
                    tacklesWon: stats._sum.tacklesWon || 0,
                    dribblesAttempted: stats._sum.dribblesAttempted || 0,
                    dribblesWon: stats._sum.dribblesWon || 0,
                    avgRating: stats._avg.rating ? Number(stats._avg.rating).toFixed(2) : '0.00',
                    matches: stats._count.id
                };
            })
        );

        // Keep latest season stats for UI panels, but pricing uses overallAvgRating for consistency
        const latestSeasonStats = seasonStatsArray[0];

        // Calculate power (same as modal: suitability to natural position)
        const attrs: PlayerAttributes = toPlayerAttributes({
            handling: player.handling,
            tackling: player.tackling,
            passing: player.passing,
            shooting: player.shooting,
            heading: player.heading,
            dribbling: player.dribbling,
            setPieces: player.setPieces,
            throw: player.throw,
            aggression: player.aggression,
            positioning: player.positioning,
            vision: player.vision,
            bravery: player.bravery,
            leadership: player.leadership,
            teamwork: player.teamwork,
            composure: player.composure,
            pace: player.pace,
            acceleration: player.acceleration,
            stamina: player.stamina,
            strength: player.strength,
            agility: player.agility,
            balance: player.balance,
            crossing: player.crossing
        });
        const natPos = player.naturalPosition.split('_')[0];
        const power = calculatePlayerPower({
            attributes: attrs,
            targetPosition: natPos,
            condition: 100,
            exp: player.exp || 0
        }).powerWithExp;

        // Calculate market value with multiple factors: power, age, popularity, club reputation, form
        const basePrice = power * power * 1000;
        const ageMultiplier = player.age <= 25 ? 1.2 : player.age >= 32 ? 0.6 : 1.0;
        
        const playerPopularityMultiplier = 0.8 + (player.popularity / 100) * 1.0;
        const clubReputationMultiplier = 0.7 + ((player.team?.reputation || 50) / 100) * 0.8;
        
        const formMultiplier = 0.5 + (overallAvgRating / 10) * 1.0;
        
        let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
        marketValue = Math.min(marketValue, 200000000);

        return NextResponse.json({
            ...player,
            power,
            marketValue,
            avgRating: overallAvgRating,
            currentSeason,
            availableSeasons: seasons,
            seasonStats: seasonStatsArray,
            exp: player.exp || 0
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch player', details: e.message }, { status: 500 });
    }
}
