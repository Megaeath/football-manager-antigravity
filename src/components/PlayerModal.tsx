'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateSuitability } from '@/lib/engine/suitability';
import type { PlayerAttributes } from '@/lib/engine/types';

interface PlayerData {
    id: string;
    name: string;
    naturalPosition: string;
    age: number;
    team: { name: string };
    avgRating: number;
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
    setPieces: number;
    throw: number;
    aggression: number;
    positioning: number;
    vision: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    composure: number;
    concentration: number;
    decision: number;
    crossing: number;
    balance: number;
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    matchStats: Array<{
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
    const [activeTab, setActiveTab] = useState<'attributes' | 'season' | 'matches'>('attributes');
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

    useEffect(() => {
        if (!playerId) return;

        const fetchPlayer = async () => {
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
        };

        fetchPlayer();
    }, [playerId]);

    const closeModal = () => {
        router.back();
    };

    if (!playerId) return null;

    const currentSeasonStats = player?.seasonStats?.find(s => s.season === selectedSeason);

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
                                    <div style={{ display: 'flex', gap: '2rem', justifyContent: 'flex-end' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Power</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                {(() => {
                                                    const attrs: PlayerAttributes = {
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
                                                    };
                                                    const natPos = player.naturalPosition.split('_')[0];
                                                    return Math.round(calculateSuitability(attrs, natPos));
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Career Rating</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{(player.avgRating || 0).toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '0', margin: 0 }}>
                                {['attributes', 'season', 'matches'].map((tab: string) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as 'attributes' | 'season' | 'matches')}
                                        style={{
                                            flex: 1, padding: '16px', border: 'none',
                                            background: activeTab === tab ? '#fff' : 'transparent',
                                            borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                            color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                                            fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                                            fontSize: '0.95rem', textTransform: 'uppercase'
                                        }}
                                    >
                                        {tab === 'attributes' ? '💪 ทักษะ' : tab === 'season' ? '📊 ฤดูกาล' : '📅 ประวัติ'}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div style={{ padding: '2rem' }}>
                                {/* Attributes Tab */}
                                {activeTab === 'attributes' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2rem' }}>
                                        <AttributeSection label="Physical" items={[
                                            { label: 'Acceleration', value: player.acceleration },
                                            { label: 'Agility', value: player.agility },
                                            { label: 'Balance', value: player.balance },
                                            { label: 'Pace', value: player.pace },
                                            { label: 'Stamina', value: player.stamina },
                                            { label: 'Strength', value: player.strength }
                                        ]} />

                                        <AttributeSection label="Technical" items={[
                                            { label: 'Crossing', value: player.crossing },
                                            { label: 'Dribbling', value: player.dribbling },
                                            { label: 'Handling (GK)', value: player.handling },
                                            { label: 'Heading', value: player.heading },
                                            { label: 'Passing', value: player.passing },
                                            { label: 'Shooting', value: player.shooting },
                                            { label: 'Tackling', value: player.tackling },
                                            { label: 'Throw In', value: player.throw }
                                        ]} />

                                        <AttributeSection label="Tactical" items={[
                                            { label: 'Aggression', value: player.aggression },
                                            { label: 'Bravery', value: player.bravery },
                                            { label: 'Leadership', value: player.leadership },
                                            { label: 'Positioning', value: player.positioning },
                                            { label: 'Set Pieces', value: player.setPieces },
                                            { label: 'Vision', value: player.vision }
                                        ]} />

                                        <AttributeSection label="Mental" items={[
                                            { label: 'Composure', value: player.composure },
                                            { label: 'Concentration', value: player.concentration },
                                            { label: 'Decision', value: player.decision },
                                            { label: 'Teamwork', value: player.teamwork }
                                        ]} />
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

function AttributeSection({ label, items }: { label: string; items: Array<{ label: string; value: number }> }) {
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
