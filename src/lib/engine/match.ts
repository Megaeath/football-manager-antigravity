import { TeamState, MatchState, PlayerState, EnginePlayerMatchStats, TeamMatchStats, PlayerActionLog } from './types';
import { calculateActionScore } from './formulas';
import { getRoleEffects, getRoleConditionDrain } from './playerRoles';

type ActionType = 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT';
type Intensity = 'LOW' | 'MEDIUM' | 'HIGH';

interface BallState {
    position: number; // 0-100 (0=home goal, 100=away goal)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
}

function clampRate(rate: number): number {
    return Math.max(0, Math.min(1, rate));
}

function getZoneFromPosition(ballPosition: number, isAttacking: boolean): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
    const effectivePosition = isAttacking ? ballPosition : (100 - ballPosition);
    if (effectivePosition <= 30) return 'DEFENSIVE';
    if (effectivePosition <= 70) return 'MIDDLE';
    return 'ATTACKING';
}

function trackFieldTouch(stat: EnginePlayerMatchStats, zone: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING') {
    if (zone === 'DEFENSIVE') stat.defensiveThirdTouches++;
    else if (zone === 'MIDDLE') stat.middleThirdTouches++;
    else stat.attackingThirdTouches++;
}

function pushActionLog(matchState: MatchState, log: PlayerActionLog) {
    matchState.actionLogs.push(log);
}

function calculateActionWeights(
    player: PlayerState,
    ballPosition: number,
    isAttacking: boolean,
    teamTactics?: any
): Record<ActionType, number> {
    const distance = isAttacking ? 100 - ballPosition : ballPosition;
    const distanceToGoal = distance;

    // Get passing style buff
    const passingBuff = teamTactics ? getPassingStyleBuff(teamTactics.passing) : { shortPass: 1.0, longPass: 1.0 };
    const creativeBuff = teamTactics ? getCreativeFreedomBuff(teamTactics.creative_freedom) : { shooting: 1.0, dribble: 1.0, riskTaking: 1.0 };

    // Get player role effects
    const roleEffects = player.playerRole ? getRoleEffects(player.playerRole) : null;
    const roleModifiers = roleEffects?.actionModifiers || {};

    const weights = {
        PASS_SHORT: player.attributes.passing * 0.5 * passingBuff.shortPass * (roleModifiers.PASS_SHORT || 1.0),
        PASS_LONG: (player.attributes.passing + player.attributes.vision) * 0.3 * passingBuff.longPass * (roleModifiers.PASS_LONG || 1.0),
        DRIBBLE: player.attributes.dribbling * 0.4 * creativeBuff.dribble * (roleModifiers.DRIBBLE || 1.0),
        SHOOT: 0
    };

    // Shooting zones: 0-10 = penalty area (tightened), 10-25 = long shots (reduced), >25 = no shooting
    if (distanceToGoal <= 10) {
        // Penalty area only - full shooting weight
        weights.SHOOT = player.attributes.shooting * 1.0 * creativeBuff.shooting * (roleModifiers.SHOOT || 1.0);
    } else if (distanceToGoal <= 25) {
        // Long shot zone - much reduced weight
        weights.SHOOT = player.attributes.shooting * 0.2 * creativeBuff.shooting * (roleModifiers.SHOOT || 1.0);
    }
    // Beyond 25 yards: SHOOT weight stays at 0 (no shooting)

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
            return { shooting: 1.0, dribble: 1.5, tackling: 0.7, save: 1.0, attackChance: 1.5, fatigue: 1.3 };
        case 'ATTACKING':
            return { shooting: 1.0, dribble: 1.3, tackling: 0.8, save: 1., attackChance: 1.25, fatigue: 1.2 };
        case 'ULTRA_DEFENSIVE':
            return { shooting: 1.0, dribble: 0.7, tackling: 1.4, save: 1.3, attackChance: 0.8, fatigue: 1.3 };
        case 'DEFENSIVE':
            return { shooting: 1.0, dribble: 0.8, tackling: 1.2, save: 1.2, attackChance: 0.9, fatigue: 1.2 };
        default:
            return { shooting: 1.0, dribble: 1.0, tackling: 1.0, save: 1.0, attackChance: 1.0, fatigue: 1.0 };
    }
}

function getPassingStyleBuff(passing: string) {
    // Affects pass weight distribution and success rates
    switch (passing) {
        case 'SHORT':
            return { shortPass: 1.3, longPass: 0.7 };
        case 'LONG':
        case 'DIRECT':
            return { shortPass: 0.7, longPass: 1.3 };
        default: // MIXED
            return { shortPass: 1.0, longPass: 1.0 };
    }
}

function getTacklingBuff(tackling: string) {
    // Affects tackle success rate and foul probability
    switch (tackling) {
        case 'SOFT':
            return { tackle: 0.85, foul: 0.7 };
        case 'HARD':
            return { tackle: 1.15, foul: 1.3 };
        default: // NORMAL
            return { tackle: 1.0, foul: 1.0 };
    }
}

function getAttackingFocusBuff(attackingFocus: string, playerPosition: string) {
    // Returns weight modifier for position selection in attack
    // Supports both natural positions (e.g. FW) and tactical slots (e.g. FW_R)
    const normalized = (playerPosition || '').replace('_', '').toUpperCase();

    const centerSet = new Set(['MC', 'AMC', 'FWC', 'DMC', 'DC', 'FW']);
    const wingSet = new Set(['MR', 'ML', 'AMR', 'AML', 'FWR', 'FWL', 'DR', 'DL', 'DMR', 'DML']);

    const isCenter = centerSet.has(normalized);
    const isWing = wingSet.has(normalized);

    switch (attackingFocus) {
        case 'CENTER':
        case 'CENTRAL':
        case 'FORWARD':
            return isCenter ? 1.4 : (isWing ? 0.7 : 1.0);
        case 'WINGS':
        case 'LEFT':
        case 'RIGHT':
            return isWing ? 1.4 : (isCenter ? 0.7 : 1.0);
        default: // MIXED
            return 1.0;
    }
}

function getCreativeFreedomBuff(creativeFreeze: string) {
    // Affects how much player deviates from team tactical instructions
    // STRICT: Follows team plan closely, less individual action
    // NORMAL: Balanced between team plan and individual decision
    // FREEDOM: Prioritizes individual skill and decision-making
    switch (creativeFreeze) {
        case 'STRICT':
        case 'RESTRICTED':
            return { shooting: 0.85, dribble: 0.8, riskTaking: 0.7 };
        case 'FREEDOM':
        case 'MAXIMUM':
            return { shooting: 1.2, dribble: 1.2, riskTaking: 1.3 };
        default: // NORMAL
            return { shooting: 1.0, dribble: 1.0, riskTaking: 1.0 };
    }
}

function getActiveTacticByScore(team: TeamState, goalsFor: number, goalsAgainst: number) {
    if (!team.tacticalPlans) return team.tactics;
    if (goalsFor > goalsAgainst) return team.tacticalPlans.leading;
    if (goalsFor < goalsAgainst) return team.tacticalPlans.behind;
    return team.tacticalPlans.normal;
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
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);

    stats.passesAttempted++;
    teamStats.passesAttempted++;
    trackFieldTouch(stats, zone);

    const passScore = calculateActionScore('short_pass', player.attributes, 'attacker', player.condition);
    const defenseScore = Math.random() * 10; // Increased from 8 for more interceptions

    const skillBonus = player.attributes.passing > 15 ? 1.15 : 1.0;
    const success = (passScore * skillBonus) > defenseScore;
    const expectedSuccessRate = clampRate((passScore * skillBonus) / ((passScore * skillBonus) + defenseScore + 0.0001));

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_SHORT',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        metadata: JSON.stringify({ passScore, defenseScore, skillBonus })
    });

    if (success) {
        stats.passesCompleted++;
        teamStats.passesCompleted++;
        
        // 30% chance of backward/sideways pass when under pressure (realistic play)
        const isBackwardPass = Math.random() < 0.3;
        const movement = isBackwardPass 
            ? -(0.5 + Math.random() * 1.5) // -0.5 to -2 (backward)
            : (0.5 + Math.random() * 1.5); // +0.5 to +2 (forward)
        
        ball.position = isHomeAttacking
            ? Math.max(0, Math.min(100, ball.position + movement))
            : Math.max(0, Math.min(100, ball.position - movement));
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed pass - possession changes
        const interceptor = getRandomPlayer(defendingTeam, ['MC', 'DMC', 'AMC', 'DC']) || null;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = interceptor;

        if (interceptor) {
            const interceptorStats = matchState.playerStats[interceptor.id];
            const interceptionZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(interceptorStats, interceptionZone);
            pushActionLog(matchState, {
                playerId: interceptor.id,
                teamId: defendingTeam.id,
                minute: matchState.minute,
                ballPosition: Math.round(ball.position),
                zone: interceptionZone,
                actionType: 'INTERCEPTION',
                result: 'SUCCESS',
                isSuccessful: true,
                expectedSuccessRate: undefined,
                targetPlayerId: player.id,
                metadata: JSON.stringify({ sourceAction: 'PASS_SHORT' })
            });
        }
    }
    console.log(`Short pass executed. Success: ${success}, New Position: ${ball.position.toFixed(1)}`);

    // Potentially trigger throw-in on failure (simplified out of bounds)
    if (!success && Math.random() < 0.2) {
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + 2)
            : Math.max(0, ball.position - 2);
        executeThrowIn(ball, matchState, isHomeAttacking ? defendingTeam : attackingTeam, isHomeAttacking ? attackingTeam : defendingTeam, !isHomeAttacking);
        return;
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
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);

    stats.crossesAttempted++;
    teamStats.crossesAttempted++;
    trackFieldTouch(stats, zone);

    const passScore = calculateActionScore('long_pass', player.attributes, 'attacker', player.condition);
    const defenseScore = Math.random() * 14; // Increased from 12 for more interceptions

    const skillBonus = (player.attributes.passing > 15 && player.attributes.vision > 15) ? 1.2 : 1.0;
    const success = (passScore * skillBonus) > defenseScore;
    const expectedSuccessRate = clampRate((passScore * skillBonus) / ((passScore * skillBonus) + defenseScore + 0.0001));

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        metadata: JSON.stringify({ passScore, defenseScore, skillBonus })
    });

    const movement = 2 + Math.random() * 3; // +2 to +5 (further reduced to slow progression)
    const targetPosition = isHomeAttacking
        ? Math.min(100, ball.position + movement)
        : Math.max(0, ball.position - movement);

    if (success) {
        stats.crossesCompleted++;
        teamStats.crossesCompleted++;
        ball.position = targetPosition;
        // Reassign carrier based on new position
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking);
    } else {
        // Failed long pass - possession changes at target position
        ball.position = targetPosition;
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        const interceptor = getRandomPlayer(defendingTeam, ['MC', 'DMC', 'AMC', 'FWC']) || null;
        ball.carrier = interceptor;

        if (interceptor) {
            const interceptorStats = matchState.playerStats[interceptor.id];
            const interceptionZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(interceptorStats, interceptionZone);
            pushActionLog(matchState, {
                playerId: interceptor.id,
                teamId: defendingTeam.id,
                minute: matchState.minute,
                ballPosition: Math.round(ball.position),
                zone: interceptionZone,
                actionType: 'INTERCEPTION',
                result: 'SUCCESS',
                isSuccessful: true,
                targetPlayerId: player.id,
                metadata: JSON.stringify({ sourceAction: 'PASS_LONG' })
            });
        }
    }
    console.log(`Long pass executed. Success: ${success}, Target Position: ${targetPosition.toFixed(1)}`);
    applyActionDrain(player, 'LOW', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
}

function executeDribble(
    ball: BallState,
    player: PlayerState,
    matchState: MatchState,
    homeTeam: TeamState,
    awayTeam: TeamState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const defender = getRandomPlayer(defendingTeam, ['DC', 'DMC', 'MC', 'DR', 'DL']);

    if (!defender) return;

    const dribbleZone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, dribbleZone);

    stats.dribblesAttempted++;
    matchState.playerStats[defender.id].tacklesAttempted++;

    const dribbleScore = calculateActionScore('dribble', player.attributes, 'attacker', player.condition)
        * getMentalityBuff(attackingTeam.tactics.mentality).dribble;
    const tacklingBuff = getTacklingBuff(defendingTeam.tactics.tackling);
    const tackleScore = calculateActionScore('dribble', defender.attributes, 'defender', defender.condition)
        * getMentalityBuff(defendingTeam.tactics.mentality).tackling
        * tacklingBuff.tackle;

    const skillBonus = player.attributes.dribbling > 15 ? 1.15 : 1.0;
    const success = (dribbleScore * skillBonus * (0.8 + Math.random() * 0.4)) > (tackleScore * (0.8 + Math.random() * 0.4));
    const expectedSuccessRate = clampRate((dribbleScore * skillBonus) / ((dribbleScore * skillBonus) + tackleScore + 0.0001));

    pushActionLog(matchState, {
        playerId: player.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone: dribbleZone,
        actionType: 'DRIBBLE',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        expectedSuccessRate,
        targetPlayerId: defender.id,
        metadata: JSON.stringify({ dribbleScore, tackleScore })
    });

    if (success) {
        stats.dribblesWon++;
        const movement = 1 + Math.random() * 2; // +1 to +3 (further reduced for realism)
        ball.position = isHomeAttacking
            ? Math.min(100, ball.position + movement)
            : Math.max(0, ball.position - movement);
        // Keep same carrier after dribble (they beat the defender)
        // No reassignment needed
    } else {
        matchState.playerStats[defender.id].tacklesWon++;
        const defenderStats = matchState.playerStats[defender.id];
        const tackleZone = getZoneFromPosition(ball.position, !isHomeAttacking);
        trackFieldTouch(defenderStats, tackleZone);
        pushActionLog(matchState, {
            playerId: defender.id,
            teamId: defendingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: tackleZone,
            actionType: 'TACKLE',
            result: 'SUCCESS',
            isSuccessful: true,
            expectedSuccessRate: clampRate(tackleScore / (tackleScore + dribbleScore + 0.0001)),
            targetPlayerId: player.id,
            metadata: JSON.stringify({ dribbleScore, tackleScore })
        });
        ball.possession = ball.possession === 'home' ? 'away' : 'home';
        ball.carrier = defender;
        
        // Push ball backward on interception (realistic defensive action)
        const pushBack = 2 + Math.random() * 3; // -2 to -5 yards
        ball.position = isHomeAttacking
            ? Math.max(0, ball.position - pushBack)
            : Math.min(100, ball.position + pushBack);
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(defender, 'MEDIUM', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);

    // Potentially trigger foul/free kick
    if (!success && Math.random() < 0.15) {
        const foulChance = getTacklingBuff(defendingTeam.tactics.tackling).foul;
        if (Math.random() < 0.3 * foulChance) {
            matchState.playerStats[defender.id].fouls++;
            const foulZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            pushActionLog(matchState, {
                playerId: defender.id,
                teamId: defendingTeam.id,
                minute: matchState.minute,
                ballPosition: Math.round(ball.position),
                zone: foulZone,
                actionType: 'FOUL',
                result: 'FAIL',
                isSuccessful: false,
                targetPlayerId: player.id,
                metadata: JSON.stringify({ foulChance })
            });
            const isHomeFouled = !isHomeAttacking;
            const distanceToGoal = isHomeAttacking ? 100 - ball.position : ball.position;

            if (distanceToGoal < 25) {
                executeFreeKickShort(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
            } else {
                executeFreeKickLong(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
            }
        }
    }
}

function executeShoot(
    ball: BallState,
    player: PlayerState,
    minute: number,
    matchState: MatchState,
    homeTeam: TeamState,
    awayTeam: TeamState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    const stats = matchState.playerStats[player.id];
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
    const shootZone = getZoneFromPosition(ball.position, isHomeAttacking);

    stats.shots++;
    teamStats.shots++;
    trackFieldTouch(stats, shootZone);

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
    const saveEffectiveness = distanceToGoal < 20 ? 1.0 : (distanceToGoal < 10 ? 0.9 : 1.1);
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

        pushActionLog(matchState, {
            playerId: player.id,
            teamId: attackingTeam.id,
            minute,
            ballPosition: Math.round(ball.position),
            zone: shootZone,
            actionType: 'SHOOT',
            result: 'GOAL',
            isSuccessful: true,
            expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
            targetPlayerId: gk?.id,
            metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, miracle, blunder })
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
        const kickoffIsHomeAttacking = ball.possession === 'home';
        const kickoffTeam = kickoffIsHomeAttacking ? attackingTeam : defendingTeam;
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

            const gkStats = matchState.playerStats[gk.id];
            const saveZone = getZoneFromPosition(ball.position, !isHomeAttacking);
            trackFieldTouch(gkStats, saveZone);
            pushActionLog(matchState, {
                playerId: gk.id,
                teamId: defendingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: saveZone,
                actionType: 'SAVE',
                result: 'SUCCESS',
                isSuccessful: true,
                expectedSuccessRate: clampRate(finalSave / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: player.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave })
            });

            pushActionLog(matchState, {
                playerId: player.id,
                teamId: attackingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: shootZone,
                actionType: 'SHOOT',
                result: 'SAVED',
                isSuccessful: false,
                expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: gk.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, onTarget: true })
            });
        } else {
            matchState.events.push({
                minute,
                type: 'MISS',
                text: `${player.name} shoots wide from ${distanceToGoal.toFixed(0)}m!`,
                teamId: attackingTeam.id,
                playerId: player.id
            });

            pushActionLog(matchState, {
                playerId: player.id,
                teamId: attackingTeam.id,
                minute,
                ballPosition: Math.round(ball.position),
                zone: shootZone,
                actionType: 'SHOOT',
                result: 'OFF_TARGET',
                isSuccessful: false,
                expectedSuccessRate: clampRate(finalShoot / (finalShoot + finalSave + 0.0001)),
                targetPlayerId: gk?.id,
                metadata: JSON.stringify({ distanceToGoal, finalShoot, finalSave, onTarget: false })
            });
        }

        // GK distributes to defender immediately (goal kick / distribution)
        ball.possession = ball.possession === 'home' ? 'away' : 'home';

        // Corner kick chance on save (reduced from 30% to 15% for realism)
        if (isOnTarget && Math.random() < 0.15) {
            executeCornerKick(ball, matchState, homeTeam, awayTeam, isHomeAttacking);
            return;
        }

        const defender = getRandomPlayer(defendingTeam, ['DC', 'DR', 'DL', 'DMC']) || defendingTeam.players[1]; // Avoid GK at index 0
        ball.carrier = defender;
        ball.position = isHomeAttacking ? 10 : 90; // Slightly further up field
    }

    applyActionDrain(player, 'HIGH', getMentalityBuff(attackingTeam.tactics.mentality).fatigue);
    applyActionDrain(gk, 'LOW', getMentalityBuff(defendingTeam.tactics.mentality).fatigue);
}

function getSetPieceTaker(team: TeamState, type: 'SHORT_FK' | 'LONG_FK' | 'CORNER' | 'THROW'): PlayerState {
    const starters = team.players.filter(p => p.tacticalPosition !== null);

    if (type === 'THROW') {
        // Pick top 3 by throw attribute
        const takers = starters
            .map(p => ({ player: p, score: p.attributes.throw || 0 }))
            .sort((a, b) => b.score - a.score);
        const topCandidates = takers.slice(0, 3);
        return topCandidates[Math.floor(Math.random() * topCandidates.length)].player;
    }

    const takers = starters.map(p => {
        let score = 0;
        if (type === 'SHORT_FK') score = p.attributes.setPieces + p.attributes.shooting;
        else if (type === 'LONG_FK') score = p.attributes.setPieces + p.attributes.passing + p.attributes.crossing;
        else if (type === 'CORNER') score = p.attributes.setPieces + p.attributes.crossing;
        return { player: p, score };
    }).sort((a, b) => b.score - a.score);

    // Pick from top 3
    const topCandidates = takers.slice(0, 3);
    return topCandidates[Math.floor(Math.random() * topCandidates.length)].player;
}

function executeFreeKickShort(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'SHORT_FK');
    const stats = matchState.playerStats[taker.id];

    stats.freeKicks++;
    isHomeAttacking ? matchState.teamStats.home.freeKicks++ : matchState.teamStats.away.freeKicks++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    matchState.events.push({
        minute: matchState.minute,
        type: 'FREE_KICK',
        text: `Free kick in a dangerous position! ${taker.name} steps up...`,
        teamId: attackingTeam.id,
        playerId: taker.id
    });

    const gk = defendingTeam.players.find(p => p.position === 'GK') || defendingTeam.players[0];
    const shootScore = calculateActionScore('free_kick_short', taker.attributes, 'attacker', taker.condition);
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition);

    if (shootScore > saveScore * 1.1) {
        stats.goals++;
        stats.shots++;
        stats.shotsOnTarget++;
        isHomeAttacking ? matchState.homeScore++ : matchState.awayScore++;
        matchState.events.push({
            minute: matchState.minute,
            type: 'GOAL',
            text: `GOAL! ${taker.name} curls a magnificent free kick into the top corner!`,
            teamId: attackingTeam.id,
            playerId: taker.id
        });
        pushActionLog(matchState, {
            playerId: taker.id,
            teamId: attackingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone,
            actionType: 'SHOOT',
            result: 'GOAL',
            isSuccessful: true,
            expectedSuccessRate: clampRate(shootScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: gk.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        ball.position = 50;
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getCarrierByPosition(isHomeAttacking ? awayTeam : homeTeam, 50, !isHomeAttacking);
    } else {
        matchState.events.push({
            minute: matchState.minute,
            type: 'MISS',
            text: `${taker.name}'s free kick is saved by ${gk.name}!`,
            teamId: attackingTeam.id,
            playerId: taker.id
        });
        const gkStats = matchState.playerStats[gk.id];
        const saveZone = getZoneFromPosition(ball.position, !isHomeAttacking);
        trackFieldTouch(gkStats, saveZone);
        pushActionLog(matchState, {
            playerId: taker.id,
            teamId: attackingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone,
            actionType: 'SHOOT',
            result: 'SAVED',
            isSuccessful: false,
            expectedSuccessRate: clampRate(shootScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: gk.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        pushActionLog(matchState, {
            playerId: gk.id,
            teamId: defendingTeam.id,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: saveZone,
            actionType: 'SAVE',
            result: 'SUCCESS',
            isSuccessful: true,
            expectedSuccessRate: clampRate(saveScore / ((shootScore + saveScore) + 0.0001)),
            targetPlayerId: taker.id,
            metadata: JSON.stringify({ setPiece: 'SHORT_FK', shootScore, saveScore })
        });
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = gk;
        ball.position = isHomeAttacking ? 5 : 95;
    }
}

function executeFreeKickLong(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'LONG_FK');
    const stats = matchState.playerStats[taker.id];

    stats.freeKicks++;
    isHomeAttacking ? matchState.teamStats.home.freeKicks++ : matchState.teamStats.away.freeKicks++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    const passScore = calculateActionScore('free_kick_long', taker.attributes, 'attacker', taker.condition);
    const success = passScore > Math.random() * 15;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'LONG_FK', passScore })
    });

    if (success) {
        ball.position = isHomeAttacking ? Math.min(95, ball.position + 20) : Math.max(5, ball.position - 20);
        ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking) as PlayerState;
    } else {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getRandomPlayer(defendingTeam, ['DC', 'DMC', 'MC']) || null;
    }
}

function executeCornerKick(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttacking ? awayTeam : homeTeam;
    const taker = getSetPieceTaker(attackingTeam, 'CORNER');
    const stats = matchState.playerStats[taker.id];

    stats.corners++;
    isHomeAttacking ? matchState.teamStats.home.corners++ : matchState.teamStats.away.corners++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    matchState.events.push({
        minute: matchState.minute,
        type: 'CORNER',
        text: `Corner kick for ${attackingTeam.name}. ${taker.name} to take it...`,
        teamId: attackingTeam.id,
        playerId: taker.id
    });

    const cornerScore = calculateActionScore('corner', taker.attributes, 'attacker', taker.condition);
    const success = cornerScore > Math.random() * 18;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_LONG',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'CORNER', cornerScore })
    });

    if (success) {
        ball.position = isHomeAttacking ? 92 : 8;
        const target = getRandomPlayer(attackingTeam, ['FWC', 'DC', 'MC']);
        if (target && Math.random() < 0.3) {
            // Header attempt
            const headerScore = (target.attributes.heading + target.attributes.strength) * 0.5;
            if (headerScore > Math.random() * 20) {
                matchState.playerStats[target.id].goals++;
                matchState.playerStats[taker.id].assists++;
                isHomeAttacking ? matchState.homeScore++ : matchState.awayScore++;
                matchState.events.push({
                    minute: matchState.minute,
                    type: 'GOAL',
                    text: `GOAL! ${target.name} heads home from the corner!`,
                    teamId: attackingTeam.id,
                    playerId: target.id
                });
                ball.position = 50;
                ball.possession = isHomeAttacking ? 'away' : 'home';
            }
        }
    }

    if (ball.position !== 50) {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = defendingTeam.players.find(p => p.position === 'GK') || defendingTeam.players[0];
    }
}

function executeThrowIn(ball: BallState, matchState: MatchState, homeTeam: TeamState, awayTeam: TeamState, isHomeAttacking: boolean) {
    const attackingTeam = isHomeAttacking ? homeTeam : awayTeam;
    const taker = getSetPieceTaker(attackingTeam, 'THROW');
    const stats = matchState.playerStats[taker.id];

    stats.throws++;
    isHomeAttacking ? matchState.teamStats.home.throws++ : matchState.teamStats.away.throws++;
    const zone = getZoneFromPosition(ball.position, isHomeAttacking);
    trackFieldTouch(stats, zone);

    const throwScore = calculateActionScore('throw_in', taker.attributes, 'attacker', taker.condition);
    const success = throwScore > Math.random() * 10;
    pushActionLog(matchState, {
        playerId: taker.id,
        teamId: attackingTeam.id,
        minute: matchState.minute,
        ballPosition: Math.round(ball.position),
        zone,
        actionType: 'PASS_SHORT',
        result: success ? 'SUCCESS' : 'FAIL',
        isSuccessful: success,
        metadata: JSON.stringify({ setPiece: 'THROW_IN', throwScore })
    });

    if (success) {
        ball.carrier = getRandomPlayer(attackingTeam, ['MC', 'MR', 'ML', 'FWC']) || null;
    } else {
        ball.possession = isHomeAttacking ? 'away' : 'home';
        ball.carrier = getRandomPlayer(isHomeAttacking ? awayTeam : homeTeam, ['MC', 'DC', 'DR', 'DL']) || null;
    }
}

function checkDefensiveInterruption(
    ball: BallState,
    defendingTeam: TeamState,
    matchState: MatchState,
    defendingTeamId: string,
    isDefendingFromHomePerspective: boolean
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
        const interceptorStats = matchState.playerStats[interceptor.id];
        const interceptionZone = getZoneFromPosition(ball.position, isDefendingFromHomePerspective);
        trackFieldTouch(interceptorStats, interceptionZone);
        pushActionLog(matchState, {
            playerId: interceptor.id,
            teamId: defendingTeamId,
            minute: matchState.minute,
            ballPosition: Math.round(ball.position),
            zone: interceptionZone,
            actionType: 'INTERCEPTION',
            result: 'SUCCESS',
            isSuccessful: true,
            metadata: JSON.stringify({ interruptChance, avgTackling, avgPositioning })
        });
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
            defensiveThirdTouches: 0,
            middleThirdTouches: 0,
            attackingThirdTouches: 0,
            fouls: 0,
            yellowCards: 0,
            redCards: 0,
            freeKicks: 0,
            corners: 0,
            throws: 0,
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
        crossesCompleted: 0,
        freeKicks: 0,
        throws: 0
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
        actionLogs: [],
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

    // BALL PROGRESSION SYSTEM: 90 minutes, 12 ticks per minute (every 5 seconds) = 1080 game ticks
    // This provides more realistic pass volume (600+ passes per match)
    for (let minute = 1; minute <= 90; minute++) {
        matchState.minute = minute;

        // Dynamic tactical plan switching for both teams based on live score
        homeTeam.tactics = getActiveTacticByScore(homeTeam, matchState.homeScore, matchState.awayScore);
        awayTeam.tactics = getActiveTacticByScore(awayTeam, matchState.awayScore, matchState.homeScore);

        const ticksPerMinute = 12; // 1 tick = 5 seconds (60s / 12 = 5s)
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
                ball.carrier = getCarrierByPosition(attackingTeam, ball.position, isHomeAttacking) as PlayerState;
            }

            // Check for defensive interruption (interception)
            if (checkDefensiveInterruption(ball, defendingTeam, matchState, defendingTeam.id, !isHomeAttacking)) {
                continue; // Possession changed, skip this tick
            }

            // AI chooses action based on player attributes and ball position
            const weights = calculateActionWeights(ball.carrier, ball.position, isHomeAttacking, attackingTeam.tactics);
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
                    executeDribble(ball, ball.carrier, matchState, homeTeam, awayTeam, attackingTeam, defendingTeam, isHomeAttacking);
                    break;
                case 'SHOOT':
                    executeShoot(ball, ball.carrier, minute, matchState, homeTeam, awayTeam, attackingTeam, defendingTeam, isHomeAttacking);
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

    // Calculate final possession % based on successful passes completed
    const homePassesCompleted = matchState.teamStats.home.passesCompleted;
    const awayPassesCompleted = matchState.teamStats.away.passesCompleted;
    const totalPasses = homePassesCompleted + awayPassesCompleted;

    if (totalPasses > 0) {
        matchState.teamStats.home.possession = Math.round((homePassesCompleted / totalPasses) * 100);
        matchState.teamStats.away.possession = 100 - matchState.teamStats.home.possession;
    } else {
        matchState.teamStats.home.possession = 50;
        matchState.teamStats.away.possession = 50;
    }

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
            const focusWeight = getAttackingFocusBuff(
                team.tactics?.attacking_focus || 'MIXED',
                player.tacticalPosition || player.position
            );
            weightedCandidates.push({ player, weight: group.weight * focusWeight });
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
            const roleDrain = p.playerRole ? getRoleConditionDrain(p.playerRole) : 1.0;
            const drain = baseDrain * staminaFactor * getMentalityBuff(team.tactics.mentality).fatigue * roleDrain;
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

    // Players that already came on should never be substituted out again
    const subbedInIds = new Set(
        (matchState.events || [])
            .filter((e: any) => e.type === 'SUB' && e.teamId === team.id && e.playerId)
            .map((e: any) => e.playerId as string)
    );

    const starters = team.players.filter(
        p => p.tacticalPosition !== null && p.position !== 'GK' && !subbedInIds.has(p.id)
    );
    const availableBench = team.players.filter(p => p.tacticalPosition === null && p.position !== 'GK');
    const availableBenchGK = team.players.filter(p => p.tacticalPosition === null && p.position === 'GK');
    if (availableBench.length === 0 && availableBenchGK.length === 0) return subsUsed;

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

    // Emergency GK substitution only (late game + very low condition)
    // Goalkeeper should be last option and typically not changed.
    if (subsUsed < maxSubs && minute >= 70 && availableBenchGK.length > 0) {
        const currentGK = team.players.find(
            p => p.tacticalPosition !== null && p.position === 'GK' && !subbedInIds.has(p.id)
        );

        if (currentGK) {
            const gkEmergencyThreshold = 22; // only very low condition
            if (currentGK.condition <= gkEmergencyThreshold) {
                const bestBenchGK = [...availableBenchGK].sort((a, b) => b.condition - a.condition)[0];
                if (bestBenchGK && bestBenchGK.condition >= currentGK.condition + 5) {
                    performSubstitution(team, matchState, minute, ball, currentGK, bestBenchGK);
                    subsUsed += 1;
                }
            }
        }
    }

    return subsUsed;
}

function calculateRatings(matchState: MatchState) {
    Object.values(matchState.playerStats).forEach(stat => {
        let rating = 6.0;

        // Check if player is goalkeeper by position
        const isGoalkeeper = stat.position === 'GK';

        rating += (stat.goals * 1.2);
        rating += (stat.assists * 0.7);
        
        // Reduce goalkeeper save rating bonus from 0.2 to 0.15 to balance saves
        // Goalkeepers should get credit for good saves but not dominate MOM every match
        if (isGoalkeeper) {
            rating += (stat.saves * 0.15);
        } else {
            rating += (stat.saves * 0.2); // Non-GK rarely get saves, keep original
        }
        
        rating += (stat.tacklesWon * 0.3);
        rating += (stat.passesCompleted * 0.01); // Reduced from 0.05 due to 4x more passes from 12 ticks/min
        rating += (stat.dribblesWon * 0.2);

        rating -= ((stat.shots - stat.shotsOnTarget) * 0.1);
        rating -= ((stat.tacklesAttempted - stat.tacklesWon) * 0.1);
        rating -= (stat.yellowCards * 0.5);
        rating -= (stat.redCards * 2.0);
        rating -= (stat.fouls * 0.1);

        stat.rating = Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
    });
}
