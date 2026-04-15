import prisma from '@/lib/prisma';
import { getDivisionFinanceMultiplier } from './divisionSystem';
import { simulateMatch } from '../engine/match';
import { simulateMatch2D } from '../engine/v2/match2d';
import { TeamState, PlayerState, Position, EnginePlayerMatchStats, PlayerAttributes, MatchPrepConfig, MatchEventLog } from '../engine/types';
import type { V2MatchState } from '../engine/v2/types2d';
import { updatePlayerPopularity, updateTeamReputation } from '../engine/financial';
import { applyAgeEfficiency, calculateMatchExp } from '../engine/experience';
import { calculatePlayerPower, getEffectiveAttributes, toPlayerAttributes } from '../engine/playerPower';
import {
    INJURY_BASE_CHANCE,
    INJURY_LOW_CONDITION_THRESHOLD,
    INJURY_LOW_CONDITION_WEIGHT,
    INJURY_MAX_CHANCE,
    INJURY_MIN_CHANCE,
    INJURY_SEVERITY_RANGES,
    RED_CARD_SUSPENSION_MATCHES,
    YELLOW_SUSPENSION_THRESHOLD_DEFAULT,
    clamp,
    getDurabilityNorm,
    randomIntInclusive
} from '../constants/disciplineInjury';

const FORMATIONS: Record<string, { id: string }[]> = {
    '4-4-2': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MR' },
        { id: 'MC_R' },
        { id: 'MC_L' },
        { id: 'ML' },
        { id: 'FW_R' },
        { id: 'FW_L' }
    ],
    '4-3-3': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MC_R' },
        { id: 'MC' },
        { id: 'MC_L' },
        { id: 'FW_R' },
        { id: 'FW' },
        { id: 'FW_L' }
    ],
    '4-5-1': [
        { id: 'GK' },
        { id: 'DR' },
        { id: 'DC_R' },
        { id: 'DC_L' },
        { id: 'DL' },
        { id: 'MR' },
        { id: 'MC_R' },
        { id: 'MC' },
        { id: 'MC_L' },
        { id: 'ML' },
        { id: 'FW' }
    ]
};

const SLOT_NATURAL_PREFERENCES: Record<string, string[]> = {
    GK: ['GK'],
    DR: ['DR', 'DL', 'DC', 'DMC'],
    DL: ['DL', 'DR', 'DC', 'DMC'],
    DC: ['DC', 'DMC', 'DR', 'DL'],
    DMC: ['DMC', 'MC', 'AMC', 'DMR', 'DML', 'DC'],
    MC: ['MC', 'DMC', 'AMC', 'MR', 'ML', 'DMR', 'DML'],
    MR: ['MR', 'ML', 'AMR', 'AML', 'AMC', 'MC', 'FWR', 'FWL', 'FWC'],
    ML: ['ML', 'MR', 'AML', 'AMR', 'AMC', 'MC', 'FWL', 'FWR', 'FWC'],
    FW: ['FWC', 'FWR', 'FWL', 'AMC', 'MR', 'ML']
};

function normalizeNaturalPosition(position?: string | null): string | null {
    if (!position) return null;
    const upper = position.toUpperCase();
    if (upper === 'FW' || upper === 'ST' || upper === 'FC') return 'FWC';
    return upper;
}

function getSlotPreferenceRank(slotBase: string, naturalPosition?: string | null): number {
    const normalized = normalizeNaturalPosition(naturalPosition);
    if (!normalized) return -1;
    const prefs = SLOT_NATURAL_PREFERENCES[slotBase];
    if (!prefs) return -1;
    return prefs.indexOf(normalized);
}

function mapAttributes(p: any): PlayerAttributes {
    return toPlayerAttributes({
        handling: p.handling,
        tackling: p.tackling,
        passing: p.passing,
        shooting: p.shooting,
        heading: p.heading,
        dribbling: p.dribbling,
        crossing: p.crossing,
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
        balance: p.balance
    });
}

function getFitnessSuitability(attributes: PlayerAttributes, targetPosition: string, condition: number): number {
    return calculatePlayerPower({
        attributes,
        targetPosition,
        condition,
        exp: 0
    }).powerWithExp;
}

function isUnavailablePlayer(player: any): boolean {
    return (player?.suspensionMatchesRemaining || 0) > 0 || (player?.injuryWeeksRemaining || 0) > 0;
}

function clampChance(v: number): number {
    return clamp(v, INJURY_MIN_CHANCE, INJURY_MAX_CHANCE);
}

function resolveKnockoutTie(homeScore: number, awayScore: number): {
    homeScore: number;
    awayScore: number;
    wentToExtraTime: boolean;
    wentToPenalties: boolean;
    penaltyHome: number | null;
    penaltyAway: number | null;
} {
    // No tie-break needed if there is already a winner in normal time.
    if (homeScore !== awayScore) {
        return {
            homeScore,
            awayScore,
            wentToExtraTime: false,
            wentToPenalties: false,
            penaltyHome: null,
            penaltyAway: null
        };
    }

    // Simulate extra-time as low-scoring add-on.
    const etHome = Math.random() < 0.35 ? randomIntInclusive(0, 1) : 0;
    const etAway = Math.random() < 0.35 ? randomIntInclusive(0, 1) : 0;
    const etHomeScore = homeScore + etHome;
    const etAwayScore = awayScore + etAway;

    if (etHomeScore !== etAwayScore) {
        return {
            homeScore: etHomeScore,
            awayScore: etAwayScore,
            wentToExtraTime: true,
            wentToPenalties: false,
            penaltyHome: null,
            penaltyAway: null
        };
    }

    // Still level after ET -> penalties.
    let penaltyHome = 3 + randomIntInclusive(0, 3);
    let penaltyAway = 3 + randomIntInclusive(0, 3);
    while (penaltyHome === penaltyAway) {
        penaltyHome = 3 + randomIntInclusive(0, 3);
        penaltyAway = 3 + randomIntInclusive(0, 3);
    }

    return {
        homeScore: etHomeScore,
        awayScore: etAwayScore,
        wentToExtraTime: true,
        wentToPenalties: true,
        penaltyHome,
        penaltyAway
    };
}

function getRankRevenueRatio(rank: number, divisionLevel: number = 1): number {
    // Attendance based on division level with random variation
    // Division 1: 90-100%, Division 2: 80-90%, Division 3: 70-80%
    const attendanceRanges = {
        1: { min: 0.90, max: 1.00 },
        2: { min: 0.80, max: 0.90 },
        3: { min: 0.70, max: 0.80 }
    };
    
    const range = (attendanceRanges as Record<number, { min: number; max: number }>)[divisionLevel] || attendanceRanges[3];
    
    // Random attendance within the range for this division
    // Higher rank gets slightly higher attendance within the range
    const rankBonus = Math.max(0, (20 - Math.min(20, rank)) * 0.005); // Top rank gets +0-10% within range
    const randomFactor = Math.random() * (range.max - range.min);
    const attendance = range.min + randomFactor + rankBonus;
    
    // Clamp to ensure within valid range
    return Math.max(range.min, Math.min(range.max, attendance));
}

const rankCache = new Map<string, { rank: number; divisionLevel: number }>();

export function clearLeagueRankCache() {
    rankCache.clear();
}

async function getTeamLeagueRank(teamId: string, season: number): Promise<{ rank: number; divisionLevel: number }> {
    const cacheKey = `${teamId}_${season}`;
    if (rankCache.has(cacheKey)) return rankCache.get(cacheKey)!;

    const targetTeam = await prisma.team.findUnique({
        where: { id: teamId },
        include: { league: { select: { id: true, level: true } } }
    });

    if (!targetTeam?.leagueId) {
        return { rank: 1, divisionLevel: 1 };
    }

    const teams = await prisma.team.findMany({
        where: { leagueId: targetTeam.leagueId },
        select: { id: true, name: true }
    });

    const standings = new Map<string, {
        teamId: string;
        name: string;
        points: number;
        goalDiff: number;
        goalsFor: number;
        goalsAgainst: number;
    }>();

    for (const team of teams) {
        standings.set(team.id, {
            teamId: team.id,
            name: team.name,
            points: 0,
            goalDiff: 0,
            goalsFor: 0,
            goalsAgainst: 0
        });
    }

    const playedMatches = await prisma.match.findMany({
        where: {
            season,
            isPlayed: true,
            homeScore: { not: null },
            awayScore: { not: null }
        },
        select: {
            homeTeamId: true,
            awayTeamId: true,
            homeScore: true,
            awayScore: true
        }
    });

    for (const m of playedMatches) {
        const home = standings.get(m.homeTeamId);
        const away = standings.get(m.awayTeamId);
        if (!home || !away) continue;

        const hs = m.homeScore ?? 0;
        const as = m.awayScore ?? 0;

        home.goalsFor += hs;
        home.goalsAgainst += as;
        home.goalDiff = home.goalsFor - home.goalsAgainst;

        away.goalsFor += as;
        away.goalsAgainst += hs;
        away.goalDiff = away.goalsFor - away.goalsAgainst;

        if (hs > as) {
            home.points += 3;
        } else if (hs < as) {
            away.points += 3;
        } else {
            home.points += 1;
            away.points += 1;
        }
    }

    const table = Array.from(standings.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
        return a.name.localeCompare(b.name);
    });

    table.forEach((row, index) => {
        rankCache.set(`${row.teamId}_${season}`, {
            rank: index + 1,
            divisionLevel: targetTeam.league?.level || 1
        });
    });

    const rankIndex = table.findIndex((row) => row.teamId === teamId);
    return {
        rank: rankIndex >= 0 ? rankIndex + 1 : Math.max(1, table.length),
        divisionLevel: targetTeam.league?.level || 1
    };
}

function rollInjuryForMatch(player: { stamina: number; strength: number }, stat: EnginePlayerMatchStats): { weeks: number; severity: 'MINOR' | 'MODERATE' | 'MAJOR' } | null {
    const durabilityNorm = getDurabilityNorm(player.stamina, player.strength);
    const minuteFactor = Math.min(1, (stat.minutes || 0) / 90);
    if (minuteFactor <= 0) return null;

    const lowConditionFactor = Math.max(0, (INJURY_LOW_CONDITION_THRESHOLD - (stat.fitnessEnd || 100)) / INJURY_LOW_CONDITION_THRESHOLD);
    const contactIntensity = 1 + Math.min(1, ((stat.tacklesAttempted || 0) + (stat.fouls || 0)) / 12) * 0.6;
    const durabilityFactor = 1.25 - (0.75 * durabilityNorm);

    const injuryChance = clampChance(
        INJURY_BASE_CHANCE
        * minuteFactor
        * contactIntensity
        * durabilityFactor
        * (1 + (INJURY_LOW_CONDITION_WEIGHT * lowConditionFactor))
    );

    if (Math.random() >= injuryChance) return null;

    // Lower durability shifts probability toward moderate/major injuries.
    const minorWeight = 0.6 + (0.5 * durabilityNorm);
    const moderateWeight = 0.35 + (0.2 * (1 - durabilityNorm));
    const majorWeight = 0.05 + (0.3 * (1 - durabilityNorm));
    const totalWeight = minorWeight + moderateWeight + majorWeight;
    const roll = Math.random() * totalWeight;

    let severity: 'MINOR' | 'MODERATE' | 'MAJOR' = 'MINOR';
    if (roll <= minorWeight) severity = 'MINOR';
    else if (roll <= (minorWeight + moderateWeight)) severity = 'MODERATE';
    else severity = 'MAJOR';

    const range = INJURY_SEVERITY_RANGES[severity];
    const baseWeeks = randomIntInclusive(range.min, range.max);
    const recoveryFactor = 1.2 - (0.6 * durabilityNorm);
    const lowFitnessAddon = Math.max(0, (60 - (stat.fitnessEnd || 100)) / 30);
    const weeks = Math.max(1, Math.round(baseWeeks * recoveryFactor + lowFitnessAddon));

    return { weeks, severity };
}

function autoSelectLineup(team: any) {
    const LINEUP_REST_THRESHOLD = 85;
    const LINEUP_FRESH_PREFERRED_THRESHOLD = 95;
    const getConditionSelectionBonus = (condition: number) => {
        if (condition >= LINEUP_FRESH_PREFERRED_THRESHOLD) {
            return 18 + ((condition - LINEUP_FRESH_PREFERRED_THRESHOLD) * 1.2);
        }
        if (condition >= LINEUP_REST_THRESHOLD) {
            return (condition - LINEUP_REST_THRESHOLD) * 0.6;
        }
        return -40 - ((LINEUP_REST_THRESHOLD - condition) * 2.2);
    };

    const slots = FORMATIONS[team.formation] || FORMATIONS['4-4-2'];
    const usedPlayers = new Set<string>();
    const assignments: { playerId: string; position: string }[] = [];
    const selectablePlayers = team.players.filter((p: any) => !isUnavailablePlayer(p));

    for (const slot of slots) {
        const slotBase = slot.id.split('_')[0];
        
        // For GK position, prioritize actual goalkeepers
        let availablePlayers = selectablePlayers.filter((p: any) => !usedPlayers.has(p.id));
        
        if (slotBase === 'GK') {
            const goalkeepers = availablePlayers.filter((p: any) => p.naturalPosition === 'GK');
            // Only use actual GK if available, otherwise fallback to any player
            if (goalkeepers.length > 0) {
                availablePlayers = goalkeepers;
            }
        }

        const preferredPlayers = availablePlayers.filter((p: any) => getSlotPreferenceRank(slotBase, p.naturalPosition) >= 0);
        if (preferredPlayers.length > 0) {
            availablePlayers = preferredPlayers;
        }

        const hasFreshAlternative = availablePlayers.some((p: any) => (p.condition || 0) >= LINEUP_FRESH_PREFERRED_THRESHOLD);
        
        const bestPlayer = availablePlayers
            .map((p: any) => ({
                playerId: p.id,
                position: slot.id,
                suitability: (() => {
                    const basePower = calculatePlayerPower({
                        attributes: mapAttributes(p),
                        targetPosition: slotBase,
                        naturalPosition: p.naturalPosition,
                        condition: p.condition,
                        exp: p.exp || 0
                    }).powerWithExp;

                    let score = basePower + getConditionSelectionBonus(p.condition || 0);
                    const preferenceRank = getSlotPreferenceRank(slotBase, p.naturalPosition);

                    if (preferenceRank === 0) score += 16;
                    else if (preferenceRank === 1) score += 10;
                    else if (preferenceRank === 2) score += 6;
                    else if (preferenceRank === 3) score += 3;

                    if ((p.condition || 0) < LINEUP_REST_THRESHOLD && hasFreshAlternative) {
                        score -= 80;
                    }

                    return score;
                })()
            }))
            .sort((a: any, b: any) => b.suitability - a.suitability)[0];

        if (bestPlayer) {
            assignments.push({ playerId: bestPlayer.playerId, position: bestPlayer.position });
            usedPlayers.add(bestPlayer.playerId);
        }
    }

    return assignments;
}

function mapPlayer(p: any): PlayerState {
    // Apply EXP bonus to all attributes
    const exp = p.exp || 0;
    const effectiveAttributes = getEffectiveAttributes(mapAttributes(p), exp);
    
    return {
        id: p.id,
        name: p.name,
        position: p.naturalPosition as Position,
        attributes: effectiveAttributes,
        condition: p.condition,
        morale: p.morale,
        exp: exp,
        tacticalPosition: p.tacticalPosition,
        playerRole: p.playerRole || null,
        attackingRolePreset: p.attackingRolePreset || p.playerRole || null,
        defensiveRolePreset: p.defensiveRolePreset || p.playerRole || null,
        cards: { yellow: 0, red: 0 },
        stats: { goals: p.goals, assists: p.assists, tackles: 0, passes: 0 },
        isInjured: (p.injuryWeeksRemaining || 0) > 0,
        isSuspended: (p.suspensionMatchesRemaining || 0) > 0
    };
}

export async function processMatch(matchId: string) {
    const matchDB = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            homeTeam: { include: { players: { where: { isRetired: false } }, tactics: true } },
            awayTeam: { include: { players: { where: { isRetired: false } }, tactics: true } }
        }
    }) as any;

    if (!matchDB || matchDB.isPlayed) return null;

    const settings = await prisma.globalGameSettings.findUnique({ where: { id: 1 } });
    const userTeamId = settings?.userTeamId ?? null;
    const yellowSuspensionThreshold = Math.max(1, settings?.yellowSuspensionThreshold ?? YELLOW_SUSPENSION_THRESHOLD_DEFAULT);

    // Check if user has manually set tactical positions
    const homeHasManual = matchDB.homeTeam.id === userTeamId
        && matchDB.homeTeam.players.some((p: any) => p.tacticalPosition);
    const awayHasManual = matchDB.awayTeam.id === userTeamId
        && matchDB.awayTeam.players.some((p: any) => p.tacticalPosition);

    // Auto-select lineup ONLY for AI teams (never for user teams)
    // User teams: if user has set positions (homeHasManual=true), use them. If cleared, don't auto-select.
    const homeIsUserTeam = matchDB.homeTeam.id === userTeamId;
    const awayIsUserTeam = matchDB.awayTeam.id === userTeamId;
    
    // Only auto-select for AI teams
    const homeAssignments = homeIsUserTeam ? [] : autoSelectLineup(matchDB.homeTeam);
    const awayAssignments = awayIsUserTeam ? [] : autoSelectLineup(matchDB.awayTeam);

    // IMPORTANT: If user team has NO players positioned, skip simulation entirely
    // This prevents auto-simulating user matches when user hasn't set their lineup
    const homeUserTeamNoLineup = homeIsUserTeam && !matchDB.homeTeam.players.some((p: any) => p.tacticalPosition);
    const awayUserTeamNoLineup = awayIsUserTeam && !matchDB.awayTeam.players.some((p: any) => p.tacticalPosition);
    
    if (homeUserTeamNoLineup || awayUserTeamNoLineup) {
        console.log(`[Match Simulator] Skipping match ${matchId} - user team has no lineup set`);
        return null; // Don't simulate, don't advance day, let user set their lineup
    }

    await prisma.$transaction(async (tx) => {
        // Unavailable players (suspended/injured) cannot be in lineup.
        await tx.player.updateMany({
            where: {
                teamId: { in: [matchDB.homeTeam.id, matchDB.awayTeam.id] },
                OR: [
                    { suspensionMatchesRemaining: { gt: 0 } },
                    { injuryWeeksRemaining: { gt: 0 } }
                ]
            } as any,
            data: { tacticalPosition: null }
        });

        if (!homeHasManual) {
            await tx.player.updateMany({
                where: { teamId: matchDB.homeTeam.id },
                data: { tacticalPosition: null }
            });

            await Promise.all(homeAssignments.map(assignment =>
                tx.player.update({
                    where: { id: assignment.playerId },
                    data: { tacticalPosition: assignment.position }
                })
            ));
        }

        if (!awayHasManual) {
            await tx.player.updateMany({
                where: { teamId: matchDB.awayTeam.id },
                data: { tacticalPosition: null }
            });

            await Promise.all(awayAssignments.map(assignment =>
                tx.player.update({
                    where: { id: assignment.playerId },
                    data: { tacticalPosition: assignment.position }
                })
            ));
        }
    });

    // Update in-memory players for simulation
    if (!homeHasManual) {
        matchDB.homeTeam.players.forEach((p: any) => {
            const found = homeAssignments.find(a => a.playerId === p.id);
            p.tacticalPosition = found ? found.position : null;
        });
    }

    if (!awayHasManual) {
        matchDB.awayTeam.players.forEach((p: any) => {
            const found = awayAssignments.find(a => a.playerId === p.id);
            p.tacticalPosition = found ? found.position : null;
        });
    }

    // Ensure unavailable players are not active even when manual lineup existed.
    for (const p of matchDB.homeTeam.players) {
        if (isUnavailablePlayer(p)) p.tacticalPosition = null;
    }
    for (const p of matchDB.awayTeam.players) {
        if (isUnavailablePlayer(p)) p.tacticalPosition = null;
    }

    const homeTeam: TeamState = {
        id: matchDB.homeTeam.id,
        name: matchDB.homeTeam.name,
        tactics: {
            formation: matchDB.homeTactics_formation || matchDB.homeTeam.formation,
            mentality: matchDB.homeTactics_mentality || matchDB.homeTeam.mentality,
            passing: matchDB.homeTactics_passing || matchDB.homeTeam.passing,
            tackling: matchDB.homeTactics_tackling || matchDB.homeTeam.tackling,
            attacking_focus: matchDB.homeTactics_attacking_focus || matchDB.homeTeam.attacking_focus,
            creative_freedom: matchDB.homeTactics_creative_freedom || matchDB.homeTeam.creative_freedom
        },
        tacticalPlans: {
            normal: {
                formation: matchDB.homeTeam.tactics?.normalFormation || matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.normalMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.normalPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.normalTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.normalAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.normalCreative_freedom || matchDB.homeTeam.creative_freedom
            },
            behind: {
                formation: matchDB.homeTeam.tactics?.behindFormation || matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.behindMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.behindPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.behindTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.behindAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.behindCreative_freedom || matchDB.homeTeam.creative_freedom
            },
            leading: {
                formation: matchDB.homeTeam.tactics?.leadingFormation || matchDB.homeTeam.formation,
                mentality: matchDB.homeTeam.tactics?.leadingMentality || matchDB.homeTeam.mentality,
                passing: matchDB.homeTeam.tactics?.leadingPassing || matchDB.homeTeam.passing,
                tackling: matchDB.homeTeam.tactics?.leadingTackling || matchDB.homeTeam.tackling,
                attacking_focus: matchDB.homeTeam.tactics?.leadingAttacking_focus || matchDB.homeTeam.attacking_focus,
                creative_freedom: matchDB.homeTeam.tactics?.leadingCreative_freedom || matchDB.homeTeam.creative_freedom
            }
        },
        players: matchDB.homeTeam.players.map(mapPlayer)
    };

    const awayTeam: TeamState = {
        id: matchDB.awayTeam.id,
        name: matchDB.awayTeam.name,
        tactics: {
            formation: matchDB.awayTactics_formation || matchDB.awayTeam.formation,
            mentality: matchDB.awayTactics_mentality || matchDB.awayTeam.mentality,
            passing: matchDB.awayTactics_passing || matchDB.awayTeam.passing,
            tackling: matchDB.awayTactics_tackling || matchDB.awayTeam.tackling,
            attacking_focus: matchDB.awayTactics_attacking_focus || matchDB.awayTeam.attacking_focus,
            creative_freedom: matchDB.awayTactics_creative_freedom || matchDB.awayTeam.creative_freedom
        },
        tacticalPlans: {
            normal: {
                formation: matchDB.awayTeam.tactics?.normalFormation || matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.normalMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.normalPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.normalTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.normalAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.normalCreative_freedom || matchDB.awayTeam.creative_freedom
            },
            behind: {
                formation: matchDB.awayTeam.tactics?.behindFormation || matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.behindMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.behindPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.behindTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.behindAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.behindCreative_freedom || matchDB.awayTeam.creative_freedom
            },
            leading: {
                formation: matchDB.awayTeam.tactics?.leadingFormation || matchDB.awayTeam.formation,
                mentality: matchDB.awayTeam.tactics?.leadingMentality || matchDB.awayTeam.mentality,
                passing: matchDB.awayTeam.tactics?.leadingPassing || matchDB.awayTeam.passing,
                tackling: matchDB.awayTeam.tactics?.leadingTackling || matchDB.awayTeam.tackling,
                attacking_focus: matchDB.awayTeam.tactics?.leadingAttacking_focus || matchDB.awayTeam.attacking_focus,
                creative_freedom: matchDB.awayTeam.tactics?.leadingCreative_freedom || matchDB.awayTeam.creative_freedom
            }
        },
        players: matchDB.awayTeam.players.map(mapPlayer)
    };

    // Parse match prep configs
    const homePrep: MatchPrepConfig | null = matchDB.homePrepConfig 
        ? JSON.parse(matchDB.homePrepConfig) 
        : null;
    const awayPrep: MatchPrepConfig | null = matchDB.awayPrepConfig 
        ? JSON.parse(matchDB.awayPrepConfig) 
        : null;

    // Check V2 engine feature flag
    const enableMatch2D = settings?.enableMatch2D ?? false;
    
    // Route to appropriate engine
    let result: any;
    let v2MatchState: V2MatchState | null = null;
    
    if (enableMatch2D) {
        // Use V2 engine with 2D spatial simulation
        v2MatchState = simulateMatch2D(homeTeam, awayTeam, { home: homePrep, away: awayPrep });
        // V2MatchState extends MatchState, so we can use it as result
        result = v2MatchState;
    } else {
        // Use V1 engine (classic 1D simulation)
        result = simulateMatch(homeTeam, awayTeam, { home: homePrep, away: awayPrep });
    }
    
    const isCupKnockout = matchDB.competitionType === 'CUP' && matchDB.competitionPhase === 'KNOCKOUT';
    const tieBreakResult = isCupKnockout && result.homeScore === result.awayScore
        ? resolveKnockoutTie(result.homeScore, result.awayScore)
        : {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            wentToExtraTime: false,
            wentToPenalties: false,
            penaltyHome: null,
            penaltyAway: null
        };

    const finalHomeScore = tieBreakResult.homeScore;
    const finalAwayScore = tieBreakResult.awayScore;

    const defaultTeamStats = {
        possession: 50,
        corners: 0,
        offsides: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        shots: 0,
        shotsOnTarget: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        crossesAttempted: 0,
        crossesCompleted: 0,
        freeKicks: 0,
        throws: 0
    };

    const derivedTeamStats = {
        home: { ...defaultTeamStats },
        away: { ...defaultTeamStats }
    };

    (Object.values(result.playerStats) as EnginePlayerMatchStats[]).forEach((stat) => {
        const bucket = stat.teamId === result.homeTeamId ? derivedTeamStats.home : derivedTeamStats.away;
        bucket.shots += stat.shots || 0;
        bucket.shotsOnTarget += stat.shotsOnTarget || 0;
        bucket.passesAttempted += stat.passesAttempted || 0;
        bucket.passesCompleted += stat.passesCompleted || 0;
        bucket.crossesAttempted += stat.crossesAttempted || 0;
        bucket.crossesCompleted += stat.crossesCompleted || 0;
        bucket.yellowCards += stat.yellowCards || 0;
        bucket.redCards += stat.redCards || 0;
        bucket.freeKicks += stat.freeKicks || 0;
        bucket.corners += stat.corners || 0;
        bucket.throws += stat.throws || 0;
    });

    const mergedTeamStats = {
        home: { ...defaultTeamStats, ...result.teamStats.home, ...derivedTeamStats.home },
        away: { ...defaultTeamStats, ...result.teamStats.away, ...derivedTeamStats.away }
    };
    let motm: EnginePlayerMatchStats | null = null;

    await prisma.$transaction(async (tx) => {
        // Determine Man of the Match (highest rating)
        const playerStats = Object.values(result.playerStats) as EnginePlayerMatchStats[];
        if (playerStats.length > 0) {
            motm = playerStats.reduce((prev, current) => (prev.rating > current.rating) ? prev : current);
        }

        await (tx.match as any).update({
            where: { id: matchId },
            data: {
                homeScore: finalHomeScore,
                awayScore: finalAwayScore,
                isPlayed: true,
                stats: JSON.stringify(mergedTeamStats),
                motmPlayerId: motm ? motm.playerId : null,
                wentToExtraTime: tieBreakResult.wentToExtraTime,
                wentToPenalties: tieBreakResult.wentToPenalties,
                penaltyHome: tieBreakResult.penaltyHome,
                penaltyAway: tieBreakResult.penaltyAway
            }
        });

        if (motm) {
            await (tx.player as any).update({
                where: { id: motm.playerId },
                data: { motmCount: { increment: 1 } }
            });
        }

        if (result.events.length > 0) {
            await tx.matchEvent.createMany({
                data: result.events.map((e: MatchEventLog) => ({
                    matchId: matchId,
                    minute: e.minute,
                    text: e.text,
                    type: e.type,
                    teamId: e.teamId,
                    playerId: e.playerId
                }))
            });
        }

        const statsToCreate = playerStats.map((stat: EnginePlayerMatchStats) => ({
            matchId: matchId,
            playerId: stat.playerId,
            teamId: stat.teamId,
            rating: stat.rating,
            minutes: stat.minutes,
            goals: stat.goals,
            assists: stat.assists,
            passesAttempted: stat.passesAttempted,
            passesCompleted: stat.passesCompleted,
            crossesAttempted: stat.crossesAttempted,
            crossesCompleted: stat.crossesCompleted,
            shots: stat.shots,
            shotsOnTarget: stat.shotsOnTarget,
            tacklesAttempted: stat.tacklesAttempted,
            tacklesWon: stat.tacklesWon,
            dribblesAttempted: stat.dribblesAttempted,
            dribblesWon: stat.dribblesWon,
            saves: stat.saves,
            fouls: stat.fouls,
            fitnessEnd: stat.fitnessEnd,
            defensiveThirdTouches: stat.defensiveThirdTouches || 0,
            middleThirdTouches: stat.middleThirdTouches || 0,
            attackingThirdTouches: stat.attackingThirdTouches || 0,
            yellowCards: stat.yellowCards,
            redCards: stat.redCards,
            freeKicks: stat.freeKicks || 0,
            corners: stat.corners || 0,
            throws: stat.throws || 0
        }));

        if (statsToCreate.length > 0) {
            try {
                await (tx.playerMatchStats as any).createMany({ data: statsToCreate });
            } catch (err: any) {
                const msg = String(err?.message || '');
                // Backward compatibility: schema/client not migrated yet
                if (msg.includes('defensiveThirdTouches') || msg.includes('middleThirdTouches') || msg.includes('attackingThirdTouches') || msg.includes('fouls')) {
                    const legacyStatsToCreate = statsToCreate.map((s) => {
                        const { defensiveThirdTouches, middleThirdTouches, attackingThirdTouches, fouls, ...legacy } = s as any;
                        return legacy;
                    });
                    await (tx.playerMatchStats as any).createMany({ data: legacyStatsToCreate });
                } else {
                    throw err;
                }
            }
        }

        const actionLogsToCreate = (result.actionLogs || []).map((log: any) => ({
            matchId: matchId,
            playerId: log.playerId,
            teamId: log.teamId,
            minute: log.minute,
            ballPosition: log.ballPosition,
            zone: log.zone,
            actionType: log.actionType,
            result: log.result,
            isSuccessful: log.isSuccessful,
            expectedSuccessRate: typeof log.expectedSuccessRate === 'number' ? log.expectedSuccessRate : null,
            targetPlayerId: log.targetPlayerId || null,
            metadata: log.metadata || null
        }));

        if (actionLogsToCreate.length > 0) {
            try {
                await ((tx as any).playerActionLog).createMany({ data: actionLogsToCreate });
            } catch (err: any) {
                const msg = String(err?.message || '');
                // Backward compatibility: action log table/model not available yet
                if (msg.includes('playerActionLog') || msg.includes('PlayerActionLog') || msg.includes('Unknown argument')) {
                    console.warn('[MatchSimulator] Skipping PlayerActionLog persistence (migration/client not ready yet).');
                } else {
                    throw err;
                }
            }
        }

        // Team completed a match => burn one suspension match for already-suspended players.
        await (tx.player as any).updateMany({
            where: {
                teamId: { in: [matchDB.homeTeamId, matchDB.awayTeamId] },
                suspensionMatchesRemaining: { gt: 0 }
            },
            data: {
                suspensionMatchesRemaining: { decrement: 1 }
            }
        });

        const postPlayerEvents: Array<{ minute: number; type: string; text: string; teamId?: string; playerId?: string }> = [];
        const playedPlayerIds = new Set<string>();
        const playedExpGainByTeam: Record<string, number[]> = {};
        const MATCH_EXP_GAIN_CAP = 3;

        const playerUpdatePromises: Promise<any>[] = [];

        for (const stat of playerStats) {
            // Calculate EXP gain from match performance
            const player = [...matchDB.homeTeam.players, ...matchDB.awayTeam.players].find((p: any) => p.id === stat.playerId);
            
                if (!player) continue; // Skip if player not found
            
                const isMotm = motm?.playerId === stat.playerId;
            const cleanSheet = (stat.teamId === matchDB.homeTeamId && finalAwayScore === 0) ||
                              (stat.teamId === matchDB.awayTeamId && finalHomeScore === 0);
            
            // GK save bonus: pass saves, teamShotsOnTargetConceded, goalsConceded if GK
            let expGain;
            const isGK = (player.naturalPosition || '').toUpperCase().includes('GK');
            if (isGK) {
                // Determine opponent teamId
                const opponentTeamId = stat.teamId === matchDB.homeTeamId ? matchDB.awayTeamId : matchDB.homeTeamId;
                // Find opponent team stats (shotsOnTarget)
                let teamShotsOnTargetConceded = 0;
                if (mergedTeamStats && mergedTeamStats.home && mergedTeamStats.away) {
                    if (stat.teamId === matchDB.homeTeamId) {
                        teamShotsOnTargetConceded = mergedTeamStats.away.shotsOnTarget || 0;
                    } else {
                        teamShotsOnTargetConceded = mergedTeamStats.home.shotsOnTarget || 0;
                    }
                }
                // Goals conceded
                let goalsConceded = 0;
                if (stat.teamId === matchDB.homeTeamId) {
                    goalsConceded = finalAwayScore;
                } else {
                    goalsConceded = finalHomeScore;
                }
                expGain = calculateMatchExp({
                    playerId: stat.playerId,
                    minutes: stat.minutes,
                    rating: stat.rating,
                    goals: stat.goals,
                    assists: stat.assists,
                    yellowCards: stat.yellowCards,
                    redCards: stat.redCards,
                    position: player.naturalPosition,
                    cleanSheet: cleanSheet,
                    isMotm: isMotm,
                    saves: typeof stat.saves === 'number' ? stat.saves : undefined,
                    teamShotsOnTargetConceded,
                    goalsConceded
                });
            } else {
                expGain = calculateMatchExp({
                    playerId: stat.playerId,
                    minutes: stat.minutes,
                    rating: stat.rating,
                    goals: stat.goals,
                    assists: stat.assists,
                    yellowCards: stat.yellowCards,
                    redCards: stat.redCards,
                    position: player.naturalPosition,
                    cleanSheet: cleanSheet,
                    isMotm: isMotm
                });
            }
            
                // Apply age-efficiency to match EXP and round to integer for persisted Int field
                const adjustedGain = applyAgeEfficiency(expGain.totalGain, player.age);
                const gainToApply = Math.min(MATCH_EXP_GAIN_CAP, Math.round(adjustedGain));
                const currentExp = player.exp || 0;
                const newExp = currentExp + gainToApply;

            if ((stat.minutes || 0) > 0) {
                playedPlayerIds.add(stat.playerId);
                if (!playedExpGainByTeam[stat.teamId]) playedExpGainByTeam[stat.teamId] = [];
                playedExpGainByTeam[stat.teamId].push(gainToApply);
            }

            const currentYellowAccumulation = player.yellowCardAccumulation || 0;
            const updatedYellowAccumulationRaw = currentYellowAccumulation + (stat.yellowCards || 0);
            const suspensionsFromYellow = Math.floor(updatedYellowAccumulationRaw / yellowSuspensionThreshold);
            const nextYellowAccumulation = updatedYellowAccumulationRaw % yellowSuspensionThreshold;

            const suspensionsFromRed = (stat.redCards || 0) > 0 ? RED_CARD_SUSPENSION_MATCHES : 0;
            const suspensionIncrement = suspensionsFromYellow + suspensionsFromRed;

            let injuryWeeksToApply = player.injuryWeeksRemaining || 0;
            let injurySeverityToApply: 'MINOR' | 'MODERATE' | 'MAJOR' | null = null;
            if ((player.injuryWeeksRemaining || 0) <= 0) {
                const injuryResult = rollInjuryForMatch(
                    { stamina: player.stamina, strength: player.strength },
                    stat
                );
                if (injuryResult) {
                    injuryWeeksToApply = injuryResult.weeks;
                    injurySeverityToApply = injuryResult.severity;

                    postPlayerEvents.push({
                        minute: Math.min(90, Math.max(1, stat.minutes || 1)),
                        type: 'INJURY',
                        text: `${stat.name} suffered a ${injuryResult.severity.toLowerCase()} injury and will miss ${injuryResult.weeks} week(s).`,
                        teamId: stat.teamId,
                        playerId: stat.playerId
                    });
                }
            }
            
            // Update player stats including EXP
            playerUpdatePromises.push((tx.player as any).update({
                where: { id: stat.playerId },
                data: {
                    goals: { increment: stat.goals },
                    assists: { increment: stat.assists },
                    apps: { increment: stat.minutes > 0 ? 1 : 0 },
                    yellowCards: { increment: stat.yellowCards },
                    redCards: { increment: stat.redCards },
                    condition: stat.fitnessEnd,
                    passesAttempted: { increment: stat.passesAttempted },
                    passesCompleted: { increment: stat.passesCompleted },
                    crossesAttempted: { increment: stat.crossesAttempted },
                    crossesCompleted: { increment: stat.crossesCompleted },
                    freeKicks: { increment: stat.freeKicks || 0 },
                    corners: { increment: stat.corners || 0 },
                    throws: { increment: stat.throws || 0 },
                    exp: newExp,
                    yellowCardAccumulation: nextYellowAccumulation,
                    suspensionMatchesRemaining: {
                        increment: suspensionIncrement
                    },
                    injuryWeeksRemaining: injuryWeeksToApply,
                    injurySeverity: injuryWeeksToApply > 0 ? (injurySeverityToApply || (player.injuryWeeksRemaining > 0 ? undefined : null)) : null
                }
            }));
        }

        await Promise.all(playerUpdatePromises);


        // 1) Non-playing veterans (>30 years old) lose EXP (decline phase)
        // 2) Youth (age < 25) in each team who did not play get EXP = min(exp gain > 0 in their team)
        const allMatchSquadPlayers = [...matchDB.homeTeam.players, ...matchDB.awayTeam.players];
        const availableNonPlayingPlayers = allMatchSquadPlayers.filter((p: any) => {
            return !playedPlayerIds.has(p.id) && !isUnavailablePlayer(p);
        });

        // Veteran decline
        const veteranNonPlayingIds = availableNonPlayingPlayers
            .filter((p: any) => (p.age || 0) > 30)
            .map((p: any) => p.id);
        if (veteranNonPlayingIds.length > 0) {
            await (tx.player as any).updateMany({
                where: { id: { in: veteranNonPlayingIds } },
                data: { exp: { decrement: 1 } }
            });
        }

        // Youth EXP for non-playing youth (age < 25) in both teams
        for (const teamId of [matchDB.homeTeamId, matchDB.awayTeamId]) {
            const playedGains = playedExpGainByTeam[teamId] || [];
            // Only consider exp > 0
            const minPlayedGain = playedGains.filter(x => x > 0).length > 0 ? Math.min(...playedGains.filter(x => x > 0)) : 0;
            if (minPlayedGain > 0) {
                const youthNonPlayingIds = availableNonPlayingPlayers
                    .filter((p: any) => p.teamId === teamId && (p.age || 0) < 25)
                    .map((p: any) => p.id);
                if (youthNonPlayingIds.length > 0) {
                    await (tx.player as any).updateMany({
                        where: { id: { in: youthNonPlayingIds } },
                        data: { exp: { increment: minPlayedGain } }
                    });
                }
            }
        }

        if (postPlayerEvents.length > 0) {
            await tx.matchEvent.createMany({
                data: postPlayerEvents.map((e) => ({
                    matchId,
                    minute: e.minute,
                    text: e.text,
                    type: e.type,
                    teamId: e.teamId,
                    playerId: e.playerId
                }))
            });
            result.events.push(...postPlayerEvents);
        }
    });

    return {
        ...result,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        wentToExtraTime: tieBreakResult.wentToExtraTime,
        wentToPenalties: tieBreakResult.wentToPenalties,
        penaltyHome: tieBreakResult.penaltyHome,
        penaltyAway: tieBreakResult.penaltyAway,
        teamStats: mergedTeamStats,
        homeTeamName: (matchDB as any).homeTeam.name,
        awayTeamName: (matchDB as any).awayTeam.name,
        motmPlayerId: (motm as any)?.playerId || null
    };
}

/**
 * Update player reputation and team reputation after match
 */
export async function processMatchFinancials(matchId: string) {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            playerStats: true,
            homeTeam: true,
            awayTeam: true
        }
    });

    if (!match || match.homeScore === null || match.awayScore === null) return null;

    // Determine match result
    const homeResult = match.homeScore > match.awayScore ? 'win' : match.homeScore === match.awayScore ? 'draw' : 'loss';
    const awayResult = match.awayScore > match.homeScore ? 'win' : match.homeScore === match.awayScore ? 'draw' : 'loss';

    // Matchday income model:
    // - League: Attendance depends on division and rank
    // - Cup: Special event! 90-100% attendance regardless of division (big match atmosphere)
    // - Home receives 100% of gate
    // - Away receives 50% * away-rank-ratio share of home gate
    
    const isCupMatch = match.competitionType === 'CUP';
    
    let homeRankInfo = { rank: 1, divisionLevel: 1 };
    let awayRankInfo = { rank: 1, divisionLevel: 1 };
    
    if (!isCupMatch) {
        [homeRankInfo, awayRankInfo] = await Promise.all([
            getTeamLeagueRank(match.homeTeamId, match.season),
            getTeamLeagueRank(match.awayTeamId, match.season)
        ]);
    }

    const ticketPrice = 20; // Standard ticket price for all matches
    
    let homeAttendanceRate: number;
    if (isCupMatch) {
        // Cup matches: Special event! 90-100% attendance (random within range)
        // Cup fever! Fans come out regardless of team's league position
        homeAttendanceRate = 0.90 + (Math.random() * 0.10); // 90-100%
    } else {
        // League matches: Normal attendance based on division and rank
        homeAttendanceRate = getRankRevenueRatio(homeRankInfo.rank, homeRankInfo.divisionLevel);
    }
    
    const homeGateRevenue = Math.round((match.homeTeam.stadiumCapacity || 50000) * homeAttendanceRate * ticketPrice);

    // Away team revenue share
    const awayRankRatio = isCupMatch 
        ? 0.90 + (Math.random() * 0.10) // Cup: Away fans also excited (90-100%)
        : getRankRevenueRatio(awayRankInfo.rank, awayRankInfo.divisionLevel);
    const awayRevenueShare = 0.5 * awayRankRatio;
    const awayGateRevenue = Math.round(homeGateRevenue * awayRevenueShare);

    await prisma.$transaction(async (tx) => {
        await tx.team.update({
            where: { id: match.homeTeamId },
            data: { balance: { increment: homeGateRevenue } }
        });

        await tx.team.update({
            where: { id: match.awayTeamId },
            data: { balance: { increment: awayGateRevenue } }
        });

        await tx.financialEvent.create({
            data: {
                teamId: match.homeTeamId,
                date: match.date,
                type: 'MATCHDAY',
                amount: homeGateRevenue,
                description: `Matchday home gate (${Math.round(homeAttendanceRate * 100)}% attendance, rank ${homeRankInfo.rank})`
            }
        });

        await tx.financialEvent.create({
            data: {
                teamId: match.awayTeamId,
                date: match.date,
                type: 'MATCHDAY',
                amount: awayGateRevenue,
                description: `Away share from matchday gate (${Math.round(awayRevenueShare * 100)}% of home gate, away rank ${awayRankInfo.rank})`
            }
        });
    });

    // Update player popularity for all players in the match (batched)
    if (match.playerStats.length > 0) {
        // Pre-fetch all players' current popularity + position in 1 query
        const playerIds = match.playerStats.map(s => s.playerId);
        const players = await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, popularity: true, naturalPosition: true }
        });
        const playerMap = new Map(players.map(p => [p.id, p]));

        const popularityUpdates: { id: string; popularity: number }[] = [];
        for (const stat of match.playerStats) {
            const player = playerMap.get(stat.playerId);
            if (!player) continue;

            const position = player.naturalPosition;
            const isGK = position === 'GK';
            const isDefender = ['DC', 'DR', 'DL'].includes(position);
            const isMidfield = ['MC', 'AMC', 'DMC', 'MR', 'ML'].includes(position);
            const isForward = position.startsWith('FW');

            let popularityChange = 0;
            if (stat.minutes > 0) popularityChange += 0.2;
            if (stat.rating >= 8) popularityChange += 0.5;
            else if (stat.rating >= 7) popularityChange += 0.3;

            if (isGK) {
                if (stat.saves) popularityChange += Math.min(0.5, Math.floor(stat.saves / 3) * 0.2);
            } else if (isDefender) {
                if (stat.tacklesWon) popularityChange += Math.min(0.5, Math.floor(stat.tacklesWon / 2) * 0.3);
            } else if (isForward || isMidfield) {
                if (stat.goals > 0) popularityChange += Math.min(1.0, stat.goals * 0.5);
                if (stat.assists > 0) popularityChange += Math.min(0.5, stat.assists * 0.5);
            }

            if (stat.id === match.motmPlayerId) popularityChange += 1.5;
            if (stat.rating < 4) popularityChange -= 1.0;
            if (stat.redCards > 0) popularityChange -= 2;
            if (player.popularity > 80) popularityChange *= 0.5;

            const newPopularity = Math.max(0, Math.min(100, player.popularity + popularityChange));
            if (newPopularity !== player.popularity) {
                popularityUpdates.push({ id: player.id, popularity: newPopularity });
            }
        }
        if (popularityUpdates.length > 0) {
            await prisma.$transaction(
                popularityUpdates.map(u => prisma.player.update({ where: { id: u.id }, data: { popularity: u.popularity } }))
            );
        }
    }

    // Update team reputation
    await updateTeamReputation(match.homeTeamId, homeResult);
    await updateTeamReputation(match.awayTeamId, awayResult);

    return {
        homeResult,
        awayResult,
        matchday: {
            homeRank: homeRankInfo.rank,
            awayRank: awayRankInfo.rank,
            homeAttendanceRate,
            homeGateRevenue,
            awayRevenueShare,
            awayGateRevenue
        }
    };
}
