import prisma from '@/lib/prisma';
import SeasonSelector from '@/components/SeasonSelector';
import { getGameTime } from '@/lib/services/gameTime';
import RankingsClient from './RankingsClient';
import { calculateSuitability } from '@/lib/engine/suitability';

export default async function RankingsPage({
    searchParams
}: {
    searchParams: Promise<{ season?: string; tab?: string }>
}) {
    const params = await searchParams;
    const settings = await getGameTime();
    const currentSeason = settings.currentSeason;
    const selectedSeason = params.season ? parseInt(params.season) : currentSeason;
    const activeTab = params.tab || 'goals';

    // Aggregate stats for the season
    const rawStats: any[] = await prisma.$queryRaw`
        SELECT 
            p.id as playerId,
            p.name as playerName,
            t.name as teamName,
            p.naturalPosition as position,
            p.handling,
            p.tackling,
            p.passing,
            p.shooting,
            p.heading,
            p.dribbling,
            p.crossing,
            p.setPieces,
            p.aggression,
            p.positioning,
            p.vision,
            p.bravery,
            p.leadership,
            p.teamwork,
            p.composure,
            p.pace,
            p.acceleration,
            p.stamina,
            p.strength,
            p.agility,
            p.balance,
            SUM(pms.goals) as goals,
            SUM(pms.assists) as assists,
            SUM(pms.yellowCards) as yellowCards,
            SUM(pms.redCards) as redCards,
            SUM(pms.minutes) as minutes,
            SUM(pms.passesCompleted) as passesCompleted,
            SUM(pms.passesAttempted) as passesAttempted,
            SUM(pms.tacklesWon) as tacklesWon,
            SUM(pms.tacklesAttempted) as tacklesAttempted,
            SUM(pms.dribblesWon) as dribblesWon,
            SUM(pms.dribblesAttempted) as dribblesAttempted,
            SUM(pms.crossesCompleted) as crossesCompleted,
            SUM(pms.crossesAttempted) as crossesAttempted,
            AVG(pms.rating) as avgRating,
            p.motmCount as motmCount
        FROM PlayerMatchStats pms
        JOIN Match m ON pms.matchId = m.id
        JOIN Player p ON pms.playerId = p.id
        JOIN Team t ON p.teamId = t.id
        WHERE m.season = ${selectedSeason}
        GROUP BY p.id
        HAVING SUM(pms.minutes) > 0
    `;

    // Convert BigInts to Numbers and calculate power
    const stats = rawStats.map(s => {
        const attrs = {
            handling: Number(s.handling || 0),
            tackling: Number(s.tackling || 0),
            passing: Number(s.passing || 0),
            shooting: Number(s.shooting || 0),
            heading: Number(s.heading || 0),
            dribbling: Number(s.dribbling || 0),
            crossing: Number(s.crossing || 0),
            setPieces: Number(s.setPieces || 0),
            aggression: Number(s.aggression || 0),
            positioning: Number(s.positioning || 0),
            vision: Number(s.vision || 0),
            bravery: Number(s.bravery || 0),
            leadership: Number(s.leadership || 0),
            teamwork: Number(s.teamwork || 0),
            composure: Number(s.composure || 0),
            pace: Number(s.pace || 0),
            acceleration: Number(s.acceleration || 0),
            stamina: Number(s.stamina || 0),
            strength: Number(s.strength || 0),
            agility: Number(s.agility || 0),
            balance: Number(s.balance || 0)
        };
        const basePos = s.position.split('_')[0];
        const power = Math.round(calculateSuitability(attrs, basePos));

        return {
            ...s,
            goals: Number(s.goals || 0),
            assists: Number(s.assists || 0),
            yellowCards: Number(s.yellowCards || 0),
            redCards: Number(s.redCards || 0),
            minutes: Number(s.minutes || 0),
            passesCompleted: Number(s.passesCompleted || 0),
            passesAttempted: Number(s.passesAttempted || 0),
            tacklesWon: Number(s.tacklesWon || 0),
            tacklesAttempted: Number(s.tacklesAttempted || 0),
            dribblesWon: Number(s.dribblesWon || 0),
            dribblesAttempted: Number(s.dribblesAttempted || 0),
            crossesCompleted: Number(s.crossesCompleted || 0),
            crossesAttempted: Number(s.crossesAttempted || 0),
            avgRating: Number(s.avgRating || 0),
            motmCount: Number(s.motmCount || 0),
            passAccuracy: s.passesAttempted > 0 ? (Number(s.passesCompleted) / Number(s.passesAttempted) * 100) : 0,
            crossAccuracy: s.crossesAttempted > 0 ? (Number(s.crossesCompleted) / Number(s.crossesAttempted) * 100) : 0,
            power
        };
    });

    // Sort based on active tab
    const sortedStats = [...stats].sort((a, b) => {
        if (activeTab === 'goals') return b.goals - a.goals || b.avgRating - a.avgRating;
        if (activeTab === 'assists') return b.assists - a.assists || b.avgRating - a.avgRating;
        if (activeTab === 'cards') return (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2);
        if (activeTab === 'passing') return b.passAccuracy - a.passAccuracy;
        if (activeTab === 'crossing') return b.crossesCompleted - a.crossesCompleted || b.crossAccuracy - a.crossAccuracy;
        if (activeTab === 'dribbling') return b.dribblesWon - a.dribblesWon;
        if (activeTab === 'tackles') return b.tacklesWon - a.tacklesWon;
        if (activeTab === 'motm') return b.motmCount - a.motmCount || b.avgRating - a.avgRating;
        return b.avgRating - a.avgRating;
    });

    const tabs = [
        { id: 'goals', name: 'ดาวซัลโว', icon: '⚽' },
        { id: 'assists', name: 'จอมแอสซิสต์', icon: '👟' },
        { id: 'passing', name: 'ความแม่นยำ', icon: '🎯' },
        { id: 'crossing', name: 'จอมเปิดบอล', icon: '📐' },
        { id: 'dribbling', name: 'ยอดคลิกเลี้ยง', icon: '🏃' },
        { id: 'tackles', name: 'การสกัดกั้น', icon: '🛡️' },
        { id: 'motm', name: 'ยอดเยี่ยม', icon: '🌟' },
        { id: 'cards', name: 'ระเบียบวินัย', icon: '🟨' },
    ];

    return <RankingsClient stats={sortedStats} tabs={tabs} currentSeason={currentSeason} selectedSeason={selectedSeason} activeTab={activeTab} />;
}
