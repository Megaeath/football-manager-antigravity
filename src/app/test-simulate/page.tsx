import { unstable_noStore as noStore } from 'next/cache';
import prisma from '@/lib/prisma';
import TestSimulateClient from './TestSimulateClient';

export default async function TestSimulatePage() {
    noStore();

    // Fetch teams
    const teams = await prisma.team.findMany({
        select: {
            id: true,
            name: true,
        },
        orderBy: {
            name: 'asc',
        },
    });

    // Fetch all players with their team info
    const players = await prisma.player.findMany({
        select: {
            id: true,
            name: true,
            naturalPosition: true,
            passing: true,
            dribbling: true,
            shooting: true,
            vision: true,
            agility: true,
            composure: true,
            condition: true,
            exp: true,
            handling: true,
            tackling: true,
            heading: true,
            crossing: true,
            setPieces: true,
            throw: true,
            aggression: true,
            positioning: true,
            bravery: true,
            leadership: true,
            teamwork: true,
            pace: true,
            acceleration: true,
            stamina: true,
            strength: true,
            balance: true,
            teamId: true,
            team: {
                select: {
                    name: true,
                },
            },
        },
        orderBy: [
            { teamId: 'asc' },
            { name: 'asc' },
        ],
    });

    return (
        <TestSimulateClient
            teams={teams}
            players={players
                .filter(p => p.teamId !== null)
                .map(p => ({
                    ...p,
                    teamName: p.team?.name || '',
                    teamId: p.teamId!, // We filtered null above
                }))}
        />
    );
}
