import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function LeagueStatsPage() {
    // Top Scorers
    const topScorers = await prisma.player.findMany({
        where: { goals: { gt: 0 } },
        orderBy: { goals: 'desc' },
        take: 10,
        include: { team: true }
    });

    // Top Assists
    const topAssists = await prisma.player.findMany({
        where: { assists: { gt: 0 } },
        orderBy: { assists: 'desc' },
        take: 10,
        include: { team: true }
    });

    // Top Yellow Cards
    const topYellow = await prisma.player.findMany({
        where: { yellowCards: { gt: 0 } },
        orderBy: { yellowCards: 'desc' },
        take: 10,
        include: { team: true }
    });

    // Top Red Cards
    const topRed = await prisma.player.findMany({
        where: { redCards: { gt: 0 } },
        orderBy: { redCards: 'desc' },
        take: 10,
        include: { team: true }
    });

    const StatList = ({ title, players, statKey, label }: { title: string, players: any[], statKey: string, label: string }) => (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#333', borderBottom: '2px solid #f0f0f0', paddingBottom: '0.5rem' }}>{title}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ background: '#f9f9f9', color: '#666' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>นักเตะ</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>{label}</th>
                    </tr>
                </thead>
                <tbody>
                    {players.length === 0 && (
                        <tr>
                            <td colSpan={2} style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>ไม่มีข้อมูล</td>
                        </tr>
                    )}
                    {players.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>
                                <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>{p.team.name}</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {p[statKey]}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div>
            <h2 style={{ margin: '0 0 1.5rem 0' }}>📈 Player Statistics</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '2rem' }}>
                <StatList title="⚽ Top Scorers" players={topScorers} statKey="goals" label="Goals" />
                <StatList title="🎯 จอมส่ง (Top Assists)" players={topAssists} statKey="assists" label="ส่ง" />
                <StatList title="🟨 ใบเหลือง (Yellow Cards)" players={topYellow} statKey="yellowCards" label="ใบ" />
                <StatList title="🟥 ใบแดง (Red Cards)" players={topRed} statKey="redCards" label="ใบ" />
            </div>
        </div>
    );
}
