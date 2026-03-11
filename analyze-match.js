const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MATCH_ID = 'cmmkt5zvjbxmroh3gsbwzrt32';

(async () => {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: {
      homeTeam: true,
      awayTeam: true,
      playerStats: {
        include: { player: true }
      }
    }
  });

  if (!match) return console.log('Match not found');

  console.log('=== MATCH ===');
  console.log(match.homeTeam.name + ' ' + match.homeScore + ' - ' + match.awayScore + ' ' + match.awayTeam.name);
  console.log('Season: ' + match.season + ' | Date: ' + match.date);
  console.log('Played: ' + match.played);

  console.log('\n=== MATCH PREP CONFIG ===');
  // prepConfig is stored as JSON in homePrepConfig / awayPrepConfig fields on Match
  const matchRaw = await prisma.match.findUnique({ where: { id: MATCH_ID } });
  console.log('homePrepConfig:', matchRaw.homePrepConfig ? JSON.stringify(JSON.parse(matchRaw.homePrepConfig), null, 2) : 'null');
  console.log('awayPrepConfig:', matchRaw.awayPrepConfig ? JSON.stringify(JSON.parse(matchRaw.awayPrepConfig), null, 2) : 'null');

  console.log('\n=== PLAYER MATCH STATS (sorted by rating) ===');
  const stats = match.playerStats.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  for (const s of stats) {
    const team = s.player.teamId === match.homeTeamId ? match.homeTeam.name : match.awayTeam.name;
    console.log(
      team.padEnd(25) +
      (s.player.name || 'Unknown').padEnd(25) +
      (s.player.tacticalPosition || s.player.naturalPosition || '?').padEnd(6) +
      'rating:' + (s.rating || 0).toFixed(1).padEnd(6) +
      'goals:' + (s.goals || 0).toString().padEnd(4) +
      'assists:' + (s.assists || 0).toString().padEnd(4) +
      'tackles:' + (s.tacklesWon || 0).toString().padEnd(4) +
      'passes:' + (s.passesCompleted || 0).toString().padEnd(6) +
      'shots:' + (s.shotsOnTarget || 0).toString()
    );
  }

  // Get action logs
  console.log('\n=== ACTION LOG SUMMARY PER PLAYER ===');
  const actionLogs = await prisma.playerActionLog.findMany({
    where: { matchId: MATCH_ID },
    include: { player: true }
  });

  console.log('Total action logs: ' + actionLogs.length);

  const byPlayer = {};
  for (const log of actionLogs) {
    if (!byPlayer[log.playerId]) byPlayer[log.playerId] = { name: log.player.name, teamId: log.player.teamId, logs: [] };
    byPlayer[log.playerId].logs.push(log);
  }

  const summary = Object.values(byPlayer).map((p) => {
    const total = p.logs.length;
    const success = p.logs.filter(l => l.isSuccessful).length;
    const succRate = total ? Math.round((success/total)*100) : 0;
    const zones = { DEFENSIVE: 0, MIDDLE: 0, ATTACKING: 0 };
    const actions = {};
    for (const l of p.logs) {
      if (zones[l.zone] !== undefined) zones[l.zone]++;
      if (!actions[l.actionType]) actions[l.actionType] = { attempts: 0, success: 0 };
      actions[l.actionType].attempts++;
      if (l.isSuccessful) actions[l.actionType].success++;
    }
    const team = p.teamId === match.homeTeamId ? 'HOME' : 'AWAY';
    return { name: p.name, team, total, succRate, zones, actions };
  }).sort((a, b) => b.total - a.total);

  for (const s of summary) {
    const actionStr = Object.entries(s.actions)
      .map(([k, v]) => k + ':' + v.attempts + '(' + Math.round(v.success/v.attempts*100) + '%)')
      .join(' | ');
    console.log(
      '[' + s.team + '] ' +
      s.name.padEnd(25) + '  ' +
      'total:' + s.total.toString().padEnd(5) +
      'succRate:' + s.succRate + '%  ' +
      'DEF:' + s.zones.DEFENSIVE + ' MID:' + s.zones.MIDDLE + ' ATT:' + s.zones.ATTACKING +
      '  ' + actionStr
    );
  }

  // Identify the 3 targeted players
  const targetIds = [
    'cmmkt5zv1bxeloh3glz3vvyma',
    'cmmkt5zv1bxemoh3g5tgg42hd',
    'cmmkt5zv1bxehoh3gbrq8qz88'
  ];
  const targetedPlayers = await prisma.player.findMany({
    where: { id: { in: targetIds } }
  });
  console.log('\n=== TARGETED (NEUTRALIZED) PLAYERS ===');
  for (const p of targetedPlayers) {
    console.log('  ' + p.name + ' [' + p.naturalPosition + '] team: ' + p.teamId);
  }

  console.log('\n=== TARGETED PLAYERS - ACTION LOGS DETAIL ===');
  for (const pid of targetIds) {
    const playerLogs = actionLogs.filter(l => l.playerId === pid);
    const pName = targetedPlayers.find(p => p.id === pid)?.name || 'Unknown';
    if (playerLogs.length === 0) {
      console.log(pName + ': NO action logs!');
      continue;
    }
    const success = playerLogs.filter(l => l.isSuccessful).length;
    const succRate = Math.round(success / playerLogs.length * 100);
    const actionBreakdown = {};
    for (const l of playerLogs) {
      if (!actionBreakdown[l.actionType]) actionBreakdown[l.actionType] = { attempts: 0, success: 0 };
      actionBreakdown[l.actionType].attempts++;
      if (l.isSuccessful) actionBreakdown[l.actionType].success++;
    }
    console.log('\n' + pName + ':');
    console.log('  Total actions: ' + playerLogs.length + '  Overall success: ' + succRate + '%');
    for (const [action, data] of Object.entries(actionBreakdown)) {
      console.log('  ' + action.padEnd(14) + data.attempts + ' attempts, ' + data.success + ' success (' + Math.round(data.success/data.attempts*100) + '%)');
    }
  }

  // Also check if MU squad is complete (how many actually played)
  console.log('\n=== MAN UTD SQUAD ANALYSIS ===');
  const muStats = match.playerStats.filter(s => s.player.teamId === match.homeTeamId);
  const activeMU = muStats.filter(s => (s.passesCompleted || 0) + (s.goals || 0) + (s.tacklesWon || 0) > 0);
  const inactiveMU = muStats.filter(s => (s.passesCompleted || 0) + (s.goals || 0) + (s.tacklesWon || 0) === 0);
  console.log('MU players with actual activity: ' + activeMU.length + ' / ' + muStats.length);
  console.log('Inactive MU players (0 contributions):');
  for (const s of inactiveMU) {
    console.log('  ' + (s.player.tacticalPosition || s.player.naturalPosition || '?').padEnd(8) + s.player.name + ' (rating: ' + (s.rating || 0).toFixed(1) + ')');
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
