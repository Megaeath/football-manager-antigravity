'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const infoRes = await fetch('/api/game/info');
            const info = await infoRes.json();
            setGameInfo(info);

            // Fetch fixtures for this date
            const date = new Date(info.currentDate).toISOString().split('T')[0];
            console.log('[Match Page] Fetching fixtures for date:', date, 'Season:', info.currentSeason);
            const fixturesRes = await fetch(`/api/league/fixtures?date=${date}`);
            const fixtures = await fixturesRes.json();
            console.log('[Match Page] Found', fixtures.length, 'matches for', date);
            setTodaysMatches(fixtures);

            // If matchId in URL, fetch that specific match
            if (queryMatchId) {
                const matchRes = await fetch(`/api/match/${queryMatchId}`);
                const match = await matchRes.json();
                if (!match.error) {
                    setMatchData(match);
                }
            }
        } catch (e) {
            console.error('Failed to fetch match day data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [queryMatchId]); // Re-fetch when matchId changes
    
    // Also fetch on mount to ensure initial data load
    useEffect(() => {
        fetchData();
    }, []);

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
                <div style={{ flex: 1, textAlign: 'right', fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1.1rem' }}>
                    {homeVal}{isPercentage ? '%' : ''}
                </div>
                <div style={{ width: '160px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    {label}
                </div>
                <div style={{ flex: 1, textAlign: 'left', fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1.1rem' }}>
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
                    <div style={{ flex: 1, textAlign: 'left', fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1.2rem' }}>
                        {homeVal}{isPercentage ? '%' : ''}
                    </div>
                    <div style={{ width: '160px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>
                        {label}
                    </div>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1.2rem' }}>
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
                    <div style={{ fontWeight: homeWin ? 'bold' : 'normal', fontSize: '1.1rem', minWidth: '40px', textAlign: 'right' }}>
                        {homeVal}{isPercentage ? '%' : ''}
                    </div>
                    <div style={{
                        width: '80px',
                        height: '24px',
                        background: homeWin ? '#10b981' : '#ef4444',
                        borderRadius: '4px',
                        transition: 'all 0.3s ease'
                    }} />
                </div>
                <div style={{ width: '140px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {label}
                </div>
                <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                    <div style={{
                        width: '80px',
                        height: '24px',
                        background: awayWin ? '#10b981' : '#ef4444',
                        borderRadius: '4px',
                        transition: 'all 0.3s ease'
                    }} />
                    <div style={{ fontWeight: awayWin ? 'bold' : 'normal', fontSize: '1.1rem', minWidth: '40px', textAlign: 'left' }}>
                        {awayVal}{isPercentage ? '%' : ''}
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', margin: 0 }}>⚽ วันแข่งขัน (Match Day)</h2>
                    <p style={{ color: 'var(--muted)', marginTop: '4px' }}>
                        {new Date(gameInfo.currentDate).toLocaleDateString('th-TH', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                    </p>
                </div>

                {showNextProcess && (
                    <button onClick={nextProcess} disabled={loading} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem', background: 'var(--accent)' }}>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', background: 'white' }}>
                                <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: '1.4rem' }}>{userMatch?.homeTeam.name}</div>
                                <div style={{ margin: '0 2rem', background: 'var(--primary)', color: 'white', padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '1.1rem' }}>VS</div>
                                <div style={{ flex: 1, textAlign: 'left', fontWeight: 'bold', fontSize: '1.4rem' }}>{userMatch?.awayTeam.name}</div>
                                <div style={{ marginLeft: '2rem' }}>
                                    <button
                                        onClick={() => router.push(`/squad?from=match&matchId=${userMatch!.id}`)}
                                        disabled={loading}
                                        className="btn btn-primary"
                                        style={{ padding: '10px 24px' }}
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
                                {unplayedMatches.filter(m => m.id !== userMatch?.id).map(m => (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', opacity: isUserPlayingToday && !userMatchPlayed ? 0.7 : 1 }}>
                                        <div style={{ flex: 1, textAlign: 'right', fontWeight: '500' }}>{m.homeTeam.name}</div>
                                        <div style={{ margin: '0 1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>vs</div>
                                        <div style={{ flex: 1, textAlign: 'left', fontWeight: '500' }}>{m.awayTeam.name}</div>
                                        <div style={{ marginLeft: '1rem' }}>
                                            <button onClick={() => runSimulation(m.id)} disabled={loading} className="btn btn-sm">จำลอง</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MATCH RESULTS (IF PLAYED) */}
            {matchData && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sidebar-bg)', color: '#fff', padding: '2.5rem', textAlign: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', marginBottom: '4px' }}>HOME</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{matchData.homeTeamName}</div>
                            {/* Home Team Goals */}
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.8' }}>
                                {(matchData.events || [])
                                    .filter((e: any) => e.type === 'GOAL' && e.teamId === matchData.homeTeam?.id)
                                    .map((e: any, idx: number) => {
                                        const playerName = e.playerName || e.text?.split(' scored')?.[0] || 'Unknown';
                                        return (
                                            <div key={idx}>
                                                {playerName} {e.minute}'
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '4rem', fontWeight: 'bold', letterSpacing: '8px', position: 'relative', display: 'inline-block' }}>
                                {matchData.homeScore} - {matchData.awayScore}
                                {matchData.motmPlayerId && (
                                    <span title="Man of the Match awarding" style={{ position: 'absolute', top: '-10px', right: '-40px', fontSize: '2rem' }}>🌟</span>
                                )}
                            </div>
                            <div style={{ opacity: 0.7, textTransform: 'uppercase', fontSize: '0.8rem', marginTop: '10px' }}>Full Time Result</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, textTransform: 'uppercase', marginBottom: '4px' }}>AWAY</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{matchData.awayTeamName}</div>
                            {/* Away Team Goals */}
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.8' }}>
                                {(matchData.events || [])
                                    .filter((e: any) => e.type === 'GOAL' && e.teamId === matchData.awayTeam?.id)
                                    .map((e: any, idx: number) => {
                                        const playerName = e.playerName || e.text?.split(' scored')?.[0] || 'Unknown';
                                        return (
                                            <div key={idx}>
                                                {playerName} {e.minute}'
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        {['stats', 'events', 'home', 'away'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                style={{
                                    flex: 1, padding: '1rem', border: 'none',
                                    background: activeTab === tab ? '#fff' : 'transparent',
                                    borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                    color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                                    fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {tab === 'home' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>HOME</span>
                                        <span style={{ fontSize: '0.9rem' }}>{matchData.homeTeamName}</span>
                                    </div>
                                ) : tab === 'away' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>AWAY</span>
                                        <span style={{ fontSize: '0.9rem' }}>{matchData.awayTeamName}</span>
                                    </div>
                                ) : tab.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '2rem' }}>
                        {activeTab === 'stats' && (
                            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
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
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                            gap: '16px',
                                            padding: '8px 0',
                                            borderBottom: i < matchData.events.length - 1 ? '1px solid #e5e7eb' : 'none'
                                        }}>
                                            {/* Left side - Home team events */}
                                            <div style={{ 
                                                flex: 1, 
                                                textAlign: 'right',
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                alignItems: 'center',
                                                gap: '8px',
                                                paddingRight: '8px'
                                            }}>
                                                {isHomeTeam && (
                                                    <>
                                                        <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                                                            {displayText}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem' }}>{getEventIcon(e.type)}</div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Center - Time */}
                                            <div style={{
                                                minWidth: '60px',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '1rem',
                                                color: '#6b7280',
                                                background: '#f3f4f6',
                                                padding: '6px 12px',
                                                borderRadius: '20px'
                                            }}>
                                                {e.minute}'
                                            </div>

                                            {/* Right side - Away team events */}
                                            <div style={{ 
                                                flex: 1, 
                                                textAlign: 'left',
                                                display: 'flex',
                                                justifyContent: 'flex-start',
                                                alignItems: 'center',
                                                gap: '8px',
                                                paddingLeft: '8px'
                                            }}>
                                                {!isHomeTeam && (
                                                    <>
                                                        <div style={{ fontSize: '1.2rem' }}>{getEventIcon(e.type)}</div>
                                                        <div style={{ fontSize: '0.9rem', color: '#374151' }}>
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
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                        <th style={{ padding: '12px' }} title="Position">POS</th>
                                        <th style={{ padding: '12px' }} title="Player Name">NAME</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Minutes Played">MIN</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Match Rating">RAT</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Fitness Level">FIT</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Shots On Target/Total">SHO</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Passes Completed/Attempted">PAS</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Crosses Completed/Attempted">CRS</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Dribbles Won/Attempted">DRB</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Tackles Won/Attempted">TCK</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Free Kicks">FK</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Corners">C</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }} title="Throw-Ins">T</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const teamId = activeTab === 'home' ? matchData.homeTeamId : matchData.awayTeamId;
                                        const { subInIds, subOutNames } = getSubstitutionInfo(teamId);
                                        const subInOrder = new Map<string, number>();
                                        (matchData?.events || [])
                                            .filter((e: any) => e.type === 'SUB' && e.teamId === teamId && e.playerId)
                                            .forEach((e: any, idx: number) => subInOrder.set(e.playerId, idx));

                                        return Object.values(matchData.playerStats)
                                        .filter((p: any) => p.teamId === (activeTab === 'home' ? matchData.homeTeamId : matchData.awayTeamId))
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
                                                return a.name.localeCompare(b.name);
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
                                            return (
                                                <tr key={p.playerId} style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    opacity: (p.minutes === 0 || isSubOut) ? 0.5 : 1,
                                                    background: isMotM ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent'
                                                }}>
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.position}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <button 
                                                                onClick={() => router.push(`/match?matchId=${queryMatchId}&playerId=${p.playerId}`)}
                                                                style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                                            >
                                                                {p.name}
                                                            </button>
                                                            {isSubIn && <span title="Subbed On">🔼</span>}
                                                            {isSubOut && <span title="Subbed Off">🔽</span>}
                                                            {isMotM && <span title="Man of the Match">🌟</span>}
                                                            {p.goals > 0 && <span title="Goals">{'⚽'.repeat(p.goals)}</span>}
                                                            {p.assists > 0 && <span title="Assists">{'🅰️'.repeat(p.assists)}</span>}
                                                            {p.yellowCards > 0 && <span title="Yellow Card">🟨</span>}
                                                            {p.redCards > 0 && <span title="Red Card">🟥</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.minutes}'</td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: isMotM ? 'var(--accent)' : (p.minutes > 0 ? 'var(--primary)' : 'var(--muted)') }}>
                                                        {p.rating.toFixed(1)}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.fitnessEnd ?? 0}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.shotsOnTarget}/${p.shots}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.passesCompleted}/${p.passesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.crossesCompleted}/${p.crossesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.dribblesWon}/${p.dribblesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.tacklesWon}/${p.tacklesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? p.freeKicks || 0 : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? p.corners || 0 : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? p.throws || 0 : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
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
