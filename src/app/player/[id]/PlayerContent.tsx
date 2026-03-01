'use client';

import { useState, useEffect } from 'react';
import { ContractTab } from '@/components/ContractTab';

type AttributeItemType = { label: string; value: number; bonus?: number };
type AttributeGroupType = { label: string; items: AttributeItemType[] };
type AttributeDataType = {
    technical: AttributeGroupType[];
    mental: AttributeGroupType[];
    physical: AttributeGroupType[];
    exp?: number;
    expBonus?: number;
    expMultiplier?: number;
};

type MatchStatType = {
    id: string;
    teamId: string;
    goals: number;
    assists: number;
    rating: number;
    match: {
        homeTeamId: string;
        homeTeam: { name: string };
        awayTeam: { name: string };
    };
};

type PlayerType = {
    id: string;
    name: string;
    teamId: string;
    contractStartWeek?: number;
    contractEndWeek?: number;
    weeklyWage?: number;
    matchStats: MatchStatType[];
};

export function PlayerContent({ player, attributeData }: { player: PlayerType; attributeData: AttributeDataType }) {
    const [activeTab, setActiveTab] = useState<'attributes' | 'statistics' | 'contract'>('attributes');
    const [contractRefresh, setContractRefresh] = useState(0);
    const [userTeamId, setUserTeamId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Fetch user team ID
    useEffect(() => {
        const fetchUserTeam = async () => {
            try {
                const res = await fetch('/api/game/info');
                const data = await res.json();
                setUserTeamId(data.userTeamId || '');
            } catch (error) {
                console.error('Failed to fetch user team:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUserTeam();
    }, []);

    const AttributeItem = ({ label, value, bonus = 0 }: { label: string; value: number; bonus?: number }) => {
        const displayValue = Math.min(value + bonus, 20);
        const hasBonus = bonus > 0;
        
        return (
            <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 'bold', color: displayValue > 15 ? 'var(--success)' : displayValue > 10 ? 'var(--accent)' : 'inherit' }}>
                        {hasBonus ? (
                            <>
                                {value} <span style={{ color: 'var(--success)' }}>+{bonus}</span> = {displayValue}
                            </>
                        ) : (
                            displayValue
                        )}
                    </span>
                </div>
                <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${(displayValue / 20) * 100}%`,
                            background: displayValue > 15 ? 'var(--success)' : displayValue > 10 ? 'var(--accent)' : 'var(--primary)',
                        }}
                    ></div>
                </div>
            </div>
        );
    };

    const tabStyle = (tab: string) => ({
        padding: '0.75rem 1.5rem',
        border: 'none',
        background: 'transparent',
        color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: activeTab === tab ? 'bold' : 'normal',
        borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
        transition: 'all 0.2s ease',
    });

    return (
        <>
            {/* Tab Navigation */}
            <div className="card" style={{ padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>แท็บข้อมูล</div>
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <button style={tabStyle('attributes')} onClick={() => setActiveTab('attributes')}>
                        แอตทริบิวต์
                    </button>
                    <button style={tabStyle('statistics')} onClick={() => setActiveTab('statistics')}>
                        สถิติ
                    </button>
                    <button style={tabStyle('contract')} onClick={() => setActiveTab('contract')}>
                        สัญญา
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'attributes' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>พลังความสามารถ (Attributes)</h3>
                        {attributeData.exp !== undefined && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>EXP</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{attributeData.exp}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Bonus</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>{(attributeData.expBonus || 0) >= 0 ? '+' : ''}{attributeData.expBonus}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Multiplier</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>×{attributeData.expMultiplier?.toFixed(1)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Technical</h4>
                            {attributeData.technical[0].items.map((item) => (
                                <AttributeItem key={item.label} label={item.label} value={item.value} bonus={item.bonus} />
                            ))}
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Mental</h4>
                            {attributeData.mental[0].items.map((item) => (
                                <AttributeItem key={item.label} label={item.label} value={item.value} bonus={item.bonus} />
                            ))}
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Physical</h4>
                            {attributeData.physical[0].items.map((item) => (
                                <AttributeItem key={item.label} label={item.label} value={item.value} bonus={item.bonus} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'statistics' && (
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>สถิติการเล่น</h3>
                    {player.matchStats && player.matchStats.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {player.matchStats.map((stat) => (
                                <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--border)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            v {stat.teamId === stat.match.homeTeamId ? stat.match.awayTeam.name : stat.match.homeTeam.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                            {stat.goals} G • {stat.assists} A
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            background: stat.rating >= 7.5 ? 'var(--success)' : stat.rating >= 6.5 ? 'var(--accent)' : 'var(--muted)',
                                            color: 'white',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {stat.rating.toFixed(1)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: 'var(--muted)', padding: '1rem', textAlign: 'center' }}>ไม่มีสถิติการเล่น</div>
                    )}
                </div>
            )}

            {activeTab === 'contract' && (
                <ContractTab
                    key={contractRefresh}
                    playerId={player.id}
                    playerName={player.name}
                    contractStartWeek={player.contractStartWeek || 0}
                    contractEndWeek={player.contractEndWeek || 52}
                    weeklyWage={player.weeklyWage || 0}
                    isUserTeam={!loading && player.teamId === userTeamId}
                    onRenew={() => setContractRefresh(prev => prev + 1)}
                />
            )}
        </>
    );
}
