import { NextResponse } from 'next/server';
import { advanceDay, getGameTime } from '@/lib/services/gameTime';
import { processMatch } from '@/lib/services/matchSimulator';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { action, matchId } = await req.json();

        if (action === 'simulate_match') {
            const result = await processMatch(matchId);
            return NextResponse.json(result);
        }

        if (action === 'next_process') {
            const settings = await getGameTime();
            const userTeamId = settings.userTeamId;

            // 1. Find all unplayed matches for TODAY (UTC Range)
            const currentDate = new Date(settings.currentDate);
            const utcYear = currentDate.getUTCFullYear();
            const utcMonth = currentDate.getUTCMonth();
            const utcDay = currentDate.getUTCDate();

            const todayRangeStart = new Date(Date.UTC(utcYear, utcMonth, utcDay));
            const todayRangeEnd = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));

            const matchesToSimulate = await prisma.match.findMany({
                where: {
                    date: {
                        gte: todayRangeStart,
                        lt: todayRangeEnd
                    },
                    isPlayed: false
                }
            });

            // Check if user team is playing today
            const userMatch = matchesToSimulate.find(m =>
                m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
            );

            // 2. Automation Logic
            // If user team is NOT playing today, simulate all and advance immediately
            if (!userMatch) {
                for (const match of matchesToSimulate) {
                    await processMatch(match.id);
                }
                const updatedSettings = await advanceDay();
                return NextResponse.json({
                    success: true,
                    currentDate: updatedSettings.currentDate,
                    simulatedCount: matchesToSimulate.length,
                    autoAdvanced: true
                });
            }

            // If user team IS playing, simulate OTHER matches and stop
            // This is the manual flow where user plays their game first
            const otherMatches = matchesToSimulate.filter(m => m.id !== userMatch.id);
            for (const match of otherMatches) {
                await processMatch(match.id);
            }

            return NextResponse.json({
                success: true,
                userMatchId: userMatch.id,
                simulatedCount: otherMatches.length,
                requiresUserAction: true
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Process failed' }, { status: 500 });
    }
}
