/**
 * วิเคราะห์นักเตะ Trent De Bruyne - MC Position
 */

const attributes = {
    shooting: 9,
    heading: 10,
    pace: 8,
    composure: 7,
    positioning: 13,
    tackling: 8,
    dribbling: 13,
    passing: 20,
    stamina: 17,
    vision: 20,
};

// MC weights:
const weights = {
    passing: 3,
    vision: 3,
    stamina: 2,
    teamwork: 2,
    dribbling: 1,
    // Note: technique is not in attributes, so it's skipped
};

console.log('=== Trent De Bruyne Analysis ===\n');
console.log('Position: MC (Central Midfielder)');
console.log('\nWeights for MC:');
console.log('  passing: 3');
console.log('  vision: 3');
console.log('  stamina: 2');
console.log('  teamwork: 2');
console.log('  dribbling: 1');
console.log('  Total weight = 11\n');

console.log('Attributes (actual):');
console.log('  passing: 20');
console.log('  vision: 20');
console.log('  stamina: 17');
console.log('  teamwork: (missing from data - probably 0)');
console.log('  dribbling: 13\n');

// Calculate with teamwork = 0
let currentSum = 0;
let totalWeight = 0;

// Only count attributes that exist
const attrWeights = {
    'passing': 3,
    'vision': 3,
    'stamina': 2,
    'dribbling': 1
};

Object.entries(attrWeights).forEach(([stat, weight]) => {
    const value = attributes[stat] || 0;
    currentSum += value * weight;
    totalWeight += weight;
    console.log(`  ${stat}: ${value} × ${weight} = ${value * weight}`);
});

console.log(`\nTotal weight (without teamwork): ${totalWeight}`);
console.log(`Current sum: ${currentSum}`);

const power = (currentSum / totalWeight / 20) * 100;
console.log(`\nForula: (${currentSum} / ${totalWeight} / 20) * 100`);
console.log(`      = (${currentSum / totalWeight} / 20) * 100`);
console.log(`      = ${(currentSum / totalWeight / 20).toFixed(4)} * 100`);
console.log(`      = ${power.toFixed(1)} → ${Math.round(power)}`);

console.log('\n=== ปัญหา: ===');
console.log('ในตัวแบบนี้ passing=20 และ vision=20 (max ทั้งคู่)');
console.log('ส่วน stamina=17 ก็ดีอยู่แล้ว ทำให้ power สูงมากถึง ~91');
console.log('');
console.log('แต่ถ้าดูโครงสร้าง attributes ทั้งหมด 22 ตัวแล้ว');
console.log('ส่วน 17 ตัวที่ไม่ได้ใช้กำลังลดมาจาก attributes อื่น');
console.log('ที่อาจจะต่ำ เช่น shooting, heading, pace ฯลฯ');
console.log('');
console.log('เลยดูเหมือนว่า Power ที่ 91 สูงเกินไป');
console.log('เพราะมันไม่คิด attributes ตัวอื่นที่เพิ่มเติม');
