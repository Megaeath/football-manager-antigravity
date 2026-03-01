import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { simulateMatch } from '../../../lib/engine/match';
import { TeamState, PlayerState, Position } from '../../../lib/engine/types';

const prisma = new PrismaClient();

// Helper to convert DB Player to Engine PlayerState
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
            crossing: p.crossing || 10,
            setPieces: p.setPieces,
            throw: p.throw || 10,
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
        },
        condition: p.condition,
        morale: p.morale,
        exp: p.exp || 0,
        tacticalPosition: p.tacticalPosition, // Map new field
        cards: { yellow: 0, red: 0 },
        stats: { goals: p.goals, assists: p.assists, tackles: 0, passes: 0 }
    };
}

export async function GET() {
    try {
        const teamCount = await prisma.team.count();
        const skip = Math.floor(Math.random() * (teamCount - 1));

        // Fetch 2 teams
        const teams = await prisma.team.findMany({
            include: { players: true },
            take: 2,
            skip: skip
        });

        if (teams.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 teams to play' }, { status: 400 });
        }

        const homeTeamDB = teams[0];
        const awayTeamDB = teams[1];

        const homeTeam: TeamState = {
            id: homeTeamDB.id,
            name: homeTeamDB.name,
            tactics: {
                formation: homeTeamDB.formation,
                mentality: homeTeamDB.mentality,
                passing: homeTeamDB.passing,
                tackling: homeTeamDB.tackling,
                attacking_focus: homeTeamDB.attacking_focus,
                creative_freedom: homeTeamDB.creative_freedom
            },
            players: homeTeamDB.players.map(mapPlayer)
        };

        const awayTeam: TeamState = {
            id: awayTeamDB.id,
            name: awayTeamDB.name,
            tactics: {
                formation: awayTeamDB.formation,
                mentality: awayTeamDB.mentality,
                passing: awayTeamDB.passing,
                tackling: awayTeamDB.tackling,
                attacking_focus: awayTeamDB.attacking_focus,
                creative_freedom: awayTeamDB.creative_freedom
            },
            players: awayTeamDB.players.map(mapPlayer)
        };

        // 3. Run Simulation
        const result = simulateMatch(homeTeam, awayTeam);

        // 4. Save Match to DB
        await prisma.$transaction(async (tx) => {
            // Create Match with JSON stats
            const match = await tx.match.create({
                data: {
                    date: new Date(),
                    homeTeamId: homeTeam.id,
                    awayTeamId: awayTeam.id,
                    homeScore: result.homeScore,
                    awayScore: result.awayScore,
                    isPlayed: true,
                    stats: JSON.stringify(result.teamStats)
                }
            });

            // Create Events
            if (result.events.length > 0) {
                await tx.matchEvent.createMany({
                    data: result.events.map(e => ({
                        matchId: match.id,
                        minute: e.minute,
                        text: e.text,
                        type: e.type,
                        teamId: e.teamId,
                        playerId: e.playerId
                    }))
                });
            }

            // Create Player Stats
            const statsToCreate = Object.values(result.playerStats).map(stat => ({
                matchId: match.id,
                playerId: stat.playerId,
                teamId: stat.teamId,
                rating: stat.rating,
                minutes: stat.minutes,
                goals: stat.goals,
                assists: stat.assists,
                passesAttempted: stat.passesAttempted,
                passesCompleted: stat.passesCompleted,
                shots: stat.shots,
                shotsOnTarget: stat.shotsOnTarget,
                tacklesAttempted: stat.tacklesAttempted,
                tacklesWon: stat.tacklesWon,
                dribblesAttempted: stat.dribblesAttempted,
                dribblesWon: stat.dribblesWon,
                saves: stat.saves,
                fitnessEnd: stat.fitnessEnd
            }));

            if (statsToCreate.length > 0) {
                await tx.playerMatchStats.createMany({
                    data: statsToCreate
                });
            }

            // Update Player Season Stats (Cards)
            for (const stat of Object.values(result.playerStats)) {
                await tx.player.update({
                    where: { id: stat.playerId },
                    data: {
                        goals: { increment: stat.goals },
                        assists: { increment: stat.assists },
                        apps: { increment: stat.minutes > 0 ? 1 : 0 },
                        yellowCards: { increment: stat.yellowCards },
                        redCards: { increment: stat.redCards },
                        condition: stat.fitnessEnd
                    }
                });
            }
        });

        return NextResponse.json(result);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
    }
}
