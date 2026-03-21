import prisma from '@/lib/prisma';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { Card } from '@/components/ui/Card';
import { getLeagueByDivisionLevel } from '@/lib/services/divisionSystem';

export default async function LeaguePage({ searchParams }: { searchParams: Promise<{ season?: string; division?: string }> }) {
    const params = await searchParams;
    const settings = await prisma.globalGameSettings.findFirst();
    const currentSeason = settings?.currentSeason || 1;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const selectedDivision = params.division ? parseInt(params.division) : 1;

    let standingsData: any[] = [];
    let isHistorical = selectedSeason < currentSeason;
    let divisionName = 'Division 1';
    let leagueId: string | null = null;

    // Get league info for selected division
    const league = await getLeagueByDivisionLevel(selectedDivision, selectedSeason);
    if (league) {
        leagueId = league.id;
        divisionName = league.name;
    }

    if (isHistorical) {
        const history = await prisma.seasonHistory.findFirst({
            where: {
                season: selectedSeason,
                leagueId: leagueId || undefined
            }
        });
        if (history) {
            standingsData = JSON.parse(history.standings);
        }
    } else {
        // Calculate live standings - filtered by division
        const teams = await prisma.team.findMany({
            where: {
                leagueId: leagueId || undefined
            },
            include: {
                players: {
                    where: { isRetired: false }
                },
                homeMatches: {
                    where: { season: selectedSeason, isPlayed: true, competitionType: 'LEAGUE' }
                },
                awayMatches: {
                    where: { season: selectedSeason, isPlayed: true, competitionType: 'LEAGUE' }
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
            {/* Header with Division Selector */}
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-4xl font-bold" style={{ margin: 0 }}>
                        {divisionName} - {isHistorical ? `Season History ${selectedSeason}` : 'Current Standings'}
                    </h1>
                    <div className="flex gap-2">
                        {[1, 2, 3].map((div) => (
                            <Link
                                key={div}
                                href={`/league?season=${selectedSeason}&division=${div}`}
                                className={`px-3 py-1 rounded text-sm font-semibold transition ${
                                    selectedDivision === div
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-300 text-black hover:bg-gray-400'
                                }`}
                            >
                                Division {div}
                            </Link>
                        ))}
                    </div>
                </div>
                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <div className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                <span style={{ marginRight: '14px' }}>🏆/🥈/🥉 Top 3</span>
                <span>⬇️ Bottom 3 (Relegation Zone)</span>
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--sidebar-bg)', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>#</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Club</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>Played</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>Won</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>Drawn</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>Lost</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>For</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>Against</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px' }}>Difference</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '70px', fontWeight: 'bold' }}>Points</th>
                            <th style={{ padding: '15px', textAlign: 'center', width: '100px' }}>Manage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standingsData.map((team, index) => {
                            const relegationStart = Math.max(standingsData.length - 3, 0);
                            const isRelegation = index >= relegationStart;
                            const podiumIcon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                            return (
                            <tr key={team.id} style={{ 
                                borderBottom: '1px solid var(--border)', 
                                background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                ...(index === 0 ? { background: 'rgba(76, 175, 80, 0.08)' } : {}),
                                ...(isRelegation ? { background: 'rgba(244, 67, 54, 0.10)' } : {})
                            }}>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: index < 3 ? 'bold' : 'normal', color: index === 0 ? 'var(--success)' : 'inherit' }}>
                                    {index + 1}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {team.name}
                                        {podiumIcon && <span style={{ fontSize: '1.2rem' }}>{podiumIcon}</span>}
                                        {isRelegation && <span title="Relegation zone" style={{ fontSize: '1rem' }}>⬇️</span>}
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
                                        View Team
                                    </Link>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-3">
                {standingsData.map((team, index) => {
                    const relegationStart = Math.max(standingsData.length - 3, 0);
                    const isRelegation = index >= relegationStart;
                    const podiumIcon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                    return (
                    <Card
                        key={team.id}
                        style={{
                            padding: '14px',
                            borderLeft: index === 0
                                ? '5px solid var(--success)'
                                : index < 3
                                    ? '5px solid var(--primary)'
                                    : isRelegation
                                        ? '5px solid var(--danger)'
                                        : '1px solid var(--border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                                #{index + 1} {team.name}
                                {podiumIcon && <span style={{ marginLeft: '6px' }}>{podiumIcon}</span>}
                                {isRelegation && <span style={{ marginLeft: '6px' }} title="Relegation zone">⬇️</span>}
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                                ⚡ {team.power}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
                            <div>Played <strong style={{ color: 'var(--foreground)' }}>{team.played}</strong></div>
                            <div>Won <strong style={{ color: 'var(--success)' }}>{team.won}</strong></div>
                            <div>Drawn <strong style={{ color: 'var(--accent)' }}>{team.drawn}</strong></div>
                            <div>Lost <strong style={{ color: 'var(--danger)' }}>{team.lost}</strong></div>
                            <div>GF <strong style={{ color: 'var(--foreground)' }}>{team.gf}</strong></div>
                            <div>GA <strong style={{ color: 'var(--foreground)' }}>{team.ga}</strong></div>
                            <div>GD <strong style={{ color: 'var(--foreground)' }}>{team.gd > 0 ? `+${team.gd}` : team.gd}</strong></div>
                            <div>Pts <strong style={{ color: 'var(--foreground)', fontSize: '1rem' }}>{team.points}</strong></div>
                        </div>

                        <Link href={`/team/${team.id}`} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.9rem' }}>
                            View Team
                        </Link>
                    </Card>
                    );
                })}
            </div>
        </div>
    );
}
