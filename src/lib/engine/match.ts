import { TeamState, MatchState, MatchEventLog, PlayerState, EnginePlayerMatchStats, TeamMatchStats } from './types';
import { calculateActionScore } from './formulas';

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

    let currentPossession: 'home' | 'away' = 'home';

    for (let minute = 1; minute <= 90; minute++) {
        matchState.minute = minute;

        // TACTICS: Mentality affects possession/defense
        let homePossessionBonus = 0;
        if (homeTeam.tactics.mentality === 'ULTRA_DEFENSIVE') homePossessionBonus -= 10;
        if (homeTeam.tactics.mentality === 'DEFENSIVE') homePossessionBonus -= 5;
        if (homeTeam.tactics.mentality === 'ATTACKING') homePossessionBonus += 5;
        if (homeTeam.tactics.mentality === 'ALL_OUT_ATTACK') homePossessionBonus += 10;

        // Possesion Battle
        const possessionRoll = Math.random() * 100 + homePossessionBonus;
        currentPossession = possessionRoll > 50 ? 'home' : 'away';

        const attackingTeam = currentPossession === 'home' ? homeTeam : awayTeam;
        const defendingTeam = currentPossession === 'home' ? awayTeam : homeTeam;
        const isHomeAttacking = currentPossession === 'home';
        const attackingStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
        const defendingStats = isHomeAttacking ? matchState.teamStats.away : matchState.teamStats.home;

        // Background Stats (Passes/Tackles that happenทุกนาที)
        resolveBackgroundStats(attackingTeam, defendingTeam, matchState, attackingStats, defendingStats);

        const actionRoll = Math.random() * 100;

        // Foul / Card Chance (influenced by tackling style)
        let foulThreshold = 5;
        if (defendingTeam.tactics.tackling === 'HARD') foulThreshold = 8;
        if (defendingTeam.tactics.tackling === 'SOFT') foulThreshold = 2;

        // 85+ Shooting
        if (actionRoll > 85) {
            resolveShootingChance(minute, attackingTeam, defendingTeam, matchState, isHomeAttacking, attackingStats, defendingStats);
        }
        // 75-85 Set Piece Opportunity
        else if (actionRoll > 75) {
            resolveSetPiece(minute, attackingTeam, defendingTeam, matchState, isHomeAttacking, attackingStats, defendingStats, 'FREE_KICK');
        }
        // 55-75 Build Up
        else if (actionRoll > 55) {
            resolveBuildUp(minute, attackingTeam, defendingTeam, matchState, attackingStats, defendingStats);
        }
        else if (actionRoll < foulThreshold) {
            resolveFoul(minute, attackingTeam, defendingTeam, matchState, attackingStats, defendingStats);
        }

        updateFitness(homeTeam);
        updateFitness(awayTeam);
    }

    // Calculate final possession % estimate based on successful passes? 
    // or just randomize it around 50 +/- 10 for display since we didn't track it minute by minute strictly
    matchState.teamStats.home.possession = 50 + Math.floor(Math.random() * 10 - 5);
    matchState.teamStats.away.possession = 100 - matchState.teamStats.home.possession;

    // Finalize Ratings
    calculateRatings(matchState);

    matchState.isFinished = true;
    return matchState;
}

function resolveFoul(minute: number, attackerTeam: TeamState, defenderTeam: TeamState, matchState: MatchState, attStats: TeamMatchStats, defStats: TeamMatchStats) {
    const defender = getRandomPlayer(defenderTeam, ['DC', 'DMC', 'MC', 'DR', 'DL']);
    const attacker = getRandomPlayer(attackerTeam, ['FWC', 'AMC', 'MC', 'AMR', 'AML']); // fouled player

    if (defender && attacker) {
        matchState.playerStats[defender.id].fouls++;
        defStats.fouls++;

        const cardRoll = Math.random();
        if (cardRoll > 0.95) {
            // RED CARD
            matchState.playerStats[defender.id].redCards++;
            defStats.redCards++;
            matchState.events.push({
                minute, type: 'CARD_RED', text: `RED CARD! ${defender.name} makes a horror tackle!`, teamId: defenderTeam.id, playerId: defender.id
            });
        } else if (cardRoll > 0.7) {
            // YELLOW CARD
            matchState.playerStats[defender.id].yellowCards++;
            defStats.yellowCards++;
            matchState.events.push({
                minute, type: 'CARD_YELLOW', text: `Yellow Card for ${defender.name}.`, teamId: defenderTeam.id, playerId: defender.id
            });
        } else {
            // Just Foul
            matchState.events.push({
                minute, type: 'FOUL', text: `Foul by ${defender.name}.`, teamId: defenderTeam.id, playerId: defender.id
            });
        }
    }
}

function resolveBackgroundStats(attackerTeam: TeamState, defenderTeam: TeamState, matchState: MatchState, attStats: TeamMatchStats, defStats: TeamMatchStats) {
    // 1. PASSING VOLUME (Average 4-7 passes per minute for the team with possession)
    const passVolume = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < passVolume; i++) {
        // Distribute passes: Midfielders get more, then Defenders, then Forwards
        const roll = Math.random();
        let positionKey: string[] = ['MC', 'MR', 'ML', 'DMC', 'AMC']; // Midfield (60%)
        if (roll > 0.6) positionKey = ['DC', 'DR', 'DL']; // Defense (30%)
        if (roll > 0.9) positionKey = ['FWC', 'FWR', 'FWL']; // Attack (10%)

        const player = getRandomPlayer(attackerTeam, positionKey);
        if (player) {
            const prefersCrossing = ['MR', 'ML', 'AMR', 'AML', 'FWR', 'FWL', 'DR', 'DL'].includes(player.position) && Math.random() > 0.6;

            if (prefersCrossing) {
                matchState.playerStats[player.id].crossesAttempted++;
                attStats.crossesAttempted++;
                const crossChance = 0.6 + (player.attributes.crossing / 100) * 0.2;
                if (Math.random() < crossChance) {
                    matchState.playerStats[player.id].crossesCompleted++;
                    attStats.crossesCompleted++;
                }
            } else {
                matchState.playerStats[player.id].passesAttempted++;
                attStats.passesAttempted++;
                const successChance = 0.75 + (player.attributes.passing / 100) * 0.15;
                if (Math.random() < successChance) {
                    matchState.playerStats[player.id].passesCompleted++;
                    attStats.passesCompleted++;
                }
            }
        }
    }

    // 2. DEFENSIVE VOLUME (Tackling/Dribbling interactions)
    if (Math.random() > 0.4) {
        const defender = getRandomPlayer(defenderTeam, ['DC', 'DMC', 'MC', 'DR', 'DL']);
        const attackerIdx = Math.floor(Math.random() * attackerTeam.players.length);
        const attacker = attackerTeam.players[attackerIdx];

        if (defender && attacker && attacker.tacticalPosition !== null) {
            matchState.playerStats[attacker.id].dribblesAttempted++;
            matchState.playerStats[defender.id].tacklesAttempted++;

            const dribbleScore = calculateActionScore('dribble', attacker.attributes, 'attacker', attacker.condition);
            const tackleScore = calculateActionScore('dribble', defender.attributes, 'defender', defender.condition);

            if (tackleScore * (0.8 + Math.random() * 0.4) > dribbleScore * (0.8 + Math.random() * 0.4)) {
                matchState.playerStats[defender.id].tacklesWon++;
            } else {
                matchState.playerStats[attacker.id].dribblesWon++;
            }
        }
    }
}

function resolveBuildUp(minute: number, attackerTeam: TeamState, defenderTeam: TeamState, matchState: MatchState, attStats: TeamMatchStats, defStats: TeamMatchStats) {
    // Build up represents a dangerous transition or successful sequences
    const attacker = getRandomPlayer(attackerTeam, ['MC', 'MR', 'ML', 'AMC', 'AMR', 'AML']);
    if (!attacker) return;

    // Extra stats for the high-impact move
    matchState.playerStats[attacker.id].passesAttempted += 2;
    attStats.passesAttempted += 2;

    if (Math.random() > 0.3) {
        matchState.playerStats[attacker.id].passesCompleted += 2;
        attStats.passesCompleted += 2;
    }
}

function resolveShootingChance(minute: number, attackerTeam: TeamState, defenderTeam: TeamState, matchState: MatchState, isHomeAttacking: boolean, attStats: TeamMatchStats, defStats: TeamMatchStats) {

    const attacker = getRandomPlayer(attackerTeam, ['FWC', 'FWR', 'FWL', 'AMC', 'AML', 'AMR']); // Use helper
    const gk = defenderTeam.players.find(p => p.position === 'GK' && p.tacticalPosition === 'GK') ||
        defenderTeam.players.find(p => p.position === 'GK') ||
        defenderTeam.players[0];

    if (!attacker) return;

    // Offsides
    if (Math.random() > 0.95) {
        matchState.playerStats[attacker.id].offsides++;
        attStats.offsides++;
        matchState.events.push({
            minute, type: 'OFFSIDE', text: `Offside flag goes up against ${attacker.name}.`, teamId: attackerTeam.id, playerId: attacker.id
        });
        return;
    }

    // Corners
    if (Math.random() > 0.9) {
        resolveSetPiece(minute, attackerTeam, defenderTeam, matchState, isHomeAttacking, attStats, defStats, 'CORNER');
        return;
    }

    matchState.playerStats[attacker.id].shots++;
    attStats.shots++;

    // Shoot vs Save
    const shootScore = calculateActionScore('shoot', attacker.attributes, 'attacker', attacker.condition);
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition);
    console.log(`Shoot: ${shootScore}, Save: ${saveScore}`);
    const finalShoot = (shootScore * (0.9 + Math.random() * 0.2)) ;
    const finalSave = (saveScore * (0.9 + Math.random() * 0.2));
    console.log(`Final Shoot: ${finalShoot}, Final Save: ${finalSave}`);

    if (finalShoot > finalSave) {
        // GOAL
        matchState.events.push({
            minute,
            type: 'GOAL',
            text: `GOAL! ${attacker.name} scores with a clinical finish!`,
            teamId: attackerTeam.id,
            playerId: attacker.id
        });

        matchState.playerStats[attacker.id].shotsOnTarget++;
        matchState.playerStats[attacker.id].goals++;
        attStats.shotsOnTarget++;

        // Assist
        if (Math.random() > 0.3) {
            const assistPlayer = getRandomPlayer(attackerTeam, ['MC', 'MR', 'ML', 'AMC', 'AMR', 'AML', 'FWC']);
            if (assistPlayer && assistPlayer.id !== attacker.id) {
                matchState.playerStats[assistPlayer.id].assists++;
            }
        }

        if (isHomeAttacking) {
            matchState.homeScore++;
        } else {
            matchState.awayScore++;
        }
    } else {
        // MISS/SAVE
        const isOnTarget = Math.random() > 0.5;

        if (isOnTarget) {
            matchState.playerStats[gk.id].saves++;
            matchState.playerStats[attacker.id].shotsOnTarget++;
            attStats.shotsOnTarget++;
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${attacker.name} shoots... but ${gk.name} makes the save!`,
                teamId: attackerTeam.id,
                playerId: attacker.id
            });
        } else {
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${attacker.name} shoots wide!`,
                teamId: attackerTeam.id,
                playerId: attacker.id
            });
        }
    }
}

function resolveSetPiece(minute: number, attackerTeam: TeamState, defenderTeam: TeamState, matchState: MatchState, isHomeAttacking: boolean, attStats: TeamMatchStats, defStats: TeamMatchStats, type: 'CORNER' | 'FREE_KICK') {
    if (type === 'CORNER') attStats.corners++;

    // Find top 3 set piece takers in the playing 11
    const takers = attackerTeam.players
        .filter(p => p.tacticalPosition !== null)
        .sort((a, b) => b.attributes.setPieces - a.attributes.setPieces)
        .slice(0, 3);

    if (takers.length === 0) return;
    const taker = takers[Math.floor(Math.random() * takers.length)];

    const gk = defenderTeam.players.find(p => p.position === 'GK' && p.tacticalPosition === 'GK') || defenderTeam.players[0];

    // Determine Action: Shooting vs Passing (Short) vs Crossing (Long/Box)
    const shootingProb = taker.attributes.setPieces + taker.attributes.shooting;
    const passingProb = taker.attributes.setPieces + taker.attributes.passing;
    const crossingProb = taker.attributes.setPieces + taker.attributes.crossing;

    const total = shootingProb + passingProb + crossingProb;
    const roll = Math.random() * total;

    if (roll < shootingProb && type === 'FREE_KICK') {
        // Direct Shot
        matchState.playerStats[taker.id].shots++;
        attStats.shots++;

        const score = calculateActionScore('shoot', taker.attributes, 'attacker', taker.condition) + (taker.attributes.setPieces / 2);
        const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition);

        if (score > saveScore) {
            matchState.events.push({ minute, type: 'GOAL', text: `STUNNING! ${taker.name} scores directly from the free kick!`, teamId: attackerTeam.id, playerId: taker.id });
            matchState.playerStats[taker.id].goals++;
            matchState.playerStats[taker.id].shotsOnTarget++;
            attStats.shotsOnTarget++;
            if (isHomeAttacking) matchState.homeScore++; else matchState.awayScore++;
        } else {
            matchState.playerStats[gk.id].saves++;
            matchState.events.push({ minute, type: 'MISS', text: `${taker.name}'s set piece is saved by ${gk.name}!`, teamId: attackerTeam.id, playerId: taker.id });
        }
    } else if (roll < shootingProb + passingProb) {
        // Short Pass
        matchState.playerStats[taker.id].passesAttempted++;
        attStats.passesAttempted++;
        const receiver = getRandomPlayer(attackerTeam, ['MC', 'AMC', 'FWC', 'DC']);
        if (receiver && Math.random() < 0.8) {
            matchState.playerStats[taker.id].passesCompleted++;
            attStats.passesCompleted++;
            matchState.events.push({ minute, type: 'PASS', text: `${taker.name} plays a short ${type === 'CORNER' ? 'corner' : 'free kick'} to ${receiver.name}.`, teamId: attackerTeam.id, playerId: taker.id });
        }
    } else {
        // Cross / Long Ball into Box
        matchState.playerStats[taker.id].crossesAttempted++;
        attStats.crossesAttempted++;
        const target = getRandomPlayer(attackerTeam, ['FWC', 'DC', 'AMC']);
        if (target) {
            const crossSuccess = 0.4 + (taker.attributes.crossing / 100) * 0.3;
            if (Math.random() < crossSuccess) {
                matchState.playerStats[taker.id].crossesCompleted++;
                attStats.crossesCompleted++;

                // Header/Shot attempt from the cross
                const headingScore = target.attributes.heading + (target.attributes.strength / 2);
                const defScore = Math.random() * 30; // Random defender interference

                if (headingScore > defScore) {
                    matchState.playerStats[target.id].shots++;
                    matchState.playerStats[target.id].shotsOnTarget++;
                    attStats.shots++;
                    attStats.shotsOnTarget++;
                    matchState.playerStats[target.id].goals++;
                    matchState.playerStats[taker.id].assists++; // Assist from set piece
                    matchState.events.push({ minute, type: 'GOAL', text: `GOAL! ${target.name} heads home from ${taker.name}'s ${type.toLowerCase()}!`, teamId: attackerTeam.id, playerId: target.id });
                    if (isHomeAttacking) matchState.homeScore++; else matchState.awayScore++;
                } else {
                    matchState.events.push({ minute, type: 'MISS', text: `${taker.name} crosses into the box, but the defense clears it.`, teamId: attackerTeam.id, playerId: taker.id });
                }
            } else {
                matchState.events.push({ minute, type: 'MISS', text: `${taker.name}'s ${type.toLowerCase()} into the box is too long.`, teamId: attackerTeam.id, playerId: taker.id });
            }
        }
    }
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
            const baseDrain = 0.5;
            const staminaFactor = Math.max(0, (p.attributes.stamina - 10) * 0.02);
            const drain = baseDrain * (1 - staminaFactor);
            p.condition = Math.max(0, p.condition - drain);
        }
    });
}

function calculateRatings(matchState: MatchState) {
    Object.values(matchState.playerStats).forEach(stat => {
        let rating = 6.0;

        rating += (stat.goals * 1.2);      // Increased from 1.0
        rating += (stat.assists * 0.7);    // Increased from 0.5
        rating += (stat.saves * 0.3);      // Decreased from 0.5 (Re-balanced)
        rating += (stat.tacklesWon * 0.3);  // Increased from 0.2
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
