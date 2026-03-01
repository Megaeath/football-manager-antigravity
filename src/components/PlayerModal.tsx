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
    transferHistory?: Array<{ id: string; fromTeamId: string | null; toTeamId: string; season: number; date: string; fee: number; fromTeam?: { name: string } | null; toTeam: { name: string } }>;
    matchStats?: Array<{ id: string; teamId: string; goals: number; assists: number; rating: number; match: { season: number; homeTeamId: string; homeTeam: { name: string }; awayTeam: { name: string } } }> & Array<{
        rating: number;
        minutes: number;
        goals?: number;
        assists?: number;
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
    }, [playerId, fetchPlayer, searchParams]);

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
                    zIndex: 1000
                }}
                onClick={closeModal}
            >
                {/* Modal Content */}
                <div
                    style={{
                        background: 'white',
                        borderRadius: '12px',
                        maxWidth: '1000px',
                        width: '95%',
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
                            <div style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '2rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{
                                    width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
                                }}>
                                    👤
                                </div>
                                <div>
                                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.8rem' }}>{player.name}</h2>
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
                                {['attributes', 'season', 'matches', 'contract', 'transfer', 'history'].map((tab: string) => (
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
                                        {tab === 'attributes'
                                            ? '💪 ทักษะ'
                                            : tab === 'season'
                                                ? '📊 ฤดูกาล'
                                                : tab === 'matches'
                                                    ? '📅 ประวัติ'
                                                    : tab === 'history'
                                                        ? '🔄 การย้ายทีม'
                                                    : tab === 'contract'
                                                        ? '📄 สัญญา'
                                                        : '💱 ซื้อขาย'}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div style={{ padding: '2rem' }}>
                                {/* Attributes Tab */}
                                {activeTab === 'attributes' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2rem' }}>
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
                                                    .map((stat, i) => (
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
                                                        </div>
                                                    ))}
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
