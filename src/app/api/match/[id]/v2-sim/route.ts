import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { simulateMatch2D } from '@/lib/engine/v2/match2d';
import type { PlayerState, TeamState, Position } from '@/lib/engine/types';
import type { BallTransition, MatchFrame, VisualEvent } from '@/lib/engine/v2/types2d';

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
  attackingRolePreset: string | null;
  defensiveRolePreset: string | null;
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

type PersistedActionLogLite = {
  playerId: string;
  teamId: string;
  minute: number;
  snapshotMinute: number | null;
  tick: number;
  sequence: number;
  logType: string;
  actionType: string;
  result: string;
  x: number | null;
  y: number | null;
  targetPlayerId: string | null;
  metadata: string | null;
};

function safeParseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function toVisualEventType(actionType: string): VisualEvent['type'] | null {
  const normalized = String(actionType || '').toUpperCase();
  if (normalized === 'GOAL') return 'GOAL';
  if (normalized === 'SHOT' || normalized === 'SHOOT') return 'SHOT';
  if (normalized.includes('PASS')) return 'PASS';
  if (normalized === 'DRIBBLE') return 'DRIBBLE';
  if (normalized === 'TACKLE') return 'TACKLE';
  if (normalized === 'SAVE') return 'SAVE';
  if (normalized === 'CARD_RED' || normalized === 'RED_CARD') return 'RED_CARD';
  if (normalized === 'CARD_YELLOW' || normalized === 'YELLOW_CARD') return 'YELLOW_CARD';
  if (normalized === 'CORNER') return 'CORNER';
  if (normalized === 'THROW_IN') return 'THROW_IN';
  if (normalized === 'FREE_KICK' || normalized === 'FOUL') return 'FREE_KICK';
  return null;
}

function buildReplayFromPersistedLogs(params: {
  matchId: string;
  match: {
    homeTeam: DbTeamLite;
    awayTeam: DbTeamLite;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    events: Array<{ minute: number; text: string; type: string; teamId: string | null; playerId: string | null }>;
  };
  logs: PersistedActionLogLite[];
}) {
  const { matchId, match, logs } = params;
  const parsedLogs = logs.map((log) => ({ ...log, parsedMetadata: safeParseJson(log.metadata) }));
  const snapshotLogs = parsedLogs
    .filter((log) => log.logType === 'MOVEMENT' && log.actionType === 'TICK_SNAPSHOT')
    .filter((log) => String(log.parsedMetadata?.source || '') === 'V2_TICK_SNAPSHOT')
    .sort((a, b) => {
      const minuteA = Number(a.snapshotMinute ?? a.minute ?? 1);
      const minuteB = Number(b.snapshotMinute ?? b.minute ?? 1);
      if (minuteA !== minuteB) return minuteA - minuteB;
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.sequence - b.sequence;
    });

  if (snapshotLogs.length === 0) return null;

  const playerInfoById = new Map<string, { id: string; name: string; teamId: string; position: string; jerseyNumber: number | null }>();
  match.homeTeam.players.forEach((player) => {
    playerInfoById.set(player.id, {
      id: player.id,
      name: player.name,
      teamId: match.homeTeamId,
      position: player.naturalPosition,
      jerseyNumber: player.jerseyNumber ?? null,
    });
  });
  match.awayTeam.players.forEach((player) => {
    playerInfoById.set(player.id, {
      id: player.id,
      name: player.name,
      teamId: match.awayTeamId,
      position: player.naturalPosition,
      jerseyNumber: player.jerseyNumber ?? null,
    });
  });

  const actionLogsByFrame = new Map<string, typeof parsedLogs>();
  parsedLogs
    .filter((log) => !(log.logType === 'MOVEMENT' && log.actionType === 'TICK_SNAPSHOT'))
    .forEach((log) => {
      const minute = Number(log.snapshotMinute ?? log.minute ?? 1);
      const key = `${minute}:${Number(log.tick || 0)}`;
      const list = actionLogsByFrame.get(key) || [];
      list.push(log);
      actionLogsByFrame.set(key, list);
    });

  const frames: MatchFrame[] = [];
  const visualEvents: VisualEvent[] = [];
  const ballTransitions: BallTransition[] = [];
  const replayEvents: Array<{ minute: number; type: string; text: string; teamId?: string; playerId?: string }> = [];

  let previousBall = { x: 50, y: 50 };
  let previousCarrierId: string | null = null;
  let previousPossession: 'home' | 'away' = 'home';

  snapshotLogs.forEach((snapshotLog, frameIndex) => {
    const metadata = snapshotLog.parsedMetadata || {};
    const homeTeamSnapshot = Array.isArray(metadata.home_team) ? metadata.home_team as Array<Record<string, unknown>> : [];
    const awayTeamSnapshot = Array.isArray(metadata.away_team) ? metadata.away_team as Array<Record<string, unknown>> : [];

    const playerPositions: Record<string, { x: number; y: number }> = {};
    const registerPlayer = (entry: Record<string, unknown>) => {
      const playerId = typeof entry.playerId === 'string' ? entry.playerId : null;
      const x = Number(entry.x);
      const y = Number(entry.y);
      if (!playerId || !Number.isFinite(x) || !Number.isFinite(y)) return;
      playerPositions[playerId] = { x, y };
    };
    homeTeamSnapshot.forEach(registerPlayer);
    awayTeamSnapshot.forEach(registerPlayer);

    const ballX = Number.isFinite(Number(snapshotLog.x)) ? Number(snapshotLog.x) : previousBall.x;
    const ballY = Number.isFinite(Number(snapshotLog.y)) ? Number(snapshotLog.y) : previousBall.y;
    const ballPosition = { x: ballX, y: ballY };

    const carrierPlayerId = typeof metadata.carrierPlayerId === 'string' ? metadata.carrierPlayerId : null;
    const carrierInfo = carrierPlayerId ? playerInfoById.get(carrierPlayerId) : null;
    const possession: 'home' | 'away' = carrierInfo
      ? (carrierInfo.teamId === match.homeTeamId ? 'home' : 'away')
      : previousPossession;

    const frameMinuteOneBased = Number(snapshotLog.snapshotMinute ?? snapshotLog.minute ?? 1);
    const frameMinuteZeroBased = Math.max(0, frameMinuteOneBased - 1);
    const frameTick = Number(snapshotLog.tick || 0);
    const frameKey = `${frameMinuteOneBased}:${frameTick}`;
    const frameActionLogs = (actionLogsByFrame.get(frameKey) || [])
      .sort((a, b) => a.sequence - b.sequence);

    const frameEvents: VisualEvent[] = [];
    const frameTransitions: BallTransition[] = [];
    frameActionLogs.forEach((actionLog, actionIndex) => {
      const eventType = toVisualEventType(actionLog.actionType);
      if (!eventType) return;
      const actorInfo = playerInfoById.get(actionLog.playerId);
      const actorPosition = playerPositions[actionLog.playerId] || ballPosition;
      const event: VisualEvent = {
        id: `db-${frameIndex}-${actionIndex}-${eventType}`,
        type: eventType,
        minute: frameMinuteOneBased,
        tick: frameTick,
        position: { ...actorPosition },
        playerId: actionLog.playerId,
        playerName: actorInfo?.name || actionLog.playerId,
        teamId: actionLog.teamId,
        targetPlayerId: actionLog.targetPlayerId || undefined,
        metadata: {
          reason: actionLog.result,
          success: ['SUCCESS', 'GOAL'].includes(String(actionLog.result || '').toUpperCase()),
        },
      };
      frameEvents.push(event);
      visualEvents.push(event);

      const transitionFrom = previousCarrierId && playerPositions[previousCarrierId]
        ? playerPositions[previousCarrierId]
        : actorPosition;
      let transitionTo = { ...ballPosition };
      if ((eventType === 'PASS' || eventType === 'DRIBBLE') && actionLog.targetPlayerId && playerPositions[actionLog.targetPlayerId]) {
        transitionTo = { ...playerPositions[actionLog.targetPlayerId] };
      } else if (eventType === 'GOAL' || eventType === 'SHOT') {
        const isHomeTeamEvent = actionLog.teamId === match.homeTeamId;
        transitionTo = { x: isHomeTeamEvent ? 99 : 1, y: 50 };
      }

      if (eventType === 'PASS' || eventType === 'DRIBBLE' || eventType === 'GOAL' || eventType === 'SHOT' || eventType === 'SAVE') {
        const transitionType: BallTransition['type'] = eventType === 'PASS'
          ? 'PASS'
          : eventType === 'DRIBBLE'
            ? 'PASS'
            : eventType === 'SAVE'
              ? 'SAVE'
              : eventType === 'GOAL'
                ? 'GOAL'
                : 'SHOT';
        const transition: BallTransition = {
          type: transitionType,
          fromPosition: { ...transitionFrom },
          toPosition: { ...transitionTo },
          fromPlayerId: actionLog.playerId,
          toPlayerId: actionLog.targetPlayerId || undefined,
          minute: frameMinuteOneBased,
          tick: frameTick,
          success: eventType === 'GOAL' || ['SUCCESS', 'GOAL'].includes(String(actionLog.result || '').toUpperCase()),
          trajectory: [{ ...transitionFrom }, { ...transitionTo }],
          duration: 10,
          ballHeight: (eventType === 'GOAL' || eventType === 'SHOT') ? 'aerial' : 'ground',
          description: `DB replay transition (${eventType})`,
        };
        frameTransitions.push(transition);
        ballTransitions.push(transition);
      }
    });

    const frame: MatchFrame = {
      minute: frameMinuteZeroBased,
      tick: frameTick,
      ball: {
        position: { ...ballPosition },
        velocity: { dx: ballPosition.x - previousBall.x, dy: ballPosition.y - previousBall.y },
        z: 0,
        possession,
        carrier: carrierInfo
          ? ({
            id: carrierInfo.id,
            name: carrierInfo.name,
            side: possession,
          } as any)
          : null,
      },
      playerPositions,
      events: frameEvents,
      ballTransitions: frameTransitions,
    };
    frames.push(frame);

    previousBall = { ...ballPosition };
    previousCarrierId = carrierPlayerId;
    previousPossession = possession;
  });

  if (frames.length === 0) return null;

  // Ensure every player shown in snapshots can be identified by canvas layer.
  const playerStats: Record<string, any> = {};
  playerInfoById.forEach((player) => {
    playerStats[player.id] = {
      playerId: player.id,
      teamId: player.teamId,
      name: player.name,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
    };
  });

  match.events.forEach((event) => {
    replayEvents.push({
      minute: event.minute,
      type: event.type,
      text: event.text,
      teamId: event.teamId || undefined,
      playerId: event.playerId || undefined,
    });
  });

  return {
    minute: 90,
    homeScore: Number(match.homeScore || 0),
    awayScore: Number(match.awayScore || 0),
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    teamStats: {
      home: { possession: 50 },
      away: { possession: 50 },
    },
    events: replayEvents,
    actionLogs: logs,
    isFinished: true,
    playerStats,
    frames,
    visualEvents,
    ballTransitions,
    homeFormationCoordinates: {},
    awayFormationCoordinates: {},
    telemetry: {
      frameCount: frames.length,
      intentJobCounts: {},
      pressEvents: 0,
      coverEvents: 0,
      passSelection: {
        sampleCount: 0,
        avgRisk: 0,
        avgUtility: 0,
        samples: [],
      },
    },
  };
}

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
    attackingRolePreset: p.attackingRolePreset || null,
    defensiveRolePreset: p.defensiveRolePreset || null,
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

async function persistV2ActionLogs(matchId: string, actionLogs: any[]) {
  if (!actionLogs.length) return;
  try {
    const data = actionLogs.map((log: any) => ({
      matchId,
      playerId: log.playerId,
      teamId: log.teamId,
      minute: log.minute ?? 0,
      snapshotMinute: typeof log.snapshotMinute === 'number' ? log.snapshotMinute : (log.minute ?? 0),
      tick: typeof log.tick === 'number' ? log.tick : 0,
      sequence: typeof log.sequence === 'number' ? log.sequence : 0,
      logType: log.logType ?? 'ACTION',
      x: typeof log.x === 'number' ? log.x : null,
      y: typeof log.y === 'number' ? log.y : null,
      ballPosition: log.ballPosition ?? 0,
      zone: log.zone ?? 'MIDDLE',
      actionType: log.actionType ?? 'EVENT',
      trickGroup: log.trickGroup ?? null,
      trick: log.trick ?? null,
      result: log.result ?? 'SUCCESS',
      isSuccessful: log.isSuccessful ?? true,
      expectedSuccessRate: typeof log.expectedSuccessRate === 'number' ? log.expectedSuccessRate : null,
      targetPlayerId: log.targetPlayerId ?? null,
      metadata: log.metadata ?? null,
    }));
      await (prisma as any).playerActionLog.createMany({ data });
  } catch (err: any) {
    console.warn('[V2-Sim] Failed to persist V2 action logs:', err?.message?.slice(0, 120));
  }
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
            // simulateMatch2D loop minute is internal zero-based.
            minute: Math.max(0, Number(event.minute || 1) - 1),
            teamId: event.teamId,
            reason: event.text,
          }))
      : [];

    const replaySeed = variant ? `${id}:${variant}` : id;
    const start = Date.now();

    let replayMode: 'db' | 'simulated' = 'simulated';
    let v2: any = null;
    if (match.isPlayed && !variant) {
      const persistedLogs = await (prisma as any).playerActionLog.findMany({
        where: { matchId: id },
        orderBy: [{ snapshotMinute: 'asc' }, { minute: 'asc' }, { tick: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
        select: {
          playerId: true,
          teamId: true,
          minute: true,
          snapshotMinute: true,
          tick: true,
          sequence: true,
          logType: true,
          actionType: true,
          result: true,
          x: true,
          y: true,
          targetPlayerId: true,
          metadata: true,
        },
      }) as PersistedActionLogLite[];

      const replayFromDb = buildReplayFromPersistedLogs({
        matchId: id,
        match: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          events: match.events.map((event) => ({
            minute: event.minute,
            text: event.text || '',
            type: event.type || '',
            teamId: event.teamId || null,
            playerId: event.playerId || null,
          })),
        },
        logs: persistedLogs,
      });

      if (replayFromDb) {
        replayMode = 'db';
        v2 = replayFromDb;
      }
    }

    if (!v2) {
      v2 = simulateMatch2D(homeTeam, awayTeam, { seed: replaySeed, forcedDismissals });
    }

    if (match.isPlayed && replayMode === 'simulated') {
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

    // Persist V2 logs for played matches (first-time or explicit regeneration via variant).
    // Keep ACTION + compact tick snapshot rows.
    if (match.isPlayed) {
      const actionLogsToSave = (v2.actionLogs || []).filter(
        (log: { logType?: string; actionType?: string }) => {
          if (!log.logType || log.logType === 'ACTION') return true;
          if (log.logType === 'MOVEMENT' && log.actionType === 'TICK_SNAPSHOT') return true;
          return false;
        },
      );
      if (actionLogsToSave.length > 0) {
        const shouldOverwrite = !!variant; // Explicit regeneration always overwrites
        if (!shouldOverwrite) {
          // Check if V2 logs already exist for this match (x/y populated = already persisted as V2)
          const existingV2 = await (prisma as any).playerActionLog.findFirst({
            where: { matchId: id, x: { not: null } },
            select: { id: true },
          });
          if (existingV2) {
            // Already has V2 logs → skip to avoid overwrite on every page load
          } else {
            await persistV2ActionLogs(id, actionLogsToSave);
          }
        } else {
          // variant = forced regeneration → delete old and replace
          await (prisma as any).playerActionLog.deleteMany({ where: { matchId: id } });
          await persistV2ActionLogs(id, actionLogsToSave);
        }
      }
    }

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
        replayMode,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate V2 replay' },
      { status: 500 }
    );
  }
}
