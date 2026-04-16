'use client';

/**
 * MatchCanvas - Main container for V2 Match Visualization
 * 
 * Renders a 2D football pitch with real-time player positions,
 * ball movement, and visual events using Konva canvas.
 * 
 * Features:
 * - Responsive 3:2 aspect ratio pitch
 * - Playback controls for match replay
 * - Smooth animations with requestAnimationFrame
 * - Multiple rendering layers (field, players, ball, events)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer } from 'react-konva';
import type { V2MatchState, MatchFrame, BallTransition } from '@/lib/engine/v2/types2d';
import { TUNING_PARAMS } from '@/lib/engine/v2/config';
import { FieldLayer } from './FieldLayer';
import { PlayersLayer } from './PlayersLayer';
import { BallLayer } from './BallLayer';
import { EventsLayer } from './EventsLayer';
import { PlaybackControls } from './PlaybackControls';
import { DebugLayer } from './DebugLayer';
import type { VisualEvent } from '@/lib/engine/v2/types2d';
import { toMasterEventCategory, type MasterEventFilterValue } from '@/lib/constants/matchEventFilters';

type XYPosition = { x: number; y: number };

function lerp(start: number, end: number, alpha: number): number {
    return start + (end - start) * alpha;
}

function interpolatePosition(
    start: { x: number; y: number },
    end: { x: number; y: number },
    alpha: number,
) {
    return {
        x: lerp(start.x, end.x, alpha),
        y: lerp(start.y, end.y, alpha),
    };
}

function clonePosition(position?: XYPosition): XYPosition | undefined {
    if (!position) return undefined;
    return { x: position.x, y: position.y };
}

function isImportantHighlight(eventType: string): boolean {
    return eventType === 'GOAL'
        || eventType === 'SHOT'
        || eventType === 'RED_CARD'
        || eventType === 'YELLOW_CARD'
        || eventType === 'INJURY'
        || eventType === 'SUBSTITUTION';
}

function findNextHighlightFrameIndex(
    highlightFrameIndexes: number[],
    fromIndexExclusive: number,
): number {
    for (const index of highlightFrameIndexes) {
        if (index > fromIndexExclusive) return index;
    }
    return -1;
}

type HighlightStoryWindow = {
    highlightIndex: number;
    startIndex: number;
    endIndex: number;
};

type FrameWindowRange = {
    startIndex: number;
    endIndex: number;
};

function createHighlightStoryWindow(highlightIndex: number, totalFrames: number, ticksPerMinute: number): HighlightStoryWindow {
    // Pre-roll: random 1-2 minutes (config-driven ticks)
    const preRollSeconds = ticksPerMinute + Math.floor(Math.random() * (ticksPerMinute + 1));
    // Post-roll: random 10-20 seconds (10-20 ticks)
    const postRollSeconds = 10 + Math.floor(Math.random() * 11);

    return {
        highlightIndex,
        startIndex: Math.max(0, highlightIndex - preRollSeconds),
        endIndex: Math.min(totalFrames - 1, highlightIndex + postRollSeconds),
    };
}

function canonicalizeAuthoritativeType(type?: string): string {
    switch (String(type || '').toUpperCase()) {
        case 'CARD_YELLOW':
            return 'YELLOW_CARD';
        case 'CARD_RED':
            return 'RED_CARD';
        case 'FOUL':
            return 'FREE_KICK';
        case 'MISS':
            return 'SHOT';
        default:
            return String(type || '').toUpperCase();
    }
}

function interpolateFrame(currentFrame: MatchFrame, nextFrame?: MatchFrame, alpha = 0): MatchFrame {
    if (!nextFrame || alpha <= 0) {
        return currentFrame;
    }

    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    const playerPositions: MatchFrame['playerPositions'] = {};
    const allPlayerIds = new Set([
        ...Object.keys(currentFrame.playerPositions || {}),
        ...Object.keys(nextFrame.playerPositions || {}),
    ]);

    allPlayerIds.forEach((playerId) => {
        const currentPosition = currentFrame.playerPositions[playerId] as XYPosition | undefined;
        const nextPosition = (nextFrame.playerPositions[playerId] as XYPosition | undefined) || currentPosition;
        if (currentPosition && nextPosition) {
            playerPositions[playerId] = interpolatePosition(currentPosition, nextPosition, clampedAlpha);
        } else if (currentPosition) {
            playerPositions[playerId] = clonePosition(currentPosition)!;
        } else if (nextPosition) {
            playerPositions[playerId] = clonePosition(nextPosition)!;
        }
    });

    const currentBallPosition = currentFrame.ball.position;
    const nextBallPosition = nextFrame.ball.position || currentBallPosition;
    const currentBallVelocity = currentFrame.ball.velocity;
    const nextBallVelocity = nextFrame.ball.velocity || currentBallVelocity;

    return {
        ...currentFrame,
        ball: {
            ...currentFrame.ball,
            position: interpolatePosition(currentBallPosition, nextBallPosition, clampedAlpha),
            velocity: {
                dx: lerp(currentBallVelocity.dx, nextBallVelocity.dx, clampedAlpha),
                dy: lerp(currentBallVelocity.dy, nextBallVelocity.dy, clampedAlpha),
            },
            z: lerp(currentFrame.ball.z, nextFrame.ball.z, clampedAlpha),
            carrier: clampedAlpha < 0.5 ? currentFrame.ball.carrier : nextFrame.ball.carrier,
            possession: clampedAlpha < 0.5 ? currentFrame.ball.possession : nextFrame.ball.possession,
        },
        playerPositions,
    };
}

interface MatchCanvasProps {
    matchData: V2MatchState;
    authoritativeEvents?: Array<{ type: string; teamId?: string | null; minute: number; playerId?: string; playerName?: string; text?: string }>;
    authoritativeRawLogs?: Array<{
        minute?: number;
        snapshotMinute?: number;
        tick?: number;
        sequence?: number;
        teamId?: string;
        playerId?: string;
        actionType?: string;
        result?: string;
        x?: number | null;
        y?: number | null;
        metadata?: any;
    }>;
    preferAuthoritativeEvents?: boolean;
    width?: number;
    height?: number;
    onFrameChange?: (payload: {
        frameIndex: number;
        minute: number;
        tick: number;
        carrierName: string;
        homeScore: number;
        awayScore: number;
        eventTypes: string[];
        eventTexts: string[];
    }) => void;
    hideOverlays?: boolean;
    hideControls?: boolean;
    showDebugLayer?: boolean;
    eventFilter?: MasterEventFilterValue;
    controlsRef?: React.MutableRefObject<MatchCanvasControls | null>;
}

export interface MatchCanvasControls {
    isPlaying: boolean;
    currentFrame: number;
    totalFrames: number;
    playbackSpeed: number;
    currentMinute: number;
    onPlayPause: () => void;
    onSeek: (frameIndex: number) => void;
    onSpeedChange: (speed: number) => void;
    onReset: () => void;
}

function actionTypesForAuthoritativeEvent(type: string): string[] {
    switch (canonicalizeAuthoritativeType(type)) {
        case 'GOAL':
            return ['GOAL'];
        case 'SHOT':
            return ['SHOT', 'SHOOT'];
        case 'PASS':
            return ['PASS', 'PASS_SHORT', 'PASS_LONG'];
        case 'DRIBBLE':
            return ['DRIBBLE'];
        case 'YELLOW_CARD':
            return ['CARD_YELLOW', 'YELLOW_CARD'];
        case 'RED_CARD':
            return ['CARD_RED', 'RED_CARD'];
        case 'FREE_KICK':
            return ['FOUL', 'FREE_KICK'];
        default:
            return [String(type || '').toUpperCase()];
    }
}

export function MatchCanvas({
    matchData,
    authoritativeEvents = [],
    authoritativeRawLogs = [],
    preferAuthoritativeEvents = false,
    width = 900,
    height = 600,
    onFrameChange,
    hideOverlays = false,
    hideControls = false,
    showDebugLayer = false,
    eventFilter = 'all',
    controlsRef,
}: MatchCanvasProps) {
    // Return an object with both canvas and controls for flexible layout
    // Default behavior: render canvas + controls in a flex column
    // When hideControls=true: only render canvas
    // This allows parent to position controls separately if needed
    // Playback state
        // Build home player ID set once from playerStats (avoids x<50 heuristic in PlayersLayer)
        const homePlayerIds = useMemo(() => {
            return new Set(
                Object.entries(matchData.playerStats)
                    .filter(([, stat]) => stat.teamId === matchData.homeTeamId)
                    .map(([id]) => id)
            );
        }, [matchData]);

    const playerIdentity = useMemo(() => {
        const playerNames: Record<string, string> = {};
        const playerNumbers: Record<string, number> = {};

        const homePlayers = Object.entries(matchData.playerStats)
            .filter(([, stat]) => stat.teamId === matchData.homeTeamId)
            .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])));

        const awayPlayers = Object.entries(matchData.playerStats)
            .filter(([, stat]) => stat.teamId === matchData.awayTeamId)
            .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])));

        homePlayers.forEach(([playerId, stat], index) => {
            playerNames[playerId] = stat?.name || playerId;
            playerNumbers[playerId] = typeof stat?.jerseyNumber === 'number' ? stat.jerseyNumber : (index + 1);
        });

        awayPlayers.forEach(([playerId, stat], index) => {
            playerNames[playerId] = stat?.name || playerId;
            playerNumbers[playerId] = typeof stat?.jerseyNumber === 'number' ? stat.jerseyNumber : (index + 1);
        });

        return { playerNames, playerNumbers };
    }, [matchData]);

        // Playback state
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(2.0); // default 2x
    const [frameBlend, setFrameBlend] = useState(0);
    const [storyWindowRange, setStoryWindowRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
    
    // Animation frame reference
    const animationRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const highlightStoryWindowRef = useRef<HighlightStoryWindow | null>(null);
    
    // Calculate frame duration based on speed
    const frameDuration = (1000 / 1) / playbackSpeed; // tick playback duration at current speed
    const ticksPerMinute = Math.max(1, Number(TUNING_PARAMS.simulationTicksPerMinute || 10));
    const strictAuthoritativeMode = preferAuthoritativeEvents;
    
    // Get current frame
    const currentFrame: MatchFrame | undefined = matchData.frames[currentFrameIndex];
    const nextFrame: MatchFrame | undefined = matchData.frames[Math.min(currentFrameIndex + 1, Math.max(0, matchData.frames.length - 1))];
    const totalFrames = matchData.frames.length;
    const highSpeedHighlightsOnly = playbackSpeed >= 15;

    const authoritativeEventsForFrame = useMemo(() => {
        const byFrame = new Map<number, Array<{ type: string; minute: number; teamId?: string | null; playerId?: string; playerName?: string; text?: string; tick?: number; logX?: number; logY?: number }>>();
        if (!matchData.frames.length || !authoritativeEvents.length) return byFrame;

        authoritativeEvents.forEach((event) => {
            if (!event || typeof event.minute !== 'number') return;
            const targetMinute = Math.max(1, Number(event.minute || 1));
            const targetActionTypes = actionTypesForAuthoritativeEvent(event.type);
            const matchedLog = authoritativeRawLogs
                .filter((log) => {
                    const snapshotMinute = typeof log.snapshotMinute === 'number'
                        ? Number(log.snapshotMinute)
                        : Number(log.minute || 0);
                    return snapshotMinute === targetMinute;
                })
                .filter((log) => targetActionTypes.includes(String(log.actionType || '').toUpperCase()))
                .filter((log) => !event.playerId || log.playerId === event.playerId)
                .filter((log) => !event.teamId || String(log.teamId || '') === String(event.teamId || ''))
                .sort((a, b) => {
                    const tickDiff = Number(a.tick || 0) - Number(b.tick || 0);
                    if (tickDiff !== 0) return tickDiff;
                    return Number(a.sequence || 0) - Number(b.sequence || 0);
                })[0];

            const frameIndex = matchedLog
                ? matchData.frames.findIndex((frame) => (
                    (Number(frame.minute || 0) + 1) === targetMinute
                    && Number(frame.tick || 0) === Number(matchedLog.tick || 0)
                ))
                : matchData.frames.findIndex((frame) => ((Number(frame.minute || 0) + 1) >= targetMinute));
            if (frameIndex < 0) return;
            const arr = byFrame.get(frameIndex) || [];
            arr.push({
                ...event,
                type: canonicalizeAuthoritativeType(event.type),
                tick: typeof matchedLog?.tick === 'number' ? matchedLog.tick : undefined,
                logX: typeof matchedLog?.x === 'number' ? matchedLog.x : undefined,
                logY: typeof matchedLog?.y === 'number' ? matchedLog.y : undefined,
            });
            byFrame.set(frameIndex, arr);
        });

        return byFrame;
    }, [authoritativeEvents, authoritativeRawLogs, matchData.frames]);

    const authoritativeVisualEventsForFrame = useMemo(() => {
        const byFrame = new Map<number, VisualEvent[]>();

        authoritativeEventsForFrame.forEach((events, frameIndex) => {
            const frame = matchData.frames[frameIndex];
            if (!frame) return;

            const visualEvents = events.map((event, index) => {
                const playerPosition = event.playerId ? frame.playerPositions?.[event.playerId] : null;
                const fallbackBallPosition = frame.ball?.position || { x: 50, y: 50 };
                const eventPosition = (
                    typeof event.logX === 'number' && typeof event.logY === 'number'
                        ? { x: event.logX, y: event.logY }
                        : (playerPosition || fallbackBallPosition)
                );

                return {
                    id: `auth-${frameIndex}-${index}-${event.type}-${event.playerId || 'none'}`,
                    type: canonicalizeAuthoritativeType(event.type) as VisualEvent['type'],
                    minute: event.minute,
                    tick: frame.tick,
                    position: { x: eventPosition.x, y: eventPosition.y },
                    playerId: event.playerId,
                    playerName: event.playerName,
                    teamId: String(event.teamId || ''),
                    metadata: {
                        reason: event.text,
                    },
                } as VisualEvent;
            });

            byFrame.set(frameIndex, visualEvents);
        });

        return byFrame;
    }, [authoritativeEventsForFrame, matchData.frames]);

    const authoritativeBallTransitionsForFrame = useMemo(() => {
        const byFrame = new Map<number, BallTransition[]>();
        if (!strictAuthoritativeMode || !matchData.frames.length) return byFrame;

        const getSnapshotMinute = (log: {
            snapshotMinute?: number;
            minute?: number;
        }) => {
            if (typeof log.snapshotMinute === 'number' && Number.isFinite(log.snapshotMinute)) {
                return log.snapshotMinute;
            }
            if (typeof log.minute === 'number' && Number.isFinite(log.minute)) {
                return log.minute;
            }
            return null;
        };

        const normalizedLogs = authoritativeRawLogs
            .map((log) => ({ ...log, snapshotMinute: getSnapshotMinute(log) }))
            .filter((log) => typeof log.snapshotMinute === 'number');

        authoritativeEventsForFrame.forEach((events, frameIndex) => {
            const frame = matchData.frames[frameIndex];
            if (!frame) return;

            const transitions: BallTransition[] = [];
                const minuteZeroBased = Number(frame.minute || 0);
                const minuteOneBased = minuteZeroBased + 1;

            events.forEach((event, eventIndex) => {
                const type = canonicalizeAuthoritativeType(event.type);
                if (type !== 'GOAL' && type !== 'SHOT') return;

                const candidateLogs = normalizedLogs
                    .filter((log) => {
                        const snapshotMinute = Number(log.snapshotMinute);
                        return snapshotMinute === minuteOneBased || snapshotMinute === minuteZeroBased;
                    })
                    .filter((log) => {
                        const actionType = String(log.actionType || '').toUpperCase();
                        return actionType === 'SHOOT' || actionType === 'SHOT';
                    })
                    .filter((log) => !event.playerId || log.playerId === event.playerId)
                    .filter((log) => !event.teamId || String(log.teamId || '') === String(event.teamId || ''))
                    .sort((a, b) => {
                        const tickDiff = Number(a.tick || 0) - Number(b.tick || 0);
                        if (tickDiff !== 0) return tickDiff;
                        return Number(a.sequence || 0) - Number(b.sequence || 0);
                    });

                const resultHint = type === 'GOAL'
                    ? ['GOAL']
                    : ['SAVED', 'SAVED_PARRY', 'OFF_TARGET', 'FAIL', 'FAILED'];
                const matchedLog = candidateLogs.find((log) => {
                    const result = String(log.result || '').toUpperCase();
                    return resultHint.some((hint) => result.includes(hint));
                }) || candidateLogs[0];

                const shooterPos = event.playerId
                    ? frame.playerPositions?.[event.playerId]
                    : null;
                const fromPosition = {
                    x: typeof matchedLog?.x === 'number' ? matchedLog.x : (shooterPos?.x ?? frame.ball.position.x),
                    y: typeof matchedLog?.y === 'number' ? matchedLog.y : (shooterPos?.y ?? frame.ball.position.y),
                };

                const isHomeAttack = String(event.teamId || '') === String(matchData.homeTeamId || '');
                const defaultGoalTarget = {
                    x: isHomeAttack ? 99 : 1,
                    y: 50,
                };

                const metadataTarget = matchedLog?.metadata && typeof matchedLog.metadata === 'object'
                    ? {
                        x: Number((matchedLog.metadata as any).targetX),
                        y: Number((matchedLog.metadata as any).targetY),
                    }
                    : null;

                const toPosition = (metadataTarget && Number.isFinite(metadataTarget.x) && Number.isFinite(metadataTarget.y))
                    ? { x: metadataTarget.x, y: metadataTarget.y }
                    : defaultGoalTarget;

                transitions.push({
                    type: type === 'GOAL' ? 'GOAL' : 'SHOT',
                    fromPosition,
                    toPosition,
                    fromPlayerId: event.playerId || matchedLog?.playerId || 'unknown',
                    toPlayerId: undefined,
                    minute: Number(event.minute || Math.max(1, minuteZeroBased + 1)),
                    tick: Number(frame.tick || 0),
                    success: type === 'GOAL',
                    trajectory: [fromPosition, toPosition],
                    duration: 14,
                    ballHeight: 'aerial',
                    description: type === 'GOAL' ? 'Authoritative DB goal transition' : 'Authoritative DB shot transition',
                });
            });

            if (transitions.length > 0) {
                byFrame.set(frameIndex, transitions);
            }
        });

        return byFrame;
    }, [authoritativeEventsForFrame, authoritativeRawLogs, matchData.frames, matchData.homeTeamId, strictAuthoritativeMode]);

    const highlightFrameIndexes = useMemo(() => {
        const result = new Set<number>();

        if (!strictAuthoritativeMode) {
            matchData.frames.forEach((frame, index) => {
                if (frame.events?.some((event) => isImportantHighlight(event.type))) {
                    result.add(index);
                }
            });
        }

        authoritativeEventsForFrame.forEach((events, index) => {
            if (events.some((event) => isImportantHighlight(String(event.type || '')) || String(event.type || '') === 'GOAL')) {
                result.add(index);
            }
        });

        return Array.from(result).sort((a, b) => a - b);
    }, [matchData.frames, authoritativeEventsForFrame, strictAuthoritativeMode]);

    const useReplayStreamForFilter = strictAuthoritativeMode
        && (eventFilter === 'PASS' || eventFilter === 'DRIBBLE');

    const minuteFrameRanges = useMemo(() => {
        const ranges = new Map<number, FrameWindowRange>();
        matchData.frames.forEach((frame, frameIndex) => {
            const minute = Number(frame.minute || 0);
            const existing = ranges.get(minute);
            if (!existing) {
                ranges.set(minute, { startIndex: frameIndex, endIndex: frameIndex });
            } else {
                existing.endIndex = frameIndex;
            }
        });
        return ranges;
    }, [matchData.frames]);

    const filteredEventWindows = useMemo(() => {
        if (eventFilter === 'all') return [] as FrameWindowRange[];

        const eventMinutes = new Set<number>();
        const maxMinute = Math.max(0, ...Array.from(minuteFrameRanges.keys()));
        const addMinuteWithWindow = (minute: number) => {
            const clampedMinute = Math.max(0, Math.min(maxMinute, minute));
            eventMinutes.add(clampedMinute);
            eventMinutes.add(Math.max(0, Math.min(maxMinute, clampedMinute + 1)));
        };

        if (strictAuthoritativeMode && !useReplayStreamForFilter) {
            authoritativeVisualEventsForFrame.forEach((events, frameIndex) => {
                const frame = matchData.frames[frameIndex];
                if (!frame || !events || events.length === 0) return;
                const hasMatch = events.some((event) => toMasterEventCategory(event.type) === eventFilter);
                if (hasMatch) addMinuteWithWindow(Number(frame.minute || 0));
            });
        } else {
            const hasAuthoritativeCandidates = authoritativeVisualEventsForFrame.size > 0 && !useReplayStreamForFilter;
            if (hasAuthoritativeCandidates) {
                authoritativeVisualEventsForFrame.forEach((events, frameIndex) => {
                    const frame = matchData.frames[frameIndex];
                    if (!frame || !events || events.length === 0) return;
                    const hasMatch = events.some((event) => toMasterEventCategory(event.type) === eventFilter);
                    if (hasMatch) addMinuteWithWindow(Number(frame.minute || 0));
                });
            } else {
                matchData.frames.forEach((frame) => {
                    if (!frame.events || frame.events.length === 0) return;
                    const hasMatch = frame.events.some((event) => toMasterEventCategory(event.type) === eventFilter);
                    if (hasMatch) addMinuteWithWindow(Number(frame.minute || 0));
                });
            }
        }

        const ranges = Array.from(eventMinutes)
            .sort((left, right) => left - right)
            .map((minute) => minuteFrameRanges.get(minute))
            .filter((range): range is FrameWindowRange => !!range)
            .sort((left, right) => left.startIndex - right.startIndex);

        if (ranges.length === 0) return [] as FrameWindowRange[];

        const merged: FrameWindowRange[] = [];
        ranges.forEach((range) => {
            const last = merged[merged.length - 1];
            if (!last) {
                merged.push({ ...range });
                return;
            }
            if (range.startIndex <= last.endIndex + 1) {
                last.endIndex = Math.max(last.endIndex, range.endIndex);
                return;
            }
            merged.push({ ...range });
        });

        return merged;
    }, [authoritativeVisualEventsForFrame, eventFilter, matchData.frames, minuteFrameRanges, strictAuthoritativeMode, useReplayStreamForFilter]);

    const filteredEventSkipMode = eventFilter !== 'all';
    const renderFrame = useMemo(
        () => (currentFrame ? interpolateFrame(currentFrame, nextFrame, frameBlend) : undefined),
        [currentFrame, nextFrame, frameBlend],
    );

    const replayScoreTimeline = useMemo(() => {
        const homeTeamId = String(matchData.homeTeamId || '');
        const awayTeamId = String(matchData.awayTeamId || '');

        const persistedGoalEvents = authoritativeEvents
            .map((event: any, index) => {
                if (event?.type !== 'GOAL') return null;
                const teamFromEvent = String(event?.teamId || '');
                const playerTeamId = String((matchData.playerStats as Record<string, any>)?.[event?.playerId]?.teamId || '');
                const resolvedTeamId = teamFromEvent || playerTeamId;
                return {
                    minute: Number(event?.minute || 90),
                    order: index,
                    teamId: resolvedTeamId,
                };
            })
            .filter((event): event is { minute: number; order: number; teamId: string } => !!event)
            .filter((event) => event.teamId === homeTeamId || event.teamId === awayTeamId)
            .sort((a, b) => (a.minute - b.minute) || (a.order - b.order));

        if (persistedGoalEvents.length > 0) {
            let homeCount = persistedGoalEvents.filter((event) => event.teamId === homeTeamId).length;
            let awayCount = persistedGoalEvents.filter((event) => event.teamId === awayTeamId).length;

            while (homeCount < Number(matchData.homeScore || 0)) {
                persistedGoalEvents.push({ minute: 90, order: 10_000 + homeCount, teamId: homeTeamId });
                homeCount += 1;
            }
            while (awayCount < Number(matchData.awayScore || 0)) {
                persistedGoalEvents.push({ minute: 90, order: 20_000 + awayCount, teamId: awayTeamId });
                awayCount += 1;
            }

            persistedGoalEvents.sort((a, b) => (a.minute - b.minute) || (a.order - b.order));

            return matchData.frames.map((frame, frameIndex) => {
                let home = 0;
                let away = 0;
                const visibleMinute = Number(frame.minute || 0) + 1;

                persistedGoalEvents.forEach((event) => {
                    if (event.minute > visibleMinute) return;
                    if (event.teamId === homeTeamId) {
                        home += 1;
                    } else if (event.teamId === awayTeamId) {
                        away += 1;
                    }
                });

                if (frameIndex >= matchData.frames.length - 1) {
                    return {
                        home: Number(matchData.homeScore || 0),
                        away: Number(matchData.awayScore || 0),
                    };
                }

                return {
                    home: Math.min(home, Number(matchData.homeScore || 0)),
                    away: Math.min(away, Number(matchData.awayScore || 0)),
                };
            });
        }

        let home = 0;
        let away = 0;

        return matchData.frames.map((frame) => {
            if (frame.events?.length) {
                frame.events.forEach((event) => {
                    if (event.type !== 'GOAL') return;
                    if (event.teamId === matchData.homeTeamId) {
                        home += 1;
                    } else if (event.teamId === matchData.awayTeamId) {
                        away += 1;
                    }
                });
            }

            return { home, away };
        });
    }, [authoritativeEvents, matchData.frames, matchData.homeTeamId, matchData.awayTeamId]);

    const currentReplayScore = replayScoreTimeline[currentFrameIndex]
        || { home: matchData.homeScore, away: matchData.awayScore };

    const isWithinHighlightStoryWindow = !!(
        highSpeedHighlightsOnly
        && storyWindowRange
        && currentFrameIndex >= storyWindowRange.startIndex
        && currentFrameIndex <= storyWindowRange.endIndex
    );

    const visibleFrameEvents = useMemo(() => {
        const authoritativeVisualEvents = authoritativeVisualEventsForFrame.get(currentFrameIndex) || [];
        const applyEventFilter = (events: MatchFrame['events'] = [] as MatchFrame['events']) => {
            if (eventFilter === 'all') return events;
            return events.filter((event) => toMasterEventCategory(event.type) === eventFilter);
        };

        if (strictAuthoritativeMode && !useReplayStreamForFilter) {
            return applyEventFilter(authoritativeVisualEvents as MatchFrame['events']);
        }

        if (authoritativeVisualEvents.length > 0 && !useReplayStreamForFilter) {
            return applyEventFilter(authoritativeVisualEvents as MatchFrame['events']);
        }

        if (!currentFrame?.events?.length) return [] as MatchFrame['events'];
        if (!highSpeedHighlightsOnly) return applyEventFilter(currentFrame.events);
        if (isWithinHighlightStoryWindow) return applyEventFilter(currentFrame.events);
        return applyEventFilter(currentFrame.events.filter((event) => isImportantHighlight(event.type)));
    }, [currentFrame, highSpeedHighlightsOnly, isWithinHighlightStoryWindow, authoritativeVisualEventsForFrame, currentFrameIndex, strictAuthoritativeMode, eventFilter, useReplayStreamForFilter]);

    const renderFrameForBallLayer = useMemo(() => {
        if (!renderFrame) return renderFrame;
        const authoritativeTransitions = authoritativeBallTransitionsForFrame.get(currentFrameIndex) || [];
        const mergedTransitions = strictAuthoritativeMode
            ? [
                ...authoritativeTransitions,
                ...(renderFrame.ballTransitions || []).filter((transition) => (
                    transition.type !== 'GOAL' && transition.type !== 'SHOT'
                )),
            ]
            : (
                authoritativeTransitions.length > 0
                    ? [...authoritativeTransitions, ...(renderFrame.ballTransitions || [])]
                    : (renderFrame.ballTransitions || [])
            );

        if (!highSpeedHighlightsOnly) {
            return {
                ...renderFrame,
                ballTransitions: mergedTransitions,
            };
        }
        if (isWithinHighlightStoryWindow) {
            return {
                ...renderFrame,
                ballTransitions: mergedTransitions,
            };
        }
        const importantTransitions = mergedTransitions.filter((transition) => (
            transition.type === 'GOAL'
            || transition.type === 'SHOT'
            || transition.type === 'SAVE'
            || transition.type === 'CLEARANCE'
        ));
        return {
            ...renderFrame,
            ballTransitions: importantTransitions,
        };
    }, [renderFrame, highSpeedHighlightsOnly, isWithinHighlightStoryWindow, authoritativeBallTransitionsForFrame, currentFrameIndex, strictAuthoritativeMode]);

    const frameForEventsLayer = useMemo(() => {
        if (!currentFrame) return currentFrame;
        // In strict authoritative mode, ALWAYS use filtered (DB-only) events on canvas
        // regardless of playback speed – prevents replay GOAL stars appearing for non-DB events
        if (strictAuthoritativeMode || highSpeedHighlightsOnly) {
            return {
                ...currentFrame,
                events: visibleFrameEvents,
            };
        }
        return currentFrame;
    }, [currentFrame, highSpeedHighlightsOnly, visibleFrameEvents, strictAuthoritativeMode]);

    const currentEventTexts = useMemo(() => {
        const replayTexts = visibleFrameEvents.map((event) => {
            if (event.type === 'GOAL') {
                const distance = event.metadata?.distance ? Math.round(event.metadata.distance) : null;
                return `⚽ GOAL! ${event.playerName || 'Unknown'}${distance !== null ? ` (${distance}m)` : ''} (${event.minute}')`;
            }
            if (event.type === 'SHOT') {
                const outcome = event.metadata?.reason;
                const distance = event.metadata?.distance ? Math.round(event.metadata.distance) : null;
                if (outcome?.startsWith('OFF_TARGET')) return `❌ Shot wide from ${event.playerName || 'Unknown'}${distance !== null ? ` (${distance}m)` : ''} (${event.minute}')`;
                if (outcome?.startsWith('SAVED_PARRY')) return `🧤 Parried away by keeper${distance !== null ? ` (${distance}m)` : ''} (${event.minute}')`;
                return `🧤 Saved shot from ${event.playerName || 'Unknown'}${distance !== null ? ` (${distance}m)` : ''} (${event.minute}')`;
            }
            if (event.type === 'FREE_KICK') {
                return `🟡 Foul by ${event.playerName || 'Unknown'} (${event.minute}')`;
            }
            if (event.type === 'YELLOW_CARD') {
                return `🟨 Yellow card for ${event.playerName || 'Unknown'} (${event.minute}')`;
            }
            if (event.type === 'RED_CARD') {
                return `🟥 Red card for ${event.playerName || 'Unknown'} (${event.minute}')`;
            }
            if (event.type === 'PASS') return `➡️ Pass by ${event.playerName || 'Unknown'} (${event.minute}')`;
            if (event.type === 'DRIBBLE') return `🌀 Dribble by ${event.playerName || 'Unknown'} (${event.minute}')`;
            if (event.type === 'TACKLE') return `🛡️ Tackle by ${event.playerName || 'Unknown'} (${event.minute}')`;
            return `• ${event.type} (${event.minute}')`;
        });

        const authoritative = authoritativeEventsForFrame.get(currentFrameIndex) || [];
        const authoritativeTexts = authoritative.map((event) => {
            const type = String(event.type || '');
            if (type === 'GOAL') {
                const scorer = event.playerName || event.text?.split(' scored')?.[0] || 'Unknown';
                return `⚽ GOAL! ${scorer} (${event.minute}')`;
            }
            if (type === 'SHOT') {
                // event.text already carries full outcome info (🧤/❌ + both player names)
                return event.text ? `${event.text} (${event.minute}')` : `🎯 Shot by ${event.playerName || 'Unknown'} (${event.minute}')`;
            }
            if (type === 'FREE_KICK') {
                // Use stored text which may be a foul description or free-kick restart description
                return event.text ? `🟡 ${event.text} (${event.minute}')` : `🟡 Free kick (${event.minute}')`;
            }
            if (type === 'YELLOW_CARD') {
                const player = event.playerName || 'Unknown';
                return `🟨 Yellow card for ${player} (${event.minute}')`;
            }
            if (type === 'RED_CARD') {
                const player = event.playerName || 'Unknown';
                return `🟥 Red card for ${player} (${event.minute}')`;
            }
            return event.text || `• ${type} (${event.minute}')`;
        });

        const merged = (strictAuthoritativeMode && !useReplayStreamForFilter)
            ? authoritativeTexts
            : (authoritativeTexts.length > 0 ? [...authoritativeTexts, ...replayTexts] : replayTexts);
        const seen = new Set<string>();
        const deduped: string[] = [];
        merged.forEach((text) => {
            const key = text.trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            deduped.push(text);
        });

        return deduped;
    }, [visibleFrameEvents, authoritativeEventsForFrame, currentFrameIndex, strictAuthoritativeMode, useReplayStreamForFilter]);

    const sentOffTimeline = useMemo(() => {
        const byPlayerId = new Map<string, { playerId: string; teamId?: string; minute: number }>();
        (matchData.visualEvents || []).forEach((event) => {
            if (event.type !== 'RED_CARD' || !event.playerId) return;
            const existing = byPlayerId.get(event.playerId);
            if (!existing || event.minute < existing.minute) {
                byPlayerId.set(event.playerId, {
                    playerId: event.playerId,
                    teamId: event.teamId,
                    minute: event.minute,
                });
            }
        });

        return Array.from(byPlayerId.values()).sort((a, b) => a.minute - b.minute);
    }, [matchData.visualEvents]);

    const currentSentOffPlayers = useMemo(() => {
        return sentOffTimeline.filter((entry) => entry.minute <= currentFrame.minute);
    }, [sentOffTimeline, currentFrame.minute]);

    // Playback controls handlers (useCallback to avoid reference changes)
    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => {
            const next = !prev;
            if (!next) {
                setFrameBlend(0);
            }
            return next;
        });
    }, []);
    
    const handleSeek = useCallback((frameIndex: number) => {
        const targetIndex = highSpeedHighlightsOnly
            ? (() => {
                const hasHighlightAtTarget = matchData.frames[frameIndex]?.events?.some((event) => isImportantHighlight(event.type));
                const nextHighlight = hasHighlightAtTarget
                    ? frameIndex
                    : findNextHighlightFrameIndex(highlightFrameIndexes, frameIndex - 1);

                if (nextHighlight < 0) {
                    highlightStoryWindowRef.current = null;
                    setStoryWindowRange(null);
                    return frameIndex;
                }

                const window = createHighlightStoryWindow(nextHighlight, totalFrames, ticksPerMinute);
                highlightStoryWindowRef.current = window;
                setStoryWindowRange({ startIndex: window.startIndex, endIndex: window.endIndex });
                return window.startIndex;
            })()
            : frameIndex;

        if (!highSpeedHighlightsOnly) {
            highlightStoryWindowRef.current = null;
            setStoryWindowRange(null);
        }

        setCurrentFrameIndex(targetIndex);
        setFrameBlend(0);
    }, [highSpeedHighlightsOnly, highlightFrameIndexes, matchData.frames, totalFrames, ticksPerMinute]);
    
    const handleSpeedChange = useCallback((speed: number) => {
        setPlaybackSpeed(speed);

        if (speed >= 15) {
            setCurrentFrameIndex((prev) => {
                const hasHighlightAtCurrent = matchData.frames[prev]?.events?.some((event) => isImportantHighlight(event.type));
                const nextHighlight = hasHighlightAtCurrent
                    ? prev
                    : findNextHighlightFrameIndex(highlightFrameIndexes, prev - 1);

                if (nextHighlight < 0) {
                    highlightStoryWindowRef.current = null;
                    setStoryWindowRange(null);
                    return prev;
                }

                const window = createHighlightStoryWindow(nextHighlight, totalFrames, ticksPerMinute);
                highlightStoryWindowRef.current = window;
                setStoryWindowRange({ startIndex: window.startIndex, endIndex: window.endIndex });
                return window.startIndex;
            });
            setFrameBlend(0);
        } else {
            highlightStoryWindowRef.current = null;
            setStoryWindowRange(null);
        }
    }, [highlightFrameIndexes, matchData.frames, totalFrames, ticksPerMinute]);
    
    const handleReset = useCallback(() => {
        setIsPlaying(false);
        setCurrentFrameIndex(0);
        setFrameBlend(0);
        highlightStoryWindowRef.current = null;
        setStoryWindowRange(null);
    }, []);

    // Expose controls via ref
    useEffect(() => {
        if (controlsRef) {
            controlsRef.current = {
                isPlaying,
                currentFrame: currentFrameIndex,
                totalFrames,
                playbackSpeed,
                currentMinute: Math.max(1, Number(currentFrame?.minute || 0) + 1),
                onPlayPause: handlePlayPause,
                onSeek: handleSeek,
                onSpeedChange: handleSpeedChange,
                onReset: handleReset,
            };
        }
    }, [isPlaying, currentFrameIndex, totalFrames, playbackSpeed, currentFrame, controlsRef, handlePlayPause, handleSeek, handleSpeedChange, handleReset]);
    
    // Start/stop animation
    useEffect(() => {
        if (!isPlaying) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }
        
        // Animation loop
        let running = true;
        lastUpdateRef.current = performance.now();
        
        const animate = (timestamp: number) => {
            if (!running) return;
            
            const elapsed = timestamp - lastUpdateRef.current;

            if (elapsed >= frameDuration) {
                setCurrentFrameIndex(prev => {
                    let nextIndex: number;

                    if (filteredEventSkipMode) {
                        const stepCount = Math.max(1, Math.floor(elapsed / frameDuration));
                        const windows = filteredEventWindows;

                        if (windows.length === 0) {
                            running = false;
                            setIsPlaying(false);
                            setFrameBlend(0);
                            return prev;
                        }

                        const currentWindow = windows.find((window) => prev >= window.startIndex && prev <= window.endIndex);
                        if (currentWindow) {
                            const stepped = prev + stepCount;
                            if (stepped <= currentWindow.endIndex) {
                                nextIndex = stepped;
                            } else {
                                const nextWindow = windows.find((window) => window.startIndex > currentWindow.endIndex);
                                if (!nextWindow) {
                                    running = false;
                                    setIsPlaying(false);
                                    setFrameBlend(0);
                                    return currentWindow.endIndex;
                                }
                                nextIndex = nextWindow.startIndex;
                            }
                        } else {
                            const nextWindow = windows.find((window) => window.startIndex > prev) || windows[0];
                            if (!nextWindow) {
                                running = false;
                                setIsPlaying(false);
                                setFrameBlend(0);
                                return prev;
                            }
                            nextIndex = nextWindow.startIndex;
                        }
                    } else if (highSpeedHighlightsOnly) {
                        const stepCount = Math.max(1, Math.floor(elapsed / frameDuration));
                        const currentWindow = highlightStoryWindowRef.current;

                        if (currentWindow) {
                            if (prev < currentWindow.startIndex) {
                                nextIndex = currentWindow.startIndex;
                            } else if (prev < currentWindow.endIndex) {
                                nextIndex = Math.min(currentWindow.endIndex, prev + stepCount);
                            } else {
                                highlightStoryWindowRef.current = null;
                                const nextHighlight = findNextHighlightFrameIndex(highlightFrameIndexes, currentWindow.highlightIndex);
                                if (nextHighlight < 0) {
                                    running = false;
                                    setIsPlaying(false);
                                    setFrameBlend(0);
                                    setStoryWindowRange(null);
                                    return prev;
                                }

                                const nextWindow = createHighlightStoryWindow(nextHighlight, totalFrames, ticksPerMinute);
                                highlightStoryWindowRef.current = nextWindow;
                                setStoryWindowRange({ startIndex: nextWindow.startIndex, endIndex: nextWindow.endIndex });
                                nextIndex = nextWindow.startIndex;
                            }
                        } else {
                            const nextHighlight = findNextHighlightFrameIndex(highlightFrameIndexes, prev - 1);
                            if (nextHighlight < 0) {
                                running = false;
                                setIsPlaying(false);
                                setFrameBlend(0);
                                setStoryWindowRange(null);
                                return prev;
                            }

                            const nextWindow = createHighlightStoryWindow(nextHighlight, totalFrames, ticksPerMinute);
                            highlightStoryWindowRef.current = nextWindow;
                            setStoryWindowRange({ startIndex: nextWindow.startIndex, endIndex: nextWindow.endIndex });
                            nextIndex = nextWindow.startIndex;
                        }
                    } else {
                        const stepCount = Math.max(1, Math.floor(elapsed / frameDuration));
                        nextIndex = prev + stepCount;
                    }

                    if (nextIndex >= totalFrames - 1) {
                        running = false;
                        setIsPlaying(false);
                        setFrameBlend(0);
                        return Math.max(0, totalFrames - 1);
                    }
                    return nextIndex;
                });
                lastUpdateRef.current = timestamp - (elapsed % frameDuration);
            }

            const normalizedBlend = frameDuration > 0
                ? Math.max(0, Math.min(1, (timestamp - lastUpdateRef.current) / frameDuration))
                : 0;
            setFrameBlend(highSpeedHighlightsOnly ? 0 : normalizedBlend);
            
            // Continue animation loop
            if (running) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };
        
        animationRef.current = requestAnimationFrame(animate);
        
        return () => {
            running = false;
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, frameDuration, totalFrames, highSpeedHighlightsOnly, highlightFrameIndexes, ticksPerMinute, filteredEventSkipMode, filteredEventWindows]);

    useEffect(() => {
        if (!currentFrame || !onFrameChange) return;
        const carrierName = currentFrame.ball?.carrier?.id
            ? playerIdentity.playerNames[currentFrame.ball.carrier.id] || currentFrame.ball.carrier.name || 'Unknown'
            : 'Loose ball';

        onFrameChange({
            frameIndex: currentFrameIndex,
            minute: Math.max(1, Number(currentFrame.minute || 0) + 1),
            tick: currentFrame.tick,
            carrierName,
            homeScore: currentReplayScore.home,
            awayScore: currentReplayScore.away,
            eventTypes: (strictAuthoritativeMode && !useReplayStreamForFilter)
                ? (authoritativeEventsForFrame.get(currentFrameIndex) || []).map((event) => canonicalizeAuthoritativeType(event.type))
                : [
                    ...visibleFrameEvents.map((event) => event.type),
                    ...((authoritativeEventsForFrame.get(currentFrameIndex) || []).map((event) => canonicalizeAuthoritativeType(event.type))),
                ],
            eventTexts: currentEventTexts,
        });
    }, [currentFrame, currentEventTexts, onFrameChange, playerIdentity.playerNames, currentFrameIndex, currentReplayScore.home, currentReplayScore.away, visibleFrameEvents, authoritativeEventsForFrame, strictAuthoritativeMode, useReplayStreamForFilter]);
    
    if (!currentFrame || !renderFrame) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                <p className="text-gray-500">No match data available</p>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-4">
            <div
                className="relative bg-gray-900 rounded-lg overflow-hidden"
                style={{
                    height: `${height}px`,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Stage width={width} height={height}>
                    {/* Field layer (background, lines, markings) */}
                    <Layer>
                        <FieldLayer width={width} height={height} />
                    </Layer>
                    
                    {/* Players layer (22 player positions) */}
                    <Layer>
                        <PlayersLayer 
                            frame={renderFrame}
                            width={width}
                            height={height}
                            homePlayerIds={homePlayerIds}
                            playerNames={playerIdentity.playerNames}
                            playerNumbers={playerIdentity.playerNumbers}
                        />
                    </Layer>
                    
                    {/* Ball layer (ball position and trajectory) */}
                    <Layer>
                        <BallLayer 
                            frame={renderFrameForBallLayer || renderFrame}
                            width={width}
                            height={height}
                        />
                    </Layer>
                    
                    {/* Events layer (goals, cards, tackles) */}
                    <Layer>
                        <EventsLayer 
                            frame={frameForEventsLayer || currentFrame}
                            width={width}
                            height={height}
                            eventFilter={eventFilter}
                        />
                    </Layer>

                    {/* Phase 7 debug vectors / defensive overlays */}
                    {showDebugLayer && (
                        <Layer>
                            <DebugLayer
                                frame={renderFrame}
                                width={width}
                                height={height}
                            />
                        </Layer>
                    )}
                </Stage>
                
                {!hideOverlays && (
                    <>
                        {/* Match info overlay */}
                        <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-lg">
                            <div className="text-2xl font-bold">
                                {currentReplayScore.home} - {currentReplayScore.away}
                            </div>
                            <div className="text-sm opacity-75">
                                {currentFrame.minute}&apos; {currentFrame.tick > 0 ? `(+${currentFrame.tick})` : ''}
                            </div>
                        </div>

                        {/* Current ball carrier name */}
                        <div className="absolute top-4 right-4 bg-black/55 text-white px-3 py-2 rounded-lg text-sm">
                            {currentFrame.ball?.carrier?.id
                                ? `⚽ ${playerIdentity.playerNames[currentFrame.ball.carrier.id] || currentFrame.ball.carrier.name || 'Unknown'}`
                                : '⚽ Loose ball'}
                        </div>
                    </>
                )}
            </div>

            {!hideOverlays && currentSentOffPlayers.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm">
                    <div className="mb-2 font-semibold text-red-700">🟥 Sent off (Off-field)</div>
                    <div className="flex flex-wrap gap-2">
                        {currentSentOffPlayers.map((entry) => {
                            const playerName = playerIdentity.playerNames[entry.playerId] || entry.playerId;
                            const playerNumber = playerIdentity.playerNumbers[entry.playerId];
                            const isHome = entry.teamId === matchData.homeTeamId;
                            const teamColor = isHome ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-rose-100 text-rose-800 border-rose-300';

                            return (
                                <span
                                    key={`sent_off_${entry.playerId}`}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${teamColor}`}
                                    title={`${playerName} • ${entry.minute}'`}
                                >
                                    <span>#{playerNumber ?? '-'}</span>
                                    <span>{playerName}</span>
                                    <span className="text-red-600">({entry.minute}&apos;)</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {!hideControls && (
                <PlaybackControls
                    isPlaying={isPlaying}
                    currentFrame={currentFrameIndex}
                    totalFrames={totalFrames}
                    playbackSpeed={playbackSpeed}
                    currentMinute={Math.max(1, Number(currentFrame.minute || 0) + 1)}
                    onPlayPause={handlePlayPause}
                    onSeek={handleSeek}
                    onSpeedChange={handleSpeedChange}
                    onReset={handleReset}
                />
            )}
        </div>
    );
}

/**
 * Helper hook to access MatchCanvas playback state for external control
 * Returns playback controls for use outside of MatchCanvas component
 */
export function useMatchCanvasPlayback(matchData: V2MatchState) {
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(2.0);
    const frameDuration = (1000 / 1) / playbackSpeed;
    const totalFrames = matchData.frames.length;

    return {
        currentFrameIndex,
        setCurrentFrameIndex,
        isPlaying,
        setIsPlaying,
        playbackSpeed,
        setPlaybackSpeed,
        frameDuration,
        totalFrames,
    };
}
