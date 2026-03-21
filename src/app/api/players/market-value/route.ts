import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { applyMarketValuePowerBands } from '@/lib/engine/financial';

const prisma = new PrismaClient();

function calculatePlayerOverall(player: any): number {
    const technicalAvg = (
        (player.passing || 10) +
        (player.dribbling || 10) +
        (player.shooting || 10) +
        (player.crossing || 10) +
        (player.heading || 10) +
        (player.tackling || 10) +
        (player.vision || 10)
    ) / 7;

    const mentalAvg = (
        (player.bravery || 10) +
        (player.leadership || 10) +
        (player.positioning || 10) +
        (player.composure || 10) +
        (player.aggression || 10) +
        (player.teamwork || 10)
    ) / 6;

    const physicalAvg = (
        (player.acceleration || 10) +
        (player.pace || 10) +
        (player.strength || 10) +
        (player.stamina || 10) +
        (player.agility || 10) +
        (player.balance || 10)
    ) / 6;

    return (technicalAvg + mentalAvg + physicalAvg) / 3;
}

function calculateMarketValue(player: any): number {
    const overall = calculatePlayerOverall(player);
    const popularity = player.popularity || 50;

    // Age multiplier: decrease 10% per year after 32
    let ageMultiplier = 1;
    if (player.age >= 32) {
        ageMultiplier = Math.pow(0.9, player.age - 32);
    }

    // Formula: (overall² × popularity / 1000) × ageMultiplier × 50000
    const baseValue = (Math.pow(overall, 2) * popularity) / 1000;
    const rawMarketValue = Math.round(baseValue * ageMultiplier * 50000);

    const attrs = toPlayerAttributes({
        handling: player.handling,
        tackling: player.tackling,
        passing: player.passing,
        shooting: player.shooting,
        heading: player.heading,
        dribbling: player.dribbling,
        crossing: player.crossing,
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
        balance: player.balance
    });

    const power = calculatePlayerPower({
        attributes: attrs,
        targetPosition: (player.naturalPosition || 'GK').split('_')[0],
        condition: 100,
        exp: player.exp || 0
    }).powerWithExp;

    return applyMarketValuePowerBands(rawMarketValue, power);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');
        const teamId = searchParams.get('teamId');

        if (playerId) {
            // Get single player
            const player = await prisma.player.findUnique({
                where: { id: playerId },
                include: {
                    PlayerReputation: {
                        orderBy: { createdAt: 'desc' },
                        take: 4
                    }
                }
            });

            if (!player) {
                return NextResponse.json(
                    { error: 'Player not found' },
                    { status: 404 }
                );
            }

            const overall = calculatePlayerOverall(player);
            const marketValue = calculateMarketValue(player);

            return NextResponse.json({
                playerId: player.id,
                playerName: player.name,
                position: player.naturalPosition,
                age: player.age,
                popularity: player.popularity,
                marketValue,
                overall: Math.round(overall * 10) / 10,
                reputationHistory: player.PlayerReputation
            });
        } else if (teamId) {
            // Get all players for a team
            const team = await prisma.team.findUnique({
                where: { id: teamId },
                include: {
                    players: {
                        orderBy: { name: 'asc' }
                    }
                }
            });

            if (!team) {
                return NextResponse.json(
                    { error: 'Team not found' },
                    { status: 404 }
                );
            }

            const playersWithValues = team.players.map(player => ({
                id: player.id,
                name: player.name,
                position: player.naturalPosition,
                age: player.age,
                popularity: player.popularity,
                marketValue: calculateMarketValue(player),
                overall: Math.round(calculatePlayerOverall(player) * 10) / 10
            }));

            return NextResponse.json({
                teamId: team.id,
                teamName: team.name,
                players: playersWithValues,
                totalSquadValue: playersWithValues.reduce((sum, p) => sum + p.marketValue, 0)
            });
        } else {
            return NextResponse.json(
                { error: 'playerId or teamId is required' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Market value API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
