import prisma from '@/lib/prisma';
import { applyAgeEfficiency, calculateMatchExp, getAnnualDecay, getSeasonalExpCap } from '@/lib/engine/experience';
import { getDivisionRewardMultiplier } from './divisionSystem';

const LEAGUE_PRIZE_POOL = 30000000;
const TV_RIGHTS_SHARE = 5000000;
const ACHIEVEMENT_BONUS = 5000000;
const COMMERCIAL_BONUS = 3000000;

const seasonDateRange = (year: number) => {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    return { start, end };
};

export async function calculateSeasonStandings(leagueId: string, season: number) {
    const teams = await prisma.team.findMany({
        where: { leagueId },
        include: {
            homeMatches: { where: { season, isPlayed: true } },
            awayMatches: { where: { season, isPlayed: true } }
        }
    });

    const standings = teams.map(team => {
        let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;
        const processMatch = (homeScore: number, awayScore: number, isHome: boolean) => {
            played++;
            gf += isHome ? homeScore : awayScore; ga += isHome ? awayScore : homeScore;
            const myScore = isHome ? homeScore : awayScore; const opScore = isHome ? awayScore : homeScore;
            if (myScore > opScore) { won++; points += 3; } else if (myScore === opScore) { drawn++; points += 1; } else { lost++; }
        };
        team.homeMatches.forEach(m => m.homeScore !== null && m.awayScore !== null && processMatch(m.homeScore, m.awayScore, true));
        team.awayMatches.forEach(m => m.homeScore !== null && m.awayScore !== null && processMatch(m.homeScore, m.awayScore, false));
        return { id: team.id, name: team.name, played, won, drawn, lost, gf, ga, gd: gf - ga, points };
    });

    standings.sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf));
    return standings;
}

export async function calculateSeasonAwards(leagueId: string, season: number, year: number) {
    const standings = await calculateSeasonStandings(leagueId, season);
    const teamIds = standings.map(s => s.id);
    const league = await prisma.league.findUnique({
        where: { id: leagueId },
        select: { level: true, name: true }
    });
    const divisionMultiplier = getDivisionRewardMultiplier(league?.level || 1);

    const playerStats = await prisma.playerMatchStats.groupBy({
        by: ['playerId', 'teamId'],
        where: {
            teamId: { in: teamIds },
            match: { season, isPlayed: true }
        },
        _sum: { goals: true, assists: true },
        _avg: { rating: true },
        _count: { id: true }
    });

    const players = await prisma.player.findMany({
        where: { id: { in: playerStats.map(p => p.playerId) } },
        select: { id: true, name: true, teamId: true, naturalPosition: true }
    });

    const playerMap = new Map(players.map(p => [p.id, p]));

    const goalLeaders = playerStats
        .map(s => ({
            ...s,
            goals: s._sum.goals || 0,
            assists: s._sum.assists || 0,
            avgRating: s._avg.rating ? Number(s._avg.rating) : 0,
            matches: s._count.id || 0,
            player: playerMap.get(s.playerId)
        }))
        .filter(s => s.player)
        .sort((a, b) => (b.goals - a.goals) || (b.avgRating - a.avgRating));

    const assistLeaders = [...goalLeaders]
        .sort((a, b) => (b.assists - a.assists) || (b.avgRating - a.avgRating));

    const ratingLeaders = goalLeaders
        .filter(s => s.matches >= 5)
        .sort((a, b) => (b.avgRating - a.avgRating) || (b.goals - a.goals));

    const matches = await prisma.match.findMany({
        where: {
            season,
            isPlayed: true,
            OR: [
                { homeTeamId: { in: teamIds } },
                { awayTeamId: { in: teamIds } }
            ]
        },
        include: {
            playerStats: {
                include: {
                    player: { select: { id: true, name: true, naturalPosition: true } }
                }
            }
        }
    });

    const cleanSheetMap = new Map<string, { count: number; player: { id: string; name: string }; teamId: string }>();

    for (const match of matches) {
        const homeClean = match.awayScore === 0;
        const awayClean = match.homeScore === 0;

        if (homeClean) {
            const gk = match.playerStats
                .filter(ps => ps.teamId === match.homeTeamId && ps.player.naturalPosition.startsWith('GK') && ps.minutes > 0)
                .sort((a, b) => b.minutes - a.minutes)[0];
            if (gk) {
                const current = cleanSheetMap.get(gk.playerId) || { count: 0, player: { id: gk.playerId, name: gk.player.name }, teamId: gk.teamId };
                cleanSheetMap.set(gk.playerId, { ...current, count: current.count + 1 });
            }
        }

        if (awayClean) {
            const gk = match.playerStats
                .filter(ps => ps.teamId === match.awayTeamId && ps.player.naturalPosition.startsWith('GK') && ps.minutes > 0)
                .sort((a, b) => b.minutes - a.minutes)[0];
            if (gk) {
                const current = cleanSheetMap.get(gk.playerId) || { count: 0, player: { id: gk.playerId, name: gk.player.name }, teamId: gk.teamId };
                cleanSheetMap.set(gk.playerId, { ...current, count: current.count + 1 });
            }
        }
    }

    const cleanSheetLeaders = Array.from(cleanSheetMap.values())
        .sort((a, b) => b.count - a.count);

    const goldenBoot = goalLeaders[0];
    const topAssist = assistLeaders[0];
    const playerOfSeason = ratingLeaders[0] || goalLeaders[0];
    const goldenGlove = cleanSheetLeaders[0];

    const { start, end } = seasonDateRange(year);
    const jerseySalesByTeam = await prisma.financialEvent.groupBy({
        by: ['teamId'],
        where: {
            teamId: { in: teamIds },
            type: 'JERSEY',
            date: { gte: start, lte: end }
        },
        _sum: { amount: true }
    });
    const jerseySalesMap = new Map(jerseySalesByTeam.map(s => [s.teamId, s._sum.amount || 0]));

    const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        include: { players: true }
    });
    const teamMap = new Map(teams.map(t => [t.id, t]));

    const totalWeight = standings.reduce((sum, _, idx) => sum + (standings.length - idx), 0);

    const rewards = standings.map((team, idx) => {
        const positionWeight = standings.length - idx;
        const positionPrize = Math.round((positionWeight / totalWeight) * LEAGUE_PRIZE_POOL * divisionMultiplier);
        const tvShare = Math.round(TV_RIGHTS_SHARE * divisionMultiplier);
        const jerseySales = jerseySalesMap.get(team.id) || 0;
        const roster = teamMap.get(team.id)?.players || [];
        const avgPopularity = roster.length > 0 ? roster.reduce((sum, p) => sum + p.popularity, 0) / roster.length : 0;
        const targetJerseySales = Math.round((avgPopularity / 100) * roster.length * 500 * 52);
        const commercialBonus = jerseySales >= targetJerseySales ? Math.round(COMMERCIAL_BONUS * divisionMultiplier) : 0;

        return {
            teamId: team.id,
            teamName: team.name,
            divisionLevel: league?.level || 1,
            divisionName: league?.name || 'Division 1',
            position: idx + 1,
            positionPrize,
            tvShare,
            commercialBonus,
            total: positionPrize + tvShare + commercialBonus
        };
    });

    const achievementRewards = [
        goldenBoot?.player ? { title: 'Golden Boot', playerId: goldenBoot.playerId, playerName: goldenBoot.player?.name, teamId: goldenBoot.teamId } : null,
        goldenGlove ? { title: 'Golden Glove', playerId: goldenGlove.player.id, playerName: goldenGlove.player.name, teamId: goldenGlove.teamId } : null,
        playerOfSeason?.player ? { title: 'Player of the Season', playerId: playerOfSeason.playerId, playerName: playerOfSeason.player?.name, teamId: playerOfSeason.teamId } : null
    ].filter(Boolean) as Array<{ title: string; playerId: string; playerName: string; teamId: string }>;

    return {
        standings,
        awards: {
            goldenBoot: goldenBoot?.player ? { playerId: goldenBoot.playerId, playerName: goldenBoot.player?.name, goals: goldenBoot.goals, teamId: goldenBoot.teamId } : null,
            topAssist: topAssist?.player ? { playerId: topAssist.playerId, playerName: topAssist.player?.name, assists: topAssist.assists, teamId: topAssist.teamId } : null,
            goldenGlove: goldenGlove ? { playerId: goldenGlove.player.id, playerName: goldenGlove.player.name, cleanSheets: goldenGlove.count, teamId: goldenGlove.teamId } : null,
            playerOfSeason: playerOfSeason?.player ? { playerId: playerOfSeason.playerId, playerName: playerOfSeason.player?.name, avgRating: playerOfSeason.avgRating, teamId: playerOfSeason.teamId } : null
        },
        rewards,
        achievementRewards
    };
}

export async function applySeasonRewards(season: number, year: number) {
    const leagues = await prisma.league.findMany();

    for (const league of leagues) {
        const { rewards, achievementRewards } = await calculateSeasonAwards(league.id, season, year);

        const teamRewardMap = new Map(rewards.map(r => [r.teamId, r]));

        for (const reward of rewards) {
            const alreadyPaid = await prisma.financialEvent.findFirst({
                where: {
                    teamId: reward.teamId,
                    type: 'SEASON_REWARD',
                    description: { contains: `Season ${season} Rewards` }
                }
            });

            if (alreadyPaid) continue;

            const achievementBonus = achievementRewards
                .filter(a => a.teamId === reward.teamId)
                .length * ACHIEVEMENT_BONUS;

            const totalReward = reward.total + achievementBonus;

            await prisma.team.update({
                where: { id: reward.teamId },
                data: { balance: { increment: totalReward } }
            });

            const breakdown = [
                `Position Prize: ${reward.positionPrize.toLocaleString()}`,
                `TV Rights: ${reward.tvShare.toLocaleString()}`,
                reward.commercialBonus ? `Commercial Bonus: ${reward.commercialBonus.toLocaleString()}` : null,
                achievementBonus ? `Achievement Bonus: ${achievementBonus.toLocaleString()}` : null
            ].filter(Boolean).join(' | ');

            await prisma.financialEvent.create({
                data: {
                    teamId: reward.teamId,
                    type: 'SEASON_REWARD',
                    amount: totalReward,
                    description: `Season ${season} Rewards (${breakdown})`
                }
            });
        }
    }
}

export async function applyPromotionRelegation(season: number) {
    const leagues = await prisma.league.findMany({
        where: { season },
        orderBy: { level: 'asc' }
    });

    for (let index = 0; index < leagues.length - 1; index++) {
        const upperLeague = leagues[index];
        const lowerLeague = leagues[index + 1];

        const [upperStandings, lowerStandings] = await Promise.all([
            calculateSeasonStandings(upperLeague.id, season),
            calculateSeasonStandings(lowerLeague.id, season)
        ]);

        const relegated = upperStandings.slice(-3);
        const promoted = lowerStandings.slice(0, 3);

        if (relegated.length < 3 || promoted.length < 3) continue;

        await prisma.$transaction([
            ...relegated.map((team) => prisma.team.update({
                where: { id: team.id },
                data: { leagueId: lowerLeague.id, lastDivisionChangeSeason: season + 1 }
            })),
            ...promoted.map((team) => prisma.team.update({
                where: { id: team.id },
                data: { leagueId: upperLeague.id, lastDivisionChangeSeason: season + 1 }
            }))
        ]);

        await prisma.news.createMany({
            data: [
                ...promoted.map((team) => ({
                    title: `${team.name} promoted`,
                    content: `${team.name} earned promotion to ${upperLeague.name} for season ${season + 1}.`,
                    type: 'PROMOTION'
                })),
                ...relegated.map((team) => ({
                    title: `${team.name} relegated`,
                    content: `${team.name} dropped to ${lowerLeague.name} for season ${season + 1}.`,
                    type: 'RELEGATION'
                }))
            ]
        });
    }
}

export async function applySeasonExpAdjustments(season: number, year: number) {
    const leagues = await prisma.league.findMany();

    for (const league of leagues) {
        const leagueLevel = league.level || 1;
        const { standings, awards } = await calculateSeasonAwards(league.id, season, year);
        const teamIds = standings.map(s => s.id);
        if (teamIds.length === 0) continue;

        const matches = await prisma.match.findMany({
            where: { season, isPlayed: true, OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] },
            select: { id: true, homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true, motmPlayerId: true }
        });
        const matchMap = new Map(matches.map(m => [m.id, m]));

        const stats = await prisma.playerMatchStats.findMany({
            where: { matchId: { in: matches.map(m => m.id) }, teamId: { in: teamIds } },
            select: {
                matchId: true,
                playerId: true,
                teamId: true,
                minutes: true,
                rating: true,
                goals: true,
                assists: true,
                yellowCards: true,
                redCards: true
            }
        });

        const playerIds = Array.from(new Set(stats.map(s => s.playerId)));
        const players = await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, age: true, exp: true, naturalPosition: true, isRetired: true }
        });
        const playerMap = new Map(players.map(p => [p.id, p]));

        const rawByPlayer = new Map<string, number>();
        const participantByTeam = new Map<string, Set<string>>();

        for (const s of stats) {
            const player = playerMap.get(s.playerId);
            if (!player || player.isRetired) continue;
            const m = matchMap.get(s.matchId);
            if (!m || m.homeScore === null || m.awayScore === null) continue;

            const cleanSheet = (s.teamId === m.homeTeamId && m.awayScore === 0) || (s.teamId === m.awayTeamId && m.homeScore === 0);
            const isMotm = m.motmPlayerId === s.playerId;

            const gain = calculateMatchExp({
                playerId: s.playerId,
                minutes: s.minutes,
                rating: s.rating,
                goals: s.goals,
                assists: s.assists,
                yellowCards: s.yellowCards,
                redCards: s.redCards,
                position: player.naturalPosition,
                cleanSheet,
                isMotm
            }).totalGain;

            rawByPlayer.set(s.playerId, (rawByPlayer.get(s.playerId) || 0) + gain);

            if (s.minutes > 0) {
                if (!participantByTeam.has(s.teamId)) participantByTeam.set(s.teamId, new Set());
                participantByTeam.get(s.teamId)!.add(s.playerId);
            }
        }

        const seasonalBonusByPlayer = new Map<string, number>();
        const addBonus = (playerId: string | null | undefined, amount: number) => {
            if (!playerId) return;
            seasonalBonusByPlayer.set(playerId, (seasonalBonusByPlayer.get(playerId) || 0) + amount);
        };

        addBonus((awards as any).playerOfSeason?.playerId, 20);
        addBonus((awards as any).goldenBoot?.playerId, 15);
        addBonus((awards as any).topAssist?.playerId, 15);

        const championTeamId = standings[0]?.id;
        const championPlayers = championTeamId ? Array.from(participantByTeam.get(championTeamId) || []) : [];
        for (const pid of championPlayers) addBonus(pid, 10);

        if (leagueLevel > 1) {
            const promotedTeams = standings.slice(0, Math.min(3, standings.length)).map(s => s.id);
            for (const promotedTeamId of promotedTeams) {
                const promotedPlayers = Array.from(participantByTeam.get(promotedTeamId) || []);
                for (const pid of promotedPlayers) addBonus(pid, 30);
            }
        }

        if (leagueLevel < 3) {
            const relegatedTeams = standings.slice(-Math.min(3, standings.length)).map(s => s.id);
            for (const relegatedTeamId of relegatedTeams) {
                const relegatedPlayers = Array.from(participantByTeam.get(relegatedTeamId) || []);
                for (const pid of relegatedPlayers) addBonus(pid, -30);
            }
        }

        for (const [playerId, rawSeason] of rawByPlayer.entries()) {
            const player = playerMap.get(playerId);
            if (!player || player.isRetired) continue;

            let adjustedSeason = applyAgeEfficiency(rawSeason, player.age);
            if (adjustedSeason > 0) {
                adjustedSeason = Math.min(adjustedSeason, getSeasonalExpCap(player.age));
            }

            const annualDecay = getAnnualDecay(player.age);
            const seasonalBonus = seasonalBonusByPlayer.get(playerId) || 0;

            // Injury rule (4+ months) is not applied here because there is no injury duration model yet.
            const desiredSeasonNet = adjustedSeason + seasonalBonus - annualDecay;

            // Raw per-match EXP has already been applied during season.
            const correctionDelta = Math.round(desiredSeasonNet - rawSeason);
            if (correctionDelta === 0) continue;

            await prisma.player.update({
                where: { id: playerId },
                data: { exp: (player.exp || 0) + correctionDelta }
            });
        }
    }
}