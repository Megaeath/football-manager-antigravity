import { NextResponse } from 'next/server';
import { getGameTime } from '@/lib/services/gameTime';

export async function GET() {
    try {
        const settings = await getGameTime();
        return NextResponse.json(settings);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch game info' }, { status: 500 });
    }
}
