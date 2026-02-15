import prisma from '@/lib/prisma';
import { BreadcrumbRegister } from '@/components/BreadcrumbContext';

// ... (getPlayer function remains same)
async function getPlayer(id: string) {
    const player = await prisma.player.findUnique({
        where: { id },
        include: {
            team: true,
            matchStats: {
                include: { match: { include: { homeTeam: true, awayTeam: true } } },
                orderBy: { match: { date: 'desc' } }
            }
        }
    });
    return player as any;
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const player = await getPlayer(id);

    if (!player) return <div className="card">ไม่พบข้อมูลนักเตะ</div>;

    const AttributeItem = ({ label, value }: { label: string, value: number }) => (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontWeight: 'bold', color: value > 15 ? 'var(--success)' : value > 10 ? 'var(--accent)' : 'inherit' }}>{value}</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${(value / 20) * 100}%`,
                    background: value > 15 ? 'var(--success)' : value > 10 ? 'var(--accent)' : 'var(--primary)'
                }}></div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <BreadcrumbRegister segment={id} name={player.name} />

            {/* Header Section */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'var(--sidebar-bg)', color: 'white' }}>
                <div style={{
                    width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
                }}>
                    👤
                </div>
                <div>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>{player.name}</h1>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                        <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>{player.naturalPosition}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{player.team.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>• อายุ {player.age} ปี</span>
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Average Rating</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{player.avgRating.toFixed(2)}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Left: Attributes */}
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>พลังความสามารถ (Attributes)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Technical</h4>
                            <AttributeItem label="Handling (GK)" value={player.handling} />
                            <AttributeItem label="Tackling" value={player.tackling} />
                            <AttributeItem label="Passing" value={player.passing} />
                            <AttributeItem label="Shooting" value={player.shooting} />
                            <AttributeItem label="Heading" value={player.heading} />
                            <AttributeItem label="Dribbling" value={player.dribbling} />
                            <AttributeItem label="Set Pieces" value={player.setPieces} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Mental</h4>
                            <AttributeItem label="Aggression" value={player.aggression} />
                            <AttributeItem label="Positioning" value={player.positioning} />
                            <AttributeItem label="Vision" value={player.vision} />
                            <AttributeItem label="Bravery" value={player.bravery} />
                            <AttributeItem label="Leadership" value={player.leadership} />
                            <AttributeItem label="Teamwork" value={player.teamwork} />
                            <AttributeItem label="Composure" value={player.composure} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '1rem' }}>Physical</h4>
                            <AttributeItem label="Pace" value={player.pace} />
                            <AttributeItem label="Acceleration" value={player.acceleration} />
                            <AttributeItem label="Stamina" value={player.stamina} />
                            <AttributeItem label="Strength" value={player.strength} />
                            <AttributeItem label="Agility" value={player.agility} />
                            <AttributeItem label="Balance" value={player.balance} />
                        </div>
                    </div>
                </div>

                {/* Right: Stats & Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>สถิติฤดูกาลนี้</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ลงสนาม</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{player.apps}</div>
                            </div>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ประตู / แอสซิสต์</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{player.goals} / {player.assists}</div>
                            </div>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ส่งบอลสำเร็จ</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                                    {player.passesCompleted} / {player.passesAttempted}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'normal' }}>
                                        ({player.passesAttempted > 0 ? ((player.passesCompleted / player.passesAttempted) * 100).toFixed(1) : 0}%)
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ผู้เล่นยอดเยี่ยม (MotM)</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>🌟 {player.motmCount || 0}</div>
                            </div>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ความฟิต</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{player.condition}%</div>
                            </div>
                            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ความสุข (Morale)</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{player.morale}</div>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>ฟอร์มล่าสุด</h3>
                        {player.matchStats.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>ยังไม่มีบันทึกการแข่ง</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {player.matchStats.slice(0, 5).map(stat => (
                                <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            v {stat.teamId === stat.match.homeTeamId ? stat.match.awayTeam.name : stat.match.homeTeam.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                            {stat.goals} G • {stat.assists} A
                                        </div>
                                    </div>
                                    <div style={{
                                        width: '40px', height: '40px', background: stat.rating >= 7.5 ? 'var(--success)' : stat.rating >= 6.5 ? 'var(--accent)' : 'var(--muted)',
                                        color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                    }}>
                                        {stat.rating.toFixed(1)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
