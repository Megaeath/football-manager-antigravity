import prisma from '@/lib/prisma';
import SeasonSelector from '@/components/SeasonSelector';
import TeamFilter from '@/components/TeamFilter';
import { getGameTime } from '@/lib/services/gameTime';
import Link from 'next/link';
import { formatDateLong } from '@/lib/dateFormat';
import { Card } from '@/components/ui/Card';
import { FIXTURES, MATCH } from '@/lib/constants/uiLabels';
import { getLeagueByDivisionLevel } from '@/lib/services/divisionSystem';
import { initializeCupTournamentForSeason, isCupModelAvailable } from '@/lib/services/SwissTournament';

function cupPhaseLabel(phase: string | null, round: number | null): string {
    if (!phase) return '🏆 Cup';
    if (phase === 'SWISS') return `🏆 Swiss Rd.${round ?? '?'}`;
    if (phase === 'KNOCKOUT') {
        const labels: Record<number, string> = { 1: 'R16', 2: 'QF', 3: 'SF', 4: 'Final' };
        return `🏆 ${labels[round ?? 0] ?? `KO Rd.${round}`}`;
    }
    return `🏆 ${phase}`;
}

function addDaysUTC(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

const CUP_ROUND_INTERVAL_DAYS = 5;

export default async function FixturesPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string; teamId?: string; division?: string; competition?: string }>
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const selectedTeamId = params.teamId || '';
    const selectedDivision = params.division ? parseInt(params.division) : 1;
    const competition = (params.competition || 'league') as 'all' | 'league' | 'cup';

    const isLeague = competition === 'league';
    const isCup = competition === 'cup';
    const isAll = competition === 'all';

    // Ensure selected season cup tournament exists so cup fixtures/schedule can be shown immediately.
    if (isCup || isAll) {
        try {
            await initializeCupTournamentForSeason(selectedSeason);
        } catch (error) {
            console.error('[Fixtures] Failed to ensure cup tournament:', error);
        }
    }

    const cupTournament = (isCup || isAll) && isCupModelAvailable()
        ? await prisma.cupTournament.findUnique({ where: { season: selectedSeason } })
        : null;

    const cupTeamCount = cupTournament
        ? await prisma.swissStanding.count({ where: { tournamentId: cupTournament.id } })
        : 0;

    const cupRoundMatches = cupTournament
        ? await prisma.match.findMany({
            where: {
                season: selectedSeason,
                competitionType: 'CUP',
                cupTournamentId: cupTournament.id
            },
            select: {
                competitionPhase: true,
                competitionRound: true,
                isPlayed: true
            }
        })
        : [];

    const roundKey = (phase: string, round: number) => `${phase}-${round}`;
    const roundStats = new Map<string, { total: number; played: number }>();
    cupRoundMatches.forEach((m: any) => {
        const key = roundKey(m.competitionPhase || 'UNKNOWN', m.competitionRound || 0);
        const current = roundStats.get(key) || { total: 0, played: 0 };
        current.total += 1;
        if (m.isPlayed) current.played += 1;
        roundStats.set(key, current);
    });

    const cupSchedule = cupTournament
        ? (() => {
            const rows: Array<{
                key: string;
                label: string;
                date: Date;
                plannedMatches: number;
                createdMatches: number;
                playedMatches: number;
            }> = [];

            const swissPlanned = cupTeamCount > 1 ? Math.floor(cupTeamCount / 2) : 0;
            for (let r = 1; r <= 8; r++) {
                const stat = roundStats.get(roundKey('SWISS', r)) || { total: 0, played: 0 };
                rows.push({
                    key: `SWISS-${r}`,
                    label: `Swiss Round ${r}`,
                    date: addDaysUTC(cupTournament.startDate, (r - 1) * CUP_ROUND_INTERVAL_DAYS),
                    plannedMatches: swissPlanned,
                    createdMatches: stat.total,
                    playedMatches: stat.played
                });
            }

            const knockout = [
                { r: 1, label: 'Round of 16', planned: 8 },
                { r: 2, label: 'Quarter-final', planned: 4 },
                { r: 3, label: 'Semi-final', planned: 2 },
                { r: 4, label: 'Final', planned: 1 }
            ];
            knockout.forEach((k, idx) => {
                const stat = roundStats.get(roundKey('KNOCKOUT', k.r)) || { total: 0, played: 0 };
                rows.push({
                    key: `KNOCKOUT-${k.r}`,
                    label: k.label,
                    date: addDaysUTC(cupTournament.startDate, (8 + idx) * CUP_ROUND_INTERVAL_DAYS),
                    plannedMatches: k.planned,
                    createdMatches: stat.total,
                    playedMatches: stat.played
                });
            });

            return rows;
        })()
        : [];

    const league = isLeague ? await getLeagueByDivisionLevel(selectedDivision, selectedSeason) : null;

    // Build match where clause
    const competitionWhere = isCup
        ? { competitionType: 'CUP' as const }
        : isLeague
            ? { competitionType: 'LEAGUE' as const }
            : {};

    const matches = await (prisma.match as any).findMany({
        where: {
            season: selectedSeason,
            ...competitionWhere,
            ...(isLeague && league ? { homeTeam: { is: { leagueId: league.id } } } : {}),
            ...(isLeague && selectedTeamId ? {
                OR: [
                    { homeTeamId: selectedTeamId },
                    { awayTeamId: selectedTeamId }
                ]
            } : {})
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { date: 'asc' }
    });

    // Find next (not played) cup match for selected team
    let nextCupMatchId: string | null = null;
    if (isCup && selectedTeamId) {
        const next = matches.find((m: any) =>
            !m.isPlayed && (m.homeTeamId === selectedTeamId || m.awayTeamId === selectedTeamId)
        );
        if (next) nextCupMatchId = next.id;
    }

    const teams = isLeague
        ? await prisma.team.findMany({
            where: league ? { leagueId: league.id } : undefined,
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
        : [];

    // Group by date
    const groupedMatches: Record<string, typeof matches> = {};
    matches.forEach((m: any) => {
        const dateStr = new Date(m.date).toDateString();
        if (!groupedMatches[dateStr]) groupedMatches[dateStr] = [];
        groupedMatches[dateStr].push(m);
    });

    const tabBase = (comp: string) => `/fixtures?season=${selectedSeason}&competition=${comp}`;
    const divBase = (div: number) =>
        `/fixtures?season=${selectedSeason}&competition=league&division=${div}${selectedTeamId ? `&teamId=${selectedTeamId}` : ''}`;

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl md:text-5xl font-bold" style={{ margin: 0 }}>📅 {FIXTURES.TITLE}</h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            {/* Competition tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([['all', '🌐 All'], ['league', '🏟️ League'], ['cup', '🏆 Cup']] as const).map(([comp, label]) => (
                    <Link
                        key={comp}
                        href={tabBase(comp)}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '20px',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            background: competition === comp ? 'var(--primary)' : 'var(--card-bg)',
                            color: competition === comp ? 'white' : 'inherit',
                            border: '1px solid var(--border)'
                        }}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {/* League sub-filters: division + team */}
            {isLeague && (
                <>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Division:</span>
                        {[1, 2, 3].map((div) => (
                            <Link
                                key={div}
                                href={divBase(div)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    background: selectedDivision === div ? 'var(--primary)' : 'var(--card-bg)',
                                    color: selectedDivision === div ? 'white' : 'inherit',
                                    border: '1px solid var(--border)',
                                    fontWeight: 600
                                }}
                            >
                                D{div}
                            </Link>
                        ))}
                    </div>
                    <TeamFilter teams={teams} selectedTeamId={selectedTeamId} selectedSeason={selectedSeason} />
                </>
            )}

            {/* Cup info badge */}
            {isCup && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    🏆 <strong style={{ color: 'var(--foreground)' }}>Cup</strong> — ทุก division เตะรวมกัน · กรองได้เฉพาะ Season
                </div>
            )}

            {/* Cup schedule timeline (visible even before pairings are created) */}
            {isCup && cupTournament && (
                <Card>
                    <div style={{ fontWeight: 700, marginBottom: '10px' }}>🗓️ Cup Schedule (Pre-planned)</div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {cupSchedule.map((r) => {
                            const created = r.createdMatches;
                            const played = r.playedMatches;
                            const status = created === 0
                                ? 'รอจับคู่ (TBD)'
                                : played >= created
                                    ? `แข่งครบแล้ว ${played}/${created}`
                                    : `มีคู่แข่งแล้ว ${created}/${r.plannedMatches} · แข่งแล้ว ${played}/${created}`;

                            return (
                                <div
                                    key={r.key}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.4fr 1fr 1fr',
                                        gap: '8px',
                                        alignItems: 'center',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '8px 10px'
                                    }}
                                >
                                    <div style={{ fontWeight: 600 }}>{r.label}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{formatDateLong(r.date)}</div>
                                    <div style={{ fontSize: '0.82rem', textAlign: 'right', color: created === 0 ? 'var(--muted)' : 'var(--primary)' }}>
                                        {status}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(dateMatches as any[]).map((m: any) => {
                                    const isNextCupMatch = isCup && nextCupMatchId && m.id === nextCupMatchId;
                                    const isPlayed = m.isPlayed;
                                    const isCupMatch = m.competitionType === 'CUP';
                                    const hasPenalties = m.wentToPenalties && m.penaltyHome !== null && m.penaltyAway !== null;

                                    return (
                                        <div key={m.id} className="card" style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0',
                                            background: isNextCupMatch ? 'rgba(251,191,36,0.10)' : 'var(--card-bg)',
                                            borderRadius: '12px',
                                            border: isNextCupMatch
                                                ? '2.5px solid #fbbf24'
                                                : `1px solid ${isCupMatch ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
                                            overflow: 'hidden',
                                            boxShadow: isNextCupMatch ? '0 0 0 2px #fbbf24' : '0 2px 4px rgba(0,0,0,0.02)'
                                        }}>
                                            {/* Cup phase badge row + Next Match badge */}
                                            {(isCupMatch || isAll) && isCupMatch && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '4px 14px',
                                                    background: 'rgba(245,158,11,0.1)',
                                                    borderBottom: '1px solid rgba(245,158,11,0.2)',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    color: '#b45309',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    {cupPhaseLabel(m.competitionPhase, m.competitionRound)}
                                                    {isNextCupMatch && (
                                                        <span style={{
                                                            background: '#fbbf24',
                                                            color: 'white',
                                                            borderRadius: '8px',
                                                            padding: '2px 10px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 800,
                                                            marginLeft: '8px',
                                                            letterSpacing: '0.04em'
                                                        }}>
                                                            NEXT MATCH
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Main row */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '1.25rem 1.5rem'
                                            }}>
                                                {/* Home Team */}
                                                <div style={{ flex: 1, textAlign: 'right', fontWeight: '600', fontSize: '1rem' }}>
                                                    {m.homeTeam.name}
                                                </div>

                                                {/* Score / VS */}
                                                <div style={{ margin: '0 2rem', textAlign: 'center', minWidth: '120px' }}>
                                                    {isPlayed ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
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
                                                                    <span title={MATCH.PLAYER_OF_MATCH} style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '1.2rem' }}>🌟</span>
                                                                )}
                                                            </div>
                                                            {hasPenalties && (
                                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>
                                                                    🥅 {m.penaltyHome}–{m.penaltyAway} PKs
                                                                </div>
                                                            )}
                                                            {m.wentToExtraTime && !hasPenalties && (
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>AET</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--muted)', fontWeight: 'bold', fontSize: '1rem', padding: '6px 16px' }}>VS</div>
                                                    )}
                                                </div>

                                                {/* Away Team */}
                                                <div style={{ flex: 1, textAlign: 'left', fontWeight: '600', fontSize: '1rem' }}>
                                                    {m.awayTeam.name}
                                                </div>

                                                {/* Details Link */}
                                                <div style={{ marginLeft: '2rem', minWidth: '80px', textAlign: 'right' }}>
                                                    {isPlayed && (
                                                        <Link
                                                            href={`/match?matchId=${m.id}`}
                                                            className="btn btn-sm btn-ghost"
                                                            style={{ fontSize: '0.85rem', color: 'var(--primary)', padding: '6px 12px' }}
                                                        >
                                                            {MATCH.DETAILS} →
                                                        </Link>
                                                    )}
                                                </div>
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
