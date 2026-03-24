'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';

// Types
type TeamMatchStats = {
    possession: number;
    corners: number;
    offsides: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    shots: number;
    shotsOnTarget: number;
    passesAttempted: number;
    passesCompleted: number;
    crossesAttempted: number;
    crossesCompleted: number;
    tacklesAttempted: number;
    tacklesWon: number;
    dribblesAttempted: number;
    dribblesWon: number;
}

type MatchData = {
    id: string;
    date: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    homeTeamName?: string;
    awayTeamName?: string;
    isPlayed: boolean;
    stats: string | any;
    events: any[];
    playerStats: Record<string, any>;
    motmPlayerId?: string;
    teamStats?: any;
    competitionType?: string;
    competitionPhase?: string;
    competitionRound?: number;
    wentToExtraTime?: boolean;
    wentToPenalties?: boolean;
    penaltyHome?: number | null;
    penaltyAway?: number | null;
};

type MatchActionAnalytics = {
    teamZones: Record<string, { defensive: number; middle: number; attacking: number; total: number }>;
    byPlayer: Record<string, {
        playerId: string;
        name: string;
        position: string;
        zones: { defensive: number; middle: number; attacking: number; total: number };
        actions: Record<string, { attempts: number; success: number; fail: number; successRate: number }>;
    }>;
    rawLogs: any[];
};

export default function MatchPage() {
    return (
        <Suspense fallback={<div className="card">Loading match...</div>}>
            <MatchContent />
        </Suspense>
    );
}

function MatchContent() {
    const searchParams = useSearchParams();
    const queryMatchId = searchParams.get('matchId');
    const router = useRouter();

    const [gameInfo, setGameInfo] = useState<any>(null);
    const [todaysMatches, setTodaysMatches] = useState<MatchData[]>([]);
    const [matchData, setMatchData] = useState<any | null>(null); // For the current simulation display
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'events' | 'home' | 'away'>('stats');
    const [teamStandings, setTeamStandings] = useState<Record<string, { position: number; power: number }>>({});
    const [matchActionAnalytics, setMatchActionAnalytics] = useState<MatchActionAnalytics | null>(null);
    const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
    const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('[MATCH] Starting fetchData...');
            const infoRes = await fetch('/api/game/info');
            const info = await infoRes.json();
            console.log('[MATCH] Got game info:', info);
            setGameInfo(info);

            // Fetch fixtures for this date (include all competitions: league + cup)
            const date = new Date(info.currentDate).toISOString().split('T')[0];
            console.log('[MATCH] Fetching fixtures for date:', date, 'Season:', info.currentSeason);
            const fixturesRes = await fetch(`/api/league/fixtures?date=${date}&competition=all`);
            const fixtures = await fixturesRes.json();
            console.log('[MATCH] Found', fixtures.length, 'matches for', date);
            setTodaysMatches(fixtures);

            // Calculate team standings and power
            console.log('[MATCH] About to calculate standings for season', info.currentSeason);
            await calculateTeamStandings(info.currentSeason);
            console.log('[MATCH] Standings calculation complete');

            // If matchId in URL, fetch that specific match
            if (queryMatchId) {
                const matchRes = await fetch(`/api/match/${queryMatchId}`);
                const match = await matchRes.json();
                if (!match.error) {
                    setMatchData(match);
                }
            }
        } catch (e) {
            console.error('[MATCH] Error in fetchData:', e);
        } finally {
            setLoading(false);
        }
    };

    const calculateTeamStandings = useCallback(async (currentSeason: number) => {
        try {
            console.log('[STANDINGS] ===== STARTING =====');
            
            // Simple approach: calculate standings from matches directly
            const matchesRes = await fetch('/api/league/fixtures');
            const allMatches = await matchesRes.json();

            // IMPORTANT: standings must be calculated only from current season
            const seasonMatches = (allMatches || []).filter((m: any) => m.season === currentSeason);
            console.log('[STANDINGS] Got', allMatches.length, 'matches total,', seasonMatches.length, 'for season', currentSeason);

            // Calculate standings from match results
            const standingsMap: Record<string, { position: number; power: number }> = {};
            const teamStatsMap: Record<string, { points: number; gf: number; ga: number }> = {};
            const teamLeagueMap: Record<string, string> = {};

            // Initialize all teams first
            const teamIds = new Set<string>();
            seasonMatches.forEach((m: any) => {
                if (m.homeTeam?.id) {
                    teamIds.add(m.homeTeam.id);
                    if (m.homeTeam.leagueId) teamLeagueMap[m.homeTeam.id] = m.homeTeam.leagueId;
                }
                if (m.awayTeam?.id) {
                    teamIds.add(m.awayTeam.id);
                    if (m.awayTeam.leagueId) teamLeagueMap[m.awayTeam.id] = m.awayTeam.leagueId;
                }
            });

            teamIds.forEach(id => {
                teamStatsMap[id] = { points: 0, gf: 0, ga: 0 };
            });

            // Process match results
            seasonMatches.forEach((match: any) => {
                if (!match.isPlayed) return;
                
                const homeId = match.homeTeam?.id;
                const awayId = match.awayTeam?.id;
                const homeScore = match.homeScore || 0;
                const awayScore = match.awayScore || 0;

                if (homeId && teamStatsMap[homeId]) {
                    teamStatsMap[homeId].gf += homeScore;
                    teamStatsMap[homeId].ga += awayScore;
                    if (homeScore > awayScore) teamStatsMap[homeId].points += 3;
                    else if (homeScore === awayScore) teamStatsMap[homeId].points += 1;
                }

                if (awayId && teamStatsMap[awayId]) {
                    teamStatsMap[awayId].gf += awayScore;
                    teamStatsMap[awayId].ga += homeScore;
                    if (awayScore > homeScore) teamStatsMap[awayId].points += 3;
                    else if (awayScore === homeScore) teamStatsMap[awayId].points += 1;
                }
            });

            // Create standings per division
            const standingsByLeague: Record<string, Array<{ teamId: string; points: number; gd: number; gf: number }>> = {};

            Object.entries(teamStatsMap).forEach(([teamId, stats]) => {
                const leagueId = teamLeagueMap[teamId] || 'unknown';
                if (!standingsByLeague[leagueId]) standingsByLeague[leagueId] = [];
                standingsByLeague[leagueId].push({
                    teamId,
                    points: stats.points,
                    gd: stats.gf - stats.ga,
                    gf: stats.gf
                });
            });

            Object.values(standingsByLeague).forEach((standings) => {
                standings.sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                });
            });

            const totalTeams = Object.values(standingsByLeague).reduce((sum, list) => sum + list.length, 0);
            console.log('[STANDINGS] Sorted by division:', Object.keys(standingsByLeague).length, 'leagues,', totalTeams, 'teams');

            // Fetch players to calculate team power
            const playersRes = await fetch('/api/players/search');
            const allPlayers = await playersRes.json();
            console.log('[STANDINGS] Got', allPlayers.length, 'players');

            // Create position map with power (use placeholder for now)
            Object.values(standingsByLeague).forEach((standings) => {
                standings.forEach((team, index) => {
                    // Try to calculate power from players
                    let teamPower = 50; // Default placeholder

                    // Find players that belong to this team (if they have team info)
                    const teamPlayers = allPlayers.filter((p: any) => {
                        return p.team?.id === team.teamId || p.teamId === team.teamId;
                    });

                    if (teamPlayers.length > 0) {
                        const bestPlayers = teamPlayers
                            .map((p: any) => p.power || 0)
                            .sort((a: number, b: number) => b - a)
                            .slice(0, 11);
                        if (bestPlayers.length > 0) {
                            const avgPower = bestPlayers.reduce((sum: number, p: number) => sum + p, 0) / bestPlayers.length;
                            teamPower = Math.round(avgPower);
                        }
                    }

                    standingsMap[team.teamId] = {
                        position: index + 1,
                        power: teamPower
                    };
                });
            });

            console.log('[STANDINGS] Set', Object.keys(standingsMap).length, 'teams');
            setTeamStandings(standingsMap);
            console.log('[STANDINGS] ===== DONE =====');
        } catch (error) {
            console.error('[STANDINGS] ERROR:', error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [queryMatchId]); // Initial mount + re-fetch when matchId changes

    useEffect(() => {
        const fetchActionAnalytics = async () => {
            if (!matchData?.id) {
                setMatchActionAnalytics(null);
                return;
            }
            try {
                const res = await fetch(`/api/match/${matchData.id}/actions`);
                const data = await res.json();
                setMatchActionAnalytics(data);
            } catch (error) {
                console.error('[MATCH] Failed to load action analytics:', error);
                setMatchActionAnalytics(null);
            }
        };

        fetchActionAnalytics();
    }, [matchData?.id]);

    const runSimulation = async (matchId: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'simulate_match', matchId })
            });
            const data = await res.json();
            setMatchData(data);
            fetchData(); // Refresh list to mark as played
        } catch (e) {
            alert('Simulation failed: ' + e);
        } finally {
            setLoading(false);
        }
    };

    const StatRow = ({ label, homeVal, awayVal, isPercentage = false, inverse = false }: { label: string, homeVal: number, awayVal: number, isPercentage?: boolean, inverse?: boolean }) => {
        const homeWin = inverse ? homeVal < awayVal : homeVal > awayVal;
        const awayWin = inverse ? awayVal < homeVal : awayVal > homeVal;
        const draw = homeVal === awayVal;

        return (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, textAlign: 'right', fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1rem' }} className="md:text-lg">
                    {homeVal}{isPercentage ? '%' : ''}
                </div>
                <div style={{ width: '100px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.7rem', textTransform: 'uppercase' }} className="md:w-40 md:text-sm">
                    {label}
                </div>
                <div style={{ flex: 1, textAlign: 'left', fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1rem' }} className="md:text-lg">
                    {awayVal}{isPercentage ? '%' : ''}
                </div>
            </div>
        );
    };

    const StatRowWithChart = ({ label, homeVal, awayVal, isPercentage = false, inverse = false }: { label: string, homeVal: number, awayVal: number, isPercentage?: boolean, inverse?: boolean }) => {
        const homeWin = inverse ? homeVal < awayVal : homeVal > awayVal;
        const awayWin = inverse ? awayVal < homeVal : awayVal > homeVal;
        const maxVal = Math.max(homeVal, awayVal, 1);
        const homePercent = (homeVal / maxVal) * 100;
        const awayPercent = (awayVal / maxVal) * 100;

        return (
            <div>
                {/* Numbers row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, textAlign: 'left', fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1rem' }} className="md:text-lg">
                        {homeVal}{isPercentage ? '%' : ''}
                    </div>
                    <div style={{ width: '100px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '600' }} className="md:w-40 md:text-sm">
                        {label}
                    </div>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1rem' }} className="md:text-lg">
                        {awayVal}{isPercentage ? '%' : ''}
                    </div>
                </div>
                {/* Diverging bar chart row */}
                <div style={{ alignItems: 'center', padding: '0.4rem 0 0.8rem 0', borderBottom: '1px solid var(--border)' }} className="hidden md:flex">
                    {/* Home bar - grows toward center from left */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <div style={{
                            height: '16px',
                            background: homeWin ? '#10b981' : '#ef4444',
                            borderRadius: '4px 0 0 4px',
                            transition: 'all 0.3s ease',
                            width: `${homePercent}%`,
                            minWidth: homePercent > 5 ? 'auto' : '0px'
                        }} />
                    </div>
                    {/* Center label space */}
                    <div style={{ width: '160px' }} />
                    {/* Away bar - grows toward center from right */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        <div style={{
                            height: '16px',
                            background: awayWin ? '#10b981' : '#ef4444',
                            borderRadius: '0 4px 4px 0',
                            transition: 'all 0.3s ease',
                            width: `${awayPercent}%`,
                            minWidth: awayPercent > 5 ? 'auto' : '0px'
                        }} />
                    </div>
                </div>
            </div>
        );
    };

    const renderCardIcons = (player: any) => {
        const yellowCards = Number(player?.yellowCards || 0);
        const redCards = Number(player?.redCards || 0);

        if (yellowCards <= 0 && redCards <= 0) return null;

        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {yellowCards > 0 && (
                    <span title={`Yellow card${yellowCards > 1 ? 's' : ''}: ${yellowCards}`} style={{ fontSize: '0.95em', lineHeight: 1 }}>
                        🟨{yellowCards > 1 ? `x${yellowCards}` : ''}
                    </span>
                )}
                {redCards > 0 && (
                    <span title={`Red card${redCards > 1 ? 's' : ''}: ${redCards}`} style={{ fontSize: '0.95em', lineHeight: 1 }}>
                        🟥{redCards > 1 ? `x${redCards}` : ''}
                    </span>
                )}
            </span>
        );
    };

    const StatBarChart = ({ label, homeVal, awayVal, isPercentage = false }: { label: string, homeVal: number, awayVal: number, isPercentage?: boolean }) => {
        const homeWin = homeVal > awayVal;
        const awayWin = awayVal > homeVal;

        return (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border)', gap: '12px' }}>
                <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <div style={{ fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1rem', minWidth: '40px', textAlign: 'right' }} className="md:text-lg">
                        {homeVal}{isPercentage ? '%' : ''}
                    </div>
                    <div style={{
                        width: '60px',
                        height: '20px',
                        background: homeWin ? '#10b981' : '#ef4444',
                        borderRadius: '4px',
                        transition: 'all 0.3s ease'
                    }} className="md:w-20" />
                </div>
                <div style={{ width: '90px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold' }} className="md:w-36 md:text-sm">
                    {label}
                </div>
                <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                    <div style={{
                        width: '60px',
                        height: '20px',
                        background: awayWin ? '#10b981' : '#ef4444',
                        borderRadius: '4px',
                        transition: 'all 0.3s ease'
                    }} className="md:w-20" />
                    <div style={{ fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1rem', minWidth: '40px', textAlign: 'left' }} className="md:text-lg">
                        {awayVal}{isPercentage ? '%' : ''}
                    </div>
                </div>
            </div>
        );
    };

    const FieldZoneStackedBar = ({ teamId, side, possessionPct }: { teamId: string; side: 'home' | 'away'; possessionPct: number }) => {
        const zones = matchActionAnalytics?.teamZones?.[teamId] || { defensive: 0, middle: 0, attacking: 0, total: 0 };

        // Use possession % as team share so that DEF+MID+ATK sums exactly to possession.
        const teamSharePct = possessionPct;

        // Split team share into DF/MF/FW so that DF+MF+FW = teamSharePct exactly.
        const [defensivePct, middlePct, attackingPct] = distributeByWeight(teamSharePct, [
            zones.defensive || 0,
            zones.middle || 0,
            zones.attacking || 0
        ]);

        // Render full-width bars without gray remainder (normalize zone split to 100% of each side).
        const [defensiveRenderPct, middleRenderPct, attackingRenderPct] = distributeByWeight(100, [
            zones.defensive || 0,
            zones.middle || 0,
            zones.attacking || 0
        ]);

        const segments = side === 'away'
            ? [
                { key: 'attacking', label: 'Attacking Third', short: '⚽', pct: attackingPct, renderPct: attackingRenderPct, value: zones.attacking, color: '#f59e0b' },
                { key: 'middle', label: 'กลางสนาม', short: '⚙️', pct: middlePct, renderPct: middleRenderPct, value: zones.middle, color: '#10b981' },
                { key: 'defensive', label: 'เกมรับ', short: '🛡️', pct: defensivePct, renderPct: defensiveRenderPct, value: zones.defensive, color: '#3b82f6' }
            ]
            : [
                { key: 'defensive', label: 'เกมรับ', short: '🛡️', pct: defensivePct, renderPct: defensiveRenderPct, value: zones.defensive, color: '#3b82f6' },
                { key: 'middle', label: 'กลางสนาม', short: '⚙️', pct: middlePct, renderPct: middleRenderPct, value: zones.middle, color: '#10b981' },
                { key: 'attacking', label: 'Attacking Third', short: '⚽', pct: attackingPct, renderPct: attackingRenderPct, value: zones.attacking, color: '#f59e0b' }
            ];

        return (
            <div style={{ width: '100%' }}>
                <div style={{ width: '100%', display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {segments.map((seg) => (
                        <div
                            key={seg.key}
                            title={`${seg.label}: ${seg.value} (${seg.pct}%)`}
                            style={{
                                width: `${seg.renderPct}%`,
                                background: seg.color,
                                color: 'white',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                            }}
                        >
                            {seg.pct >= 5 ? `${seg.short} ${seg.pct}%` : ''}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const isActionSuccess = (log: any) => {
        if (typeof log?.isSuccessful === 'boolean') return log.isSuccessful;
        return ['SUCCESS', 'GOAL'].includes(log?.result);
    };

    const buildNextTeamBallPositionMap = (logs: any[]) => {
        const nextBallPosByIndex: Array<number | null> = Array(logs.length).fill(null);

        // Use only immediate next action from the same team.
        // This avoids inflated "space gain" when a team loses possession and regains much later.
        for (let i = 0; i < logs.length - 1; i++) {
            const current = logs[i];
            const next = logs[i + 1];
            if (!current?.teamId || !next?.teamId) continue;
            if (current.teamId !== next.teamId) continue;

            const nextPos = typeof next?.ballPosition === 'number'
                ? Math.max(0, Math.min(100, next.ballPosition))
                : null;

            if (nextPos !== null) {
                nextBallPosByIndex[i] = nextPos;
            }
        }

        return nextBallPosByIndex;
    };

    const parseActionMetadata = (metadata: any) => {
        if (!metadata) return null;
        if (typeof metadata === 'object') return metadata;
        if (typeof metadata === 'string') {
            try {
                return JSON.parse(metadata);
            } catch {
                return null;
            }
        }
        return null;
    };

    const distributeByWeight = (total: number, weights: number[]) => {
        if (total <= 0) return weights.map(() => 0);
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        if (sumWeights <= 0) {
            const first = Math.max(0, total);
            return [first, ...weights.slice(1).map(() => 0)];
        }

        const raw = weights.map((w) => (total * w) / sumWeights);
        const floored = raw.map((v) => Math.floor(v));
        let remaining = total - floored.reduce((a, b) => a + b, 0);

        const indices = raw
            .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
            .sort((a, b) => b.frac - a.frac)
            .map((x) => x.idx);

        for (let i = 0; i < indices.length && remaining > 0; i++) {
            floored[indices[i]] += 1;
            remaining -= 1;
        }

        return floored;
    };

    const calculatePlayerSpaceCreation = (
        playerId: string,
        teamId: string,
        logs: any[],
        nextTeamBallPosByIndex: Array<number | null>,
        playerStats: any,
        analytics: any,
        isHomeTeam: boolean
    ) => {
        type SpaceAction = 'DRIBBLE' | 'PASS_SHORT' | 'PASS_LONG';
        const trackedActions: SpaceAction[] = ['DRIBBLE', 'PASS_SHORT', 'PASS_LONG'];
        const actionStats: Record<SpaceAction, { attempts: number; success: number; totalGain: number; avgGainPerSuccess: number; gainPerAttempt: number }> = {
            DRIBBLE: { attempts: 0, success: 0, totalGain: 0, avgGainPerSuccess: 0, gainPerAttempt: 0 },
            PASS_SHORT: { attempts: 0, success: 0, totalGain: 0, avgGainPerSuccess: 0, gainPerAttempt: 0 },
            PASS_LONG: { attempts: 0, success: 0, totalGain: 0, avgGainPerSuccess: 0, gainPerAttempt: 0 }
        };

        const rawAttempts: Record<SpaceAction, number> = { DRIBBLE: 0, PASS_SHORT: 0, PASS_LONG: 0 };
        const rawSuccess: Record<SpaceAction, number> = { DRIBBLE: 0, PASS_SHORT: 0, PASS_LONG: 0 };

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            if (log?.playerId !== playerId || log?.teamId !== teamId) continue;
            if (!trackedActions.includes(log?.actionType)) continue;

            const actionType = log.actionType as SpaceAction;
            const metadata = parseActionMetadata(log?.metadata);

            // Exclude set-piece passes from open-play space creation metrics
            if ((actionType === 'PASS_SHORT' || actionType === 'PASS_LONG') && metadata?.setPiece) {
                continue;
            }

            rawAttempts[actionType] += 1;

            if (!isActionSuccess(log)) continue;
            rawSuccess[actionType] += 1;

            const currentBallPos = typeof log?.ballPosition === 'number' ? Math.max(0, Math.min(100, log.ballPosition)) : null;
            const targetFromMetadata = typeof metadata?.targetPosition === 'number'
                ? Math.max(0, Math.min(100, metadata.targetPosition))
                : null;
            const nextBallPos = targetFromMetadata ?? nextTeamBallPosByIndex[i];

            if (currentBallPos === null || typeof nextBallPos !== 'number') continue;

            const directionalGain = isHomeTeam
                ? (nextBallPos - currentBallPos)
                : (currentBallPos - nextBallPos);

            let gain = Math.max(0, directionalGain);

            // For older logs without `targetPosition`, cap inferred gain by action-type limits
            if (targetFromMetadata === null) {
                if (actionType === 'PASS_SHORT') gain = Math.min(gain, 2);
                if (actionType === 'PASS_LONG') gain = Math.min(gain, 5);
                if (actionType === 'DRIBBLE') gain = Math.min(gain, 3);
            }

            actionStats[actionType].totalGain += gain;
        }

        // Use raw action logs for dribbles (aligned with player stats if available)
        actionStats.DRIBBLE.attempts = playerStats?.dribblesAttempted ?? rawAttempts.DRIBBLE;
        actionStats.DRIBBLE.success = Math.min(playerStats?.dribblesWon ?? rawSuccess.DRIBBLE, actionStats.DRIBBLE.attempts);

        // For passes: use analytics (from action logs) directly as source of truth
        // This avoids confusion from trying to split aggregated "passesAttempted" into SHORT/LONG
        actionStats.PASS_SHORT.attempts = analytics?.actions?.PASS_SHORT?.attempts ?? rawAttempts.PASS_SHORT;
        actionStats.PASS_SHORT.success = analytics?.actions?.PASS_SHORT?.success ?? rawSuccess.PASS_SHORT;
        actionStats.PASS_LONG.attempts = analytics?.actions?.PASS_LONG?.attempts ?? rawAttempts.PASS_LONG;
        actionStats.PASS_LONG.success = analytics?.actions?.PASS_LONG?.success ?? rawSuccess.PASS_LONG;

        trackedActions.forEach((actionType) => {
            const st = actionStats[actionType];
            st.totalGain = Number(st.totalGain.toFixed(2));
            st.avgGainPerSuccess = st.success > 0 ? Number((st.totalGain / st.success).toFixed(2)) : 0;
            st.gainPerAttempt = st.attempts > 0 ? Number((st.totalGain / st.attempts).toFixed(2)) : 0;
        });

        const totalGainAll = Number(trackedActions.reduce((sum, actionType) => sum + actionStats[actionType].totalGain, 0).toFixed(2));

        const bestActionByTotalGain = trackedActions.reduce((best, actionType) => {
            return actionStats[actionType].totalGain > actionStats[best].totalGain ? actionType : best;
        }, trackedActions[0]);

        const bestActionByAvgGain = trackedActions.reduce((best, actionType) => {
            return actionStats[actionType].avgGainPerSuccess > actionStats[best].avgGainPerSuccess ? actionType : best;
        }, trackedActions[0]);

        return {
            actions: actionStats,
            summary: {
                totalGainAll,
                bestActionByTotalGain,
                bestActionByAvgGain
            }
        };
    };

    const getSpaceCreationInsight = (spaceCreation: any) => {
        if (!spaceCreation || spaceCreation.summary.totalGainAll <= 0) {
            return 'ยังไม่พบการสร้างพื้นที่เพิ่มอย่างชัดเจนจากการเลี้ยง/จ่ายบอลในเกมนี้';
        }

        const bestTotal = spaceCreation.summary.bestActionByTotalGain;
        const bestAvg = spaceCreation.summary.bestActionByAvgGain;
        const toLabel = (action: string) => action.replace('_', ' ');

        if (bestTotal === bestAvg) {
            return `รูปแบบที่สร้างพื้นที่เด่นที่สุดคือ ${toLabel(bestTotal)} ทั้งด้านปริมาณรวมและประสิทธิภาพต่อครั้ง`;
        }

        return `ปริมาณรวมเด่นที่ ${toLabel(bestTotal)} แต่ประสิทธิภาพต่อครั้งเด่นที่ ${toLabel(bestAvg)} เหมาะกับการผสมจังหวะ`; 
    };

    if (!gameInfo) return <div className="card">Loadingข้อมูล...</div>;

    const userTeamId = gameInfo.userTeamId;
    const userMatch = todaysMatches.find(m => m.homeTeam?.id === userTeamId || m.awayTeam?.id === gameInfo.userTeamId);

    const isUserPlayingToday = !!userMatch;
    const userMatchPlayed = userMatch?.isPlayed ?? false;
    const unplayedMatches = todaysMatches.filter(m => !m.isPlayed);

    const getSubstitutionInfo = (teamId: string) => {
        const subs = (matchData?.events || []).filter((e: any) => e.type === 'SUB' && e.teamId === teamId);
        const subInIds = new Set(subs.map((e: any) => e.playerId).filter(Boolean));
        const subOutNames = new Set(
            subs.map((e: any) => {
                const match = typeof e.text === 'string' ? e.text.match(/Substitution:\s*(.+)\s*off,\s*(.+)\s*on\.?/i) : null;
                return match ? match[1].trim() : null;
            }).filter(Boolean)
        );

        return { subInIds, subOutNames };
    };

    const getTeamInfo = (teamId: string) => {
        if (!teamId) {
            console.log('[TEAMINFO] No teamId provided');
            return null;
        }
        const standing = teamStandings[teamId];
        if (!standing) {
            console.log('[TEAMINFO] No standing data for team:', teamId, 'Available teams:', Object.keys(teamStandings).slice(0, 5));
            return null;
        }
        console.log('[TEAMINFO] Found data for team', teamId, ':', standing);
        return {
            position: standing.position,
            power: standing.power
        };
    };

    const formatTeamName = (teamName: string, teamId: string) => {
        const info = getTeamInfo(teamId);
        if (!info) {
            console.log('[Match Page] No info for team:', teamName, teamId);
            return (
                <div style={{ fontWeight: 'bold', fontSize: '1.4rem' }}>{teamName}</div>
            );
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.4rem' }}>{teamName}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <span>อันดับ {info.position}</span>
                    <span>•</span>
                    <span>พลัง {info.power}</span>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {loading && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.45)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(2px)'
                    }}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1rem 1.25rem',
                            boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                            fontWeight: 700,
                            color: 'var(--accent)'
                        }}
                    >
                        ⏳ Processing match...
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="md:flex-row md:justify-between md:items-flex-end">
                <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }} className="md:text-2xl">⚽ Match Day</h2>
                </div>
            </div>

            {/* IF NO MATCHES TODAY */}
            {todaysMatches.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗓️</div>
                    <p style={{ marginBottom: '0', fontWeight: '500', color: 'var(--muted)' }}>No matches today</p>
                </div>
            )}

            {/* FIXTURES FOR TODAY */}
            {unplayedMatches.length > 0 && !matchData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* User's Match Section */}
                    {isUserPlayingToday && !userMatchPlayed && (
                        <div className="card" style={{ border: '2px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.02)' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⭐ Your Important Match</span>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', background: 'white' }} className="md:flex-row md:gap-0">
                                <div style={{ flex: 1, textAlign: 'right', width: '100%' }} className="md:w-auto">{formatTeamName(userMatch?.homeTeam.name || '', userMatch?.homeTeam.id || '')}</div>
                                <div style={{ margin: '0', background: 'var(--primary)', color: 'white', padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem' }} className="md:mx-8 md:text-lg">VS</div>
                                <div style={{ flex: 1, textAlign: 'left', width: '100%' }} className="md:w-auto">{formatTeamName(userMatch?.awayTeam.name || '', userMatch?.awayTeam.id || '')}</div>
                                <div style={{ marginLeft: '0', width: '100%' }} className="md:ml-8 md:w-auto">
                                    <button
                                        onClick={() => router.push(`/squad?from=match&matchId=${userMatch!.id}`)}
                                        disabled={loading}
                                        className="btn btn-primary md:w-auto"
                                        style={{ padding: '10px 24px', width: '100%' }}
                                    >
                                        Configure team before match
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Other Matches Section */}
                    {unplayedMatches.filter(m => m.id !== userMatch?.id).length > 0 && (
                        <div className="card">
                            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', fontSize: '1.1rem', color: 'var(--muted)' }}>
                                โปรแกรมคู่อื่นๆ ({unplayedMatches.filter(m => m.id !== userMatch?.id).length} คู่)
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {unplayedMatches.filter(m => m.id !== userMatch?.id).map(m => {
                                    const homeInfo = getTeamInfo(m.homeTeam.id);
                                    const awayInfo = getTeamInfo(m.awayTeam.id);
                                    return (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', opacity: isUserPlayingToday && !userMatchPlayed ? 0.7 : 1 }}>
                                            <div style={{ flex: 1, textAlign: 'right' }}>
                                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>{m.homeTeam.name}</div>
                                                {homeInfo && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                                                        #{homeInfo.position} • พลัง {homeInfo.power}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ margin: '0 1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>vs</div>
                                            <div style={{ flex: 1, textAlign: 'left' }}>
                                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>{m.awayTeam.name}</div>
                                                {awayInfo && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                                                        #{awayInfo.position} • พลัง {awayInfo.power}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ marginLeft: '1rem' }}>
                                                <button onClick={() => runSimulation(m.id)} disabled={loading} className="btn btn-sm">จำลอง</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MATCH RESULTS (IF PLAYED) */}
            {matchData && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {!matchData.isPlayed && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem 1.25rem',
                            borderBottom: '1px solid var(--border)',
                            background: 'rgba(255, 193, 7, 0.08)'
                        }} className="flex-col md:flex-row">
                            <div>
                                <div style={{ fontWeight: 700, color: '#8a6d3b' }}>⏳ This match not yet processed</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    หากเป็นแมตช์ค้างเก่า สามารถกดประมวลผลได้จากตรงนี้
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {((matchData.homeTeam?.id === userTeamId || matchData.awayTeam?.id === userTeamId) && !!matchData.id) && (
                                    <button
                                        onClick={() => router.push(`/squad?from=match&matchId=${matchData.id}`)}
                                        disabled={loading}
                                        className="btn"
                                    >
                                        Configure team
                                    </button>
                                )}
                                <button
                                    onClick={() => runSimulation(matchData.id)}
                                    disabled={loading}
                                    className="btn btn-primary"
                                >
                                    {loading ? 'Processing...' : '▶️ Process this match'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ justifyContent: 'space-between', alignItems: 'center', background: 'var(--sidebar-bg)', color: '#fff', padding: '1.5rem', textAlign: 'center', gap: '1rem' }} className="flex flex-col md:flex-row md:gap-0 md:p-10">
                        <div style={{ flex: 1 }} className="md:text-left">
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', marginBottom: '4px' }}>HOME</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }} className="md:text-2xl">{matchData.homeTeamName}</div>
                            {(() => {
                                const homeInfo = getTeamInfo(matchData.homeTeam?.id);
                                return homeInfo && (
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
                                        อันดับ {homeInfo.position} • พลัง {homeInfo.power}
                                    </div>
                                );
                            })()}
                            {/* Home Team Goals */}
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.8' }}>
                                {(matchData.events || [])
                                    .filter((e: any) => e.type === 'GOAL' && e.teamId === matchData.homeTeam?.id)
                                    .map((e: any, idx: number) => {
                                        const playerName = e.playerName || e.text?.split(' scored')?.[0] || 'Unknown';
                                        const assistMatch = e.text?.match(/assisted by ([^.!]+)/i);
                                        const assistName = assistMatch?.[1]?.trim();
                                        const isEventMotM = !!matchData.motmPlayerId && e.playerId === matchData.motmPlayerId;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span title="Scorer">⚽</span>
                                                <span>{playerName}</span>
                                                {assistName && (
                                                    <span title={`Assist: ${assistName}`} style={{ opacity: 0.95 }}>
                                                        🅰️ {assistName}
                                                    </span>
                                                )}
                                                {isEventMotM && <span title="Man of the Match">🌟</span>}
                                                <span>{e.minute}'</span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '4px', position: 'relative', display: 'inline-block' }} className="md:text-6xl md:letter-spacing-2">
                                {matchData.homeScore} - {matchData.awayScore}
                                {matchData.motmPlayerId && (
                                    <span title="Man of the Match awarding" style={{ position: 'absolute', top: '-10px', right: '-40px', fontSize: '1.5rem' }} className="md:text-4xl">🌟</span>
                                )}
                            </div>
                            {matchData.wentToPenalties && matchData.penaltyHome !== null && matchData.penaltyAway !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                                    <div style={{ opacity: 0.7, textTransform: 'uppercase', fontSize: '0.75rem' }} className="md:text-sm">Full Time (After Penalties)</div>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 14px', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '2px' }} className="md:text-base">
                                        🥅 {matchData.penaltyHome} – {matchData.penaltyAway} PKs
                                    </div>
                                </div>
                            ) : matchData.wentToExtraTime ? (
                                <div style={{ opacity: 0.7, textTransform: 'uppercase', fontSize: '0.75rem', marginTop: '8px' }} className="md:text-sm">Full Time (After Extra Time)</div>
                            ) : (
                                <div style={{ opacity: 0.7, textTransform: 'uppercase', fontSize: '0.75rem', marginTop: '8px' }} className="md:text-sm">Full Time Result</div>
                            )}
                        </div>
                        <div style={{ flex: 1 }} className="md:text-right">
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', marginBottom: '4px' }}>AWAY</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }} className="md:text-2xl">{matchData.awayTeamName}</div>
                            {(() => {
                                const awayInfo = getTeamInfo(matchData.awayTeam?.id);
                                return awayInfo && (
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
                                        อันดับ {awayInfo.position} • พลัง {awayInfo.power}
                                    </div>
                                );
                            })()}
                            {/* Away Team Goals */}
                            <div style={{ fontSize: '0.75rem', opacity: 0.9, lineHeight: '1.6' }} className="md:text-sm">{(matchData.events || [])
                                    .filter((e: any) => e.type === 'GOAL' && e.teamId === matchData.awayTeam?.id)
                                    .map((e: any, idx: number) => {
                                        const playerName = e.playerName || e.text?.split(' scored')?.[0] || 'Unknown';
                                        const assistMatch = e.text?.match(/assisted by ([^.!]+)/i);
                                        const assistName = assistMatch?.[1]?.trim();
                                        const isEventMotM = !!matchData.motmPlayerId && e.playerId === matchData.motmPlayerId;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span title="Scorer">⚽</span>
                                                <span>{playerName}</span>
                                                {assistName && (
                                                    <span title={`Assist: ${assistName}`} style={{ opacity: 0.95 }}>
                                                        🅰️ {assistName}
                                                    </span>
                                                )}
                                                {isEventMotM && <span title="Man of the Match">🌟</span>}
                                                <span>{e.minute}'</span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }} className="md:overflow-visible">
                        {['stats', 'events', 'home', 'away'].map((tab) => {
                            let tabIcon = '';
                            let tabLabel = tab.toUpperCase();
                            if (tab === 'home') {
                                tabIcon = '🏠';
                                tabLabel = matchData.homeTeamName;
                            } else if (tab === 'away') {
                                tabIcon = '🚌';
                                tabLabel = matchData.awayTeamName;
                            } else if (tab === 'stats') {
                                tabIcon = '📊';
                            } else if (tab === 'events') {
                                tabIcon = '📅';
                            }
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    style={{
                                        flex: '0 0 auto', minWidth: tab === 'home' || tab === 'away' ? '60px' : '50px', padding: '0.75rem 0.5rem', border: 'none',
                                        background: activeTab === tab ? '#fff' : 'transparent',
                                        borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                        color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    className="text-xs md:text-lg md:flex-1 md:min-w-0 md:py-6 md:px-8"
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }} className="md:flex-row md:gap-3">
                                        <span style={{ fontSize: '1rem' }} className="md:text-2xl">{tabIcon}</span>
                                        <span style={{ fontSize: '0.6rem' }} className="hidden md:inline md:text-base md:font-semibold">{tabLabel}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ padding: '1rem' }} className="md:py-8 md:px-8">
                        {activeTab === 'stats' && (
                            <div style={{ width: '100%', maxWidth: '980px', margin: '0 auto' }}>
                                <StatRowWithChart label="Possession" homeVal={matchData.teamStats.home.possession} awayVal={matchData.teamStats.away.possession} isPercentage />
                                <StatRowWithChart label="Shots (On Target)" homeVal={matchData.teamStats.home.shotsOnTarget} awayVal={matchData.teamStats.away.shotsOnTarget} />
                                <StatRowWithChart label="Pass Accuracy"
                                    homeVal={Math.round((matchData.teamStats.home.passesCompleted / (matchData.teamStats.home.passesAttempted || 1)) * 100)}
                                    awayVal={Math.round((matchData.teamStats.away.passesCompleted / (matchData.teamStats.away.passesAttempted || 1)) * 100)}
                                    isPercentage
                                />
                                <StatRowWithChart label="Cross Accuracy"
                                    homeVal={Math.round((matchData.teamStats.home.crossesCompleted / (matchData.teamStats.home.crossesAttempted || 1)) * 100)}
                                    awayVal={Math.round((matchData.teamStats.away.crossesCompleted / (matchData.teamStats.away.crossesAttempted || 1)) * 100)}
                                    isPercentage
                                />
                                <StatRowWithChart label="Tackling %"
                                    homeVal={Math.round((matchData.teamStats.home.tacklesWon / (matchData.teamStats.home.tacklesAttempted || 1)) * 100)}
                                    awayVal={Math.round((matchData.teamStats.away.tacklesWon / (matchData.teamStats.away.tacklesAttempted || 1)) * 100)}
                                    isPercentage
                                />
                                <StatRowWithChart label="Dribbling %"
                                    homeVal={Math.round((matchData.teamStats.home.dribblesWon / (matchData.teamStats.home.dribblesAttempted || 1)) * 100)}
                                    awayVal={Math.round((matchData.teamStats.away.dribblesWon / (matchData.teamStats.away.dribblesAttempted || 1)) * 100)}
                                    isPercentage
                                />
                                <StatRowWithChart label="Fouls" homeVal={matchData.teamStats.home.fouls} awayVal={matchData.teamStats.away.fouls} inverse />
                                <StatRowWithChart label="Yellow Cards" homeVal={matchData.teamStats.home.yellowCards} awayVal={matchData.teamStats.away.yellowCards} inverse />
                                <StatRowWithChart label="Red Cards" homeVal={matchData.teamStats.home.redCards} awayVal={matchData.teamStats.away.redCards} inverse />
                                <StatRowWithChart label="Corners" homeVal={matchData.teamStats.home.corners} awayVal={matchData.teamStats.away.corners} />
                                <StatRowWithChart label="Free Kicks" homeVal={matchData.teamStats.home.freeKicks || 0} awayVal={matchData.teamStats.away.freeKicks || 0} />
                                <StatRowWithChart label="Throw-Ins" homeVal={matchData.teamStats.home.throws || 0} awayVal={matchData.teamStats.away.throws || 0} />
                                {/* Field Zone Usage */}
                                <div style={{ alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }} className="hidden md:flex">
                                    <div style={{ flex: 1 }}>
                                        <FieldZoneStackedBar teamId={matchData.homeTeamId} side="home" possessionPct={matchData.teamStats.home.possession} />
                                    </div>
                                    <div style={{ width: '160px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>
                                        Field Zone
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <FieldZoneStackedBar teamId={matchData.awayTeamId} side="away" possessionPct={matchData.teamStats.away.possession} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:gap-3">
                                {matchData.events.map((e: any, i: number) => {
                                    const getEventIcon = (type: string) => {
                                        switch (type) {
                                            case 'GOAL': return '⚽';
                                            case 'CARD_YELLOW': return '🟨';
                                            case 'CARD_RED': return '🟥';
                                            case 'MISS': return '❌';
                                            case 'OFFSIDE': return '🚩';
                                            case 'CORNER': return '📐';
                                            case 'FOUL': return '🔔';
                                            case 'SUB': return '🔁';
                                            default: return '●';
                                        }
                                    };

                                    const isHomeTeam = e.teamId === matchData.homeTeamId;
                                    
                                    // Calculate score at the time of this goal
                                    let scoreAtTime = '';
                                    if (e.type === 'GOAL') {
                                        let homeScore = 0;
                                        let awayScore = 0;
                                        // Count all goals before and including this one
                                        for (let j = 0; j <= i; j++) {
                                            if (matchData.events[j].type === 'GOAL') {
                                                if (matchData.events[j].teamId === matchData.homeTeamId) {
                                                    homeScore++;
                                                } else {
                                                    awayScore++;
                                                }
                                            }
                                        }
                                        scoreAtTime = `${homeScore} - ${awayScore}`;
                                    }
                                    
                                    // Extract player names from substitution text
                                    let displayText = e.text;
                                    if (e.type === 'SUB' && e.text) {
                                        const match = e.text.match(/Substitution:\s*(.+?)\s+off,\s*(.+?)\s+on/i);
                                        if (match) {
                                            displayText = (
                                                <div style={{ lineHeight: '1.6' }}>
                                                    <div style={{ color: '#059669', fontWeight: '500' }}>{match[2].trim()}</div>
                                                    <div style={{ color: '#dc2626', fontWeight: '500' }}>{match[1].trim()}</div>
                                                </div>
                                            );
                                        }
                                    } else if (e.type === 'GOAL') {
                                        // For goals, show player name with score
                                        displayText = (
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{e.playerName || e.text}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 'bold', marginTop: '2px' }}>
                                                    {scoreAtTime}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={i}>
                                            {/* Mobile: time left, description right (team separated by description background color) */}
                                            <div style={{
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 0',
                                                borderBottom: i < matchData.events.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                fontSize: '0.8rem'
                                            }} className="flex md:hidden">
                                                <div style={{
                                                    minWidth: '40px',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    color: '#6b7280',
                                                    background: '#f3f4f6',
                                                    padding: '3px 6px',
                                                    borderRadius: '12px',
                                                    flexShrink: 0
                                                }}>
                                                    {e.minute}'
                                                </div>

                                                <div style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    minWidth: 0,
                                                    background: isHomeTeam ? '#e0f2fe' : '#fef3c7',
                                                    border: `1px solid ${isHomeTeam ? '#bae6fd' : '#fde68a'}`,
                                                    borderRadius: '10px',
                                                    padding: '6px 8px'
                                                }}>
                                                    <div style={{ fontSize: '0.95rem', flexShrink: 0 }}>{getEventIcon(e.type)}</div>
                                                    <div style={{ color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {displayText}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop: original left/right split with time in center */}
                                            <div style={{
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 0',
                                                borderBottom: i < matchData.events.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                fontSize: '0.8rem'
                                            }} className="hidden md:flex md:gap-4 md:py-2 md:text-base">
                                                {/* Left side - Home team events */}
                                                <div style={{
                                                    flex: 1,
                                                    textAlign: 'right',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    paddingRight: '3px',
                                                    minWidth: 0,
                                                    overflow: 'hidden'
                                                }} className="md:gap-2 md:pr-2">
                                                    {isHomeTeam && (
                                                        <>
                                                            <div style={{ fontSize: 'inherit', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="md:whitespace-normal">
                                                                {displayText}
                                                            </div>
                                                            <div style={{ fontSize: '0.9rem', flexShrink: 0 }} className="md:text-xl">{getEventIcon(e.type)}</div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Center - Time */}
                                                <div style={{
                                                    minWidth: '40px',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: 'inherit',
                                                    color: '#6b7280',
                                                    background: '#f3f4f6',
                                                    padding: '3px 6px',
                                                    borderRadius: '12px',
                                                    flexShrink: 0
                                                }} className="md:min-w-16 md:py-1.5 md:px-3 md:text-base">
                                                    {e.minute}'
                                                </div>

                                                {/* Right side - Away team events */}
                                                <div style={{
                                                    flex: 1,
                                                    textAlign: 'left',
                                                    display: 'flex',
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    paddingLeft: '3px',
                                                    minWidth: 0,
                                                    overflow: 'hidden'
                                                }} className="md:gap-2 md:pl-2">
                                                    {!isHomeTeam && (
                                                        <>
                                                            <div style={{ fontSize: '0.9rem', flexShrink: 0 }} className="md:text-xl">{getEventIcon(e.type)}</div>
                                                            <div style={{ fontSize: 'inherit', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="md:whitespace-normal">
                                                                {displayText}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {(activeTab === 'home' || activeTab === 'away') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Desktop header */}
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center', 
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    color: 'var(--muted)',
                                    padding: '12px',
                                    background: '#f8fafc',
                                    borderRadius: '6px',
                                    borderBottom: '2px solid var(--border)',
                                    textTransform: 'uppercase'
                                }} className="hidden md:flex">
                                    <div style={{ width: '70px' }}>POS</div>
                                    <div style={{ flex: 1.6 }}>NAME</div>
                                    <div style={{ width: '56px', textAlign: 'center' }} title="Minutes played">MIN</div>
                                    <div style={{ width: '56px', textAlign: 'center' }} title="Player Rating">RAT</div>
                                    <div style={{ width: '56px', textAlign: 'center' }} title="Fitness/Condition">FIT</div>
                                    <div style={{ width: '72px', textAlign: 'center' }} title="Shots on Target">SHO</div>
                                    <div style={{ width: '72px', textAlign: 'center' }} title="Passes completed">PAS</div>
                                    <div style={{ width: '72px', textAlign: 'center' }} title="Crosses completed">CRS</div>
                                    <div style={{ width: '72px', textAlign: 'center' }} title="Dribbles won">DRB</div>
                                    <div style={{ width: '72px', textAlign: 'center' }} title="Tackles won">TCK</div>
                                    <div style={{ width: '56px', textAlign: 'center' }} title="Fouls committed">FLS</div>
                                    <div style={{ width: '56px', textAlign: 'center' }} title="EXP gained this match">EXP</div>
                                    <div style={{ width: '36px' }}></div>
                                </div>

                                {(() => {
                                    const teamId = activeTab === 'home' ? matchData.homeTeamId : matchData.awayTeamId;
                                    const { subInIds, subOutNames } = getSubstitutionInfo(teamId);
                                    const rawLogsForSpace = matchActionAnalytics?.rawLogs || [];
                                    const nextTeamBallPosByIndex = buildNextTeamBallPositionMap(rawLogsForSpace);
                                    const allPlayers = Object.values(matchData.playerStats || {}) as any[];
                                    const teamPlayers = allPlayers.filter((p: any) => String(p.teamId || '') === String(teamId || '')) as any[];

                                    // Backward-compat fallback: some legacy rows may miss teamId.
                                    // If strict filter is empty, keep rendering by splitting rows using match side heuristics.
                                    const resolvedTeamPlayers = teamPlayers.length > 0
                                        ? teamPlayers
                                        : allPlayers.filter((p: any) => {
                                            const pid = String(p.playerId || '');
                                            if (!pid) return false;
                                            // Deterministic split by playerId hash to avoid fully empty table on bad legacy data
                                            const code = pid.charCodeAt(pid.length - 1) || 0;
                                            return activeTab === 'home' ? code % 2 === 0 : code % 2 === 1;
                                        });

                                    // Tactical slot order mirrors formation definition (GK→DR→DC_R→DC_L→DL→MR/MC_R→...→FW)
                                    const TACTICAL_SLOT_ORDER: Record<string, number> = {
                                        'GK': 0,
                                        'DR': 1,
                                        'DC_R': 2, 'DC': 3, 'DC_L': 4,
                                        'DL': 5,
                                        'DMR': 6, 'DMC': 7, 'DML': 8,
                                        'MR': 10,
                                        'MC_R': 11, 'MC': 12, 'MC_L': 13,
                                        'ML': 14,
                                        'AMR': 15, 'AMC': 16, 'AML': 17,
                                        'FW_R': 20, 'FW': 21, 'FW_L': 22,
                                    };

                                    const MIRROR_TACTICAL_SLOT: Record<string, string> = {
                                        DR: 'DL',
                                        DL: 'DR',
                                        DMR: 'DML',
                                        DML: 'DMR',
                                        DC_R: 'DC_L',
                                        DC_L: 'DC_R',
                                        MR: 'ML',
                                        ML: 'MR',
                                        MC_R: 'MC_L',
                                        MC_L: 'MC_R',
                                        AMR: 'AML',
                                        AML: 'AMR',
                                        FW_R: 'FW_L',
                                        FW_L: 'FW_R',
                                    };

                                    const normalizePosForDisplay = (pos?: string | null) => {
                                        if (!pos) return '-';
                                        if (pos === 'FWC' || pos === 'FWR' || pos === 'FWL') return 'FW';
                                        if (pos.startsWith('FW_')) return 'FW';
                                        if (pos.startsWith('DC_')) return 'DC';
                                        if (pos.startsWith('MC_')) return 'MC';
                                        return pos;
                                    };

                                    // Derive match-played tactical slot per player (helps subs show actual played position)
                                    const playedSlotByPlayerId = new Map<string, string>();
                                    for (const p of resolvedTeamPlayers) {
                                        if (p.tacticalPosition) {
                                            playedSlotByPlayerId.set(p.playerId, p.tacticalPosition);
                                        }
                                    }

                                    const subEvents = (matchData.events || [])
                                        .filter((e: any) => e.teamId === teamId && e.type === 'SUB')
                                        .sort((a: any, b: any) => (a.minute || 0) - (b.minute || 0));

                                    for (const e of subEvents) {
                                        const text = String(e.text || '');
                                        const m = text.match(/^Substitution:\s(.+?)\soff,\s(.+?)\son\.?$/i);
                                        if (!m) continue;
                                        const outName = m[1]?.trim();
                                        const inPlayerId = e.playerId;
                                        if (!outName || !inPlayerId) continue;

                                        const outCandidates = resolvedTeamPlayers.filter(
                                            (p: any) => p.name === outName && p.playerId !== inPlayerId
                                        );
                                        const outPlayer = outCandidates
                                            .sort((a: any, b: any) => {
                                                const aScore =
                                                    (playedSlotByPlayerId.has(a.playerId) ? 100 : 0) +
                                                    (a.tacticalPosition ? 50 : 0) +
                                                    (Number(a.minutes || 0));
                                                const bScore =
                                                    (playedSlotByPlayerId.has(b.playerId) ? 100 : 0) +
                                                    (b.tacticalPosition ? 50 : 0) +
                                                    (Number(b.minutes || 0));
                                                return bScore - aScore;
                                            })[0];
                                        const outPlayerId = outPlayer?.playerId;
                                        const outSlot = outPlayerId
                                            ? (playedSlotByPlayerId.get(outPlayerId) || outPlayer?.tacticalPosition || null)
                                            : null;

                                        if (outSlot) {
                                            playedSlotByPlayerId.set(inPlayerId, outSlot);
                                        }
                                    }

                                    const getPlayedPos = (p: any) => playedSlotByPlayerId.get(p.playerId) || p.tacticalPosition || p.position || '-';
                                    const getSortPos = (p: any) => {
                                        const pos = getPlayedPos(p);
                                        if (activeTab === 'away') {
                                            return MIRROR_TACTICAL_SLOT[pos] || pos;
                                        }
                                        return pos;
                                    };
                                    const getPlayerGroup = (p: any) => {
                                        const isStarter = !!p.tacticalPosition;
                                        const hasPlayedMinutes = Number(p.minutes || 0) > 0;

                                        // Group 0 = starting XI (initial tactical slot)
                                        // Group 1 = non-starters who played (subs/re-entry edge cases)
                                        // Group 2 = unused bench
                                        if (isStarter) return 0;
                                        if (hasPlayedMinutes) return 1;
                                        return 2;
                                    };
                                    // Category order for bench/subs by naturalPosition: GK→DF→MF→FW
                                    const getNaturalPosOrder = (pos: string) => {
                                        if (pos === 'GK') return 0;
                                        if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos)) return 1;
                                        if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos)) return 2;
                                        if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos)) return 3;
                                        return 9;
                                    };

                                    const renderBasicPlayerRows = (playersToRender: any[]) => {
                                        return [...playersToRender]
                                            .sort((a: any, b: any) => {
                                                const aPos = getSortPos(a);
                                                const bPos = getSortPos(b);
                                                const aTacOrder = TACTICAL_SLOT_ORDER[aPos] ?? (getNaturalPosOrder(aPos) * 10 + 50);
                                                const bTacOrder = TACTICAL_SLOT_ORDER[bPos] ?? (getNaturalPosOrder(bPos) * 10 + 50);
                                                if (aTacOrder !== bTacOrder) return aTacOrder - bTacOrder;
                                                return a.name.localeCompare(b.name);
                                            })
                                            .map((p: any) => {
                                                const displayPos = normalizePosForDisplay(getPlayedPos(p));
                                                const displayRating = (p.minutes || 0) <= 0 ? '-' : Number(p.rating || 0).toFixed(1);
                                                return (
                                                    <div
                                                        key={p.playerId}
                                                        style={{
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '10px',
                                                            padding: '12px',
                                                            background: '#fff'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                                                                <div style={{ fontWeight: 'bold', minWidth: '40px' }}>{displayPos}</div>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                                        MIN {p.minutes || 0}' • RAT {displayRating} • FIT {p.fitnessEnd ?? 0}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'right', display: 'flex', gap: 12 }}>
                                                                <span>FLS {p.fouls ?? 0}</span>
                                                                <span>EXP {typeof p.expGain === 'number' ? p.expGain : p.minutes > 0 ? '0' : '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                    };

                                    if (resolvedTeamPlayers.length === 0) {
                                        return (
                                            <div style={{
                                                padding: '1rem',
                                                border: '1px dashed var(--border)',
                                                borderRadius: '8px',
                                                color: 'var(--muted)',
                                                textAlign: 'center'
                                            }}>
                                                ไม่พบข้อมูล player stats ของฝั่งนี้ (legacy match data)
                                            </div>
                                        );
                                    }

                                    try {
                                        return resolvedTeamPlayers
                                        .sort((a: any, b: any) => {
                                            const aGroup = getPlayerGroup(a);
                                            const bGroup = getPlayerGroup(b);
                                            if (aGroup !== bGroup) return aGroup - bGroup;

                                            if (aGroup === 0 || aGroup === 1) {
                                                // Starters/Sub-ins: sort by actual played tactical slot (GK→DR→DC→...)
                                                const aPos = getSortPos(a);
                                                const bPos = getSortPos(b);
                                                const aTacOrder = TACTICAL_SLOT_ORDER[aPos] ?? (getNaturalPosOrder(aPos) * 10 + 50);
                                                const bTacOrder = TACTICAL_SLOT_ORDER[bPos] ?? (getNaturalPosOrder(bPos) * 10 + 50);
                                                if (aTacOrder !== bTacOrder) return aTacOrder - bTacOrder;

                                                // Same slot: more minutes first
                                                if (a.minutes !== b.minutes) return b.minutes - a.minutes;
                                            } else {
                                                // Unused bench: sort by natural position category GK→DF→MF→FW
                                                const aOrder = getNaturalPosOrder(a.position);
                                                const bOrder = getNaturalPosOrder(b.position);
                                                if (aOrder !== bOrder) return aOrder - bOrder;
                                            }
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map((p: any) => {
                                            const isSubIn = subInIds.has(p.playerId);
                                            const isSubOut = subOutNames.has(p.name);
                                            const isMotM = p.playerId === matchData.motmPlayerId;
                                            const isExpanded = expandedPlayerId === p.playerId;
                                            const displayPos = normalizePosForDisplay(getPlayedPos(p));
                                            const didNotPlay = (p.minutes || 0) <= 0;
                                            const displayRating = didNotPlay ? '-' : Number(p.rating || 0).toFixed(1);
                                            const analytics = matchActionAnalytics?.byPlayer?.[p.playerId];
                                            const spaceCreation = calculatePlayerSpaceCreation(
                                                p.playerId,
                                                teamId,
                                                rawLogsForSpace,
                                                nextTeamBallPosByIndex,
                                                p,
                                                analytics,
                                                activeTab === 'home'
                                            );
                                            const totalZoneTouches = (analytics?.zones?.total || (p.defensiveThirdTouches + p.middleThirdTouches + p.attackingThirdTouches) || 1);
                                            const defPct = Math.round(((analytics?.zones?.defensive ?? p.defensiveThirdTouches ?? 0) / totalZoneTouches) * 100);
                                            const midPct = Math.round(((analytics?.zones?.middle ?? p.middleThirdTouches ?? 0) / totalZoneTouches) * 100);
                                            const attPct = Math.round(((analytics?.zones?.attacking ?? p.attackingThirdTouches ?? 0) / totalZoneTouches) * 100);

                                            // Calculate action breakdown percentages with zone filtering
                                            const actions = ['PASS_SHORT', 'PASS_LONG', 'DRIBBLE', 'SHOOT'];
                                            
                                            // If a zone is selected, filter raw logs by that zone
                                            let filteredLogs = matchActionAnalytics?.rawLogs || [];
                                            if (selectedZoneFilter && filteredLogs.length > 0) {
                                                filteredLogs = filteredLogs.filter(log => 
                                                    log.playerId === p.playerId && 
                                                    ((selectedZoneFilter === 'defensive' && log.zone === 'DEFENSIVE') ||
                                                     (selectedZoneFilter === 'middle' && log.zone === 'MIDDLE') ||
                                                     (selectedZoneFilter === 'attacking' && log.zone === 'ATTACKING'))
                                                );
                                            }

                                            // Calculate breakdown from filtered logs or use overall stats
                                            let actionBreakdown;
                                            if (selectedZoneFilter && filteredLogs.length > 0) {
                                                // Calculate from filtered logs
                                                const zoneActionCounts = {
                                                    'PASS_SHORT': 0,
                                                    'PASS_LONG': 0,
                                                    'DRIBBLE': 0,
                                                    'SHOOT': 0
                                                };
                                                const zoneActionSuccess = {
                                                    'PASS_SHORT': 0,
                                                    'PASS_LONG': 0,
                                                    'DRIBBLE': 0,
                                                    'SHOOT': 0
                                                };
                                                
                                                filteredLogs.forEach(log => {
                                                    const actionType = log.actionType as keyof typeof zoneActionCounts;
                                                    if (actionType in zoneActionCounts) {
                                                        zoneActionCounts[actionType]++;
                                                        if (log.isSuccessful) {
                                                            zoneActionSuccess[actionType]++;
                                                        }
                                                    }
                                                });

                                                const zoneTotal = Object.values(zoneActionCounts).reduce((a, b) => a + b, 0);
                                                actionBreakdown = actions.map(a => ({
                                                    type: a,
                                                    attempts: zoneActionCounts[a as keyof typeof zoneActionCounts],
                                                    percentage: zoneTotal > 0 ? Math.round((zoneActionCounts[a as keyof typeof zoneActionCounts] / zoneTotal) * 100) : 0,
                                                    success: zoneActionSuccess[a as keyof typeof zoneActionSuccess],
                                                    successRate: zoneActionCounts[a as keyof typeof zoneActionCounts] > 0 
                                                        ? Math.round((zoneActionSuccess[a as keyof typeof zoneActionSuccess] / zoneActionCounts[a as keyof typeof zoneActionCounts]) * 100)
                                                        : 0
                                                }));
                                            } else {
                                                // Use overall stats
                                                const totalAttempts = actions.reduce((sum, a) => sum + (analytics?.actions?.[a]?.attempts ?? 0), 0);
                                                actionBreakdown = actions.map(a => ({
                                                    type: a,
                                                    attempts: analytics?.actions?.[a]?.attempts ?? 0,
                                                    percentage: totalAttempts > 0 ? Math.round(((analytics?.actions?.[a]?.attempts ?? 0) / totalAttempts) * 100) : 0,
                                                    success: analytics?.actions?.[a]?.success ?? 0,
                                                    successRate: analytics?.actions?.[a]?.successRate ?? 0
                                                }));
                                            }

                                            return (
                                                <div
                                                    key={p.playerId}
                                                    style={{
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '10px',
                                                        padding: '12px',
                                                        opacity: (p.minutes === 0 || isSubOut) ? 0.5 : 1,
                                                        background: isMotM ? 'rgba(var(--primary-rgb), 0.05)' : '#fff',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setExpandedPlayerId(isExpanded ? null : p.playerId)}
                                                >
                                                    {/* Mobile Card Layout */}
                                                    <div style={{ flexDirection: 'column', gap: '8px' }} className="flex md:hidden">
                                                        {/* Mobile Card Header - Position and Name */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ fontWeight: 'bold', minWidth: '40px' }}>{displayPos}</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(`/match?matchId=${queryMatchId}&playerId=${p.playerId}`);
                                                                        }}
                                                                        style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                                                                    >
                                                                        {p.name}
                                                                    </button>
                                                                    {p.goals > 0 && p.minutes > 0 && <span title={`Scorer (${p.goals})`}>⚽</span>}
                                                                    {p.assists > 0 && p.minutes > 0 && <span title={`Assist (${p.assists})`}>🅰️</span>}
                                                                    {renderCardIcons(p)}
                                                                    {isSubIn && <span title="Subbed On">🔼</span>}
                                                                    {isSubOut && <span title="Subbed Off">🔽</span>}
                                                                    {isMotM && <span title="Man of the Match">🌟</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{displayRating}</div>
                                                        </div>

                                                        {/* Mobile Card Stats Grid */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>MIN</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.minutes}'</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>FIT</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.fitnessEnd ?? 0}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>SHO</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.shotsOnTarget}/{p.shots}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>PAS</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.passesCompleted}/{p.passesAttempted}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>CRS</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.crossesCompleted}/{p.crossesAttempted}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>DRB</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.dribblesWon}/{p.dribblesAttempted}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>TCK</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.tacklesWon}/{p.tacklesAttempted}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                <div style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>FLS</div>
                                                                <div style={{ fontWeight: 'bold' }}>{p.fouls ?? 0}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'center', padding: '4px' }}>{isExpanded ? '▲' : '▼'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Row View */}
                                                    <div style={{ display: 'flex', gap: '0', alignItems: 'center', fontSize: '0.85rem' }} className="hidden md:flex">
                                                        <div style={{ width: '70px', fontWeight: 'bold', flexShrink: 0 }}>{displayPos}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1.6, minWidth: 0 }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/match?matchId=${queryMatchId}&playerId=${p.playerId}`);
                                                                }}
                                                                style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                                            >
                                                                {p.name}
                                                            </button>
                                                            {p.goals > 0 && p.minutes > 0 && <span title={`Scorer (${p.goals})`}>⚽{p.goals > 1 ? `x${p.goals}` : ''}</span>}
                                                            {p.assists > 0 && p.minutes > 0 && <span title={`Assist (${p.assists})`}>🅰️{p.assists > 1 ? `x${p.assists}` : ''}</span>}
                                                            {renderCardIcons(p)}
                                                            {isSubIn && <span title="Subbed On">🔼</span>}
                                                            {isSubOut && <span title="Subbed Off">🔽</span>}
                                                            {isMotM && <span title="Man of the Match">🌟</span>}
                                                        </div>
                                                        <div style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>{p.minutes}'</div>
                                                        <div style={{ width: '56px', textAlign: 'center', fontWeight: 'bold', flexShrink: 0 }}>{displayRating}</div>
                                                        <div style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>{p.fitnessEnd ?? 0}</div>
                                                        <div style={{ width: '72px', textAlign: 'center', flexShrink: 0 }}>{p.shotsOnTarget}/{p.shots}</div>
                                                        <div style={{ width: '72px', textAlign: 'center', flexShrink: 0 }}>{p.passesCompleted}/{p.passesAttempted}</div>
                                                        <div style={{ width: '72px', textAlign: 'center', flexShrink: 0 }}>{p.crossesCompleted}/{p.crossesAttempted}</div>
                                                        <div style={{ width: '72px', textAlign: 'center', flexShrink: 0 }}>{p.dribblesWon}/{p.dribblesAttempted}</div>
                                                        <div style={{ width: '72px', textAlign: 'center', flexShrink: 0 }}>{p.tacklesWon}/{p.tacklesAttempted}</div>
                                                        <div style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>{p.fouls ?? 0}</div>
                                                        <div style={{ width: '56px', textAlign: 'center', fontWeight: 'bold', flexShrink: 0, color: p.expGain > 0 ? 'var(--success)' : 'var(--muted)' }}>{typeof p.expGain === 'number' ? p.expGain : '-'}</div>
                                                        <div style={{ width: '36px', textAlign: 'center', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                                                            {/* Zone Filter Chart */}
                                                            <div style={{ marginBottom: '12px' }}>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '6px', fontWeight: '600' }}>Field Zone Distribution (Click to filter)</div>
                                                                <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '8px', gap: '2px' }}>
                                                                    {[
                                                                        { key: 'defensive', label: '🛡️ Defensive', pct: defPct, value: analytics?.zones?.defensive ?? p.defensiveThirdTouches ?? 0, color: '#3b82f6' },
                                                                        { key: 'middle', label: '⚙️ Middle', pct: midPct, value: analytics?.zones?.middle ?? p.middleThirdTouches ?? 0, color: '#10b981' },
                                                                        { key: 'attacking', label: '⚽ Attacking', pct: attPct, value: analytics?.zones?.attacking ?? p.attackingThirdTouches ?? 0, color: '#f59e0b' }
                                                                    ].map(zone => (
                                                                        <div
                                                                            key={zone.key}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedZoneFilter(selectedZoneFilter === zone.key ? null : zone.key);
                                                                            }}
                                                                            title={`${zone.label}: ${zone.value} touches (${zone.pct}%) - Click to filter`}
                                                                            style={{
                                                                                width: `${Math.max(zone.pct, 5)}%`,
                                                                                background: zone.color,
                                                                                cursor: 'pointer',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                color: 'white',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 'bold',
                                                                                opacity: selectedZoneFilter === null || selectedZoneFilter === zone.key ? 1 : 0.4,
                                                                                transition: 'opacity 0.2s',
                                                                                border: selectedZoneFilter === zone.key ? '2px solid white' : 'none'
                                                                            }}
                                                                        >
                                                                            {zone.pct >= 15 ? `${zone.pct}%` : ''}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                                    🛡️ {defPct}% • ⚙️ {midPct}% • ⚽ {attPct}%
                                                                    {selectedZoneFilter && ` (Filtered: ${selectedZoneFilter})`}
                                                                </div>
                                                            </div>

                                                            {/* Action Breakdown */}
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '6px', fontWeight: '600' }}>Action Breakdown (Total: {actionBreakdown.reduce((sum, ab) => sum + ab.attempts, 0)} attempts = 100%){selectedZoneFilter && ` - ${selectedZoneFilter.charAt(0).toUpperCase() + selectedZoneFilter.slice(1)} Zone`}</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))', gap: '8px' }}>
                                                                    {actionBreakdown.map((ab) => (
                                                                        <div key={ab.type} style={{ 
                                                                            border: '1px solid var(--border)', 
                                                                            borderRadius: '6px', 
                                                                            padding: '8px', 
                                                                            background: '#fafafa',
                                                                            opacity: selectedZoneFilter ? 0.7 : 1
                                                                        }}>
                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: '600' }}>{ab.type.replace('_', ' ')}</div>
                                                                            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '2px' }}>{ab.percentage}%</div>
                                                                            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{ab.attempts} attempts</div>
                                                                            <div style={{ fontSize: '0.65rem', color: '#059669' }}>{ab.successRate}% success</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Action Details by Type */}
                                                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                                                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Detailed Action Stats</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))', gap: '8px' }}>
                                                                    {['PASS_SHORT', 'PASS_LONG', 'DRIBBLE', 'SHOOT'].map((a) => {
                                                                        const st = analytics?.actions?.[a] || { attempts: 0, success: 0, fail: 0, successRate: 0 };
                                                                        return (
                                                                            <div key={a} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', background: '#f8fafc' }}>
                                                                                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: '600' }}>{a.replace('_', ' ')}</div>
                                                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '2px' }}>{st.successRate}%</div>
                                                                                <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{st.success}/{st.attempts}</div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {/* Space Creation Impact (Web Only) */}
                                                            <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', background: '#f8fafc' }} className="hidden md:block">
                                                                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: '600', marginBottom: '8px' }}>
                                                                    Space Creation Impact (Dribble / Short Pass / Long Pass)
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr repeat(5, minmax(70px, 1fr))', gap: '6px', fontSize: '0.75rem', marginBottom: '8px' }}>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)' }}>Action</div>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>Attempts</div>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>Success</div>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>Total +Space</div>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>Avg/Success</div>
                                                                    <div style={{ fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>+Space/Attempt</div>

                                                                    {(['DRIBBLE', 'PASS_SHORT', 'PASS_LONG'] as const).map((actionType) => {
                                                                        const st = spaceCreation.actions[actionType];
                                                                        // For pass stats, use analytics (action logs) to match "Detailed Action Stats" above
                                                                        const attempts = (actionType !== 'DRIBBLE' && analytics?.actions?.[actionType]?.attempts !== undefined) 
                                                                            ? analytics.actions[actionType].attempts 
                                                                            : st.attempts;
                                                                        const success = (actionType !== 'DRIBBLE' && analytics?.actions?.[actionType]?.success !== undefined) 
                                                                            ? analytics.actions[actionType].success 
                                                                            : st.success;
                                                                        return (
                                                                            <>
                                                                                <div key={`${actionType}-name`} style={{ fontWeight: 600 }}>{actionType.replace('_', ' ')}</div>
                                                                                <div key={`${actionType}-attempts`} style={{ textAlign: 'center' }}>{attempts}</div>
                                                                                <div key={`${actionType}-success`} style={{ textAlign: 'center' }}>{success}</div>
                                                                                <div key={`${actionType}-total`} style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>+{st.totalGain}</div>
                                                                                <div key={`${actionType}-avg`} style={{ textAlign: 'center' }}>+{st.avgGainPerSuccess}</div>
                                                                                <div key={`${actionType}-perAttempt`} style={{ textAlign: 'center' }}>+{st.gainPerAttempt}</div>
                                                                            </>
                                                                        );
                                                                    })}
                                                                </div>

                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                                                                    <div style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '0.72rem' }}>
                                                                        <div style={{ color: 'var(--muted)' }}>Total Space (All)</div>
                                                                        <div style={{ fontWeight: 700, color: '#0f766e' }}>+{spaceCreation.summary.totalGainAll}</div>
                                                                    </div>
                                                                    <div style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '0.72rem' }}>
                                                                        <div style={{ color: 'var(--muted)' }}>Best Total</div>
                                                                        <div style={{ fontWeight: 700 }}>{spaceCreation.summary.bestActionByTotalGain.replace('_', ' ')}</div>
                                                                    </div>
                                                                    <div style={{ padding: '6px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '0.72rem' }}>
                                                                        <div style={{ color: 'var(--muted)' }}>Best Avg/Success</div>
                                                                        <div style={{ fontWeight: 700 }}>{spaceCreation.summary.bestActionByAvgGain.replace('_', ' ')}</div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ fontSize: '0.73rem', color: '#334155' }}>
                                                                    💡 {getSpaceCreationInsight(spaceCreation)}
                                                                </div>
                                                            </div>

                                                            {/* Space Creation Impact (Mobile Version) */}
                                                            <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', background: '#f8fafc' }} className="md:hidden">
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: '600', marginBottom: '8px' }}>
                                                                    Space Creation Impact
                                                                </div>
                                                                
                                                                {/* Mobile: 3 compact cards, one per action type */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                                                                    {(['DRIBBLE', 'PASS_SHORT', 'PASS_LONG'] as const).map((actionType) => {
                                                                        const st = spaceCreation.actions[actionType];
                                                                        const attempts = (actionType !== 'DRIBBLE' && analytics?.actions?.[actionType]?.attempts !== undefined) 
                                                                            ? analytics.actions[actionType].attempts 
                                                                            : st.attempts;
                                                                        const success = (actionType !== 'DRIBBLE' && analytics?.actions?.[actionType]?.success !== undefined) 
                                                                            ? analytics.actions[actionType].success 
                                                                            : st.success;
                                                                        const label = actionType === 'PASS_SHORT' ? 'P-Short' : actionType === 'PASS_LONG' ? 'P-Long' : 'Dribble';
                                                                        
                                                                        return (
                                                                            <div key={actionType} style={{ 
                                                                                border: '1px solid var(--border)', 
                                                                                borderRadius: '6px', 
                                                                                padding: '8px', 
                                                                                background: '#ffffff',
                                                                                fontSize: '0.65rem'
                                                                            }}>
                                                                                <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>{label}</div>
                                                                                <div style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                                                                                    <span style={{ color: 'var(--muted)' }}>Att:</span> <span style={{ fontWeight: 600 }}>{attempts}</span>
                                                                                </div>
                                                                                <div style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                                                                                    <span style={{ color: 'var(--muted)' }}>Suc:</span> <span style={{ fontWeight: 600, color: '#059669' }}>{success}</span>
                                                                                </div>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2563eb' }}>
                                                                                    +{st.totalGain} space
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Mobile: Summary boxes in single row */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                                                                    <div style={{ padding: '6px', borderRadius: '4px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '0.65rem' }}>
                                                                        <div style={{ color: 'var(--muted)', marginBottom: '2px' }}>Total Space</div>
                                                                        <div style={{ fontWeight: 700, color: '#0f766e', fontSize: '0.8rem' }}>+{spaceCreation.summary.totalGainAll}</div>
                                                                    </div>
                                                                    <div style={{ padding: '6px', borderRadius: '4px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '0.65rem' }}>
                                                                        <div style={{ color: 'var(--muted)', marginBottom: '2px' }}>Best Action</div>
                                                                        <div style={{ fontWeight: 700, fontSize: '0.75rem' }}>{spaceCreation.summary.bestActionByTotalGain === 'PASS_SHORT' ? 'P-Short' : spaceCreation.summary.bestActionByTotalGain === 'PASS_LONG' ? 'P-Long' : 'Dribble'}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Mobile: Insight as single line */}
                                                                <div style={{ fontSize: '0.65rem', color: '#334155', lineHeight: '1.4' }}>
                                                                    💡 {getSpaceCreationInsight(spaceCreation)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    } catch (error) {
                                        console.error('[MATCH] Failed to render advanced player stats table', {
                                            teamId,
                                            activeTab,
                                            error
                                        });
                                        return renderBasicPlayerRows(resolvedTeamPlayers);
                                    }
                                })()}
                            </div>
                        )}
                    </div>

                </div>
            )}
            <PlayerModal />
        </div>
    );
}
