# 📚 Project Documentation Guide

> ไฟล์นี้เป็นตัวชี้บอกหลัก สำหรับหาเอกสารที่เหมาะสมตามสิ่งที่ต้องทำ

---

## 🏗️ **Architecture & System Design**

### เมื่อต้องการ...
- **เข้าใจสถาปัตยกรรมโดยรวม** → [copilot-instructions.md](.github/copilot-instructions.md)
- **เห็นโฟลว์ API ว่า endpoint อะไรพร้อม functions** → [API_REFERENCE.md](API_REFERENCE.md)
- **เข้าใจการจำลองแข่งขัน (match engine)** → copilot-instructions.md: "Match Simulation Pipeline"
- **เข้าใจระบบประสบการณ์ (EXP/Level)** → copilot-instructions.md: "Experience Decay System"
- **เข้าใจระบบการเงิน** → copilot-instructions.md: "Data Flow: Financial & Reputation"
- **เข้าใจกลวิธี (tactics)** → TACTICAL_GUIDE.md

---

## 🔧 **Development & Implementation**

### เมื่อต้องการ...
- **พัฒนา feature ใหม่โดยไม่ซ้ำของเก่า** → ให้อ่าน API_REFERENCE.md ก่อน
- **เข้าใจ code patterns** → copilot-instructions.md: "Critical Conventions & Patterns"
- **เพิ่ม API endpoint ใหม่** → API_REFERENCE.md: "Before Adding New API Endpoint"
- **ดัดแปลง match engine** → copilot-instructions.md: "Common Tasks: Fix match simulation bug"
- **เพิ่มกลวิธีใหม่** → TACTICAL_GUIDE.md + copilot-instructions.md
- **เข้าใจ Player Power calculation** → POWER_CALCULATION_EXPLANATION.md

---

## 📋 **Reference**

### Key Documents
| Document | Purpose |
|----------|---------|
| **.github/copilot-instructions.md** | ♻️ **ให้ AI agents อ่านก่อนพัฒนา** - Essential knowledge about architecture, conventions, patterns |
| **API_REFERENCE.md** | 📍 **ก่อนสร้าง API ใหม่** - Complete list of all 19 endpoints with input/output + what functions they call |
| **TACTICAL_GUIDE.md** | ⚽ **สำหรับเข้าใจกลวิธี** - How each tactic affects match outcomes |
| **POWER_CALCULATION_EXPLANATION.md** | 📊 **สำหรับ player power formula** - Weighted average calculation examples |
| **IMPLEMENTATION_COMPLETE.md** | ✅ **Historical record** - What was implemented in Phase 14 |
| **README.md** | 🚀 **Setup guide** - Getting started, dependencies, tech stack |

---

## 🎯 **Quick Decision Tree**

```
"ฉันต้องเพิ่ม feature ใหม่"
    ├─ "ต้องการ API endpoint ใหม่?"
    │  └─ YES → ตรวจ API_REFERENCE.md ว่ามีซ้อยหรือยัง
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
    └─ "ต้องแก้ไข contract/financial/EXP?"
       └─ YES → ตรวจ API_REFERENCE.md ว่า endpoint มีหรือยัง
```

---

## 🚀 **Setup & Running**

See: README.md

```bash
npm run dev          # Start dev server
npm run build        # Build & typecheck
npx prisma studio   # Database GUI
npx prisma db seed  # Reset seed data
```

---

## 💡 **Pro Tips for AI Agents**

1. **Before writing ANY new function**: Check API_REFERENCE.md first
2. **Before adding ANY new API endpoint**: Verify it doesn't already exist
3. **When touching match simulation**: Read copilot-instructions.md section "Match Simulation Execution"
4. **When adding tactics**: Update both TACTICAL_GUIDE.md and the engine
5. **When changing player attributes**: Remember EXP multiplier applies BEFORE simulation, not after
6. **When modifying financial system**: Trigger points are weekly processing + season end

---

## 📝 **Last Updated**
- March 3, 2026
- API Reference: 19 total endpoints documented
- Tactical System: 6 dimensions (formation, mentality, passing, tackling, attacking_focus, creative_freedom)
- Match Engine: ~1000 lines, handles 2,700 minute iterations

---

## 🔗 **File Locations**
```
/Users/auii/Project/game/
├── .github/
│   └── copilot-instructions.md      ← AI Agent Bible
├── API_REFERENCE.md                  ← API Endpoint Dictionary
├── TACTICAL_GUIDE.md                 ← Tactics System
├── POWER_CALCULATION_EXPLANATION.md  ← Player Power Formula
├── IMPLEMENTATION_COMPLETE.md        ← Phase 14 Summary
├── README.md                         ← Setup Guide
├── src/
│   ├── lib/
│   │   ├── engine/                  ← Core simulation logic
│   │   └── services/                ← Long-running services
│   ├── app/
│   │   ├── api/                     ← 19 endpoints
│   │   └── actions.ts               ← Server actions
│   └── components/                  ← React UI
└── prisma/
    └── schema.prisma                ← Database model
```

---

**Goal**: ให้เวลามี feature ใหม่ต้องเพิ่มไป AI agents ก็รู้ว่า:
✅ มีอยู่แล้วหรือ
✅ ต้องไปจัดการตรงไหน
✅ ใช้ functions อะไรสนับสนุน
✅ อย่าสร้างหรือซ้ำซ้อน
