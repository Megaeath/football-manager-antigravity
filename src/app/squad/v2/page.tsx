import prisma from '@/lib/prisma';
import { PlayerAttributes } from '@/lib/engine/types';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { applyMarketValuePowerBands } from '@/lib/engine/financial';
import SquadClientV2 from './SquadClientV2';
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
                tactics: true,
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
            tactics: true,
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

export default async function SquadPageV2() {
    const team = await getUserTeam();
    const settings = await getGameTime();
    const isUserTeam = !settings.userTeamId || settings.userTeamId === team?.id;

    if (!team) return <div>Team not found. Please seed the database.</div>;
    const transferHistory = await prisma.transferHistory.findMany({
        where: {
            OR: [
                { fromTeamId: team.id },
                { toTeamId: team.id }
            ]
        },
        include: {
            player: { select: { id: true, name: true, naturalPosition: true, age: true } },
            fromTeam: { select: { id: true, name: true } },
            toTeam: { select: { id: true, name: true } }
        },
        orderBy: { date: 'desc' }
    });

    const inProcessTransfers = await prisma.bid.findMany({
        where: {
            status: { in: ['PENDING', 'ACCEPTED', 'HIJACKED'] },
            windowEnds: { gte: settings.currentDate },
            OR: [
                { fromTeamId: team.id },
                { toTeamId: team.id }
            ]
        },
        include: {
            player: { select: { id: true, name: true, naturalPosition: true, age: true } },
            fromTeam: { select: { id: true, name: true } },
            toTeam: { select: { id: true, name: true } }
        },
        orderBy: { windowEnds: 'asc' }
    });

    const ensuredTactics = team.tactics ?? await prisma.teamTactics.upsert({
        where: { teamId: team.id },
        update: {},
        create: {
            teamId: team.id,
            normalFormation: team.formation,
            normalMentality: team.mentality,
            normalPassing: team.passing,
            normalTackling: team.tackling,
            normalAttacking_focus: team.attacking_focus,
            normalCreative_freedom: team.creative_freedom,
            behindFormation: team.formation,
            behindMentality: 'ALL_OUT_ATTACK',
            behindPassing: 'DIRECT',
            behindTackling: 'HARD',
            behindAttacking_focus: 'WINGS',
            behindCreative_freedom: 'MAXIMUM',
            leadingFormation: team.formation,
            leadingMentality: 'ULTRA_DEFENSIVE',
            leadingPassing: 'SHORT',
            leadingTackling: 'HARD',
            leadingAttacking_focus: 'CENTER',
            leadingCreative_freedom: 'NORMAL'
        }
    });

    const playerswithSuitability = team.players.map(p => {
        const attrs: PlayerAttributes = toPlayerAttributes({
            handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
            heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces, throw: p.throw,
            aggression: p.aggression, positioning: p.positioning, vision: p.vision,
            bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
            pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
            agility: p.agility, balance: p.balance, crossing: p.crossing
        });

        const currentPosId = p.tacticalPosition ? p.tacticalPosition.split('_')[0] : null;
        const currentPosPower = currentPosId
            ? calculatePlayerPower({
                attributes: attrs,
                targetPosition: currentPosId,
                condition: p.condition,
                exp: p.exp || 0
            })
            : null;
        const baseSuitability = currentPosPower?.baseSuitabilityWithExp || 0;
        const fitnessSuitability = currentPosPower?.powerWithExp || 0;

        const natPos = p.naturalPosition.split('_')[0];
        const power = calculatePlayerPower({
            attributes: attrs,
            targetPosition: natPos,
            condition: 100,
            exp: p.exp || 0
        }).powerWithExp;
        
        const avgRating = p.matchStats && p.matchStats.length > 0
            ? Number((p.matchStats.reduce((sum, stat) => sum + stat.rating, 0) / p.matchStats.length).toFixed(2))
            : 0;
        
        const ageMultiplier = p.age <= 25 ? 1.2 : p.age >= 32 ? 0.6 : 1.0;
        const playerPopularityMultiplier = 0.8 + (p.popularity / 100) * 1.0;
        const clubReputationMultiplier = 0.7 + ((team.reputation || 50) / 100) * 0.8;
        const formMultiplier = 0.5 + (Math.min(avgRating, 10) / 10) * 1.0;

        const rawValue = Math.round(power * power * 1000 * ageMultiplier * playerPopularityMultiplier * clubReputationMultiplier * formMultiplier);
        const marketValue = applyMarketValuePowerBands(rawValue, power);

        return {
            id: p.id,
            name: p.name,
            transferStatus: p.transferStatus,
            naturalPosition: p.naturalPosition,
            age: p.age,
            condition: p.condition,
            morale: p.morale,
            suspensionMatchesRemaining: p.suspensionMatchesRemaining || 0,
            injuryWeeksRemaining: p.injuryWeeksRemaining || 0,
            injurySeverity: p.injurySeverity || null,
            jerseyNumber: p.jerseyNumber,
            tacticalPosition: p.tacticalPosition,
            playerRole: p.playerRole,
            attackingRolePreset: p.attackingRolePreset,
            defensiveRolePreset: p.defensiveRolePreset,
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
            marketValue,
            exp: p.exp || 0
        };
    });

    playerswithSuitability.sort((a, b) => a.name.localeCompare(b.name));

    const currentTactics = {
        formation: team.formation,
        mentality: ensuredTactics.normalMentality,
        passing: ensuredTactics.normalPassing,
        tackling: ensuredTactics.normalTackling,
        attacking_focus: ensuredTactics.normalAttacking_focus,
        creative_freedom: ensuredTactics.normalCreative_freedom
    };

    const matches = [
        ...team.homeMatches.map(m => ({ ...m, role: 'home' as const, opponent: m.awayTeam })),
        ...team.awayMatches.map(m => ({ ...m, role: 'away' as const, opponent: m.homeTeam }))
    ];
    matches.sort((a, b) => b.date.getTime() - a.date.getTime());

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

    let opponentPlayers: any[] = [];
    if (upcomingMatch) {
        const opponentTeamId = upcomingMatch.homeTeamId === team.id ? upcomingMatch.awayTeamId : upcomingMatch.homeTeamId;
        const opponentTeam = await prisma.team.findUnique({
            where: { id: opponentTeamId },
            include: {
                players: {
                    where: { isRetired: false, tacticalPosition: { not: null } },
                    select: {
                        id: true, name: true, naturalPosition: true,
                        handling: true, tackling: true, passing: true, shooting: true,
                        heading: true, dribbling: true, setPieces: true, throw: true,
                        aggression: true, positioning: true, vision: true,
                        bravery: true, leadership: true, teamwork: true, composure: true,
                        pace: true, acceleration: true, stamina: true, strength: true,
                        agility: true, balance: true, crossing: true,
                        condition: true, avgRating: true, goals: true, assists: true,
                        matchStats: {
                            where: { minutes: { gt: 0 } },
                            select: { rating: true },
                            take: 20
                        },
                        exp: true
                    }
                }
            }
        });

        if (opponentTeam) {
            opponentPlayers = opponentTeam.players.map(p => {
                const attrs: PlayerAttributes = toPlayerAttributes({
                    handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
                    heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces, throw: p.throw,
                    aggression: p.aggression, positioning: p.positioning, vision: p.vision,
                    bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
                    pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
                    agility: p.agility, balance: p.balance, crossing: p.crossing
                });
                const power = calculatePlayerPower({
                    attributes: attrs,
                    targetPosition: p.naturalPosition.split('_')[0],
                    condition: p.condition,
                    exp: p.exp || 0
                }).powerWithExp;

                return {
                    id: p.id, name: p.name, position: p.naturalPosition.split('_')[0],
                    power, condition: p.condition, avgRating: p.avgRating, goals: p.goals, assists: p.assists
                };
            }).sort((a, b) => b.power - a.power);
        }
    }

    return (
        <Suspense fallback={<div>Loading Vanguard Command...</div>}>
            <SquadClientV2 
                teamId={team.id} 
                teamName={team.name}
                players={playerswithSuitability} 
                currentTactics={currentTactics} 
                matches={matches as any} 
                currentSeason={settings.currentSeason}
                upcomingMatch={upcomingMatch as any}
                opponentPlayers={opponentPlayers}
                transferHistory={transferHistory as any} 
                inProcessTransfers={inProcessTransfers as any}
                isUserTeam={isUserTeam}
            />
        </Suspense>
    );
}
