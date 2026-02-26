import prisma from '@/lib/prisma';
import { calculateSuitability } from '../../lib/engine/suitability';
import { PlayerAttributes } from '../../lib/engine/types';
import SquadClient from './SquadClient';
import { Suspense } from 'react';
import { getGameTime } from '@/lib/services/gameTime';

async function getUserTeam() {
    const settings = await prisma.globalGameSettings.findUnique({
        where: { id: 1 }
    });

    if (settings?.userTeamId) {
        return prisma.team.findUnique({
            where: { id: settings.userTeamId },
            include: {
                players: {
                    where: { isRetired: false },
                    include: {
                        matchStats: {
                            where: { match: { isPlayed: true } },
                            select: { rating: true }
                        }
                    }
                },
                homeMatches: { include: { awayTeam: true, homeTeam: true } },
                awayMatches: { include: { homeTeam: true, awayTeam: true } }
            }
        });
    }

    return prisma.team.findFirst({
        include: {
            players: {
                where: { isRetired: false },
                include: {
                    matchStats: {
                        where: { match: { isPlayed: true } },
                        select: { rating: true }
                    }
                }
            },
            homeMatches: { include: { awayTeam: true, homeTeam: true } },
            awayMatches: { include: { homeTeam: true, awayTeam: true } }
        }
    });
}

export default async function SquadPage() {
    const team = await getUserTeam();
    const settings = await getGameTime();

    if (!team) return <div>Team not found. Please seed the database.</div>;

    const playerswithSuitability = team.players.map(p => {
        // Map DB attributes to Engine attributes
        const attrs: PlayerAttributes = {
            handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
            heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces, throw: p.throw,
            aggression: p.aggression, positioning: p.positioning, vision: p.vision,
            bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
            pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
            agility: p.agility, balance: p.balance, crossing: p.crossing
        };

        const currentPosId = p.tacticalPosition ? p.tacticalPosition.split('_')[0] : null;
        const baseSuitability = currentPosId ? calculateSuitability(attrs, currentPosId) : 0;
        const fitnessFactor = Math.pow(Math.max(0, Math.min(1, p.condition / 100)), 1.2);
        const fitnessSuitability = Math.round(baseSuitability * fitnessFactor);

        // Calculate market value (same formula as API)
        const natPos = p.naturalPosition.split('_')[0];
        const power = Math.round(calculateSuitability(attrs, natPos));
        
        // Calculate average rating from match stats (same as API)
        const avgRating = p.matchStats && p.matchStats.length > 0
            ? Number((p.matchStats.reduce((sum, stat) => sum + stat.rating, 0) / p.matchStats.length).toFixed(2))
            : 0;
        
        const basePrice = power * power * 1000;
        const ageMultiplier = p.age <= 25 ? 1.2 : p.age >= 32 ? 0.6 : 1.0;
        
        const playerPopularityMultiplier = 0.8 + (p.popularity / 100) * 1.0;
        const clubReputationMultiplier = 0.7 + ((team.reputation || 50) / 100) * 0.8;
        
        // Use avgRating from match stats (same as API)
        const formMultiplier = 0.5 + (Math.min(avgRating, 10) / 10) * 1.0;
        
        let marketValue = Math.round(basePrice * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
        marketValue = Math.min(marketValue, 200000000);

        return {
            id: p.id,
            name: p.name,
            naturalPosition: p.naturalPosition,
            age: p.age,
            condition: p.condition,
            morale: p.morale,
            tacticalPosition: p.tacticalPosition,
            suitability: baseSuitability,
            fitnessSuitability,
            rawAttributes: attrs,
            goals: p.goals,
            assists: p.assists,
            apps: p.apps,
            avgRating: p.avgRating,
            birthDate: p.birthDate,
            retirementAge: p.retirementAge,
            popularity: p.popularity,
            clubReputation: team.reputation,
            marketValue
        };
    });

    // Sort by Name for default (SquadClient will re-sort)
    playerswithSuitability.sort((a, b) => a.name.localeCompare(b.name));

    const currentTactics = {
        formation: team.formation,
        mentality: team.mentality,
        passing: team.passing,
        tackling: team.tackling,
        attacking_focus: team.attacking_focus,
        creative_freedom: team.creative_freedom
    };

    // Combine and sort matches
    const matches = [
        ...team.homeMatches.map(m => ({ ...m, role: 'home' as const, opponent: m.awayTeam })),
        ...team.awayMatches.map(m => ({ ...m, role: 'away' as const, opponent: m.homeTeam }))
    ];
    matches.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Get next upcoming match (unplayed match)
    const upcomingMatch = await prisma.match.findFirst({
        where: {
            OR: [
                { homeTeamId: team.id },
                { awayTeamId: team.id }
            ],
            isPlayed: false,
            date: { gte: new Date(settings.currentDate) }
        },
        include: {
            homeTeam: true,
            awayTeam: true
        },
        orderBy: { date: 'asc' }
    });

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', margin: 0 }}>จัดการทีม (Squad Management)</h2>
                <p style={{ color: 'var(--muted)' }}>
                    ทีมปัจจุบัน: <strong>{team.name}</strong> • วางแผนการเล่นและกำหนดกลยุทธ์
                </p>
            </div>

            <Suspense fallback={<div>Loading squad...</div>}>
                <SquadClient 
                    teamId={team.id} 
                    players={playerswithSuitability} 
                    currentTactics={currentTactics} 
                    matches={matches as any} 
                    currentSeason={settings.currentSeason}
                    upcomingMatch={upcomingMatch as any}
                />
            </Suspense>
        </div>
    );
}
