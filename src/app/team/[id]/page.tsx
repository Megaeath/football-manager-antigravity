import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { BreadcrumbRegister } from '@/components/BreadcrumbContext';

const prisma = new PrismaClient();

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = await prisma.team.findUnique({
        where: { id: id },
        include: {
            players: {
                where: { isRetired: false },
                orderBy: { tacticalPosition: 'desc' }
            },
            homeMatches: { include: { awayTeam: true, homeTeam: true } },
            awayMatches: { include: { homeTeam: true, awayTeam: true } }
        }
    });

    if (!team) return <div className="card">ไม่พบข้อมูลทีม</div>;

    // Sort players by position: GK -> DF -> MF -> FW
    const positionOrder: Record<string, number> = {
        'GK': 1,
        'DR': 2, 'DC': 2, 'DL': 2,
        'DMR': 3, 'DMC': 3, 'DML': 3,
        'MR': 4, 'MC': 4, 'ML': 4,
        'AMR': 5, 'AMC': 5, 'AML': 5,
        'FWR': 6, 'FWC': 6, 'FWL': 6
    };

    const sortedPlayers = [...team.players].sort((a, b) => {
        const orderA = positionOrder[a.tacticalPosition || a.naturalPosition] || 99;
        const orderB = positionOrder[b.tacticalPosition || b.naturalPosition] || 99;
        return orderA - orderB;
    });

    // Combine matches and normalize
    const matches = [
        ...team.homeMatches.map(m => ({ ...m, role: 'home', opponent: m.awayTeam })),
        ...team.awayMatches.map(m => ({ ...m, role: 'away', opponent: m.homeTeam }))
    ];

    // Sort by date
    matches.sort((a, b) => b.date.getTime() - a.date.getTime());

    const stats = matches.reduce((acc, m) => {
        const isWin = m.role === 'home' ? m.homeScore! > m.awayScore! : m.awayScore! > m.homeScore!;
        const isLoss = m.role === 'home' ? m.homeScore! < m.awayScore! : m.awayScore! < m.homeScore!;
        if (isWin) acc.w++;
        else if (isLoss) acc.l++;
        else acc.d++;
        return acc;
    }, { w: 0, d: 0, l: 0 });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <BreadcrumbRegister segment={id} name={team.name} />

            {/* Team Header */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--sidebar-bg)', color: 'white' }}>
                <div>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>{team.name}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '8px' }}>สโมสรฟุตบอล • สมาชิกของลีกสูงสุด</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ background: 'var(--success)', color: 'white', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>WINS</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.w}</div>
                    </div>
                    <div style={{ background: 'var(--accent)', color: 'white', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>DRAWS</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.d}</div>
                    </div>
                    <div style={{ background: 'var(--danger)', color: 'white', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>LOSSES</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.l}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* SQUAD LIST */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>รายชื่อผู้เล่นในทีม</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                <th style={{ padding: '12px' }}>ตำแหน่ง</th>
                                <th style={{ padding: '12px' }}>ชื่อนักเตะ</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>ลงสนาม</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>ประตู</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>ช่วยทำ</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayers.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '12px' }}>
                                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                            {p.tacticalPosition || p.naturalPosition}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <Link href={`/player/${p.id}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>{p.name}</Link>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.apps}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.goals}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.assists}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{p.avgRating.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATCH HISTORY */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>ประวัติการแข่ง</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {matches.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>ยังไม่มีข้อมูลการแข่ง</p>}
                        {matches.map(m => {
                            const outcome = m.role === 'home'
                                ? (m.homeScore! > m.awayScore! ? 'W' : m.homeScore! < m.awayScore! ? 'L' : 'D')
                                : (m.awayScore! > m.homeScore! ? 'W' : m.awayScore! < m.homeScore! ? 'L' : 'D');

                            const color = outcome === 'W' ? 'var(--success)' : outcome === 'L' ? 'var(--danger)' : 'var(--accent)';

                            return (
                                <div key={m.id} style={{
                                    padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', position: 'relative', overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            {m.role === 'home' ? '🏠 Home' : '✈️ Away'}
                                        </div>
                                        <div style={{ fontWeight: 'bold', color: color }}>{outcome}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: '600' }}>vs {m.opponent.name}</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{m.homeScore} - {m.awayScore}</div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '8px' }}>
                                        {new Date(m.date).toLocaleDateString('th-TH')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
