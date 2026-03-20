import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import NextProcessButton from '@/components/NextProcessButton';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { formatDateLong, formatDateShort } from '@/lib/dateFormat';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { NAVIGATION, LEAGUE, SQUAD, FINANCES, MATCH, PLAYERS, HOME } from '@/lib/constants/uiLabels';

export default async function Home() {
    const gameInfo = await getGameTime();
    const gameDate = new Date(gameInfo.currentDate);

    // Use AD (Gregorian) format with English locale
    const dateStr = formatDateLong(gameDate);

    // Get settings to find user team
    const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    const userTeamId = settings?.userTeamId;

    // Get user team info
    let userTeam = null;
    let upcomingMatch = null;
    let teamFinance = null;
    let leagueTable: any[] = [];
    let userTeamPosition = 0;
    let teamPowerMap: Record<string, number> = {};

    if (userTeamId) {
        userTeam = await prisma.team.findUnique({
            where: { id: userTeamId },
            select: {
                id: true,
                name: true,
                leagueId: true,
                balance: true,
                players: { select: { id: true, name: true } }
            }
        });

        // Get upcoming match
        upcomingMatch = await prisma.match.findFirst({
            where: {
                season: settings?.currentSeason || 1,
                isPlayed: false,
                OR: [
                    { homeTeamId: userTeamId },
                    { awayTeamId: userTeamId }
                ]
            },
            include: {
                homeTeam: true,
                awayTeam: true
            },
            orderBy: { date: 'asc' }
        });

        // Get latest team finance snapshot (fallback only)
        teamFinance = await prisma.clubFinance.findFirst({
            where: { teamId: userTeamId },
            orderBy: { createdAt: 'desc' }
        });

        // Get league table
        const allTeams = await prisma.team.findMany({
            where: userTeam?.leagueId ? { leagueId: userTeam.leagueId } : undefined,
            include: {
                homeMatches: {
                    where: {
                        season: settings?.currentSeason || 1,
                        isPlayed: true
                    }
                },
                awayMatches: {
                    where: {
                        season: settings?.currentSeason || 1,
                        isPlayed: true
                    }
                }
            }
        });

        leagueTable = allTeams.map(team => {
            let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

            // Home matches
            team.homeMatches.forEach((match: any) => {
                goalsFor += match.homeScore;
                goalsAgainst += match.awayScore;
                if (match.homeScore > match.awayScore) wins++;
                else if (match.homeScore === match.awayScore) draws++;
                else losses++;
            });

            // Away matches
            team.awayMatches.forEach((match: any) => {
                goalsFor += match.awayScore;
                goalsAgainst += match.homeScore;
                if (match.awayScore > match.homeScore) wins++;
                else if (match.awayScore === match.homeScore) draws++;
                else losses++;
            });

            const points = wins * 3 + draws;
            const played = wins + draws + losses;
            const goalDiff = goalsFor - goalsAgainst;

            return {
                id: team.id,
                name: team.name,
                played,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDiff,
                points,
                isUserTeam: team.id === userTeamId
            };
        }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.goalDiff - a.goalDiff;
        });

        userTeamPosition = leagueTable.findIndex(t => t.isUserTeam) + 1;

        // Calculate team power map (same concept as /match page: average top 11 players)
        const teamIds = allTeams.map(t => t.id);
        const playersForPower = await prisma.player.findMany({
            where: { teamId: { in: teamIds } },
            select: {
                teamId: true,
                naturalPosition: true,
                condition: true,
                exp: true,
                handling: true,
                tackling: true,
                passing: true,
                shooting: true,
                heading: true,
                dribbling: true,
                crossing: true,
                setPieces: true,
                throw: true,
                aggression: true,
                positioning: true,
                vision: true,
                bravery: true,
                leadership: true,
                teamwork: true,
                composure: true,
                pace: true,
                acceleration: true,
                stamina: true,
                strength: true,
                agility: true,
                balance: true
            }
        });

        const powerBuckets: Record<string, number[]> = {};
        for (const p of playersForPower) {
            if (!p.teamId) continue;
            const attrs = toPlayerAttributes(p);
            const targetPosition = (p.naturalPosition || 'MC').split('_')[0];
            const power = calculatePlayerPower({
                attributes: attrs,
                targetPosition,
                condition: p.condition ?? 100,
                exp: p.exp ?? 0
            }).powerWithExp;

            if (!powerBuckets[p.teamId]) powerBuckets[p.teamId] = [];
            powerBuckets[p.teamId].push(power);
        }

        for (const id of teamIds) {
            const values = (powerBuckets[id] || []).sort((a, b) => b - a).slice(0, 11);
            teamPowerMap[id] = values.length > 0
                ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
                : 50;
        }
    }

    // Get recent matches
    const recentMatches = await prisma.match.findMany({
        where: {
            season: settings?.currentSeason || 1,
            isPlayed: true
        },
        include: {
            homeTeam: true,
            awayTeam: true
        },
        orderBy: { date: 'desc' },
        take: 5
    });

    // Get top scorers
    const topScorers = await prisma.player.findMany({
        where: userTeam?.leagueId
            ? {
                isRetired: false,
                team: { is: { leagueId: userTeam.leagueId } }
            }
            : { isRetired: false },
        include: { team: true },
        orderBy: { goals: 'desc' },
        take: 5
    });

    // Get latest news
    const recentNews = await prisma.news.findMany({
        where: userTeamId ? { OR: [{ teamId: null }, { teamId: userTeamId }] } : { teamId: null },
        orderBy: { date: 'desc' },
        take: 3
    });

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Hero Header */}
            <div className="hero-gradient flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-4xl font-extrabold" style={{ margin: 0 }}>⚽ FOOTBALL MANAGER</h1>
                    <p className="text-base md:text-lg" style={{ margin: '12px 0 0 0', opacity: 0.9 }}>
                        {userTeam ? `Lead ${userTeam.name} to Championship Glory` : 'Prepare Your Team for What\'s Coming'}
                    </p>
                </div>
                <div className="w-full md:w-auto text-right" style={{
                    background: 'rgba(255,255,255,0.15)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.3)'
                }}>
                    <div className="text-xs uppercase" style={{ opacity: 0.8, marginBottom: '4px' }}>{HOME.CURRENT_DATE}</div>
                    <div className="text-lg md:text-xl font-bold">{dateStr}</div>
                    <div className="text-xs mt-2" style={{ opacity: 0.8 }}>{HOME.SEASON} {settings?.currentSeason || 1}</div>
                    <div className="mt-3">
                        <NextProcessButton />
                    </div>
                </div>
            </div>

            {/* User Team Overview Cards */}
            {userTeam && (
                <div className="grid-auto-fit-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {/* Your Team Card */}
                    <div className="card card-gradient-primary">
                        <h4 className="text-lg font-semibold text-primary" style={{ margin: '0 0 1rem 0' }}>👕 {SQUAD.YOUR_TEAM}</h4>
                        <div className="text-3xl font-bold mb-2">{userTeam.name}</div>
                        <div className="text-sm text-muted mb-2">{LEAGUE.POSITION}: <strong>{userTeamPosition}</strong></div>
                        <div className="text-sm text-muted">{userTeam.players.length} {SQUAD.PLAYERS_IN_SQUAD}</div>
                        <Link href="/squad" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', display: 'inline-block' }}>
                            {SQUAD.MANAGE_SQUAD} →
                        </Link>
                    </div>

                    {/* Finances Card */}
                    <div className="card card-gradient-success">
                        <h4 className="text-lg font-semibold" style={{ margin: '0 0 1rem 0', color: 'var(--success)' }}>💰 {FINANCES.TITLE}</h4>
                        <div className="text-3xl font-bold mb-2" style={{ color: 'var(--success)' }}>
                            ${(userTeam?.balance ?? teamFinance?.balance ?? 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted">{FINANCES.AVAILABLE_BUDGET}</div>
                        <Link href="/finances" className="btn btn-sm" style={{ marginTop: '1rem', display: 'inline-block', background: 'var(--success)', color: 'white' }}>
                            {FINANCES.VIEW_DETAILS} →
                        </Link>
                    </div>

                    {/* Next Match Card */}
                    {upcomingMatch && (
                        <div className="card card-gradient-warning">
                            <h4 className="text-lg font-semibold" style={{ margin: '0 0 1rem 0', color: 'var(--accent)' }}>🎯 {MATCH.NEXT_MATCH}</h4>
                            <div className="flex flex-col gap-2 mb-2">
                                {(() => {
                                    const isHomeUser = upcomingMatch.homeTeamId === userTeamId;
                                    const opponentTeam = isHomeUser ? upcomingMatch.awayTeam : upcomingMatch.homeTeam;
                                    const opponentRank = leagueTable.findIndex(t => t.id === opponentTeam.id) + 1;
                                    const opponentPower = teamPowerMap[opponentTeam.id] ?? 50;

                                    return (
                                        <div className="text-base font-bold">
                                            {opponentTeam.name}
                                            <span className="text-xs text-muted ml-2">
                                                #{opponentRank || '-'} • {MATCH.POWER} {opponentPower}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="text-sm text-muted mb-2">
                                {formatDateShort(upcomingMatch.date)}
                            </div>
                            {(() => {
                                const matchDateNorm = new Date(upcomingMatch.date);
                                matchDateNorm.setUTCHours(0, 0, 0, 0);
                                const gameDateNorm = new Date(gameDate);
                                gameDateNorm.setUTCHours(0, 0, 0, 0);
                                const isMatchDay = gameDateNorm >= matchDateNorm;
                                return isMatchDay ? (
                                    <Link href={`/match?matchId=${upcomingMatch.id}`} className="btn btn-sm" style={{ marginTop: '1rem', display: 'inline-block', background: 'var(--accent)', color: 'white' }}>
                                        {MATCH.VIEW_MATCH} →
                                    </Link>
                                ) : (
                                    <span className="btn btn-sm" style={{ marginTop: '1rem', display: 'inline-block', background: 'var(--border)', color: 'var(--muted)', cursor: 'not-allowed', opacity: 0.6 }}>
                                        🔒 Available on {formatDateShort(upcomingMatch.date)}
                                    </span>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
                {/* League Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>📊 {LEAGUE.CURRENT_STANDINGS}</CardTitle>
                    </CardHeader>
                    
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th className="text-center" style={{ padding: '12px', width: '50px', fontWeight: 'bold' }}>{LEAGUE.POSITION}</th>
                                    <th style={{ padding: '12px', fontWeight: 'bold' }}>{LEAGUE.CLUB}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '50px' }}>{LEAGUE.PLAYED}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--success)', fontWeight: 'bold' }}>{LEAGUE.WON}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--accent)' }}>{LEAGUE.DRAWN}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--danger)' }}>{LEAGUE.LOST}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '70px' }}>{LEAGUE.GOAL_DIFFERENCE}</th>
                                    <th className="text-center" style={{ padding: '12px', width: '60px', fontWeight: 'bold', fontSize: '1rem' }}>{LEAGUE.POINTS}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leagueTable.slice(0, 10).map((team, index) => (
                                    <tr key={team.id} style={{
                                        borderBottom: '1px solid var(--border)',
                                        background: team.isUserTeam ? 'rgba(13, 110, 253, 0.1)' : 
                                                  index < 3 ? 'rgba(76, 175, 80, 0.05)' : 
                                                  index > leagueTable.length - 4 ? 'rgba(220, 38, 38, 0.05)' : 'transparent'
                                    }}>
                                        <td className="text-center" style={{ padding: '10px', fontWeight: index < 3 ? 'bold' : 'normal', color: index === 0 ? 'var(--success)' : 'inherit' }}>{index + 1}</td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {team.name}
                                                {team.isUserTeam && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>👑</span>}
                                            </div>
                                        </td>
                                        <td className="text-center" style={{ padding: '10px' }}>{team.played}</td>
                                        <td className="text-center" style={{ padding: '10px', color: 'var(--success)', fontWeight: 'bold' }}>{team.wins}</td>
                                        <td className="text-center" style={{ padding: '10px', color: 'var(--accent)' }}>{team.draws}</td>
                                        <td className="text-center" style={{ padding: '10px', color: 'var(--danger)' }}>{team.losses}</td>
                                        <td className="text-center" style={{ padding: '10px' }}>{team.goalDiff > 0 ? '+' : ''}{team.goalDiff}</td>
                                        <td className="text-center" style={{ padding: '10px', fontWeight: 'bold', fontSize: '1.05rem' }}>{team.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col gap-2">
                        {leagueTable.slice(0, 10).map((team, index) => (
                            <div
                                key={team.id}
                                className="card"
                                style={{
                                    padding: '12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    background: team.isUserTeam
                                        ? 'rgba(13, 110, 253, 0.1)'
                                        : index < 3
                                            ? 'rgba(76, 175, 80, 0.05)'
                                            : index > leagueTable.length - 4
                                                ? 'rgba(220, 38, 38, 0.05)'
                                                : 'transparent'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                        #{index + 1} {team.name}
                                        {team.isUserTeam && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}>👑</span>}
                                    </div>
                                    <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>{team.points} {LEAGUE.POINTS}</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                                    <div>{LEAGUE.PLAYED}: <strong style={{ color: 'var(--foreground)' }}>{team.played}</strong></div>
                                    <div>{LEAGUE.WON}: <strong style={{ color: 'var(--success)' }}>{team.wins}</strong></div>
                                    <div>{LEAGUE.DRAWN}: <strong style={{ color: 'var(--accent)' }}>{team.draws}</strong></div>
                                    <div>{LEAGUE.LOST}: <strong style={{ color: 'var(--danger)' }}>{team.losses}</strong></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Link href="/league" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', display: 'inline-block' }}>
                        {LEAGUE.VIEW_FULL_TABLE} →
                    </Link>
                </Card>

                {/* Top Scorers */}
                <Card>
                    <CardHeader>
                        <CardTitle level={3}>⚽ {PLAYERS.TOP_SCORERS}</CardTitle>
                    </CardHeader>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {topScorers.map((player, index) => (
                            <div key={player.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px',
                                background: 'var(--card-bg)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.9rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {index + 1}. {player.name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{player.team?.name || 'Unknown'}</div>
                                </div>
                                <div style={{
                                    background: '#fbbf24',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontWeight: 'bold',
                                    fontSize: '0.95rem'
                                }}>
                                    {player.goals}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Latest News */}
            <Card>
                <CardHeader>
                    <CardTitle>📰 {HOME.LATEST_NEWS}</CardTitle>
                    <Link href="/news" className="text-sm text-primary hover:underline">{HOME.VIEW_ALL} →</Link>
                </CardHeader>
                <div className="flex flex-col gap-4">
                    {recentNews.length === 0 ? (
                        <div className="p-lg text-center text-muted">{HOME.NO_NEWS}</div>
                    ) : (
                        recentNews.map((news: any) => (
                            <div key={news.id} className="flex gap-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                <div className="text-xs text-primary font-bold min-w-[70px]">
                                    {formatDateShort(news.date)}
                                </div>
                                <div>
                                    <div className="font-bold mb-1">{news.title}</div>
                                    <div className="text-sm text-muted" style={{ lineHeight: 1.4 }}>
                                        {news.content.length > 150 ? news.content.substring(0, 150) + '...' : news.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Recent Matches */}
            <Card>
                <CardHeader>
                    <CardTitle>📅 {MATCH.RECENT_MATCHES}</CardTitle>
                </CardHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {recentMatches.map(match => {
                        const isUserMatch = userTeamId && (match.homeTeamId === userTeamId || match.awayTeamId === userTeamId);
                        const isHome = match.homeTeamId === userTeamId;
                        const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);
                        const awayWon = (match.homeScore ?? 0) < (match.awayScore ?? 0);
                        const isDraw = (match.homeScore ?? 0) === (match.awayScore ?? 0);
                        
                        let resultText = isDraw ? MATCH.DRAW : (isHome ? (homeWon ? MATCH.WON : MATCH.LOST) : (awayWon ? MATCH.WON : MATCH.LOST));
                        let resultColor = isDraw ? '#ff9800' : (homeWon || awayWon) ? '#4caf50' : '#dc2626';
                        let resultBg = isDraw ? 'rgba(255, 152, 0, 0.1)' : (homeWon || awayWon) ? 'rgba(76, 175, 80, 0.1)' : 'rgba(220, 38, 38, 0.1)';

                        return (
                            <div key={match.id} style={{
                                padding: '1rem',
                                background: 'var(--border)',
                                borderRadius: '12px',
                                border: isUserMatch ? '2px solid var(--primary)' : '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                        {formatDateShort(match.date)}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        color: resultColor,
                                        background: resultBg,
                                        padding: '4px 10px',
                                        borderRadius: '6px'
                                    }}>
                                        {resultText}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                        <div style={{ fontWeight: isHome ? 'bold' : 'normal', fontSize: '0.95rem' }}>
                                            {match.homeTeam.name}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        minWidth: '60px',
                                        textAlign: 'center',
                                        background: 'var(--sidebar-bg)',
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '6px'
                                    }}>
                                        {match.homeScore ?? 0} - {match.awayScore ?? 0}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: !isHome ? 'bold' : 'normal', fontSize: '0.95rem' }}>
                                            {match.awayTeam.name}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <QuickLinkCard href="/league" icon="📊" label={NAVIGATION.LEAGUE} />
                <QuickLinkCard href="/squad" icon="👕" label={NAVIGATION.SQUAD} />
                <QuickLinkCard href="/market" icon="💱" label={NAVIGATION.MARKET} />
                <QuickLinkCard href="/finances" icon="💰" label={NAVIGATION.FINANCES} />
                <QuickLinkCard href="/fixtures" icon="📅" label={NAVIGATION.FIXTURES} />
                <QuickLinkCard href="/players" icon="🔍" label={NAVIGATION.PLAYERS} />
            </div>
        </div>
    );
}

// Quick Link Card Component
function QuickLinkCard({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <Link 
            href={href} 
            className="card flex flex-col items-center justify-center p-xl text-center"
            style={{ padding: '2rem', textDecoration: 'none', color: 'inherit' }}
        >
            <div className="text-4xl mb-2">{icon}</div>
            <div className="font-bold text-sm">{label}</div>
        </Link>
    );
}
