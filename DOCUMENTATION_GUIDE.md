# 📚 Project Documentation Guide

> ไฟล์นี้เป็นตัวชี้บอกหลัก สำหรับหาเอกสารที่เหมาะสมตามสิ่งที่ต้องทำ

---

## 🧠 Read First Every Time

- เริ่มทุกงานด้วย [.github/personal-game-dev-skill.md](.github/personal-game-dev-skill.md)
- จากนั้นอ่าน [.github/copilot-instructions.md](.github/copilot-instructions.md)
- ก่อนแตะ API, data flow, หรือ route ใด ๆ ให้อ่าน [API_REFERENCE.md](API_REFERENCE.md)

---

## 🏗️ Architecture & System Design

### เมื่อต้องการดูภาพรวมระบบ

- เข้าใจสถาปัตยกรรมโดยรวม → [.github/copilot-instructions.md](.github/copilot-instructions.md)
- เห็นโฟลว์ API ว่า endpoint อะไรพร้อม functions → [API_REFERENCE.md](API_REFERENCE.md)
- เข้าใจการจำลองแข่งขัน (match engine) → `.github/copilot-instructions.md` หัวข้อ `Match Simulation Pipeline`
- เข้าใจระบบประสบการณ์ (EXP/Level) → `.github/copilot-instructions.md` หัวข้อ `Experience Decay System`
- เข้าใจระบบการเงิน → `.github/copilot-instructions.md` หัวข้อ `Data Flow: Financial & Reputation`
- เข้าใจระบบฝึกซ้อม → [TRAINING.md](TRAINING.md) และ [.github/copilot-instructions.md](.github/copilot-instructions.md)
- เข้าใจกลวิธี → [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md)
- เข้าใจสรุปซีซัน / leaderboards แบบคลิกได้ → หน้า `/season-summary` (ชื่อนักเตะเปิด modal, นัดเปิดหน้า `/match`, ทีมเปิดหน้า team)
- เข้าใจการนำทางไปหน้ารายละเอียดการแข่งขัน → ใช้หน้า `/fixtures` หรือการ์ด match ต่าง ๆ ที่ลิงก์ไป `/match?matchId=...`
- ทดลอง replay แบบ spatial ในหน้าจริง → หน้า `/match` เลือก Visualization = `V2 Canvas` (โหลดจาก `/api/match/[id]/v2-sim`)
- หน้า `/match` โหมด V2 replay ซ่อนแถบหัวข้อ visualization เดิม (`Visualization`, `V2 Canvas`, `Regenerate V2 Replay`) เพื่อโฟกัสเฉพาะ scoreboard/canvas/highlight
- ถ้าแมตช์ยังไม่ถูก process (`isPlayed=false`) หน้า `/match` ต้องแสดงเฉพาะ scoreboard ด้านบน (เช่น `0-0`) และซ่อนส่วน replay/session + tabs ทั้งหมดจนกว่าจะกด process match
- ช่องคำบรรยายใต้ replay จะแสดงเหตุการณ์สำคัญ (GOAL/SHOT/CARD) แบบตัวใหญ่และ ticker-style เพื่อให้อ่านง่ายขึ้นระหว่างดูไฮไลต์
- กล่องคำบรรยายใต้ replay ควรแสดงแบบบรรทัดเดียว (single-line ticker + ellipsis) เพื่อไม่กินพื้นที่แนวตั้งและไม่บังโซน control/filter
- ใต้ scoreboard ของ replay มีตัวกรอง `Animation Event` (`all`, `SHOT`, `PASS`, `DRIBBLE`) สำหรับคุม marker/ข้อความเหตุการณ์ที่แสดงระหว่าง animation โดยตรง
- เมื่อเลือก `Animation Event` ไม่ใช่ `all` replay จะเล่นเฉพาะช่วงนาทีของ event + นาทีถัดไป แล้วข้ามไปช่วง event ถัดไปอัตโนมัติ
- สำหรับแมตช์ที่เล่นแล้ว โหมดกรอง `PASS`/`DRIBBLE` ของ animation จะอิง replay incident stream เพื่อให้มีช่วงเหตุการณ์ให้เล่นจริง (เพราะ persisted authoritative events มักไม่มีเหตุการณ์ละเอียดระดับ pass/dribble)
- Ticker ใต้ replay จะค้างข้อความเหตุการณ์ตาม config ประมาณ 30 ticks (ปัจจุบันเน้น SHOT/FOUL context/YELLOW/RED) และถ้ามีเหตุการณ์ใหม่ในกลุ่มเดียวกันจะทับข้อความเดิมทันที
- เมื่อเปิด `Animation Event` filter (ไม่ใช่ `all`) ticker ควรค้างข้อความของ event ที่ถูกกรองไว้ชั่วคราวด้วย (เช่น `PASS`/`DRIBBLE`) เพื่อให้อ่านช่วงที่ replay ข้ามเป็นหน้าต่าง event ได้ทัน
- หน้า `/match` โหมด V2 Canvas ตัดแถวตัวเลข telemetry ด้านบนออกแล้ว เพื่อขยายกรอบ replay/highlight ให้สูงขึ้นและอ่านเหตุการณ์ง่ายกว่าเดิม
- ใน V2 Canvas ลูกบอลแสดงเป็นลายฟุตบอลพร้อมการหมุนตามการเล่น; ถ้าเห็นลูกบอลเป็นจุดขาวคงที่ แปลว่ามี regression ใน `BallLayer`
- ถ้าต้องเทียบตำแหน่ง replay กับ DB/action logs ให้ดู label `x,y` ที่แสดงตลอดบนตัวนักเตะทุกคนและลูกบอลในหน้า `/match` V2 canvas โดยตรง
- ถ้า refresh หน้า `/match` แล้ว V2 Canvas telemetry เปลี่ยนเอง ให้ตรวจว่า route ถูกเรียกด้วย seed ปกติของ `matchId` หรือมี `variant` สำหรับ manual regenerate เท่านั้น
- ถ้า V2 Canvas ของแมตช์ที่เล่นจบแล้วแสดงผู้เล่นผิดคนหรือยังเห็นผู้เล่นที่โดนแดงอยู่ ให้ตรวจว่า replay กำลังอิง persisted participants/minutes และ persisted `CARD_RED` ของแมตช์ ไม่ใช่ roster ปัจจุบัน
- สำหรับผู้เล่นโดนแดง V2 Canvas ควรไม่วาดเป็นผู้เล่น active บนสนาม แต่แสดงในแถบ `Sent off (Off-field)` ใต้สนามแทน
- วิเคราะห์ตำแหน่งครองบอล/ตำแหน่งเหตุการณ์บนสนาม → หน้า `/match` แท็บ `Heat Map` (รองรับ filter event: all/SHOT/PASS/DRIBBLE, team: all/home/away, และ player: all/ผู้เล่นรายคน โดยแสดงชื่อ+ตำแหน่ง, เรียงตำแหน่ง `GK -> DF -> MF -> FW`, จำกัดเฉพาะผู้เล่นที่ลงสนามจริงจาก replay frame participants และ fallback เป็น persisted played-minutes สำหรับ legacy rows, พร้อมการแรเงาแบบกระจายพื้นที่เพื่ออ่าน movement zone รายคนได้สมจริงขึ้น)
- Heat Map บน `/match` เก็บ marker coordinate ฝั่ง data เป็นค่า replay/action-log (`x,y` ช่วง `0..100`) และตอน render บน SVG สนาม `150x100` จะ map แบบเชิงเส้นเป็น `renderX = x * 1.5`, `renderY = y`
- หน้า `/match` แท็บ `Events` และแท็บ `Heat Map` ใช้ชุดค่า event filter เดียวกันจาก master config (`all`, `SHOT`, `PASS`, `DRIBBLE`) เพื่อให้การกรองสอดคล้องกัน
- เมื่อ debug Heat Map ให้ยึด score/event ที่ persisted แล้วเป็นหลัก: จำนวน goal markers ต้องตรงกับ persisted `GOAL` events/score ของแมตช์ ไม่ใช่ทุกประตูจาก replay V2 ที่ generate ใหม่
- เมื่อ audit marker source: `SHOT`/`PASS`/`DRIBBLE` มาจาก `v2Replay.visualEvents[].position`; `GOAL` marker ต้องอิง persisted `GOAL` events เป็นหลัก (ตำแหน่งใช้ replay goal ถ้ามี ไม่งั้น fallback)
- Heat Map marker บนสนามจะแสดงป้าย minute ของ event ด้วย เพื่อให้ตรวจเทียบตำแหน่ง+เวลาได้ทันที (hover marker เพื่อดู source/raw/svg coordinate เพิ่มเติม)
- เมื่อ debug replay scoreboard บน `/match` ให้ยึด goal progression จาก persisted match events และ final persisted score เป็นหลัก (ไม่ควรแกว่งตาม replay-generated goals เพียงอย่างเดียว)
- ปุ่ม `Advance to Next Day` ต้องไม่ข้ามแมตช์ของผู้เล่น: ถ้ามี user pending match (today/overdue) flow ต้องพาเข้า `/match?matchId=...` ทันทีและคงบังคับเข้าแมตช์ทุกครั้งที่กดจนกว่าจะเล่นแมตช์นั้น
- เมื่อ debug highlight/commentary บน `/match` ให้ยึด persisted match events แบบ strict สำหรับแมตช์ที่เล่นแล้ว: ไม่ควรดึง replay-generated incidents มาปะปนจนขัดกับ score/event ที่บันทึก
- เวลาใน replay UI ของหน้า `/match` ควรแสดงนาทีแบบตัวเลขเดี่ยว `0` ... `90` (ใน player control และข้อความคำบรรยาย) และตัดบรรทัดหัว `Minute xx` เหนือคำบรรยายออกเพื่อลดความสูง UI; canonical minute ใน DB/events ยังคงเป็น `1..90`
- แท็บผู้เล่นบนหน้า `/match` (`home`/`away`) ต้องเรียงข้อมูลแบบคงที่: ตัวจริง 11 คนก่อน แล้วค่อยตัวสำรอง โดยแต่ละกลุ่มเรียง `GK -> DF -> MF -> FW`; เมื่อมีการเปลี่ยนตัว ห้ามสลับแถวตัวจริงขึ้นลงตามตัวที่ลงมาใหม่ เพื่อให้เห็นชัดว่าตัวสำรองคนไหนได้ลงเล่น
- ในแท็บผู้เล่นหน้า `/match` เมื่อกด expand การ์ดนักเตะ (`Action Breakdown`/`Detailed Action Stats`) ให้ยึดค่า analytics จาก raw logs เป็นหลัก และ fallback เป็น persisted row stats (`passes/crosses/dribbles/shots`) เมื่อ raw logs ไม่มี/ไม่ครบ เพื่อเลี่ยงเคสตัวเลข 0 ทั้งบล็อกทั้งที่แถวหลักมีสถิติ
- เข้าใจการนำทางจากหน้า Home → `/` (Top Scorers คลิกชื่อนักเตะเปิด modal, ตารางลีกคลิกชื่อทีมไปหน้า `/team/[id]`)
- Header หลักด้านบนจะย่อแรงขึ้นเมื่อ scroll ลง โดยโลโก้ `⚽ FOOTBALL MANAGER` จะเหลือประมาณครึ่งหนึ่งของขนาดปกติเพื่อคืนพื้นที่ให้ content
- เข้าใจ Cup standings และการกดดูทีม → หน้า `/cup` (คลิกชื่อทีมในตารางไปหน้า `/team/[id]`)
- เข้าใจการ debug flow ทั้งเกมแบบ loop-by-loop → หน้า `/debug` (ใช้ raw action logs จาก `/api/match/[id]/actions`)
- เมื่อ debug replay 1:1 กับ DB ให้ตรวจ `/api/match/[id]/actions` ที่เรียงลำดับ `minute -> tick -> sequence` และใช้ `logType` (`ACTION`/`MOVEMENT`) + `x,y` เป็นฐาน
- **ทดสอบ action simulation แบบแยกตัว** → หน้า `/test-simulate` (เลือกทีม → นักเตะ → action → จำลองหลายรอบ → ดูผลลัพธ์แบบตาราง)
- ปรับความสมจริงของ V2 spatial decision (มีบอล/ไม่มีบอล) → `src/lib/engine/v2/match2d.ts` + `src/lib/engine/v2/spatialEngine.ts`

---

## 🔧 Development & Implementation

### กติกาบังคับของโปรเจกต์

- ทุกครั้งที่แก้โค้ด ต้องอัปเดตเอกสารที่เกี่ยวข้องในงานเดียวกัน
- ห้ามสร้าง API ใหม่ ถ้ายังไม่ได้ตรวจ [API_REFERENCE.md](API_REFERENCE.md)
- ห้ามเดาโครงสร้างระบบเอง ถ้ายังไม่ได้อ่านเอกสารหลักก่อน
- ทุก UI/UX ใหม่ต้องสอดคล้องกับ pattern เดิมของเกม

### เมื่อต้องการพัฒนา/แก้ระบบ

- พัฒนา feature ใหม่โดยไม่ซ้ำของเก่า → อ่าน [API_REFERENCE.md](API_REFERENCE.md) ก่อน
- เข้าใจ code patterns → ดู [.github/copilot-instructions.md](.github/copilot-instructions.md) หัวข้อ `Critical Conventions & Patterns`
- เพิ่ม API endpoint ใหม่ → ดู [API_REFERENCE.md](API_REFERENCE.md) หัวข้อ `Before Adding New API Endpoint`
- ดัดแปลง match engine → ดู `.github/copilot-instructions.md` หัวข้อ `Common Tasks: Fix match simulation bug`
- ปรับ logic ตัดสินใจ V2 (PASS/SHOOT/DRIBBLE + loose-ball race) → ดู `.github/copilot-instructions.md` หัวข้อ `1.3 V2 Spatial Decision Model`
- เพิ่มกลวิธีใหม่ → ดู [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md) และ [.github/copilot-instructions.md](.github/copilot-instructions.md)
- เข้าใจ Player Power calculation → ดู [POWER_CALCULATION_EXPLANATION.md](POWER_CALCULATION_EXPLANATION.md)
- เพิ่ม/แก้ระบบฝึกซ้อม → ดู [TRAINING.md](TRAINING.md) และ API `/api/training/*`
- เพิ่ม/แก้ flow `Settings > New Game` หรือ legend mode → ดู `.github/copilot-instructions.md` หัวข้อ `Fix/reset new game initialization` และ `Legend mode new game`
- เพิ่ม/แก้ระบบหมายเลขเสื้อ → ดู `src/lib/services/jerseyNumberService.ts` + จุดย้ายทีมใน `src/lib/engine/market.ts`

### เมื่อแก้อะไร ต้องอัปเดตเอกสารไหน

- API change → อัปเดต [API_REFERENCE.md](API_REFERENCE.md)
- Architecture/workflow/debugging change → อัปเดต [.github/copilot-instructions.md](.github/copilot-instructions.md)
- Feature navigation / where-to-edit guidance change → อัปเดต [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
- Tactic behavior / wording / UX semantics change → อัปเดต [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md) เมื่อเกี่ยวข้อง

---

## 📋 Reference

### Key Documents

| Document | Purpose |
| --- | --- |
| **.github/personal-game-dev-skill.md** | อ่านเป็นอันดับแรก - Personal developer contract, mandatory workflow, documentation-first rules, API reuse rules, UX/UI consistency rules |
| **.github/football-production-owner-skill.md** | โหมดวิเคราะห์ requirement ก่อนลงมือ dev - สร้าง Requirement Analysis Pack, acceptance criteria, risk, และ handoff ให้ developer |
| **.github/copilot-instructions.md** | คู่มือสถาปัตยกรรมหลัก - Essential knowledge about architecture, conventions, and patterns |
| **API_REFERENCE.md** | ก่อนสร้าง API ใหม่ - Complete list of all endpoints with input/output and support functions |
| **TRAINING.md** | ระบบฝึกซ้อม - Facility levels, weekly fee, slot rules, decimal behavior |
| **TACTICAL_GUIDE.md** | ระบบกลวิธี - How each tactic affects match outcomes |
| **POWER_CALCULATION_EXPLANATION.md** | สูตร player power - Weighted average calculation examples |
| **IMPLEMENTATION_COMPLETE.md** | บันทึก implementation เดิม - Historical reference |
| **README.md** | Setup guide - Getting started, dependencies, tech stack |

---

## 🎯 Quick Decision Tree

```text
"ฉันต้องเพิ่ม feature ใหม่"
    ├─ "ต้องการวิเคราะห์ requirement ก่อนส่ง dev?"
    │  └─ YES → ใช้ `.github/football-production-owner-skill.md`
    │          เพื่อสร้าง Requirement Analysis Pack ให้ครบก่อน
    │
    ├─ "ต้องการ API endpoint ใหม่?"
    │  └─ YES → ตรวจ API_REFERENCE.md ว่ามีซ้ำหรือยัง
    │          ↓
    │          "มีใน /api/... แล้ว?"
    │          ├─ YES → ใช้ endpoint ที่มีอยู่, อย่าสร้างใหม่
    │          └─ NO  → อ่าน "Before Adding New API Endpoint"
    │
    ├─ "ต้องแก้ match engine?"
    │  └─ YES → ดู copilot-instructions.md: "Fix match simulation bug"
    │
    ├─ "ต้องเพิ่มกลวิธี?"
    │  └─ YES → ดู TACTICAL_GUIDE.md + IMPLEMENTATION_COMPLETE.md
    │
    ├─ "ต้องแก้ระบบ training/facility?"
    │  └─ YES → ดู TRAINING.md + API_REFERENCE.md หมวด Training APIs
    │
    ├─ "ต้องแก้ contract/financial/EXP?"
    │  └─ YES → ตรวจ API_REFERENCE.md ว่า endpoint มีอยู่แล้วหรือยัง
    │
    └─ "ต้องทดสอบ action simulation / หาค่าตัวแปรที่เหมาะสม?"
       └─ YES → ใช้หน้า `/test-simulate` (ไม่ต้องบันทึก, เพียงจำลองและแสดงผล)
```

---

## 🚀 Setup & Running

ดู [README.md](README.md)

```bash
npm run dev
npm run build
npx prisma studio
npx prisma db seed
```

---

## 💡 Pro Tips for AI Agents

1. ก่อนเขียน function ใหม่ ให้อ่าน `.github/personal-game-dev-skill.md` และเช็ก `API_REFERENCE.md`
2. ก่อนเพิ่ม API endpoint ใหม่ ต้องยืนยันก่อนว่ายังไม่มี endpoint/function เดิมรองรับ
3. เมื่อแตะ match simulation ให้อ่าน `copilot-instructions.md` หัวข้อ `Match Simulation Execution`
4. เมื่อเพิ่ม tactics ให้ update ทั้ง engine และ [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md)
5. เมื่อเปลี่ยนพฤติกรรม UI, API, หรือ setup ต้องอัปเดตเอกสารในงานเดียวกัน
6. เมื่อแก้ระบบการเงิน ต้องระวัง trigger รายสัปดาห์และ season end
7. เมื่อแก้สมดุล match engine ให้ตรวจหน้า `/debug` (Action Stream + Chain + Zone) เพื่อตรวจ regression เชิงพฤติกรรม

---

## 📝 Last Updated

- April 11, 2026
- Added personal developer skill
- Added mandatory documentation-first workflow
- Reinforced API reuse and UX/UI consistency rules
- Added `/debug` navigation guidance for full-match action flow analysis
- Added `/test-simulate` page for isolated action simulation testing
- Added `football-production-owner-skill.md` for requirement analysis and developer handoff workflow

---

## 🔗 File Locations

```text
/Users/auii/Project/game/
├── .github/
│   ├── personal-game-dev-skill.md   ← Read first before any code change
│   └── copilot-instructions.md      ← AI Agent Bible
├── API_REFERENCE.md                 ← API Endpoint Dictionary
├── TACTICAL_GUIDE.md                ← Tactics System
├── POWER_CALCULATION_EXPLANATION.md ← Player Power Formula
├── IMPLEMENTATION_COMPLETE.md       ← Phase 14 Summary
├── README.md                        ← Setup Guide
├── src/
│   ├── lib/
│   │   ├── engine/                  ← Core simulation logic
│   │   └── services/                ← Long-running services
│   ├── app/
│   │   ├── api/                     ← endpoints (including Training APIs)
│   │   └── actions.ts               ← Server actions
│   └── components/                  ← React UI
└── prisma/
    └── schema.prisma                ← Database model
```

---

**Goal**: ให้ AI agents รู้ว่าอะไรมีอยู่แล้ว, ต้องแก้ตรงไหน, ใช้ function อะไรรองรับ, และต้องไม่สร้างสิ่งซ้ำซ้อนโดยไม่จำเป็น
