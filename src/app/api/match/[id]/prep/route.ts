import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { MatchPrepConfig } from '@/lib/engine/types';

/**
 * GET /api/match/[id]/prep
 * Retrieve match preparation config for both teams
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        homePrepConfig: true,
        awayPrepConfig: true,
        homeTeamId: true,
        awayTeamId: true
      }
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homePrep: match.homePrepConfig ? JSON.parse(match.homePrepConfig) : null,
      awayPrep: match.awayPrepConfig ? JSON.parse(match.awayPrepConfig) : null
    });
  } catch (error: any) {
    console.error('[GET /api/match/[id]/prep] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get match prep' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/match/[id]/prep
 * Update match preparation config
 * 
 * Body: {
 *   side: 'home' | 'away',
 *   prepConfig: MatchPrepConfig
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const { side, prepConfig } = await req.json();

    if (!['home', 'away'].includes(side)) {
      return NextResponse.json(
        { error: 'Invalid side. Must be "home" or "away"' },
        { status: 400 }
      );
    }

    // Validate prepConfig structure
    if (prepConfig) {
      const config = prepConfig as MatchPrepConfig;

      // Validate neutralization (up to 3 players)
      if (config.neutralization) {
        const { targetPlayerIds, intensity } = config.neutralization;
        
        if (!Array.isArray(targetPlayerIds) || targetPlayerIds.length > 3) {
          return NextResponse.json(
            { error: 'Neutralization can target maximum 3 players' },
            { status: 400 }
          );
        }

        if (!['MODERATE', 'TIGHT'].includes(intensity)) {
          return NextResponse.json(
            { error: 'Invalid neutralization intensity' },
            { status: 400 }
          );
        }
      }

      // Validate press trap
      if (config.pressTrap) {
        const { commitment, triggerZones } = config.pressTrap;

        if (!['SAFE', 'BALANCED', 'AGGRESSIVE'].includes(commitment)) {
          return NextResponse.json(
            { error: 'Invalid press trap commitment' },
            { status: 400 }
          );
        }

        const validZones = ['DEFENSIVE', 'MIDDLE', 'ATTACKING'];
        if (!Array.isArray(triggerZones) || !triggerZones.every(z => validZones.includes(z))) {
          return NextResponse.json(
            { error: 'Invalid trigger zones' },
            { status: 400 }
          );
        }
      }

      // Validate transition rules
      if (config.transitionRules) {
        const { defenseToAttack, attackToDefense } = config.transitionRules;

        if (!['HOLD', 'QUICK', 'DIRECT'].includes(defenseToAttack)) {
          return NextResponse.json(
            { error: 'Invalid defense-to-attack transition' },
            { status: 400 }
          );
        }

        if (!['URGENT', 'CONTROLLED'].includes(attackToDefense)) {
          return NextResponse.json(
            { error: 'Invalid attack-to-defense transition' },
            { status: 400 }
          );
        }
      }
    }

    // Update match
    const fieldName = side === 'home' ? 'homePrepConfig' : 'awayPrepConfig';
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        [fieldName]: prepConfig ? JSON.stringify(prepConfig) : null
      }
    });

    return NextResponse.json({
      success: true,
      matchId: updatedMatch.id,
      prepConfig
    });
  } catch (error: any) {
    console.error('[PATCH /api/match/[id]/prep] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update match prep' },
      { status: 500 }
    );
  }
}
