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
- เพิ่มกลวิธีใหม่ → ดู [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md) และ [.github/copilot-instructions.md](.github/copilot-instructions.md)
- เข้าใจ Player Power calculation → ดู [POWER_CALCULATION_EXPLANATION.md](POWER_CALCULATION_EXPLANATION.md)
- เพิ่ม/แก้ระบบฝึกซ้อม → ดู [TRAINING.md](TRAINING.md) และ API `/api/training/*`

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
    └─ "ต้องแก้ contract/financial/EXP?"
       └─ YES → ตรวจ API_REFERENCE.md ว่า endpoint มีอยู่แล้วหรือยัง
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

---

## 📝 Last Updated

- April 4, 2026
- Added personal developer skill
- Added mandatory documentation-first workflow
- Reinforced API reuse and UX/UI consistency rules

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
