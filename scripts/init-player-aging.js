const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting player aging initialization...');

    const players = await prisma.player.findMany();
    const gameSettings = await prisma.globalGameSettings.findFirst();
    const gameDate = gameSettings ? new Date(gameSettings.currentDate) : new Date('2026-01-01');

    for (const player of players) {
        // Random birthday: current date minus (age * 365 + random days within the year)
        const yearsAgo = player.age;
        const randomDaysInYear = Math.floor(Math.random() * 365);

        const birthDate = new Date(gameDate);
        birthDate.setFullYear(gameDate.getFullYear() - yearsAgo);
        birthDate.setDate(birthDate.getDate() - randomDaysInYear);

        // Random retirement age between 35 and 40
        const retirementAge = Math.floor(Math.random() * (40 - 35 + 1)) + 35;

        await prisma.player.update({
            where: { id: player.id },
            data: {
                birthDate,
                retirementAge
            }
        });
    }

    console.log(`Initialized ${players.length} players with birth dates and retirement ages.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
