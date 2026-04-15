import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { simulateMatch2D } from '@/lib/engine/v2/match2d';
import type { PlayerState, TeamState, Position } from '@/lib/engine/types';

interface DbPlayerLite {
  id: string;
  name: string;
  jerseyNumber: number | null;
  naturalPosition: string;
  tacticalPosition: string | null;
  condition: number;
  morale: number;
  exp: number;
  handling: number;
  tackling: number;
  passing: number;
  shooting: number;
  heading: number;
  dribbling: number;
  crossing: number;
  setPieces: number;
  throw: number;
  aggression: number;
  positioning: number;
  vision: number;
  bravery: number;
  leadership: number;
  teamwork: number;
  composure: number;
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  balance: number;
}

interface DbTeamLite {
  id: string;
  name: string;
  formation: string;
  mentality: string;
  passing: string;
  tackling: string;
  attacking_focus: string;
  creative_freedom: string;
  players: DbPlayerLite[];
}

type PersistedPlayerStatLite = {
  playerId: string;
  teamId: string;
  minutes: number;
};

function mapPlayer(p: DbPlayerLite): PlayerState {
  return {
    id: p.id,
    name: p.name,
    position: (p.naturalPosition || 'MC') as Position,
    attributes: {
      handling: p.handling,
      tackling: p.tackling,
      passing: p.passing,
      shooting: p.shooting,
      heading: p.heading,
      dribbling: p.dribbling,
      crossing: p.crossing || 10,
      setPieces: p.setPieces,
      throw: p.throw || 10,
      aggression: p.aggression,
      positioning: p.positioning,
      vision: p.vision,
      bravery: p.bravery,
      leadership: p.leadership,
      teamwork: p.teamwork,
      composure: p.composure,
      pace: p.pace,
      acceleration: p.acceleration,
      stamina: p.stamina,
      strength: p.strength,
      agility: p.agility,
      balance: p.balance,
    },
    condition: p.condition ?? 100,
    morale: p.morale ?? 80,
    exp: p.exp ?? 0,
    tacticalPosition: p.tacticalPosition || p.naturalPosition || null,
    cards: { yellow: 0, red: 0 },
    stats: { goals: 0, assists: 0, tackles: 0, passes: 0 },
  };
}

function pickStartingXI(players: DbPlayerLite[], preferredStarterIds?: Set<string>): DbPlayerLite[] {
  const sorted = [...players].sort((a, b) => {
    const aPreferred = preferredStarterIds?.has(a.id) ? 1 : 0;
    const bPreferred = preferredStarterIds?.has(b.id) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const aHasTac = a.tacticalPosition ? 1 : 0;
    const bHasTac = b.tacticalPosition ? 1 : 0;
    if (aHasTac !== bHasTac) return bHasTac - aHasTac;
    const aCondition = a.condition ?? 100;
    const bCondition = b.condition ?? 100;
    if (aCondition !== bCondition) return bCondition - aCondition;

    const aPower = (a.passing + a.shooting + a.tackling + a.positioning + a.pace + a.stamina) / 6;
    const bPower = (b.passing + b.shooting + b.tackling + b.positioning + b.pace + b.stamina) / 6;
    return bPower - aPower;
  });

  return sorted.slice(0, 11);
}

function buildTeamState(team: DbTeamLite, preferredStarterIds?: Set<string>): TeamState {
  const xi = pickStartingXI(team.players || [], preferredStarterIds);

  return {
    id: team.id,
    name: team.name,
    tactics: {
      formation: team.formation || '4-4-2',
      mentality: team.mentality || 'NORMAL',
      passing: team.passing || 'MIXED',
      tackling: team.tackling || 'NORMAL',
      attacking_focus: team.attacking_focus || 'MIXED',
      creative_freedom: team.creative_freedom || 'NORMAL',
    },
    players: xi.map(mapPlayer),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const variant = searchParams.get('variant');

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        events: {
          where: {
            type: 'CARD_RED',
          },
          select: {
            minute: true,
            playerId: true,
            teamId: true,
            text: true,
          },
        },
        playerStats: {
          select: {
            playerId: true,
            teamId: true,
            minutes: true,
          },
        },
        homeTeam: {
          include: {
            players: true,
          },
        },
        awayTeam: {
          include: {
            players: true,
          },
        },
      },
    });

    if (!match || !match.homeTeam || !match.awayTeam) {
      return NextResponse.json({ error: 'Match or teams not found' }, { status: 404 });
    }

    const buildPreferredStarterIds = (teamId: string, persistedStats: PersistedPlayerStatLite[]) => {
      return new Set(
        persistedStats
          .filter((stat) => stat.teamId === teamId && (stat.minutes || 0) > 0)
          .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
          .slice(0, 11)
          .map((stat) => stat.playerId),
      );
    };

    const homePreferredStarterIds = match.isPlayed
      ? buildPreferredStarterIds(match.homeTeam.id, match.playerStats as PersistedPlayerStatLite[])
      : undefined;
    const awayPreferredStarterIds = match.isPlayed
      ? buildPreferredStarterIds(match.awayTeam.id, match.playerStats as PersistedPlayerStatLite[])
      : undefined;

    const homeTeam = buildTeamState(match.homeTeam, homePreferredStarterIds);
    const awayTeam = buildTeamState(match.awayTeam, awayPreferredStarterIds);
    const forcedDismissals = match.isPlayed
      ? match.events
          .filter((event) => !!event.playerId)
          .map((event) => ({
            playerId: event.playerId!,
            minute: event.minute,
            teamId: event.teamId,
            reason: event.text,
          }))
      : [];

    const replaySeed = variant ? `${id}:${variant}` : id;
    const start = Date.now();
    const v2 = simulateMatch2D(homeTeam, awayTeam, { seed: replaySeed, forcedDismissals });

    if (match.isPlayed) {
      v2.homeScore = match.homeScore ?? v2.homeScore;
      v2.awayScore = match.awayScore ?? v2.awayScore;

      if (match.stats) {
        try {
          const persistedStats = JSON.parse(match.stats);
          if (persistedStats?.home && persistedStats?.away) {
            v2.teamStats = {
              ...v2.teamStats,
              home: { ...v2.teamStats.home, ...persistedStats.home },
              away: { ...v2.teamStats.away, ...persistedStats.away },
            };
          }
        } catch (error) {
          console.warn('[V2 Replay API] Failed to parse persisted team stats for match:', id, error);
        }
      }
    }

    const jerseyByPlayerId = new Map<string, number>();
    [...match.homeTeam.players, ...match.awayTeam.players].forEach((p) => {
      if (typeof p.jerseyNumber === 'number') {
        jerseyByPlayerId.set(p.id, p.jerseyNumber);
      }
    });

    Object.keys(v2.playerStats || {}).forEach((playerId) => {
      const stat = v2.playerStats[playerId] as (typeof v2.playerStats)[string] & { jerseyNumber?: number | null };
      if (!stat) return;
      stat.jerseyNumber = jerseyByPlayerId.get(playerId) ?? null;
    });

    const durationMs = Date.now() - start;

    const visualEventCountByType = v2.visualEvents.reduce((acc: Record<string, number>, ev: { type: string }) => {
      acc[ev.type] = (acc[ev.type] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      matchId: id,
      replay: v2,
      telemetry: {
        durationMs,
        frameCount: v2.frames.length,
        visualEventCount: v2.visualEvents.length,
        visualEventCountByType,
        score: `${match.homeScore ?? v2.homeScore}-${match.awayScore ?? v2.awayScore}`,
        engineSummary: v2.telemetry || null,
        replaySeed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate V2 replay' },
      { status: 500 }
    );
  }
}
