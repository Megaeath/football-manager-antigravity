import prisma from '../src/lib/prisma';

async function main() {
    // Get the first few players who have match stats
    const players = await prisma.player.findMany({
        take: 3,
        where: {
            matchStats: {
                some: {}
            }
        },
        include: {
            team: true,
            matchStats: {
                include: {
                    match: true
                },
                orderBy: {
                    match: { date: 'asc' }
                }
            },
            transferHistory: true
        }
    });

    for (const player of players) {
        console.log(`Processing player: ${player.name} (${player.id})`);

        // Get all teams
        const allTeams = await prisma.team.findMany();
        if (allTeams.length < 2) {
            console.log('Not enough teams to create transfer history');
            continue;
        }

        // Get the player's match stats to determine which teams they played for and when
        const uniqueTeamsInMatches = new Set<string>();
        const teamsBySeason: Record<number, string[]> = {};

        player.matchStats.forEach(stat => {
            const season = stat.match.season;
            if (!teamsBySeason[season]) {
                teamsBySeason[season] = [];
            }
            if (!teamsBySeason[season].includes(stat.teamId)) {
                teamsBySeason[season].push(stat.teamId);
            }
            uniqueTeamsInMatches.add(stat.teamId);
        });

        // Skip if player only ever played for one team
        if (uniqueTeamsInMatches.size <= 1) {
            console.log(`${player.name} only played for 1 team, skipping...`);
            continue;
        }

        // Get sorted seasons
        const seasons = Object.keys(teamsBySeason).map(Number).sort((a, b) => a - b);

        // Add transfer history if not already present
        const existingTransfers = player.transferHistory.length;
        if (existingTransfers > 0) {
            console.log(`${player.name} already has ${existingTransfers} transfer records`);
            continue;
        }

        console.log(`Adding transfer history for ${player.name}: Seasons ${seasons.join(', ')}`);

        // Create transfer records for each season change
        let previousTeam: string | null = null;

        for (let i = 0; i < seasons.length; i++) {
            const season = seasons[i];
            const teamInSeason = teamsBySeason[season][0]; // Use first team in this season
            
            if (previousTeam && previousTeam !== teamInSeason) {
                // Player transferred between seasons
                const seasonStartDate = new Date(2026 + season, 0, 1); // Approximate season start
                
                await prisma.transferHistory.create({
                    data: {
                        playerId: player.id,
                        fromTeamId: previousTeam,
                        toTeamId: teamInSeason,
                        season: season,
                        date: seasonStartDate,
                        fee: Math.floor(Math.random() * 500000) + 50000 // Random fee between 50k and 550k
                    }
                });
                
                console.log(`  Transfer: Season ${season} from ${previousTeam} to ${teamInSeason}`);
            } else if (!previousTeam && i === 0) {
                // First season - create initial transfer record
                const firstSeasonDate = new Date(2026 + season, 0, 1);
                
                // Create a "from" team (randomly picked)
                const fromTeam = allTeams.find(t => t.id !== teamInSeason);
                
                await prisma.transferHistory.create({
                    data: {
                        playerId: player.id,
                        fromTeamId: fromTeam?.id || null,
                        toTeamId: teamInSeason,
                        season: season,
                        date: firstSeasonDate,
                        fee: fromTeam ? Math.floor(Math.random() * 500000) + 50000 : 0
                    }
                });
                
                console.log(`  Initial assignment: Season ${season} to ${teamInSeason}`);
            }

            previousTeam = teamInSeason;
        }

        console.log(`✓ Completed for ${player.name}\n`);
    }

    console.log('Done adding transfer history!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
