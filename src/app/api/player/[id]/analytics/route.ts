import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type ActionStat = {
    attempts: number;
    success: number;
    fail: number;
    successRate: number;
};

type ActionKey = 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT' | 'OTHER';

function initActionStat(): ActionStat {
    return { attempts: 0, success: 0, fail: 0, successRate: 0 };
}

function getZone(ballPosition: number): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    if (ballPosition <= 30) return 'DEFENSIVE';
    if (ballPosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
}

function normalizeAction(actionType: string): ActionKey {
    if (actionType === 'PASS_SHORT' || actionType === 'PASS_LONG' || actionType === 'DRIBBLE' || actionType === 'SHOOT') {
        return actionType;
    }
    return 'OTHER';
}

function isSuccess(result: string): boolean {
    return ['SUCCESS', 'GOAL'].includes(result);
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const seasonParam = searchParams.get('season');
        const matchId = searchParams.get('matchId');

        const where: any = { playerId: id };
        if (matchId) {
            where.matchId = matchId;
        } else if (seasonParam) {
            const season = parseInt(seasonParam, 10);
            where.match = { season };
        }

        const logs = await ((prisma as any).playerActionLog).findMany({
            where,
            orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
            include: {
                match: {
                    select: {
                        id: true,
                        season: true,
                        date: true
                    }
                }
            }
        });

        const seasonSummary = {
            zones: {
                defensive: 0,
                middle: 0,
                attacking: 0
            },
            actions: {
                PASS_SHORT: initActionStat(),
                PASS_LONG: initActionStat(),
                DRIBBLE: initActionStat(),
                SHOOT: initActionStat(),
                OTHER: initActionStat()
            }
        };

        const byMatch: Record<string, any> = {};

        for (const log of logs) {
            const zone = getZone(log.ballPosition);
            const action = normalizeAction(log.actionType);
            const success = isSuccess(log.result);

            if (!byMatch[log.matchId]) {
                byMatch[log.matchId] = {
                    matchId: log.matchId,
                    season: log.match?.season,
                    date: log.match?.date,
                    zones: {
                        defensive: 0,
                        middle: 0,
                        attacking: 0
                    },
                    actions: {
                        PASS_SHORT: initActionStat(),
                        PASS_LONG: initActionStat(),
                        DRIBBLE: initActionStat(),
                        SHOOT: initActionStat(),
                        OTHER: initActionStat()
                    }
                };
            }

            if (zone === 'DEFENSIVE') {
                seasonSummary.zones.defensive++;
                byMatch[log.matchId].zones.defensive++;
            } else if (zone === 'MIDDLE') {
                seasonSummary.zones.middle++;
                byMatch[log.matchId].zones.middle++;
            } else {
                seasonSummary.zones.attacking++;
                byMatch[log.matchId].zones.attacking++;
            }

            seasonSummary.actions[action].attempts++;
            byMatch[log.matchId].actions[action].attempts++;
            if (success) {
                seasonSummary.actions[action].success++;
                byMatch[log.matchId].actions[action].success++;
            } else {
                seasonSummary.actions[action].fail++;
                byMatch[log.matchId].actions[action].fail++;
            }
        }

        Object.values(seasonSummary.actions).forEach((a) => {
            a.successRate = a.attempts > 0 ? Math.round((a.success / a.attempts) * 100) : 0;
        });

        Object.values(byMatch).forEach((m: any) => {
            Object.values(m.actions).forEach((a: any) => {
                a.successRate = a.attempts > 0 ? Math.round((a.success / a.attempts) * 100) : 0;
            });
        });

        return NextResponse.json({
            playerId: id,
            matchId: matchId || null,
            season: seasonParam ? parseInt(seasonParam, 10) : null,
            logCount: logs.length,
            seasonSummary,
            byMatch,
            rawLogs: logs
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch analytics', details: e.message }, { status: 500 });
    }
}
