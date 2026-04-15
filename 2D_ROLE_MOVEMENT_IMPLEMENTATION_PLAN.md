# 2D Role Movement Implementation Plan (Draft-XY Tunable)

อ้างอิง requirement หลักจาก [2D_ROLE_MOVEMENT.md](2D_ROLE_MOVEMENT.md)

เป้าหมาย: ทำให้การเคลื่อนที่สมจริงตามตำแหน่ง, ลดการกองบอล, ลดแนวรับยุบหน้าประตู, ลดการยิงไกลไม่สมจริง โดยยอมให้ค่า X/Y เป็นค่าปรับจูนในระบบจริง

---

## Phase A — Baseline Calibration Layer (ก่อนลง role ลึก)

### A1) Team-side correctness + state correctness

- ยกเลิกการเดาทีมจาก `player.id` แล้วใช้ mapping ทีมจริงใน tick loop
- ทำ state ให้ชัด: `DEFENDING`, `IN_POSSESSION`, `ON_BALL`
- Files:
  - [src/lib/engine/v2/match2d.ts](src/lib/engine/v2/match2d.ts)
  - [src/lib/engine/v2/spatialEngine.ts](src/lib/engine/v2/spatialEngine.ts)
  - [src/lib/engine/v2/roleSpecialists/index.ts](src/lib/engine/v2/roleSpecialists/index.ts)

### A2) Tunable corridor config (X/Y draft → runtime-tunable)

- เพิ่มพารามิเตอร์ corridor ต่อ role+state ใน `TUNING_PARAMS`
- ตั้งชื่อชัด เช่น `roleCorridors.GK.DEFENDING`, `roleCorridors.DC.IN_POSSESSION`
- Files:
  - [src/lib/engine/v2/config.ts](src/lib/engine/v2/config.ts)

### A3) Anti-collapse spacing guard

- ใส่ guard กันนักเตะ role เดียวกันซ้อนตำแหน่ง
- ใส่ minimum teammate distance per line
- Files:
  - [src/lib/engine/v2/spatialEngine.ts](src/lib/engine/v2/spatialEngine.ts)
  - [src/lib/engine/v2/match2d.ts](src/lib/engine/v2/match2d.ts)

Acceptance:

- ไม่มีกลุ่ม 4-6 คนกองรอบบอลต่อเนื่องหลาย tick
- state mapping ถูกต้อง 100% ตาม possession

---

## Phase B — Role Specialists by Position (ตาม role ที่ตกลง)

> หมายเหตุ: ค่า X/Y ด้านล่างเป็น “ช่วงตั้งต้นสำหรับจูน” ไม่ใช่ค่าตายตัว

### 1) GK

- DEFENDING: angle play ตามบอล, คุมกรอบโทษ
- IN_POSSESSION: รีเซ็ตจุด build-up หน้าโกล
- ON_BALL: short outlet ก่อน, long outlet เมื่อโดน press
- Knobs:
  - `gkDefXMin/XMax`, `gkDefYMin/YMax`, `gkSweepDepth`, `gkLongKickPressureThreshold`
- Files:
  - [src/lib/engine/v2/roleSpecialists/goalkeeper.ts](src/lib/engine/v2/roleSpecialists/goalkeeper.ts)

### 2) DC

- DEFENDING: mark ST + hold line (between ball and goal)
- IN_POSSESSION: คุมโซนหลัง, เว้นระยะคู่เซ็นเตอร์
- ON_BALL: short safe first; long switch/target only on trigger
- Knobs:
  - `dcLineBaseX`, `dcMarkDistance`, `dcLongPassChanceUnderLowPress`
- Files:
  - [src/lib/engine/v2/roleSpecialists/defender.ts](src/lib/engine/v2/roleSpecialists/defender.ts)

### 3) DL/DR (Full Back)

- DEFENDING: track winger/side lane
- IN_POSSESSION: width support + overlap trigger
- ON_BALL: cross vs recycle decision
- Knobs:
  - `fbOverlapChance`, `fbTouchlineBias`, `fbCrossZoneX`
- Files:
  - [src/lib/engine/v2/roleSpecialists/defender.ts](src/lib/engine/v2/roleSpecialists/defender.ts)

### 4) DMC

- DEFENDING: shield zone (ball-goal midpoint bias)
- IN_POSSESSION: anchor pivot
- ON_BALL: recycle to DC/CM under pressure
- Knobs:
  - `dmcShieldOffsetX`, `dmcAnchorWidth`, `dmcSafePassBias`
- Files:
  - [src/lib/engine/v2/roleSpecialists/midfielder.ts](src/lib/engine/v2/roleSpecialists/midfielder.ts)

### 5) CM

- DEFENDING: central pressing trigger
- IN_POSSESSION: box-to-box support lanes
- ON_BALL: through ball when lane quality enough
- Knobs:
  - `cmPressRadius`, `cmLateRunChance`, `cmThroughBallThreshold`
- Files:
  - [src/lib/engine/v2/roleSpecialists/midfielder.ts](src/lib/engine/v2/roleSpecialists/midfielder.ts)

### 6) AMC

- DEFENDING: high press line 2
- IN_POSSESSION: between-lines pocket
- ON_BALL: killer pass > controlled shot in range
- Knobs:
  - `amcPocketBias`, `amcKillerPassWeight`, `amcShotMinX`
- Files:
  - [src/lib/engine/v2/roleSpecialists/attacking.ts](src/lib/engine/v2/roleSpecialists/attacking.ts)

### 7) ML/MR (Wide Midfielder)

- DEFENDING: track back support FB
- IN_POSSESSION: keep width (stretch)
- ON_BALL: cross/inside-cut ตามมุม
- Knobs:
  - `wmTrackBackDepth`, `wmWidthLock`, `wmInsideCutChance`
- Files:
  - [src/lib/engine/v2/roleSpecialists/attacking.ts](src/lib/engine/v2/roleSpecialists/attacking.ts)

### 8) LW/RW (Winger)

- DEFENDING: press opponent FB
- IN_POSSESSION: run half-space/channel
- ON_BALL: cut-in shot/cross/through (priority by context)
- Knobs:
  - `wingChannelRunBias`, `wingCutInChance`, `wingCrossWeight`
- Files:
  - [src/lib/engine/v2/roleSpecialists/attacking.ts](src/lib/engine/v2/roleSpecialists/attacking.ts)

### 9) ST

- DEFENDING: first line press / stay high
- IN_POSSESSION: occupy box + offside-safe pin
- ON_BALL: shoot in realistic zone; hold-up under high pressure
- Knobs:
  - `stBoxOccupyBias`, `stShotMinX`, `stHoldUpPressureThreshold`
- Files:
  - [src/lib/engine/v2/roleSpecialists/forward.ts](src/lib/engine/v2/roleSpecialists/forward.ts)

Acceptance:

- Role compliance > 90% (อยู่ corridor ถูก state)
- ตำแหน่งบทบาทต่างกันชัดเจน ไม่เคลื่อนที่เหมือนกัน

---

## Phase C — Team Shape + Action Realism

### C1) Defensive shape ไม่ยืนเส้นเดียว

- แยก press/cover/line holders เป็นหลายชั้น (back/mid/front)
- line height ผูกกับ zone + score state + pressure
- Files:
  - [src/lib/engine/v2/spatialEngine.ts](src/lib/engine/v2/spatialEngine.ts)
  - [src/lib/engine/v2/match2d.ts](src/lib/engine/v2/match2d.ts)

### C2) Shot gating realism

- ลด/ตัดโอกาสยิงจาก own half
- role-specific shot floor (AMC/ST > CM > DMC/DC/GK)
- Files:
  - [src/lib/engine/v2/match2d.ts](src/lib/engine/v2/match2d.ts)

### C3) Pass realism

- ไม่ใช่ fail เฉพาะ interception: เพิ่ม pass error จาก pressure + distance + receiver openness
- ลด safe loop ส่งวนหลังเมื่อ trailing/need progression
- Files:
  - [src/lib/engine/v2/spatialEngine.ts](src/lib/engine/v2/spatialEngine.ts)
  - [src/lib/engine/v2/match2d.ts](src/lib/engine/v2/match2d.ts)

Acceptance:

- แทบไม่มีการยิงจากแดนตัวเอง
- progressive pass สูงขึ้นในช่วงทีมต้องบุก
- defensive block ไม่ยุบติดโกลต่อเนื่อง

---

## Phase D — Telemetry, QA, and Tuning Loop

### D1) Telemetry per-role compliance

- วัด % เวลาอยู่ใน corridor ต่อ role+state
- วัด crowd index, line spread, shot origin bins, progressive pass rate
- Files:
  - [src/lib/engine/v2/telemetry.ts](src/lib/engine/v2/telemetry.ts)
  - [src/lib/engine/v2/types2d.ts](src/lib/engine/v2/types2d.ts)

### D2) Visual debug overlay

- แสดง intent vectors + line anchors + press/cover marker
- Files:
  - [src/app/match/components/DebugLayer.tsx](src/app/match/components/DebugLayer.tsx)
  - [src/app/match/components/MatchCanvas.tsx](src/app/match/components/MatchCanvas.tsx)

### D3) API telemetry surfacing

- ส่ง engine summary ใน replay API
- Files:
  - [src/app/api/match/[id]/v2-sim/route.ts](src/app/api/match/[id]/v2-sim/route.ts)
  - [API_REFERENCE.md](API_REFERENCE.md)

Acceptance:

- replay generation ยังเร็ว
- มีข้อมูลพอให้จูนแบบรอบสั้นได้

---

## Execution Order (แนะนำ)

1. Phase A (ต้องทำก่อนเสมอ)
2. Phase B (role-by-role)
3. Phase C (shape + action realism)
4. Phase D (telemetry + QA tuning)

---

## Definition of Done (รอบนี้)

- ไม่กองบอลผิดธรรมชาติ
- แนวรับไม่เรียงหน้าประตูแบบ block เดียว
- ยิงไกลจากแดนตัวเองลดลงอย่างมีนัยสำคัญ
- พฤติกรรม role แยกกันชัดตาม state
- telemetry ยืนยัน role compliance และ shape quality ได้
