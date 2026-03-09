/**
 * Test Youth System - ทดสอบระบบนักเตะเยาวชน
 * 
 * คำนวณและแสดงผลจำนวนนักเตะ talented vs normal ที่แต่ละทีมจะได้รับ
 * ตามอันดับที่จบในฤดูกาลที่แล้ว
 */

// Simulate getTalentedYouthCount function
function getTalentedYouthCount(ranking: number, totalTeams: number): number {
    const normalized = (ranking - 1) / (totalTeams - 1);
    const talented = Math.round(1 + (normalized * 3));
    return Math.max(1, Math.min(4, talented));
}

const YOUTH_PLAYERS_PER_TEAM = 5;
const totalTeams = 20;

console.log('='.repeat(80));
console.log('🧪 YOUTH SYSTEM TEST - ระบบนักเตะเยาวชน');
console.log('='.repeat(80));
console.log('');
console.log('📋 กฎระเบียบ:');
console.log('  • ทุกทีมได้นักเตะ 5 คนเท่ากัน');
console.log('  • อันดับดี (1) = ได้นักเตะดี 1 คน + สุ่ม 4 คน');
console.log('  • อันดับแย่ (20) = ได้นักเตะดี 4 คน + สุ่ม 1 คน');
console.log('  • ช่วยให้ทีมอันดับท้ายมีโอกาสฟื้นตัว');
console.log('');
console.log('='.repeat(80));
console.log('');

const teams = [
    { name: 'Champions United', ranking: 1 },
    { name: 'Your Team', ranking: 2 },
    { name: 'Silver City', ranking: 3 },
    { name: 'Mid Table FC', ranking: 10 },
    { name: 'Struggling Town', ranking: 15 },
    { name: 'Bottom Dwellers', ranking: 19 },
    { name: 'Last Place FC', ranking: 20 }
];

console.log('┌────────┬─────────────────────────┬──────────┬──────────┬─────────┐');
console.log('│ Rank   │ Team Name               │ Talented │ Normal   │ Total   │');
console.log('├────────┼─────────────────────────┼──────────┼──────────┼─────────┤');

for (const team of teams) {
    const talentedCount = getTalentedYouthCount(team.ranking, totalTeams);
    const normalCount = YOUTH_PLAYERS_PER_TEAM - talentedCount;
    
    const rankStr = `#${team.ranking}`.padEnd(7);
    const nameStr = team.name.padEnd(23);
    const talentedStr = `${talentedCount} ⭐`.padEnd(9);
    const normalStr = `${normalCount}`.padEnd(9);
    const totalStr = `${YOUTH_PLAYERS_PER_TEAM}`.padEnd(8);
    
    console.log(`│ ${rankStr}│ ${nameStr}│ ${talentedStr}│ ${normalStr}│ ${totalStr}│`);
}

console.log('└────────┴─────────────────────────┴──────────┴──────────┴─────────┘');
console.log('');

// Calculate all rankings distribution
console.log('📊 การกระจายนักเตะทั้งหมด 20 ทีม:');
console.log('');

let totalTalented = 0;
let totalNormal = 0;

for (let ranking = 1; ranking <= totalTeams; ranking++) {
    const talentedCount = getTalentedYouthCount(ranking, totalTeams);
    const normalCount = YOUTH_PLAYERS_PER_TEAM - talentedCount;
    
    totalTalented += talentedCount;
    totalNormal += normalCount;
    
    const bar = '█'.repeat(talentedCount) + '░'.repeat(normalCount);
    console.log(`  Rank ${ranking.toString().padStart(2)}: ${bar} (${talentedCount} talented, ${normalCount} normal)`);
}

console.log('');
console.log('='.repeat(80));
console.log(`📈 สรุป:`);
console.log(`  • รวมนักเตะทั้งหมด: ${totalTeams * YOUTH_PLAYERS_PER_TEAM} คน`);
console.log(`  • นักเตะดี (Talented): ${totalTalented} คน (${(totalTalented / (totalTeams * YOUTH_PLAYERS_PER_TEAM) * 100).toFixed(1)}%)`);
console.log(`  • นักเตะสุ่ม (Normal): ${totalNormal} คน (${(totalNormal / (totalTeams * YOUTH_PLAYERS_PER_TEAM) * 100).toFixed(1)}%)`);
console.log(`  • ค่าเฉลี่ยนักเตะดีต่อทีม: ${(totalTalented / totalTeams).toFixed(2)} คน`);
console.log('='.repeat(80));
console.log('');
console.log('✅ ระบบนี้ช่วยให้ทีมอันดับท้ายมีโอกาสได้นักเตะดีๆ เพื่อฟื้นตัว');
console.log('✅ ทีมแชมป์ยังคงมีความได้เปรียบจากการเงินและนักเตะที่มีอยู่แล้ว');
console.log('');
