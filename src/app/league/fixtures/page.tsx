import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import TeamSelector from './TeamSelector';

const prisma = new PrismaClient();

export default async function LeagueFixturesPage({
    searchParams
}: {
    searchParams: Promise<{ teamId?: string }>
}) {
    const { teamId } = await searchParams;

    const teams = await prisma.team.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    });

    const matches = await prisma.match.findMany({
        where: teamId ? {
            OR: [
                { homeTeamId: teamId },
                { awayTeamId: teamId }
            ]
        } : {},
        include: {
            homeTeam: true,
            awayTeam: true
        },
        orderBy: { date: 'desc' }
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>📅 ผลการแข่งขัน (Fixtures & Results)</h2>

                <TeamSelector teams={teams} currentTeamId={teamId} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matches.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', background: '#f9f9f9', borderRadius: '8px', color: '#999' }}>
                        ไม่พบข้อมูลการแข่งขัน
                    </div>
                )}

                {matches.map(match => (
                    <div key={match.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#fff',
                        padding: '1rem',
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            <Link href={`/team/${match.homeTeamId}`} style={{ color: '#333', textDecoration: 'none' }}>
                                {match.homeTeam.name}
                            </Link>
                        </div>

                        <div style={{
                            margin: '0 1.5rem',
                            background: '#333',
                            color: '#fff',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '4px',
                            minWidth: '100px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                        }}>
                            {match.isPlayed ? `${match.homeScore} - ${match.awayScore}` : 'VS'}
                        </div>

                        <div style={{ flex: 1, textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            <Link href={`/team/${match.awayTeamId}`} style={{ color: '#333', textDecoration: 'none' }}>
                                {match.awayTeam.name}
                            </Link>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#888', marginLeft: '1rem', borderLeft: '1px solid #eee', paddingLeft: '1rem' }}>
                            {new Date(match.date).toLocaleDateString('th-TH')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
