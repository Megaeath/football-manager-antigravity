import prisma from '@/lib/prisma';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { Card } from '@/components/ui/Card';
import { LEAGUE } from '@/lib/constants/uiLabels';

export default async function LeaguePage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
    const params = await searchParams;
    const settings = await prisma.globalGameSettings.findFirst();
    const currentSeason = settings?.currentSeason || 1;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;

    let standingsData: any[] = [];
    let isHistorical = selectedSeason < currentSeason;

    if (isHistorical) {
        const history = await prisma.seasonHistory.findFirst({
            where: {
                season: selectedSeason
            }
        });
        if (history) {
            standingsData = JSON.parse(history.standings);
        }
    } else {
        // Calculate live standings
        const teams = await prisma.team.findMany({
            include: {
                players: {
                    where: { isRetired: false }
                },
                homeMatches: {
                    where: { season: selectedSeason, isPlayed: true }
                },
                awayMatches: {
                    where: { season: selectedSeason, isPlayed: true }
                }
            }
        });

        standingsData = teams.map((team: any) => {
            let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;

            const processMatch = (homeScore: number, awayScore: number, isHome: boolean) => {
                played++;
                if (isHome) {
                    gf += homeScore; ga += awayScore;
                    if (homeScore > awayScore) { won++; points += 3; }
                    else if (homeScore === awayScore) { drawn++; points += 1; }
                    else lost++;
                } else {
                    gf += awayScore; ga += homeScore;
                    if (awayScore > homeScore) { won++; points += 3; }
                    else if (awayScore === homeScore) { drawn++; points += 1; }
                    else lost++;
                }
            };

            team.homeMatches.forEach((m: any) => {
                if (m.homeScore !== null && m.awayScore !== null) {
                    processMatch(m.homeScore, m.awayScore, true);
                }
            });

            team.awayMatches.forEach((m: any) => {
                if (m.homeScore !== null && m.awayScore !== null) {
                    processMatch(m.homeScore, m.awayScore, false);
                }
            });

            return {
                id: team.id,
                name: team.name,
                played, won, drawn, lost, gf, ga,
                gd: gf - ga,
                points,
                power: (() => {
                    // Calculate power for each player and sort to get best 11
                    const playerPowers = team.players.map((p: any) => {
                        const attrs = toPlayerAttributes({
                            handling: p.handling,
                            tackling: p.tackling,
                            passing: p.passing,
                            shooting: p.shooting,
                            heading: p.heading,
                            dribbling: p.dribbling,
                            crossing: p.crossing,
                            setPieces: p.setPieces,
                            throw: p.throw,
                            aggression: p.aggression,
                            positioning: p.positioning,
                            vision: p.vision,
                            bravery: p.bravery,
                            leadership: p.leadership,
                            teamwork: p.teamwork,
                            composure: p.composure,
                            pace: p.pace,
                            acceleration: p.acceleration,
                            stamina: p.stamina,
                            strength: p.strength,
                            agility: p.agility,
                            balance: p.balance
                        });

                        const basePos = (p.naturalPosition || 'GK').split('_')[0];
                        const power = calculatePlayerPower({
                            attributes: attrs,
                            targetPosition: basePos,
                            condition: p.condition,
                            exp: p.exp || 0
                        }).powerWithExp;
                        return power;
                    });

                    const bestPlayers = playerPowers.sort((a: number, b: number) => b - a).slice(0, 11);
                    if (bestPlayers.length === 0) return 0;
                    return Math.round(bestPlayers.reduce((sum: number, p: number) => sum + p, 0) / bestPlayers.length);
                })()
            };
        });

        standingsData.sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf));
    }

    return (
        <div className="p-4 md:p-5">
            {/* Header */}
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
                <h1 className="text-2xl md:text-4xl font-bold" style={{ margin: 0 }}>
                    {isHistorical ? `${LEAGUE.SEASON_HISTORY} ${selectedSeason}` : LEAGUE.CURRENT_STANDINGS}
                </h1>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--sidebar-bg)', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>#</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>{LEAGUE.CLUB}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>{LEAGUE.PLAYED}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>{LEAGUE.WON}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>{LEAGUE.DRAWN}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>{LEAGUE.LOST}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>{LEAGUE.GOALS_FOR}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>{LEAGUE.GOALS_AGAINST}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>{LEAGUE.GOAL_DIFFERENCE}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px', fontWeight: 'bold' }}>{LEAGUE.POINTS}</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '100px' }}>{LEAGUE.MANAGE}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standingsData.map((team, index) => (
                            <tr key={team.id} style={{ 
                                borderBottom: '1px solid var(--border)', 
                                background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                ...(index === 0 ? { background: 'rgba(76, 175, 80, 0.08)' } : {})
                            }}>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: index < 3 ? 'bold' : 'normal', color: index === 0 ? 'var(--success)' : 'inherit' }}>
                                    {index + 1}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {team.name}
                                        {index === 0 && <span style={{ fontSize: '1.2rem' }}>🏆</span>}
                                    </div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.played}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{team.won}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: 'var(--accent)' }}>{team.drawn}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: 'var(--danger)' }}>{team.lost}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.gf}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.ga}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    {team.gd > 0 ? `+${team.gd}` : team.gd}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {team.points}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <Link href={`/team/${team.id}`} className="btn btn-sm btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                                        {LEAGUE.VIEW_TEAM}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-3">
                {standingsData.map((team, index) => (
                    <Card
                        key={team.id}
                        style={{
                            padding: '14px',
                            borderLeft: index === 0
                                ? '5px solid var(--success)'
                                : index < 3
                                    ? '5px solid var(--primary)'
                                    : '1px solid var(--border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                                #{index + 1} {team.name}
                                {index === 0 && <span style={{ marginLeft: '6px' }}>🏆</span>}
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                                ⚡ {team.power}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
                            <div>{LEAGUE.PLAYED} <strong style={{ color: 'var(--foreground)' }}>{team.played}</strong></div>
                            <div>{LEAGUE.WON} <strong style={{ color: 'var(--success)' }}>{team.won}</strong></div>
                            <div>{LEAGUE.DRAWN} <strong style={{ color: 'var(--accent)' }}>{team.drawn}</strong></div>
                            <div>{LEAGUE.LOST} <strong style={{ color: 'var(--danger)' }}>{team.lost}</strong></div>
                            <div>GF <strong style={{ color: 'var(--foreground)' }}>{team.gf}</strong></div>
                            <div>GA <strong style={{ color: 'var(--foreground)' }}>{team.ga}</strong></div>
                            <div>GD <strong style={{ color: 'var(--foreground)' }}>{team.gd > 0 ? `+${team.gd}` : team.gd}</strong></div>
                            <div>{LEAGUE.POINTS} <strong style={{ color: 'var(--foreground)', fontSize: '1rem' }}>{team.points}</strong></div>
                        </div>

                        <Link href={`/team/${team.id}`} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.9rem' }}>
                            {LEAGUE.VIEW_TEAM}
                        </Link>
                    </Card>
                ))}
            </div>
        </div>
    );
}
