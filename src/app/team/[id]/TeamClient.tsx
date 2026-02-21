'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { calculateSuitability } from '@/lib/engine/suitability';
import type { PlayerAttributes } from '@/lib/engine/types';
import { BreadcrumbRegister } from '@/components/BreadcrumbContext';
import PlayerModal from '@/components/PlayerModal';

interface Player {
    id: string;
    name: string;
    naturalPosition: string;
    tacticalPosition: string | null;
    apps: number;
    goals: number;
    assists: number;
    avgRating: number;
    condition: number;
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
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
}

interface Match {
    id: string;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    homeTeam: { name: string };
    awayTeam: { name: string };
    role: 'home' | 'away';
    opponent: { name: string };
}

interface Team {
    id: string;
    name: string;
    location: string;
    founded: number;
    country: string;
    players: Player[];
}

export default function TeamClient({ team, matches }: { team: Team; matches: Match[] }) {
    const router = useRouter();
    const [sortKey, setSortKey] = useState<'name' | 'pos' | 'apps' | 'goals' | 'assists' | 'rating' | 'fit' | 'physical' | 'technical' | 'tactical' | 'mental' | 'power'>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const getBasePosition = (posId?: string | null) => (posId ? posId.split('_')[0] : null);
    const getFitnessFactor = (condition: number) => Math.pow(Math.max(0, Math.min(1, condition / 100)), 1.2);
    const toHundred = (values: number[]) => {
        if (!values.length) return 0;
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.round((avg / 20) * 100);
    };
    const buildAttributes = (p: Player): PlayerAttributes => ({
        handling: p.handling,
        tackling: p.tackling,
        passing: p.passing,
        shooting: p.shooting,
        heading: p.heading,
        dribbling: p.dribbling,
        crossing: p.crossing,
        setPieces: p.setPieces,
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
        balance: p.balance
    });
    const getPower = (p: Player) => {
        const attrs = buildAttributes(p);
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const suitability = calculateSuitability(attrs, targetPos);
        return Math.round(suitability * getFitnessFactor(p.condition));
    };

    const getBasePower = (p: Player) => {
        const attrs = buildAttributes(p);
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const suitability = calculateSuitability(attrs, targetPos);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <BreadcrumbRegister segment={team.id} name={team.name} />

            {/* Header */}
            <div className="card" style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{
                        width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
                    }}>
                        🏟️
                    </div>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>{team.name}</h1>
                        <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>
                            {team.location} • ก่อตั้ง {team.founded}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Squad */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        ทีมเตะ ({team.players.length} คน)
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                                <th style={{ padding: '12px' }}>
                                    <button onClick={() => handleSort('pos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ตำแหน่ง</button>
                                </th>
                                <th style={{ padding: '12px' }}>
                                    <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ชื่อ</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('apps')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>เล่น</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('goals')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ประตู</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('assists')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>แอส</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('rating')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>เรต</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('fit')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ฟิต</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('physical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Physical</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('technical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Technical</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('tactical')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Tactical</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('mental')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mental</button>
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('power')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Power</button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...team.players]
                                .map(p => {
                                const attrs = buildAttributes(p);
                                const physical = toHundred([
                                    attrs.pace,
                                    attrs.acceleration,
                                    attrs.stamina,
                                    attrs.strength,
                                    attrs.agility,
                                    attrs.balance
                                ]);
                                const technical = toHundred([
                                    attrs.handling,
                                    attrs.tackling,
                                    attrs.passing,
                                    attrs.shooting,
                                    attrs.heading,
                                    attrs.dribbling,
                                    attrs.crossing,
                                    attrs.setPieces
                                ]);
                                const tactical = toHundred([
                                    attrs.aggression,
                                    attrs.positioning,
                                    attrs.vision,
                                    attrs.bravery,
                                    attrs.leadership
                                ]);
                                const mental = toHundred([
                                    attrs.teamwork,
                                    attrs.composure
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
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '12px' }}>
                                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                            {p.tacticalPosition || p.naturalPosition}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <button 
                                            onClick={() => router.push(`/team/${team.id}?playerId=${p.id}`)}
                                            style={{ fontWeight: '600', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                        >
                                            {p.name}
                                        </button>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.apps}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.goals}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.assists}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                        {p.avgRating > 0 ? p.avgRating.toFixed(2) : '-'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: p.condition < 80 ? 'var(--danger)' : 'var(--success)' }}>
                                        {Math.round(p.condition)}%
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{physical}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{technical}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{tactical}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{mental}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: power >= 70 ? 'var(--success)' : power >= 60 ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        {power}
                                        {power < basePower && <span style={{ color: '#c62828', fontSize: '0.8rem' }}>⬇️</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Match History */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>ประวัติการแข่ง</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {matches.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>ยังไม่มีข้อมูลการแข่ง</p>}
                        {matches.map(m => {
                            const outcome = m.role === 'home'
                                ? (m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D')
                                : (m.awayScore > m.homeScore ? 'W' : m.awayScore < m.homeScore ? 'L' : 'D');

                            const color = outcome === 'W' ? 'var(--success)' : outcome === 'L' ? 'var(--danger)' : 'var(--accent)';

                            return (
                                <div key={m.id} style={{
                                    padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            {m.role === 'home' ? '🏠 Home' : '✈️ Away'}
                                        </div>
                                        <div style={{ fontWeight: 'bold', color: color }}>{outcome}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: '600' }}>vs {m.opponent.name}</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{m.homeScore} - {m.awayScore}</div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '8px' }}>
                                        {new Date(m.date).toLocaleDateString('th-TH')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <PlayerModal />
        </div>
    );
}
