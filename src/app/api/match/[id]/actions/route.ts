import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function getZone(ballPosition: number): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    if (ballPosition <= 30) return 'DEFENSIVE';
    if (ballPosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
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
        const playerId = searchParams.get('playerId');
        const snapshotMinuteParam = searchParams.get('snapshotMinute');
        const snapshotMinute = snapshotMinuteParam ? Number(snapshotMinuteParam) : null;

        const where: any = { matchId: id };
        if (playerId) where.playerId = playerId;
        if (typeof snapshotMinute === 'number' && Number.isFinite(snapshotMinute)) {
            where.snapshotMinute = snapshotMinute;
        }

        let logs: any[] = [];
        try {
            logs = await ((prisma as any).playerActionLog).findMany({
                where,
                orderBy: [{ snapshotMinute: 'asc' }, { minute: 'asc' }, { tick: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
                include: {
                    player: { select: { name: true, naturalPosition: true } }
                }
            });
        } catch {
            logs = await ((prisma as any).playerActionLog).findMany({
                where,
                orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
                include: {
                    player: { select: { name: true, naturalPosition: true } }
                }
            });
        }

        const teamZones: Record<string, { defensive: number; middle: number; attacking: number; total: number }> = {};
        const byPlayer: Record<string, any> = {};

        for (const log of logs) {
            const zone = getZone(log.ballPosition);
            if (!teamZones[log.teamId]) {
                teamZones[log.teamId] = { defensive: 0, middle: 0, attacking: 0, total: 0 };
            }
            if (!byPlayer[log.playerId]) {
                byPlayer[log.playerId] = {
                    playerId: log.playerId,
                    name: log.player?.name || 'Unknown',
                    position: log.player?.naturalPosition || '-',
                    zones: { defensive: 0, middle: 0, attacking: 0, total: 0 },
                    actions: {}
                };
            }

            const teamZone = teamZones[log.teamId];
            const playerZone = byPlayer[log.playerId].zones;

            if (zone === 'DEFENSIVE') {
                teamZone.defensive++;
                playerZone.defensive++;
            } else if (zone === 'MIDDLE') {
                teamZone.middle++;
                playerZone.middle++;
            } else {
                teamZone.attacking++;
                playerZone.attacking++;
            }
            teamZone.total++;
            playerZone.total++;

            if (!byPlayer[log.playerId].actions[log.actionType]) {
                byPlayer[log.playerId].actions[log.actionType] = {
                    attempts: 0,
                    success: 0,
                    fail: 0,
                    successRate: 0
                };
            }

            const action = byPlayer[log.playerId].actions[log.actionType];
            action.attempts++;
            if (isSuccess(log.result)) action.success++;
            else action.fail++;
        }

        Object.values(byPlayer).forEach((p: any) => {
            Object.values(p.actions).forEach((a: any) => {
                a.successRate = a.attempts > 0 ? Math.round((a.success / a.attempts) * 100) : 0;
            });
        });

        return NextResponse.json({
            matchId: id,
            playerId: playerId || null,
            totalLogs: logs.length,
            teamZones,
            byPlayer,
            rawLogs: logs
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch match actions', details: e.message }, { status: 500 });
    }
}
