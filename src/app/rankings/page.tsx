import prisma from '@/lib/prisma';
import SeasonSelector from '@/components/SeasonSelector';
import { getGameTime } from '@/lib/services/gameTime';
import Link from 'next/link';

export default async function RankingsPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string; tab?: string }>
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const activeTab = params.tab || 'goals';

    // Aggregate stats for the season
    const rawStats: any[] = await prisma.$queryRaw`
        SELECT 
            p.id as playerId,
            p.name as playerName,
            t.name as teamName,
            p.naturalPosition as position,
            SUM(pms.goals) as goals,
            SUM(pms.assists) as assists,
            SUM(pms.yellowCards) as yellowCards,
            SUM(pms.redCards) as redCards,
            SUM(pms.minutes) as minutes,
            SUM(pms.passesCompleted) as passesCompleted,
            SUM(pms.passesAttempted) as passesAttempted,
            SUM(pms.tacklesWon) as tacklesWon,
            SUM(pms.tacklesAttempted) as tacklesAttempted,
            SUM(pms.dribblesWon) as dribblesWon,
            SUM(pms.dribblesAttempted) as dribblesAttempted,
            SUM(pms.crossesCompleted) as crossesCompleted,
            SUM(pms.crossesAttempted) as crossesAttempted,
            AVG(pms.rating) as avgRating,
            p.motmCount as motmCount
        FROM PlayerMatchStats pms
        JOIN Match m ON pms.matchId = m.id
        JOIN Player p ON pms.playerId = p.id
        JOIN Team t ON p.teamId = t.id
        WHERE m.season = ${selectedSeason}
        GROUP BY p.id
        HAVING SUM(pms.minutes) > 0
    `;

    // Convert BigInts to Numbers
    const stats = rawStats.map(s => ({
        ...s,
        goals: Number(s.goals || 0),
        assists: Number(s.assists || 0),
        yellowCards: Number(s.yellowCards || 0),
        redCards: Number(s.redCards || 0),
        minutes: Number(s.minutes || 0),
        passesCompleted: Number(s.passesCompleted || 0),
        passesAttempted: Number(s.passesAttempted || 0),
        tacklesWon: Number(s.tacklesWon || 0),
        tacklesAttempted: Number(s.tacklesAttempted || 0),
        dribblesWon: Number(s.dribblesWon || 0),
        dribblesAttempted: Number(s.dribblesAttempted || 0),
        crossesCompleted: Number(s.crossesCompleted || 0),
        crossesAttempted: Number(s.crossesAttempted || 0),
        avgRating: Number(s.avgRating || 0),
        motmCount: Number(s.motmCount || 0),
        passAccuracy: s.passesAttempted > 0 ? (Number(s.passesCompleted) / Number(s.passesAttempted) * 100) : 0,
        crossAccuracy: s.crossesAttempted > 0 ? (Number(s.crossesCompleted) / Number(s.crossesAttempted) * 100) : 0
    }));

    // Sort based on active tab
    const sortedStats = [...stats].sort((a, b) => {
        if (activeTab === 'goals') return b.goals - a.goals || b.avgRating - a.avgRating;
        if (activeTab === 'assists') return b.assists - a.assists || b.avgRating - a.avgRating;
        if (activeTab === 'cards') return (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2);
        if (activeTab === 'passing') return b.passAccuracy - a.passAccuracy;
        if (activeTab === 'crossing') return b.crossesCompleted - a.crossesCompleted || b.crossAccuracy - a.crossAccuracy;
        if (activeTab === 'dribbling') return b.dribblesWon - a.dribblesWon;
        if (activeTab === 'tackles') return b.tacklesWon - a.tacklesWon;
        if (activeTab === 'motm') return b.motmCount - a.motmCount || b.avgRating - a.avgRating;
        return b.avgRating - a.avgRating;
    });

    const tabs = [
        { id: 'goals', name: 'ดาวซัลโว', icon: '⚽' },
        { id: 'assists', name: 'จอมแอสซิสต์', icon: '👟' },
        { id: 'passing', name: 'ความแม่นยำ', icon: '🎯' },
        { id: 'crossing', name: 'จอมเปิดบอล', icon: '📐' },
        { id: 'dribbling', name: 'ยอดคลิกเลี้ยง', icon: '🏃' },
        { id: 'tackles', name: 'การสกัดกั้น', icon: '🛡️' },
        { id: 'motm', name: 'ยอดเยี่ยม', icon: '🌟' },
        { id: 'cards', name: 'ระเบียบวินัย', icon: '🟨' },
    ];

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
                        {sortedStats.slice(0, 20).map((p, i) => (
                            <tr key={p.playerId} style={{ borderBottom: '1px solid var(--border)', background: i < 3 ? 'rgba(var(--primary-rgb), 0.02)' : 'transparent' }}>
                                <td style={{ padding: '16px', fontWeight: '800', fontSize: '1.2rem', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#92400e' : 'inherit' }}>
                                    #{i + 1}
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <Link href={`/player/${p.playerId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.playerName}</div>
                                    </Link>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{p.teamName} | {p.position}</div>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    {Math.round(p.minutes)}'
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
        </div>
    );
}
