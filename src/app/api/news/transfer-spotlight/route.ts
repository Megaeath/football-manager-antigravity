import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGameTime } from '@/lib/services/gameTime';

/**
 * Top-10 popular players who currently have transfer market activity
 * (bid submitted or transfer completed in current season)
 */
export async function GET() {
    try {
        const settings = await getGameTime();
        const currentSeason = settings.currentSeason;

        const top10PopularPlayers = await prisma.player.findMany({
            orderBy: { popularity: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                popularity: true,
                team: { select: { id: true, name: true } }
            }
        });

        const topIds = top10PopularPlayers.map(p => p.id);
        if (topIds.length === 0) {
            return NextResponse.json({
                currentSeason,
                trackedPlayers: 0,
                hotPlayersCount: 0,
                hotPlayers: []
            });
        }

        const [bids, transfers] = await Promise.all([
            prisma.bid.findMany({
                where: {
                    playerId: { in: topIds },
                    season: currentSeason
                },
                select: {
                    playerId: true,
                    status: true,
                    createdAt: true
                }
            }),
            prisma.transferHistory.findMany({
                where: {
                    playerId: { in: topIds },
                    season: currentSeason
                },
                select: {
                    playerId: true,
                    date: true
                }
            })
        ]);

        const activityMap = new Map<string, {
            bidCount: number;
            activeBidCount: number;
            transferCount: number;
            lastActivityAt: Date | null;
        }>();

        for (const id of topIds) {
            activityMap.set(id, {
                bidCount: 0,
                activeBidCount: 0,
                transferCount: 0,
                lastActivityAt: null
            });
        }

        for (const bid of bids) {
            const entry = activityMap.get(bid.playerId);
            if (!entry) continue;
            entry.bidCount += 1;
            if (bid.status === 'PENDING' || bid.status === 'HIJACKED') {
                entry.activeBidCount += 1;
            }
            if (!entry.lastActivityAt || bid.createdAt > entry.lastActivityAt) {
                entry.lastActivityAt = bid.createdAt;
            }
        }

        for (const transfer of transfers) {
            const entry = activityMap.get(transfer.playerId);
            if (!entry) continue;
            entry.transferCount += 1;
            if (!entry.lastActivityAt || transfer.date > entry.lastActivityAt) {
                entry.lastActivityAt = transfer.date;
            }
        }

        const hotPlayers = top10PopularPlayers
            .map(player => {
                const activity = activityMap.get(player.id)!;
                const hasActivity = activity.bidCount > 0 || activity.transferCount > 0;
                return {
                    playerId: player.id,
                    name: player.name,
                    popularity: player.popularity,
                    team: player.team,
                    bidCount: activity.bidCount,
                    activeBidCount: activity.activeBidCount,
                    transferCount: activity.transferCount,
                    lastActivityAt: activity.lastActivityAt,
                    hasActivity
                };
            })
            .filter(p => p.hasActivity)
            .sort((a, b) => {
                if (b.activeBidCount !== a.activeBidCount) return b.activeBidCount - a.activeBidCount;
                if (b.transferCount !== a.transferCount) return b.transferCount - a.transferCount;
                return b.popularity - a.popularity;
            });

        return NextResponse.json({
            currentSeason,
            trackedPlayers: top10PopularPlayers.length,
            hotPlayersCount: hotPlayers.length,
            hotPlayers
        });
    } catch (error) {
        console.error('Failed to fetch transfer spotlight:', error);
        return NextResponse.json({ error: 'Failed to fetch transfer spotlight' }, { status: 500 });
    }
}
