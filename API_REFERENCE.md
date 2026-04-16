# API Endpoints - Complete Reference Guide

> **วัตถุประสงค์**: เอกสารนี้ช่วยให้ AI agents เห็นว่า API ไหนมีอยู่แล้ว ทำอะไร และ functions อะไรสนับสนุน เพื่อไม่ต้องสร้างหรือดัดแปลงซ้ำสิ่งที่มีอยู่แล้ว

> **กติกาใช้งาน**: ก่อนเพิ่ม route, server action, fetch flow, หรือ API behavior ใหม่ ต้องตรวจเอกสารนี้ก่อนเสมอ เพื่อหลีกเลี่ยงการสร้างซ้ำและเพื่อให้ logic ใหม่สอดคล้องกับ architecture เดิม

---

## 🎮 Match & Simulation APIs

### 1. `GET /api/match/[id]`

**ตัวอักษร**: `/api/match/:matchId`

**สิ่งที่ทำ**: ดึงข้อมูลรายละเอียดการแข่งขันทั้งหมด (สถิติผู้เล่น, เหตุการณ์, คะแนน)

**Input**:

- `matchId` - Match ID

**Output**:

```json
{
  "id": "...",
  "homeTeam": { "id": "...", "name": "..." },
  "awayTeam": { "id": "...", "name": "..." },
  "homeGoals": 2,
  "awayGoals": 1,
  "playerStats": [
    {
      "playerId": "...",
      "name": "...",
      "jerseyNumber": 9,
      "rating": 7.5,
      "goals": 1,
      "assists": 0,
      "passesCompleted": 45,
      "tacklesWon": 3,
      "shotsonTarget": 2,
      "defensiveThirdTouches": 12,
      "middleThirdTouches": 34,
      "attackingThirdTouches": 9
    }
  ],
  "events": [
    { "minute": 15, "type": "GOAL", "playerId": "...", "playerName": "..." }
  ]
}
```

**Calls**:

- `prisma.match.findUnique()` - ดึงข้อมูลแข่งขันพร้อม statistics

**Notes**:

- Route นี้เป็น source of truth สำหรับ score, events, player stats, และ team stats บนหน้า `/match`
- `events[].minute` เป็น canonical match minute แบบ `1..90` (ไม่ใช่ zero-based)
- ถ้าเป็นแมตช์ `AI vs AI` ที่ยังไม่ถูกเล่น แต่ถูกเปิดเข้ามาดูตรง ๆ route นี้จะ process แมตช์นั้นก่อน แล้วค่อยคืน persisted result/stats กลับไป

---

### 20. `GET /api/match/[id]/actions`

**ตัวอักษร**: Raw Action Logs per Match

**สิ่งที่ทำ**: ดึง action logs แบบละเอียดทุก action ของนัด (per tick/per action)

**Input Query**:

- `playerId` (optional) - filter เฉพาะนักเตะ
- `snapshotMinute` (optional) - filter เฉพาะ canonical minute (`1..90`) เพื่อดึง tick ทั้งหมดของนาทีนั้นสำหรับ replay sync

**Output**:

```json
{
  "matchId": "...",
  "totalLogs": 1200,
  "teamZones": {
    "team_home": { "defensive": 210, "middle": 430, "attacking": 180, "total": 820 }
  },
  "byPlayer": {
    "player_1": {
      "zones": { "defensive": 5, "middle": 33, "attacking": 21, "total": 59 },
      "actions": {
        "PASS_SHORT": { "attempts": 28, "success": 24, "fail": 4, "successRate": 86 }
      }
    }
  },
  "rawLogs": [
    {
      "minute": 37,
      "tick": 12,
      "sequence": 4,
      "logType": "ACTION",
      "x": 58,
      "y": 45,
      "ballPosition": 64,
      "actionType": "PASS_SHORT",
      "trickGroup": "PASS",
      "trick": "PASS",
      "result": "SUCCESS",
      "isSuccessful": true,
      "expectedSuccessRate": 0.78
    },
    {
      "minute": 37,
      "tick": 12,
      "sequence": 5,
      "logType": "MOVEMENT",
      "x": 59,
      "y": 44,
      "ballPosition": 65,
      "actionType": "MOVEMENT",
      "trickGroup": "MOVEMENT",
      "trick": "POSITION_SAMPLE",
      "result": "TRACK",
      "isSuccessful": true
    }
  ]
}
```

**Calls**:

- `playerActionLog.findMany()`

**Notes**:

- Log rows are returned in deterministic timeline order: `minute ASC` → `tick ASC` → `sequence ASC` (fallback to legacy ordering if old schema/client is still used)
- `logType` separates high-frequency movement samples (`MOVEMENT`) from incident/action rows (`ACTION`)
- Tick-level fields (`tick`, `sequence`, `x`, `y`, `trickGroup`, `trick`) support 1:1 replay reconstruction from persisted logs
- `x` / `y` in `PlayerActionLog` are now reserved for **BALL position only**
- For per-tick player movement, route can return compact snapshot rows (`actionType = TICK_SNAPSHOT`) where all on-field players are grouped in `metadata`

---

### 21. `GET /api/player/[id]/analytics`

**ตัวอักษร**: Player Raw-Action Analytics

**สิ่งที่ทำ**: คำนวณ summary จาก raw action logs ของนักเตะ (ไม่เก็บ summary ตายตัว)

**Input Query**:

- `season` (optional) - สรุปทั้งฤดูกาล
- `matchId` (optional) - สรุปเฉพาะนัด

**Output**:

```json
{
  "playerId": "...",
  "seasonSummary": {
    "zones": { "defensive": 120, "middle": 560, "attacking": 210 },
    "actions": {
      "PASS_SHORT": { "attempts": 300, "success": 260, "fail": 40, "successRate": 87 },
      "DRIBBLE": { "attempts": 80, "success": 45, "fail": 35, "successRate": 56 }
    }
  },
  "byMatch": { "match_1": { "zones": {}, "actions": {} } },
  "rawLogs": []
}
```

**Calls**:

- `playerActionLog.findMany()`

---

### 25. `GET /api/match/[id]/v2-sim`

**ตัวอักษร**: V2 Spatial Replay (On-demand)

**สิ่งที่ทำ**: สร้าง replay ของแมตช์แบบ V2 spatial simulation แบบ on-demand สำหรับหน้า `/match` (โหมด develop/analysis)

**Input**:

- `matchId` - Match ID
- `variant` (optional query) - alternate replay seed for manual regeneration; omitted by default so persisted matches return the same replay/telemetry on normal refresh

**Output**:

```json
{
  "success": true,
  "matchId": "...",
  "replay": {
    "homeScore": 1,
    "awayScore": 1,
    "frames": [
      {
        "minute": 12,
        "tick": 4,
        "ball": { "position": { "x": 52, "y": 44 }, "possession": "home" },
        "playerPositions": { "player_1": { "x": 49, "y": 40 } },
        "events": [],
        "debug": {
          "intents": [
            {
              "playerId": "player_1",
              "team": "home",
              "job": "SUPPORT",
              "from": { "x": 49, "y": 40 },
              "to": { "x": 54, "y": 43 },
              "priority": 74,
              "utilityScore": 77,
              "context": "spec:Mid circulation"
            }
          ],
          "defensive": {
            "home": { "presserId": "home_4", "coverId": "home_6", "lineX": 31.5 },
            "away": { "presserId": "away_5", "coverId": "away_8", "lineX": 68.2 }
          }
        }
      }
    ],
    "visualEvents": [],
    "telemetry": {
      "frameCount": 1080,
      "intentJobCounts": { "SUPPORT": 1200, "DEFEND": 980 },
      "pressEvents": 340,
      "coverEvents": 295,
      "passSelection": {
        "sampleCount": 160,
        "avgRisk": 0.22,
        "avgUtility": 61.4,
        "samples": []
      }
    },
    "playerMovementAnalytics": {
      "player_1": {
        "movementDistance": 932.4,
        "carryDistance": 84.1,
        "carrySeconds": 76,
        "zoneSeconds": { "defensive": 1120, "middle": 3180, "attacking": 1100 },
        "samples": 5400
      }
    }
  },
  "telemetry": {
    "durationMs": 198,
    "frameCount": 1080,
    "visualEventCount": 410,
    "visualEventCountByType": { "PASS": 220, "DRIBBLE": 80, "SHOT": 42 },
    "score": "1-1",
    "engineSummary": {
      "frameCount": 1080,
      "intentJobCounts": { "SUPPORT": 1200, "DEFEND": 980 },
      "pressEvents": 340,
      "coverEvents": 295
    }
  }
}
```

**Calls**:

- `simulateMatch2D()`
- `prisma.match.findUnique()` + team/player projection

**Notes**:

- Replay frames may include `ballTransitions` for smooth pass/shot travel on the canvas
- V2 simulation cadence is config-driven and currently runs at `10 ticks/minute`
- Saved shots stay visible by ending the trajectory at the goalkeeper instead of instantly snapping possession
- Replay frames may include `debug` overlay payload (intent vectors + defensive assignment) for V2 tuning mode
- Top-level `telemetry.engineSummary` mirrors replay telemetry summary for quick API-side diagnostics
- `replay.playerMovementAnalytics` summarizes per-player continuous movement/carry data sampled every tick (ready for future heatmap)
- V2 dribble counting distinguishes **carry** vs **dribble duel**: simple lane-carry is not counted as `dribblesWon`; only opponent-beating dribbles are counted
- V2 replay now emits set-piece/discipline incidents with V1-like conditions (`THROW_IN`, `CORNER`, `FOUL`, `CARD_YELLOW`, `CARD_RED`) so match event/state tabs can show non-shot incidents from simulation output
- สำหรับแมตช์ที่ถูกเล่นและ persisted แล้ว ค่า score ใน replay response จะถูกล็อกให้ตรงกับผลที่บันทึกใน `Match.homeScore` / `Match.awayScore` และ team stats ที่บันทึกไว้ เพื่อไม่ให้หน้า `/match` แสดงผลแข่งแกว่งตาม replay ที่ generate ใหม่
- สำหรับ persisted match การเรียก route แบบปกติจะใช้ deterministic seed จาก `matchId` ทำให้ refresh หน้าแล้ว replay / telemetry เดิมไม่เปลี่ยนเอง; ถ้ากด regenerate จึงค่อยส่ง `variant` เพื่อขอ replay seed ใหม่โดยตั้งใจ
- สำหรับ already-played match route จะ prefer ผู้เล่นที่มี persisted minutes เป็น participants ของ replay และจะถอดผู้เล่นที่มี persisted `CARD_RED` ออกจาก active replay หลังนาทีที่โดนไล่ออก
- หน้า `/match` ต้องใช้ `/api/match/[id]` เป็น authoritative score/stats เสมอ ส่วน `/api/match/[id]/v2-sim` ใช้สำหรับ visualization layer

---

## 🏋️ Training APIs

### 22. `GET /api/training`

**ตัวอักษร**: Training State (User Team)

**สิ่งที่ทำ**: ดึงสถานะระบบฝึกซ้อมของทีมผู้เล่น (facility, slots, weekly status, attribute decimals)

**Input**: ไม่มี

**Output**:

```json
{
  "team": {
    "id": "team_1",
    "trainingFacilityLevel": 2,
    "facility": { "level": 2, "weeklyFee": 60000, "maxGain": 0.15 },
    "nextFacility": { "level": 3, "upgradeCost": 7500000 },
    "canAffordNextWeek": true
  },
  "slots": [
    { "slotIndex": 1, "playerId": "p1", "focusAttribute": "passing", "isActive": true, "lastGain": 0.12 }
  ],
  "players": [
    {
      "id": "p1",
      "name": "...",
      "effectiveAttributes": { "passing": 14.35 }
    }
  ],
  "weekly": {
    "currentWeekKey": 2891,
    "lastStatus": "APPLIED",
    "lastChargedFee": 60000
  }
}
```

**Calls**:

- `getTrainingState()`

---

### 23. `PATCH /api/training/slots/[slotIndex]`

**ตัวอักษร**: Update Training Slot (Auto-save)

**สิ่งที่ทำ**: ตั้งค่าผู้เล่นและ attribute ใน slot (1-5) แบบทันทีเมื่อเปลี่ยน dropdown

**Input**:

```json
{
  "playerId": "player_1",
  "focusAttribute": "shooting"
}
```

**Output**:

```json
{
  "success": true,
  "slot": {
    "slotIndex": 1,
    "playerId": "player_1",
    "focusAttribute": "shooting",
    "isActive": true
  }
}
```

**Calls**:

- `updateTrainingSlot()`

---

### 24. `POST /api/training/facility/upgrade`

**ตัวอักษร**: Upgrade Training Facility

**สิ่งที่ทำ**: อัปเกรด facility เลเวล + หักเงินทันที + บันทึก financial event

**Input**: ไม่มี

**Output**:

```json
{
  "success": true,
  "level": 3,
  "upgradeCost": 7500000
}
```

**Calls**:

- `upgradeTrainingFacility()`

---

### 2. `GET /api/simulate`

**ตัวอักษร**: Simulation Test Route

**สิ่งที่ทำ**: ทดสอบระบบจำลองการแข่งขัน (สุ่มเลือก 2 ทีม)

**Input**: ไม่มี

**Output**:

```json
{
  "match": {
    "homeTeam": { "name": "...", "formation": "4-4-2" },
    "awayTeam": { "name": "...", "formation": "4-3-3" },
    "homeGoals": 2,
    "awayGoals": 1,
    "playerStats": { "playerId": { "goals": 1, "rating": 8.0, ... } }
  }
}
```

**Calls**:

- `simulateMatch()` - เรียกใช้ match engine (src/lib/engine/match.ts)
- `toPlayerAttributes()`, `PlayerState` mapping

---

## 📅 Game & Process APIs

### 3. `GET /api/game/info`

**ตัวอักษร**: ข้อมูล Global Game State

**สิ่งที่ทำ**: ดึงสถานะเกมปัจจุบัน (วันที่, ซีซั่น, ทีมของผู้เล่น)

**Input**: ไม่มี

**Output**:

```json
{
  "currentDate": "2026-03-03T00:00:00Z",
  "currentSeason": 1,
  "userTeamId": "team_123",
  "lastExpDecayMonth": 3
}
```

**Calls**:

- `getGameTime()` - ส่งคืน GlobalGameSettings

---

### 4. `POST /api/game/process`

**ตัวอักษร**: Game Loop Control

**สิ่งที่ทำ**: ควบคุมเกมเมน (จำลองแข่งขัน, เปลี่ยนแปลงทีม, ล้อมสิ้นสุด)

**Actions Supported**:

#### `play_next_match`

- ตัวอักษร: เล่นแข่งขันถัดไป
- `Input`:

  ```json
  { "action": "play_next_match" }
  ```

- `Calls`:
  - `processMatch(matchId)` - จำลองแข่งขัน (matchSimulator.ts)
  - `processMatchFinancials()` - อัพเดทเงิน, ความสามารถ, สถานะ

#### `update_match_tactics`

- ตัวอักษร: บันทึกกลวิธีสำหรับแข่งขัน
- `Input`:

  ```json
  {
    "action": "update_match_tactics",
    "matchId": "...",
    "homeTactics": { "mentality": "ATTACKING", "passing": "MIXED" },
    "awayTactics": { "mentality": "DEFENSIVE" }
  }
  ```

- `Calls`:
  - `prisma.match.update()` - บันทึก match-specific tactics
  - `autoSelectTactics()` - เลือก tactics อัตโนมัติสำหรับ AI teams

#### `advance_day`

- ตัวอักษร: เดิน 1 วัน
- `Calls`:
  - `advanceDay()` - เพิ่มวันที่, ตรวจสอบการแข่งขัน, ประมวลผล financials

#### `next_process`

- ตัวอักษร: ประมวลผลคิวการแข่งขันแบบปลอดภัย (AI ก่อน)
- พฤติกรรมสำคัญ:
  - จำลองอัตโนมัติเฉพาะ **AI vs AI**
  - ถ้ามีแมตช์ของทีมผู้เล่นค้างอยู่ (ทั้งวันนี้หรือค้างจากวันก่อน) ระบบจะ `requiresUserAction=true` และ **ไม่** auto-sim ให้
  - ออกแบบเพื่อป้องกันความฟิต/สถิติทีมผู้เล่นเพี้ยนจากการ auto-process
- `Calls`:
  - `processMatch(matchId)` สำหรับแมตช์ AI-only
  - `processMatchFinancials(matchId)` หลังจำลองแมตช์ AI-only
  - `advanceDay()` จะถูกเรียกก็ต่อเมื่อไม่มี user pending match
- `Response` (when user match blocks processing):
  - `requiresUserAction: true`
  - `userMatchId`: id ของแมตช์ทีมผู้เล่นที่ต้องเล่นเอง
  - `userPendingType`: `today` หรือ `overdue` (ใช้บอกสาเหตุใน UI ว่าคือนัดวันนี้หรือนัดค้าง)

---

## 🏆 League & Fixtures APIs

### 5. `GET /api/league/fixtures`

**ตัวอักษร**: ตารางการแข่งขัน

**สิ่งที่ทำ**: ดึงการแข่งขันในวันที่ระบุ (หรือทั้งหมดถ้าไม่มี date)

**Input Query**:

- `date` (optional) - ISO date string (เช่น "2026-03-03")

**Output**:

```json
[
  {
    "id": "match_1",
    "date": "2026-03-03T15:00:00Z",
    "homeTeam": { "id": "...", "name": "Team A" },
    "awayTeam": { "id": "...", "name": "Team B" },
    "season": 1
  }
]
```

**Calls**:

- `prisma.match.findMany()` - ดึงข้อมูลการแข่งขัน UTC-aware

---

## 👥 Player APIs

### 6. `GET /api/players/search`

**ตัวอักษร**: ค้นหา/ลิสต์ผู้เล่น

**สิ่งที่ทำ**: ดึงรายชื่อผู้เล่นทั้งหมดพร้อมข้อมูล Power, Market Value, Form

**Input**: ไม่มี

**Output**:

```json
[
  {
    "id": "player_1",
    "name": "John Smith",
    "jerseyNumber": 11,
    "age": 28,
    "position": "FWR",
    "power": 78.5,
    "avgRating": 7.2,
    "marketValue": 3500000,
    "team": { "name": "Team A" },
    "popularity": 65
  }
]
```

**Calls**:

- `calculatePlayerPower()` - คำนวณ Power based on attributes + exp
- `toPlayerAttributes()` - แปลง DB attributes → engine format

---

### 7. `GET /api/players/market-value`

**ตัวอักษร**: Market Value Calculation

**สิ่งที่ทำ**: คำนวณ market value สำหรับผู้เล่นหรือทีม

**Input Query**:

- `playerId` (optional)
- `teamId` (optional)

**Output**:

```json
[
  {
    "playerId": "...",
    "name": "...",
    "marketValue": 4200000,
    "overall": 81,
    "ageMultiplier": 0.95,
    "popularityFactor": 1.1
  }
]
```

**Calls**:

- `calculatePlayerOverall()` - เฉลี่ย attributes ทั้ง 3 หมวด
- `calculateMarketValue()` - formula: `(overall² × popularity / 1000) × ageMultiplier × 50000`

---

### 8. `GET /api/player/[id]`

**ตัวอักษร**: รายละเอียดผู้เล่น

**สิ่งที่ทำ**: ข้อมูลผู้เล่นแบบลึก (สถิติรายซีซั่น, ประวัติการโอน, records)

**Input**:

- `playerId` - Player ID

**Output**:

```json
{
  "id": "...",
  "name": "...",
  "age": 28,
  "team": { "name": "..." },
  "attributes": {
    "passing": 15,
    "shooting": 16,
    "pace": 17
  },
  "seasonStats": [
    {
      "season": 1,
      "apps": 25,
      "goals": 10,
      "assists": 5,
      "avgRating": 7.8
    }
  ],
  "transferHistory": [
    { "fromTeam": "...", "toTeam": "...", "date": "2026-01-15" }
  ]
}
```

**Calls**:

- `prisma.player.findUnique()` + aggregates for seasons
- `calculatePlayerPower()` for "power" display

---

### 9. `PATCH /api/player/[id]/status`

**ตัวอักษร**: อัพเดท Player Transfer Status

**สิ่งที่ทำ**: เปลี่ยน transfer status และ asking price

**Input**:

```json
{
  "transferStatus": "LISTED",
  "askingPrice": 5000000
}
```

**Output**:

```json
{
  "success": true,
  "player": { "id": "...", "transferStatus": "LISTED" }
}
```

**Calls**:

- `prisma.player.update()` - บันทึก transfer info

---

## 💼 Contracts APIs

### 10. `GET /api/contracts`

**ตัวอักษร**: รายชื่อสัญญาที่หมดอายุ

**สิ่งที่ทำ**: ดึงผู้เล่นที่มีสัญญาหมดอายุในฤดูกาล

**Input Query**:

- `teamId` - Team ID

**Output**:

```json
{
  "teamId": "...",
  "teamName": "Team A",
  "expiringPlayers": [
    {
      "id": "...",
      "name": "...",
      "age": 32,
      "weeklyWage": 15000,
      "contractEndWeek": 2
    }
  ],
  "totalExpiring": 3
}
```

**Calls**:

- `getExpiringContracts(teamId)` - ดึงผู้เล่นที่ contractEndWeek ≤ ค่าหนึ่ง
- `handleContractRenewal(playerId, weeks)` - ต่อสัญญา

---

### 11. `POST /api/contracts`

**ตัวอักษร**: ต่อสัญญาผู้เล่น

**Input**:

```json
{
  "playerId": "...",
  "weeks": 104
}
```

**Output**:

```json
{
  "success": true,
  "newWage": 18000,
  "newEndWeek": 106
}
```

**Calls**:

- `handleContractRenewal()` - ต่อสัญญา + เพิ่ม wage 10%

---

## 💰 Market APIs (Transfer/Bidding)

### 12. `POST /api/market/bid`

**ตัวอักษร**: ส่ง Bid ให้ผู้เล่น

**สิ่งที่ทำ**: ส่ง bid สำหรับผู้เล่น listed

**Input**:

```json
{
  "playerId": "...",
  "fromTeamId": "...",
  "amount": 5000000,
  "signOnBonus": 100000,
  "isFreeAgent": false
}
```

**Output**:

```json
{
  "success": true,
  "message": "Bid submitted",
  "bid": { "id": "...", "amount": 5000000, "status": "PENDING" }
}
```

**Calls**:

- `submitBid()` - ตรวจสอบ FFP, ส่ง bid, บันทึก FinancialEvent

> หมายเหตุสำคัญเกี่ยวกับดีลที่ถูกยอมรับจากสโมสร (เข้าสถานะรอปิดหน้าต่าง / `PENDING`):
> เมื่อสโมสรต้นสังกัดยอมรับข้อเสนอ (ทั้งจาก flow ยื่น bid ปกติ และ flow จัดการบิด) ระบบจะ **ล็อก/ตัดเงินทีมผู้ซื้อทันที** (ยังไม่ย้ายทีมทันที)
> เพื่อกันการใช้ช่องว่างช่วงรอย้ายทีมไปยื่นซื้อผู้เล่นเพิ่มเกินงบเดิม

---

### 13. `GET /api/market/bids`

**ตัวอักษร**: ดึง Bids ทั้งหมด

**สิ่งที่ทำ**: ดึง bids ที่ pending/completed (filterable)

**Input Query**:

- `teamId` (optional) - filter bids for this team
- `playerId` (optional) - filter bids for this player
- `season` (optional) - filter by season
- `page` (optional, default 1)
- `limit` (optional, default 20)

**Output**:

```json
{
  "bids": [
    {
      "id": "bid_1",
      "playerId": "...",
      "player": { "name": "...", "naturalPosition": "FW" },
      "fromTeam": { "name": "..." },
      "toTeam": { "name": "..." },
      "amount": 5000000,
      "status": "ACCEPTED",
      "createdAt": "2026-03-03T10:00:00Z"
    }
  ],
  "total": 15,
  "totalPages": 1,
  "availableSeasons": [1, 2]
}
```

**Calls**:

- `prisma.bid.findMany()` - ดึง bids + pagination

---

## 💵 Financial APIs

### 14. `GET /api/finances`

**ตัวอักษร**: สถานะการเงินทีม

**สิ่งที่ทำ**: ดึงข้อมูลเงิน ค่าใช้จ่าย รายได้ ของทีม

**Input Query**:

- `teamId` - Team ID

**Output**:

```json
{
  "teamId": "...",
  "balance": 2500000,
  "weeklyWages": 180000,
  "weeklyIncome": 420000,
  "weeklyProfit": 240000,
  "reputation": 72,
  "ffpStatus": "COMPLIANT",
  "recentTransactions": [
    { "type": "SEASON_REWARD", "amount": 500000 },
    { "type": "PLAYER_SOLD", "amount": 2000000 }
  ]
}
```

**Calls**:

- `prisma.financialEvent.aggregate()` - รวม transactions
- `checkFFPCompliance()` - ตรวจสอบ FFP

---

## 🎯 Tactics APIs

### 15. `GET /api/team/[id]/tactics`

**ตัวอักษร**: ดึง Team Tactics

**สิ่งที่ทำ**: ดึง tactics ปัจจุบัน (ปกติ/นำ/ตามหลัง)

**Input**:

- `teamId` - Team ID

**Output**:

```json
{
  "teamId": "...",
  "normalFormation": "4-4-2",
  "normalMentality": "NORMAL",
  "normalPassing": "MIXED",
  "normalTackling": "NORMAL",
  "normalAttacking_focus": "MIXED",
  "normalCreative_freedom": "NORMAL",
  "behindFormation": "4-4-2",
  "behindMentality": "ALL_OUT_ATTACK",
  "behindPassing": "DIRECT",
  "leadingFormation": "4-4-2",
  "leadingMentality": "ULTRA_DEFENSIVE"
}
```

**Calls**:

- `prisma.teamTactics.findUnique()` - ดึง tactics
- Auto-create defaults if not exists

---

### 16. `PUT /api/team/[id]/tactics`

**ตัวอักษร**: อัพเดท Team Tactics

**สิ่งที่ทำ**: เปลี่ยน formation/mentality/passing/etc

**Input**:

```json
{
  "normalMentality": "ATTACKING",
  "normalPassing": "LONG",
  "normalAttacking_focus": "WINGS",
  "normalCreative_freedom": "FREEDOM"
}
```

**Output**:

```json
{ "success": true, "tactics": { ... } }
```

**Calls**:

- `prisma.teamTactics.update()` - บันทึก tactics

---

## 📰 News APIs

### 17. `GET /api/news`

**ตัวอักษร**: ดึงข่าวสาร

**สิ่งที่ทำ**: ดึงข่าวทั่วไป (global) หรือข่าวทีม

**Input Query**:

- `teamId` (optional) - ถ้าให้, ดึง global + ข่าวทีมนั้น

**Output**:

```json
{
  "news": [
    {
      "id": "news_1",
      "title": "Team A wins the league!",
      "type": "SEASON_REWARD",
      "date": "2026-03-03T10:00:00Z",
      "teamId": null
    }
  ]
}
```

**Calls**:

- `prisma.news.findMany()` - ดึง news + filter by teamId

---

## 🐛 Debug APIs

### 18. `GET /api/debug/simple`

**ตัวอักษร**: ดึง Recent Bids (test route)

**สิ่งที่ทำ**: ตรวจดู 5 bids ล่าสุด (debug purposes)

**Input**: ไม่มี

**Output**:

```json
{
  "success": true,
  "bids": [...]
}
```

---

### 19. `GET /api/debug/ai-market`

**ตัวอักษร**: AI Market Movements Debugger

**สิ่งที่ทำ**: ทำให้ AI ส่ง bids (ถ้า trigger=true) + ดึง stats

**Input Query**:

- `trigger` (optional, "true"/"false") - Trigger AI bids?

**Output**:

```json
{
  "success": true,
  "trigger": true,
  "listedCount": 5,
  "bidCount": 12,
  "recentBids": [...],
  "listedPlayers": [...],
  "logs": ["AI bid submitted: ...", ...]
}
```

**Calls**:

- `processAIMarketMovements(logs)` - ทำให้ AI teams ส่ง bids

---

## 📊 API Call Dependency Matrix

```text
High-Level Flow:
1. GET /api/game/info → ดึง currentDate, userTeamId
2. GET /api/league/fixtures → ดึงการแข่งขันของวันนั้น
3. POST /api/game/process (action: play_next_match) 
   → processMatch() → processMatchFinancials() 
   → updatePlayerPopularity(), updateTeamReputation()
4. GET /api/player/[id] → ดูผล match
5. GET /api/finances → ตรวจสอบเงิน
6. POST /api/game/process (action: advance_day) → เดินวันต่อไป
```

---

## 🚨 Common Patterns to Avoid Duplication

### Pattern 1: Player Power Calculation

- **Already exists**: `calculatePlayerPower()` ใน playerPower.ts
- **Don't create**: ส่วน power calculation ใหม่
- **Use**: ตัว function นี้ที่มีอยู่แล้ว

### Pattern 2: Market Value Calculation

- **Has two implementations** (inconsistency issue!):
  - `/api/players/search` - uses power-based calculation
  - `/api/players/market-value` - uses overall-based calculation
- **Recommendation**: merge เป็น 1 function เดียว

### Pattern 3: Contract Renewal

- **Already exists**: `handleContractRenewal()` ใน financial.ts
- **Don't create**: ส่วนต่อสัญญาใหม่

### Pattern 4: Match Simulation

- **Already exists**: `processMatch()` ใน matchSimulator.ts
- **Includes**:
  - `simulateMatch()` - เรียก engine
  - `processMatchFinancials()` - อัพเดท DB after match
  - `updatePlayerPopularity()`, `updateTeamReputation()`
- **Don't create**: ใหม่เว้นแต่ต้องขยายระบบมาก

### Pattern 5: Game Time Management

- **Already exists**: `advanceDay()`, `getGameTime()` ใน gameTime.ts
- **Handles**:
  - UTC date advancement
  - Daily match trigger
  - Season end detection
  - EXP decay check
- **Don't create**: ใหม่

---

## ✅ Before Adding New API Endpoint

1. **Check if functionality exists in engine**: `src/lib/engine/*.ts`
2. **Check if service exists**: `src/lib/services/*.ts`
3. **Check if API route exists**: `src/app/api/*/route.ts`
4. **Check if it uses database**: `prisma/schema.prisma` ของแบบจำลอง
5. **If function exists but not exposed**: Add API route, don't rewrite function
6. **If function overlaps with existing**: Consolidate logic first

Last updated: March 2026 (includes Training APIs)
