import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import SeasonSelector from '@/components/SeasonSelector';
import { calculateSeasonAwards } from '@/lib/services/seasonAwards';
import { calculateCupRewards } from '@/lib/services/cupRewards';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { getLeagueByDivisionLevel } from '@/lib/services/divisionSystem';
import SeasonSummaryClient from './SeasonSummaryClient';

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

type LeaderRow = {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    value: number;
    matches: number;
};

type CleanSheetLeader = {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    cleanSheets: number;
};

type MatchRecord = {
    id: string;
    homeTeam: {
        id: string;
        name: string;
    };
    awayTeam: {
        id: string;
        name: string;
    };
    homeScore: number | null;
    awayScore: number | null;
};

type TransferFeeRow = {
    id: string;
    playerId: string;
    playerName: string;
    fromTeamId: string | null;
    fromTeamName: string | null;
    toTeamId: string;
    toTeamName: string;
    fee: number;
};

export default async function SeasonSummaryPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string; division?: string; competition?: string }>;
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const selectedDivision = params.division ? parseInt(params.division) : 1;
    const competition = (params.competition || 'all').toLowerCase() as 'all' | 'league' | 'cup';

    const isLeague = competition === 'league';
    const isCup = competition === 'cup';
    const isAll = competition === 'all';

    // League data — only needed in league/all mode
    const league = (isLeague || isAll) ? await getLeagueByDivisionLevel(selectedDivision, selectedSeason) : null;

    if ((isLeague || isAll) && !league) {
        return <div className="card">No league data found for Division {selectedDivision}</div>;
    }

    const seasonYear = settings.currentDate.getUTCFullYear();

    // League standings & awards — only when we have a league
    let standings: StandingRow[] = [];
    let awards: Awaited<ReturnType<typeof calculateSeasonAwards>>['awards'] = {} as never;
    let rewards: Awaited<ReturnType<typeof calculateSeasonAwards>>['rewards'] = [];

    if (league) {
        const history = await prisma.seasonHistory.findFirst({
            where: { season: selectedSeason, leagueId: league.id }
        });

        standings = history
            ? JSON.parse(history.standings)
            : (await calculateSeasonAwards(league.id, selectedSeason, seasonYear)).standings as StandingRow[];

        const seasonData = await calculateSeasonAwards(league.id, selectedSeason, seasonYear);
        awards = seasonData.awards;
        rewards = seasonData.rewards;
    }

    // Cup data — always load
    const cupRewards = await calculateCupRewards(selectedSeason);

    // Cup champion from final match
    const cupFinal = await (prisma.match as any).findFirst({
        where: { season: selectedSeason, competitionType: 'CUP', competitionPhase: 'KNOCKOUT', competitionRound: 4, isPlayed: true },
        include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } }
    });
    let cupChampion: { id: string; name: string } | null = null;
    let cupRunnerUp: { id: string; name: string } | null = null;
    if (cupFinal) {
        const hScore = cupFinal.homeScore ?? 0;
        const aScore = cupFinal.awayScore ?? 0;
        const homeWon = hScore > aScore || (hScore === aScore && (cupFinal.penaltyHome ?? 0) > (cupFinal.penaltyAway ?? 0));
        cupChampion = homeWon ? cupFinal.homeTeam : cupFinal.awayTeam;
        cupRunnerUp = homeWon ? cupFinal.awayTeam : cupFinal.homeTeam;
    }

    // Combined rewards for "all" mode
    const rewardMap = new Map<string, { teamName: string; league: number; cup: number }>();
    rewards.forEach((r) => {
        rewardMap.set(r.teamId, { teamName: r.teamName, league: r.total, cup: 0 });
    });
    cupRewards.forEach((r) => {
        const existing = rewardMap.get(r.teamId);
        rewardMap.set(r.teamId, {
            teamName: existing?.teamName || r.teamName,
            league: existing?.league || 0,
            cup: (existing?.cup || 0) + r.reward
        });
    });
    const combinedRewards = [...rewardMap.entries()]
        .map(([teamId, item]) => ({ teamId, teamName: item.teamName, league: item.league, cup: item.cup, total: item.league + item.cup }))
        .sort((a, b) => b.total - a.total);

    const scopedLeagueTeams = (isLeague || isAll) && league
        ? await prisma.team.findMany({
            where: { leagueId: league.id },
            select: { id: true, name: true }
        })
        : [];
    const scopedLeagueTeamIds = scopedLeagueTeams.map((team) => team.id);

    const matchScopeWhere: any = {
        season: selectedSeason,
        isPlayed: true,
        ...(isLeague ? { competitionType: 'LEAGUE' } : isCup ? { competitionType: 'CUP' } : {}),
        ...((isLeague || isAll) && scopedLeagueTeamIds.length > 0
            ? {
                OR: [
                    { homeTeamId: { in: scopedLeagueTeamIds } },
                    { awayTeamId: { in: scopedLeagueTeamIds } }
                ]
            }
            : {})
    };

    const playerStatsScopeWhere: any = {
        match: {
            season: selectedSeason,
            isPlayed: true,
            ...(isLeague ? { competitionType: 'LEAGUE' } : isCup ? { competitionType: 'CUP' } : {})
        },
        ...((isLeague || isAll) && scopedLeagueTeamIds.length > 0
            ? { teamId: { in: scopedLeagueTeamIds } }
            : {})
    };

    const [summaryMatches, summaryPlayerStats, rawTransferFees] = await Promise.all([
        prisma.match.findMany({
            where: matchScopeWhere,
            include: {
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } }
            },
            orderBy: { date: 'asc' }
        }),
        prisma.playerMatchStats.findMany({
            where: playerStatsScopeWhere,
            include: {
                player: { select: { id: true, name: true, naturalPosition: true } },
                match: {
                    select: {
                        id: true,
                        competitionType: true,
                        homeTeamId: true,
                        awayTeamId: true,
                        homeScore: true,
                        awayScore: true,
                        homeTeam: { select: { id: true, name: true } },
                        awayTeam: { select: { id: true, name: true } }
                    }
                }
            }
        }),
        prisma.transferHistory.findMany({
            where: {
                season: selectedSeason,
                ...((isLeague || isAll) && scopedLeagueTeamIds.length > 0
                    ? {
                        OR: [
                            { fromTeamId: { in: scopedLeagueTeamIds } },
                            { toTeamId: { in: scopedLeagueTeamIds } }
                        ]
                    }
                    : {})
            },
            include: {
                player: { select: { id: true, name: true } },
                fromTeam: { select: { id: true, name: true } },
                toTeam: { select: { id: true, name: true } }
            },
            orderBy: { fee: 'desc' },
            take: 5
        })
    ]);

    const leaderboardMap = new Map<string, {
        playerId: string;
        playerName: string;
        teamId: string;
        teamName: string;
        goals: number;
        assists: number;
        passesCompleted: number;
        dribblesWon: number;
        totalRating: number;
        matches: number;
    }>();

    const cleanSheetMap = new Map<string, CleanSheetLeader>();

    for (const stat of summaryPlayerStats) {
        if ((stat.minutes || 0) <= 0) continue;

        const teamId = stat.teamId;
        const teamName = stat.teamId === stat.match.homeTeamId
            ? stat.match.homeTeam.name
            : stat.match.awayTeam.name;

        const current = leaderboardMap.get(stat.playerId) || {
            playerId: stat.playerId,
            playerName: stat.player.name,
            teamId,
            teamName,
            goals: 0,
            assists: 0,
            passesCompleted: 0,
            dribblesWon: 0,
            totalRating: 0,
            matches: 0
        };

        current.goals += stat.goals || 0;
        current.assists += stat.assists || 0;
        current.passesCompleted += stat.passesCompleted || 0;
        current.dribblesWon += stat.dribblesWon || 0;
        current.totalRating += stat.rating || 0;
        current.matches += 1;

        leaderboardMap.set(stat.playerId, current);
    }

    for (const match of summaryMatches) {
        const homeClean = (match.awayScore || 0) === 0;
        const awayClean = (match.homeScore || 0) === 0;

        if (homeClean) {
            const gk = summaryPlayerStats
                .filter((stat) => stat.matchId === match.id && stat.teamId === match.homeTeamId && stat.player.naturalPosition.startsWith('GK') && stat.minutes > 0)
                .sort((a, b) => b.minutes - a.minutes)[0];
            if (gk) {
                const current = cleanSheetMap.get(gk.playerId) || {
                    playerId: gk.playerId,
                    playerName: gk.player.name,
                    teamId: gk.teamId,
                    teamName: match.homeTeam.name,
                    cleanSheets: 0
                };
                current.cleanSheets += 1;
                cleanSheetMap.set(gk.playerId, current);
            }
        }

        if (awayClean) {
            const gk = summaryPlayerStats
                .filter((stat) => stat.matchId === match.id && stat.teamId === match.awayTeamId && stat.player.naturalPosition.startsWith('GK') && stat.minutes > 0)
                .sort((a, b) => b.minutes - a.minutes)[0];
            if (gk) {
                const current = cleanSheetMap.get(gk.playerId) || {
                    playerId: gk.playerId,
                    playerName: gk.player.name,
                    teamId: gk.teamId,
                    teamName: match.awayTeam.name,
                    cleanSheets: 0
                };
                current.cleanSheets += 1;
                cleanSheetMap.set(gk.playerId, current);
            }
        }
    }

    const aggregatedLeaders = Array.from(leaderboardMap.values()).map((row) => ({
        ...row,
        avgRating: row.matches > 0 ? row.totalRating / row.matches : 0
    }));

    const playerOfSeasonLeaderboardSource = (() => {
        if (isCup) {
            return aggregatedLeaders;
        }

        // Keep league ranking criteria aligned with calculateSeasonAwards()
        // so "Player of Season" card and "Player of Season Ranking" list match.
        const leagueOnlyMap = new Map<string, {
            playerId: string;
            playerName: string;
            teamId: string;
            teamName: string;
            goals: number;
            assists: number;
            totalRating: number;
            matches: number;
        }>();

        for (const stat of summaryPlayerStats) {
            if (stat.match.competitionType !== 'LEAGUE') continue;
            if (scopedLeagueTeamIds.length > 0 && !scopedLeagueTeamIds.includes(stat.teamId)) continue;

            const teamName = stat.teamId === stat.match.homeTeamId
                ? stat.match.homeTeam.name
                : stat.match.awayTeam.name;

            const current = leagueOnlyMap.get(stat.playerId) || {
                playerId: stat.playerId,
                playerName: stat.player.name,
                teamId: stat.teamId,
                teamName,
                goals: 0,
                assists: 0,
                totalRating: 0,
                matches: 0
            };

            current.goals += stat.goals || 0;
            current.assists += stat.assists || 0;
            current.totalRating += stat.rating || 0;
            current.matches += 1;

            leagueOnlyMap.set(stat.playerId, current);
        }

        return Array.from(leagueOnlyMap.values()).map((row) => ({
            ...row,
            avgRating: row.matches > 0 ? row.totalRating / row.matches : 0
        }));
    })();

    const topScorers: LeaderRow[] = aggregatedLeaders
        .filter((row) => row.goals > 0)
        .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || (b.avgRating - a.avgRating))
        .slice(0, 5)
        .map((row) => ({ playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, value: row.goals, matches: row.matches }));

    const topAssisters: LeaderRow[] = aggregatedLeaders
        .filter((row) => row.assists > 0)
        .sort((a, b) => (b.assists - a.assists) || (b.goals - a.goals) || (b.avgRating - a.avgRating))
        .slice(0, 5)
        .map((row) => ({ playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, value: row.assists, matches: row.matches }));

    const topPassers: LeaderRow[] = aggregatedLeaders
        .filter((row) => row.passesCompleted > 0)
        .sort((a, b) => (b.passesCompleted - a.passesCompleted) || (b.avgRating - a.avgRating))
        .slice(0, 5)
        .map((row) => ({ playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, value: row.passesCompleted, matches: row.matches }));

    const topDribblers: LeaderRow[] = aggregatedLeaders
        .filter((row) => row.dribblesWon > 0)
        .sort((a, b) => (b.dribblesWon - a.dribblesWon) || (b.avgRating - a.avgRating))
        .slice(0, 5)
        .map((row) => ({ playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, value: row.dribblesWon, matches: row.matches }));

    const topPlayersOfSeason: LeaderRow[] = playerOfSeasonLeaderboardSource
        .filter((row) => row.matches >= 5)
        .sort((a, b) => (b.avgRating - a.avgRating) || (b.goals - a.goals))
        .slice(0, 5)
        .map((row) => ({ playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, value: Number(row.avgRating.toFixed(2)), matches: row.matches }));

    const topGoalkeepers: CleanSheetLeader[] = Array.from(cleanSheetMap.values())
        .sort((a, b) => b.cleanSheets - a.cleanSheets)
        .slice(0, 5);

    const highestTotalGoalsMatch: MatchRecord | null = summaryMatches.length > 0
        ? [...summaryMatches]
            .sort((a, b) => ((b.homeScore || 0) + (b.awayScore || 0)) - ((a.homeScore || 0) + (a.awayScore || 0)))[0]
        : null;

    const highestWinnerGoalsMatch: MatchRecord | null = summaryMatches.length > 0
        ? [...summaryMatches]
            .sort((a, b) => Math.max(b.homeScore || 0, b.awayScore || 0) - Math.max(a.homeScore || 0, a.awayScore || 0))[0]
        : null;

    const topTransferFees: TransferFeeRow[] = rawTransferFees.map((row) => ({
        id: row.id,
        playerId: row.playerId,
        playerName: row.player?.name || 'Unknown',
        fromTeamId: row.fromTeamId,
        fromTeamName: row.fromTeam?.name || null,
        toTeamId: row.toTeamId,
        toTeamName: row.toTeam.name,
        fee: row.fee
    }));

    const subtitle = isCup
        ? `Season ${selectedSeason} · Cup`
        : `Season ${selectedSeason} · ${league?.name ?? ''}`;

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>🏆 Season Summary</h1>
                    <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>{subtitle}</p>
                </div>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            {/* Competition tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([['all', '🌐 All'], ['league', '🏟️ League'], ['cup', '🏆 Cup']] as const).map(([comp, label]) => (
                    <Link
                        key={comp}
                        href={`/season-summary?season=${selectedSeason}&division=${selectedDivision}&competition=${comp}`}
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

            {/* Division tabs — league/all mode only */}
            {!isCup && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Division:</span>
                    {[1, 2, 3].map((div) => (
                        <Link
                            key={div}
                            href={`/season-summary?season=${selectedSeason}&division=${div}&competition=${competition}`}
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
            )}

            {/* Cup Champion Banner */}
            {(isCup || isAll) && cupChampion && (
                <div style={{
                    background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
                    borderRadius: '16px',
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'white',
                    boxShadow: '0 8px 32px rgba(180,83,9,0.4)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                        Season {selectedSeason} Cup Champion
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{cupChampion.name}</div>
                    {cupRunnerUp && (
                        <div style={{ marginTop: '0.75rem', opacity: 0.8, fontSize: '0.9rem' }}>
                            🥈 Runner-up: <strong>{cupRunnerUp.name}</strong>
                            {cupFinal?.wentToPenalties && (
                                <span style={{ marginLeft: '8px', fontSize: '0.8rem', opacity: 0.75 }}>
                                    ({cupFinal.penaltyHome}–{cupFinal.penaltyAway} on pens)
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* League Awards */}
            {!isCup && league && (
            <Card>
                <CardHeader>
                    <CardTitle>🏅 Season Awards · {league.name}</CardTitle>
                </CardHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
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
            )}

            <SeasonSummaryClient
                competition={competition}
                topScorers={topScorers}
                topAssisters={topAssisters}
                topPassers={topPassers}
                topDribblers={topDribblers}
                topPlayersOfSeason={topPlayersOfSeason}
                topGoalkeepers={topGoalkeepers}
                highestTotalGoalsMatch={highestTotalGoalsMatch ? {
                    id: highestTotalGoalsMatch.id,
                    homeTeamId: highestTotalGoalsMatch.homeTeam.id,
                    homeTeamName: highestTotalGoalsMatch.homeTeam.name,
                    awayTeamId: highestTotalGoalsMatch.awayTeam.id,
                    awayTeamName: highestTotalGoalsMatch.awayTeam.name,
                    homeScore: highestTotalGoalsMatch.homeScore || 0,
                    awayScore: highestTotalGoalsMatch.awayScore || 0
                } : null}
                highestWinnerGoalsMatch={highestWinnerGoalsMatch ? {
                    id: highestWinnerGoalsMatch.id,
                    homeTeamId: highestWinnerGoalsMatch.homeTeam.id,
                    homeTeamName: highestWinnerGoalsMatch.homeTeam.name,
                    awayTeamId: highestWinnerGoalsMatch.awayTeam.id,
                    awayTeamName: highestWinnerGoalsMatch.awayTeam.name,
                    homeScore: highestWinnerGoalsMatch.homeScore || 0,
                    awayScore: highestWinnerGoalsMatch.awayScore || 0
                } : null}
                topTransferFees={topTransferFees}
            />

            {/* Cup Rewards */}
            {(isCup || isAll) && (
                <Card>
                    <CardHeader>
                        <CardTitle>🥇 Cup Rewards</CardTitle>
                    </CardHeader>
                    {cupRewards.length === 0 ? (
                        <div style={{ color: 'var(--muted)', padding: '1rem 0' }}>Cup rewards are not available yet for this season.</div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {cupRewards.map((r, idx) => (
                                <div key={`${r.teamId}-${idx}`} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    border: '1px solid var(--border)', borderRadius: '8px', padding: '0.7rem 0.9rem',
                                    background: r.stage === 'CHAMPION' ? 'rgba(245,158,11,0.08)' : 'transparent'
                                }}>
                                    <span>
                                        {r.stage === 'CHAMPION' && '🏆 '}
                                        {r.stage === 'RUNNER_UP' && '🥈 '}
                                        {r.stage === 'SEMI_FINALIST' && '🥉 '}
                                        <strong>{r.teamName}</strong>
                                        <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                                            {r.stage.replace(/_/g, ' ')}
                                        </span>
                                    </span>
                                    <b style={{ color: 'var(--success)' }}>+{formatCurrency(r.reward)}</b>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Overall Rewards (All mode) */}
            {isAll && combinedRewards.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>💰 Overall Rewards (League + Cup)</CardTitle>
                    </CardHeader>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {combinedRewards.map((r) => (
                            <div key={r.teamId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.8rem', alignItems: 'center' }}>
                                <b>{r.teamName}</b>
                                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>League: {formatCurrency(r.league)}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Cup: {formatCurrency(r.cup)}</span>
                                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(r.total)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Standings Table */}
            {!isCup && league && standings.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>📊 Final Standings & Rewards · {league.name}</CardTitle>
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
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Position</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Achievement</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Total</th>
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
                                                <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                                                    +{formatCurrency(reward.positionPrize + reward.tvShare + (reward.commercialBonus || 0) + (reward.championBonus || 0))}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem' }}>
                                            {reward?.achievementBonus ? (
                                                <span style={{ color: '#f59e0b', fontWeight: '600' }}>
                                                    +{formatCurrency(reward.achievementBonus)}
                                                </span>
                                            ) : <span style={{ color: 'var(--muted)' }}>-</span>}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.95rem' }}>
                                            {reward ? (
                                                <span style={{ color: reward.total > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '700' }}>
                                                    {formatCurrency(reward.total)}
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
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                                            <span style={{ color: 'var(--muted)' }}>Position:</span>
                                            <span style={{ color: 'var(--success)', fontWeight: '600' }}>+{formatCurrency(reward.positionPrize + reward.tvShare + (reward.commercialBonus || 0) + (reward.championBonus || 0))}</span>
                                        </div>
                                        {reward.achievementBonus ? (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                                                <span style={{ color: 'var(--muted)' }}>Achievement:</span>
                                                <span style={{ color: '#f59e0b', fontWeight: '600' }}>+{formatCurrency(reward.achievementBonus)}</span>
                                            </div>
                                        ) : null}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: '700' }}>
                                            <span>Total:</span>
                                            <span style={{ color: reward.total > 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(reward.total)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
            )}
        </div>
    );
}

function formatCurrency(num: number) {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
}
