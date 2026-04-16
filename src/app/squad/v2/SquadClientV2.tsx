'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    autoAssignTeamJerseyNumbers, 
    bulkAssignTacticalPositions, 
    clearAllTacticalPositions, 
    clearTacticalPosition, 
    updatePlayerJerseyNumber, 
    updateTacticalPosition, 
    updateTeamTactics 
} from '@/app/actions';
import { calculatePlayerPower } from '@/lib/engine/playerPower';
import PlayerModal from '@/components/PlayerModal';
import TacticsTabs from '@/components/TacticsTabs';
import MatchPrepTab from '@/components/MatchPrepTab';

// Constants
const FORMATIONS: Record<string, { id: string, label: string }[]> = {
    '4-4-2': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' }, { id: 'DC_R', label: 'CB (R)' }, { id: 'DC_L', label: 'CB (L)' }, { id: 'DL', label: 'LB' },
        { id: 'MR', label: 'RM' }, { id: 'MC_R', label: 'CM (R)' }, { id: 'MC_L', label: 'CM (L)' }, { id: 'ML', label: 'LM' },
        { id: 'FW_R', label: 'ST (R)' }, { id: 'FW_L', label: 'ST (L)' }
    ],
    '4-3-3': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' }, { id: 'DC_R', label: 'CB (R)' }, { id: 'DC_L', label: 'CB (L)' }, { id: 'DL', label: 'LB' },
        { id: 'MC_R', label: 'CM (R)' }, { id: 'MC', label: 'CM' }, { id: 'MC_L', label: 'CM (L)' },
        { id: 'FW_R', label: 'RW' }, { id: 'FW', label: 'ST' }, { id: 'FW_L', label: 'LW' }
    ],
    '4-5-1': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' }, { id: 'DC_R', label: 'CB (R)' }, { id: 'DC_L', label: 'CB (L)' }, { id: 'DL', label: 'LB' },
        { id: 'MR', label: 'RM' }, { id: 'MC_R', label: 'CM (R)' }, { id: 'MC', label: 'CM' }, { id: 'MC_L', label: 'CM (L)' }, { id: 'ML', label: 'LM' },
        { id: 'FW', label: 'ST' }
    ],
    '3-4-3': [
        { id: 'GK', label: 'GK' },
        { id: 'DC_R', label: 'CB (R)' }, { id: 'DC_C', label: 'CB (C)' }, { id: 'DC_L', label: 'CB (L)' },
        { id: 'MR', label: 'RM' }, { id: 'MC_R', label: 'CM (R)' }, { id: 'MC_L', label: 'CM (L)' }, { id: 'ML', label: 'LM' },
        { id: 'FW_R', label: 'RW' }, { id: 'FW_C', label: 'ST' }, { id: 'FW_L', label: 'LW' }
    ],
    '3-5-2': [
        { id: 'GK', label: 'GK' },
        { id: 'DC_R', label: 'CB (R)' }, { id: 'DC_C', label: 'CB (C)' }, { id: 'DC_L', label: 'CB (L)' },
        { id: 'MR', label: 'RM' }, { id: 'MC_R', label: 'CM (R)' }, { id: 'MC_C', label: 'CM (C)' }, { id: 'MC_L', label: 'CM (L)' }, { id: 'ML', label: 'LM' },
        { id: 'FW_R', label: 'ST (R)' }, { id: 'FW_L', label: 'ST (L)' }
    ]
};

const POS_ORDER: Record<string, number> = {
    'GK': 0, 'GK_L': 0, 'GK_R': 0,
    'DR': 1, 'DL': 2, 'DC_R': 3, 'DC_L': 3, 'DC': 3, 'DC_C': 3,
    'MR': 4, 'ML': 5, 'MC_R': 6, 'MC_L': 6, 'MC': 6, 'MC_C': 6,
    'FW_R': 7, 'FW_L': 8, 'FW': 9, 'FW_C': 9, 'FW_RC': 9, 'FW_LC': 9
};

type PlayerProps = {
    id: string;
    name: string;
    transferStatus?: string | null;
    naturalPosition: string;
    age: number;
    condition: number;
    morale: number;
    suspensionMatchesRemaining: number;
    injuryWeeksRemaining: number;
    jerseyNumber?: number | null;
    tacticalPosition: string | null;
    suitability: number;
    fitnessSuitability: number;
    rawAttributes: any;
    goals: number;
    assists: number;
    apps: number;
    avgRating: number;
    marketValue: number;
    exp: number;
};

export default function SquadClientV2({ 
    teamId, teamName, players, currentTactics, matches = [], currentSeason = 1, upcomingMatch, opponentPlayers = [], transferHistory = [], inProcessTransfers = [], isUserTeam = true 
}: {
    teamId: string,
    teamName: string,
    players: PlayerProps[],
    currentTactics: { formation: string, mentality: string, passing: string, tackling: string, attacking_focus: string, creative_freedom: string }
    matches?: any[],
    currentSeason?: number,
    upcomingMatch?: any,
    opponentPlayers?: any[],
    transferHistory?: any[],
    inProcessTransfers?: any[],
    isUserTeam?: boolean,
}) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'squad' | 'tactics' | 'matches' | 'transfers'>('squad');
    const [sortKey, setSortKey] = useState<string>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [feedback, setFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const playerId = searchParams.get('playerId');

    // Derived Data
    const teamPower = useMemo(() => {
        const sorted = [...players].sort((a, b) => b.fitnessSuitability - a.fitnessSuitability).slice(0, 11);
        if (sorted.length === 0) return 0;
        return Math.round(sorted.reduce((acc, p) => acc + p.fitnessSuitability, 0) / sorted.length);
    }, [players]);

    const avgAge = useMemo(() => {
        if (players.length === 0) return 0;
        return (players.reduce((acc, p) => acc + p.age, 0) / players.length).toFixed(1);
    }, [players]);

    const nextOpponent = upcomingMatch ? (upcomingMatch.homeTeamId === teamId ? upcomingMatch.awayTeam.name : upcomingMatch.homeTeam.name) : 'No upcoming match';

    // Handlers
    const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedPlayersList = useMemo(() => {
        return [...players].sort((a, b) => {
            let valA: any = a[sortKey as keyof PlayerProps];
            let valB: any = b[sortKey as keyof PlayerProps];
            
            if (sortKey === 'pos') {
                valA = POS_ORDER[a.naturalPosition.split('_')[0]] ?? 99;
                valB = POS_ORDER[b.naturalPosition.split('_')[0]] ?? 99;
            }

            if (valA === valB) return a.name.localeCompare(b.name);
            const res = valA > valB ? 1 : -1;
            return sortDir === 'asc' ? res : -res;
        });
    }, [players, sortKey, sortDir]);

    const handleAutoAssign = async () => {
        if (!isUserTeam) return;
        setLoading(true);
        try {
            await autoAssignTeamJerseyNumbers(teamId);
            showFeedback('Jersey numbers auto-assigned');
            router.refresh();
        } catch (error) {
            showFeedback('Failed to assign numbers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClearTactics = async () => {
        if (!isUserTeam) return;
        setLoading(true);
        try {
            await clearAllTacticalPositions(teamId);
            showFeedback('Tactical positions cleared');
            router.refresh();
        } catch (error) {
            showFeedback('Failed to clear positions', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getConditionColor = (v: number) => {
        if (v >= 90) return '#22c55e';
        if (v >= 70) return '#f59e0b';
        return '#ef4444';
    };

    const getMoraleColor = (v: number) => {
        if (v >= 70) return '#3b82f6';
        if (v >= 40) return '#94a3b8';
        return '#ef4444';
    };

    const formatMoney = (v: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    };

    return (
        <div className="vanguard-shell">
            {/* Header / Top Bar */}
            <header className="vanguard-header">
                <div className="vanguard-brand">
                    <span className="vanguard-logo">V</span>
                    <div className="vanguard-brand-text">
                        <h1>SQUAD COMMAND</h1>
                        <p>{teamName} • v2.0 Tactical Interface</p>
                    </div>
                </div>

                <div className="vanguard-stats">
                    <div className="vanguard-stat-item">
                        <label>TEAM POWER</label>
                        <span style={{ color: '#22c55e' }}>{teamPower}</span>
                    </div>
                    <div className="vanguard-stat-item">
                        <label>AVG AGE</label>
                        <span>{avgAge}</span>
                    </div>
                    <div className="vanguard-stat-item">
                        <label>NEXT FIXTURE</label>
                        <span className="vanguard-next-match">{nextOpponent}</span>
                    </div>
                </div>

                <div className="vanguard-actions">
                    <button className="vanguard-btn secondary" onClick={() => router.push('/')}>DASHBOARD</button>
                    <button className="vanguard-btn primary" onClick={handleAutoAssign}>AUTO-JERSEY</button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="vanguard-main">
                {/* Tabs Sidebar */}
                <nav className="vanguard-nav">
                    <button className={activeTab === 'squad' ? 'active' : ''} onClick={() => setActiveTab('squad')}>
                        <span className="nav-icon">⚏</span> SQUAD LIST
                    </button>
                    <button className={activeTab === 'tactics' ? 'active' : ''} onClick={() => setActiveTab('tactics')}>
                        <span className="nav-icon">⌖</span> STRATEGY
                    </button>
                    <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}>
                        <span className="nav-icon">⏱</span> FIXTURES
                    </button>
                    <button className={activeTab === 'transfers' ? 'active' : ''} onClick={() => setActiveTab('transfers')}>
                        <span className="nav-icon">⇄</span> MARKET
                    </button>

                    <div className="nav-footer">
                        <div className="current-status">
                            <div className="pulse-dot"></div>
                            OPERATIONAL
                        </div>
                    </div>
                </nav>

                {/* Content Panel */}
                <section className="vanguard-content">
                    {feedback && (
                        <div className={`vanguard-feedback ${feedback.type}`}>
                            {feedback.message}
                        </div>
                    )}

                    {activeTab === 'squad' && (
                        <div className="vanguard-squad-view">
                            <div className="squad-header-actions">
                                <h2>REGULAR SEASON ROSTER</h2>
                                <div className="sort-controls">
                                    <span className="label">SORT BY:</span>
                                    <select value={sortKey} onChange={(e) => handleSort(e.target.value)}>
                                        <option value="pos">POSITION</option>
                                        <option value="fitnessSuitability">POWER</option>
                                        <option value="age">AGE</option>
                                        <option value="avgRating">RATING</option>
                                        <option value="marketValue">VALUE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="vanguard-player-grid">
                                {sortedPlayersList.map(p => (
                                    <div 
                                        key={p.id} 
                                        className={`player-card ${p.tacticalPosition ? 'selected' : ''}`}
                                        onClick={() => router.push(`/squad/v2?playerId=${p.id}`)}
                                    >
                                        <div className="card-top">
                                            <span className="jersey">{p.jerseyNumber || '??'}</span>
                                            <div className="pos-badge">{p.naturalPosition.split('_')[0]}</div>
                                            {p.tacticalPosition && <div className="tactical-badge">1ST XI</div>}
                                        </div>

                                        <div className="card-identity">
                                            <h3 className="name">{p.name.toUpperCase()}</h3>
                                            <p className="age">{p.age} YEARS OLD</p>
                                        </div>

                                        <div className="card-stats-grid">
                                            <div className="stat-box">
                                                <label>POWER</label>
                                                <span>{p.fitnessSuitability}</span>
                                            </div>
                                            <div className="stat-box">
                                                <label>RATING</label>
                                                <span>{p.avgRating?.toFixed(1) || '0.0'}</span>
                                            </div>
                                            <div className="stat-box">
                                                <label>GOALS</label>
                                                <span>{p.goals}</span>
                                            </div>
                                            <div className="stat-box">
                                                <label>VALUE</label>
                                                <span className="value">{formatMoney(p.marketValue)}</span>
                                            </div>
                                        </div>

                                        <div className="card-status-bars">
                                            <div className="status-item">
                                                <div className="label-row">
                                                    <span>CONDITION</span>
                                                    <span>{p.condition}%</span>
                                                </div>
                                                <div className="bar-bg">
                                                    <div className="bar-fill" style={{ width: `${p.condition}%`, background: getConditionColor(p.condition) }}></div>
                                                </div>
                                            </div>
                                            <div className="status-item">
                                                <div className="label-row">
                                                    <span>MORALE</span>
                                                    <span>{p.morale}%</span>
                                                </div>
                                                <div className="bar-bg">
                                                    <div className="bar-fill" style={{ width: `${p.morale}%`, background: getMoraleColor(p.morale) }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        {p.injuryWeeksRemaining > 0 && <div className="status-overlay injury">INJURED ({p.injuryWeeksRemaining}W)</div>}
                                        {p.suspensionMatchesRemaining > 0 && <div className="status-overlay suspension">SUSPENDED ({p.suspensionMatchesRemaining}M)</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tactics' && (
                        <div className="vanguard-tactics-view">
                            <div className="tactics-header">
                                <h2>TACTICAL ENGINE</h2>
                                <button className="vanguard-btn danger sm" onClick={handleClearTactics}>RESET BOARD</button>
                            </div>
                            <div className="tactics-container">
                                <TacticsTabs 
                                    teamId={teamId} 
                                    formation={currentTactics.formation} 
                                    players={players as any}
                                    mentality={currentTactics.mentality}
                                    passing={currentTactics.passing}
                                    tackling={currentTactics.tackling}
                                    attacking_focus={currentTactics.attacking_focus}
                                    creative_freedom={currentTactics.creative_freedom}
                                    isUserTeam={isUserTeam}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <div className="vanguard-matches-view">
                            <h2>MATCH HISTORY</h2>
                            <div className="matches-list">
                                {matches.map((m: any) => (
                                    <div key={m.id} className="match-row">
                                        <div className="match-date">{new Date(m.date).toLocaleDateString()}</div>
                                        <div className="match-teams">
                                            <span className={m.role === 'home' ? 'us' : ''}>{m.homeTeam.name}</span>
                                            <div className="score-badge">
                                                {m.homeScore} - {m.awayScore}
                                            </div>
                                            <span className={m.role === 'away' ? 'us' : ''}>{m.awayTeam.name}</span>
                                        </div>
                                        <div className="match-status">{m.isPlayed ? 'FINAL' : 'UPCOMING'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'transfers' && (
                        <div className="vanguard-transfers-view">
                            <h2>TRANSFER OVERSIGHT</h2>
                            <div className="transfer-metrics">
                                <div className="metric-card">
                                    <label>TRANSFER ACTIVITY</label>
                                    <span>{transferHistory.length} EVENTS</span>
                                </div>
                                <div className="metric-card">
                                    <label>PENDING BIDS</label>
                                    <span>{inProcessTransfers.length} PENDING</span>
                                </div>
                            </div>
                            <div className="transfer-table-container">
                                <table className="vanguard-table">
                                    <thead>
                                        <tr>
                                            <th>PLAYER</th>
                                            <th>DATE</th>
                                            <th>FROM</th>
                                            <th>TO</th>
                                            <th>FEE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transferHistory.map((t: any) => (
                                            <tr key={t.id}>
                                                <td>{t.player.name}</td>
                                                <td>{new Date(t.date).toLocaleDateString()}</td>
                                                <td>{t.fromTeam?.name || 'FREE AGENT'}</td>
                                                <td>{t.toTeam.name}</td>
                                                <td className="fee">{formatMoney(t.fee)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Modals */}
            {playerId && (
                <PlayerModal 
                    playerId={playerId} 
                    onClose={() => router.push('/squad/v2')} 
                    isUserTeam={isUserTeam}
                    teamId={teamId}
                />
            )}

            <style jsx global>{`
                :root {
                    --vanguard-bg: #0a0b0d;
                    --vanguard-surface: #12141a;
                    --vanguard-border: rgba(255, 255, 255, 0.08);
                    --vanguard-primary: #22c55e;
                    --vanguard-secondary: #3b82f6;
                    --vanguard-text: #e2e8f0;
                    --vanguard-muted: #64748b;
                    --vanguard-danger: #ef4444;
                }

                .vanguard-shell {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: var(--vanguard-bg);
                    color: var(--vanguard-text);
                    font-family: 'Geist', 'Inter', 'JetBrains Mono', monospace;
                }

                .vanguard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 2rem;
                    background: var(--vanguard-surface);
                    border-bottom: 2px solid var(--vanguard-secondary);
                    z-index: 100;
                }

                .vanguard-brand {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .vanguard-logo {
                    width: 40px;
                    height: 40px;
                    background: var(--vanguard-primary);
                    color: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 1.5rem;
                    border-radius: 4px;
                    clip-path: polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%);
                }

                .vanguard-brand-text h1 {
                    font-size: 1.25rem;
                    margin: 0;
                    letter-spacing: 0.1em;
                }

                .vanguard-brand-text p {
                    font-size: 0.75rem;
                    margin: 0;
                    color: var(--vanguard-muted);
                }

                .vanguard-stats {
                    display: flex;
                    gap: 3rem;
                }

                .vanguard-stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .vanguard-stat-item label {
                    font-size: 0.65rem;
                    color: var(--vanguard-muted);
                    letter-spacing: 0.1em;
                }

                .vanguard-stat-item span {
                    font-size: 1.15rem;
                    font-weight: 700;
                }

                .vanguard-next-match {
                    color: var(--vanguard-secondary);
                }

                .vanguard-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .vanguard-main {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                .vanguard-nav {
                    width: 240px;
                    background: #08090c;
                    border-right: 1px solid var(--vanguard-border);
                    display: flex;
                    flex-direction: column;
                    padding: 2rem 0;
                }

                .vanguard-nav button {
                    background: none;
                    border: none;
                    color: var(--vanguard-muted);
                    padding: 1rem 2rem;
                    text-align: left;
                    font-family: inherit;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: all 0.2s ease;
                }

                .vanguard-nav button:hover {
                    color: #fff;
                    background: rgba(255,255,255,0.03);
                }

                .vanguard-nav button.active {
                    color: var(--vanguard-primary);
                    background: rgba(34, 197, 94, 0.05);
                    border-left: 4px solid var(--vanguard-primary);
                }

                .nav-footer {
                    margin-top: auto;
                    padding: 2rem;
                }

                .current-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    color: var(--vanguard-primary);
                    background: rgba(34, 197, 94, 0.1);
                    padding: 0.5rem 1rem;
                    border-radius: 99px;
                }

                .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--vanguard-primary);
                    border-radius: 50%;
                    box-shadow: 0 0 10px var(--vanguard-primary);
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .vanguard-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 2.5rem;
                    position: relative;
                }

                .vanguard-feedback {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                }

                .vanguard-feedback.success { background: var(--vanguard-primary); color: #000; }
                .vanguard-feedback.error { background: var(--vanguard-danger); color: #fff; }

                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .squad-header-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .sort-controls {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 0.8rem;
                }

                .sort-controls select {
                    background: var(--vanguard-surface);
                    color: #fff;
                    border: 1px solid var(--vanguard-border);
                    padding: 0.4rem 1rem;
                    border-radius: 4px;
                    font-family: inherit;
                }

                .vanguard-player-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                }

                .player-card {
                    background: var(--vanguard-surface);
                    border: 1px solid var(--vanguard-border);
                    border-radius: 8px;
                    padding: 1.25rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .player-card:hover {
                    border-color: var(--vanguard-secondary);
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
                }

                .player-card.selected {
                    border-color: var(--vanguard-primary);
                    background: linear-gradient(135deg, #12141a 0%, #0d2a1a 100%);
                }

                .card-top {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .jersey {
                    font-size: 1.5rem;
                    font-weight: 900;
                    opacity: 0.3;
                }

                .pos-badge {
                    background: #1e293b;
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }

                .tactical-badge {
                    background: var(--vanguard-primary);
                    color: #000;
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.6rem;
                    font-weight: 800;
                    margin-left: auto;
                }

                .card-identity h3 {
                    font-size: 1.1rem;
                    margin: 0;
                    letter-spacing: 0.05em;
                    color: #fff;
                }

                .card-identity .age {
                    font-size: 0.65rem;
                    color: var(--vanguard-muted);
                    margin: 0.2rem 0 1rem 0;
                }

                .card-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .stat-box {
                    background: rgba(255,255,255,0.03);
                    padding: 0.5rem;
                    border-radius: 4px;
                }

                .stat-box label {
                    display: block;
                    font-size: 0.55rem;
                    color: var(--vanguard-muted);
                }

                .stat-box span {
                    font-size: 1rem;
                    font-weight: 700;
                }

                .stat-box span.value {
                    font-size: 0.8rem;
                    color: var(--vanguard-primary);
                }

                .status-item {
                    margin-bottom: 0.75rem;
                }

                .label-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.6rem;
                    margin-bottom: 0.25rem;
                    color: var(--vanguard-muted);
                }

                .bar-bg {
                    height: 4px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .bar-fill {
                    height: 100%;
                    transition: width 0.5s ease;
                }

                .status-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    pointer-events: none;
                }

                .status-overlay.injury { background: rgba(239, 68, 68, 0.8); }
                .status-overlay.suspension { background: rgba(245, 158, 11, 0.8); }

                .vanguard-btn {
                    padding: 0.6rem 1.5rem;
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }

                .vanguard-btn.primary { background: var(--vanguard-primary); color: #000; }
                .vanguard-btn.secondary { background: transparent; border-color: var(--vanguard-border); color: #fff; }
                .vanguard-btn.danger { background: var(--vanguard-danger); color: #fff; }
                .vanguard-btn.sm { padding: 0.3rem 1rem; font-size: 0.7rem; }

                .vanguard-btn:hover {
                    opacity: 0.9;
                    transform: scale(1.02);
                }

                .vanguard-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }

                .vanguard-table th {
                    text-align: left;
                    padding: 1rem;
                    border-bottom: 2px solid var(--vanguard-border);
                    color: var(--vanguard-muted);
                    font-size: 0.7rem;
                    letter-spacing: 0.1em;
                }

                .vanguard-table td {
                    padding: 1.25rem 1rem;
                    border-bottom: 1px solid var(--vanguard-border);
                }

                .vanguard-table tr:hover { background: rgba(255,255,255,0.02); }

                .fee { color: var(--vanguard-primary); font-weight: 700; }

                .match-row {
                    display: flex;
                    align-items: center;
                    padding: 1.5rem;
                    background: var(--vanguard-surface);
                    border: 1px solid var(--vanguard-border);
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }

                .match-teams {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 2rem;
                    font-weight: 700;
                }

                .score-badge {
                    background: #000;
                    padding: 0.5rem 1.5rem;
                    border-radius: 4px;
                    border: 1px solid var(--vanguard-secondary);
                    font-size: 1.25rem;
                }

                .us { color: var(--vanguard-primary); }

                .match-date { font-size: 0.75rem; color: var(--vanguard-muted); width: 120px; }
                .match-status { font-size: 0.7rem; color: var(--vanguard-secondary); width: 100px; text-align: right; }

                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: var(--vanguard-bg); }
                ::-webkit-scrollbar-thumb { background: var(--vanguard-border); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: var(--vanguard-muted); }
            `}</style>
        </div>
    );
}
