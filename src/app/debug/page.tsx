'use client';

import { useEffect, useMemo, useState } from 'react';

type Fixture = {
    id: string;
    date: string;
    season: number;
    isPlayed: boolean;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam?: { id: string; name: string };
    awayTeam?: { id: string; name: string };
};

type MatchInfo = {
    id: string;
    homeTeam?: { id: string; name: string };
    awayTeam?: { id: string; name: string };
    homeScore: number | null;
    awayScore: number | null;
    events?: Array<{ type?: string; minute?: number }>;
};

type RawActionLog = {
    id: string;
    minute: number;
    ballPosition: number;
    zone?: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING';
    actionType: string;
    result: string;
    expectedSuccessRate?: number | null;
    playerId: string;
    teamId: string;
    createdAt?: string;
    player?: {
        name?: string;
        naturalPosition?: string;
    };
};

type MatchActionsResponse = {
    matchId: string;
    totalLogs: number;
    rawLogs: RawActionLog[];
};

type ActionTypeStats = {
    attempts: number;
    success: number;
};

type ChainSummary = {
    id: number;
    teamId: string;
    startLoop: number;
    endLoop: number;
    startMinute: number;
    endMinute: number;
    length: number;
    endAction: string;
    endResult: string;
    endsWithShot: boolean;
    endsWithGoal: boolean;
};

const SUCCESS_RESULTS = new Set(['SUCCESS', 'GOAL']);
const SHOT_ACTIONS = new Set(['SHOOT', 'SHOT']);

function getActionAbbreviation(actionType: string): string {
    switch (actionType.toUpperCase()) {
        case 'PASS_SHORT':
            return 'PS';
        case 'PASS_LONG':
            return 'PL';
        case 'DRIBBLE':
            return 'DR';
        case 'SHOOT':
        case 'SHOT':
            return 'SH';
        case 'FOUL':
            return 'FL';
        case 'SAVE':
            return 'SV';
        case 'INTERCEPTION':
            return 'IN';
        case 'TACKLE':
            return 'TK';
        default:
            return actionType.slice(0, 2).toUpperCase();
    }
}

function getActionColor(actionType: string): string {
    switch (actionType.toUpperCase()) {
        case 'PASS_SHORT':
            return '#2563eb';
        case 'PASS_LONG':
            return '#7c3aed';
        case 'DRIBBLE':
            return '#ea580c';
        case 'SHOOT':
        case 'SHOT':
            return '#dc2626';
        case 'FOUL':
            return '#b45309';
        case 'SAVE':
            return '#0f766e';
        default:
            return '#475569';
    }
}

function getResultColor(result: string): string {
    const normalized = result.toUpperCase();
    if (normalized === 'GOAL') return '#dc2626';
    if (normalized === 'SUCCESS') return '#16a34a';
    return '#f97316';
}

function getZone(ballPosition: number): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    if (ballPosition <= 30) return 'DEFENSIVE';
    if (ballPosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
}

function isShot(actionType: string): boolean {
    return SHOT_ACTIONS.has(actionType.toUpperCase());
}

function isSuccess(result: string): boolean {
    return SUCCESS_RESULTS.has(result.toUpperCase());
}

function formatPct(numerator: number, denominator: number): string {
    if (!denominator) return '0%';
    return `${Math.round((numerator / denominator) * 100)}%`;
}

function buildChains(logs: RawActionLog[]): ChainSummary[] {
    if (logs.length === 0) return [];

    const chains: ChainSummary[] = [];
    let chainStart = 0;
    let chainId = 1;

    const pushChain = (start: number, end: number) => {
        if (end < start) return;
        const first = logs[start];
        const last = logs[end];
        const lastActionType = String(last.actionType || '').toUpperCase();
        const lastResult = String(last.result || '').toUpperCase();
        chains.push({
            id: chainId++,
            teamId: first.teamId,
            startLoop: start + 1,
            endLoop: end + 1,
            startMinute: first.minute,
            endMinute: last.minute,
            length: end - start + 1,
            endAction: last.actionType,
            endResult: last.result,
            endsWithShot: isShot(lastActionType),
            endsWithGoal: lastResult === 'GOAL'
        });
    };

    for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];
        const teamChanged = prev.teamId !== curr.teamId;
        const prevShotEnded = isShot(String(prev.actionType || '').toUpperCase());
        const prevGoal = String(prev.result || '').toUpperCase() === 'GOAL';

        if (teamChanged || prevShotEnded || prevGoal) {
            pushChain(chainStart, i - 1);
            chainStart = i;
        }
    }

    pushChain(chainStart, logs.length - 1);
    return chains;
}

export default function DebugPage() {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string>('');
    const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
    const [actionLogs, setActionLogs] = useState<RawActionLog[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState<boolean>(true);
    const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('ALL');
    const [selectedActionType, setSelectedActionType] = useState<string>('ALL');
    const [minuteMin, setMinuteMin] = useState<number>(0);
    const [minuteMax, setMinuteMax] = useState<number>(130);

    const [loopIndex, setLoopIndex] = useState<number>(0);

    useEffect(() => {
        const loadFixtures = async () => {
            setLoadingFixtures(true);
            setError(null);
            try {
                const infoRes = await fetch('/api/game/info');
                if (!infoRes.ok) throw new Error('Failed to fetch game info');
                const info = await infoRes.json();
                const season = Number(info.currentSeason || 1);

                const fixtureRes = await fetch(`/api/league/fixtures?season=${season}&competition=all`);
                if (!fixtureRes.ok) throw new Error('Failed to fetch fixtures');
                const fixtureData = (await fixtureRes.json()) as Fixture[];

                const played = (fixtureData || [])
                    .filter((m) => m.isPlayed)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setFixtures(played);
                if (played.length > 0) {
                    setSelectedMatchId((prev) => prev || played[0].id);
                }
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to initialize debug data');
            } finally {
                setLoadingFixtures(false);
            }
        };

        loadFixtures();
    }, []);

    useEffect(() => {
        if (!selectedMatchId) return;

        const loadMatchLogs = async () => {
            setLoadingLogs(true);
            setError(null);
            try {
                const [actionsRes, matchRes] = await Promise.all([
                    fetch(`/api/match/${selectedMatchId}/actions`),
                    fetch(`/api/match/${selectedMatchId}`)
                ]);

                if (!actionsRes.ok) throw new Error('Failed to fetch action logs');
                if (!matchRes.ok) throw new Error('Failed to fetch match detail');

                const actionData = (await actionsRes.json()) as MatchActionsResponse;
                const matchData = (await matchRes.json()) as MatchInfo;

                const logs = actionData.rawLogs || [];
                setActionLogs(logs);
                setMatchInfo(matchData);

                const maxMinute = logs.reduce((acc, l) => Math.max(acc, l.minute), 0);
                setMinuteMin(0);
                setMinuteMax(Math.max(90, maxMinute));
                setLoopIndex(0);
                setSelectedTeamId('ALL');
                setSelectedPlayerId('ALL');
                setSelectedActionType('ALL');
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to load match logs');
            } finally {
                setLoadingLogs(false);
            }
        };

        loadMatchLogs();
    }, [selectedMatchId]);

    const teams = useMemo(() => {
        const map = new Map<string, string>();
        if (matchInfo?.homeTeam?.id) map.set(matchInfo.homeTeam.id, matchInfo.homeTeam.name);
        if (matchInfo?.awayTeam?.id) map.set(matchInfo.awayTeam.id, matchInfo.awayTeam.name);
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [matchInfo]);

    const players = useMemo(() => {
        const map = new Map<string, string>();
        for (const l of actionLogs) {
            if (!map.has(l.playerId)) {
                map.set(l.playerId, l.player?.name || l.playerId);
            }
        }
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [actionLogs]);

    const actionTypes = useMemo(() => {
        const set = new Set<string>();
        for (const l of actionLogs) set.add(l.actionType);
        return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    }, [actionLogs]);

    const filteredLogs = useMemo(() => {
        return actionLogs.filter((l) => {
            if (selectedTeamId !== 'ALL' && l.teamId !== selectedTeamId) return false;
            if (selectedPlayerId !== 'ALL' && l.playerId !== selectedPlayerId) return false;
            if (selectedActionType !== 'ALL' && l.actionType !== selectedActionType) return false;
            if (l.minute < minuteMin || l.minute > minuteMax) return false;
            return true;
        });
    }, [actionLogs, selectedTeamId, selectedPlayerId, selectedActionType, minuteMin, minuteMax]);

    const clampedLoopIndex = useMemo(() => {
        if (filteredLogs.length === 0) return 0;
        return Math.min(loopIndex, filteredLogs.length - 1);
    }, [loopIndex, filteredLogs.length]);

    const currentAction = filteredLogs[clampedLoopIndex] || null;

    const analytics = useMemo(() => {
        const byType = new Map<string, ActionTypeStats>();
        const byZone = {
            DEFENSIVE: 0,
            MIDDLE: 0,
            ATTACKING: 0
        };
        let goals = 0;
        let shots = 0;
        let successfulActions = 0;
        let expectedAccumulator = 0;
        let expectedCount = 0;

        for (const l of filteredLogs) {
            const key = l.actionType;
            if (!byType.has(key)) byType.set(key, { attempts: 0, success: 0 });
            const bucket = byType.get(key);
            if (bucket) {
                bucket.attempts += 1;
                if (isSuccess(l.result)) bucket.success += 1;
            }

            if (isSuccess(l.result)) successfulActions += 1;
            if (String(l.result || '').toUpperCase() === 'GOAL') goals += 1;
            if (isShot(String(l.actionType || '').toUpperCase())) shots += 1;

            const zone = l.zone || getZone(l.ballPosition);
            byZone[zone] += 1;

            if (typeof l.expectedSuccessRate === 'number') {
                expectedAccumulator += l.expectedSuccessRate;
                expectedCount += 1;
            }
        }

        const chains = buildChains(filteredLogs);
        const topChains = [...chains].sort((a, b) => b.length - a.length).slice(0, 8);

        return {
            byType: Array.from(byType.entries()).map(([type, stats]) => ({
                type,
                attempts: stats.attempts,
                success: stats.success,
                successRate: formatPct(stats.success, stats.attempts)
            })),
            byZone,
            goals,
            shots,
            successfulActions,
            expectedAverage: expectedCount ? Math.round((expectedAccumulator / expectedCount) * 100) / 100 : null,
            chains,
            topChains
        };
    }, [filteredLogs]);

    const recentWindow = useMemo(() => {
        if (filteredLogs.length === 0) return [] as Array<RawActionLog & { loop: number }>;
        const start = Math.max(0, clampedLoopIndex - 12);
        const end = Math.min(filteredLogs.length - 1, clampedLoopIndex + 1);
        return filteredLogs.slice(start, end + 1).map((l, idx) => ({ ...l, loop: start + idx + 1 }));
    }, [filteredLogs, clampedLoopIndex]);

    const currentActionTeamName = currentAction
        ? teams.find((team) => team.id === currentAction.teamId)?.name || currentAction.teamId
        : '-';

    return (
        <div className="page-container" style={{ display: 'grid', gap: '1rem' }}>
            <div className="card">
                <h1 style={{ margin: 0 }}>Debug Mode - Full Match Flow</h1>
                <p style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
                    วิเคราะห์ทุก action ทุก loop ของแมตช์ เพื่อใช้ปรับปรุง simulation, balance, tactics, และ AI behavior
                </p>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                    <label>
                        <div style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Match</div>
                        <select
                            value={selectedMatchId}
                            onChange={(e) => setSelectedMatchId(e.target.value)}
                            disabled={loadingFixtures || fixtures.length === 0}
                            style={{ width: '100%', padding: '0.5rem' }}
                        >
                            {fixtures.length === 0 && <option value="">No played match found</option>}
                            {fixtures.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {new Date(m.date).toLocaleDateString()} | {m.homeTeam?.name || 'Home'} {m.homeScore ?? '-'}-{m.awayScore ?? '-'} {m.awayTeam?.name || 'Away'}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                            {loadingFixtures ? 'Loading fixtures...' : `${fixtures.length} played matches in current season`}
                        </div>
                    </div>
                </div>

                {matchInfo && (
                    <div style={{ fontSize: '0.95rem' }}>
                        <strong>{matchInfo.homeTeam?.name || 'Home'}</strong> {matchInfo.homeScore ?? '-'} - {matchInfo.awayScore ?? '-'} <strong>{matchInfo.awayTeam?.name || 'Away'}</strong>
                    </div>
                )}
            </div>

            {error && (
                <div className="card" style={{ borderColor: '#f59e0b', color: '#92400e' }}>
                    {error}
                </div>
            )}

            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Filters</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem' }}>
                    <label>
                        <div style={{ marginBottom: 4 }}>Team</div>
                        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                            <option value="ALL">All teams</option>
                            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>

                    <label>
                        <div style={{ marginBottom: 4 }}>Player</div>
                        <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                            <option value="ALL">All players</option>
                            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </label>

                    <label>
                        <div style={{ marginBottom: 4 }}>Action Type</div>
                        <select value={selectedActionType} onChange={(e) => setSelectedActionType(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                            <option value="ALL">All actions</option>
                            {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </label>

                    <label>
                        <div style={{ marginBottom: 4 }}>Minute Min</div>
                        <input type="number" value={minuteMin} min={0} max={Math.max(0, minuteMax)} onChange={(e) => setMinuteMin(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem' }} />
                    </label>

                    <label>
                        <div style={{ marginBottom: 4 }}>Minute Max</div>
                        <input type="number" value={minuteMax} min={0} max={130} onChange={(e) => setMinuteMax(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem' }} />
                    </label>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.75rem' }}>
                <div className="card"><strong>{filteredLogs.length}</strong><div style={{ color: 'var(--muted)' }}>Actions (filtered)</div></div>
                <div className="card"><strong>{analytics.successfulActions}</strong><div style={{ color: 'var(--muted)' }}>Success actions</div></div>
                <div className="card"><strong>{analytics.goals}</strong><div style={{ color: 'var(--muted)' }}>Goals</div></div>
                <div className="card"><strong>{analytics.shots}</strong><div style={{ color: 'var(--muted)' }}>Shots</div></div>
                <div className="card"><strong>{formatPct(analytics.successfulActions, filteredLogs.length)}</strong><div style={{ color: 'var(--muted)' }}>Global success rate</div></div>
                <div className="card"><strong>{analytics.expectedAverage ?? '-'}</strong><div style={{ color: 'var(--muted)' }}>Avg expectedSuccessRate</div></div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Loop Navigator (ทุก loop)</h2>
                {loadingLogs ? (
                    <div>Loading match actions...</div>
                ) : filteredLogs.length === 0 ? (
                    <div style={{ color: 'var(--muted)' }}>No action logs in current filter</div>
                ) : (
                    <>
                        <input
                            type="range"
                            min={0}
                            max={Math.max(0, filteredLogs.length - 1)}
                            value={clampedLoopIndex}
                            onChange={(e) => setLoopIndex(Number(e.target.value))}
                        />
                        {currentAction && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem' }}>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Loop</div><strong>{clampedLoopIndex + 1}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Minute</div><strong>{currentAction.minute}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Player</div><strong>{currentAction.player?.name || currentAction.playerId}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Action</div><strong>{currentAction.actionType}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Result</div><strong>{currentAction.result}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Position</div><strong>{currentAction.ballPosition}</strong></div>
                                <div className="card"><div style={{ color: 'var(--muted)' }}>Zone</div><strong>{currentAction.zone || getZone(currentAction.ballPosition)}</strong></div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Flow Visualization (recent loops around cursor)</h2>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                    แสดง movement ของบอลต่อเนื่องจาก loop ก่อนหน้า → loop ปัจจุบัน โดยใช้ ballPosition 0-100
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8' }}>PS = Short Pass</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#ede9fe', color: '#6d28d9' }}>PL = Long Pass</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#ffedd5', color: '#c2410c' }}>DR = Dribble</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#fee2e2', color: '#b91c1c' }}>SH = Shoot</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#dcfce7', color: '#15803d' }}>จุดเขียว = สำเร็จ</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#ffedd5', color: '#c2410c' }}>จุดส้ม = ไม่สำเร็จ</span>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#fee2e2', color: '#b91c1c' }}>GOAL = ประตู</span>
                </div>
                <svg viewBox="0 0 100 26" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                    <rect x="0" y="0" width="100" height="26" fill="#ffffff" />
                    <rect x="0" y="0" width="30" height="26" fill="#e2e8f0" opacity="0.45" />
                    <rect x="30" y="0" width="40" height="26" fill="#dbeafe" opacity="0.35" />
                    <rect x="70" y="0" width="30" height="26" fill="#dcfce7" opacity="0.45" />
                    <text x="15" y="4" fontSize="2.2" textAnchor="middle" fill="#334155">DEF</text>
                    <text x="50" y="4" fontSize="2.2" textAnchor="middle" fill="#334155">MID</text>
                    <text x="85" y="4" fontSize="2.2" textAnchor="middle" fill="#334155">ATT</text>

                    {recentWindow.map((a, idx) => {
                        if (idx === 0) return null;
                        const prev = recentWindow[idx - 1];
                        return (
                            <line
                                key={`line-${a.loop}`}
                                x1={prev.ballPosition}
                                y1={13}
                                x2={a.ballPosition}
                                y2={13}
                                stroke={prev.teamId === a.teamId ? '#2563eb' : '#ef4444'}
                                strokeWidth={0.6}
                                strokeOpacity={0.7}
                            />
                        );
                    })}

                    {recentWindow.map((a) => (
                        <g key={`dot-${a.loop}`} onClick={() => setLoopIndex(a.loop - 1)} style={{ cursor: 'pointer' }}>
                            <circle
                                cx={a.ballPosition}
                                cy={13}
                                r={a.loop === clampedLoopIndex + 1 ? 2.2 : 1.55}
                                fill={getResultColor(a.result)}
                                stroke={getActionColor(a.actionType)}
                                strokeWidth={a.loop === clampedLoopIndex + 1 ? 0.45 : 0.2}
                            />
                            <text x={a.ballPosition} y={18.6} fontSize="2" textAnchor="middle" fill="#0f172a">
                                {getActionAbbreviation(a.actionType)}
                            </text>
                            {a.loop === clampedLoopIndex + 1 && (
                                <>
                                    <text x={Math.min(96, a.ballPosition + 1.5)} y={7} fontSize="2.4" fill="#0f172a">
                                        L{a.loop}
                                    </text>
                                    <text x={Math.min(96, a.ballPosition + 1.5)} y={9.7} fontSize="1.8" fill="#334155">
                                        {a.player?.name || a.playerId}
                                    </text>
                                </>
                            )}
                        </g>
                    ))}
                </svg>
                {currentAction && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                        <div className="card" style={{ borderColor: getActionColor(currentAction.actionType), display: 'grid', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Selected Point Detail</h3>
                                <span style={{ padding: '0.25rem 0.5rem', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                                    Loop {clampedLoopIndex + 1}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem' }}>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Player</div><strong>{currentAction.player?.name || currentAction.playerId}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Team</div><strong>{currentActionTeamName}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Action</div><strong>{currentAction.actionType}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Result</div><strong style={{ color: getResultColor(currentAction.result) }}>{currentAction.result}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Minute</div><strong>{currentAction.minute}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Ball Position</div><strong>{currentAction.ballPosition}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Zone</div><strong>{currentAction.zone || getZone(currentAction.ballPosition)}</strong></div>
                                <div><div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Expected %</div><strong>{typeof currentAction.expectedSuccessRate === 'number' ? `${Math.round(currentAction.expectedSuccessRate * 100)}%` : '-'}</strong></div>
                            </div>
                        </div>
                        <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
                            <h3 style={{ margin: 0 }}>How to Read</h3>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>เส้นเชื่อม = การไหลของบอลจาก loop ก่อนหน้าไป loop ถัดไป</div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>สีขอบจุด = ประเภท action</div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>สีเนื้อจุด = ผลลัพธ์ของ action</div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>ตัวอักษรใต้จุด = action แบบย่อ</div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>คลิกจุดใดก็ได้เพื่อดูรายละเอียดของ loop นั้น</div>
                        </div>
                    </div>
                )}
                <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Points in Current Window</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                        {recentWindow.map((point) => {
                            const selected = point.loop === clampedLoopIndex + 1;
                            return (
                                <button
                                    key={`point-card-${point.loop}`}
                                    type="button"
                                    onClick={() => setLoopIndex(point.loop - 1)}
                                    style={{
                                        textAlign: 'left',
                                        border: `1px solid ${selected ? getActionColor(point.actionType) : 'var(--border)'}`,
                                        background: selected ? '#f8fafc' : '#ffffff',
                                        borderRadius: 10,
                                        padding: '0.65rem',
                                        cursor: 'pointer',
                                        display: 'grid',
                                        gap: '0.2rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <strong>L{point.loop}</strong>
                                        <span style={{ color: getResultColor(point.result), fontWeight: 700 }}>{point.result}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem' }}>{point.player?.name || point.playerId}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{point.actionType} · Pos {point.ballPosition}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Min {point.minute} · {point.zone || getZone(point.ballPosition)}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>Action Type Breakdown</h2>
                    <div style={{ maxHeight: 280, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '0.4rem', borderBottom: '1px solid var(--border)' }}>Action</th>
                                    <th style={{ textAlign: 'right', padding: '0.4rem', borderBottom: '1px solid var(--border)' }}>Attempts</th>
                                    <th style={{ textAlign: 'right', padding: '0.4rem', borderBottom: '1px solid var(--border)' }}>Success</th>
                                    <th style={{ textAlign: 'right', padding: '0.4rem', borderBottom: '1px solid var(--border)' }}>Success %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.byType.map((row) => (
                                    <tr key={row.type}>
                                        <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{row.type}</td>
                                        <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{row.attempts}</td>
                                        <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{row.success}</td>
                                        <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{row.successRate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>Zone Distribution</h2>
                    {(['DEFENSIVE', 'MIDDLE', 'ATTACKING'] as const).map((zone) => {
                        const total = filteredLogs.length || 1;
                        const value = analytics.byZone[zone];
                        const width = (value / total) * 100;
                        return (
                            <div key={zone}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span>{zone}</span>
                                    <strong>{value}</strong>
                                </div>
                                <div style={{ width: '100%', height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                                    <div style={{ width: `${width}%`, height: '100%', background: '#2563eb' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>Possession Chains (Top by length)</h2>
                    <div style={{ maxHeight: 260, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Chain</th>
                                    <th style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Loops</th>
                                    <th style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Minutes</th>
                                    <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>End</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.topChains.map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>#{c.id}</td>
                                        <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{c.length}</td>
                                        <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{c.startMinute}-{c.endMinute}</td>
                                        <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>
                                            {c.endAction} / {c.endResult} {c.endsWithGoal ? '⚽' : c.endsWithShot ? '🎯' : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>Future Debug Modules (Roadmap)</h2>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem' }}>
                        <li><strong>Tactical Impact Lens:</strong> เปรียบเทียบ action weights ก่อน/หลัง tactic modifier ต่อ loop</li>
                        <li><strong>Shot Quality Panel:</strong> เปรียบเทียบ expectedSuccessRate vs outcome ต่อผู้เล่น/โซนยิง</li>
                        <li><strong>GK Model Audit:</strong> finalShoot vs finalSave by distance bands (0-10, 11-20, ...)</li>
                        <li><strong>Fatigue Curve:</strong> condition decay เทียบการตัดสินใจ action type ในนาทีท้ายเกม</li>
                        <li><strong>Turnover Attribution:</strong> chain break reasons (bad pass, tackle lost, save, interception)</li>
                        <li><strong>AI Behavior Diff:</strong> เทียบ user team vs AI team ใน pattern การ build-up</li>
                        <li><strong>Replay Export:</strong> export filtered loops เป็น JSON/CSV เพื่อวิเคราะห์ offline</li>
                    </ul>
                </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
                <h2 style={{ margin: 0 }}>Action Stream (loop-by-loop)</h2>
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Loop</th>
                                <th style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Min</th>
                                <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Player</th>
                                <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Action</th>
                                <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Result</th>
                                <th style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Pos</th>
                                <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)' }}>Zone</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.slice(0, 1200).map((l, idx) => (
                                <tr
                                    key={`${l.id}-${idx}`}
                                    style={{
                                        background: idx === clampedLoopIndex ? '#eef2ff' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setLoopIndex(idx)}
                                >
                                    <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{idx + 1}</td>
                                    <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.minute}</td>
                                    <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.player?.name || l.playerId}</td>
                                    <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.actionType}</td>
                                    <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.result}</td>
                                    <td style={{ textAlign: 'right', padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.ballPosition}</td>
                                    <td style={{ padding: '0.35rem', borderBottom: '1px dashed var(--border)' }}>{l.zone || getZone(l.ballPosition)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLogs.length > 1200 && (
                        <div style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
                            Showing first 1,200 rows for UI performance (total {filteredLogs.length} rows)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
