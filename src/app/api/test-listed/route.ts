import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // Test: Get only listed players
        const listedPlayers = await prisma.player.findMany({
            where: { transferStatus: 'LISTED' },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            take: 20
        });

        return Response.json({
            success: true,
            count: listedPlayers.length,
            data: listedPlayers.map(p => ({
                id: p.id,
                name: p.name,
                transferStatus: p.transferStatus,
                askingPrice: p.askingPrice,
                teamName: p.team?.name || 'No team'
            }))
        });
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
