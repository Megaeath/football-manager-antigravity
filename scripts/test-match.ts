
import { PrismaClient } from '@prisma/client';
import { simulateMatch } from '../src/lib/engine/match';
import { TeamState, PlayerState, Position } from '../src/lib/engine/types';

const prisma = new PrismaClient();

function mapPlayer(p: any): PlayerState {
    return {
        id: p.id,
        name: p.name,
        position: p.naturalPosition as Position,
        attributes: {
            handling: p.handling,
            tackling: p.tackling,
            passing: p.passing,
            shooting: p.shooting,
            heading: p.heading,
            dribbling: p.dribbling,
            setPieces: p.setPieces,
            aggression: p.aggression,
            positioning: p.positioning,
            vision: p.vision,
            bravery: p.bravery,
            leadership: p.leadership,
            teamwork: p.teamwork,
            composure: p.composure,
            pace: p.pace,
            acceleration: p.acceleration,
            stamina: p.stamina,
            strength: p.strength,
            agility: p.agility,
            balance: p.balance,
            crossing: p.crossing,
        },
        condition: p.condition,
        morale: p.morale,
        tacticalPosition: p.tacticalPosition,
        cards: { yellow: 0, red: 0 },
        stats: { goals: p.goals, assists: p.assists, tackles: 0, passes: 0 }
    };
}

async function runTest() {
    console.log('Fetching teams...');
    const teams = await prisma.team.findMany({ include: { players: true } });

    if (teams.length < 2) {
        console.error('Not enough teams found. Did you run prisma/seed.js?');
        return;
    }

    const home = teams[0];
    const away = teams[1]; // Or pick random

    console.log(`Starting Match: ${home.name} vs ${away.name}`);

    const homeState: TeamState = {
        id: home.id,
        name: home.name,
        tactics: { 
            formation: home.formation, 
            mentality: home.mentality, 
            passing: home.passing, 
            tackling: home.tackling,
            attacking_focus: home.attacking_focus,
            creative_freedom: home.creative_freedom
        },
        players: home.players.map(mapPlayer)
    };

    const awayState: TeamState = {
        id: away.id,
        name: away.name,
        tactics: { 
            formation: away.formation, 
            mentality: away.mentality, 
            passing: away.passing, 
            tackling: away.tackling,
            attacking_focus: away.attacking_focus,
            creative_freedom: away.creative_freedom
        },
        players: away.players.map(mapPlayer)
    };

    const result = simulateMatch(homeState, awayState);

    console.log(`\nMatch Finished!`);
    console.log(`Score: ${home.name} ${result.homeScore} - ${result.awayScore} ${away.name}`);

    console.log('\n--- Key Player Stats ---');
    Object.values(result.playerStats).forEach(stat => {
        if (stat.goals > 0 || stat.rating >= 7.0 || stat.saves > 3 || stat.redCards > 0) {
            console.log(`${stat.name} (${stat.position}): Rating ${stat.rating} | G:${stat.goals} A:${stat.assists} | Shots:${stat.shots}(${stat.shotsOnTarget}) | Pass:${stat.passesCompleted}/${stat.passesAttempted} | Tackle:${stat.tacklesWon}/${stat.tacklesAttempted} | Cards: Y${stat.yellowCards}/R${stat.redCards}`);
        }
    });

    console.log('\n--- Team Stats ---');
    console.log('Home Possession:', result.teamStats.home.possession + '%');
    console.log('Away Possession:', result.teamStats.away.possession + '%');

    console.log('\n--- Match Events ---');
    result.events.forEach(e => {
        console.log(`[${e.minute}'] ${e.text} (${e.type})`);
    });
}

runTest()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
