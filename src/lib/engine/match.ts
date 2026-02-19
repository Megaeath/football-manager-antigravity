import { TeamState, MatchState, PlayerState, EnginePlayerMatchStats, TeamMatchStats } from './types';
import { calculateActionScore } from './formulas';

type ActionType = 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT';
type Intensity = 'LOW' | 'MEDIUM' | 'HIGH';

interface BallState {
    position: number; // 0-100 (0=home goal, 100=away goal)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
}

function calculateActionWeights(
    player: PlayerState,
    ballPosition: number,
    isAttacking: boolean
): Record<ActionType, number> {
    const distance = isAttacking ? 100 - ballPosition : ballPosition;
    const distanceToGoal = distance;

    const weights = {
        PASS_SHORT: player.attributes.passing * 0.5,
        PASS_LONG: (player.attributes.passing + player.attributes.vision) * 0.3,
        DRIBBLE: player.attributes.dribbling * 0.4,
        SHOOT: 0
    };

    // Increase shooting weight when close to goal
    if (distanceToGoal <= 30) {
        weights.SHOOT = player.attributes.shooting * 1.5;
    } else if (distanceToGoal <= 40) {
        weights.SHOOT = player.attributes.shooting * 0.5;
    }

    // Apply condition multiplier to all weights
    const conditionFactor = player.condition / 100;
    Object.keys(weights).forEach(key => {
        weights[key as ActionType] *= conditionFactor;
    });

    return weights;
}

function chooseAction(weights: Record<ActionType, number>): ActionType {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total === 0) return 'PASS_SHORT';

    const roll = Math.random() * total;
    let cumulative = 0;

    for (const [action, weight] of Object.entries(weights)) {
        cumulative += weight;
        if (roll <= cumulative) return action as ActionType;
    }

    return 'PASS_SHORT';
}

function getMentalityBuff(mentality: string) {
    switch (mentality) {
        case 'ALL_OUT_ATTACK':
            return { shooting: 1.1, dribble: 1.4, tackling: 0.8, save: 0.8, attackChance: 1.1, fatigue: 1.3 };
        case 'ATTACKING':
            return { shooting: 1.05, dribble: 1.2, tackling: 0.9, save: 0.9, attackChance: 1.05, fatigue: 1.2 };
        case 'ULTRA_DEFENSIVE':
            return { shooting: 1.2, dribble: 0.6, tackling: 1.4, save: 1.4, attackChance: 0.8, fatigue: 1.0 };
        case 'DEFENSIVE':
            return { shooting: 1.1, dribble: 0.8, tackling: 1.2, save: 1.2, attackChance: 0.9, fatigue: 1.0 };
        default:
            return { shooting: 1.0, dribble: 1.0, tackling: 1.0, save: 1.0, attackChance: 1.0, fatigue: 1.0 };
    }
}

function getDrainForIntensity(intensity: Intensity) {
    if (intensity === 'HIGH') return 0.22;
    if (intensity === 'MEDIUM') return 0.12;
    return 0.06;
}

function applyActionDrain(player: PlayerState, intensity: Intensity, fatigueMultiplier: number) {
    const base = getDrainForIntensity(intensity) * fatigueMultiplier;
    const staminaFactor = Math.max(0.7, 1 - (player.attributes.stamina - 10) * 0.02);
    const drain = base * staminaFactor;
    player.condition = Math.max(0, player.condition - drain);
}

function executePassShort(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;

    stats.passesAttempted++;
    teamStats.passesAttempted++;

    const passScore = calculateActionScore('short_pass', player.attributes, 'attacker', player.condition);
    const defenseScore = Math.random() * 10;

    const skillBonus = player.attributes.passing > 15 ? 1.15 : 1.0;
    const success = (passScore * skillBonus) > defenseScore;

    if (success) {
        stats.passesCompleted++;
        teamStats.passesCompleted++;
        const movement = 2 + Math.random() * 3; // +2 to +5
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + movement)
            : Math.max(0, ball.position - movement);
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed pass - possession changes
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = getRandomPlayer(defendingTeam, ['MC', 'DMC', 'AMC', 'DC']) || null;
    }

    applyActionDrain(player, 'LOW', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
}

function executePassLong(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;

    stats.passesAttempted++;
    teamStats.passesAttempted++;

    const passScore = calculateActionScore('long_pass', player.attributes, 'attacker', player.condition);
    const defenseScore = Math.random() * 15;

    const skillBonus = (player.attributes.passing > 15 && player.attributes.vision > 15) ? 1.2 : 1.0;
    const success = (passScore * skillBonus) > defenseScore;

    const movement = 10 + Math.random() * 10; // +10 to +20
    const targetPosition = isHomeAttacking
        ? Math.min(100, ball.position + movement)
        : Math.max(0, ball.position - movement);

    if (success) {
        stats.passesCompleted++;
        teamStats.passesCompleted++;
        ball.position = targetPosition;
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed long pass - possession changes at target position
        ball.position = targetPosition;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = getRandomPlayer(defendingTeam, ['MC', 'DMC', 'AMC', 'FWC']) || null;
    }

    applyActionDrain(player, 'LOW', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
}

function executeDribble(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const defender = getRandomPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL']);

    if (!defender) return;

    stats.dribblesAttempted++;
    matchState.playerStats[defender.id].tacklesAttempted++;

    const dribbleScore = calculateActionScore('dribble', player.attributes, 'attacker', player.condition) 
        * getMentalityBuff(attackingTeam.tactics.mentality).dribble;
    const tackleScore = calculateActionScore('dribble', defender.attributes, 'defender', defender.condition) 
        * getMentalityBuff(defendingTeam.tactics.mentality).tackling;

    const skillBonus = player.attributes.dribbling > 15 ? 1.15 : 1.0;
    const success = (dribbleScore * skillBonus * (0.8 + Math.random() * 0.4)) > (tackleScore * (0.8 + Math.random() * 0.4));

    if (success) {
        stats.dribblesWon++;
        const movement = 3 + Math.random() * 5; // +3 to +8
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + movement)
            : Math.max(0, ball.position - movement);
        // Keep same carrier after dribble (they beat the defender)
        // No reassignment needed
    } else {
        matchState.playerStats[defender.id].tacklesWon++;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = defender;
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(defender, 'MEDIUM', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);
}

function executeShoot(
    ball: BallState,
    player: PlayerState,
    minute: number,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean,
    homeTeam: TeamState,
    awayTeam: TeamState
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;

    stats.shots++;
    teamStats.shots++;

    // Find goalkeeper
    const gk = defendingTeam.players.find(p => p.position === 'GK' && p.tacticalPosition === 'GK') 
        || defendingTeam.players.find(p => p.position === 'GK') 
        || defendingTeam.players[0];

    // Calculate distance to goal
    const distanceToGoal = isHomeAttacking ? 100 - ball.position : ball.position;
    const positionFactor = Math.max(0.3, (100 - distanceToGoal) / 100);

    // Shooting effectiveness decreases with distance
    const shootScore = calculateActionScore('shoot', player.attributes, 'attacker', player.condition) 
        * getMentalityBuff(attackingTeam.tactics.mentality).shooting 
        * positionFactor;

    // GK save effectiveness increases with distance (easier saves from far)
    const saveEffectiveness = distanceToGoal < 20 ? 0.7 : (distanceToGoal < 10 ? 0.5 : 1.0);
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition) 
        * getMentalityBuff(defendingTeam.tactics.mentality).save 
        * saveEffectiveness;

    // Apply variance
    const variance = minute >= 80 ? 0.35 : 0.2;
    let finalShoot = shootScore * (1 - variance / 2 + Math.random() * variance);
    let finalSave = saveScore * (1 - variance / 2 + Math.random() * variance);

    // Miracle/blunder chances
    const miracleChance = minute >= 80 ? 0.03 : 0.02;
    const blunderChance = minute >= 80 ? 0.03 : 0.02;
    const miracle = Math.random() < miracleChance;
    const blunder = Math.random() < blunderChance;

    if (blunder) {
        finalSave *= 0.4;
    }

    if (miracle) {
        finalSave = Math.max(0.1, finalSave);
        if (finalShoot <= finalSave) {
            finalShoot = finalSave * 1.6 + 0.01;
        }
    }

    if (finalShoot > finalSave) {
        // GOAL!
        stats.goals++;
        stats.shotsOnTarget++;
        teamStats.shotsOnTarget++;

        matchState.events.push({
            minute,
            type: 'GOAL',
            text: miracle 
                ? `MIRACLE GOAL! ${player.name} scores from ${distanceToGoal.toFixed(0)}m out!`
                : `GOAL! ${player.name} scores with a clinical finish from ${distanceToGoal.toFixed(0)}m!`,
            teamId: attackingTeam.id,
            playerId: player.id
        });

        // Potential assist
        if (Math.random() > 0.4) {
            const assistPlayer = getRandomPlayer(attackingTeam, ['MC', 'AMC', 'MR', 'ML', 'AMR', 'AML']);
            if (assistPlayer && assistPlayer.id !== player.id) {
                matchState.playerStats[assistPlayer.id].assists++;
            }
        }

        // Reset ball to center, kick-off from non-GK
        ball.position = 50;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        const kickoffTeam = ball.possession === 'home' ? homeTeam : awayTeam;
        const kickoffIsHomeAttacking = ball.possession === 'home';
        ball.carrier = getCarrierByPosition(kickoffTeam, 50, kickoffIsHomeAttacking);
    } else {
        // Save or miss
        const isOnTarget = Math.random() > 0.4;

        if (isOnTarget) {
            matchState.playerStats[gk.id].saves++;
            stats.shotsOnTarget++;
            teamStats.shotsOnTarget++;
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${player.name} shoots from ${distanceToGoal.toFixed(0)}m... but ${gk.name} makes the save!`,
                teamId: attackingTeam.id,
                playerId: player.id
            });
        } else {
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${player.name} shoots wide from ${distanceToGoal.toFixed(0)}m!`,
                teamId: attackingTeam.id,
                playerId: player.id
            });
        }

        // GK distributes to defender immediately (goal kick / distribution)
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        const defender = getRandomPlayer(defendingTeam, ['DC', 'DR', 'DL', 'DMC']) || defendingTeam.players[1]; // Avoid GK at index 0
        ball.carrier = defender;
        ball.position = isHomeAttacking ? 10 : 90; // Slightly further up field
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(gk, 'LOW', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);
}

function checkDefensiveInterruption(
    ball: BallState,
    defendingTeam: TeamState
): boolean {
    const defenderPool = defendingTeam.players.filter(p => p.tacticalPosition !== null);
    if (defenderPool.length === 0) return false;

    // Calculate average defensive capability
    const avgTackling = defenderPool.reduce((sum, p) => sum + p.attributes.tackling, 0) / defenderPool.length;
    const avgPositioning = defenderPool.reduce((sum, p) => sum + p.attributes.positioning, 0) / defenderPool.length;

    // Base intercept chance around 8% per tick
    const interruptChance = ((avgTackling + avgPositioning) / 40) * 0.08;

    if (Math.random() < interruptChance) {
        // Interception! Pick a random defender
        const interceptor = defenderPool[Math.floor(Math.random() * defenderPool.length)];
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = interceptor;
        return true;
    }

    return false;
}

function initializePlayerStats(team: TeamState): Record<string, EnginePlayerMatchStats> {
    const stats: Record<string, EnginePlayerMatchStats> = {};
    team.players.forEach(p => {
        stats[p.id] = {
            playerId: p.id,
            name: p.name,
            teamId: team.id,
            position: p.position,
            rating: 6.0,
            minutes: 0,
            goals: 0,
            assists: 0,
            saves: 0,
            passesAttempted: 0,
            passesCompleted: 0,
            crossesAttempted: 0,
            crossesCompleted: 0,
            shots: 0,
            shotsOnTarget: 0,
            tacklesAttempted: 0,
            tacklesWon: 0,
            dribblesAttempted: 0,
            dribblesWon: 0,
            fitnessEnd: 100,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            offsides: 0
        };
    });
    return stats;
}

function initTeamStats(): TeamMatchStats {
    return {
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
        crossesCompleted: 0
    };
}

export function simulateMatch(homeTeam: TeamState, awayTeam: TeamState): MatchState {
    const matchState: MatchState = {
        minute: 0,
        homeScore: 0,
        awayScore: 0,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        teamStats: { home: initTeamStats(), away: initTeamStats() },
        events: [],
        isFinished: false,
        playerStats: {
            ...initializePlayerStats(homeTeam),
            ...initializePlayerStats(awayTeam)
        }
    };

    // Set 90 minutes for starters
    [...homeTeam.players, ...awayTeam.players].forEach(p => {
        if (p.tacticalPosition !== null) {
            matchState.playerStats[p.id].minutes = 90;
        }
    });

    // Initialize ball state
    const ball: BallState = {
        position: 50,
        possession: 'home',
        carrier: null
    };

    let homeSubsUsed = 0;
    let awaySubsUsed = 0;
    const maxSubs = 5;

    // BALL PROGRESSION SYSTEM: 90 minutes, 3 ticks per minute = 270 game ticks
    for (let minute = 1; minute <= 90; minute++) {
        matchState.minute = minute;

        const ticksPerMinute = 3;
        for (let tick = 0; tick < ticksPerMinute; tick++) {
            const isHomeAttacking = ball.possession === 'home';
            const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
            const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;

            // Assign carrier based on ball position (never GK)
            if (!ball.carrier) {
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
            }

            // Skip if carrier is somehow still GK (safety check)
            if (ball.carrier && ball.carrier.position === 'GK') {
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
            }

            // Check for defensive interruption (interception)
            if (checkDefensiveInterruption(ball, defendingTeam)) {
                continue; // Possession changed, skip this tick
            }

            // AI chooses action based on player attributes and ball position
            const weights = calculateActionWeights(ball.carrier, ball.position, isHomeAttacking);
            const action = chooseAction(weights);

            // Execute the chosen action
            switch (action) {
                case 'PASS_SHORT':
                    executePassShort(ball, ball.carrier, matchState, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'PASS_LONG':
                    executePassLong(ball, ball.carrier, matchState, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'DRIBBLE':
                    executeDribble(ball, ball.carrier, matchState, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'SHOOT':
                    executeShoot(ball, ball.carrier, minute, matchState, attackingTeam, defendingTeam, isHomeAttacking, homeTeam, awayTeam);
                    break;
            }

            // Clamp ball position to field boundaries
            if (ball.possession === 'home' && ball.position >= 100) {
                ball.position = 100;
            } else if (ball.possession === 'away' && ball.position <= 0) {
                ball.position = 0;
            }
        }

        updateFitness(homeTeam);
        updateFitness(awayTeam);

        homeSubsUsed = attemptSubstitutions(homeTeam, matchState, minute, ball, homeSubsUsed, maxSubs);
        awaySubsUsed = attemptSubstitutions(awayTeam, matchState, minute, ball, awaySubsUsed, maxSubs);
    }

    // Capture end-of-match fitness for all players
    [...homeTeam.players, ...awayTeam.players].forEach(p => {
        if (matchState.playerStats[p.id]) {
            matchState.playerStats[p.id].fitnessEnd = Math.round(p.condition);
        }
    });

    // Recalculate score from player goals to avoid mismatches
    const goalTotals = Object.values(matchState.playerStats).reduce(
        (acc, stat) => {
            if (stat.teamId === matchState.homeTeamId) acc.home += stat.goals;
            if (stat.teamId === matchState.awayTeamId) acc.away += stat.goals;
            return acc;
        },
        { home: 0, away: 0 }
    );
    matchState.homeScore = goalTotals.home;
    matchState.awayScore = goalTotals.away;

    // Calculate final possession % estimate based on successful passes
    matchState.teamStats.home.possession = 50 + Math.floor(Math.random() * 10 - 5);
    matchState.teamStats.away.possession = 100 - matchState.teamStats.home.possession;

    // Finalize Ratings
    calculateRatings(matchState);

    matchState.isFinished = true;
    return matchState;
}

function getCarrierByPosition(team: TeamState, ballPosition: number, isAttacking: boolean): PlayerState {
    // Calculate which zone the ball is in relative to attacking direction
    const effectivePosition = isAttacking ? ballPosition : (100 - ballPosition);
    
    let positionWeights: { positions: string[], weight: number }[] = [];
    
    if (effectivePosition < 35) {
        // Defensive third - defenders dominate
        positionWeights = [
            { positions: ['DC', 'DR', 'DL', 'DMC'], weight: 60 },
            { positions: ['MC', 'MR', 'ML'], weight: 30 },
            { positions: ['AMC', 'AMR', 'AML'], weight: 8 },
            { positions: ['FWC', 'FWR', 'FWL'], weight: 2 }
        ];
    } else if (effectivePosition < 70) {
        // Middle third - midfielders dominate
        positionWeights = [
            { positions: ['MC', 'MR', 'ML', 'DMC', 'AMC'], weight: 65 },
            { positions: ['AMR', 'AML'], weight: 20 },
            { positions: ['DC', 'DR', 'DL'], weight: 10 },
            { positions: ['FWC', 'FWR', 'FWL'], weight: 5 }
        ];
    } else {
        // Attacking third - forwards dominate but defenders can join attack
        positionWeights = [
            { positions: ['FWC', 'FWR', 'FWL', 'AMC', 'AMR', 'AML'], weight: 70 },
            { positions: ['MC', 'MR', 'ML'], weight: 20 },
            { positions: ['DMC'], weight: 7 },
            { positions: ['DC', 'DR', 'DL'], weight: 3 }
        ];
    }
    
    // Build weighted candidate list
    const weightedCandidates: { player: PlayerState, weight: number }[] = [];
    
    for (const group of positionWeights) {
        const candidates = team.players.filter(p => 
            group.positions.includes(p.position) && 
            p.tacticalPosition !== null &&
            p.position !== 'GK'
        );
        
        for (const player of candidates) {
            weightedCandidates.push({ player, weight: group.weight });
        }
    }
    
    if (weightedCandidates.length === 0) {
        // Fallback to any non-GK player
        return team.players.find(p => p.position !== 'GK') || team.players[1];
    }
    
    // Weighted random selection
    const totalWeight = weightedCandidates.reduce((sum, c) => sum + c.weight, 0);
    const roll = Math.random() * totalWeight;
    
    let cumulative = 0;
    for (const candidate of weightedCandidates) {
        cumulative += candidate.weight;
        if (roll <= cumulative) {
            return candidate.player;
        }
    }
    
    return weightedCandidates[0].player;
}

function getRandomPlayer(team: TeamState, positions: string[]): PlayerState | undefined {
    const candidates = team.players.filter(p => positions.includes(p.position));

    // 2. Filter by Tactical Position (Prioritize Playing 11)
    const starters = candidates.filter(p => p.tacticalPosition !== null);

    if (starters.length > 0) {
        if (Math.random() < 0.95) { // Higher chance for tactical players
            return starters[Math.floor(Math.random() * starters.length)];
        }
    }

    // Fallback
    if (candidates.length === 0) return team.players[Math.floor(Math.random() * team.players.length)];
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function updateFitness(team: TeamState) {
    team.players.forEach(p => {
        if (p.tacticalPosition !== null) {
            const baseDrain = 0.4;
            const staminaFactor = Math.max(0.7, 1 - (p.attributes.stamina - 10) * 0.02);
            const drain = baseDrain * staminaFactor * getMentalityBuff(team.tactics.mentality).fatigue;
            p.condition = Math.max(0, p.condition - drain);
        }
    });
}

function performSubstitution(
    team: TeamState,
    matchState: MatchState,
    minute: number,
    ball: BallState,
    outPlayer: PlayerState,
    inPlayer: PlayerState
) {
    const outSlot = outPlayer.tacticalPosition;
    outPlayer.tacticalPosition = null;
    inPlayer.tacticalPosition = outSlot;

    if (matchState.playerStats[outPlayer.id]) {
        matchState.playerStats[outPlayer.id].minutes = Math.min(matchState.playerStats[outPlayer.id].minutes, minute);
    }
    if (matchState.playerStats[inPlayer.id]) {
        matchState.playerStats[inPlayer.id].minutes = Math.max(matchState.playerStats[inPlayer.id].minutes, 90 - minute);
    }

    if (ball.carrier?.id === outPlayer.id) {
        ball.carrier = inPlayer;
    }

    matchState.events.push({
        minute,
        type: 'SUB',
        text: `Substitution: ${outPlayer.name} off, ${inPlayer.name} on.`,
        teamId: team.id,
        playerId: inPlayer.id
    });
}

function attemptSubstitutions(
    team: TeamState,
    matchState: MatchState,
    minute: number,
    ball: BallState,
    subsUsed: number,
    maxSubs: number
): number {
    if (subsUsed >= maxSubs) return subsUsed;
    if (minute < 55) return subsUsed;

    const starters = team.players.filter(p => p.tacticalPosition !== null && p.position !== 'GK');
    const availableBench = team.players.filter(p => p.tacticalPosition === null && p.position !== 'GK');
    if (availableBench.length === 0) return subsUsed;

    const tiredStarters = starters
        .filter(p => p.condition < 70)
        .sort((a, b) => a.condition - b.condition);

    const getPositionGroup = (pos: string) => {
        if (pos === 'GK') return 'GK';
        if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos)) return 'DEF';
        if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos)) return 'MID';
        if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos)) return 'FWD';
        return 'MID';
    };

    for (const outPlayer of tiredStarters) {
        if (subsUsed >= maxSubs) break;
        const slotBase = outPlayer.tacticalPosition ? outPlayer.tacticalPosition.split('_')[0] : outPlayer.position;
        const outGroup = getPositionGroup(slotBase);

        const samePosition = availableBench.filter(p => p.position === slotBase);
        const sameGroup = availableBench.filter(p => getPositionGroup(p.position) === outGroup);
        const midGroup = availableBench.filter(p => getPositionGroup(p.position) === 'MID');

        const pickBest = (list: PlayerState[]) => list.sort((a, b) => b.condition - a.condition)[0];

        let bestBench = pickBest(samePosition);
        if (!bestBench) bestBench = pickBest(sameGroup);
        if (!bestBench && (outGroup === 'DEF' || outGroup === 'FWD')) bestBench = pickBest(midGroup);
        if (!bestBench) bestBench = pickBest(availableBench);

        if (!bestBench) continue;

        performSubstitution(team, matchState, minute, ball, outPlayer, bestBench);
        subsUsed += 1;

        const removeIdx = availableBench.findIndex(p => p.id === bestBench.id);
        if (removeIdx >= 0) {
            availableBench.splice(removeIdx, 1);
        }
    }

    return subsUsed;
}

function calculateRatings(matchState: MatchState) {
    Object.values(matchState.playerStats).forEach(stat => {
        let rating = 6.0;

        rating += (stat.goals * 1.2);
        rating += (stat.assists * 0.7);
        rating += (stat.saves * 0.3);
        rating += (stat.tacklesWon * 0.3);
        rating += (stat.passesCompleted * 0.05);
        rating += (stat.dribblesWon * 0.2);

        rating -= ((stat.shots - stat.shotsOnTarget) * 0.1);
        rating -= ((stat.tacklesAttempted - stat.tacklesWon) * 0.1);
        rating -= (stat.yellowCards * 0.5);
        rating -= (stat.redCards * 2.0);
        rating -= (stat.fouls * 0.1);

        stat.rating = Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
    });
}
