import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import SeasonSelector from '@/components/SeasonSelector';
import { calculateSeasonAwards } from '@/lib/services/seasonAwards';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { LEAGUE } from '@/lib/constants/uiLabels';

export const revalidate = 0;

type StandingRow = {
    id: string;
    name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
};

export default async function SeasonSummaryPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string }>;
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;

    const history = await prisma.seasonHistory.findFirst({
        where: { season: selectedSeason }
    });

    const seasonYear = history?.year ?? settings.currentDate.getUTCFullYear();

    const standings: StandingRow[] = history
        ? JSON.parse(history.standings)
        : await (async () => {
            const league = await prisma.league.findFirst();
            if (!league) return [];
            const { standings } = await calculateSeasonAwards(league.id, selectedSeason, seasonYear);
            return standings as StandingRow[];
        })();

    const league = await prisma.league.findFirst();
    if (!league) return <div className="card">No league data found</div>;

    const { awards, rewards } = await calculateSeasonAwards(league.id, selectedSeason, seasonYear);

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>🏆 Season Summary</h1>
                    <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Season {selectedSeason} Awards & Standings</p>
                </div>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            {/* Awards */}
            <Card>
                <CardHeader>
                    <CardTitle>🏅 Season Awards</CardTitle>
                </CardHeader>
                <div className="grid-auto-fit-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--primary-light)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase' }}>🥅 Golden Boot</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px', fontSize: '1.1rem' }}>{awards.goldenBoot?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Goals: {awards.goldenBoot?.goals ?? '-'}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--primary-light)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase' }}>🧤 Golden Glove</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px', fontSize: '1.1rem' }}>{awards.goldenGlove?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Clean Sheets: {awards.goldenGlove?.cleanSheets ?? '-'}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--primary-light)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase' }}>🌟 Player of Season</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px', fontSize: '1.1rem' }}>{awards.playerOfSeason?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Rating: {awards.playerOfSeason?.avgRating?.toFixed?.(2) ?? '-'}</div>
                    </div>
                </div>
            </Card>

            {/* Standings Table */}
            <Card>
                <CardHeader>
                    <CardTitle>📊 Final Standings & Rewards</CardTitle>
                </CardHeader>
                <div className="hidden md:block overflow-x-auto">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>#</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Team</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>P</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>W</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>D</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>L</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '70px' }}>GD</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '70px' }}>Pts</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>Reward</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((row, idx) => {
                                const reward = rewards.find(r => r.teamId === row.id);
                                return (
                                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', background: idx === 0 ? 'rgba(76, 175, 80, 0.05)' : 'transparent' }}>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: idx < 3 ? 'bold' : 'normal', color: idx === 0 ? '#fbbf24' : 'inherit' }}>
                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: '600' }}>{row.name}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.played}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--success)' }}>{row.won}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--accent)' }}>{row.drawn}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--danger)' }}>{row.lost}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.gd > 0 ? '+' : ''}{row.gd}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.05rem' }}>{row.points}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem' }}>
                                            {reward ? (
                                                <span style={{ color: reward.total > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                                                    {reward.total > 0 ? '+' : ''}{formatCurrency(reward.total)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3">
                    {standings.map((row, idx) => {
                        const reward = rewards.find(r => r.teamId === row.id);
                        return (
                            <div key={row.id} className="card" style={{ padding: '14px', borderLeft: idx === 0 ? '5px solid var(--success)' : '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>
                                        {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `}
                                        {row.name}
                                    </div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{row.points} pts</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                                    <div>P: <strong>{row.played}</strong></div>
                                    <div>W: <strong>{row.won}</strong></div>
                                    <div>D: <strong>{row.drawn}</strong></div>
                                    <div>L: <strong>{row.lost}</strong></div>
                                </div>
                                {reward && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', textAlign: 'center', fontWeight: '600', color: reward.total > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                        Reward: {reward.total > 0 ? '+' : ''}{formatCurrency(reward.total)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

function formatCurrency(num: number) {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
}
