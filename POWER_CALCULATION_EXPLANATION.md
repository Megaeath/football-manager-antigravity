/**
 * อธิบายการคิด Power ของนักเตะ
 * 
 * สูตรปัจจุบัน: Power = (currentSum / totalWeight / 20) * 100
 * 
 * ตัวอย่าง: ST (Striker) เปรียบเทียบนักเตะหลายคน
 */

// ST (Striker) weights:
// - shooting: 3
// - heading: 2  
// - pace: 2
// - composure: 2
// - positioning: 2
// Total weight = 11

// ========== ตัวอย่าง 1: นักเตะอ่อน ==========
// Attributes: shooting=8, heading=3, pace=2, composure=4, positioning=2
// currentSum = (8*3) + (3*2) + (2*2) + (4*2) + (2*2)
//            = 24 + 6 + 4 + 8 + 4
//            = 46
// totalWeight = 11
// Power = (46 / 11 / 20) * 100
//       = (4.18 / 20) * 100
//       = 0.209 * 100
//       = 20.9 → 21

console.log('=== ST Position Example ===');
console.log('Weak striker:');
console.log('  shooting=8, heading=3, pace=2, composure=4, positioning=2');
console.log('  currentSum = 46');
console.log('  Power = ~21');

// ========== ตัวอย่าง 2: นักเตะปกติ ==========
// Attributes: shooting=12, heading=8, pace=10, composure=11, positioning=9
// currentSum = (12*3) + (8*2) + (10*2) + (11*2) + (9*2)
//            = 36 + 16 + 20 + 22 + 18
//            = 112
// totalWeight = 11
// Power = (112 / 11 / 20) * 100
//       = (10.18 / 20) * 100
//       = 50.9 → 51

console.log('\nNormal striker:');
console.log('  shooting=12, heading=8, pace=10, composure=11, positioning=9');
console.log('  currentSum = 112');
console.log('  Power = ~51');

// ========== ตัวอย่าง 3: นักเตะดี ==========
// Attributes: shooting=18, heading=15, pace=16, composure=16, positioning=15
// currentSum = (18*3) + (15*2) + (16*2) + (16*2) + (15*2)
//            = 54 + 30 + 32 + 32 + 30
//            = 178
// totalWeight = 11
// Power = (178 / 11 / 20) * 100
//       = (16.18 / 20) * 100
//       = 80.9 → 81

console.log('\nGood striker:');
console.log('  shooting=18, heading=15, pace=16, composure=16, positioning=15');
console.log('  currentSum = 178');
console.log('  Power = ~81');

// ========== ตัวอย่าง 4: นักเตะดีเยี่ยม ==========
// Attributes: shooting=20, heading=20, pace=20, composure=20, positioning=20
// currentSum = (20*3) + (20*2) + (20*2) + (20*2) + (20*2)
//            = 60 + 40 + 40 + 40 + 40
//            = 220
// totalWeight = 11
// Power = (220 / 11 / 20) * 100
//       = (20 / 20) * 100
//       = 100

console.log('\nExcellent striker:');
console.log('  shooting=20, heading=20, pace=20, composure=20, positioning=20');
console.log('  currentSum = 220');
console.log('  Power = 100');

console.log('\n=== ปัญหาคือ: ===');
console.log('สูตร (currentSum / totalWeight / 20) * 100 มีปัญหาเพราะว่า:');
console.log('');
console.log('ถ้า weight มากกว่า = totalWeight มากขึ้น = Power ลดลง');
console.log('');
console.log('ตัวอย่าง: ST vs GK');
console.log('ST weights total = 11');
console.log('GK weights total = 3 + 2 + 2 + 1 = 8');
console.log('');
console.log('นักเตะที่มี attributes เหมือนกันหมด = 15');
console.log('ST: (15*11 / 11 / 20) * 100 = (15 / 20) * 100 = 75');
console.log('GK: (15*8 / 8 / 20) * 100 = (15 / 20) * 100 = 75');
console.log('');
console.log('ก็ได้เท่ากันดี แต่ปัญหาคือ weights ที่เลือกหากชาญฉลาดก็จะดูผิด');
console.log('');

console.log('=== สูตรที่ดีกว่า: ===');
console.log('Power = (currentSum / totalWeight) / 20 * 100');
console.log('      = (weighted average) / 20 * 100');
console.log('');
console.log('นี่คือค่าเฉลี่ย weighted ของ attributes ทั้งหมด');
console.log('แล้วเทียบกับ 20 (max attribute)');
