/**
 * Debug AI Market State
 * Run: node scripts/debug-ai-market.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== AI Market Diagnostic Report ===\n');

    // 1. Current game date
    const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    console.log(`Game Date: ${settings?.currentDate?.toISOString().split('T')[0]}`);
    console.log(`Season: ${settings?.currentSeason}`);
    console.log(`User Team: ${settings?.userTeamId}\n`);

    // 2. Listed players count
    const listedCount = await prisma.player.count({ where: { transferStatus: 'LISTED' } });
    const freeAgentCount = await prisma.player.count({ where: { teamId: null, isRetired: false } });
    console.log(`Listed Players: ${listedCount}`);
    console.log(`Free Agents: ${freeAgentCount}`);

    // 3. Listed players details
    if (listedCount > 0) {
        const listed = await prisma.player.findMany({
            where: { transferStatus: 'LISTED' },
            select: { name: true, age: true, askingPrice: true, naturalPosition: true, team: { select: { name: true } } },
            take: 10
        });
        console.log('\nListed Players (first 10):');
        listed.forEach(p => {
            console.log(`  ${p.name} (${p.naturalPosition}, Age ${p.age}) @ ${p.team?.name || 'FREE'} — $${(p.askingPrice || 0).toLocaleString()}`);
        });
    } else {
        console.log('\n⚠️  NO PLAYERS LISTED — Selling logic might not be triggering!');
    }

    // 4. Bids breakdown
    const bidStats = await prisma.bid.groupBy({
        by: ['status'],
        _count: { id: true }
    });
    console.log('\nBid Status Breakdown:');
    bidStats.forEach(b => console.log(`  ${b.status}: ${b._count.id}`));

    // 5. Recent completed transfers
    const completed = await prisma.bid.findMany({
        where: { status: 'COMPLETED' },
        include: {
            player: { select: { name: true } },
            fromTeam: { select: { name: true } },
            toTeam: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    if (completed.length > 0) {
        console.log('\nRecent COMPLETED Transfers:');
        completed.forEach(b => {
            console.log(`  ${b.player.name}: ${b.toTeam?.name || 'FREE'} → ${b.fromTeam.name} ($${b.amount.toLocaleString()})`);
        });
    } else {
        console.log('\n⚠️  NO COMPLETED TRANSFERS FOUND');
    }

    // 6. Recent pending bids
    const pending = await prisma.bid.findMany({
        where: { status: 'PENDING' },
        include: {
            player: { select: { name: true } },
            fromTeam: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    if (pending.length > 0) {
        console.log('\nRecent PENDING Bids (transfers in progress):');
        pending.forEach(b => {
            console.log(`  ${b.player.name} → ${b.fromTeam.name} — $${b.amount.toLocaleString()} (window ends: ${b.windowEnds?.toISOString().split('T')[0]})`);
        });
    } else {
        console.log('\n⚠️  NO PENDING BIDS — AI not submitting bids!');
    }

    // 7. lastAIMarketProcessedDate stats
    const processed = await prisma.team.findMany({
        select: { name: true, lastAIMarketProcessedDate: true, balance: true, id: true },
        orderBy: { lastAIMarketProcessedDate: 'desc' },
        take: 10
    });
    const neverProcessed = await prisma.team.count({ where: { lastAIMarketProcessedDate: null, id: { not: settings?.userTeamId || '' } } });
    console.log(`\nAI Market Processing:`);
    console.log(`  Never processed: ${neverProcessed} teams`);
    console.log('  Recently processed (top 10):');
    processed.forEach(t => {
        const dateStr = t.lastAIMarketProcessedDate ? t.lastAIMarketProcessedDate.toISOString().split('T')[0] : 'NEVER';
        const userNote = t.id === settings?.userTeamId ? ' (USER)' : '';
        console.log(`    ${t.name}${userNote}: ${dateStr} — Balance: $${t.balance.toLocaleString()}`);
    });

    // 8. Sample selling analysis (first non-user team)
    const sampleTeam = await prisma.team.findFirst({
        where: { id: { not: settings?.userTeamId || '' } },
        include: { players: { where: { isRetired: false } } }
    });
    if (sampleTeam) {
        console.log(`\nSample Selling Analysis — ${sampleTeam.name} (${sampleTeam.players.length} players):`);
        let wouldListCount = 0;
        for (const p of sampleTeam.players.slice(0, 20)) {
            // Simulate power check (simplified)
            const attrs = ['shooting','passing','heading','dribbling','crossing','tackling','pace','stamina','strength'];
            const avg = attrs.reduce((s,a)=> s + (p[a]||0), 0) / attrs.length;
            const power = (avg / 20) * 100;
            const reasons = [];
            if (power < 50) reasons.push('very_weak');
            if (p.age > 35) reasons.push('very_old');
            if (p.age > 30 && power < 72) reasons.push('old_weak');
            if (p.age > 33) reasons.push('old_33+');
            if (power < 55) reasons.push('power<55');
            if (reasons.length > 0) {
                wouldListCount++;
                console.log(`    WOULD LIST: ${p.name} (Age ${p.age}, Power ~${power.toFixed(0)}) — ${reasons.join(',')}`);
            }
        }
        if (wouldListCount === 0) {
            console.log(`    No players would be listed (all players are young/strong)`);
            console.log(`    Try: check player ages and powers in Prisma Studio`);
        }
    }

    console.log('\n=== End Diagnostic ===');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
