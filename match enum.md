เช็คให้แล้วครับ สรุปตาม engine ปัจจุบัน:

attacking_focus

ค่าที่ engine รองรับจริง: MIXED, CENTER, WINGS, CENTRAL, FORWARD, LEFT, RIGHT
mapping อยู่ใน match.ts:107-124
หมายเหตุสำคัญ: ตอนนี้ฟังก์ชัน getAttackingFocusBuff() ยัง ไม่ได้ถูกเรียกใช้ ใน flow จำลองแมตช์ (มีแค่ประกาศไว้)
passing

รองรับ: SHORT, MIXED, LONG, DIRECT
LONG และ DIRECT ให้ผลเดียวกัน
อยู่ใน match.ts:82-92
ถูกใช้ตอนคำนวณ action weight ที่ match.ts:23
creative_freedom

รองรับ: NORMAL, STRICT, FREEDOM, RESTRICTED, MAXIMUM
STRICT=RESTRICTED, FREEDOM=MAXIMUM
อยู่ใน match.ts:127-140
ถูกใช้ที่ match.ts:24
tackling

รองรับ: SOFT, NORMAL, HARD
อยู่ใน match.ts:95-105
ถูกใช้จริงในจังหวะดวล/ฟาวล์ที่ match.ts:279-282 และ match.ts:312
mentality

รองรับหลัก: ULTRA_DEFENSIVE, DEFENSIVE, NORMAL, ATTACKING, ALL_OUT_ATTACK
อยู่ใน match.ts:67-80