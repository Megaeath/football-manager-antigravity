import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLeagueByDivisionLevel } from '@/lib/services/divisionSystem';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date');
        const divisionStr = searchParams.get('division');
        const seasonStr = searchParams.get('season');
        const competition = (searchParams.get('competition') || 'league').toLowerCase();
        const division = divisionStr ? parseInt(divisionStr) : null;
        const season = seasonStr ? parseInt(seasonStr) : null;
        const league = division ? await getLeagueByDivisionLevel(division, season || undefined) : null;

        const query: any = {
            include: {
                homeTeam: { select: { id: true, name: true, leagueId: true } },
                awayTeam: { select: { id: true, name: true, leagueId: true } }
            },
            orderBy: { date: 'asc' }
        };

        const competitionWhere = competition === 'cup'
            ? { competitionType: 'CUP' }
            : competition === 'all'
                ? {}
                : { competitionType: 'LEAGUE' };

        // Build where clause
        const hasFilters = dateStr || league || season || competition !== 'all';
        if (hasFilters) {
            query.where = {
                ...competitionWhere,
                ...(season ? { season } : {}),
                ...(league ? { homeTeam: { is: { leagueId: league.id } } } : {}),
                ...(dateStr ? (() => {
                    const date = new Date(dateStr);
                    const utcYear = date.getUTCFullYear();
                    const utcMonth = date.getUTCMonth();
                    const utcDate = date.getUTCDate();
                    return {
                        date: {
                            gte: new Date(Date.UTC(utcYear, utcMonth, utcDate)),
                            lt: new Date(Date.UTC(utcYear, utcMonth, utcDate + 1))
                        }
                    };
                })() : {})
            };
        }

        const matches = await prisma.match.findMany(query);
        return NextResponse.json(matches);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
    }
}
