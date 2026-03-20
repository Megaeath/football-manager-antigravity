// Test processAIMarketForTeam for one team to see if it errors
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const settings = await p.globalGameSettings.findUnique({ where: { id: 1 } });
    console.log('User team:', settings.userTeamId);

    // Get first AI team
    const team = await p.team.findFirst({
        where: { id: { not: settings.userTeamId } },
        select: { id: true, name: true, leagueId: true }
    });
    console.log('Testing team:', team.name, 'leagueId:', team.leagueId);

    // Test calling processAIMarketForTeam
    try {
        // Dynamic import won't work with require, use ts-node approach
        // Instead test the critical path manually
        const { calculateSeasonStandings } = require('../src/lib/services/seasonAwards');
        const standings = await calculateSeasonStandings(team.leagueId, settings.currentSeason);
        console.log('Standings OK, teams:', standings.length, 'top5:', standings.slice(0,3).map(s => s.id?.slice(-6)));
    } catch (err) {
        console.error('ERROR in calculateSeasonStandings:', err.message);
    }

    await p.$disconnect();
})().catch(e => { console.error('FATAL:', e.message); p.$disconnect(); });
