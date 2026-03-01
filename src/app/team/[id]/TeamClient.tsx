'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { PlayerAttributes } from '@/lib/engine/types';
import { calculatePlayerPower, getEffectiveAttributes, getFitnessFactor, toPlayerAttributes } from '@/lib/engine/playerPower';
import { BreadcrumbRegister } from '@/components/BreadcrumbContext';
import PlayerModal from '@/components/PlayerModal';
import { getClubReputation } from '@/lib/reputation';
import TacticsTabs from '@/components/TacticsTabs';

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
    age: number;
    isRetired: boolean;
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    crossing: number;
    setPieces: number;
    throw: number;
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
    popularity: number;
    exp?: number;
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
    season: number;
}

interface Team {
    id: string;
    name: string;
    location: string;
    founded: number;
    country: string;
    reputation: number;
    players: Player[];
    formation: string;
    mentality: string;
    passing: string;
    tackling: string;
    attacking_focus: string;
    creative_freedom: string;
}

interface NextMatch {
    id: string;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: { name: string };
    awayTeam?: { name: string };
    homeTactics_formation?: string;
    homeTactics_mentality?: string;
    homeTactics_passing?: string;
    homeTactics_tackling?: string;
    homeTactics_attacking_focus?: string;
    homeTactics_creative_freedom?: string;
    awayTactics_formation?: string;
    awayTactics_mentality?: string;
    awayTactics_passing?: string;
    awayTactics_tackling?: string;
    awayTactics_attacking_focus?: string;
    awayTactics_creative_freedom?: string;
}

export default function TeamClient({ team, matches, currentSeason = 1, nextMatch, userTeamId = '' }: { team: Team; matches: Match[]; currentSeason?: number; nextMatch?: NextMatch; userTeamId?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [sortKey, setSortKey] = useState<'name' | 'pos' | 'apps' | 'goals' | 'assists' | 'rating' | 'fit' | 'physical' | 'technical' | 'tactical' | 'mental' | 'power' | 'marketValue'>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [activeTab, setActiveTab] = useState<'squad' | 'matches' | 'tactics'>('squad');
    const [selectedSeason, setSelectedSeason] = useState(currentSeason);

    // Check for tab query parameter
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'tactics' || tab === 'matches' || tab === 'squad') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const getBasePosition = (posId?: string | null) => (posId ? posId.split('_')[0] : null);
    const toHundred = (values: number[]) => {
        if (!values.length) return 0;
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.round((avg / 20) * 100);
    };
    const buildAttributes = (p: Player): PlayerAttributes => toPlayerAttributes({
        handling: p.handling,
        tackling: p.tackling,
        passing: p.passing,
        shooting: p.shooting,
        heading: p.heading,
        dribbling: p.dribbling,
        crossing: p.crossing,
        setPieces: p.setPieces,
        throw: p.throw,
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
    const getPowerBreakdown = (p: Player) => {
        const attrs = buildAttributes(p);
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const withExp = calculatePlayerPower({
            attributes: attrs,
            targetPosition: targetPos,
            condition: p.condition,
            exp: p.exp || 0
        });
        const withoutExp = calculatePlayerPower({
            attributes: attrs,
            targetPosition: targetPos,
            condition: p.condition,
            exp: 0
        });

        return {
            power: withExp.powerWithExp,
            basePowerNoFitness: withExp.powerWithExpNoFitness,
            noExpPower: withoutExp.powerWithExp,
            effectiveAttributes: getEffectiveAttributes(attrs, p.exp || 0)
        };
    };

    const getMarketValue = (p: Player, basePower: number) => {
        const basePrice = basePower * basePower * 1000;
        const ageMultiplier = p.age <= 25 ? 1.2 : p.age >= 32 ? 0.6 : 1.0;
        const playerPopularityMultiplier = 0.8 + (p.popularity / 100) * 1.0;
        const clubReputationMultiplier = 0.7 + (team.reputation / 100) * 0.8;
        const formMultiplier = 0.5 + ((p.avgRating || 0) / 10) * 1.0;

        let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
        marketValue = Math.min(marketValue, 200000000);
        return marketValue;
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
        const playerPowers = team.players.map(p => {
            const attrs = buildAttributes(p);
            const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
            return calculatePlayerPower({
                attributes: attrs,
                targetPosition: targetPos,
                condition: p.condition,
                exp: p.exp || 0
            }).powerWithExp;
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
                        {(() => {
                            const rep = getClubReputation(team.reputation || 0);
                            return (
                                <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.85)' }}>
                                    <span style={{ fontWeight: '600' }}>Reputation:</span>{' '}
                                    <span style={{ color: '#93c5fd', fontWeight: '700' }}>{rep.label} ({rep.score})</span>
                                    <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{rep.definition}</span>
                                </div>
                            );
                        })()}
                    </div>
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
                    Squad ({team.players.length})
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
                <button
                    onClick={() => setActiveTab('tactics')}
                    style={{
                        padding: '12px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'tactics' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'tactics' ? 'bold' : 'normal',
                        fontSize: '1rem',
                        color: activeTab === 'tactics' ? 'var(--primary)' : 'inherit'
                    }}
                >
                    Team Tactics
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Squad */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>ทีมเตะ ({team.players.length} คน)</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>Team Power: ⚡{getTeamPower()}</span>
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
                                <th style={{ padding: '12px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('marketValue')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Market Value</button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...team.players]
                                .map(p => {
                                const attrs = buildAttributes(p);
                                const breakdown = getPowerBreakdown(p);
                                const attrsForDisplay = breakdown.effectiveAttributes;
                                const physical = toHundred([
                                    attrsForDisplay.pace,
                                    attrsForDisplay.acceleration,
                                    attrsForDisplay.stamina,
                                    attrsForDisplay.strength,
                                    attrsForDisplay.agility,
                                    attrsForDisplay.balance
                                ]);
                                const technical = toHundred([
                                    attrsForDisplay.handling,
                                    attrsForDisplay.tackling,
                                    attrsForDisplay.passing,
                                    attrsForDisplay.shooting,
                                    attrsForDisplay.heading,
                                    attrsForDisplay.dribbling,
                                    attrsForDisplay.crossing,
                                    attrsForDisplay.setPieces
                                ]);
                                const tactical = toHundred([
                                    attrsForDisplay.aggression,
                                    attrsForDisplay.positioning,
                                    attrsForDisplay.vision,
                                    attrsForDisplay.bravery,
                                    attrsForDisplay.leadership
                                ]);
                                const mental = toHundred([
                                    attrsForDisplay.teamwork,
                                    attrsForDisplay.composure
                                ]);
                                const power = breakdown.power;
                                const basePowerNoFitness = breakdown.basePowerNoFitness;
                                const noExpPower = breakdown.noExpPower;
                                const marketValue = getMarketValue(p, basePowerNoFitness);
                                return { p, physical, technical, tactical, mental, power, basePowerNoFitness, noExpPower, marketValue };
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
                                    case 'marketValue': return dir * (a.marketValue - b.marketValue);
                                    case 'name':
                                    default:
                                        return dir * a.p.name.localeCompare(b.p.name);
                                }
                            })
                            .map(({ p, physical, technical, tactical, mental, power, basePowerNoFitness, noExpPower, marketValue }) => (
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
                                        {power > noExpPower && <span style={{ color: '#2e7d32', fontSize: '0.8rem' }}>⬆️</span>}
                                        {power < basePowerNoFitness && <span style={{ color: '#c62828', fontSize: '0.8rem' }}>⬇️</span>}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: 'var(--muted)' }}>
                                        {(marketValue / 1000000).toFixed(1)}M
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {activeTab === 'matches' && (
            <div className="card">
                <h3 style={{ marginTop: 0 }}>Match History - Season {selectedSeason}</h3>
                {seasonMatches.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>No matches played this season</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {seasonMatches.map((m) => {
                            const outcome = m.role === 'home'
                                ? (m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D')
                                : (m.awayScore > m.homeScore ? 'W' : m.awayScore < m.homeScore ? 'L' : 'D');

                            const color = outcome === 'W' ? 'var(--success)' : outcome === 'L' ? 'var(--danger)' : 'var(--accent)';

                            return (
                                <div key={m.id} style={{
                                    padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s'
                                }} onClick={() => window.location.href = `/match?matchId=${m.id}`}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            {m.role === 'home' ? '🏠 Home' : '✈️ Away'}
                                        </div>
                                        <div style={{ fontWeight: 'bold', color: color, fontSize: '1.1rem' }}>{outcome}</div>
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
                )}
            </div>
            )}

            {activeTab === 'tactics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Team Tactics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>3-Plan Tactics</h3>
                            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                Formation: {team.formation}
                            </span>
                        </div>
                        <TacticsTabs teamId={team.id} readOnly={team.id !== userTeamId} />
                    </div>
                </div>

                {/* Top 5 Performers */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        Top 5 Performers
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {team.players
                            .filter((p: any) => !p.isRetired)
                            .sort((a: any, b: any) => {
                                return (b.avgRating || 0) - (a.avgRating || 0);
                            })
                            .slice(0, 5)
                            .map((p: any, idx: number) => (
                                <div key={p.id} style={{
                                    padding: '12px',
                                    background: 'var(--hover-bg)',
                                    borderRadius: '6px',
                                    borderLeft: '4px solid var(--primary)',
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                                #{idx + 1}{' '}
                                                <button
                                                    onClick={() => router.push(`/team/${team.id}?playerId=${p.id}`)}
                                                    style={{ fontWeight: 'bold', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                                >
                                                    {p.name}
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                                {p.naturalPosition} • Age {p.age}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                                                ⚽ {p.goals} 🎯 {p.assists}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                Rating: {p.avgRating?.toFixed(1) || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
            )}

            <PlayerModal />
        </div>
    );
}
