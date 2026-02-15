'use client';

import { useState } from 'react';
import { updateTacticalPosition, updateTeamTactics } from '../actions';
import { calculateSuitability } from '../../lib/engine/suitability';
import Link from 'next/link';

type PlayerProps = {
    id: string;
    name: string;
    naturalPosition: string;
    age: number;
    condition: number;
    morale: number;
    tacticalPosition: string | null;
    suitability: number;
    rawAttributes: any;
    goals: number;
    assists: number;
    apps: number;
    avgRating: number;
    birthDate: Date;
    retirementAge: number;
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

export default function SquadClient({ teamId, players, currentTactics }: {
    teamId: string,
    players: PlayerProps[],
    currentTactics: { formation: string, mentality: string, passing: string, tackling: string }
}) {
    const [loading, setLoading] = useState(false);

    const handleAssign = async (posId: string, playerId: string) => {
        setLoading(true);
        await updateTacticalPosition(playerId, teamId, posId);
        setLoading(false);
    };

    const handleUpdateTactics = async (field: string, value: string) => {
        setLoading(true);
        await updateTeamTactics(teamId, { [field]: value });
        setLoading(false);
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

    return (
        <div>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>

                {/* TACTICS BOARD */}
                <div style={{ background: '#e8f5e9', padding: '2rem', borderRadius: '8px', border: '2px solid #4caf50' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: 0 }}>Starting XI</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {slots.map(slot => {
                            const currentPlayer = getPlayerInPos(slot.id);

                            return (
                                <div key={slot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                                    <div style={{ fontWeight: 'bold', width: '60px', color: '#333', fontSize: '0.9rem' }}>{slot.label}</div>
                                    <div style={{ flex: 1, margin: '0 1rem' }}>
                                        <select
                                            style={{ width: '100%', padding: '4px', border: '1px solid #ccc' }}
                                            value={currentPlayer ? currentPlayer.id : ''}
                                            onChange={(e) => handleAssign(slot.id, e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">-- Select Player --</option>
                                            {sortedPlayers.map(p => (
                                                <option
                                                    key={p.id}
                                                    value={p.id}
                                                    style={{ background: p.tacticalPosition ? '#e8f5e9' : '#fff' }}
                                                >
                                                    {p.tacticalPosition ? '✓ ' : ''}{p.name} ({p.naturalPosition}) {p.tacticalPosition && p.tacticalPosition !== slot.id ? `[${p.tacticalPosition}]` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ width: '40px', textAlign: 'right', fontSize: '0.8rem' }}>
                                        {currentPlayer ? (
                                            <span style={{
                                                color: calculateSuitability(currentPlayer.rawAttributes, slot.id.split('_')[0]) > 70 ? '#2e7d32' : '#c62828', fontWeight: 'bold'
                                            }}>
                                                {calculateSuitability(currentPlayer.rawAttributes, slot.id.split('_')[0])}%
                                            </span>
                                        ) : '-'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* SQUAD LIST */}
                <div>
                    <h3 style={{ marginTop: 0 }}>Squad List</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                                <th style={{ padding: '6px' }}>Name</th>
                                <th style={{ padding: '6px' }}>Pos</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>App</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>G</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>A</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>Rtg</th>
                                <th style={{ padding: '6px' }}>Fit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayers.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #eee', background: p.tacticalPosition ? '#f0f4c3' : 'transparent' }}>
                                    <td style={{ padding: '6px' }}>
                                        <Link href={`/player/${p.id}`} style={{ color: '#1565c0', textDecoration: 'none' }}>{p.name}</Link>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
