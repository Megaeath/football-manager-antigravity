import { NextRequest, NextResponse } from 'next/server';
import { getExpiringContracts, handleContractRenewal } from '@/lib/engine/financial';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const expiringPlayers = await getExpiringContracts(teamId);

        return NextResponse.json({
            teamId: team.id,
            teamName: team.name,
            expiringPlayers: expiringPlayers.map(p => {
                const attributes = toPlayerAttributes(p);
                const natPos = p.naturalPosition.split('_')[0];
                const powerResult = calculatePlayerPower({
                    attributes,
                    targetPosition: natPos,
                    naturalPosition: p.naturalPosition,
                    condition: 100,
                    exp: p.exp
                });
                return {
                    id: p.id,
                    name: p.name,
                    naturalPosition: p.naturalPosition,
                    age: p.age,
                    weeklyWage: p.weeklyWage,
                    contractEndWeek: p.contractEndWeek,
                    power: powerResult.powerWithExp
                };
            }),
            totalExpiring: expiringPlayers.length
        });
    } catch (error) {
        console.error('Contracts API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const playerId = body?.playerId;
        const weeks = body?.weeks || 104;  // Default to 2 years if not specified

        if (!playerId) {
            return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
        }

        const result = await handleContractRenewal(playerId, weeks);
        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            newWage: result.newWage,
            newEndWeek: result.newEndWeek,
            message: result.message
        });
    } catch (error) {
        console.error('Contract renewal error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
