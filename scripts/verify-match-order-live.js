(async () => {
  const matchId = process.argv[2] || 'cmny0je7812haohpbavov9y0h';
  const headers = { Cookie: 'fm_auth=your_secret_token' };

  const matchRes = await fetch(`http://localhost:3000/api/match/${matchId}`, { headers });
  const match = await matchRes.json();
  const replayRes = await fetch(`http://localhost:3000/api/match/${matchId}/v2-sim`, { headers });
  const replayPayload = await replayRes.json();
  const replay = replayPayload?.replay || {};

  const synced = match.playerStats || {};
  const replayStats = replay.playerStats || {};

  const merged = new Map();
  for (const [playerId, replayRow] of Object.entries(replayStats)) {
    const syncedRow = synced[playerId] || {};
    merged.set(playerId, {
      ...replayRow,
      ...syncedRow,
      playerId,
      teamId: String(replayRow?.teamId || syncedRow?.teamId || ''),
    });
  }
  for (const [playerId, syncedRow] of Object.entries(synced)) {
    if (!merged.has(playerId)) {
      merged.set(playerId, {
        ...syncedRow,
        playerId,
        teamId: String(syncedRow?.teamId || ''),
      });
    }
  }

  const frames = replay.frames || [];

  const normPos = (pos) => {
    if (!pos) return '-';
    if (['FWC', 'FWR', 'FWL'].includes(pos) || String(pos).startsWith('FW_')) return 'FW';
    if (String(pos).startsWith('DC_')) return 'DC';
    if (String(pos).startsWith('MC_')) return 'MC';
    return pos;
  };

  const posOrder = (pos) => {
    const normalized = normPos(pos);
    if (normalized === 'GK') return 0;
    if (['DR', 'DL', 'DC', 'DMC', 'DMR', 'DML'].includes(pos) || normalized === 'DC') return 1;
    if (['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC'].includes(pos) || normalized === 'MC') return 2;
    if (['FWR', 'FWL', 'FWC', 'FW'].includes(pos) || normalized === 'FW') return 3;
    return 9;
  };

  const analyze = (teamId, label) => {
    const firstAppearance = new Map();
    frames.forEach((frame, frameIndex) => {
      Object.keys(frame.playerPositions || {}).forEach((playerId) => {
        const p = merged.get(playerId);
        if (String(p?.teamId || '') !== String(teamId || '')) return;
        const old = firstAppearance.get(playerId);
        if (old === undefined || frameIndex < old) firstAppearance.set(playerId, frameIndex);
      });
    });

    const rows = [...merged.values()]
      .filter((p) => String(p.teamId || '') === String(teamId || ''))
      .map((p) => {
        const firstTick = firstAppearance.get(String(p.playerId || ''));
        const bucket = typeof firstTick === 'number' ? (firstTick === 0 ? 0 : 1) : 2;
        return {
          ...p,
          bucket,
          firstTick,
          displayPos: normPos(p.tacticalPosition || p.position || '-'),
        };
      })
      .sort((a, b) => (
        a.bucket - b.bucket
        || posOrder(a.tacticalPosition || a.position || '-') - posOrder(b.tacticalPosition || b.position || '-')
        || String(a.name || '').localeCompare(String(b.name || ''))
      ));

    console.log(`\n==== ${label} (${teamId}) ====`);
    console.log(`total=${rows.length} starters=${rows.filter((r) => r.bucket === 0).length} subs=${rows.filter((r) => r.bucket === 1).length} bench=${rows.filter((r) => r.bucket === 2).length}`);
    console.table(rows.slice(0, 25).map((r) => ({
      bucket: r.bucket,
      firstTick: r.firstTick,
      pos: r.displayPos,
      name: r.name,
      min: r.minutes,
      teamId: r.teamId,
    })));
  };

  analyze(match.homeTeamId, 'HOME');
  analyze(match.awayTeamId, 'AWAY');
})();
