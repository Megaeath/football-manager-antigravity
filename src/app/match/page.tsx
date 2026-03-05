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
        <Suspense fallback={<div className="card">กำลังโหลดสนามแข่ง...</div>}>
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

            // Fetch fixtures for this date
            const date = new Date(info.currentDate).toISOString().split('T')[0];
            console.log('[MATCH] Fetching fixtures for date:', date, 'Season:', info.currentSeason);
            const fixturesRes = await fetch(`/api/league/fixtures?date=${date}`);
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
            console.log('[STANDINGS] Got', allMatches.length, 'matches');

            // Calculate standings from match results
            const standingsMap: Record<string, { position: number; power: number }> = {};
            const teamStatsMap: Record<string, { points: number; gf: number; ga: number }> = {};

            // Initialize all teams first
            const teamIds = new Set<string>();
            allMatches.forEach((m: any) => {
                if (m.homeTeam?.id) teamIds.add(m.homeTeam.id);
                if (m.awayTeam?.id) teamIds.add(m.awayTeam.id);
            });

            teamIds.forEach(id => {
                teamStatsMap[id] = { points: 0, gf: 0, ga: 0 };
            });

            // Process match results
            allMatches.forEach((match: any) => {
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

            // Create standings
            const standings = Object.entries(teamStatsMap).map(([teamId, stats]) => ({
                teamId,
                points: stats.points,
                gd: stats.gf - stats.ga,
                gf: stats.gf
            }));

            standings.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
            });

            console.log('[STANDINGS] Sorted', standings.length, 'teams');

            // Fetch players to calculate team power
            const playersRes = await fetch('/api/players/search');
            const allPlayers = await playersRes.json();
            console.log('[STANDINGS] Got', allPlayers.length, 'players');

            // Create position map with power (use placeholder for now)
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

                if (index < 5) {
                    console.log(`[STANDINGS] #${index + 1}: ${team.points} pts, power ${teamPower}`);
                }
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
    }, [queryMatchId]); // Re-fetch when matchId changes
    
    // Also fetch on mount to ensure initial data load
    useEffect(() => {
        console.log('[MOUNT] Match page mounted, calling fetchData');
        fetchData().catch(err => console.error('[MOUNT] Error in fetchData:', err));
    }, []);

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

    const nextProcess = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'next_process' })
            });
            const data = await res.json();

            if (data.success) {
                setMatchData(null);
                // Force a hard reload to ensure fresh data after season transition
                window.location.href = '/match';
            }
        } catch (e) {
            alert('Next process failed: ' + e);
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
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0 0.8rem 0', borderBottom: '1px solid var(--border)' }}>
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

    const FieldZoneStackedBar = ({ teamId, side }: { teamId: string; side: 'home' | 'away' }) => {
        const zones = matchActionAnalytics?.teamZones?.[teamId] || { defensive: 0, middle: 0, attacking: 0, total: 0 };
        const total = zones.total || 1;
        const defensivePct = Math.round((zones.defensive / total) * 100);
        const middlePct = Math.round((zones.middle / total) * 100);
        const attackingPct = Math.round((zones.attacking / total) * 100);
        const align = side === 'home' ? 'flex-start' : 'flex-end';

        const segments = side === 'away'
            ? [
                { key: 'attacking', label: 'หน้าประตู', short: '⚽', pct: attackingPct, value: zones.attacking, color: '#f59e0b' },
                { key: 'middle', label: 'กลางสนาม', short: '⚙️', pct: middlePct, value: zones.middle, color: '#10b981' },
                { key: 'defensive', label: 'เกมรับ', short: '🛡️', pct: defensivePct, value: zones.defensive, color: '#3b82f6' }
            ]
            : [
                { key: 'defensive', label: 'เกมรับ', short: '🛡️', pct: defensivePct, value: zones.defensive, color: '#3b82f6' },
                { key: 'middle', label: 'กลางสนาม', short: '⚙️', pct: middlePct, value: zones.middle, color: '#10b981' },
                { key: 'attacking', label: 'หน้าประตู', short: '⚽', pct: attackingPct, value: zones.attacking, color: '#f59e0b' }
            ];

        return (
            <div style={{ width: '100%', display: 'flex', justifyContent: align }}>
                <div style={{ width: '320px' }}>
                    <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        {segments.map((seg) => (
                            <div
                                key={seg.key}
                                title={`${seg.label}: ${seg.value} (${seg.pct}%)`}
                                style={{
                                    width: `${seg.pct}%`,
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
                                {seg.pct >= 12 ? `${seg.short} ${seg.pct}%` : ''}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    if (!gameInfo) return <div className="card">กำลังโหลดข้อมูล...</div>;

    const userTeamId = gameInfo.userTeamId;
    const userMatch = todaysMatches.find(m => m.homeTeam.id === userTeamId || m.awayTeam.id === gameInfo.userTeamId);

    const isUserPlayingToday = !!userMatch;
    const userMatchPlayed = userMatch?.isPlayed ?? false;
    const unplayedMatches = todaysMatches.filter(m => !m.isPlayed);

    // Show next process if: 
    // 1. Everything is played
    // 2. OR User is not playing today
    // 3. OR User has played their match already
    // 4. Always show if no matches at all (off-day or new season without matches scheduled)
    const showNextProcess = unplayedMatches.length === 0 || !isUserPlayingToday || userMatchPlayed || todaysMatches.length === 0;
    
    console.log('[Match Page] Button Logic:', {
        todaysMatchesCount: todaysMatches.length,
        unplayedMatchesCount: unplayedMatches.length,
        isUserPlayingToday,
        userMatchPlayed,
        showNextProcess
    });

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="md:flex-row md:justify-between md:items-flex-end">
                <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }} className="md:text-2xl">⚽ วันแข่งขัน (Match Day)</h2>
                    <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '0.9rem' }} className="md:text-base">
                        {new Date(gameInfo.currentDate).toLocaleDateString('th-TH', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                    </p>
                </div>

                {showNextProcess && (
                    <button onClick={nextProcess} disabled={loading} className="btn btn-primary md:w-auto md:py-3 md:px-6 md:text-base" style={{ padding: '10px 16px', fontSize: '0.9rem', background: 'var(--accent)', width: '100%' }}>
                        {loading ? 'กำลังประมวลผล...' :
                            unplayedMatches.length > 0 ? '⏩ จำลองทีมอื่นและไปวันถัดไป' : '🏁 ไปยังวันถัดไป (Next Process)'}
                    </button>
                )}
            </div>

            {/* IF NO MATCHES TODAY */}
            {todaysMatches.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗓️</div>
                    <p style={{ marginBottom: '1.5rem', fontWeight: '500', color: 'var(--muted)' }}>ไม่มีการแข่งขันในวันนี้</p>
                    <button onClick={nextProcess} disabled={loading} className="btn btn-primary">
                        ข้ามไปยังวันถัดไป
                    </button>
                </div>
            )}

            {/* FIXTURES FOR TODAY */}
            {unplayedMatches.length > 0 && !matchData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* User's Match Section */}
                    {isUserPlayingToday && !userMatchPlayed && (
                        <div className="card" style={{ border: '2px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.02)' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⭐ นัดสำคัญของคุณ</span>
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
                                        จัดทีมก่อนเริ่มแข่ง
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sidebar-bg)', color: '#fff', padding: '1.5rem', textAlign: 'center', flexDirection: 'column', gap: '1rem' }} className="md:flex-row md:gap-0 md:p-10">
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
                            <div style={{ opacity: 0.7, textTransform: 'uppercase', fontSize: '0.75rem', marginTop: '8px' }} className="md:text-sm">Full Time Result</div>
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
                                    className="text-xs md:text-base md:flex-1 md:min-w-0 md:py-4 md:px-6"
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '1rem' }}>{tabIcon}</span>
                                        <span style={{ display: 'none', fontSize: '0.6rem' }} className="md:inline">{tabLabel}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ padding: '1rem' }} className="md:py-8 md:px-8">
                        {activeTab === 'stats' && (
                            <div style={{ width: '100%' }} className="md:max-w-2xl md:mx-auto">
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
                                <StatRowWithChart label="Corners" homeVal={matchData.teamStats.home.corners} awayVal={matchData.teamStats.away.corners} />
                                <StatRowWithChart label="Free Kicks" homeVal={matchData.teamStats.home.freeKicks || 0} awayVal={matchData.teamStats.away.freeKicks || 0} />
                                <StatRowWithChart label="Throw-Ins" homeVal={matchData.teamStats.home.throws || 0} awayVal={matchData.teamStats.away.throws || 0} />
                                {/* Field Zone Usage */}
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1 }}>
                                        <FieldZoneStackedBar teamId={matchData.homeTeamId} side="home" />
                                    </div>
                                    <div style={{ width: '160px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>
                                        Field Zone
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <FieldZoneStackedBar teamId={matchData.awayTeamId} side="away" />
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
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 0',
                                            borderBottom: i < matchData.events.length - 1 ? '1px solid #e5e7eb' : 'none',
                                            fontSize: '0.8rem'
                                        }} className="md:gap-4 md:py-2 md:text-base">
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
                                    );
                                })}
                            </div>
                        )}

                        {(activeTab === 'home' || activeTab === 'away') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Column Header - Hidden on mobile */}
                                <div style={{ 
                                    display: 'grid',
                                    gridTemplateColumns: '70px 1.6fr repeat(8, minmax(48px, 1fr)) 36px', 
                                    gap: '8px', 
                                    alignItems: 'center', 
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    color: 'var(--muted)',
                                    padding: '12px',
                                    background: '#f8fafc',
                                    borderRadius: '6px',
                                    borderBottom: '2px solid var(--border)',
                                    textTransform: 'uppercase'
                                }} className="hidden md:grid">
                                    <div>POS</div>
                                    <div>NAME</div>
                                    <div style={{ textAlign: 'center' }} title="Minutes played">MIN</div>
                                    <div style={{ textAlign: 'center' }} title="Player Rating">RAT</div>
                                    <div style={{ textAlign: 'center' }} title="Fitness/Condition">FIT</div>
                                    <div style={{ textAlign: 'center' }} title="Shots on Target">SHO</div>
                                    <div style={{ textAlign: 'center' }} title="Passes completed">PAS</div>
                                    <div style={{ textAlign: 'center' }} title="Crosses completed">CRS</div>
                                    <div style={{ textAlign: 'center' }} title="Dribbles won">DRB</div>
                                    <div style={{ textAlign: 'center' }} title="Tackles won">TCK</div>
                                    <div></div>
                                </div>

                                {(() => {
                                    const teamId = activeTab === 'home' ? matchData.homeTeamId : matchData.awayTeamId;
                                    const { subInIds, subOutNames } = getSubstitutionInfo(teamId);
                                    const subInOrder = new Map<string, number>();
                                    (matchData?.events || [])
                                        .filter((e: any) => e.type === 'SUB' && e.teamId === teamId && e.playerId)
                                        .forEach((e: any, idx: number) => subInOrder.set(e.playerId, idx));

                                    return Object.values(matchData.playerStats)
                                        .filter((p: any) => p.teamId === teamId)
                                        .sort((a: any, b: any) => {
                                            const aIsSubIn = subInIds.has(a.playerId);
                                            const bIsSubIn = subInIds.has(b.playerId);
                                            const aGroup = a.minutes === 0 ? 2 : (aIsSubIn ? 1 : 0);
                                            const bGroup = b.minutes === 0 ? 2 : (bIsSubIn ? 1 : 0);
                                            if (aGroup !== bGroup) return aGroup - bGroup;

                                            const getPosOrder = (pos: string) => {
                                                if (pos === 'GK') return 0;
                                                if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos)) return 1;
                                                if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos)) return 2;
                                                if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos)) return 3;
                                                return 9;
                                            };

                                            if (aGroup === 1 && bGroup === 1) {
                                                const aSubOrder = subInOrder.get(a.playerId) ?? 99;
                                                const bSubOrder = subInOrder.get(b.playerId) ?? 99;
                                                if (aSubOrder !== bSubOrder) return aSubOrder - bSubOrder;
                                            }

                                            const aOrder = getPosOrder(a.position);
                                            const bOrder = getPosOrder(b.position);
                                            if (aOrder !== bOrder) return aOrder - bOrder;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map((p: any) => {
                                            const isSubIn = subInIds.has(p.playerId);
                                            const isSubOut = subOutNames.has(p.name);
                                            const isMotM = p.playerId === matchData.motmPlayerId;
                                            const isExpanded = expandedPlayerId === p.playerId;
                                            const analytics = matchActionAnalytics?.byPlayer?.[p.playerId];
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
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="md:hidden">
                                                        {/* Mobile Card Header - Position and Name */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ fontWeight: 'bold', minWidth: '40px' }}>{p.position}</div>
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
                                                                    {p.goals > 0 && <span title={`Scorer (${p.goals})`}>⚽</span>}
                                                                    {p.assists > 0 && <span title={`Assist (${p.assists})`}>🅰️</span>}
                                                                    {isSubIn && <span title="Subbed On">🔼</span>}
                                                                    {isSubOut && <span title="Subbed Off">🔽</span>}
                                                                    {isMotM && <span title="Man of the Match">🌟</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{p.rating.toFixed(1)}</div>
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
                                                            <div style={{ textAlign: 'center', padding: '4px' }}>{isExpanded ? '▲' : '▼'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Grid View */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1.6fr repeat(8, minmax(48px, 1fr)) 36px', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }} className="hidden md:grid">
                                                        <div style={{ fontWeight: 'bold' }}>{p.position}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/match?matchId=${queryMatchId}&playerId=${p.playerId}`);
                                                                }}
                                                                style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                                            >
                                                                {p.name}
                                                            </button>
                                                            {p.goals > 0 && <span title={`Scorer (${p.goals})`}>⚽{p.goals > 1 ? `x${p.goals}` : ''}</span>}
                                                            {p.assists > 0 && <span title={`Assist (${p.assists})`}>🅰️{p.assists > 1 ? `x${p.assists}` : ''}</span>}
                                                            {isSubIn && <span title="Subbed On">🔼</span>}
                                                            {isSubOut && <span title="Subbed Off">🔽</span>}
                                                            {isMotM && <span title="Man of the Match">🌟</span>}
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>{p.minutes}'</div>
                                                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{p.rating.toFixed(1)}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.fitnessEnd ?? 0}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.shotsOnTarget}/{p.shots}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.passesCompleted}/{p.passesAttempted}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.crossesCompleted}/{p.crossesAttempted}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.dribblesWon}/{p.dribblesAttempted}</div>
                                                        <div style={{ textAlign: 'center' }}>{p.tacklesWon}/{p.tacklesAttempted}</div>
                                                        <div style={{ textAlign: 'center' }}>{isExpanded ? '▲' : '▼'}</div>
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
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                })()}
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: '#f8fafc', textAlign: 'center' }}>
                        <button onClick={() => setMatchData(null)} className="btn btn-primary" style={{ background: 'var(--accent)' }}>เสร็จสิ้น และประมวลผลต่อ</button>
                    </div>
                </div>
            )}
            <PlayerModal />
        </div>
    );
}
