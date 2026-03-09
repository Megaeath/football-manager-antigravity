import { PrismaClient } from '@prisma/client';
import TeamClient from './TeamClient';
import { getGameTime } from '@/lib/services/gameTime';

const prisma = new PrismaClient();

export const revalidate = 0; // Disable caching for this page

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const settings = await getGameTime();
    
    const team = await prisma.team.findUnique({
        where: { id: id },
        include: {
            players: {
                where: { isRetired: false },
                orderBy: { tacticalPosition: 'desc' }
            },
            homeMatches: { include: { awayTeam: true, homeTeam: true, playerStats: true } },
            awayMatches: { include: { homeTeam: true, awayTeam: true, playerStats: true } }
        }
    });

    if (!team) return <div className="card">ไม่พบข้อมูลทีม</div>;

    const transferHistory = await prisma.transferHistory.findMany({
        where: {
            OR: [
                { fromTeamId: id },
                { toTeamId: id }
            ]
        },
        include: {
            player: { select: { id: true, name: true, naturalPosition: true, age: true } },
            fromTeam: { select: { id: true, name: true } },
            toTeam: { select: { id: true, name: true } }
        },
        orderBy: { date: 'desc' }
    });

    // Get next upcoming match to show auto-selected tactics
    const nextMatch = await prisma.match.findFirst({
        where: {
            OR: [
                { homeTeamId: id },
                { awayTeamId: id }
            ],
            date: { gte: new Date(settings.currentDate) },
            isPlayed: false
        },
        include: {
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } }
        },
        orderBy: { date: 'asc' }
    });

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

    return <TeamClient 
        team={{ ...team, players: playersWithRating } as any} 
        matches={matches as any} 
        transferHistory={transferHistory as any}
        currentSeason={settings.currentSeason}
        nextMatch={nextMatch as any}
        userTeamId={settings.userTeamId || ''}
    />;
}
