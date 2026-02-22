import { NextResponse } from 'next/server';
import { advanceDay, getGameTime } from '@/lib/services/gameTime';
import { processMatch } from '@/lib/services/matchSimulator';
import { autoSelectTactics } from '@/lib/services/tacticSelector';
import prisma from '@/lib/prisma';

async function autoSelectTacticsForAITeams(match: any, userTeamId: string) {
    const updates: any = {};

    // Auto-select for home team if it's AI
    if (match.homeTeamId !== userTeamId) {
        const homeTeam = await prisma.team.findUnique({
            where: { id: match.homeTeamId },
            include: { players: true }
        });
        if (homeTeam) {
            const autoTactics = autoSelectTactics(homeTeam.players);
            updates.homeTactics_formation = autoTactics.formation;
            updates.homeTactics_mentality = autoTactics.mentality;
            updates.homeTactics_passing = autoTactics.passing;
            updates.homeTactics_tackling = autoTactics.tackling;
            updates.homeTactics_attacking_focus = autoTactics.attacking_focus;
            updates.homeTactics_creative_freedom = autoTactics.creative_freedom;
        }
    }

    // Auto-select for away team if it's AI
    if (match.awayTeamId !== userTeamId) {
        const awayTeam = await prisma.team.findUnique({
            where: { id: match.awayTeamId },
            include: { players: true }
        });
        if (awayTeam) {
            const autoTactics = autoSelectTactics(awayTeam.players);
            updates.awayTactics_formation = autoTactics.formation;
            updates.awayTactics_mentality = autoTactics.mentality;
            updates.awayTactics_passing = autoTactics.passing;
            updates.awayTactics_tackling = autoTactics.tackling;
            updates.awayTactics_attacking_focus = autoTactics.attacking_focus;
            updates.awayTactics_creative_freedom = autoTactics.creative_freedom;
        }
    }

    if (Object.keys(updates).length > 0) {
        await prisma.match.update({
            where: { id: match.id },
            data: updates
        });
    }
}

export async function POST(req: Request) {
    try {
        const { action, matchId, homeTactics, awayTactics } = await req.json();
        const settings = await getGameTime();
        const userTeamId = settings.userTeamId || '';

        if (action === 'update_match_tactics') {
            // Save match-specific tactics before simulation (for user team)
            const updates: any = {};
            
            if (homeTactics) {
                if (homeTactics.formation) updates.homeTactics_formation = homeTactics.formation;
                if (homeTactics.mentality) updates.homeTactics_mentality = homeTactics.mentality;
                if (homeTactics.passing) updates.homeTactics_passing = homeTactics.passing;
                if (homeTactics.tackling) updates.homeTactics_tackling = homeTactics.tackling;
                if (homeTactics.attacking_focus) updates.homeTactics_attacking_focus = homeTactics.attacking_focus;
                if (homeTactics.creative_freedom) updates.homeTactics_creative_freedom = homeTactics.creative_freedom;
            }
            
            if (awayTactics) {
                if (awayTactics.formation) updates.awayTactics_formation = awayTactics.formation;
                if (awayTactics.mentality) updates.awayTactics_mentality = awayTactics.mentality;
                if (awayTactics.passing) updates.awayTactics_passing = awayTactics.passing;
                if (awayTactics.tackling) updates.awayTactics_tackling = awayTactics.tackling;
                if (awayTactics.attacking_focus) updates.awayTactics_attacking_focus = awayTactics.attacking_focus;
                if (awayTactics.creative_freedom) updates.awayTactics_creative_freedom = awayTactics.creative_freedom;
            }

            if (Object.keys(updates).length > 0) {
                await prisma.match.update({
                    where: { id: matchId },
                    data: updates
                });
            }

            // Now simulate the match with auto-selected tactics for AI teams
            const match = await prisma.match.findUnique({ where: { id: matchId } });
            if (match) {
                await autoSelectTacticsForAITeams(match, userTeamId);
            }

            const result = await processMatch(matchId);
            return NextResponse.json(result);
        }

        if (action === 'simulate_match') {
            // Auto-select tactics for AI teams before simulation
            const match = await prisma.match.findUnique({ where: { id: matchId } });
            if (match) {
                await autoSelectTacticsForAITeams(match, userTeamId);
            }

            const result = await processMatch(matchId);
            return NextResponse.json(result);
        }

        if (action === 'next_process') {
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
                    // Auto-select tactics for AI teams
                    await autoSelectTacticsForAITeams(match, userTeamId);
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
                // Auto-select tactics for AI teams
                await autoSelectTacticsForAITeams(match, userTeamId);
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
