import prisma from '@/lib/prisma';
import SeasonSelector from '@/components/SeasonSelector';
import TeamFilter from '@/components/TeamFilter';
import { getGameTime } from '@/lib/services/gameTime';
import Link from 'next/link';

export default async function FixturesPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string; teamId?: string }>
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const selectedTeamId = params.teamId || '';

    // Fetch matches for the season
    const matches = await prisma.match.findMany({
        where: {
            season: selectedSeason,
            ...(selectedTeamId ? {
                OR: [
                    { homeTeamId: selectedTeamId },
                    { awayTeamId: selectedTeamId }
                ]
            } : {})
        },
        include: {
            homeTeam: true,
            awayTeam: true
        },
        orderBy: { date: 'asc' }
    });

    const teams = await prisma.team.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    // Group by date
    const groupedMatches: Record<string, typeof matches> = {};
    matches.forEach(m => {
        const dateStr = new Date(m.date).toDateString();
        if (!groupedMatches[dateStr]) groupedMatches[dateStr] = [];
        groupedMatches[dateStr].push(m);
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', margin: 0 }}>📅 ตารางการแข่งขัน</h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <TeamFilter teams={teams} selectedTeamId={selectedTeamId} selectedSeason={selectedSeason} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {Object.keys(groupedMatches).length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                        ไม่มีโปรแกรมการแข่งขันในฤดูกาลนี้
                    </div>
                ) : (
                    Object.entries(groupedMatches).map(([date, dateMatches]) => (
                        <div key={date}>
                            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem', display: 'inline-block' }}>
                                📅 {new Date(date).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {dateMatches.map(m => (
                                    <div key={m.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1rem 2rem',
                                        background: 'white',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ flex: 1, textAlign: 'right', fontWeight: '600' }}>{m.homeTeam.name}</div>
                                        <div style={{ margin: '0 2rem', textAlign: 'center' }}>
                                            {m.isPlayed ? (
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ background: 'var(--sidebar-bg)', color: 'white', padding: '4px 12px', borderRadius: '6px', fontWeight: 'bold' }}>
                                                        {m.homeScore} - {m.awayScore}
                                                    </div>
                                                    {m.motmPlayerId && (
                                                        <span title="Man of the Match awarded" style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '1rem' }}>🌟</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ color: 'var(--muted)', fontWeight: 'bold' }}>VS</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left', fontWeight: '600' }}>{m.awayTeam.name}</div>

                                        <div style={{ marginLeft: '2rem', width: '80px', textAlign: 'right' }}>
                                            {m.isPlayed && (
                                                <Link href={`/match?matchId=${m.id}`} style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>รายละเอียด</Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
