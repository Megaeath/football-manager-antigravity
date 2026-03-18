# ⚽ Football Manager Engine - Master Development Guide

> **Comprehensive guideline for updating or creating new features**  
> **Last Updated**: March 17, 2026  
> **Project Version**: 0.1.0 (Phase 16 Complete)

---

## 📖 Table of Contents

1. [Quick Start](#-quick-start)
2. [Project Overview](#-project-overview)
3. [Architecture Decision Tree](#-architecture-decision-tree)
4. [Core Systems Reference](#-core-systems-reference)
5. [Development Patterns](#-development-patterns)
6. [Feature Implementation Checklist](#-feature-implementation-checklist)
7. [Database Schema Guide](#-database-schema-guide)
8. [API Development Guide](#-api-development-guide)
9. [Match Engine Modification Guide](#-match-engine-modification-guide)
10. [UI Component Patterns](#-ui-component-patterns)
11. [Testing & Verification](#-testing--verification)
12. [Common Gotchas & Solutions](#-common-gotchas--solutions)
13. [File Reference Map](#-file-reference-map)

---

## 🚀 Quick Start

### For New Features
```bash
# 1. Check existing APIs first
cat API_REFERENCE.md

# 2. Understand architecture
cat .github/copilot-instructions.md

# 3. Run development server
npm run dev

# 4. After changes, verify build
npm run build
```

### For Bug Fixes
```bash
# 1. Identify system area (match, finance, training, etc.)
# 2. Check relevant documentation section below
# 3. Locate files using File Reference Map
# 4. Fix → Build → Test
```

### Database Operations
```bash
npx prisma studio          # Visual DB browser
npx prisma db push         # Sync schema changes
npx prisma migrate dev     # Create + apply migration
npx prisma db seed         # Reset with seed data
```

---

## 🎯 Project Overview

### Tech Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework |
| **Language** | TypeScript 5 | Type-safe development |
| **Database** | SQLite | Local high-speed persistence |
| **ORM** | Prisma 6 | Database schema + queries |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **State** | Database-driven | Persistent game state |

### Core Concepts

**1. Database-Driven State**
- All game state persisted in SQLite via Prisma
- No client-side state management (Redux, Zustand, etc.)
- UI revalidates via `revalidatePath()` after mutations

**2. Match Simulation Engine**
- Pure TypeScript simulation in `src/lib/engine/match.ts`
- Runs 2,700 iterations (90 min × 30 actions/min)
- Probabilistic action selection based on attributes + tactics
- Logs every action to `PlayerActionLog` for analytics

**3. Three-Layer Attribute System**
```
Base Attributes (0-20) 
    ↓
Experience Multiplier (up to +20% at 1000 EXP)
    ↓
Condition/Morale Modifiers (0-100%)
    ↓
Effective Attributes (used in match)
```

**4. Weekly Processing Cycle**
- Training fees charged
- Player popularity updated
- Team reputation updated
- FFP compliance checked
- Training gains applied

**5. Season Cycle**
- EXP adjustments applied
- Awards distributed
- Aging/retirement processed
- League standings finalized

---

## 🌳 Architecture Decision Tree

### "I Need to Add a New Feature"

```
START
  │
  ▼
┌─────────────────────────────────────────┐
│ 1. What type of feature?                │
└─────────────────────────────────────────┘
  │
  ├─→ "New API endpoint" ──┬─→ Check API_REFERENCE.md
  │                         │   Does it already exist?
  │                         ├─ YES → Use existing endpoint
  │                         └─ NO  → Follow API Development Guide
  │
  ├─→ "Modify match simulation" ──┬─→ Read: Match Engine Modification Guide
  │                                └─→ Check: src/lib/engine/match.ts
  │
  ├─→ "Add tactical dimension" ──┬─→ Read: TACTICAL_GUIDE.md
  │                               ├─→ Check: IMPLEMENTATION_COMPLETE.md
  │                               └─→ Modify: schema.prisma + match.ts
  │
  ├─→ "Add training mechanic" ──┬─→ Read: TRAINING.md
  │                              ├─→ Check: API_REFERENCE.md → Training APIs
  │                              └─→ Modify: src/lib/services/training.ts
  │
  ├─→ "Modify financial system" ──┬─→ Read: finance requirement.md
  │                                ├─→ Check: src/lib/engine/financial.ts
  │                                └─→ Check: API_REFERENCE.md → Financial APIs
  │
  ├─→ "Add player progression" ──┬─→ Read: exp rules.md
  │                               ├─→ Check: src/lib/engine/experience.ts
  │                               └─→ Modify: processMatch() + startNewSeason()
  │
  ├─→ "New UI page/component" ──┬─→ Read: UI Component Patterns
  │                              ├─→ Check: src/app/ structure
  │                              └─→ Follow: Server/Client component pattern
  │
  └─→ "Change database schema" ──┬─→ Read: Database Schema Guide
                                 ├─→ Modify: prisma/schema.prisma
                                 └─→ Run: npx prisma migrate dev
```

### "I Need to Fix a Bug"

```
START
  │
  ▼
┌─────────────────────────────────────────┐
│ 1. Identify bug category                │
└─────────────────────────────────────────┘
  │
  ├─→ "Match simulation wrong" ──┬─→ Check: match.ts calculateActionWeights()
  │                               ├─→ Verify: tactic buffs applied correctly
  │                               └─→ Test: scripts/test-match.ts
  │
  ├─→ "Player power incorrect" ──┬─→ Check: src/lib/engine/playerPower.ts
  │                               ├─→ Verify: EXP multiplier applied
  │                               └─→ Test: node test-power.js
  │
  ├─→ "Financial calculation error" ──┬─→ Check: src/lib/engine/financial.ts
  │                                    ├─→ Verify: weekly processing logic
  │                                    └─→ Inspect: Prisma Studio
  │
  ├─→ "UI not updating" ──┬─→ Check: revalidatePath() called?
  │                       ├─→ Verify: Server Action used
  │                       └─→ Check: TypeScript errors
  │
  └─→ "Database query slow" ──┬─→ Check: Prisma query includes
                               ├─→ Add: @@index to schema
                               └─→ Optimize: select only needed fields
```

---

## ⚙️ Core Systems Reference

### 1. Match Simulation System

**Purpose**: Simulate football matches with realistic statistics

**Key Files**:
- `src/lib/engine/match.ts` - Core simulation logic (~1100 lines)
- `src/lib/services/matchSimulator.ts` - Service layer wrapper
- `src/lib/engine/types.ts` - Type definitions

**Data Flow**:
```
Database (Match, Team, Player)
    ↓
matchSimulator.processMatch(matchId)
    ↓
Convert DB models → Engine State (PlayerState, TeamState)
    ↓
simulateMatch(homeTeam, awayTeam, matchPrepConfig)
    ↓
2,700 iterations (90 min × 30 actions/min)
    ↓
For each iteration:
  1. Determine possession
  2. Calculate action weights (attributes + tactics + prep)
  3. Select action probabilistically
  4. Execute action (pass, shoot, dribble, tackle)
  5. Log action to PlayerActionLog
  6. Update match state (score, stats)
    ↓
Return: MatchState (score, events, playerStats, actionLogs)
    ↓
processMatchFinancials() - Update DB with results
```

**Modification Points**:
- `calculateActionWeights()` - Add new tactical modifiers
- `executeDribble()` - Modify dribbling logic
- `checkDefensiveInterruption()` - Add defensive mechanics
- `applyNeutralizationEffect()` - Add match prep effects

**Critical Rules**:
- ✅ Apply EXP multiplier BEFORE simulation via `getEffectiveAttributes()`
- ✅ Apply condition factor to action weights
- ✅ Log every action for analytics
- ✅ Never modify DB directly during simulation
- ❌ Don't double-apply experience bonuses
- ❌ Don't exceed weight bounds (0.3x - 2.0x)

---

### 2. Tactical System (6 Dimensions)

**Purpose**: Allow strategic team management

**Dimensions**:
| Dimension | Field | Options | Default | Effect |
|-----------|-------|---------|---------|--------|
| Formation | `formation` | 4-4-2, 4-3-3, 5-3-2, 4-5-1 | 4-4-2 | Player positioning |
| Mentality | `mentality` | ALL_OUT_ATTACK → ULTRA_DEFENSIVE | NORMAL | Aggression level |
| Passing | `passing` | SHORT, MIXED, LONG | MIXED | Pass type selection ±30% |
| Tackling | `tackling` | SOFT, NORMAL, HARD | NORMAL | Tackle success ±15%, foul rate ±30% |
| Attacking Focus | `attacking_focus` | CENTER, MIXED, WINGS | MIXED | Position bias ±40% |
| Creative Freedom | `creative_freedom` | STRICT, NORMAL, FREEDOM | NORMAL | Shoot/dribble weights ±20% |

**Database Fields** (Team model):
```prisma
formation        String @default("4-4-2")
mentality        String @default("NORMAL")
passing          String @default("MIXED")
tackling         String @default("NORMAL")
attacking_focus  String @default("MIXED")
creative_freedom String @default("NORMAL")
```

**Match-Specific Override** (Match model):
```prisma
homeTactics_formation        String?
homeTactics_mentality        String?
homeTactics_passing          String?
homeTactics_tackling         String?
homeTactics_attacking_focus  String?
homeTactics_creative_freedom String?
// Same for awayTactics_*
```

**Implementation**:
- Buff functions in `match.ts` return multiplier objects
- Applied in `calculateActionWeights()` before action selection
- See `TACTICAL_GUIDE.md` for detailed effects

**Adding New Tactical Dimension**:
1. Add field to `Team` model in `schema.prisma`
2. Create migration: `npx prisma migrate dev --name add_tactic_x`
3. Update `TeamState.tactics` interface in `types.ts`
4. Create buff function in `match.ts`
5. Apply buff in `calculateActionWeights()`
6. Add UI control in `TacticsForm.tsx`
7. Update `API_REFERENCE.md` and `TACTICAL_GUIDE.md`

---

### 3. Experience & Progression System

**Purpose**: Player development over career

**EXP Mechanics**:
- **Range**: -1000 to 1000 (clamped)
- **Tier System** (1.8-rule):
  - 0-179: +0 bonus
  - 180-279: +2 bonus
  - 280-379: +3 bonus
  - ...
  - 980-1000: +10 bonus (2.0x multiplier)

**Match EXP Gains** (`calculateMatchExp()`):
```
Performance-based:
  • Starter (≥45 min): +1
  • Sub (>0 min): +0.5
  • MOTM: +5
  • Rating ≥9.0: +3
  • Rating ≥7.5: +1.5
  • Goals/Assists: +1 each (max +3)
  • Clean sheet (GK/DF): +1.5

Penalties:
  • Rating <5.0: -5
  • Rating ≤5.5: -2
  • Red card: -10
  • Yellow card: -2
  • Own goal: -5
  • Penalty conceded: -3
```

**Age Efficiency** (applied per match):
| Age | Efficiency |
|-----|------------|
| 16-21 | 100% |
| 22-28 | 70% |
| 29-33 | 40% |
| 34+ | 10% |

**Season-End Processing** (`applySeasonExpAdjustments()`):
```
1. Recompute season raw EXP from match stats
2. Apply age efficiency
3. Apply seasonal cap (positive net gain)
4. Add bonuses/penalties:
   • Player of Season: +20
   • Top Scorer: +15
   • Top Assist: +15
   • League Champion: +10
   • Relegated: -30
5. Apply annual decay (older players)
6. Compute delta vs already-applied EXP
7. Apply correction to player.exp
```

**Key Files**:
- `src/lib/engine/experience.ts` - EXP calculations
- `src/lib/engine/formulas.ts` - Attribute formulas
- `src/lib/services/matchSimulator.ts` - Match EXP application
- `src/lib/services/seasonAwards.ts` - Season bonuses

---

### 4. Financial System

**Purpose**: Club financial management + FFP compliance

**Weekly Processing** (`processWeeklyFinances()`):
```
Income:
  • Sponsorship: reputation-based
  • Tickets: capacity × attendance % × price
  • Jersey sales: popularity-based

Expenses:
  • Wages: sum of all player weeklyWage
  • Maintenance: stadium capacity-based

FFP Check:
  • If wages > 70% of income → FFP Warning
```

**Market Value Calculation** (`calculateMarketValue()`):
```typescript
const overall = calculatePlayerOverall(attributes);
const baseValue = (overall * overall * popularity) / 1000;
const ageMultiplier = getAgeMultiplier(age); // Peaks at 27-29
const marketValue = baseValue * ageMultiplier * 50000;
```

**Contract System**:
- `contractStartWeek`: Week contract started
- `contractEndWeek`: Week contract expires
- Renewal: +10% wage, extend by specified weeks

**Key Files**:
- `src/lib/engine/financial.ts` - Financial calculations
- `src/lib/engine/market.ts` - Transfer market logic
- `src/app/api/finances/route.ts` - Financial API
- `src/app/api/contracts/route.ts` - Contract API

---

### 5. Training System

**Purpose**: Player development through facility training

**Components**:
- **Facility Level**: 1-9 (upgradable)
  - Higher level = higher weekly fee, higher max gain
  - Level 1: 60k/week, 0.10 max gain
  - Level 9: 500k/week, 0.30 max gain

- **Training Slots**: Max 5 per team
  - Assign player + focus attribute
  - Auto-save on change
  - Weekly gain applied automatically

- **Decimal Accumulation**:
  - Base attributes remain integers
  - `PlayerTrainingFraction` tracks remainder
  - Lifetime gain tracked for analytics

**Weekly Processing** (`processWeeklyTraining()`):
```
1. Check funds for weekly fee
2. If insufficient → SKIPPED_FUNDS, no gain
3. If sufficient:
   - Charge fee once
   - For each active slot:
     • Roll random gain (0.10 to maxGain)
     • Add to player attribute
     • Track remainder in fraction table
4. Record ledger entry (idempotent via unique constraint)
```

**Key Files**:
- `src/lib/services/training.ts` - Training logic
- `src/lib/constants/training.ts` - Constants
- `src/app/api/training/*` - Training APIs
- `TRAINING.md` - Detailed documentation

---

### 6. Match Preparation Layer

**Purpose**: Pre-match strategic opponent analysis

**Three Strategic Dimensions**:

**A. Key Player Neutralization**
```typescript
{
    targetPlayerIds: string[];  // Max 3
    intensity: 'MODERATE' | 'TIGHT';  // -15% or -30% effectiveness
}
// Trade-off: -10% team flow per targeted player
```

**B. Press Trap**
```typescript
{
    commitment: 'SAFE' | 'BALANCED' | 'AGGRESSIVE';
    triggerZones: FieldZone[];  // DEFENSIVE, MIDDLE, ATTACKING
}
// Trade-off: Higher commitment = more counter vulnerability
```

**C. Transition Rules**
```typescript
{
    defenseToAttack: 'HOLD' | 'QUICK' | 'DIRECT';
    attackToDefense: 'URGENT' | 'CONTROLLED';
}
// Controls behavior when possession changes
```

**Key Files**:
- `src/lib/engine/match.ts` - Prep effect application
- `src/components/MatchPrepForm.tsx` - UI form
- `src/app/api/match/[id]/prep/route.ts` - API endpoint
- `PHASE_16_MATCH_PREP_COMPLETE.md` - Implementation details

---

## 📝 Development Patterns

### Server Action Pattern
```typescript
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateEntity(id: string, data: UpdateData) {
    // 1. Validate input
    if (!id || !data.field) throw new Error('Invalid input');
    
    // 2. Database mutation
    await prisma.model.update({
        where: { id },
        data
    });
    
    // 3. Revalidate UI (CRITICAL!)
    revalidatePath('/entity');
    
    // 4. Return success
    return { success: true };
}
```

### API Route Pattern
```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        const result = await prisma.model.findUnique({
            where: { id },
            include: { relations: true }
        });
        
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Validate
        // Process
        // Return
        
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

### Match Engine Modifier Pattern
```typescript
// 1. Define buff function
function getNewModifier(value: string) {
    switch (value) {
        case 'HIGH':
            return { stat: 1.3, risk: 1.2 };
        case 'LOW':
            return { stat: 0.8, risk: 0.9 };
        default:
            return { stat: 1.0, risk: 1.0 };
    }
}

// 2. Apply in calculateActionWeights()
const modifier = getNewModifier(tacticValue);
finalWeights.SHOOT *= modifier.stat;
finalWeights.DRIBBLE *= modifier.stat;

// 3. Ensure bounds (0.3x - 2.0x)
Object.keys(finalWeights).forEach(key => {
    finalWeights[key] = Math.max(0.3, Math.min(2.0, finalWeights[key]));
});
```

### Database Transaction Pattern
```typescript
await prisma.$transaction(async (tx) => {
    // 1. Clear conflicting data
    await tx.player.updateMany({
        where: { teamId, field: value },
        data: { field: null }
    });
    
    // 2. Apply new assignment
    await tx.player.update({
        where: { id: playerId },
        data: { field: newValue }
    });
    
    // 3. Log change
    await tx.financialEvent.create({
        data: { type: 'TRANSFER', amount: fee }
    });
});
```

### Component Pattern (Server → Client)
```typescript
// page.tsx (Server Component)
export default async function EntityPage() {
    const data = await fetchData();
    
    return <EntityClient data={data} />;
}

// EntityClient.tsx (Client Component)
'use client';

export function EntityClient({ data }) {
    const [state, setState] = useState(data);
    
    const handleUpdate = async (newData) => {
        await updateAction(newData);
        setState(newData);
    };
    
    return <div>...</div>;
}
```

---

## ✅ Feature Implementation Checklist

### Phase 1: Planning
- [ ] Read `API_REFERENCE.md` to check for existing functionality
- [ ] Identify which core systems are affected
- [ ] Check `DOCUMENTATION_GUIDE.md` for relevant docs
- [ ] Review similar implementations in codebase

### Phase 2: Database Design
- [ ] Update `prisma/schema.prisma` with new models/fields
- [ ] Add relations if needed
- [ ] Add indexes for performance (`@@index`)
- [ ] Add unique constraints if needed (`@@unique`)
- [ ] Set sensible defaults with `@default()`

### Phase 3: Migration
```bash
npx prisma migrate dev --name describe_change
# Verify migration file created
# Check SQL is correct
```

### Phase 4: Type Definitions
- [ ] Update `src/lib/engine/types.ts` if engine types change
- [ ] Create new TypeScript interfaces if needed
- [ ] Ensure no `any` types for new features
- [ ] Export types for reuse

### Phase 5: Core Logic
- [ ] Implement business logic in `src/lib/engine/` or `src/lib/services/`
- [ ] Follow existing patterns (see Development Patterns)
- [ ] Add comments for complex logic (not obvious behavior)
- [ ] Ensure pure functions where possible (testable)

### Phase 6: API Layer
- [ ] Create/update API route in `src/app/api/`
- [ ] Follow API Route Pattern
- [ ] Add input validation
- [ ] Handle errors gracefully
- [ ] Return consistent JSON structure
- [ ] Update `API_REFERENCE.md`

### Phase 7: UI Components
- [ ] Create component in `src/components/` if reusable
- [ ] Use Server Component for data fetching
- [ ] Use Client Component for interactivity
- [ ] Follow existing styling patterns
- [ ] Add loading states
- [ ] Add error states

### Phase 8: Server Actions
- [ ] Create action in `src/app/actions.ts`
- [ ] Add input validation
- [ ] Call core logic functions
- [ ] Call `revalidatePath()` after mutations
- [ ] Return success/error status

### Phase 9: Integration
- [ ] Connect UI → Server Action → API → Core Logic → Database
- [ ] Test data flow end-to-end
- [ ] Verify revalidation works
- [ ] Check TypeScript compilation

### Phase 10: Testing
```bash
# Type check
npm run build

# Lint
npm run lint

# Manual testing
# 1. Start dev server
# 2. Test feature in browser
# 3. Check database in Prisma Studio
# 4. Verify no console errors
```

### Phase 11: Documentation
- [ ] Update this `MASTER_DEVELOPMENT_GUIDE.md`
- [ ] Update `API_REFERENCE.md` if API changed
- [ ] Update system-specific docs (TACTICAL_GUIDE.md, etc.)
- [ ] Add usage examples
- [ ] Document trade-offs and limitations

### Phase 12: Cleanup
- [ ] Remove console.log statements
- [ ] Remove unused imports
- [ ] Format code (Prettier)
- [ ] Check git diff for accidental changes
- [ ] Write commit message

---

## 🗄️ Database Schema Guide

### Schema Conventions

**Naming**:
- Models: PascalCase (e.g., `Player`, `MatchEvent`)
- Fields: camelCase (e.g., `playerId`, `createdAt`)
- Relations: Descriptive names (e.g., `homeMatches`, `awayMatches`)

**IDs**:
- Use `String @id @default(cuid())` for most models
- Use `Int @id @default(1)` for singleton settings
- Use foreign keys with `@relation(fields: [field], references: [id])`

**Defaults**:
- Always provide `@default()` for new fields (backward compatibility)
- Use sensible defaults (0, false, "NORMAL", etc.)
- Document default behavior

**Indexes**:
```prisma
// Single field index
@@index([playerId])

// Composite index
@@index([teamId, slotIndex])

// Unique constraint
@@unique([playerId, week])
```

**Relations**:
```prisma
// One-to-Many
model Team {
    players Player[]
}

model Player {
    team Team? @relation(fields: [teamId], references: [id])
}

// Many-to-Many (implicit)
model Player {
    matches Match[] @relation("MatchPlayers")
}

model Match {
    players Player[] @relation("MatchPlayers")
}

// Self-referential
model Player {
    transfersFrom TransferHistory[] @relation("TransferFrom")
    transfersTo   TransferHistory[] @relation("TransferTo")
}
```

**Cascade Deletes**:
```prisma
// When parent deleted, delete children
model Team {
    players Player[] @relation(onDelete: Cascade)
}

// When parent deleted, set field to null
model Player {
    team Team? @relation(onDelete: SetNull)
}
```

### Adding New Fields

**Step 1: Update Schema**
```prisma
model Team {
    // Existing fields...
    
    // New field with default
    newField String @default("DEFAULT_VALUE")
}
```

**Step 2: Create Migration**
```bash
npx prisma migrate dev --name add_newField_to_team
```

**Step 3: Verify Migration**
```bash
# Check generated SQL
cat prisma/migrations/*/migration.sql
```

**Step 4: Update Types**
```typescript
// src/lib/engine/types.ts
export interface TeamState {
    newField: string;  // Add new field
}
```

**Step 5: Update Code**
- Update all places that construct the model
- Use default value if field is optional

**Step 6: Test**
```bash
npx prisma generate
npm run build
```

### Common Schema Patterns

**JSON Field for Complex Data**:
```prisma
model Match {
    // Store complex config as JSON string
    homePrepConfig String?  // JSON string of MatchPrepConfig
    stats          String?  // JSON string of match statistics
}
```

**Soft Delete**:
```prisma
model Player {
    isRetired Boolean @default(false)
    
    @@index([isRetired])
}
```

**Audit Trail**:
```prisma
model FinancialEvent {
    createdAt DateTime @default(now())
    
    @@index([createdAt])
    @@index([teamId, createdAt])
}
```

**Weekly Ledger Pattern**:
```prisma
model TrainingWeeklyLedger {
    teamId  String
    weekKey Int
    status  String
    
    @@unique([teamId, weekKey])  // Idempotency
    @@index([weekKey])
}
```

---

## 🔌 API Development Guide

### Before Creating New API

1. **Check API_REFERENCE.md**
   - Does endpoint already exist?
   - Can existing endpoint be extended?
   - What functions support it?

2. **Check Existing Patterns**
   - `/api/[resource]/route.ts` - RESTful routes
   - `/api/[resource]/[id]/route.ts` - ID-specific routes
   - Server Actions in `actions.ts` - Direct mutations

### API Route Structure

**GET Endpoint**:
```typescript
// src/app/api/resource/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        
        // Query with pagination
        const [data, total] = await Promise.all([
            prisma.model.findMany({
                where: { /* filters */ },
                include: { relations: true },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.model.count({ where: { /* filters */ } })
        ]);
        
        return NextResponse.json({
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

**POST Endpoint**:
```typescript
// src/app/api/resource/route.ts
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // 1. Validate input
        if (!body.requiredField) {
            return NextResponse.json(
                { error: 'requiredField is required' },
                { status: 400 }
            );
        }
        
        // 2. Business logic
        const result = await prisma.model.create({
            data: body
        });
        
        // 3. Return success
        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

**PATCH Endpoint** (Partial Update):
```typescript
// src/app/api/resource/[id]/route.ts
export async function PATCH(req: Request) {
    try {
        const { id } = req.params;
        const updates = await req.json();
        
        // Filter out undefined values
        const validUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );
        
        const updated = await prisma.model.update({
            where: { id },
            data: validUpdates
        });
        
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

**DELETE Endpoint**:
```typescript
// src/app/api/resource/[id]/route.ts
export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        
        await prisma.model.delete({
            where: { id }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

### API Best Practices

**Input Validation**:
```typescript
// Always validate
if (!playerId || !amount) {
    return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
    );
}

// Type check
if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
        { error: 'Amount must be positive number' },
        { status: 400 }
    );
}

// Enum validation
const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED'];
if (!validStatuses.includes(status)) {
    return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
    );
}
```

**Error Handling**:
```typescript
try {
    // Operation
} catch (error) {
    // Prisma-specific errors
    if (error.code === 'P2025') {
        return NextResponse.json(
            { error: 'Record not found' },
            { status: 404 }
        );
    }
    
    if (error.code === 'P2002') {
        return NextResponse.json(
            { error: 'Unique constraint violated' },
            { status: 409 }
        );
    }
    
    // Generic error
    return NextResponse.json(
        { error: error.message },
        { status: 500 }
    );
}
```

**Pagination**:
```typescript
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '20');
const skip = (page - 1) * limit;

const [data, total] = await Promise.all([
    prisma.model.findMany({ skip, take: limit }),
    prisma.model.count()
]);

return NextResponse.json({
    data,
    pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    }
});
```

**Filtering**:
```typescript
const where: Prisma.PlayerWhereInput = {};

if (teamId) where.teamId = teamId;
if (position) where.naturalPosition = position;
if (minAge || maxAge) {
    where.age = {};
    if (minAge) where.age.gte = minAge;
    if (maxAge) where.age.lte = maxAge;
}
if (search) {
    where.OR = [
        { name: { contains: search } },
        { id: { contains: search } }
    ];
}

const players = await prisma.player.findMany({ where });
```

---

## ⚽ Match Engine Modification Guide

### Understanding Match Flow

```
simulateMatch(homeTeam, awayTeam, matchPrep)
    │
    ├─→ Initialize MatchState (score 0-0, minute 0)
    ├─→ Initialize player stats (all zero)
    └─→ Loop 2,700 iterations (90 min × 30 actions/min)
         │
         ├─→ 1. Determine possession (who has ball)
         ├─→ 2. Get ball carrier (random player in attacking team)
         ├─→ 3. Calculate action weights
         │    ├─→ Base weights by position
         │    ├─→ Apply attributes (effectiveAttrs)
         │    ├─→ Apply tactics (getPassingStyleBuff, etc.)
         │    ├─→ Apply match prep (neutralization, transition)
         │    └─→ Apply condition factor
         │
         ├─→ 4. Select action probabilistically
         │    └─→ Weighted random: PASS_SHORT, PASS_LONG, DRIBBLE, SHOOT
         │
         ├─→ 5. Execute action
         │    ├─→ PASS_SHORT: Find target, check success
         │    ├─→ PASS_LONG: Find target, check success (lower rate)
         │    ├─→ DRIBBLE: vs random defender, tackle success check
         │    └─→ SHOOT: vs GK, shot on target check
         │
         ├─→ 6. Log action
         │    └─→ PlayerActionLog { minute, zone, actionType, result }
         │
         ├─→ 7. Update match state
         │    ├─→ If goal: increment score, create event
         │    ├─→ If possession change: track transition
         │    └─→ Update stats (passes, shots, etc.)
         │
         └─→ 8. Increment minute (every 30 iterations)
```

### Adding New Action Type

**Step 1: Define Type**
```typescript
// src/lib/engine/types.ts
export type ActionType = 
    | 'PASS_SHORT'
    | 'PASS_LONG'
    | 'DRIBBLE'
    | 'SHOOT'
    | 'CROSS'  // NEW
    | 'THROUGH_BALL';  // NEW
```

**Step 2: Add to Weight Calculation**
```typescript
// src/lib/engine/match.ts:calculateActionWeights()
const weights: Record<ActionType, number> = {
    PASS_SHORT: baseWeight,
    PASS_LONG: baseWeight,
    DRIBBLE: baseWeight,
    SHOOT: baseWeight,
    CROSS: baseWeight * crossingAttribute,  // NEW
    THROUGH_BALL: baseWeight * visionAttribute  // NEW
};

// Apply modifiers
if (tactics.passing === 'LONG') {
    weights.THROUGH_BALL *= 1.3;
}
```

**Step 3: Create Execution Function**
```typescript
function executeCross(
    player: PlayerState,
    ball: BallState,
    matchState: MatchState,
    isHomeAttacking: boolean
): ActionResult {
    // Find target in box
    const target = findTargetInBox(ball, matchState);
    
    // Calculate success based on crossing attribute
    const successRate = player.attributes.crossing / 20;
    const success = Math.random() < successRate;
    
    if (success) {
        // Headed shot attempt
        return executeHeader(target, ball, matchState);
    } else {
        return { result: 'FAIL', message: 'Cross cleared' };
    }
}
```

**Step 4: Integrate into Main Loop**
```typescript
// src/lib/engine/match.ts:simulateMatch()
switch (selectedAction) {
    case 'PASS_SHORT':
        result = executePassShort(...);
        break;
    case 'CROSS':  // NEW
        result = executeCross(...);
        break;
    // ... other cases
}
```

**Step 5: Update Logging**
```typescript
// Ensure action type is logged
await prisma.playerActionLog.create({
    data: {
        actionType: 'CROSS',  // Will be logged
        // ... other fields
    }
});
```

### Adding New Tactical Modifier

**Example: Add "Pressing Intensity" Tactic**

**Step 1: Add to Schema**
```prisma
model Team {
    pressingIntensity String @default("NORMAL")  // LOW | NORMAL | HIGH
}
```

**Step 2: Update Types**
```typescript
// src/lib/engine/types.ts
export interface TeamState {
    tactics: {
        pressingIntensity: string;  // Add field
        // ... other tactics
    };
}
```

**Step 3: Create Buff Function**
```typescript
// src/lib/engine/match.ts
function getPressingIntensityBuff(pressing: string) {
    switch (pressing) {
        case 'HIGH':
            return { interception: 1.2, stamina: 0.9 };  // +20% interception, -10% stamina
        case 'LOW':
            return { interception: 0.85, stamina: 1.1 }; // -15% interception, +10% stamina
        default:
            return { interception: 1.0, stamina: 1.0 };
    }
}
```

**Step 4: Apply in Defensive Logic**
```typescript
// In checkDefensiveInterruption()
const pressingBuff = getPressingIntensityBuff(defendingTeam.tactics.pressingIntensity);
interruptChance *= pressingBuff.interception;

// Apply stamina drain in main loop
player.condition -= baseDrain * pressingBuff.stamina;
```

**Step 5: Add UI Control**
```typescript
// src/components/TacticsForm.tsx
<select
    value={tactics.pressingIntensity}
    onChange={(e) => onUpdate('pressingIntensity', e.target.value)}
>
    <option value="LOW">Low</option>
    <option value="NORMAL">Normal</option>
    <option value="HIGH">High</option>
</select>
```

### Debugging Match Issues

**Issue: Players not shooting enough**

**Debug Steps**:
```typescript
// 1. Add logging to calculateActionWeights()
console.log('Player position:', player.position);
console.log('Base SHOOT weight:', weights.SHOOT);
console.log('After mentality buff:', weights.SHOOT);
console.log('After creative freedom:', weights.SHOOT);

// 2. Check selected action distribution
const actionCounts = {};
// In main loop, after action selection:
actionCounts[selectedAction] = (actionCounts[selectedAction] || 0) + 1;

// 3. Log at end of match
console.log('Action distribution:', actionCounts);
```

**Issue: Tactics not applied**

**Debug Steps**:
```typescript
// 1. Verify tactics loaded from DB
console.log('Home team tactics:', homeTeam.tactics);

// 2. Check buff function output
const passingBuff = getPassingStyleBuff(homeTeam.tactics.passing);
console.log('Passing buff:', passingBuff);

// 3. Verify buff applied to weights
console.log('Weights before:', weights);
console.log('Weights after:', finalWeights);
```

**Issue: Match prep not working**

**Debug Steps**:
```typescript
// 1. Check prep config loaded
console.log('Home prep:', matchPrep.home);

// 2. Verify neutralization targets
console.log('Neutralization targets:', matchPrep.home?.neutralization?.targetPlayerIds);

// 3. Check if player is targeted
const isTargeted = matchPrep.home?.neutralization?.targetPlayerIds.includes(player.id);
console.log('Player targeted?', isTargeted);

// 4. Verify effect applied
const neutralizationResult = applyNeutralizationEffect(...);
console.log('Neutralization result:', neutralizationResult);
```

---

## 🎨 UI Component Patterns

### Page Structure (Server Component)
```typescript
// src/app/resource/page.tsx
import prisma from '@/lib/prisma';
import { ResourceClient } from './ResourceClient';

export default async function ResourcePage() {
    // 1. Fetch data server-side
    const resources = await prisma.resource.findMany({
        include: { relations: true },
        orderBy: { createdAt: 'desc' }
    });
    
    // 2. Calculate derived data
    const summary = calculateSummary(resources);
    
    // 3. Pass to client component
    return (
        <div className="container">
            <h1>Resources</h1>
            <ResourceClient 
                resources={resources}
                summary={summary}
            />
        </div>
    );
}
```

### Client Component with State
```typescript
// src/app/resource/ResourceClient.tsx
'use client';

import { useState } from 'react';
import { updateResource } from '@/app/actions';

export function ResourceClient({ resources, summary }) {
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const handleUpdate = async (id, data) => {
        setLoading(true);
        try {
            await updateResource(id, data);
            // Optimistic update or revalidate
        } catch (error) {
            console.error('Update failed:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            {resources.map(resource => (
                <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onUpdate={handleUpdate}
                    loading={loading}
                />
            ))}
        </div>
    );
}
```

### Reusable Component
```typescript
// src/components/ResourceCard.tsx
export function ResourceCard({ resource, onUpdate, loading }) {
    const handleChange = (field, value) => {
        onUpdate(resource.id, { [field]: value });
    };
    
    return (
        <div className="card">
            <h3>{resource.name}</h3>
            <select
                value={resource.status}
                onChange={(e) => handleChange('status', e.target.value)}
                disabled={loading}
            >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
            </select>
            
            {loading && <span className="spinner" />}
        </div>
    );
}
```

### Modal Pattern
```typescript
// src/components/ResourceModal.tsx
'use client';

export function ResourceModal({ isOpen, onClose, resourceId }) {
    if (!isOpen) return null;
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose}>×</button>
                <ResourceForm 
                    resourceId={resourceId}
                    onSubmit={() => {
                        onClose();
                        // Refresh parent
                    }}
                />
            </div>
        </div>
    );
}
```

### Tab Pattern
```typescript
// src/components/ResourceTabs.tsx
'use client';

export function ResourceTabs({ resourceId }) {
    const [activeTab, setActiveTab] = useState('overview');
    
    return (
        <div>
            <div className="tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={activeTab === 'stats' ? 'active' : ''}
                    onClick={() => setActiveTab('stats')}
                >
                    Statistics
                </button>
            </div>
            
            <div className="tab-content">
                {activeTab === 'overview' && <OverviewTab resourceId={resourceId} />}
                {activeTab === 'stats' && <StatsTab resourceId={resourceId} />}
            </div>
        </div>
    );
}
```

### Form with Validation
```typescript
// src/components/ResourceForm.tsx
'use client';

import { useState } from 'react';

export function ResourceForm({ resourceId, onSubmit }) {
    const [data, setData] = useState({ name: '', value: 0 });
    const [errors, setErrors] = useState({});
    
    const validate = () => {
        const newErrors = {};
        if (!data.name) newErrors.name = 'Name is required';
        if (data.value < 0) newErrors.value = 'Value must be positive';
        return newErrors;
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = validate();
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        
        await onSubmit(data);
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
            />
            {errors.name && <span className="error">{errors.name}</span>}
            
            <input
                type="number"
                value={data.value}
                onChange={(e) => setData({ ...data, value: +e.target.value })}
            />
            {errors.value && <span className="error">{errors.value}</span>}
            
            <button type="submit">Save</button>
        </form>
    );
}
```

---

## 🧪 Testing & Verification

### Build Verification
```bash
# Type check + build
npm run build

# Expected output:
# ✓ Compiled successfully
# ✓ No TypeScript errors
# ✓ All routes generated
```

### Lint Verification
```bash
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Database Verification
```bash
# Generate Prisma Client
npx prisma generate

# Check migrations
npx prisma migrate status

# Open Studio for manual inspection
npx prisma studio
```

### Manual Testing Checklist

**For New Features**:
- [ ] Feature accessible from UI
- [ ] Data loads correctly
- [ ] Interactions work (buttons, forms, etc.)
- [ ] Loading states display
- [ ] Error states display
- [ ] Data persists after refresh
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] TypeScript types correct
- [ ] No `any` types used

**For Match Engine Changes**:
- [ ] Match simulates without errors
- [ ] New mechanic affects outcomes
- [ ] Stats logged correctly
- [ ] Action logs created
- [ ] No infinite loops
- [ ] Performance acceptable (<5s per match)

**For API Changes**:
- [ ] Endpoint responds
- [ ] Correct status codes (200, 400, 404, 500)
- [ ] JSON structure correct
- [ ] Validation works
- [ ] Error messages helpful
- [ ] Pagination works (if applicable)

### Test Match Script
```typescript
// scripts/test-match.ts
import { simulateMatch } from '@/lib/engine/match';

const homeTeam = { /* ... */ };
const awayTeam = { /* ... */ };

const result = simulateMatch(homeTeam, awayTeam);

console.log('Score:', result.homeScore, '-', result.awayScore);
console.log('Events:', result.events);
console.log('Player Stats:', result.playerStats);
```

Run:
```bash
npx ts-node scripts/test-match.ts
```

### Performance Testing

**Match Simulation**:
```typescript
const start = Date.now();
const result = simulateMatch(homeTeam, awayTeam);
const duration = Date.now() - start;

console.log(`Match simulated in ${duration}ms`);
// Target: <5000ms for full 90-minute simulation
```

**Database Queries**:
```typescript
// Enable query logging in development
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error']
});

// Check slow queries in Prisma Studio
```

---

## ⚠️ Common Gotchas & Solutions

### 1. Experience Double-Counting

**Problem**: EXP applied twice (once in match, once in season adjustment)

**Solution**:
```typescript
// In processMatch() - Apply match EXP
player.exp += matchExp;

// In applySeasonExpAdjustments() - Compute delta
const delta = seasonTotal - alreadyAppliedDuringSeason;
player.exp += delta;  // Only apply difference
```

### 2. Condition Factor Not Applied

**Problem**: Players perform same at 50% and 100% condition

**Solution**:
```typescript
// In calculateActionWeights()
const conditionFactor = player.condition / 100;
Object.keys(weights).forEach(key => {
    weights[key] *= conditionFactor;
});
```

### 3. Tactics Not Persisting

**Problem**: Tactics reset after page reload

**Solution**:
```typescript
// In Server Action
export async function updateTactics(teamId: string, tactics) {
    await prisma.team.update({
        where: { id: teamId },
        data: tactics
    });
    
    revalidatePath('/squad');  // CRITICAL!
}
```

### 4. Match Prep Config Not Applied

**Problem**: Prep config saved but not used in simulation

**Solution**:
```typescript
// In matchSimulator.ts
const homePrep = matchDB.homePrepConfig
    ? JSON.parse(matchDB.homePrepConfig)
    : null;

// Pass to engine
const matchState = simulateMatch(homeTeam, awayTeam, {
    home: homePrep,
    away: awayPrep
});

// In match.ts main loop
const attackingPrepConfig = matchPrep?.home ?? null;
const defendingPrepConfig = matchPrep?.away ?? null;
```

### 5. UI Not Updating After Mutation

**Problem**: Server Action completes but UI shows old data

**Solution**:
```typescript
// Always call revalidatePath
export async function updateEntity(id: string, data) {
    await prisma.entity.update({ where: { id }, data });
    revalidatePath('/entity');  // Add this!
}
```

### 6. TypeScript Errors After Schema Change

**Problem**: Prisma Client types don't match new schema

**Solution**:
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart TypeScript server
# In VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### 7. Migration Conflicts

**Problem**: Multiple developers create conflicting migrations

**Solution**:
```bash
# Reset migrations (development only!)
npx prisma migrate reset

# Or manually resolve conflicts:
# 1. Delete conflicting migration folders
# 2. Create new migration with all changes
npx prisma migrate dev --name resolved_conflict
```

### 8. Action Weights Out of Bounds

**Problem**: Players always shoot or never shoot

**Solution**:
```typescript
// In calculateActionWeights()
Object.keys(finalWeights).forEach(key => {
    // Clamp to reasonable range
    finalWeights[key] = Math.max(0.3, Math.min(2.0, finalWeights[key]));
});
```

### 9. Training Gain Not Applied

**Problem**: Training slots configured but no gain

**Solution**:
```typescript
// Check weekly processing is called
// In advanceDay()
const weekKey = getWeekKey(currentDate);
if (weekKey > lastWeekKey) {
    await processWeeklyTraining(userTeamId, weekKey);
}
```

### 10. FFP Warning False Positive

**Problem**: FFP warning when wages are actually compliant

**Solution**:
```typescript
// In checkFFPCompliance()
const wagePercentage = weeklyWages / weeklyIncome;
const isCompliant = wagePercentage <= 0.70;  // 70% threshold

// Ensure income calculated correctly
const weeklyIncome = sponsorship + tickets + jerseySales;
```

---

## 🗺️ File Reference Map

### Core Engine
```
src/lib/engine/
├── match.ts              # Match simulation (~1100 lines)
├── types.ts              # Type definitions
├── formulas.ts           # Attribute formulas
├── experience.ts         # EXP calculations
├── financial.ts          # Financial logic
├── market.ts             # Transfer market
├── playerPower.ts        # Power calculation
├── playerRoles.ts        # Player roles
└── suitability.ts        # Position suitability
```

### Services
```
src/lib/services/
├── matchSimulator.ts     # Match service layer
├── aiMarketService.ts    # AI bidding
├── seasonAwards.ts       # Season bonuses
├── gameTime.ts           # Day/season advancement
├── training.ts           # Training processing
└── newGameInitializer.ts # New game setup
```

### API Routes
```
src/app/api/
├── game/
│   ├── info/route.ts     # Game state
│   └── process/route.ts  # Game loop control
├── match/
│   ├── [id]/route.ts     # Match details
│   ├── [id]/actions/route.ts  # Action logs
│   └── [id]/prep/route.ts     # Match prep
├── player/
│   ├── [id]/route.ts     # Player details
│   └── [id]/analytics/route.ts  # Player analytics
├── players/
│   ├── search/route.ts   # Player search
│   └── market-value/route.ts   # Market value
├── team/
│   └── [id]/tactics/route.ts   # Team tactics
├── training/
│   ├── route.ts          # Training state
│   ├── slots/[slotIndex]/route.ts  # Slot update
│   └── facility/upgrade/route.ts   # Facility upgrade
├── finances/route.ts     # Financial state
├── contracts/route.ts    # Contract management
├── market/
│   ├── bid/route.ts      # Submit bid
│   └── bids/route.ts     # List bids
└── news/route.ts         # News feed
```

### UI Pages
```
src/app/
├── page.tsx              # Home/dashboard
├── squad/                # Squad management
├── fixtures/             # Match schedule
├── match/                # Match details
├── team/[id]/            # Team profile
├── player/[id]/          # Player profile
├── players/              # Player list
├── training/             # Training facility
├── market/               # Transfer market
├── contracts/            # Contract management
├── finances/             # Financial overview
├── news/                 # News feed
├── league/               # League table
├── rankings/             # Player rankings
├── season-summary/       # Season recap
└── settings/             # Game settings
```

### Components
```
src/components/
├── TacticsForm.tsx           # Tactics configuration
├── TacticsTabs.tsx           # Normal/Behind/Leading tabs
├── MatchPrepForm.tsx         # Match prep form
├── MatchPrepTab.tsx          # Match prep wrapper
├── MatchTacticsSelector.tsx  # Pre-match tactics modal
├── PlayerModal.tsx           # Player details modal
├── ContractTab.tsx           # Contract management
├── TransferTab.tsx           # Transfer history
├── TeamFinanceTab.tsx        # Financial overview
├── TrainingReadOnlyTab.tsx   # Training analytics
├── PlayerRolesTab.tsx        # Player roles config
├── PlayerSearchModal.tsx     # Player search
├── SeasonSelector.tsx        # Season navigation
├── TeamFilter.tsx            # Team filter
└── AppShell.tsx              # Layout wrapper
```

### Database
```
prisma/
├── schema.prisma         # Database schema
├── seed.js               # Seed data
└── migrations/           # Migration files
```

### Documentation
```
├── MASTER_DEVELOPMENT_GUIDE.md    # This file
├── API_REFERENCE.md               # API endpoints
├── TACTICAL_GUIDE.md              # Tactics reference
├── TRAINING.md                    # Training system
├── exp rules.md                   # EXP mechanics
├── finance requirement.md         # Financial requirements
├── POWER_CALCULATION_EXPLANATION.md  # Power formula
├── DOCUMENTATION_GUIDE.md         # Doc decision tree
├── copilot-instructions.md        # AI agent bible
└── PHASE_*_*.md                   # Phase summaries
```

### Scripts
```
scripts/
├── test-match.ts         # Test match simulation
├── test-power.js         # Test power calculation
└── check-date.js         # Check game time

*.js (root)
├── ANALYZE_PLAYER.js     # Player analysis
├── analyze-match.js      # Match analysis
├── check-player-data.ts  # Player inspection
└── test-power.js         # Power testing
```

---

## 📚 Related Documentation Quick Links

| Document | When to Use |
|----------|-------------|
| **[API_REFERENCE.md](./API_REFERENCE.md)** | Before creating new API endpoints |
| **[TACTICAL_GUIDE.md](./TACTICAL_GUIDE.md)** | Understanding tactic effects |
| **[TRAINING.md](./TRAINING.md)** | Training system mechanics |
| **[exp rules.md](./exp%20rules.md)** | Experience progression rules |
| **[finance requirement.md](./finance%20requirement.md)** | Financial system requirements |
| **[POWER_CALCULATION_EXPLANATION.md](./POWER_CALCULATION_EXPLANATION.md)** | Player power formula |
| **[DOCUMENTATION_GUIDE.md](./DOCUMENTATION_GUIDE.md)** | Finding right documentation |
| **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** | Architecture overview |
| **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** | Phase 14 tactics |
| **[PHASE_16_MATCH_PREP_COMPLETE.md](./PHASE_16_MATCH_PREP_COMPLETE.md)** | Match prep system |

---

## 🎯 Summary

This guide provides:
- ✅ **Architecture overview** - Understand the system
- ✅ **Decision trees** - Know where to start
- ✅ **Implementation checklists** - Step-by-step guides
- ✅ **Code patterns** - Proven solutions
- ✅ **Troubleshooting** - Common issues fixed
- ✅ **File reference** - Find anything quickly

**Golden Rules**:
1. **Check before creating** - Read `API_REFERENCE.md` first
2. **Follow patterns** - Use existing code as template
3. **Test thoroughly** - Build + lint + manual testing
4. **Document changes** - Update relevant docs
5. **Maintain type safety** - No `any` types

**For questions**:
- Architecture → `copilot-instructions.md`
- API endpoints → `API_REFERENCE.md`
- Tactics → `TACTICAL_GUIDE.md`
- Training → `TRAINING.md`
- EXP → `exp rules.md`

---

**Happy Coding! ⚽🎮**
