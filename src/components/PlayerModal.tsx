'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateSuitability } from '@/lib/engine/suitability';
import type { PlayerAttributes } from '@/lib/engine/types';
import { getPlayerReputation } from '@/lib/reputation';
import { ContractTab } from '@/components/ContractTab';
import { TransferTab } from '@/components/TransferTab';
import { getEffectiveAttributes, toPlayerAttributes } from '@/lib/engine/playerPower';
import { getExpBonus } from '@/lib/engine/experience';

interface PlayerData {
    id: string;
    name: string;
    teamId: string;
    naturalPosition: string;
    age: number;
    team: { name: string };
    power: number;
    marketValue?: number;
    avgRating: number;
    popularity?: number;
    contractStartWeek?: number;
    contractEndWeek?: number;
    weeklyWage?: number;
    exp?: number;
    transferStatus?: string;
    askingPrice?: number;
    squadStatus?: string;
    // Player attributes
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
    concentration: number;
    decision: number;
    transferHistory?: Array<{ id: string; fromTeamId: string | null; toTeamId: string; season: number; date: string; fee: number; fromTeam?: { name: string } | null; toTeam: { name: string } }>;
    matchStats?: Array<{
        id: string;
        teamId: string;
        goals: number;
        assists: number;
        rating: number;
        minutes: number;
        shots?: number;
        shotsOnTarget?: number;
        passesCompleted?: number;
        passesAttempted?: number;
        tacklesWon?: number;
        tacklesAttempted?: number;
        dribblesWon?: number;
        dribblesAttempted?: number;
        yellowCards?: number;
        redCards?: number;
        match: {
            date: string;
            season: number;
            homeTeamId: string;
            homeTeam: { name: string };
            awayTeam: { name: string };
        };
    }>;
    currentSeason: number;
    availableSeasons: number[];
    seasonStats?: Array<{
        season: number;
        goals: number;
        assists: number;
        yellowCards: number;
        redCards: number;
        minutes: number;
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
        avgRating: string | number;
        matches: number;
    }>;
}

export default function PlayerModal() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const playerId = searchParams.get('playerId');

    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'attributes' | 'season' | 'matches' | 'contract' | 'transfer' | 'history'>('attributes');
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [userTeamId, setUserTeamId] = useState<string>('');
    const [loadingTeam, setLoadingTeam] = useState(true);
    const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
    const [playerAnalytics, setPlayerAnalytics] = useState<any>(null);

    const fetchPlayer = useCallback(async () => {
        if (!playerId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/player/${playerId}`);
            const data = await res.json();
            setPlayer(data);
            setSelectedSeason(data.currentSeason);
        } catch (e) {
            console.error('Failed to fetch player:', e);
        } finally {
            setLoading(false);
        }
    }, [playerId]);

    useEffect(() => {
        if (!playerId) return;
        fetchPlayer();

        const tab = searchParams.get('tab');
        if (tab === 'transfer') {
            setActiveTab('transfer');
        } else {
            setActiveTab('attributes');
        }

        // Fetch player analytics
        const fetchAnalytics = async () => {
            try {
                const res = await fetch(`/api/player/${playerId}/analytics?season=${selectedSeason || 1}`);
                const data = await res.json();
                setPlayerAnalytics(data);
            } catch (e) {
                console.error('Failed to fetch player analytics:', e);
            }
        };
        fetchAnalytics();
    }, [playerId, fetchPlayer, searchParams, selectedSeason]);

    useEffect(() => {
        const fetchUserTeam = async () => {
            try {
                const res = await fetch('/api/game/info');
                const data = await res.json();
                setUserTeamId(data.userTeamId || '');
            } catch (e) {
                console.error('Failed to fetch user team:', e);
            } finally {
                setLoadingTeam(false);
            }
        };
        fetchUserTeam();
    }, []);

    const closeModal = () => {
        router.back();
    };

    if (!playerId) return null;

    const currentSeasonStats = player?.seasonStats?.find(s => s.season === selectedSeason);
    const expBonus = getExpBonus(player?.exp || 0);
    const effectiveAttributes = player
        ? getEffectiveAttributes(
            toPlayerAttributes({
                handling: player.handling,
                tackling: player.tackling,
                passing: player.passing,
                shooting: player.shooting,
                heading: player.heading,
                dribbling: player.dribbling,
                crossing: player.crossing,
                setPieces: player.setPieces,
                throw: player.throw,
                aggression: player.aggression,
                positioning: player.positioning,
                vision: player.vision,
                bravery: player.bravery,
                leadership: player.leadership,
                teamwork: player.teamwork,
                composure: player.composure,
                pace: player.pace,
                acceleration: player.acceleration,
                stamina: player.stamina,
                strength: player.strength,
                agility: player.agility,
                balance: player.balance
            }),
            player.exp || 0
        )
        : null;

    return (
        <>
            {/* Modal Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}
                onClick={closeModal}
            >
                {/* Modal Content */}
                <div
                    style={{
                        background: 'white',
                        borderRadius: '12px',
                        maxWidth: '1000px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        zIndex: 1001
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>
                    ) : player ? (
                        <div>
                            {/* Close Button */}
                            <div style={{ position: 'sticky', top: 0, display: 'flex', justifyContent: 'flex-end', padding: '1rem', background: 'var(--sidebar-bg)', borderRadius: '12px 12px 0 0', zIndex: 10 }}>
                                <button
                                    onClick={closeModal}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '2rem',
                                        cursor: 'pointer',
                                        color: 'white',
                                        width: '40px',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Header Section */}
                            <div style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexDirection: 'column' }} className="md:flex-row md:gap-8 md:p-8">
                                <div style={{
                                    width: '60px', height: '60px', background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0
                                }} className="md:w-20 md:h-20 md:text-4xl">
                                    👤
                                </div>
                                <div style={{ textAlign: 'center' }} className="md:text-left md:flex-1">
                                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.4rem' }} className="md:text-3xl">{player.name}</h2>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                                        <span style={{ background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '0.9rem' }}>{player.naturalPosition}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{player.team.name}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>• อายุ {player.age} ปี</span>
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '2rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Power</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                {player.power || 0}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>EXP</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                {player.exp || 0} <span style={{ fontSize: '0.9rem', color: 'var(--success)' }}>(+{Math.floor((player.exp || 0) / 100)})</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Market Value</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fbbf24' }}>
                                                ${player.marketValue ? player.marketValue.toLocaleString() : '0'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Career Rating</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{(player.avgRating || 0).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Reputation</div>
                                            {(() => {
                                                const rep = getPlayerReputation(player.popularity || 0);
                                                return (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#93c5fd' }}>
                                                            {rep.label} ({rep.score})
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', maxWidth: '220px' }}>
                                                            {rep.definition}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '0', margin: 0, overflowX: 'auto' }}>
                                {['attributes', 'season', 'matches', 'contract', 'transfer', 'history'].map((tab: string) => {
                                    const tabLabels: { [key: string]: { icon: string; label: string } } = {
                                        attributes: { icon: '💪', label: 'ทักษะ' },
                                        season: { icon: '📊', label: 'ฤดูกาล' },
                                        matches: { icon: '📅', label: 'ประวัติ' },
                                        contract: { icon: '📄', label: 'สัญญา' },
                                        transfer: { icon: '💱', label: 'ซื้อขาย' },
                                        history: { icon: '🔄', label: 'การย้ายทีม' }
                                    };
                                    const { icon, label } = tabLabels[tab];
                                    
                                    return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as any)}
                                        style={{
                                            flex: 1, padding: '16px', border: 'none',
                                            background: activeTab === tab ? '#fff' : 'transparent',
                                            borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                            color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                                            fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                                            fontSize: '0.95rem', textTransform: 'uppercase'
                                        }}
                                    >
                                        <span style={{ display: 'block', marginBottom: '4px' }}>{icon}</span>
                                        <span style={{ display: 'none' }} className="md:inline">{label}</span>
                                    </button>
                                    );
                                })}
                            </div>

                            {/* Tab Content */}
                            <div style={{ padding: '2rem' }}>
                                {/* Attributes Tab */}
                                {activeTab === 'attributes' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
                                        <AttributeSection label="Physical" items={[
                                            { label: 'Acceleration', value: effectiveAttributes?.acceleration ?? player.acceleration },
                                            { label: 'Agility', value: effectiveAttributes?.agility ?? player.agility },
                                            { label: 'Balance', value: effectiveAttributes?.balance ?? player.balance },
                                            { label: 'Pace', value: effectiveAttributes?.pace ?? player.pace },
                                            { label: 'Stamina', value: effectiveAttributes?.stamina ?? player.stamina },
                                            { label: 'Strength', value: effectiveAttributes?.strength ?? player.strength }
                                        ]} bonus={expBonus} />

                                        <AttributeSection label="Technical" items={[
                                            { label: 'Crossing', value: effectiveAttributes?.crossing ?? player.crossing },
                                            { label: 'Dribbling', value: effectiveAttributes?.dribbling ?? player.dribbling },
                                            { label: 'Handling (GK)', value: effectiveAttributes?.handling ?? player.handling },
                                            { label: 'Heading', value: effectiveAttributes?.heading ?? player.heading },
                                            { label: 'Passing', value: effectiveAttributes?.passing ?? player.passing },
                                            { label: 'Shooting', value: effectiveAttributes?.shooting ?? player.shooting },
                                            { label: 'Tackling', value: effectiveAttributes?.tackling ?? player.tackling },
                                            { label: 'Throw In', value: effectiveAttributes?.throw ?? player.throw }
                                        ]} bonus={expBonus} />

                                        <AttributeSection label="Tactical" items={[
                                            { label: 'Aggression', value: effectiveAttributes?.aggression ?? player.aggression },
                                            { label: 'Bravery', value: effectiveAttributes?.bravery ?? player.bravery },
                                            { label: 'Leadership', value: effectiveAttributes?.leadership ?? player.leadership },
                                            { label: 'Positioning', value: effectiveAttributes?.positioning ?? player.positioning },
                                            { label: 'Set Pieces', value: effectiveAttributes?.setPieces ?? player.setPieces },
                                            { label: 'Vision', value: effectiveAttributes?.vision ?? player.vision }
                                        ]} bonus={expBonus} />

                                        <AttributeSection label="Mental" items={[
                                            { label: 'Composure', value: effectiveAttributes?.composure ?? player.composure },
                                            { label: 'Concentration', value: player.concentration },
                                            { label: 'Decision', value: player.decision },
                                            { label: 'Teamwork', value: effectiveAttributes?.teamwork ?? player.teamwork }
                                        ]} bonus={expBonus} />
                                    </div>
                                )}

                                {/* Season Stats Tab */}
                                {activeTab === 'season' && (
                                    <div>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <label style={{ fontSize: '0.9rem', fontWeight: '600', marginRight: '12px' }}>เลือกฤดูกาล:</label>
                                            <select
                                                value={selectedSeason || ''}
                                                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '0.95rem',
                                                    background: 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {player.availableSeasons?.map(season => (
                                                    <option key={season} value={season}>
                                                        ฤดูกาล {season}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {currentSeasonStats ? (
                                            <div>
                                                <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f0f4f9', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                        <h3 style={{ margin: 0 }}>ฤดูกาล {currentSeasonStats.season}</h3>
                                                        <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                            {currentSeasonStats.avgRating} ⭐
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                                                    <StatCard icon="⚽" label="ประตู" value={currentSeasonStats.goals} />
                                                    <StatCard icon="🅰️" label="แอสซิสต์" value={currentSeasonStats.assists} />
                                                    <StatCard icon="🎯" label="ยิงเข้า" value={currentSeasonStats.shotsOnTarget} />
                                                    <StatCard icon="🔫" label="ยิงทั้งหมด" value={currentSeasonStats.shots} />
                                                    <StatCard icon="📐" label="เปิดบอล" value={currentSeasonStats.crossesCompleted} />
                                                    <StatCard icon="🏃" label="เลี้ยงผ่าน" value={currentSeasonStats.dribblesWon} />
                                                    <StatCard icon="🛡️" label="สกัดบอล" value={currentSeasonStats.tacklesWon} />
                                                    <StatCard icon="🎾" label="พาส %" value={currentSeasonStats.passesAttempted > 0 ? Math.round((currentSeasonStats.passesCompleted / currentSeasonStats.passesAttempted) * 100) : 0} />
                                                    <StatCard icon="⏱️" label="เล่นแล้ว" value={currentSeasonStats.minutes} suffix="&apos;" />
                                                    <StatCard icon="🎮" label="นัดเล่น" value={currentSeasonStats.matches} />
                                                    <StatCard icon="🟨" label="การ์ดเหลือง" value={currentSeasonStats.yellowCards} />
                                                    <StatCard icon="🟥" label="การ์ดแดง" value={currentSeasonStats.redCards} />
                                                </div>

                                                {/* Zone & Action Analytics */}
                                                {playerAnalytics?.seasonSummary && (
                                                    <div style={{ marginTop: '2rem' }}>
                                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: '600', color: 'var(--muted)' }}>วิเคราะห์เชิงลึก - สาขาบอลและการทำงาน</h4>

                                                        {/* Zone Distribution */}
                                                        {playerAnalytics.seasonSummary?.zones && (() => {
                                                            const zones = playerAnalytics.seasonSummary.zones;
                                                            const totalZones = (zones.defensive ?? 0) + (zones.middle ?? 0) + (zones.attacking ?? 0);
                                                            const defensivePct = totalZones > 0 ? Math.round((zones.defensive / totalZones) * 100) : 0;
                                                            const middlePct = totalZones > 0 ? Math.round((zones.middle / totalZones) * 100) : 0;
                                                            const attackingPct = totalZones > 0 ? Math.round((zones.attacking / totalZones) * 100) : 0;
                                                            
                                                            return (
                                                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '6px', fontWeight: '600' }}>พื้นที่การเล่น (คลิกเพื่อกรอง)</div>
                                                                    <div style={{ display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '8px', gap: '0px' }}>
                                                                        {[
                                                                            { key: 'defensive', label: '🛡️ Defensive', pct: defensivePct, value: zones.defensive, color: '#3b82f6' },
                                                                            { key: 'middle', label: '⚙️ Middle', pct: middlePct, value: zones.middle, color: '#10b981' },
                                                                            { key: 'attacking', label: '⚽ Attacking', pct: attackingPct, value: zones.attacking, color: '#f59e0b' }
                                                                        ].map(zone => {
                                                                            const zonePct = zone.pct;
                                                                            return (
                                                                                <div
                                                                                    key={zone.key}
                                                                                    onClick={() => setSelectedZoneFilter(selectedZoneFilter === zone.key ? null : zone.key)}
                                                                                    title={`${zone.label}: ${zone.value} touches (${zonePct}%)`}
                                                                                    style={{
                                                                                        width: `${zonePct}%`,
                                                                                        background: zone.color,
                                                                                        cursor: 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        color: 'white',
                                                                                        fontSize: '0.7rem',
                                                                                        fontWeight: 'bold',
                                                                                        opacity: !selectedZoneFilter || selectedZoneFilter === zone.key ? 1 : 0.35,
                                                                                        transition: 'opacity 0.2s',
                                                                                        border: selectedZoneFilter === zone.key ? '3px outset rgba(255,255,255,0.8)' : 'none',
                                                                                        boxSizing: 'border-box',
                                                                                        minWidth: '50px'
                                                                                    }}
                                                                                >
                                                                                    {zonePct > 10 ? `${zonePct}%` : ''}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                                        🛡️ {defensivePct}% ({zones.defensive}) • ⚙️ {middlePct}% ({zones.middle}) • ⚽ {attackingPct}% ({zones.attacking}) 
                                                                        {selectedZoneFilter && <span style={{ fontWeight: '600', color: 'var(--primary)' }}> — Filtered: {selectedZoneFilter}</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Action Breakdown */}
                                                        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px', fontWeight: '600' }}>
                                                                ประเภทการกระทำ {selectedZoneFilter && <span style={{ color: 'var(--primary)' }}>- {selectedZoneFilter === 'defensive' ? '🛡️ Defensive' : selectedZoneFilter === 'middle' ? '⚙️ Middle' : '⚽ Attacking'} Zone</span>}
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                                {['PASS_SHORT', 'PASS_LONG', 'DRIBBLE', 'SHOOT'].map((actionType) => {
                                                                    // Filter logs by zone if selectedZoneFilter is active
                                                                    let actionAttempts = 0;
                                                                    let actionSuccess = 0;
                                                                    let totalAttempts = 0;
                                                                    
                                                                    if (selectedZoneFilter && playerAnalytics.rawLogs?.length) {
                                                                        // Recalculate from raw logs filtered by zone
                                                                        const zoneName = selectedZoneFilter === 'defensive' ? 'DEFENSIVE' : selectedZoneFilter === 'middle' ? 'MIDDLE' : 'ATTACKING';
                                                                        const zoneLogs = playerAnalytics.rawLogs.filter((log: any) => log.zone === zoneName && log.actionType === actionType);
                                                                        actionAttempts = zoneLogs.length;
                                                                        actionSuccess = zoneLogs.filter((log: any) => log.isSuccessful).length;
                                                                        
                                                                        // Calculate total from all actions in this zone for percentage
                                                                        const allZoneLogs = playerAnalytics.rawLogs.filter((log: any) => log.zone === zoneName && ['PASS_SHORT', 'PASS_LONG', 'DRIBBLE', 'SHOOT'].includes(log.actionType));
                                                                        totalAttempts = allZoneLogs.length;
                                                                    } else {
                                                                        // Use overall stats
                                                                        const action = playerAnalytics.seasonSummary?.actions?.[actionType];
                                                                        actionAttempts = action?.attempts ?? 0;
                                                                        actionSuccess = action?.success ?? 0;
                                                                        totalAttempts = ['PASS_SHORT', 'PASS_LONG', 'DRIBBLE', 'SHOOT'].reduce((sum, a) => sum + (playerAnalytics.seasonSummary?.actions?.[a]?.attempts ?? 0), 0);
                                                                    }
                                                                    
                                                                    const percentage = totalAttempts > 0 ? Math.round((actionAttempts / totalAttempts) * 100) : 0;
                                                                    const successRate = actionAttempts > 0 ? Math.round((actionSuccess / actionAttempts) * 100) : 0;
                                                                    
                                                                    return (
                                                                        <div key={actionType} style={{ padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: '600', marginBottom: '4px' }}>{actionType.replace('_', ' ')}</div>
                                                                            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)' }}>{percentage}%</div>
                                                                            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{actionAttempts} ครั้ง</div>
                                                                            <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '500' }}>{successRate}% สำเร็จ</div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                                                ไม่มีข้อมูลการแข่งขันในฤดูกาลนี้
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Match History Tab */}
                                {activeTab === 'matches' && (
                                    <div>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <label style={{ fontSize: '0.9rem', fontWeight: '600', marginRight: '12px' }}>เลือกฤดูกาล:</label>
                                            <select
                                                value={selectedSeason || ''}
                                                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '0.95rem',
                                                    background: 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {player.availableSeasons?.map(season => (
                                                    <option key={season} value={season}>
                                                        ฤดูกาล {season}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {player.matchStats && player.matchStats.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {player.matchStats
                                                    .filter(stat => stat.match.season === selectedSeason)
                                                    .map((stat, i) => {
                                                        // Create unique key for byMatch lookup using date and homeTeamId
                                                        const matchDateKey = stat.match.date ? `${stat.match.date}_${stat.match.homeTeamId}` : `match_${i}`;
                                                        const matchObj = stat.match as any;
                                                        const matchId = matchObj.id || matchDateKey;
                                                        return (
                                                        <div key={i} style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                            {/* Match Header */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '0.95rem' }}>
                                                                        {stat.match.homeTeam.name} vs {stat.match.awayTeam.name}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                                                        {new Date(stat.match.date).toLocaleDateString('th-TH')}
                                                                    </div>
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontWeight: '600', color: stat.rating > 7 ? 'var(--success)' : stat.rating > 6 ? 'var(--accent)' : 'inherit', fontSize: '1.2rem' }}>
                                                                        {stat.rating.toFixed(2)} ⭐
                                                                    </div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                                                        {stat.minutes}&apos; เล่น
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Player Stats Grid */}
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.goals || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>⚽ ประตู</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.assists || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🅰️ แอสซิสต์</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.shots || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🔫 ยิง</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.shotsOnTarget || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🎯 เข้า</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.passesCompleted || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>📍 พาส</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.tacklesWon || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🛡️ สกัด</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stat.dribblesWon || 0}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>🏃 เลี้ยง</div>
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>{(stat.yellowCards ?? 0) > 0 ? '🟨' : '-'}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>เหลือง</div>
                                                                </div>
                                                            </div>

                                                            {/* Per-Match Zone Analytics */}
                                                            {playerAnalytics?.byMatch?.[matchId] && (() => {
                                                                const matchData = playerAnalytics.byMatch[matchId];
                                                                const zones = matchData.zones || {};
                                                                const totalZones = (zones.defensive ?? 0) + (zones.middle ?? 0) + (zones.attacking ?? 0);
                                                                const defensivePct = totalZones > 0 ? Math.round((zones.defensive / totalZones) * 100) : 0;
                                                                const middlePct = totalZones > 0 ? Math.round((zones.middle / totalZones) * 100) : 0;
                                                                const attackingPct = totalZones > 0 ? Math.round((zones.attacking / totalZones) * 100) : 0;
                                                                
                                                                return (
                                                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '6px', fontWeight: '600' }}>วิเคราะห์พื้นที่</div>
                                                                        
                                                                        {/* Match-specific Zone Distribution */}
                                                                        <div style={{ display: 'flex', height: '18px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', marginBottom: '4px', gap: '0px' }}>
                                                                            {[
                                                                                { key: 'defensive', pct: defensivePct, value: zones.defensive, color: '#3b82f6' },
                                                                                { key: 'middle', pct: middlePct, value: zones.middle, color: '#10b981' },
                                                                                { key: 'attacking', pct: attackingPct, value: zones.attacking, color: '#f59e0b' }
                                                                            ].map(zone => (
                                                                                <div
                                                                                    key={zone.key}
                                                                                    style={{
                                                                                        width: `${Math.max(zone.pct, 1)}%`,
                                                                                        background: zone.color,
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        color: 'white',
                                                                                        fontSize: '0.65rem',
                                                                                        fontWeight: 'bold',
                                                                                        boxSizing: 'border-box'
                                                                                    }}
                                                                                    title={`${zone.key}: ${zone.value} (${zone.pct}%)`}
                                                                                >
                                                                                    {zone.pct > 12 ? `${zone.pct}%` : ''}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                                                            🛡️ {defensivePct}% • ⚙️ {middlePct}% • ⚽ {attackingPct}%
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                    })}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                                                ยังไม่มีประวัติการแข่งขันในฤดูกาลนี้
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'contract' && (
                                    <ContractTab
                                        playerId={player.id}
                                        playerName={player.name}
                                        contractStartWeek={player.contractStartWeek || 0}
                                        contractEndWeek={player.contractEndWeek || 52}
                                        weeklyWage={player.weeklyWage || 0}
                                        isUserTeam={!loadingTeam && player.teamId === userTeamId}
                                        onRenew={fetchPlayer}
                                    />
                                )}

                                {activeTab === 'transfer' && player && (
                                    <TransferTab
                                        playerId={player.id}
                                        playerName={player.name}
                                        playerTeamId={player.teamId}
                                        askingPrice={player.askingPrice || 0}
                                        transferStatus={player.transferStatus || 'NOT_LISTED'}
                                        userTeamId={userTeamId}
                                        marketValue={player.marketValue || 0}
                                    />
                                )}

                                {activeTab === 'history' && player && (
                                    <div style={{ padding: '1.5rem' }}>
                                        {/* Transfer History Section */}
                                        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>ประวัติการย้ายทีม</h3>
                                        {player.transferHistory && player.transferHistory.length > 0 ? (
                                            <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                    <thead>
                                                        <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                                                            <th style={{ padding: '1rem' }}>วันที่/ฤดูกาล</th>
                                                            <th style={{ padding: '1rem' }}>จาก</th>
                                                            <th style={{ padding: '1rem' }}>ไป</th>
                                                            <th style={{ padding: '1rem', textAlign: 'right' }}>ค่าตัว</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {player.transferHistory.map((history) => (
                                                            <tr key={history.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div>{new Date(history.date).toLocaleDateString()}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Season {history.season}</div>
                                                                </td>
                                                                <td style={{ padding: '1rem' }}>{history.fromTeam?.name || 'Free Agent'}</td>
                                                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{history.toTeam.name}</td>
                                                                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>
                                                                    {history.fee === 0 ? 'ฟรี' : `$${history.fee.toLocaleString()}`}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>ไม่มีประวัติการย้ายทีม</div>
                                        )}

                                        {/* Seasonal Statistics Section */}
                                        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>สถิติตามฤดูกาล</h3>
                                        {player.matchStats && player.matchStats.length > 0 ? (() => {
                                            const statsGrouped: Record<string, any> = {};
                                            (player.matchStats as any[]).forEach(stat => {
                                                const key = `${stat.match.season}-${stat.teamId}`;
                                                if (!statsGrouped[key]) {
                                                    statsGrouped[key] = {
                                                        season: stat.match.season,
                                                        teamId: stat.teamId,
                                                        teamName: stat.teamId === stat.match.homeTeamId ? stat.match.homeTeam.name : stat.match.awayTeam.name,
                                                        goals: 0,
                                                        assists: 0,
                                                        apps: 0,
                                                        ratingSum: 0
                                                    };
                                                }
                                                statsGrouped[key].goals += stat.goals || 0;
                                                statsGrouped[key].assists += stat.assists || 0;
                                                statsGrouped[key].apps += 1;
                                                statsGrouped[key].ratingSum += stat.rating || 0;
                                            });

                                            const sorted = Object.values(statsGrouped).sort((a, b) => b.season - a.season);

                                            return (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                        <thead>
                                                            <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                                                                <th style={{ padding: '1rem' }}>ฤดูกาล</th>
                                                                <th style={{ padding: '1rem' }}>ทีม</th>
                                                                <th style={{ padding: '1rem', textAlign: 'center' }}>ลงเล่น</th>
                                                                <th style={{ padding: '1rem', textAlign: 'center' }}>⚽ ประตู</th>
                                                                <th style={{ padding: '1rem', textAlign: 'center' }}>📞 ลูกหวาน</th>
                                                                <th style={{ padding: '1rem', textAlign: 'right' }}>คะแนนเฉลี่ย</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {sorted.map((stat, idx) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '1rem', fontWeight: '500' }}>Season {stat.season}</td>
                                                                    <td style={{ padding: '1rem' }}>{stat.teamName}</td>
                                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{stat.apps}</td>
                                                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{stat.goals}</td>
                                                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--accent)' }}>{stat.assists}</td>
                                                                    <td style={{ padding: '1rem', textAlign: 'right', color: stat.ratingSum / stat.apps > 7 ? 'var(--success)' : 'inherit' }}>
                                                                        {(stat.ratingSum / stat.apps).toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })() : (
                                            <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>ยังไม่มีสถิติการเล่น</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>ไม่พบข้อมูลนักเตะ</div>
                    )}
                </div>
            </div>
        </>
    );
}

function StatCard({ icon, label, value, suffix }: { icon: string; label: string; value: number; suffix?: string }) {
    return (
        <div style={{
            padding: '16px',
            background: '#f0f4f9',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid var(--border)'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
                {value}{suffix || ''}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
        </div>
    );
}

function AttributeSection({ label, items, bonus = 0 }: { label: string; items: Array<{ label: string; value: number }>; bonus?: number }) {
    return (
        <div>
            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>
                {label}
            </h4>
            {items.map((item, i) => (
                <div key={i} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                        <span style={{ fontWeight: 'bold', color: item.value > 15 ? 'var(--success)' : item.value > 10 ? 'var(--accent)' : 'inherit' }}>
                            {item.value}
                            {bonus !== 0 && <span style={{ marginLeft: 6, color: bonus > 0 ? 'var(--success)' : '#c62828', fontSize: '0.8rem' }}>({bonus > 0 ? '+' : ''}{bonus})</span>}
                        </span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(item.value / 20) * 100}%`,
                            background: item.value > 15 ? 'var(--success)' : item.value > 10 ? 'var(--accent)' : 'var(--primary)'
                        }}></div>
                    </div>
                </div>
            ))}
        </div>
    );
}
