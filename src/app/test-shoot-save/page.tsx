import { unstable_noStore as noStore } from 'next/cache';
import prisma from '@/lib/prisma';
import ShootSaveSimulateClient from './ShootSaveSimulateClient';

export default async function ShootSaveSimulatePage() {
    noStore();

    // Fetch all players, filter by position
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
                    id: true,
                    name: true,
                    mentality: true,
                },
            },
        },
        orderBy: [
            { naturalPosition: 'asc' },
            { name: 'asc' },
        ],
    });

    // Separate shooters and goalkeepers
    const shooters = players.filter(p => 
        p.naturalPosition && !p.naturalPosition.startsWith('GK')
    );
    const goalkeepers = players.filter(p => 
        p.naturalPosition && p.naturalPosition.startsWith('GK')
    );

    return (
        <ShootSaveSimulateClient
            shooters={shooters.map(p => ({
                ...p,
                teamId: p.teamId!,
                teamName: p.team?.name || '',
                mentality: p.team?.mentality || 'NORMAL',
            }))}
            goalkeepers={goalkeepers.map(p => ({
                ...p,
                teamId: p.teamId!,
                teamName: p.team?.name || '',
                mentality: p.team?.mentality || 'NORMAL',
            }))}
        />
    );
}
