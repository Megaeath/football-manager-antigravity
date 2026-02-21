import { PrismaClient } from '@prisma/client';
import TeamClient from './TeamClient';

const prisma = new PrismaClient();

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = await prisma.team.findUnique({
        where: { id: id },
        include: {
            players: {
                where: { isRetired: false },
                orderBy: { tacticalPosition: 'desc' }
            },
            homeMatches: { include: { awayTeam: true, homeTeam: true } },
            awayMatches: { include: { homeTeam: true, awayTeam: true } }
        }
    });

    if (!team) return <div className="card">ไม่พบข้อมูลทีม</div>;

    // Sort players by position: GK -> DF -> MF -> FW
    const positionOrder: Record<string, number> = {
        'GK': 1,
        'DR': 2, 'DC': 2, 'DL': 2,
        'DMR': 3, 'DMC': 3, 'DML': 3,
        'MR': 4, 'MC': 4, 'ML': 4,
        'AMR': 5, 'AMC': 5, 'AML': 5,
        'FWR': 6, 'FWC': 6, 'FWL': 6
    };

    const sortedPlayers = [...team.players].sort((a, b) => {
        const orderA = positionOrder[a.tacticalPosition || a.naturalPosition] || 99;
        const orderB = positionOrder[b.tacticalPosition || b.naturalPosition] || 99;
        return orderA - orderB;
    });

    const ratingRows = await prisma.playerMatchStats.groupBy({
        by: ['playerId'],
        where: {
            playerId: { in: team.players.map(p => p.id) },
            match: { isPlayed: true }
        },
        _avg: { rating: true }
    });

    const ratingMap = new Map(
        ratingRows.map(r => [r.playerId, r._avg.rating ? Number(r._avg.rating) : 0])
    );

    const playersWithRating = sortedPlayers.map(p => ({
        ...p,
        avgRating: p.avgRating > 0 ? p.avgRating : (ratingMap.get(p.id) || 0)
    }));

    // Combine matches and normalize
    const matches = [
        ...team.homeMatches.map(m => ({ ...m, role: 'home' as const, opponent: m.awayTeam })),
        ...team.awayMatches.map(m => ({ ...m, role: 'away' as const, opponent: m.homeTeam }))
    ];

    // Sort by date
    matches.sort((a, b) => b.date.getTime() - a.date.getTime());

    return <TeamClient team={{ ...team, players: playersWithRating } as any} matches={matches as any} />;
}
