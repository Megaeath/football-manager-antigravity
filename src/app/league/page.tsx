import prisma from '@/lib/prisma';
import Link from 'next/link';
import SeasonSelector from '@/components/SeasonSelector';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';

export default async function LeaguePage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
    const params = await searchParams;
    const settings = await prisma.globalGameSettings.findFirst();
    const currentSeason = settings?.currentSeason || 1;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;

    // ... (rest of the logic)

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

    // Generate season options for the dropdown
    const seasons = Array.from({ length: currentSeason }, (_, i) => i + 1);

    return (
        <div style={{ padding: '20px' }} className="p-4 md:p-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }} className="mb-6 flex-col items-start gap-3 md:mb-8 md:flex-row md:items-center">
                <h1 style={{ fontWeight: 'bold' }} className="text-2xl md:text-4xl">
                    {isHistorical ? `ประวัติฤดูกาลที่ ${selectedSeason}` : 'ตารางคะแนนปัจจุบัน'}
                </h1>

                <SeasonSelector currentSeason={currentSeason} selectedSeason={selectedSeason} />
            </div>

            <div className="card hidden md:block" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--sidebar-bg)', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'center', width: '60px' }}>#</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>สโมสร</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>แข่ง</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>ชนะ</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>เสมอ</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>แพ้</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>ได้</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>เสีย</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>+/-</th>
                            <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>แต้ม</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standingsData.map((team, index) => (
                            <tr key={team.id} style={{ borderBottom: '1px solid var(--border)', background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: index < 3 ? 'bold' : 'normal', color: index === 0 ? 'var(--success)' : 'inherit' }}>
                                    {index + 1}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {team.name}
                                        <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold' }}>⚡{team.power}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.played}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.won}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.drawn}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.lost}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.gf}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{team.ga}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    {team.gd > 0 ? `+${team.gd}` : team.gd}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {team.points}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <Link href={`/team/${team.id}`} className="btn btn-sm" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                        ดูทีม
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
                {standingsData.map((team, index) => (
                    <div
                        key={team.id}
                        className="card"
                        style={{
                            padding: '12px',
                            borderLeft: index === 0
                                ? '4px solid var(--success)'
                                : index < 3
                                    ? '4px solid var(--primary)'
                                    : '1px solid var(--border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                                #{index + 1} {team.name}
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>⚡{team.power}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '10px', fontSize: '0.8rem' }}>
                            <div>แข่ง <strong>{team.played}</strong></div>
                            <div>ชนะ <strong>{team.won}</strong></div>
                            <div>เสมอ <strong>{team.drawn}</strong></div>
                            <div>แพ้ <strong>{team.lost}</strong></div>
                            <div>ได้ <strong>{team.gf}</strong></div>
                            <div>เสีย <strong>{team.ga}</strong></div>
                            <div>+/- <strong>{team.gd > 0 ? `+${team.gd}` : team.gd}</strong></div>
                            <div>แต้ม <strong>{team.points}</strong></div>
                        </div>

                        <Link href={`/team/${team.id}`} className="btn" style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.85rem' }}>
                            ดูทีม
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
