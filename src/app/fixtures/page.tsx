import prisma from '@/lib/prisma';
import SeasonSelector from '@/components/SeasonSelector';
import TeamFilter from '@/components/TeamFilter';
import { getGameTime } from '@/lib/services/gameTime';
import Link from 'next/link';
import { formatDateLong } from '@/lib/dateFormat';
import { Card, CardHeader } from '@/components/ui/Card';
import { FIXTURES, MATCH, LEAGUE } from '@/lib/constants/uiLabels';

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
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl md:text-5xl font-bold" style={{ margin: 0 }}>📅 {FIXTURES.TITLE}</h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <TeamFilter teams={teams} selectedTeamId={selectedTeamId} selectedSeason={selectedSeason} />

            {/* Match Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {Object.keys(groupedMatches).length === 0 ? (
                    <Card>
                        <div className="text-center py-xl" style={{ padding: '3rem', color: 'var(--muted)' }}>
                            {FIXTURES.NO_MATCHES}
                        </div>
                    </Card>
                ) : (
                    Object.entries(groupedMatches).map(([date, dateMatches]) => (
                        <div key={date}>
                            {/* Date Header */}
                            <h3 style={{ 
                                marginBottom: '1.5rem', 
                                color: 'var(--primary)', 
                                borderBottom: '2px solid var(--primary)', 
                                paddingBottom: '0.75rem',
                                display: 'inline-block',
                                fontSize: '1.25rem',
                                fontWeight: '700'
                            }}>
                                📅 {formatDateLong(new Date(date))}
                            </h3>
                            
                            {/* Match Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {dateMatches.map(m => {
                                    const isPlayed = m.isPlayed;
                                    const homeWon = (m.homeScore ?? 0) > (m.awayScore ?? 0);
                                    const awayWon = (m.homeScore ?? 0) < (m.awayScore ?? 0);
                                    const isDraw = (m.homeScore ?? 0) === (m.awayScore ?? 0);

                                    return (
                                        <div key={m.id} className="card" style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '1.25rem 1.5rem',
                                            background: 'var(--card-bg)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}>
                                            {/* Home Team */}
                                            <div style={{ flex: 1, textAlign: 'right', fontWeight: '600', fontSize: '1rem' }}>
                                                {m.homeTeam.name}
                                            </div>
                                            
                                            {/* Score / VS */}
                                            <div style={{ 
                                                margin: '0 2rem', 
                                                textAlign: 'center',
                                                minWidth: '120px'
                                            }}>
                                                {isPlayed ? (
                                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                                        <div style={{ 
                                                            background: 'var(--sidebar-bg)', 
                                                            color: 'white', 
                                                            padding: '6px 16px', 
                                                            borderRadius: '8px', 
                                                            fontWeight: 'bold',
                                                            fontSize: '1.1rem'
                                                        }}>
                                                            {m.homeScore} - {m.awayScore}
                                                        </div>
                                                        {m.motmPlayerId && (
                                                            <span 
                                                                title={MATCH.PLAYER_OF_MATCH} 
                                                                style={{ 
                                                                    position: 'absolute', 
                                                                    top: '-8px', 
                                                                    right: '-8px', 
                                                                    fontSize: '1.2rem' 
                                                                }}
                                                            >
                                                                🌟
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ 
                                                        color: 'var(--muted)', 
                                                        fontWeight: 'bold',
                                                        fontSize: '1rem',
                                                        padding: '6px 16px'
                                                    }}>
                                                        VS
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Away Team */}
                                            <div style={{ flex: 1, textAlign: 'left', fontWeight: '600', fontSize: '1rem' }}>
                                                {m.awayTeam.name}
                                            </div>
                                            
                                            {/* Details Link */}
                                            <div style={{ 
                                                marginLeft: '2rem', 
                                                minWidth: '80px', 
                                                textAlign: 'right' 
                                            }}>
                                                {isPlayed && (
                                                    <Link 
                                                        href={`/match?matchId=${m.id}`} 
                                                        className="btn btn-sm btn-ghost"
                                                        style={{ 
                                                            fontSize: '0.85rem', 
                                                            color: 'var(--primary)',
                                                            padding: '6px 12px'
                                                        }}
                                                    >
                                                        {MATCH.DETAILS} →
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
