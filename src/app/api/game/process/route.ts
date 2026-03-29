import { NextResponse } from 'next/server';
import { advanceDay, getGameTime } from '@/lib/services/gameTime';
import { processMatch, processMatchFinancials } from '@/lib/services/matchSimulator';
import { autoAssignTacticalPositions } from '@/lib/services/autoTacticalPositionSelector';
import { autoSelectTactics } from '@/lib/services/tacticSelector';
import { pickDeterministicAIPlaystyle, resolveAIPlaystyleForTeam, syncAIPlaystyleTeamBase } from '@/lib/services/aiPlaystyleService';
import { drawNextSwissRoundIfReady, ensureCupFixturesForDate } from '@/lib/services/SwissTournament';
import prisma from '@/lib/prisma';

async function ensureAITeamPlaystyles(userTeamId: string) {
    const aiTeams = await prisma.team.findMany({
        where: {
            id: { not: userTeamId || undefined },
            aiPlaystyleProfileId: null
        },
        select: { id: true }
    });

    if (aiTeams.length === 0) return;

    await prisma.$transaction(
        aiTeams.map((team) => {
            const style = pickDeterministicAIPlaystyle(team.id);
            return prisma.team.update({
                where: { id: team.id },
                data: { aiPlaystyleProfileId: style.id }
            });
        })
    );

    console.log(`[Process API] Assigned AI playstyle profile to ${aiTeams.length} teams`);
}

async function autoSelectTacticsForAITeams(match: any, userTeamId: string) {
    const updates: any = {};

    // Auto-select for home team if it's AI
    if (match.homeTeamId !== userTeamId) {
        await syncAIPlaystyleTeamBase(match.homeTeamId);
        await autoAssignTacticalPositions(match.homeTeamId);

        const homeTeam = await prisma.team.findUnique({
            where: { id: match.homeTeamId },
            include: { players: true }
        });
        if (homeTeam) {
            const style = resolveAIPlaystyleForTeam(homeTeam);
            const autoTactics = autoSelectTactics(homeTeam.players, style);
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
        await syncAIPlaystyleTeamBase(match.awayTeamId);
        await autoAssignTacticalPositions(match.awayTeamId);

        const awayTeam = await prisma.team.findUnique({
            where: { id: match.awayTeamId },
            include: { players: true }
        });
        if (awayTeam) {
            const style = resolveAIPlaystyleForTeam(awayTeam);
            const autoTactics = autoSelectTactics(awayTeam.players, style);
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

async function tryAdvanceCupRound(matchId: string) {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { cupTournamentId: true, competitionType: true }
    });

    if (!match || match.competitionType !== 'CUP' || !match.cupTournamentId) return;

    try {
        await drawNextSwissRoundIfReady(match.cupTournamentId);
    } catch (error) {
        console.error('[Process API] Cup progression check failed:', error);
    }
}

export async function POST(req: Request) {
    try {
        const { action, matchId, homeTactics, awayTactics } = await req.json();
        const settings = await getGameTime();
        const userTeamId = settings.userTeamId || '';

        // Initialize AI team assignments on first access (if missing)
        try {
            await ensureAITeamPlaystyles(userTeamId);

            const { autoAssignRolesForAllAITeams } = await import('@/lib/services/aiRoleSelector');
            const { autoAssignTacticalPositionsForAllAITeams } = await import('@/lib/services/autoTacticalPositionSelector');
            
            // Check if we need to initialize
            const aiTeams = await prisma.team.findMany({
                where: { id: { not: userTeamId || undefined } },
                select: { id: true }
            });

            if (aiTeams.length > 0) {
                // Check if any team is missing role assignments
                const teamWithoutRoles = await prisma.player.findFirst({
                    where: {
                        teamId: { in: aiTeams.map(t => t.id) },
                        playerRole: null,
                        isRetired: false
                    }
                });

                // Check if any AI player is missing split presets (new system)
                const teamWithoutSplitRoles = await prisma.player.findFirst({
                    where: {
                        teamId: { in: aiTeams.map(t => t.id) },
                        isRetired: false,
                        OR: [
                            { attackingRolePreset: null },
                            { defensiveRolePreset: null }
                        ]
                    }
                });

                if (teamWithoutRoles || teamWithoutSplitRoles) {
                    console.log('[Process API] Initializing AI team roles (including split presets)...');
                    await autoAssignRolesForAllAITeams(userTeamId || undefined);
                }

                // Check if any team is missing tactical position assignments
                const teamWithoutPositions = await prisma.player.findFirst({
                    where: {
                        teamId: { in: aiTeams.map(t => t.id) },
                        tacticalPosition: null,
                        isRetired: false
                    }
                });

                if (teamWithoutPositions) {
                    console.log('[Process API] Initializing AI team tactical positions...');
                    await autoAssignTacticalPositionsForAllAITeams(userTeamId || undefined);
                }
            }
        } catch (error) {
            console.error('[Process API] Failed to initialize AI teams:', error);
            // Don't fail the whole request, just log the error
        }

        if (action === 'update_match_tactics') {
            // Save match-specific tactics AND prep config before simulation (for user team)
            const updates: any = {};
            
            if (homeTactics) {
                if (homeTactics.mentality) updates.homeTactics_mentality = homeTactics.mentality;
                if (homeTactics.passing) updates.homeTactics_passing = homeTactics.passing;
                if (homeTactics.tackling) updates.homeTactics_tackling = homeTactics.tackling;
                if (homeTactics.attacking_focus) updates.homeTactics_attacking_focus = homeTactics.attacking_focus;
                if (homeTactics.creative_freedom) updates.homeTactics_creative_freedom = homeTactics.creative_freedom;
            }
            
            if (awayTactics) {
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

            // Process financial updates only when the match was newly simulated
            if (result) {
                try {
                    await processMatchFinancials(matchId);
                } catch (error) {
                    console.error('Failed to process match financials:', error);
                }
                await tryAdvanceCupRound(matchId);
            }
            
            return NextResponse.json(result);
        }

        if (action === 'simulate_match') {
            // Auto-select tactics for AI teams before simulation
            const match = await prisma.match.findUnique({ where: { id: matchId } });
            if (match) {
                await autoSelectTacticsForAITeams(match, userTeamId);
            }

            const result = await processMatch(matchId);

            // Process financial updates only when the match was newly simulated
            if (result) {
                try {
                    await processMatchFinancials(matchId);
                } catch (error) {
                    console.error('Failed to process match financials:', error);
                }
                await tryAdvanceCupRound(matchId);
            }
            
            return NextResponse.json(result);
        }

        if (action === 'next_process') {
            // Ensure cup fixtures are drawn when their scheduled date is reached.
            try {
                await ensureCupFixturesForDate(settings.currentSeason, new Date(settings.currentDate));
            } catch (error) {
                console.error('[Process API] Failed to ensure cup fixtures for date:', error);
            }

            // 1. Find all pending unplayed matches up to TODAY (UTC Range)
            // This prevents skipped fixtures if previous days still have unplayed matches.
            const currentDate = new Date(settings.currentDate);
            const utcYear = currentDate.getUTCFullYear();
            const utcMonth = currentDate.getUTCMonth();
            const utcDay = currentDate.getUTCDate();

            const todayRangeStart = new Date(Date.UTC(utcYear, utcMonth, utcDay));
            const todayRangeEnd = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));

            console.log('[Process API] Current date:', settings.currentDate);
            console.log('[Process API] Season:', settings.currentSeason);
            console.log('[Process API] Searching pending matches before:', todayRangeEnd.toISOString());

            const pendingMatches = await prisma.match.findMany({
                where: {
                    date: {
                        lt: todayRangeEnd
                    },
                    isPlayed: false
                },
                orderBy: { date: 'asc' }
            });

            const overdueCount = pendingMatches.filter(m => m.date < todayRangeStart).length;
            const todayCount = pendingMatches.length - overdueCount;
            console.log('[Process API] Found pending matches:', pendingMatches.length, `(overdue=${overdueCount}, today=${todayCount})`);

            // Split user-team matches into overdue vs today.
            // Important: overdue user matches must be auto-processed to avoid deadlock.
            const isUserMatch = (m: any) => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId;
            const userOverdueMatches = pendingMatches.filter((m) => isUserMatch(m) && m.date < todayRangeStart);
            const userTodayMatch = pendingMatches.find((m) => isUserMatch(m) && m.date >= todayRangeStart && m.date < todayRangeEnd);

            // Check if user has set lineup for their matches (any player with tacticalPosition)
            // If user hasn't set lineup, we should NOT auto-process even if overdue
            const getUserTeamIdForMatch = (m: any) => {
                if (m.homeTeamId === userTeamId) return m.homeTeamId;
                if (m.awayTeamId === userTeamId) return m.awayTeamId;
                return null;
            };

            const userTeamHasLineup = async (teamId: string): Promise<boolean> => {
                const playerWithPosition = await prisma.player.findFirst({
                    where: { teamId, tacticalPosition: { not: null }, isRetired: false }
                });
                return !!playerWithPosition;
            };

            // Process queue now:
            // - all AI-only matches
            // - user matches ONLY if user has set lineup (prevents auto-sim when user cleared positions)
            const matchesToAutoProcess = pendingMatches.filter((m) => {
                // Skip today's user match - let user play it manually
                if (userTodayMatch && m.id === userTodayMatch.id) return false;
                
                // For user matches, check if user has set lineup
                const userTeamIdForMatch = getUserTeamIdForMatch(m);
                if (userTeamIdForMatch) {
                    // We'll check lineup in the loop to avoid blocking filter
                    return true;
                }
                
                // AI-only match - always process
                return true;
            });

            let simulatedCount = 0;
            let skippedUserNoLineupCount = 0;
            
            for (const match of matchesToAutoProcess) {
                // For user matches: skip if user hasn't set lineup (cleared all positions)
                const userTeamIdForMatch = getUserTeamIdForMatch(match);
                if (userTeamIdForMatch) {
                    const hasLineup = await userTeamHasLineup(userTeamIdForMatch);
                    if (!hasLineup) {
                        console.log(`[Process API] Skipping match ${match.id} - user team ${userTeamIdForMatch} has no lineup set`);
                        skippedUserNoLineupCount++;
                        continue; // Skip this match - user needs to set lineup first
                    }
                }
                
                // Auto-select tactics for AI teams (safe for user-overdue auto processing too)
                await autoSelectTacticsForAITeams(match, userTeamId);
                const result = await processMatch(match.id);

                // Process financial updates only when the match was newly simulated
                if (result) {
                    simulatedCount++;
                    try {
                        await processMatchFinancials(match.id);
                    } catch (error) {
                        console.error('Failed to process match financials:', error);
                    }
                    await tryAdvanceCupRound(match.id);
                }
            }

            // If user has a match TODAY, stop here and let user play it manually.
            if (userTodayMatch) {
                return NextResponse.json({
                    success: true,
                    userMatchId: userTodayMatch.id,
                    simulatedCount,
                    overdueProcessedCount: overdueCount,
                    autoProcessedUserOverdueCount: userOverdueMatches.length,
                    skippedUserNoLineupCount,
                    requiresUserAction: true
                });
            }

            // Otherwise advance day as normal.
            const updatedSettings = await advanceDay();
            return NextResponse.json({
                success: true,
                currentDate: updatedSettings.currentDate,
                simulatedCount,
                overdueProcessedCount: overdueCount,
                autoProcessedUserOverdueCount: userOverdueMatches.length,
                skippedUserNoLineupCount,
                autoAdvanced: true
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Process failed' }, { status: 500 });
    }
}
