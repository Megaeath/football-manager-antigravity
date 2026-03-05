'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { bulkAssignTacticalPositions, clearAllTacticalPositions, clearTacticalPosition, updateTacticalPosition, updateTeamTactics } from '../actions';
import type { PlayerAttributes } from '../../lib/engine/types';
import { calculatePlayerPower, getFitnessFactor, getEffectiveAttributes } from '@/lib/engine/playerPower';
import { getExpBonus } from '@/lib/engine/experience';
import PlayerModal from '@/components/PlayerModal';
import TacticsTabs from '@/components/TacticsTabs';
import PlayerRolesTab from '@/components/PlayerRolesTab';

type PlayerProps = {
    id: string;
    name: string;
    naturalPosition: string;
    age: number;
    condition: number;
    morale: number;
    tacticalPosition: string | null;
    playerRole?: string | null;
    suitability: number;
    fitnessSuitability: number;
    rawAttributes: PlayerAttributes;
    goals: number;
    assists: number;
    apps: number;
    avgRating: number;
    birthDate: Date;
    retirementAge: number;
    popularity: number;
    clubReputation: number;
    marketValue: number;
    exp: number;
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

export default function SquadClient({ teamId, players, currentTactics, matches = [], currentSeason = 1, upcomingMatch }: {
    teamId: string,
    players: PlayerProps[],
    currentTactics: { formation: string, mentality: string, passing: string, tackling: string, attacking_focus: string, creative_freedom: string }
    matches?: MatchType[],
    currentSeason?: number,
    upcomingMatch?: {
        id: string;
        homeTeamId: string;
        awayTeamId: string;
        homeTeam: { id: string; name: string };
        awayTeam: { id: string; name: string };
    }
}) {
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<'name' | 'pos' | 'apps' | 'goals' | 'assists' | 'rating' | 'fit' | 'physical' | 'technical' | 'tactical' | 'mental' | 'exp' | 'power'>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [activeTab, setActiveTab] = useState<'squad' | 'matches' | 'tactics' | 'roles'>('squad');
    const [selectedSeason, setSelectedSeason] = useState(currentSeason);
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromMatch = searchParams.get('from') === 'match';
    const matchId = searchParams.get('matchId');

    const openPlayerModal = (playerId: string) => {
        router.push(`/squad?playerId=${playerId}`);
    };

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

            for (const slot of slots) {
                const slotBase = slot.id.split('_')[0];
                const slotGroup = getGroup(slotBase);

                const bestPlayer = sortedPlayers
                    .filter(p => !usedPlayers.has(p.id))
                    .map(p => {
                        const playerPower = calculatePlayerPower({
                            attributes: p.rawAttributes,
                            targetPosition: slotBase,
                            condition: p.condition,
                            exp: p.exp
                        }).powerWithExp;

                        const playerGroup = getGroup(p.naturalPosition);

                        // Apply heavy penalty if position group is different
                        // e.g. DF playing as FW will get a major penalty to avoid cross-position auto-selection
                        const groupDiff = Math.abs(posGroupOrder[slotGroup] - posGroupOrder[playerGroup]);
                        const penalty = groupDiff === 0 ? 0 : 40 * groupDiff; // 40 points penalty per group distance

                        return {
                            playerId: p.id,
                            position: slot.id,
                            suitability: playerPower - penalty
                        };
                    })
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

    const handleFormationChange = async (formation: string) => {
        setLoading(true);
        try {
            await updateTeamTactics(teamId, { formation });
        } catch (error) {
            console.error('Failed to update formation', error);
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
    const toHundred = (values: number[]) => {
        if (!values.length) return 0;
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.round((avg / 20) * 100);
    };
    const getPowerBreakdown = (p: PlayerProps) => {
        const targetPos = getBasePosition(p.tacticalPosition) || p.naturalPosition;
        const withExp = calculatePlayerPower({
            attributes: p.rawAttributes,
            targetPosition: targetPos,
            condition: p.condition,
            exp: p.exp
        });
        const withoutExp = calculatePlayerPower({
            attributes: p.rawAttributes,
            targetPosition: targetPos,
            condition: p.condition,
            exp: 0
        });

        return {
            power: withExp.powerWithExp,
            basePowerNoFitness: withExp.powerWithExpNoFitness,
            expBoostedPower: withExp.powerWithExp,
            noExpPower: withoutExp.powerWithExp
        };
    };

    const calculatePlayerOverall = (rawAttrs: PlayerAttributes) => {
        const technicalAvg = (
            (rawAttrs.passing || 10) + (rawAttrs.dribbling || 10) + (rawAttrs.shooting || 10) +
            (rawAttrs.crossing || 10) + (rawAttrs.heading || 10) + (rawAttrs.tackling || 10) +
            (rawAttrs.vision || 10)
        ) / 7;
        const mentalAvg = (
            (rawAttrs.bravery || 10) + (rawAttrs.leadership || 10) + (rawAttrs.positioning || 10) +
            (rawAttrs.composure || 10) + (rawAttrs.aggression || 10) + (rawAttrs.teamwork || 10)
        ) / 6;
        const physicalAvg = (
            (rawAttrs.acceleration || 10) + (rawAttrs.pace || 10) + (rawAttrs.strength || 10) +
            (rawAttrs.stamina || 10) + (rawAttrs.agility || 10) + (rawAttrs.balance || 10)
        ) / 6;
        return (technicalAvg + mentalAvg + physicalAvg) / 3;
    };

    const getMarketValue = (p: PlayerProps) => {
        // Use market value calculated on server
        return p.marketValue;
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
            return calculatePlayerPower({
                attributes: p.rawAttributes,
                targetPosition: targetPos,
                condition: p.condition,
                exp: p.exp
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
        <div>
            {fromMatch && matchId && upcomingMatch && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }} className="md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 style={{ margin: 0 }}>พร้อมเริ่มแข่งแล้วใช่ไหม?</h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
                                คู่แข่ง: <strong>{upcomingMatch.homeTeamId === teamId ? upcomingMatch.awayTeam.name : upcomingMatch.homeTeam.name}</strong>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }} className="md:flex-row">
                            <button
                                onClick={() => {
                                    const opponentId = upcomingMatch.homeTeamId === teamId ? upcomingMatch.awayTeamId : upcomingMatch.homeTeamId;
                                    router.push(`/team/${opponentId}?tab=tactics`);
                                }}
                                className="btn btn-secondary"
                                disabled={loading}
                                style={{ width: '100%' }}
                            >
                                🔍 ดูคู่แข่ง
                            </button>
                            <button onClick={handleStartMatch} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                                {loading ? 'กำลังเริ่มเกม...' : 'เริ่มแข่ง'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB NAVIGATION */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }} className="md:overflow-visible">
                <button
                    onClick={() => setActiveTab('squad')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'squad' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'squad' ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        color: activeTab === 'squad' ? 'var(--primary)' : 'inherit'
                    }}
                    className="text-sm md:text-base md:px-5"
                >
                    Squad ({players.length})
                </button>
                <button
                    onClick={() => setActiveTab('matches')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'matches' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'matches' ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        color: activeTab === 'matches' ? 'var(--primary)' : 'inherit'
                    }}
                    className="text-sm md:text-base md:px-5"
                >
                    Matches ({seasonMatches.length})
                </button>
                <button
                    onClick={() => setActiveTab('tactics')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'tactics' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'tactics' ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        color: activeTab === 'tactics' ? 'var(--primary)' : 'inherit'
                    }}
                    className="text-sm md:text-base md:px-5"
                >
                    ⚙️ Tactics
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'roles' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'roles' ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        color: activeTab === 'roles' ? 'var(--primary)' : 'inherit'
                    }}
                    className="text-sm md:text-base md:px-5"
                >
                    👥 Roles
                </button>
            </div>

            {activeTab === 'matches' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
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
                </div>
            )}

            {activeTab === 'squad' && (
                <div>
                    <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Squad List</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                Formation
                            </span>
                            <select
                                value={currentTactics.formation}
                                onChange={(e) => handleFormationChange(e.target.value)}
                                disabled={loading}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                            >
                                <option value="4-4-2">4-4-2</option>
                                <option value="4-3-3">4-3-3</option>
                                <option value="4-5-1">4-5-1</option>
                            </select>
                            <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>Team Power: ⚡{getTeamPower()}</span>
                            <button onClick={handleAutoSelect} disabled={loading} className="btn btn-sm">
                                Auto Select
                            </button>
                            <button onClick={handleClearAll} disabled={loading} className="btn btn-sm btn-secondary">
                                Clear All
                            </button>
                        </div>
                    </h3>
                    {/* Desktop Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }} className="hidden md:table">
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
                                    <button onClick={() => handleSort('exp')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>EXP</button>
                                </th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('power')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Power</button>
                                </th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('power')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>💎 Market Value</button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayers
                                .map(p => {
                                    const expBonus = getExpBonus(p.exp);
                                    const effectiveAttributes = getEffectiveAttributes(p.rawAttributes, p.exp);
                                    const physical = toHundred([
                                        effectiveAttributes.pace,
                                        effectiveAttributes.acceleration,
                                        effectiveAttributes.stamina,
                                        effectiveAttributes.strength,
                                        effectiveAttributes.agility,
                                        effectiveAttributes.balance
                                    ]);
                                    const technical = toHundred([
                                        effectiveAttributes.handling,
                                        effectiveAttributes.tackling,
                                        effectiveAttributes.passing,
                                        effectiveAttributes.shooting,
                                        effectiveAttributes.heading,
                                        effectiveAttributes.dribbling,
                                        effectiveAttributes.crossing,
                                        effectiveAttributes.setPieces,
                                        effectiveAttributes.throw
                                    ]);
                                    const tactical = toHundred([
                                        effectiveAttributes.aggression,
                                        effectiveAttributes.positioning,
                                        effectiveAttributes.vision,
                                        effectiveAttributes.bravery,
                                        effectiveAttributes.leadership
                                    ]);
                                    const mental = toHundred([
                                        effectiveAttributes.teamwork,
                                        effectiveAttributes.composure
                                    ]);
                                    const breakdown = getPowerBreakdown(p);
                                    return {
                                        p,
                                        physical,
                                        technical,
                                        tactical,
                                        mental,
                                        expBonus,
                                        power: breakdown.power,
                                        basePowerNoFitness: breakdown.basePowerNoFitness,
                                        expBoostedPower: breakdown.expBoostedPower,
                                        noExpPower: breakdown.noExpPower
                                    };
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
                                        case 'exp': return dir * (num(a.p.exp) - num(b.p.exp));
                                        case 'power': return dir * (a.power - b.power);
                                        case 'name':
                                        default:
                                            return dir * a.p.name.localeCompare(b.p.name);
                                    }
                                })
                                .map(({ p, physical, technical, tactical, mental, expBonus, power, basePowerNoFitness, expBoostedPower, noExpPower }) => (
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
                                                onClick={() => openPlayerModal(p.id)}
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
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: p.exp >= 500 ? 'var(--success)' : p.exp >= 300 ? 'var(--accent)' : 'inherit' }}>
                                            {p.exp} <span style={{ fontSize: '0.7rem', color: expBonus >= 0 ? 'var(--success)' : '#c62828' }}>({expBonus >= 0 ? '+' : ''}{expBonus})</span>
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: power >= 70 ? 'var(--success)' : power >= 60 ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            {power}
                                            {expBoostedPower > noExpPower && <span style={{ color: '#2e7d32', fontSize: '0.8rem' }}>⬆️</span>}
                                            {power < basePowerNoFitness && <span style={{ color: '#c62828', fontSize: '0.8rem' }}>⬇️</span>}
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'center' }}>
                                            <span style={{ background: '#fbbf24', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                ${(getMarketValue(p) / 1000000).toFixed(1)}M
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>

                    {/* Mobile Card List */}
                    <div className="flex flex-col gap-3 md:hidden">
                        <div className="mb-2 text-xs text-gray-500 uppercase font-semibold">POS NAME MIN RATING FIT POWER</div>
                        {sortedPlayers
                            .map(p => {
                                const breakdown = getPowerBreakdown(p);
                                const power = breakdown.power;
                                return { p, power };
                            })
                            .sort((a, b) => {
                                if (sortKey === 'pos') {
                                    const posOrderA = POS_ORDER[getBasePosition(a.p.tacticalPosition) || a.p.naturalPosition] ?? 999;
                                    const posOrderB = POS_ORDER[getBasePosition(b.p.tacticalPosition) || b.p.naturalPosition] ?? 999;
                                    return sortDir === 'asc' ? posOrderA - posOrderB : posOrderB - posOrderA;
                                }
                                if (sortKey === 'name') return sortDir === 'asc' ? a.p.name.localeCompare(b.p.name) : b.p.name.localeCompare(a.p.name);
                                if (sortKey === 'fit') return sortDir === 'asc' ? a.p.condition - b.p.condition : b.p.condition - a.p.condition;
                                if (sortKey === 'power') return sortDir === 'asc' ? a.power - b.power : b.power - a.power;
                                return 0;
                            })
                            .map(({ p, power }) => (
                                <div key={p.id} className="rounded-lg border border-[var(--border)] p-3 bg-[var(--card-bg)]">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={() => openPlayerModal(p.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', textAlign: 'left' }}
                                                className="font-semibold hover:text-[var(--primary)] truncate block w-full"
                                            >
                                                {p.name}
                                            </button>
                                            {p.tacticalPosition && <span className="text-xs text-green-600 font-semibold">({p.tacticalPosition})</span>}
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-400 text-white flex-shrink-0">
                                            ${(getMarketValue(p) / 1000000).toFixed(1)}M
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-gray-500">Pos:</span> <span className="font-semibold">{p.naturalPosition}</span></div>
                                        <div><span className="text-gray-500">Apps:</span> <span className="font-semibold">{p.apps}</span></div>
                                        <div><span className="text-gray-500">Rating:</span> <span className="font-semibold" style={{ color: p.avgRating >= 7.0 ? 'var(--success)' : 'inherit' }}>{p.avgRating > 0 ? p.avgRating.toFixed(2) : '-'}</span></div>
                                        <div><span className="text-gray-500">Fit:</span> <span className="font-semibold" style={{ color: p.condition < 80 ? '#c62828' : '#2e7d32' }}>{Math.round(p.condition)}%</span></div>
                                        <div><span className="text-gray-500">Power:</span> <span className="font-semibold" style={{ color: power >= 70 ? 'var(--success)' : power >= 60 ? 'var(--accent)' : 'inherit' }}>{power}</span></div>
                                        <div><span className="text-gray-500">G/A:</span> <span className="font-semibold">{p.goals}/{p.assists}</span></div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {activeTab === 'matches' && (
                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Match History - Season {selectedSeason}</h3>
                    {seasonMatches.length === 0 ? (
                        <p style={{ color: 'var(--muted)' }}>No matches played this season</p>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }} className="hidden md:table">
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

                            {/* Mobile Card List */}
                            <div className="flex flex-col gap-3 md:hidden">
                                {seasonMatches.map((match) => {
                                    const isHome = match.role === 'home';
                                    const yourScore = isHome ? match.homeScore : match.awayScore;
                                    const oppScore = isHome ? match.awayScore : match.homeScore;
                                    const result = yourScore > oppScore ? 'W' : yourScore < oppScore ? 'L' : 'D';
                                    const resultColor = result === 'W' ? '#16a34a' : result === 'L' ? '#dc2626' : '#f59e0b';
                                    return (
                                        <div key={match.id} className="rounded-lg border border-[var(--border)] p-3 bg-[var(--card-bg)]">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold">{new Date(match.date).toLocaleDateString('th-TH')}</span>
                                                <span className="text-lg font-bold" style={{ color: resultColor }}>{result}</span>
                                            </div>
                                            <div className="text-sm mb-2">
                                                <span>{isHome ? '🏠' : '✈️'} {match.opponent.name}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                                <div><span className="text-gray-500">Your:</span> <span className="font-semibold">{yourScore}</span></div>
                                                <div><span className="text-gray-500">Opp:</span> <span className="font-semibold">{oppScore}</span></div>
                                            </div>
                                            <button
                                                onClick={() => window.location.href = `/match?matchId=${match.id}`}
                                                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'tactics' && (
                <div className="card">
                    <TacticsTabs teamId={teamId} />
                </div>
            )}

            {activeTab === 'roles' && (
                <PlayerRolesTab players={players} teamId={teamId} onViewPlayer={openPlayerModal} />
            )}

            <PlayerModal />
        </div>
    );
}
