'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { bulkAssignTacticalPositions, clearAllTacticalPositions, clearTacticalPosition, updateTacticalPosition, updateTeamTactics } from '../actions';
import type { PlayerAttributes } from '../../lib/engine/types';
import { calculatePlayerPower, getFitnessFactor, getEffectiveAttributes } from '@/lib/engine/playerPower';
import { getExpBonus } from '@/lib/engine/experience';
import PlayerModal from '@/components/PlayerModal';
import TacticsTabs from '@/components/TacticsTabs';
import PlayerRolesTab from '@/components/PlayerRolesTab';
import MatchPrepTab from '@/components/MatchPrepTab';

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
    injurySeverity?: string | null;
    tacticalPosition: string | null;
    playerRole?: string | null;
    attackingRolePreset?: string | null;
    defensiveRolePreset?: string | null;
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

type TransferHistoryItem = {
    id: string;
    date: Date;
    season: number;
    fee: number;
    fromTeamId: string | null;
    toTeamId: string;
    player: { id: string; name: string; naturalPosition: string; age: number };
    fromTeam: { id: string; name: string } | null;
    toTeam: { id: string; name: string };
};

type PresetKey = 'A' | 'B' | 'C';

type SavedLineupPreset = {
    formation: string;
    assignments: { playerId: string; position: string }[];
    savedAt: string;
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

export default function SquadClient({ teamId, players, currentTactics, matches = [], currentSeason = 1, upcomingMatch, opponentPlayers = [], transferHistory = [] }: {
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
    },
    opponentPlayers?: { id: string; name: string; position: string; power: number; condition?: number; avgRating?: number; goals?: number; assists?: number }[],
    transferHistory?: TransferHistoryItem[]
}) {
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<'name' | 'pos' | 'apps' | 'goals' | 'assists' | 'rating' | 'fit' | 'physical' | 'technical' | 'tactical' | 'mental' | 'exp' | 'power' | 'age'>('pos');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [activeTab, setActiveTab] = useState<'squad' | 'matches' | 'tactics' | 'roles' | 'matchprep' | 'transfer'>('squad');
    const [selectedSeason, setSelectedSeason] = useState(currentSeason);
    const [transferFilter, setTransferFilter] = useState<'all' | 'in' | 'out'>('all');
    const [lineupPresets, setLineupPresets] = useState<Record<PresetKey, SavedLineupPreset | null>>({ A: null, B: null, C: null });
    const [presetFeedback, setPresetFeedback] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromMatch = searchParams.get('from') === 'match';
    const matchId = searchParams.get('matchId');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'squad' || tab === 'matches' || tab === 'tactics' || tab === 'roles' || tab === 'matchprep' || tab === 'transfer') {
            setActiveTab(tab as 'squad' | 'matches' | 'tactics' | 'roles' | 'matchprep' | 'transfer');
        }
    }, [searchParams]);

    const presetStorageKey = `lineup-presets-${teamId}`;

    useEffect(() => {
        try {
            const raw = localStorage.getItem(presetStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Record<PresetKey, SavedLineupPreset | null>;
            setLineupPresets({
                A: parsed?.A || null,
                B: parsed?.B || null,
                C: parsed?.C || null
            });
        } catch (error) {
            console.error('Failed to load lineup presets', error);
        }
    }, [presetStorageKey]);

    const showPresetFeedback = (message: string) => {
        setPresetFeedback(message);
        setTimeout(() => setPresetFeedback(''), 2500);
    };

    const getCurrentAssignments = () => {
        return players
            .filter(p => !!p.tacticalPosition)
            .map(p => ({ playerId: p.id, position: p.tacticalPosition as string }));
    };

    const savePreset = (key: PresetKey) => {
        const assignments = getCurrentAssignments();
        if (assignments.length === 0) {
            showPresetFeedback(`Preset ${key}: ไม่มีตัวที่จัดตำแหน่งอยู่`);
            return;
        }

        const next = {
            ...lineupPresets,
            [key]: {
                formation: currentTactics.formation,
                assignments,
                savedAt: new Date().toISOString()
            }
        };

        setLineupPresets(next);
        try {
            localStorage.setItem(presetStorageKey, JSON.stringify(next));
        } catch (error) {
            console.error('Failed to save lineup preset', error);
        }

        showPresetFeedback(`บันทึก Preset ${key} แล้ว (${assignments.length} คน)`);
    };

    const loadPreset = async (key: PresetKey) => {
        const preset = lineupPresets[key];
        if (!preset) {
            showPresetFeedback(`Preset ${key}: ยังไม่เคยบันทึก`);
            return;
        }

        setLoading(true);
        try {
            if (preset.formation !== currentTactics.formation) {
                await updateTeamTactics(teamId, { formation: preset.formation });
            }

            await bulkAssignTacticalPositions(teamId, preset.assignments);
            showPresetFeedback(`โหลด Preset ${key} เรียบร้อย`);
        } catch (error) {
            console.error(`Failed to load lineup preset ${key}`, error);
            showPresetFeedback(`โหลด Preset ${key} ไม่สำเร็จ`);
        } finally {
            setLoading(false);
        }
    };

    const clearPreset = (key: PresetKey) => {
        if (!lineupPresets[key]) {
            showPresetFeedback(`Preset ${key}: ไม่มีข้อมูลให้ลบ`);
            return;
        }

        const next = {
            ...lineupPresets,
            [key]: null
        };

        setLineupPresets(next);
        try {
            localStorage.setItem(presetStorageKey, JSON.stringify(next));
        } catch (error) {
            console.error('Failed to clear lineup preset', error);
        }

        showPresetFeedback(`ลบ Preset ${key} แล้ว`);
    };

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
        const targetPlayer = players.find(p => p.id === playerId);
        if (targetPlayer && isPlayerUnavailable(targetPlayer)) {
            return;
        }

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
            const eligiblePlayers = sortedPlayers.filter(
                (p) => (p.suspensionMatchesRemaining || 0) <= 0 && (p.injuryWeeksRemaining || 0) <= 0
            );
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
                if (p.startsWith('DMC') || p === 'DM') return 'MF';
                if (p.startsWith('D')) return 'DF';
                if (p.startsWith('M') || p.startsWith('A')) return 'MF';
                return 'FW';
            };

            for (const slot of slots) {
                const slotBase = slot.id.split('_')[0];
                const slotGroup = getGroup(slotBase);

                const bestPlayer = eligiblePlayers
                    .filter(p => !usedPlayers.has(p.id))
                    .map(p => {
                        const playerPower = calculatePlayerPower({
                            attributes: p.rawAttributes,
                            targetPosition: slotBase,
                            naturalPosition: p.naturalPosition,
                            condition: p.condition,
                            exp: p.exp
                        }).powerWithExp;

                        const playerGroup = getGroup(p.naturalPosition);

                        // Apply heavy penalty if position group is different
                        // e.g. DF playing as FW will get a major penalty to avoid cross-position auto-selection
                        const groupDiff = Math.abs(posGroupOrder[slotGroup] - posGroupOrder[playerGroup]);
                        const penalty = groupDiff === 0 ? 0 : 40 * groupDiff; // 40 points penalty per group distance

                        // DMC specific preference: favor midfield profiles over defenders
                        let dmcBonus = 0;
                        if (slotBase === 'DMC') {
                            const nat = p.naturalPosition;
                            if (nat === 'DMC') dmcBonus = 18;
                            else if (nat === 'MC' || nat === 'AMC') dmcBonus = 12;
                            else if (nat === 'DMR' || nat === 'DML') dmcBonus = 8;
                            else if (nat === 'DC' || nat === 'DR' || nat === 'DL') dmcBonus = -15;
                        }

                        return {
                            playerId: p.id,
                            position: slot.id,
                            suitability: playerPower - penalty + dmcBonus
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
    const isPlayerUnavailable = (p: PlayerProps) => (p.suspensionMatchesRemaining || 0) > 0 || (p.injuryWeeksRemaining || 0) > 0;
    const getAvailabilityBadge = (p: PlayerProps) => {
        if ((p.suspensionMatchesRemaining || 0) > 0) {
            return `SUS ${p.suspensionMatchesRemaining}`;
        }
        if ((p.injuryWeeksRemaining || 0) > 0) {
            return `INJ ${p.injuryWeeksRemaining}W`;
        }
        return null;
    };

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
            naturalPosition: p.naturalPosition,
            condition: p.condition,
            exp: p.exp
        });
        const withoutExp = calculatePlayerPower({
            attributes: p.rawAttributes,
            targetPosition: targetPos,
            naturalPosition: p.naturalPosition,
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
                naturalPosition: p.naturalPosition,
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
    const sortedTransferHistory = [...transferHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const listedCount = players.filter(p => p.transferStatus === 'LISTED').length;
    const filteredTransfers = sortedTransferHistory.filter((t) => {
        if (transferFilter === 'all') return true;
        if (transferFilter === 'in') return t.toTeamId === teamId;
        return t.fromTeamId === teamId;
    });
    const transferInCount = sortedTransferHistory.filter(t => t.toTeamId === teamId).length;
    const transferOutCount = sortedTransferHistory.filter(t => t.fromTeamId === teamId).length;
    const formatCurrency = (num: number) => `$${new Intl.NumberFormat('en-US').format(Math.abs(Math.round(num || 0)))}`;

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
                <button
                    onClick={() => setActiveTab('transfer')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'transfer' ? '3px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'transfer' ? 'bold' : 'normal',
                        fontSize: '0.9rem',
                        color: activeTab === 'transfer' ? 'var(--primary)' : 'inherit'
                    }}
                    className="text-sm md:text-base md:px-5"
                >
                    🔁 Transfer Player ({sortedTransferHistory.length})
                </button>
                {fromMatch && upcomingMatch && opponentPlayers.length > 0 && (
                    <button
                        onClick={() => setActiveTab('matchprep')}
                        style={{
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'matchprep' ? '3px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'matchprep' ? 'bold' : 'normal',
                            fontSize: '0.9rem',
                            color: activeTab === 'matchprep' ? 'var(--primary)' : 'inherit'
                        }}
                        className="text-sm md:text-base md:px-5"
                    >
                        🎯 Match Prep
                    </button>
                )}
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
                    <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Squad List</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: '#ffedd5', color: '#9a3412', whiteSpace: 'nowrap' }}>
                                <span title={`Listed for transfer: ${listedCount}`}>📤 {listedCount}</span>
                            </span>
                            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
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
                            <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>⚡{getTeamPower()}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={handleAutoSelect} disabled={loading} style={{ padding: '6px 14px', fontSize: '0.9rem', border: '1px solid var(--primary)', background: 'var(--primary)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--primary-dark)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}>
                                Auto Select
                            </button>
                            <button onClick={handleClearAll} disabled={loading} style={{ padding: '6px 14px', fontSize: '0.9rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--muted)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                                Clear All
                            </button>
                        </div>

                        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 10px', background: 'var(--bg)' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
                                Lineup Presets (A/B/C)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                {(['A', 'B', 'C'] as PresetKey[]).map((key) => {
                                    const hasData = !!lineupPresets[key];
                                    return (
                                        <div key={`save-${key}`} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <button
                                                onClick={() => savePreset(key)}
                                                disabled={loading}
                                                title={`Save current lineup to preset ${key}`}
                                                style={{
                                                    padding: '5px 9px',
                                                    fontSize: '0.8rem',
                                                    border: '1px solid #93c5fd',
                                                    background: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    minWidth: '30px'
                                                }}
                                            >
                                                {key}
                                            </button>
                                            <button
                                                onClick={() => loadPreset(key)}
                                                disabled={loading || !hasData}
                                                title={hasData ? `Load preset ${key}` : `Preset ${key} is empty`}
                                                style={{
                                                    padding: '5px 8px',
                                                    fontSize: '0.72rem',
                                                    border: '1px solid var(--border)',
                                                    background: hasData ? '#ecfdf5' : '#f3f4f6',
                                                    color: hasData ? '#047857' : '#9ca3af',
                                                    borderRadius: '6px',
                                                    cursor: hasData ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                Load
                                            </button>
                                            <button
                                                onClick={() => clearPreset(key)}
                                                disabled={loading || !hasData}
                                                title={hasData ? `Clear preset ${key}` : `Preset ${key} is empty`}
                                                style={{
                                                    padding: '5px 8px',
                                                    fontSize: '0.72rem',
                                                    border: '1px solid var(--border)',
                                                    background: hasData ? '#fef2f2' : '#f3f4f6',
                                                    color: hasData ? '#b91c1c' : '#9ca3af',
                                                    borderRadius: '6px',
                                                    cursor: hasData ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {presetFeedback && (
                        <div style={{ marginBottom: '8px', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                            {presetFeedback}
                        </div>
                    )}
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
                                    <button onClick={() => handleSort('power')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Suitability</button>
                                </th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>
                                    <button onClick={() => handleSort('age')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Age</button>
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
                                        case 'age': return dir * (num(a.p.age) - num(b.p.age));
                                        case 'name':
                                        default:
                                            return dir * a.p.name.localeCompare(b.p.name);
                                    }
                                })
                                .map(({ p, physical, technical, tactical, mental, expBonus, power, basePowerNoFitness, expBoostedPower, noExpPower }) => {
                                    const unavailable = isPlayerUnavailable(p);
                                    const availabilityBadge = getAvailabilityBadge(p);
                                    return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #eee', background: unavailable ? '#fef2f2' : (p.tacticalPosition ? '#f0f4c3' : 'transparent') }}>
                                        <td style={{ padding: '6px' }}>
                                            <select
                                                value={p.tacticalPosition || ''}
                                                onChange={(e) => handleAssign(p.id, e.target.value, p.tacticalPosition)}
                                                disabled={loading || unavailable}
                                                style={{ padding: '4px', border: '1px solid #ccc', width: '110px', background: unavailable ? '#f3f4f6' : 'white' }}
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
                                            {p.transferStatus === 'LISTED' && (
                                                <span
                                                    title="Listed for transfer"
                                                    style={{
                                                        marginLeft: '6px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 700,
                                                        color: '#9a3412',
                                                        background: '#ffedd5',
                                                        border: '1px solid #fdba74',
                                                        borderRadius: '999px',
                                                        padding: '1px 5px',
                                                        verticalAlign: 'middle'
                                                    }}
                                                >
                                                    📤
                                                </span>
                                            )}
                                            {availabilityBadge && (
                                                <span
                                                    title={availabilityBadge.startsWith('SUS') ? 'Suspended' : 'Injured'}
                                                    style={{
                                                        marginLeft: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        color: '#991b1b',
                                                        background: '#fee2e2',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: '999px',
                                                        padding: '1px 6px',
                                                        verticalAlign: 'middle'
                                                    }}
                                                >
                                                    {availabilityBadge}
                                                </span>
                                            )}
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
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{p.age}</td>
                                        <td style={{ padding: '6px', textAlign: 'center' }}>
                                            <span style={{ background: '#fbbf24', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                ${(getMarketValue(p) / 1000000).toFixed(1)}M
                                            </span>
                                        </td>
                                    </tr>
                                    );
                                })}
                        </tbody>
                    </table>

                    {/* Mobile Card List */}
                    <div className="flex flex-col gap-3 md:hidden">
                        <div className="mb-2 text-xs text-gray-500 uppercase font-semibold">POS NAME MIN RATING FIT SUITABILITY AGE</div>
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
                                if (sortKey === 'age') return sortDir === 'asc' ? a.p.age - b.p.age : b.p.age - a.p.age;
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
                                            {p.transferStatus === 'LISTED' && (
                                                <span
                                                    title="Listed for transfer"
                                                    className="inline-flex items-center text-sm font-bold text-orange-700 bg-orange-100 border border-orange-300 rounded-full px-1.5 py-0 mt-1"
                                                >
                                                    📤
                                                </span>
                                            )}
                                            {getAvailabilityBadge(p) && (
                                                <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 rounded-full px-1.5 py-0.5 mt-1 mr-1">
                                                    {getAvailabilityBadge(p)}
                                                </span>
                                            )}
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
                                        <div><span className="text-gray-500">Suitability:</span> <span className="font-semibold" style={{ color: power >= 70 ? 'var(--success)' : power >= 60 ? 'var(--accent)' : 'inherit' }}>{power}</span></div>
                                        <div><span className="text-gray-500">Age:</span> <span className="font-semibold">{p.age}</span></div>
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

            {activeTab === 'transfer' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }} className="flex-col items-start gap-3 md:flex-row md:items-center">
                        <h3 style={{ margin: 0 }}>🔁 Transfer Player History</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setTransferFilter('all')}
                                className="btn btn-sm"
                                style={{
                                    background: transferFilter === 'all' ? 'var(--primary)' : 'var(--bg)',
                                    color: transferFilter === 'all' ? 'white' : 'var(--text)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                All ({sortedTransferHistory.length})
                            </button>
                            <button
                                onClick={() => setTransferFilter('in')}
                                className="btn btn-sm"
                                style={{
                                    background: transferFilter === 'in' ? '#10b981' : 'var(--bg)',
                                    color: transferFilter === 'in' ? 'white' : 'var(--text)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                In ({transferInCount})
                            </button>
                            <button
                                onClick={() => setTransferFilter('out')}
                                className="btn btn-sm"
                                style={{
                                    background: transferFilter === 'out' ? '#ef4444' : 'var(--bg)',
                                    color: transferFilter === 'out' ? 'white' : 'var(--text)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                Out ({transferOutCount})
                            </button>
                        </div>
                    </div>

                    {filteredTransfers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                            No transfer records for this filter.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredTransfers.map((t) => {
                                const isIn = t.toTeamId === teamId;
                                return (
                                    <div
                                        key={t.id}
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderLeft: `4px solid ${isIn ? '#10b981' : '#ef4444'}`,
                                            borderRadius: '10px',
                                            padding: '0.9rem 1rem',
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1.5fr 1fr',
                                            gap: '0.75rem',
                                            alignItems: 'center'
                                        }}
                                        className="md:grid"
                                    >
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                                {new Date(t.date).toLocaleDateString('th-TH')} • Season {t.season}
                                            </div>
                                            <div style={{ fontWeight: 700 }}>
                                                <button
                                                    onClick={() => openPlayerModal(t.player.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontWeight: 700, textDecoration: 'underline' }}
                                                >
                                                    {t.player.name}
                                                </button>
                                                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> ({t.player.naturalPosition}, {t.player.age}y)</span>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.9rem' }}>
                                            <div>
                                                <span style={{ color: 'var(--muted)' }}>From: </span>
                                                {t.fromTeam ? <Link href={`/team/${t.fromTeam.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{t.fromTeam.name}</Link> : 'Free Agent'}
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--muted)' }}>To: </span>
                                                <Link href={`/team/${t.toTeam.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{t.toTeam.name}</Link>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                background: isIn ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                color: isIn ? '#047857' : '#b91c1c',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                marginBottom: '0.35rem'
                                            }}>
                                                {isIn ? 'IN' : 'OUT'}
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                                                {t.fee > 0 ? formatCurrency(t.fee) : 'Free'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'matchprep' && upcomingMatch && (
                <MatchPrepTab 
                    matchId={upcomingMatch.id}
                    teamId={teamId}
                    opponentPlayers={opponentPlayers}
                />
            )}

            <PlayerModal />
        </div>
    );
}
