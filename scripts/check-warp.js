/**
 * check-warp.js
 * ตรวจหานักเตะที่เกิด warp (teleport) ในแต่ละ tick จาก TICK_SNAPSHOT metadata
 *
 * Usage: node scripts/check-warp.js <matchId> [threshold]
 * Example: node scripts/check-warp.js cmny0je7b12pwohpbbsdx9u0n 10
 *
 * threshold = ระยะทางสูงสุดที่ยอมให้เคลื่อนระหว่าง tick (default=5)
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const MATCH_ID = process.argv[2];
const DIST_THRESHOLD = parseFloat(process.argv[3] || '5');

if (!MATCH_ID) {
  console.error('Usage: node scripts/check-warp.js <matchId> [threshold]');
  process.exit(1);
}

(async () => {
  console.log(`\n🔍 Checking warps for match: ${MATCH_ID}`);
  console.log(`📏 Distance threshold: ${DIST_THRESHOLD} units\n`);

  // --- 1. ดึง TICK_SNAPSHOT logs ---
  const logs = await p.playerActionLog.findMany({
    where: { matchId: MATCH_ID, actionType: 'TICK_SNAPSHOT' },
    orderBy: [{ minute: 'asc' }, { tick: 'asc' }, { sequence: 'asc' }],
  });

  if (logs.length === 0) {
    console.log('❌ No TICK_SNAPSHOT logs found for this matchId.');
    console.log('   → ตรวจสอบว่า matchId ถูกต้อง หรือ match นี้ถูก process ด้วย V2 engine แล้ว\n');
    await p.$disconnect();
    process.exit(0);
  }

  console.log(`✅ Loaded ${logs.length} TICK_SNAPSHOT rows\n`);

  // --- 1b. ดึง set-piece / reset events (FREE_KICK, CORNER, GOAL_KICK, GOAL, SUBSTITUTION) ---
  // เหตุการณ์เหล่านี้ทำให้ผู้เล่น teleport ไปตำแหน่งใหม่โดยชอบธรรม → ต้อง skip warp ที่เกิดใน cooldown window หลังจากนั้น
  const SET_PIECE_TYPES = new Set(['FREE_KICK', 'CORNER', 'GOAL_KICK', 'GOAL', 'SUBSTITUTION', 'THROW_IN', 'KICKOFF']);
  const SET_PIECE_COOLDOWN_TICKS = 4; // ยกเว้น warp หลัง set-piece ไป N ticks

  const setPieceEvents = await p.playerActionLog.findMany({
    where: {
      matchId: MATCH_ID,
      actionType: { in: [...SET_PIECE_TYPES] },
    },
    select: { minute: true, tick: true },
    orderBy: [{ minute: 'asc' }, { tick: 'asc' }],
  });

  // สร้าง set ของ "minute:tick" ที่อยู่ใน cooldown window หลัง set-piece
  const setPieceCooldownKeys = new Set();
  const TICKS_PER_MINUTE = 10; // V2 runs 10 ticks/minute

  for (const ev of setPieceEvents) {
    for (let dt = 0; dt <= SET_PIECE_COOLDOWN_TICKS; dt++) {
      const totalTick = ev.minute * TICKS_PER_MINUTE + ev.tick + dt;
      const m = Math.floor(totalTick / TICKS_PER_MINUTE);
      const t = totalTick % TICKS_PER_MINUTE;
      setPieceCooldownKeys.add(`${m}:${t}`);
    }
  }

  console.log(`⚽ Found ${setPieceEvents.length} set-piece/reset events → will exclude warps within ${SET_PIECE_COOLDOWN_TICKS} ticks after them\n`);

  // --- 2. รวบรวม player positions ทุก tick ---
  // playerTracks[playerId] = [{minute, tick, x, y}]
  const playerTracks = {};
  const playerIds = new Set();

  for (const log of logs) {
    let meta = log.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { continue; }
    }
    if (!meta) continue;

    const teams = [
      ...(meta.home_team || []),
      ...(meta.away_team || []),
    ];

    for (const player of teams) {
      const { playerId, x, y } = player;
      if (playerId == null || x == null || y == null) continue;
      playerIds.add(playerId);
      if (!playerTracks[playerId]) playerTracks[playerId] = [];
      playerTracks[playerId].push({ minute: log.minute, tick: log.tick, x, y });
    }
  }

  // --- 3. ดึงข้อมูลนักเตะ (ชื่อ, เบอร์, ทีม) ---
  const players = await p.player.findMany({
    where: { id: { in: [...playerIds] } },
    select: { id: true, name: true, jerseyNumber: true, teamId: true },
  });

  const teamIds = [...new Set(players.map(pl => pl.teamId).filter(Boolean))];
  const teams = await p.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  });

  const playerMap = {};
  for (const pl of players) playerMap[pl.id] = pl;
  const teamMap = {};
  for (const t of teams) teamMap[t.id] = t;

  // --- 4. ตรวจ warp (ยกเว้น warp ที่เกิดหลัง set-piece reset) ---
  const warps = [];
  let skippedSetPiece = 0;

  for (const [playerId, track] of Object.entries(playerTracks)) {
    for (let i = 1; i < track.length; i++) {
      const prev = track[i - 1];
      const curr = track[i];
      const dist = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      if (dist > DIST_THRESHOLD) {
        // ตรวจว่า tick นี้อยู่ใน cooldown window หลัง set-piece หรือไม่
        const key = `${curr.minute}:${curr.tick}`;
        if (setPieceCooldownKeys.has(key)) {
          skippedSetPiece++;
          continue; // skip — เป็น warp จาก set-piece reset ที่ยอมรับได้
        }
        warps.push({ playerId, prev, curr, dist });
      }
    }
  }

  // --- 5. แสดงผล ---
  console.log(`⏭️  Skipped ${skippedSetPiece} warps near set-piece/reset events\n`);
  if (warps.length === 0) {
    console.log(`✅ No warp detected above threshold (${DIST_THRESHOLD} units)\n`);
    await p.$disconnect();
    return;
  }

  // เรียงตาม minute, tick, distance
  warps.sort((a, b) =>
    a.prev.minute !== b.prev.minute ? a.prev.minute - b.prev.minute :
      a.prev.tick !== b.prev.tick ? a.prev.tick - b.prev.tick :
        b.dist - a.dist
  );

  console.log(`🚨 Found ${warps.length} warp events:\n`);
  console.log(
    '  #'.padEnd(5) +
    'Team'.padEnd(22) +
    '#'.padEnd(4) +
    'Player'.padEnd(22) +
    'Minute'.padEnd(8) +
    'Tick'.padEnd(6) +
    'From (x,y)'.padEnd(18) +
    'To (x,y)'.padEnd(18) +
    'Dist'
  );
  console.log('  ' + '-'.repeat(110));

  for (let i = 0; i < warps.length; i++) {
    const { playerId, prev, curr, dist } = warps[i];
    const pl = playerMap[playerId] || {};
    const team = teamMap[pl.teamId] || {};
    const jersey = pl.jerseyNumber != null ? `#${pl.jerseyNumber}` : '  ';
    const name = (pl.name || playerId).slice(0, 20);
    const teamName = (team.name || '???').slice(0, 20);
    const fromPos = `(${prev.x.toFixed(1)}, ${prev.y.toFixed(1)})`;
    const toPos = `(${curr.x.toFixed(1)}, ${curr.y.toFixed(1)})`;
    const distStr = `${dist.toFixed(2)} ⚠️ ${dist > DIST_THRESHOLD * 3 ? '🔴' : dist > DIST_THRESHOLD * 2 ? '🟠' : '🟡'}`;

    console.log(
      `  ${String(i + 1).padEnd(4)}` +
      `${teamName.padEnd(22)}` +
      `${jersey.padEnd(4)}` +
      `${name.padEnd(22)}` +
      `${String(curr.minute).padEnd(8)}` +
      `${String(curr.tick).padEnd(6)}` +
      `${fromPos.padEnd(18)}` +
      `${toPos.padEnd(18)}` +
      `${distStr}`
    );
  }

  // --- 6. สรุปรายนักเตะ ---
  const warpByPlayer = {};
  for (const w of warps) {
    if (!warpByPlayer[w.playerId]) warpByPlayer[w.playerId] = { count: 0, maxDist: 0 };
    warpByPlayer[w.playerId].count++;
    if (w.dist > warpByPlayer[w.playerId].maxDist) warpByPlayer[w.playerId].maxDist = w.dist;
  }

  console.log('\n📊 Warp summary per player:\n');
  const sorted = Object.entries(warpByPlayer).sort((a, b) => b[1].count - a[1].count);
  for (const [playerId, stat] of sorted) {
    const pl = playerMap[playerId] || {};
    const team = teamMap[pl.teamId] || {};
    const jersey = pl.jerseyNumber != null ? `#${pl.jerseyNumber}` : '  ';
    console.log(
      `  ${(team.name || '???').slice(0, 20).padEnd(22)}` +
      `${jersey.padEnd(6)}` +
      `${(pl.name || playerId).slice(0, 22).padEnd(24)}` +
      `warps: ${String(stat.count).padEnd(6)}` +
      `max dist: ${stat.maxDist.toFixed(2)}`
    );
  }

  console.log(`\n  Total warp events: ${warps.length}\n`);
  await p.$disconnect();
})();