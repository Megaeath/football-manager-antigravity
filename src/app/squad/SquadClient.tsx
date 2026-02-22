'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { bulkAssignTacticalPositions, clearAllTacticalPositions, clearTacticalPosition, updateTacticalPosition, updateTeamTactics } from '../actions';
import { calculateSuitability } from '../../lib/engine/suitability';
import type { PlayerAttributes } from '../../lib/engine/types';
import PlayerModal from '@/components/PlayerModal';

type PlayerProps = {
    id: string;
    name: string;
    naturalPosition: string;
    age: number;
    condition: number;
    morale: number;
    tacticalPosition: string | null;
    suitability: number;
    fitnessSuitability: number;
    rawAttributes: PlayerAttributes;
    goals: number;
    assists: number;
    apps: number;
    avgRating: number;
    birthDate: Date;
    retirementAge: number;
};

type MatchType = {
    id: string;
    date: Date;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    homeTeam: { name: string };
    awayTeam: { name: string };
    role: 'home' | 'away';
    opponent: { name: string };
    season: number;
};

const FORMATIONS: Record<string, { id: string, label: string }[]> = {
    '4-4-2': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' },
        { id: 'DC_R', label: 'CB (R)' },
        { id: 'DC_L', label: 'CB (L)' },
        { id: 'DL', label: 'LB' },
        { id: 'MR', label: 'RM' },
        { id: 'MC_R', label: 'CM (R)' },
        { id: 'MC_L', label: 'CM (L)' },
        { id: 'ML', label: 'LM' },
        { id: 'FW_R', label: 'ST (R)' },
        { id: 'FW_L', label: 'ST (L)' }
    ],
    '4-3-3': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' },
        { id: 'DC_R', label: 'CB (R)' },
        { id: 'DC_L', label: 'CB (L)' },
        { id: 'DL', label: 'LB' },
        { id: 'MC_R', label: 'CM (R)' },
        { id: 'MC', label: 'CM' },
        { id: 'MC_L', label: 'CM (L)' },
        { id: 'FW_R', label: 'RW' },
        { id: 'FW', label: 'ST' },
        { id: 'FW_L', label: 'LW' }
    ],
    '5-3-2': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' },
        { id: 'DC_R', label: 'CB (R)' },
        { id: 'DC', label: 'CB' },
        { id: 'DC_L', label: 'CB (L)' },
        { id: 'DL', label: 'LB' },
        { id: 'MC_R', label: 'CM (R)' },
        { id: 'MC', label: 'CM' },
        { id: 'MC_L', label: 'CM (L)' },
        { id: 'FW_R', label: 'ST (R)' },
        { id: 'FW_L', label: 'ST (L)' }
    ],
    '4-5-1': [
        { id: 'GK', label: 'GK' },
        { id: 'DR', label: 'RB' },
        { id: 'DC_R', label: 'CB (R)' },
        { id: 'DC_L', label: 'CB (L)' },
        { id: 'DL', label: 'LB' },
        { id: 'MR', label: 'RM' },
        { id: 'MC_R', label: 'CM (R)' },
        { id: 'MC', label: 'CM' },
        { id: 'MC_L', label: 'CM (L)' },
        { id: 'ML', label: 'LM' },
        { id: 'FW', label: 'ST' }
    ]
};

const POS_ORDER: Record<string, number> = {
    'GK': 0,
    'DR': 1, 'DL': 2, 'DC': 3,
    'DMR': 4, 'DML': 5, 'DMC': 6,
    'MR': 7, 'ML': 8, 'MC': 9,
    'AMR': 10, 'AML': 11, 'AMC': 12,
    'FWR': 13, 'FWL': 14, 'FWC': 15
};

export default function SquadClient({ teamId, players, currentTactics, matches = [], currentSeason = 1 }: {
    teamId: string,
    players: PlayerProps[],
    currentTactics: { formation: string, mentality: string, passing: string, tackling: string, attacking_focus: string, creative_freedom: string }
    matches?: MatchType[],
    currentSeason?: number
}) {
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<'name' | 'pos' | 'apps' | 'goals' | 'assists' | 'rating' | 'fit' | 'physical' | 'technical' | 'tactical' | 'mental' | 'power'>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [activeTab, setActiveTab] = useState<'squad' | 'matches'>('squad');
    const [selectedSeason, setSelectedSeason] = useState(currentSeason);
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromMatch = searchParams.get('from') === 'match';
    const matchId = searchParams.get('matchId');

    const handleStartMatch = async () => {
        if (!matchId) return;
        setLoading(true);
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'simulate_match', matchId })
            });
            const data = await res.json();
            if (data?.error) {
                alert('Simulation failed: ' + data.error);
                return;
            }
            router.push(`/match?matchId=${matchId}`);
        } catch (error) {
            console.error('Failed to start match', error);
            alert('Simulation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (playerId: string, posId: string, currentPosId?: string | null) => {
        setLoading(true);
        try {
            if (!posId) {
                if (currentPosId) {
                    await clearTacticalPosition(teamId, currentPosId);
                }
                return;
            }
            await updateTacticalPosition(playerId, teamId, posId);
        } catch (error) {
            console.error('Failed to assign player', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTactics = async (field: string, value: string) => {
        setLoading(true);
        try {
            await updateTeamTactics(teamId, { [field]: value });
        } catch (error) {
            console.error('Failed to update tactics', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        setLoading(true);
        try {
            await clearAllTacticalPositions(teamId);
        } catch (error) {
            console.error('Failed to clear all positions', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSelect = async () => {
        setLoading(true);
        try {
            const usedPlayers = new Set<string>();
            const assignments: { playerId: string; position: string }[] = [];

            for (const slot of slots) {
                const slotBase = slot.id.split('_')[0];
                const bestPlayer = sortedPlayers
                    .filter(p => !usedPlayers.has(p.id))
                    .map(p => ({
                        playerId: p.id,
                        position: slot.id,
                        suitability: Math.round(calculateSuitability(p.rawAttributes, slotBase) * Math.pow(Math.max(0, Math.min(1, p.condition / 100)), 1.2))
                    }))
                    .sort((a, b) => b.suitability - a.suitability)[0];

                if (bestPlayer) {
                    assignments.push({ playerId: bestPlayer.playerId, position: bestPlayer.position });
                    usedPlayers.add(bestPlayer.playerId);
                }
            }

            await bulkAssignTacticalPositions(teamId, assignments);
        } catch (error) {
            console.error('Failed to auto select lineup', error);
        } finally {
            setLoading(false);
        }
    };

    const getPlayerInPos = (posId: string) => players.find(p => p.tacticalPosition === posId);

    // Filter and sort players for dropdown
    const sortedPlayers = [...players].sort((a, b) => {
        const orderA = POS_ORDER[a.naturalPosition] ?? 99;
        const orderB = POS_ORDER[b.naturalPosition] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });

    const slots = FORMATIONS[currentTactics.formation] || FORMATIONS['4-4-2'];

    const getBasePosition = (posId?: string | null) => (posId ? posId.split('_')[0] : null);
    const getFitnessFactor = (condition: number) => Math.pow(Math.max(0, Math.min(1, condition / 100)), 1.2);
    const toHundred = (values: number[]) => {
        if (!values.length) return 0;
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.round((avg / 20) * 100);
    };
    const getPower = (p: PlayerProps) => {
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const suitability = calculateSuitability(p.rawAttributes, targetPos);
        return Math.round(suitability * getFitnessFactor(p.condition));
    };

    const getBasePower = (p: PlayerProps) => {
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const suitability = calculateSuitability(p.rawAttributes, targetPos);
        return Math.round(suitability);
    };

    const posGroupOrder: Record<string, number> = {
        GK: 0,
        DF: 1,
        MF: 2,
        FW: 3
    };
    const getGroup = (pos?: string | null) => {
        const p = pos || '';
        if (p.startsWith('GK')) return 'GK';
        if (p.startsWith('D')) return 'DF';
        if (p.startsWith('M') || p.startsWith('A')) return 'MF';
        return 'FW';
    };

    // Calculate team power from 11 best players
    const getTeamPower = () => {
        const playerPowers = players.map(p => {
            const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
            const suitability = calculateSuitability(p.rawAttributes, targetPos);
            return Math.round(suitability * getFitnessFactor(p.condition));
        });
        
        const bestPlayers = playerPowers.sort((a: number, b: number) => b - a).slice(0, 11);
        if (bestPlayers.length === 0) return 0;
        return Math.round(bestPlayers.reduce((sum: number, p: number) => sum + p, 0) / bestPlayers.length);
    };

    // Filter matches by season
    const seasonMatches = matches.filter(m => m.season === selectedSeason).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleSort = (key: typeof sortKey) => {
        if (key === 'pos') {
            setSortKey('pos');
            setSortDir('asc');
            return;
        }
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    return (
        <div>
            {fromMatch && matchId && (
                <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>พร้อมเริ่มแข่งแล้วใช่ไหม?</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>จัดทีมเสร็จแล้วกดเริ่มเกมได้เลย</p>
                    </div>
                    <button onClick={handleStartMatch} disabled={loading} className="btn btn-primary">
                        {loading ? 'กำลังเริ่มเกม...' : 'เริ่มแข่ง'}
                    </button>
                </div>
            )}

            {/* TACTICAL SETTINGS */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Formation</label>
                    <select
                        value={currentTactics.formation}
                        onChange={(e) => handleUpdateTactics('formation', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        {Object.keys(FORMATIONS).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Mentality</label>
                    <select
                        value={currentTactics.mentality}
                        onChange={(e) => handleUpdateTactics('mentality', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
                        <option value="DEFENSIVE">Defensive</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ATTACKING">Attacking</option>
                        <option value="ALL_OUT_ATTACK">All Out Attack</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Passing</label>
                    <select
                        value={currentTactics.passing}
                        onChange={(e) => handleUpdateTactics('passing', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        <option value="SHORT">Short</option>
                        <option value="MIXED">Mixed</option>
                        <option value="LONG">Long</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Tackling</label>
                    <select
                        value={currentTactics.tackling}
                        onChange={(e) => handleUpdateTactics('tackling', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        <option value="SOFT">Soft</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HARD">Hard</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Attacking Focus</label>
                    <select
                        value={currentTactics.attacking_focus}
                        onChange={(e) => handleUpdateTactics('attacking_focus', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        <option value="CENTER">Center</option>
                        <option value="MIXED">Mixed</option>
                        <option value="WINGS">Wings</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Creative Freedom</label>
                    <select
                        value={currentTactics.creative_freedom}
                        onChange={(e) => handleUpdateTactics('creative_freedom', e.target.value)}
                        style={{ padding: '4px' }}
                        disabled={loading}
                    >
                        <option value="STRICT">Strict</option>
                        <option value="NORMAL">Normal</option>
                        <option value="FREEDOM">Freedom</option>
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <button onClick={handleAutoSelect} disabled={loading} className="btn btn-sm" style={{ height: '32px' }}>
                        Auto Select
                    </button>
                    <button onClick={handleClearAll} disabled={loading} className="btn btn-sm" style={{ height: '32px' }}>
                        Clear All
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('squad')}
                    style={{
                        padding: '12px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'squad' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'squad' ? 'bold' : 'normal',
                        fontSize: '1rem',
                        color: activeTab === 'squad' ? 'var(--primary)' : 'inherit'
                    }}
                >
                    Squad ({players.length})
                </button>
                <button
                    onClick={() => setActiveTab('matches')}
                    style={{
                        padding: '12px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'matches' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'matches' ? 'bold' : 'normal',
                        fontSize: '1rem',
                        color: activeTab === 'matches' ? 'var(--primary)' : 'inherit'
                    }}
                >
                    Match History ({seasonMatches.length})
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {activeTab === 'matches' && (
                        <>
                            <label>Season:</label>
                            <select
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                            >
                                {[...new Set(matches.map(m => m.season))].sort((a, b) => b - a).map(season => (
                                    <option key={season} value={season}>Season {season}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'squad' && (
            <div>
                <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Squad List</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>Team Power: ⚡{getTeamPower()}</span>
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                            <th style={{ padding: '6px' }}>Select</th>
                            <th style={{ padding: '6px' }}>
                                <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Name</button>
                            </th>
                            <th style={{ padding: '6px' }}>
                                <button onClick={() => handleSort('pos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Pos</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('apps')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>App</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('goals')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>G</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('assists')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>A</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('rating')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Rtg</button>
                            </th>
                            <th style={{ padding: '6px' }}>
                                <button onClick={() => handleSort('fit')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Fit</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('physical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Physical</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('technical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Technical</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('tactical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Tactical</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('mental')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mental</button>
                            </th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>
                                <button onClick={() => handleSort('power')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Power</button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPlayers
                            .map(p => {
                            const physical = toHundred([
                                p.rawAttributes.pace,
                                p.rawAttributes.acceleration,
                                p.rawAttributes.stamina,
                                p.rawAttributes.strength,
                                p.rawAttributes.agility,
                                p.rawAttributes.balance
                            ]);
                            const technical = toHundred([
                                p.rawAttributes.handling,
                                p.rawAttributes.tackling,
                                p.rawAttributes.passing,
                                p.rawAttributes.shooting,
                                p.rawAttributes.heading,
                                p.rawAttributes.dribbling,
                                p.rawAttributes.crossing,
                                p.rawAttributes.setPieces
                            ]);
                            const tactical = toHundred([
                                p.rawAttributes.aggression,
                                p.rawAttributes.positioning,
                                p.rawAttributes.vision,
                                p.rawAttributes.bravery,
                                p.rawAttributes.leadership
                            ]);
                            const mental = toHundred([
                                p.rawAttributes.teamwork,
                                p.rawAttributes.composure
                            ]);
                            const power = getPower(p);
                            const basePower = getBasePower(p);
                            return { p, physical, technical, tactical, mental, power, basePower };
                        })
                        .sort((a, b) => {
                            if (sortKey === 'pos') {
                                const posA = getGroup(a.p.tacticalPosition || a.p.naturalPosition);
                                const posB = getGroup(b.p.tacticalPosition || b.p.naturalPosition);
                                if (posA !== posB) return posGroupOrder[posA] - posGroupOrder[posB];
                                return (a.p.tacticalPosition || a.p.naturalPosition).localeCompare(b.p.tacticalPosition || b.p.naturalPosition);
                            }
                            const dir = sortDir === 'asc' ? 1 : -1;
                            const num = (val: number) => val || 0;
                            switch (sortKey) {
                                case 'apps': return dir * (num(a.p.apps) - num(b.p.apps));
                                case 'goals': return dir * (num(a.p.goals) - num(b.p.goals));
                                case 'assists': return dir * (num(a.p.assists) - num(b.p.assists));
                                case 'rating': return dir * ((a.p.avgRating || 0) - (b.p.avgRating || 0));
                                case 'fit': return dir * (num(a.p.condition) - num(b.p.condition));
                                case 'physical': return dir * (a.physical - b.physical);
                                case 'technical': return dir * (a.technical - b.technical);
                                case 'tactical': return dir * (a.tactical - b.tactical);
                                case 'mental': return dir * (a.mental - b.mental);
                                case 'power': return dir * (a.power - b.power);
                                case 'name':
                                default:
                                    return dir * a.p.name.localeCompare(b.p.name);
                            }
                        })
                        .map(({ p, physical, technical, tactical, mental, power, basePower }) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #eee', background: p.tacticalPosition ? '#f0f4c3' : 'transparent' }}>
                                    <td style={{ padding: '6px' }}>
                                        <select
                                            value={p.tacticalPosition || ''}
                                            onChange={(e) => handleAssign(p.id, e.target.value, p.tacticalPosition)}
                                            disabled={loading}
                                            style={{ padding: '4px', border: '1px solid #ccc', width: '110px' }}
                                        >
                                            <option value="">-</option>
                                            {slots.map(slot => {
                                                const assigned = getPlayerInPos(slot.id);
                                                const suffix = assigned && assigned.id !== p.id ? ` (${assigned.name})` : '';
                                                return (
                                                    <option key={slot.id} value={slot.id}>
                                                        {slot.label}{suffix}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </td>
                                    <td style={{ padding: '6px' }}>
                                        <button
                                            onClick={() => router.push(`/squad?playerId=${p.id}`)}
                                            style={{ color: '#1565c0', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                        >
                                            {p.name}
                                        </button>
                                        {p.tacticalPosition && <strong style={{ color: '#558b2f' }}> ({p.tacticalPosition})</strong>}
                                    </td>
                                    <td style={{ padding: '6px' }}>{p.naturalPosition}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{p.apps}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{p.goals}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{p.assists}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: p.avgRating >= 7.0 ? 'var(--success)' : 'inherit' }}>
                                        {p.avgRating > 0 ? p.avgRating.toFixed(2) : '-'}
                                    </td>
                                    <td style={{ padding: '6px', color: p.condition < 80 ? '#c62828' : '#2e7d32' }}>{Math.round(p.condition)}%</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{physical}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{technical}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{tactical}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{mental}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: power >= 70 ? 'var(--success)' : power >= 60 ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        {power}
                                        {power < basePower && <span style={{ color: '#c62828', fontSize: '0.8rem' }}>⬇️</span>}
                                    </td>
                                </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}

            {activeTab === 'matches' && (
            <div className="card">
                <h3 style={{ marginTop: 0 }}>Match History - Season {selectedSeason}</h3>
                {seasonMatches.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>No matches played this season</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Opponent</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Result</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Score</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {seasonMatches.map((match) => {
                                const isHome = match.role === 'home';
                                const yourScore = isHome ? match.homeScore : match.awayScore;
                                const oppScore = isHome ? match.awayScore : match.homeScore;
                                const result = yourScore > oppScore ? 'W' : yourScore < oppScore ? 'L' : 'D';
                                const resultColor = result === 'W' ? '#16a34a' : result === 'L' ? '#dc2626' : '#f59e0b';
                                return (
                                    <tr key={match.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px' }}>{new Date(match.date).toLocaleDateString('th-TH')}</td>
                                        <td style={{ padding: '12px' }}>
                                            {isHome ? '🏠' : '✈️'} {match.opponent.name}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: resultColor, fontSize: '1.1rem' }}>
                                            {result}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {yourScore} - {oppScore}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => window.location.href = `/match?matchId=${match.id}`}
                                                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: '0.85rem' }}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            )}

            <PlayerModal />
        </div>
    );
}
