import prisma from '@/lib/prisma';
import type { PlayerAttributes } from '@/lib/engine/types';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { applyMarketValuePowerBands } from '@/lib/engine/financial';

export async function GET() {
    try {
        const players = await prisma.player.findMany({
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        reputation: true
                    }
                },
                matchStats: {
                    select: {
                        rating: true
                    }
                }
            }
        });

        // Debug: Check transferStatus values
        const statusCheck = players.reduce((acc, p) => {
            acc[p.transferStatus] = (acc[p.transferStatus] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log('[Players API] Transfer Status Distribution:', statusCheck);

        // Map to include market value and contract info
        const result = players.map(player => {
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

            // Calculate average rating from match stats
            const avgRating = player.matchStats.length > 0
                ? Number((player.matchStats.reduce((sum, stat) => sum + stat.rating, 0) / player.matchStats.length).toFixed(2))
                : 0;

            // Calculate market value with multiple factors: power, age, popularity, club reputation, form
            const basePrice = power * power * 1000;
            const ageMultiplier = player.age <= 25 ? 1.2 : player.age >= 32 ? 0.6 : 1.0;

            const playerPopularityMultiplier = 0.8 + (player.popularity / 100) * 1.0;
            const clubReputationMultiplier = 0.7 + ((player.team?.reputation || 50) / 100) * 0.8;

            const formMultiplier = 0.5 + (avgRating / 10) * 1.0;

            let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
            marketValue = applyMarketValuePowerBands(marketValue, power);

            return {
                id: player.id,
                name: player.name,
                age: player.age,
                position: player.naturalPosition,
                power,
                avgRating,
                marketValue,
                popularity: player.popularity,
                contractEndWeek: player.contractEndWeek,
                teamId: player.teamId,
                jerseyNumber: player.jerseyNumber ?? null,
                teamName: player.team?.name || 'Unknown',
                teamReputation: player.team?.reputation || 50,
                transferStatus: player.transferStatus || 'NOT_LISTED', // Ensure it's always set
                askingPrice: player.askingPrice || null,
                isRetired: player.isRetired || false, // NEW: Add retired status
                handling: player.handling,
                tackling: player.tackling,
                passing: player.passing,
                shooting: player.shooting,
                heading: player.heading,
                dribbling: player.dribbling
            };
        });

        // Debug: Log how many listed players
        const listedCount = result.filter(p => p.transferStatus === 'LISTED').length;
        console.log(`[Players API] Total players: ${result.length}, Listed: ${listedCount}`);

        return Response.json(result);
    } catch (error) {
        console.error('Error fetching players:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
