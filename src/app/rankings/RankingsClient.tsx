'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SeasonSelector from '@/components/SeasonSelector';
import PlayerModal from '@/components/PlayerModal';

interface Stat {
    playerId: string;
    playerName: string;
    teamName: string;
    position: string;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    minutes: number;
    passAccuracy: number;
    crossesCompleted: number;
    dribblesWon: number;
    tacklesWon: number;
    motmCount: number;
    avgRating: number;
    power: number;
}

interface Tab {
    id: string;
    name: string;
    icon: string;
}

export default function RankingsClient({
    stats,
    tabs,
    currentSeason,
    selectedSeason,
    activeTab
}: {
    stats: Stat[];
    tabs: Tab[];
    currentSeason: number;
    selectedSeason: number;
    activeTab: string;
}) {
    const router = useRouter();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>📊 อันดับสถิตินักเตะ</h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <div style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border)' }}>
                {tabs.map(tab => (
                    <Link
                        key={tab.id}
                        href={`/rankings?season=${selectedSeason}&tab=${tab.id}`}
                        style={{
                            flex: 1, textAlign: 'center', padding: '12px', borderRadius: '8px',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'inherit',
                            fontWeight: '600', transition: 'all 0.2s', textDecoration: 'none'
                        }}
                    >
                        {tab.icon} {tab.name}
                    </Link>
                ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '16px', textAlign: 'left', width: '60px' }}>อันดับ</th>
                            <th style={{ padding: '16px', textAlign: 'left' }}>นักเตะ / ทีม</th>
                            <th style={{ padding: '16px', textAlign: 'center' }}>ลงเล่น (นาที)</th>
                            <th style={{ padding: '16px', textAlign: 'center' }}>
                                {activeTab === 'goals' ? 'ประตู' :
                                    activeTab === 'assists' ? 'แอสซิสต์' :
                                        activeTab === 'passing' ? 'ผ่านบอล %' :
                                            activeTab === 'crossing' ? 'เปิดบอลสำเร็จ' :
                                                activeTab === 'dribbling' ? 'เลี้ยงผ่าน' :
                                                    activeTab === 'tackles' ? 'สกัดบอล' :
                                                        activeTab === 'motm' ? 'M.O.T.M' : 'ใบเหลือง/แดง'}
                            </th>
                            <th style={{ padding: '16px', textAlign: 'center' }}>เรตติ้ง</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.slice(0, 20).map((p, i) => (
                            <tr key={p.playerId} style={{ borderBottom: '1px solid var(--border)', background: i < 3 ? 'rgba(var(--primary-rgb), 0.02)' : 'transparent' }}>
                                <td style={{ padding: '16px', fontWeight: '800', fontSize: '1.2rem', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#92400e' : 'inherit' }}>
                                    #{i + 1}
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <button 
                                        onClick={() => router.push(`/rankings?season=${selectedSeason}&tab=${activeTab}&playerId=${p.playerId}`)}
                                        style={{ color: 'var(--primary)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {p.playerName} <span style={{ color: 'var(--success)', fontWeight: 'bold', marginLeft: '8px' }}>⚡{p.power}</span>
                                        </div>
                                    </button>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{p.teamName} | {p.position}</div>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    {Math.round(p.minutes)}&apos;
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {activeTab === 'goals' ? p.goals :
                                        activeTab === 'assists' ? p.assists :
                                            activeTab === 'passing' ? `${Math.round(p.passAccuracy)}%` :
                                                activeTab === 'crossing' ? p.crossesCompleted :
                                                    activeTab === 'dribbling' ? p.dribblesWon :
                                                        activeTab === 'tackles' ? p.tacklesWon :
                                                            activeTab === 'motm' ? p.motmCount :
                                                                `${p.yellowCards}/${p.redCards}`}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '6px',
                                        background: p.avgRating >= 7.5 ? '#dcfce7' : p.avgRating >= 6.5 ? '#fef9c3' : '#f1f5f9',
                                        color: p.avgRating >= 7.5 ? '#166534' : p.avgRating >= 6.5 ? '#854d0e' : 'inherit',
                                        fontWeight: 'bold'
                                    }}>
                                        {Number(p.avgRating).toFixed(2)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <PlayerModal />
        </div>
    );
}
