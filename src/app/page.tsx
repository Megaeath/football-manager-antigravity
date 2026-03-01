import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';
import NextProcessButton from '@/components/NextProcessButton';

export default async function Home() {
    const gameInfo = await getGameTime();
    const gameDate = new Date(gameInfo.currentDate);

    const dateStr = gameDate.toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Get settings to find user team
    const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    const userTeamId = settings?.userTeamId;

    // Get user team info
    let userTeam = null;
    let upcomingMatch = null;
    let teamFinance = null;
    let leagueTable: any[] = [];
    let userTeamPosition = 0;

    if (userTeamId) {
        userTeam = await prisma.team.findUnique({
            where: { id: userTeamId },
            include: {
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

        // Get team finance
        teamFinance = await prisma.clubFinance.findFirst({
            where: { teamId: userTeamId }
        });

        // Get league table
        const allTeams = await prisma.team.findMany({
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                color: 'white',
                padding: '3rem',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
            }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: 0, fontWeight: '800' }}>⚽ FOOTBALL MANAGER</h1>
                    <p style={{ margin: '12px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>
                        {userTeam ? `อบรม ${userTeam.name} ไปสู่ความเป็นแชมป์` : 'เตรียมทีมของคุณสำหรับสิ่งที่จะมา'}
                    </p>
                </div>
                <div style={{
                    textAlign: 'right',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.3)'
                }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>วันที่ปัจจุบัน</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>{dateStr}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.8 }}>ฤดูกาล {settings?.currentSeason || 1}</div>
                    <div style={{ marginTop: '12px' }}>
                        <NextProcessButton />
                    </div>
                </div>
            </div>

            {/* User Team Overview */}
            {userTeam && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.1) 0%, rgba(13, 110, 253, 0.05) 100%)', borderLeft: '4px solid var(--primary)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>👕 ทีมของคุณ</h4>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{userTeam.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>อันดับที่: <strong>{userTeamPosition}</strong></div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{userTeam.players.length} นักเตะในทีม</div>
                        <Link href="/squad" style={{
                            display: 'inline-block',
                            marginTop: '1rem',
                            padding: '8px 16px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}>
                            จัดการทีม →
                        </Link>
                    </div>

                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)', borderLeft: '4px solid #4caf50' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#4caf50' }}>💰 สถานะการเงิน</h4>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#4caf50' }}>
                            ${(teamFinance?.balance || 0).toLocaleString()}
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>งบประมาณที่มี</div>
                        <Link href="/finances" style={{
                            display: 'inline-block',
                            marginTop: '1rem',
                            padding: '8px 16px',
                            background: '#4caf50',
                            color: 'white',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}>
                            ดูรายละเอียด →
                        </Link>
                    </div>

                    {upcomingMatch && (
                        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)', borderLeft: '4px solid #ff9800' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#ff9800' }}>🎯 แมตช์ถัดไป</h4>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                {upcomingMatch.homeTeamId === userTeamId ? upcomingMatch.awayTeam.name : upcomingMatch.homeTeam.name}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                {new Date(upcomingMatch.date).toLocaleDateString('th-TH')}
                            </div>
                            <Link href={`/match?matchId=${upcomingMatch.id}`} style={{
                                display: 'inline-block',
                                marginTop: '1rem',
                                padding: '8px 16px',
                                background: '#ff9800',
                                color: 'white',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '0.9rem'
                            }}>
                                ดูแมตช์ →
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                {/* League Table */}
                <div className="card">
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📊 ตารางคะแนนลีก
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>ลำดับ</th>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>ทีม</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>นัด</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>ชนะ</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>เสมอ</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>แพ้</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>G.D.</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>คะแนน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leagueTable.slice(0, 10).map((team, index) => (
                                    <tr key={team.id} style={{
                                        borderBottom: '1px solid var(--border)',
                                        background: team.isUserTeam ? 'rgba(13, 110, 253, 0.1)' : index < 3 ? 'rgba(76, 175, 80, 0.05)' : index > 6 ? 'rgba(220, 38, 38, 0.05)' : 'transparent'
                                    }}>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{index + 1}</td>
                                        <td style={{ padding: '8px' }}>
                                            {team.name}
                                            {team.isUserTeam && <span style={{ marginLeft: '8px', color: 'var(--primary)', fontWeight: 'bold' }}>👑</span>}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{team.played}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#4caf50', fontWeight: 'bold' }}>{team.wins}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#ff9800' }}>{team.draws}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#dc2626' }}>{team.losses}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{team.goalDiff > 0 ? '+' : ''}{team.goalDiff}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>{team.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Link href="/league" style={{
                        display: 'inline-block',
                        marginTop: '1rem',
                        padding: '8px 16px',
                        background: 'var(--primary)',
                        color: 'white',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '0.9rem'
                    }}>
                        ดูตารางเต็ม →
                    </Link>
                </div>

                {/* Top Scorers */}
                <div className="card">
                    <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>⚽ แข้งทองสูงสุด</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {topScorers.map((player, index) => (
                            <div key={player.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px',
                                background: 'var(--card-bg)',
                                borderRadius: '6px',
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
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontWeight: 'bold',
                                    fontSize: '0.95rem'
                                }}>
                                    {player.goals}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Latest News & Transfers Info */}
            <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📰 ข่าวล่าสุด</span>
                    <Link href="/news" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>ดูทั้งหมด →</Link>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {recentNews.length === 0 ? (
                        <div style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>ไม่มีข่าวใหม่</div>
                    ) : (
                        recentNews.map((news: any) => (
                            <div key={news.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', minWidth: '70px' }}>
                                    {new Date(news.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{news.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                                        {news.content.length > 150 ? news.content.substring(0, 150) + '...' : news.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Matches */}
            <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 แมตช์ที่ผ่านมา
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {recentMatches.map(match => {
                        const isUserMatch = userTeamId && (match.homeTeamId === userTeamId || match.awayTeamId === userTeamId);
                        const isHome = match.homeTeamId === userTeamId;
                        return (
                            <div key={match.id} style={{
                                padding: '1rem',
                                background: 'var(--border)',
                                borderRadius: '8px',
                                border: isUserMatch ? '2px solid var(--primary)' : '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                        {new Date(match.date).toLocaleDateString('th-TH')}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        color: (match.homeScore ?? 0) > (match.awayScore ?? 0) ? '#4caf50' : (match.homeScore ?? 0) < (match.awayScore ?? 0) ? '#dc2626' : '#ff9800',
                                        background: (match.homeScore ?? 0) > (match.awayScore ?? 0) ? 'rgba(76, 175, 80, 0.1)' : (match.homeScore ?? 0) < (match.awayScore ?? 0) ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        {(match.homeScore ?? 0) > (match.awayScore ?? 0) ? 'ชนะ' : (match.homeScore ?? 0) < (match.awayScore ?? 0) ? 'แพ้' : 'เสมอ'}
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
                                        minWidth: '50px',
                                        textAlign: 'center'
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
            </div>

            {/* Quick Links */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <Link href="/league" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                    <div style={{ fontWeight: 'bold' }}>ลีก</div>
                </Link>

                <Link href="/squad" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👕</div>
                    <div style={{ fontWeight: 'bold' }}>ทีม</div>
                </Link>

                <Link href="/market" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💱</div>
                    <div style={{ fontWeight: 'bold' }}>ตลาดนักเตะ</div>
                </Link>

                <Link href="/finances" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
                    <div style={{ fontWeight: 'bold' }}>การเงิน</div>
                </Link>

                <Link href="/fixtures" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                    <div style={{ fontWeight: 'bold' }}>ตารางแข่ง</div>
                </Link>

                <Link href="/players" className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ fontWeight: 'bold' }}>ค้นหานักเตะ</div>
                </Link>
            </div>

            {/* Footer */}
            <footer style={{
                marginTop: '2rem',
                padding: '2rem',
                borderTop: '1px solid var(--border)',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: '0.9rem'
            }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>⚽ FOOTBALL MANAGER (TEXT)</div>
                <div style={{ fontSize: '0.8rem' }}>v0.3.0 - Dashboard Manager System</div>
            </footer>
        </div>
    );
}
