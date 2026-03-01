import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const tactics = await prisma.teamTactics.findUnique({
            where: { teamId: id }
        });

        if (!tactics) {
            const team = await prisma.team.findUnique({
                where: { id },
                select: { formation: true }
            });
            const defaultFormation = team?.formation || '4-4-2';

            // Create default tactics if not exists
            const newTactics = await prisma.teamTactics.create({
                data: {
                    teamId: id,
                    normalFormation: defaultFormation,
                    normalMentality: 'NORMAL',
                    normalPassing: 'MIXED',
                    normalTackling: 'NORMAL',
                    normalAttacking_focus: 'MIXED',
                    normalCreative_freedom: 'NORMAL',
                    behindFormation: defaultFormation,
                    behindMentality: 'ALL_OUT_ATTACK',
                    behindPassing: 'DIRECT',
                    behindTackling: 'HARD',
                    behindAttacking_focus: 'WINGS',
                    behindCreative_freedom: 'MAXIMUM',
                    leadingFormation: defaultFormation,
                    leadingMentality: 'ULTRA_DEFENSIVE',
                    leadingPassing: 'SHORT',
                    leadingTackling: 'HARD',
                    leadingAttacking_focus: 'CENTER',
                    leadingCreative_freedom: 'NORMAL'
                }
            });
            return NextResponse.json(newTactics);
        }

        return NextResponse.json(tactics);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch tactics' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const updated = await prisma.teamTactics.update({
            where: { teamId: id },
            data: body
        });

        return NextResponse.json(updated);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to update tactics' }, { status: 500 });
    }
}
