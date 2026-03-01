import { NextResponse } from 'next/server';
import { submitBid } from '@/lib/engine/market';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { playerId, fromTeamId, amount, signOnBonus, isFreeAgent } = body;

        if (!playerId || !fromTeamId || typeof amount === 'undefined') {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const result = await submitBid(playerId, fromTeamId, amount, signOnBonus || 0, isFreeAgent || false);

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: result.message, bid: result.bid });
    } catch (error) {
        console.error('Error submitting bid:', error);
        return NextResponse.json({ error: 'Internal server error while processing bid' }, { status: 500 });
    }
}
