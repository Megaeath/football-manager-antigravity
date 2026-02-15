'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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
            const fixturesRes = await fetch(`/api/league/fixtures?date=${date}`);
            const fixtures = await fixturesRes.json();
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
    }, [queryMatchId]);

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
                if (data.autoAdvanced) {
                    // All matches were simulated and day was advanced
                    setMatchData(null);
                    fetchData();
                    window.dispatchEvent(new Event('game-date-updated'));
                } else if (data.requiresUserAction) {
                    // Other matches simulated, but user's match is today
                    fetchData(); // Refresh to show results of other matches and current user match
                    alert('มีการแข่งขันทีมของคุณในวันนี้! กรุณาดำเนินการต่อที่สนามแข่ง');
                }
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
    const showNextProcess = unplayedMatches.length === 0 || !isUserPlayingToday || userMatchPlayed;

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
                                    <button onClick={() => runSimulation(userMatch!.id)} disabled={loading} className="btn btn-primary" style={{ padding: '10px 24px' }}>เข้าสู่สนาม</button>
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
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{matchData.homeTeamName}</div>
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
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{matchData.awayTeamName}</div>
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
                                <StatRow label="Possession" homeVal={matchData.teamStats.home.possession} awayVal={matchData.teamStats.away.possession} isPercentage />
                                <StatRow label="Shots (On Target)" homeVal={matchData.teamStats.home.shotsOnTarget} awayVal={matchData.teamStats.away.shotsOnTarget} />
                                <StatRow label="Pass Accuracy"
                                    homeVal={Math.round((matchData.teamStats.home.passesCompleted / (matchData.teamStats.home.passesAttempted || 1)) * 100)}
                                    awayVal={Math.round((matchData.teamStats.away.passesCompleted / (matchData.teamStats.away.passesAttempted || 1)) * 100)}
                                    isPercentage
                                />
                                <StatRow label="Fouls" homeVal={matchData.teamStats.home.fouls} awayVal={matchData.teamStats.away.fouls} inverse />
                                <StatRow label="Yellow Cards" homeVal={matchData.teamStats.home.yellowCards} awayVal={matchData.teamStats.away.yellowCards} inverse />
                                <StatRow label="Corners" homeVal={matchData.teamStats.home.corners} awayVal={matchData.teamStats.away.corners} />
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                            default: return '●';
                                        }
                                    };

                                    return (
                                        <div key={i} style={{
                                            padding: '12px 16px',
                                            background: '#f1f5f9',
                                            borderRadius: '8px',
                                            borderLeft: `4px solid ${e.teamId === matchData.homeTeamId ? 'var(--primary)' : 'var(--accent)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <div style={{ minWidth: '40px', fontWeight: 'bold' }}>{e.minute}'</div>
                                            <div style={{ fontSize: '1.2rem' }}>{getEventIcon(e.type)}</div>
                                            <div style={{ flex: 1 }}>{e.text}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {(activeTab === 'home' || activeTab === 'away') && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                        <th style={{ padding: '12px' }}>POS</th>
                                        <th style={{ padding: '12px' }}>NAME</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>MIN</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>RAT</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>SHOTS</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>PASSES</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>TACKLES</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>EVENTS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(matchData.playerStats)
                                        .filter((p: any) => p.teamId === (activeTab === 'home' ? matchData.homeTeamId : matchData.awayTeamId))
                                        .sort((a: any, b: any) => {
                                            const aStarted = a.minutes > 0;
                                            const bStarted = b.minutes > 0;
                                            if (aStarted !== bStarted) return aStarted ? -1 : 1;
                                            return (a.positionOrder || 99) - (b.positionOrder || 99);
                                        })
                                        .map((p: any) => {
                                            const isMotM = p.playerId === matchData.motmPlayerId;
                                            return (
                                                <tr key={p.playerId} style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    opacity: p.minutes === 0 ? 0.5 : 1,
                                                    background: isMotM ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent'
                                                }}>
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.position}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Link href={`/player/${p.playerId}`} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                                                                {p.name}
                                                            </Link>
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
                                                        {p.minutes > 0 ? `${p.shotsOnTarget}/${p.shots}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.passesCompleted}/${p.passesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                                                        {p.minutes > 0 ? `${p.tacklesWon}/${p.tacklesAttempted}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                            {Array(p.goals).fill(0).map((_, i) => <span key={`g-${i}`}>⚽</span>)}
                                                            {Array(p.assists).fill(0).map((_, i) => <span key={`a-${i}`}>🅰️</span>)}
                                                            {Array(p.yellowCards).fill(0).map((_, i) => <span key={`y-${i}`}>🟨</span>)}
                                                            {Array(p.redCards).fill(0).map((_, i) => <span key={`r-${i}`}>🟥</span>)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: '#f8fafc', textAlign: 'center' }}>
                        <button onClick={() => setMatchData(null)} className="btn btn-primary" style={{ background: 'var(--accent)' }}>เสร็จสิ้น และประมวลผลต่อ</button>
                    </div>
                </div>
            )}
        </div>
    );
}
