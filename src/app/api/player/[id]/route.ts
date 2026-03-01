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
                matchStats: {
                    include: { match: { include: { homeTeam: true, awayTeam: true } } },
                    orderBy: { match: { date: 'desc' } },
                    take: 15
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

        // Calculate career average rating from latest season or all seasons
        const latestSeasonStats = seasonStatsArray[0];
        const careerAvgRating = latestSeasonStats?.avgRating || '0.00';

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
        const basePrice = power * power * 1000; // Reduced base multiplier
        const ageMultiplier = player.age <= 25 ? 1.2 : player.age >= 32 ? 0.6 : 1.0;
        
        // Player popularity multiplier (0-100 → 0.8-1.8)
        const playerPopularityMultiplier = 0.8 + (player.popularity / 100) * 1.0;
        
        // Club reputation multiplier (0-100 → 0.7-1.5)
        const clubReputationMultiplier = 0.7 + ((player.team?.reputation || 50) / 100) * 0.8;
        
        // Form multiplier based on avgRating (0-10 → 0.5-1.5)
        const formMultiplier = 0.5 + (latestSeasonStats?.avgRating ? Math.min(parseFloat(latestSeasonStats.avgRating), 10) / 10 * 1.0 : 0.5);
        
        // Calculate final market value with all multipliers
        let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
        
        // Cap at 200 million
        marketValue = Math.min(marketValue, 200000000);

        return NextResponse.json({
            ...player,
            power,
            marketValue,
            avgRating: parseFloat(String(careerAvgRating)),
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
