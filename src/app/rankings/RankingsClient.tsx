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
    activeTab,
    selectedDivision,
    selectedCompetition
}: {
    stats: Stat[];
    tabs: Tab[];
    currentSeason: number;
    selectedSeason: number;
    activeTab: string;
    selectedDivision: number;
    selectedCompetition: string;
}) {
    const router = useRouter();

    const isCup = selectedCompetition === 'cup';
    const subtitle = isCup
        ? `Season ${selectedSeason} · Cup · All Divisions`
        : `Season ${selectedSeason} · Division ${selectedDivision}`;

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>📊 Player Rankings</h1>
                    <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>{subtitle}</p>
                </div>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            {/* Competition tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([
                    ['all', '🌐 All'],
                    ['league', '🏟️ League'],
                    ['cup', '🏆 Cup']
                ] as const).map(([comp, label]) => (
                    <Link
                        key={comp}
                        href={`/rankings?season=${selectedSeason}&tab=${activeTab}&division=${selectedDivision}&competition=${comp}`}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '20px',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            background: selectedCompetition === comp ? 'var(--primary)' : 'var(--card-bg)',
                            color: selectedCompetition === comp ? 'white' : 'inherit',
                            border: '1px solid var(--border)'
                        }}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {/* Division tabs — hidden in Cup mode */}
            {!isCup && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Division:</span>
                    {[1, 2, 3].map((division) => (
                        <Link
                            key={division}
                            href={`/rankings?season=${selectedSeason}&tab=${activeTab}&division=${division}&competition=${selectedCompetition}`}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                background: selectedDivision === division ? 'var(--primary)' : 'var(--card-bg)',
                                color: selectedDivision === division ? 'white' : 'inherit',
                                border: '1px solid var(--border)',
                                fontWeight: 600
                            }}
                        >
                            D{division}
                        </Link>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <Link
                        key={tab.id}
                        href={`/rankings?season=${selectedSeason}&tab=${tab.id}&division=${selectedDivision}&competition=${selectedCompetition}`}
                        style={{
                            flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: '8px',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'inherit',
                            fontWeight: '600', transition: 'all 0.2s', textDecoration: 'none',
                            whiteSpace: 'nowrap', fontSize: '0.9rem'
                        }}
                    >
                        {tab.icon} {tab.name}
                    </Link>
                ))}
            </div>

            {/* Rankings Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="hidden md:block overflow-x-auto">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--sidebar-bg)' }}>
                                <th style={{ padding: '16px', textAlign: 'center', width: '80px', color: 'white' }}>#</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: 'white' }}>Player / Team</th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '120px', color: 'white' }}>Pos</th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '100px', color: 'white' }}>Apps (Min)</th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '120px', color: 'white' }}>
                                    {activeTab === 'goals' ? '⚽ Goals' :
                                        activeTab === 'assists' ? '👟 Assists' :
                                            activeTab === 'passing' ? '🎯 Pass %' :
                                                activeTab === 'crossing' ? '📐 Crosses' :
                                                    activeTab === 'dribbling' ? '🏃 Dribbles' :
                                                        activeTab === 'tackles' ? '🛡️ Tackles' :
                                                            activeTab === 'motm' ? '🌟 MOTM' : '🟨 Cards'}
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '100px', color: 'white' }}>Rating</th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '80px', color: 'white' }}>Power</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.slice(0, 20).map((p, i) => (
                                <tr key={p.playerId} style={{ borderBottom: '1px solid var(--border)', background: i < 3 ? 'rgba(76, 175, 80, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '16px', fontWeight: '800', fontSize: '1.2rem', textAlign: 'center', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#92400e' : 'inherit' }}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <button
                                            onClick={() => router.push(`/rankings?season=${selectedSeason}&tab=${activeTab}&division=${selectedDivision}&competition=${selectedCompetition}&playerId=${p.playerId}`)}
                                            style={{ color: 'var(--primary)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontWeight: '600' }}
                                        >
                                            {p.playerName}
                                        </button>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px' }}>{p.teamName}</div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ background: 'var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600' }}>
                                            {p.position}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>
                                        {Math.round(p.minutes / 90)} ({p.minutes})
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#fbbf24' }}>
                                        {activeTab === 'goals' ? p.goals :
                                            activeTab === 'assists' ? p.assists :
                                                activeTab === 'passing' ? `${p.passAccuracy.toFixed(1)}%` :
                                                    activeTab === 'crossing' ? p.crossesCompleted :
                                                        activeTab === 'dribbling' ? p.dribblesWon :
                                                            activeTab === 'tackles' ? p.tacklesWon :
                                                                activeTab === 'motm' ? p.motmCount :
                                                                    `${p.yellowCards + p.redCards * 2}`}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>
                                        {p.avgRating > 0 ? p.avgRating.toFixed(2) : '-'}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--success)' }}>
                                        {p.power}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3">
                    {stats.slice(0, 20).map((p, i) => (
                        <div key={p.playerId} className="card" style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>
                                    {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `#${i + 1} `}
                                    {p.playerName}
                                </div>
                                <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>
                                    ⚡ {p.power}
                                </div>
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '8px' }}>{p.teamName}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.85rem' }}>
                                <div>Pos: <strong>{p.position}</strong></div>
                                <div>Apps: <strong>{Math.round(p.minutes / 90)}</strong></div>
                                <div>Rating: <strong>{p.avgRating > 0 ? p.avgRating.toFixed(2) : '-'}</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    {activeTab === 'goals' ? '⚽ Goals' : activeTab === 'assists' ? '👟 Assists' : activeTab === 'motm' ? '🌟 MOTM' : 'Stats'}
                                </span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fbbf24' }}>
                                    {activeTab === 'goals' ? p.goals :
                                        activeTab === 'assists' ? p.assists :
                                            activeTab === 'passing' ? `${p.passAccuracy.toFixed(1)}%` :
                                                activeTab === 'crossing' ? p.crossesCompleted :
                                                    activeTab === 'dribbling' ? p.dribblesWon :
                                                        activeTab === 'tackles' ? p.tacklesWon :
                                                            activeTab === 'motm' ? p.motmCount :
                                                                `${p.yellowCards + p.redCards * 2}`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Player Modal */}
            <PlayerModal />
        </div>
    );
}
