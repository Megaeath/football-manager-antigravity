const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
    console.log('Starting date normalization to UTC midnight...');

    const matches = await prisma.match.findMany({
        where: { isPlayed: false }
    });

    console.log(`Found ${matches.length} unplayed matches to normalize.`);

    for (const match of matches) {
        const oldDate = new Date(match.date);
        // Extract local parts but treat them as UTC to match the "intended" day
        const year = oldDate.getFullYear();
        const month = oldDate.getMonth();
        const date = oldDate.getDate();

        const newUtcDate = new Date(Date.UTC(year, month, date));

        if (oldDate.getTime() !== newUtcDate.getTime()) {
            await prisma.match.update({
                where: { id: match.id },
                data: { date: newUtcDate }
            });
            console.log(`Updated match ${match.id}: ${oldDate.toISOString()} -> ${newUtcDate.toISOString()}`);
        }
    }

    // Also fix Global Game Settings
    const settings = await prisma.globalGameSettings.findFirst();
    if (settings) {
        const oldDate = new Date(settings.currentDate);
        const newUtcDate = new Date(Date.UTC(oldDate.getFullYear(), oldDate.getMonth(), oldDate.getDate()));

        if (oldDate.getTime() !== newUtcDate.getTime()) {
            await prisma.globalGameSettings.update({
                where: { id: settings.id },
                data: { currentDate: newUtcDate }
            });
            console.log(`Updated Global Settings Date: ${oldDate.toISOString()} -> ${newUtcDate.toISOString()}`);
        }
    }

    console.log('Date normalization complete.');
}

fixDates()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
