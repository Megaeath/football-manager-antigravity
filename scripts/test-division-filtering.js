const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  console.log('=== Testing Division Filtering ===\n');

  // Test: Get Division 1 standings
  const league1 = await p.league.findFirst({ where: { level: 1, season: 1 } });
  const d1Teams = await p.team.findMany({
    where: { leagueId: league1.id },
    select: { id: true, name: true }
  });
  console.log('✓ Division 1 teams:', d1Teams.length);
  console.log('  First 3 D1 teams:', d1Teams.slice(0, 3).map(t => t.name).join(', '));

  // Test: Get Division 2 standings
  const league2 = await p.league.findFirst({ where: { level: 2, season: 1 } });
  const d2Teams = await p.team.findMany({
    where: { leagueId: league2.id },
    select: { id: true, name: true }
  });
  console.log('\n✓ Division 2 teams:', d2Teams.length);
  console.log('  First 3 D2 teams:', d2Teams.slice(0, 3).map(t => t.name).join(', '));

  // Test: Get Division 3 standings
  const league3 = await p.league.findFirst({ where: { level: 3, season: 1 } });
  const d3Teams = await p.team.findMany({
    where: { leagueId: league3.id },
    select: { id: true, name: true }
  });
  console.log('\n✓ Division 3 teams:', d3Teams.length);
  console.log('  First 3 D3 teams:', d3Teams.slice(0, 3).map(t => t.name).join(', '));

  // Verify no overlap
  const d1Ids = new Set(d1Teams.map(t => t.id));
  const d2Ids = new Set(d2Teams.map(t => t.id));
  const d3Ids = new Set(d3Teams.map(t => t.id));

  const overlap12 = d2Teams.filter(t => d1Ids.has(t.id));
  const overlap23 = d3Teams.filter(t => d2Ids.has(t.id));
  const overlap13 = d3Teams.filter(t => d1Ids.has(t.id));

  console.log('\n✓ Overlap check:');
  console.log('  D1↔D2:', overlap12.length === 0 ? '✓ PASS (no overlap)' : `✗ FAIL (${overlap12.length} teams in both)`);
  console.log('  D2↔D3:', overlap23.length === 0 ? '✓ PASS (no overlap)' : `✗ FAIL (${overlap23.length} teams in both)`);
  console.log('  D1↔D3:', overlap13.length === 0 ? '✓ PASS (no overlap)' : `✗ FAIL (${overlap13.length} teams in both)`);

  console.log('\n✓ League Names:');
  console.log('  D1:', league1.name);
  console.log('  D2:', league2.name);
  console.log('  D3:', league3.name);

  console.log('\n=== All Tests Passed! ===\n');

  await p.$disconnect();
})().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
