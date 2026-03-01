'use client';

import { useState, useEffect, useMemo } from 'react';
import { ContractTab } from '@/components/ContractTab';
import { TransferTab } from '@/components/TransferTab';

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
        season: number;
        homeTeamId: string;
        homeTeam: { name: string };
        awayTeam: { name: string };
    };
};

type TransferHistoryType = {
    id: string;
    fromTeamId: string | null;
    toTeamId: string;
    season: number;
    date: string | Date;
    fee: number;
    fromTeam: { name: string } | null;
    toTeam: { name: string };
};

type PlayerType = {
    id: string;
    name: string;
    teamId: string;
    contractStartWeek?: number;
    contractEndWeek?: number;
    weeklyWage?: number;
    matchStats: MatchStatType[];
    transferHistory: TransferHistoryType[];
    transferStatus?: string;
    askingPrice?: number | null;
    marketValue?: number;
};

export function PlayerContent({ player, attributeData }: { player: PlayerType; attributeData: AttributeDataType }) {
    const [activeTab, setActiveTab] = useState<'attributes' | 'statistics' | 'contract' | 'transfer' | 'history'>('attributes');
    const [contractRefresh, setContractRefresh] = useState(0);
    const [userTeamId, setUserTeamId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Group stats by season and team
    const statsGrouped = useMemo(() => {
        const groups: Record<string, any> = {};
        player.matchStats.forEach(stat => {
            const key = `${stat.match.season}-${stat.teamId}`;
            if (!groups[key]) {
                groups[key] = {
                    season: stat.match.season,
                    teamId: stat.teamId,
                    teamName: stat.teamId === stat.match.homeTeamId ? stat.match.homeTeam.name : stat.match.awayTeam.name,
                    goals: 0,
                    assists: 0,
                    apps: 0,
                    ratingSum: 0,
                    stats: []
                };
            }
            groups[key].goals += stat.goals;
            groups[key].assists += stat.assists;
            groups[key].apps += 1;
            groups[key].ratingSum += stat.rating;
            groups[key].stats.push(stat);
        });
        return Object.values(groups).sort((a, b) => b.season - a.season);
    }, [player.matchStats]);

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
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <button style={tabStyle('attributes')} onClick={() => setActiveTab('attributes')}>
                        แอตทริบิวต์
                    </button>
                    <button style={tabStyle('statistics')} onClick={() => setActiveTab('statistics')}>
                        สถิติ
                    </button>
                    <button style={tabStyle('history')} onClick={() => setActiveTab('history')}>
                        ประวัติย้ายทีม
                    </button>
                    <button style={tabStyle('contract')} onClick={() => setActiveTab('contract')}>
                        สัญญา
                    </button>
                    {!loading && (
                        <button style={tabStyle('transfer')} onClick={() => setActiveTab('transfer')}>
                            ซื้อขาย
                        </button>
                    )}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem' }}>
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
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>สถิติการเล่นรายฤดูกาล/สโมสร</h3>
                    {statsGrouped.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {statsGrouped.map((group: any) => (
                                <div key={`${group.season}-${group.teamId}`}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem 0',
                                        borderBottom: '2px solid var(--primary)',
                                        marginBottom: '1rem'
                                    }}>
                                        <h4 style={{ margin: 0 }}>ฤดูกาล {group.season} | {group.teamName}</h4>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                            {group.apps} นัด • {group.goals} ประตู • {group.assists} แอสซิสต์ • เรตติ้ง {(group.ratingSum / group.apps).toFixed(2)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {group.stats.map((stat: MatchStatType) => (
                                            <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    v {stat.teamId === stat.match.homeTeamId ? stat.match.awayTeam.name : stat.match.homeTeam.name}
                                                </div>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                        {stat.goals > 0 && <span>⚽ {stat.goals} </span>}
                                                        {stat.assists > 0 && <span>🅰️ {stat.assists}</span>}
                                                    </div>
                                                    <div style={{
                                                        width: '32px', height: '32px',
                                                        background: stat.rating >= 7.5 ? 'var(--success)' : stat.rating >= 6.5 ? 'var(--accent)' : 'var(--muted)',
                                                        color: 'white', borderRadius: '4px', textAlign: 'center', lineHeight: '32px', fontSize: '0.8rem', fontWeight: 'bold'
                                                    }}>
                                                        {stat.rating.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>ไม่มีสถิติการเล่น</div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="card">
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
                    {statsGrouped && statsGrouped.length > 0 ? (
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
                                    {statsGrouped.map((stat, idx) => (
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
                    ) : (
                        <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>ยังไม่มีสถิติการเล่น</div>
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

            {activeTab === 'transfer' && !loading && (
                <TransferTab
                    playerId={player.id}
                    playerName={player.name}
                    playerTeamId={player.teamId}
                    askingPrice={player.askingPrice || null}
                    transferStatus={player.transferStatus || 'NOT_LISTED'}
                    userTeamId={userTeamId}
                    marketValue={player.marketValue || 0}
                    onBidSuccess={() => setActiveTab('attributes')}
                />
            )}
        </>
    );
}
