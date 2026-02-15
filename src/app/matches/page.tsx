import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function MatchesPage() {
    const matches = await prisma.match.findMany({
        include: {
            homeTeam: true,
            awayTeam: true
        },
        orderBy: { date: 'desc' }
    });

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
            <header style={{ marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <a href="/" style={{ textDecoration: 'none', color: '#666' }}>← Dashboard</a>
                <h1 style={{ margin: '0.5rem 0' }}>MATCH FIXTURES</h1>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matches.length === 0 && <p>No matches recorded.</p>}

                {matches.map(match => (
                    <div key={match.id} style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{match.homeTeam.name}</div>

                        <div style={{ margin: '0 2rem', background: '#333', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', minWidth: '80px', textAlign: 'center' }}>
                            {match.isPlayed ? `${match.homeScore} - ${match.awayScore}` : 'VS'}
                        </div>

                        <div style={{ flex: 1, textAlign: 'left', fontWeight: 'bold' }}>{match.awayTeam.name}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
