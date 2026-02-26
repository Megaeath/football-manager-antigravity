import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import SeasonSelector from '@/components/SeasonSelector';
import { calculateSeasonAwards } from '@/lib/services/seasonAwards';

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
    if (!league) return <div className="card">ไม่พบข้อมูลลีก</div>;

    const { awards, rewards } = await calculateSeasonAwards(league.id, selectedSeason, seasonYear);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '2rem', margin: 0 }}>สรุปผลงานฤดูกาล</h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>รางวัลประจำฤดูกาล</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Golden Boot</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px' }}>{awards.goldenBoot?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Goals: {awards.goldenBoot?.goals ?? '-'}</div>
                    </div>
                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Golden Glove</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px' }}>{awards.goldenGlove?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Clean Sheets: {awards.goldenGlove?.cleanSheets ?? '-'}</div>
                    </div>
                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Player of the Season</div>
                        <div style={{ fontWeight: 'bold', marginTop: '6px' }}>{awards.playerOfSeason?.playerName || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Rating: {awards.playerOfSeason?.avgRating?.toFixed?.(2) ?? '-'}</div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>ตารางคะแนน & เงินรางวัล</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                            <th style={{ padding: '12px' }}>ทีม</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>P</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>W</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>D</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>L</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>GD</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>PTS</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Reward</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((row, idx) => {
                            const reward = rewards.find(r => r.teamId === row.id);
                            return (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '12px' }}>{idx + 1}. {row.name}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{row.played}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{row.won}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{row.drawn}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{row.lost}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{row.points}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: 'var(--success)' }}>
                                        {reward ? `${(reward.total / 1000000).toFixed(1)}M` : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
