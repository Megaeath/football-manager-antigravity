# Football Manager Engine - AI Coding Instructions

## Project Overview

A Next.js 16 + TypeScript tactical football simulation engine with SQLite persistence. The engine simulates realistic matches with 300-600 passes per team, dynamic player ratings, and deep squad management. Current date context: March 2026.

**Core Architecture**: Next.js App Router → Server Actions (actions.ts) → Prisma ORM → SQLite  
**Match Engine**: Pure TypeScript simulation with minute-by-minute action resolution and probabilistic outcomes  
**State Pattern**: Database-driven with tactical/financial modifiers applied at match time

---

## Essential Architecture Knowledge

### 1. Match Simulation Pipeline

**Location**: `src/lib/services/matchSimulator.ts` + `src/lib/engine/match.ts`

The match engine is the heart of the system:
- **Input**: `processMatch(matchId)` queries DB for Match, Teams, Players, Tactics
- **Execution**: `simulateMatch()` runs 2,700 minute iterations (90 min × 30 actions/min)
- **Action Selection**: Probabilistic model based on player attributes, position, ball position, team tactics
- **Output**: Match statistics (goals, assists, possession, passes, cards) aggregated per-player + raw per-action logs

**Critical Pattern**: Attributes are modified BEFORE simulation via `getEffectiveAttributes()` which applies experience multipliers and condition penalties.

### 1.1 Raw Action Logging & Field Zones

The match engine now stores **raw action-level logs** (`PlayerActionLog`) for analysis-first workflows.

- Every key action is logged with: minute, ballPosition (0-100), zone, actionType, result, expectedSuccessRate
- Zones are normalized into 3 thirds:
    - **DEFENSIVE** = 1-30
    - **MIDDLE** = 31-70
    - **ATTACKING** = 71-100
- Aggregated per-match counters are persisted in `PlayerMatchStats`:
    - `defensiveThirdTouches`, `middleThirdTouches`, `attackingThirdTouches`

**Design rule**: UI analytics should be calculated from raw logs when possible, not hardcoded summaries.

### 1.2 Player Analysis UI on Match Page

The `/match` page provides deep player performance analysis with interactive visualizations:

**Features** (in expanded player card):
- **Field Zone Distribution Chart**: Clickable stacked bar showing defensive/middle/attacking zone usage
  - Click on a zone to highlight it (future: filter actions to that zone)
  - Displays percentages and absolute touch counts
  - Hoverable for detailed tooltip
  - Height: 24px to accommodate numbers display

- **Action Breakdown**: Percentage distribution of action types (PASS_SHORT, PASS_LONG, DRIBBLE, SHOOT)
  - Always totals to 100% based on `totalAttempts` across 4 action types
  - Shows: percentage (bold), attempt count, success rate
  - Grid layout: 4 columns, fixed width for scanning

- **Detailed Action Stats**: Per-action success metrics
  - Success rate %, success count / attempts
  - Shows difference between action types (e.g., 88% PASS_SHORT vs 45% DRIBBLE)

**Column Header** (before player cards):
- Added descriptive header row with abbreviations:
  - POS, NAME, MIN, RAT, FIT, SHO, PAS, CRS, DRB, TCK
  - Styled with light background, uppercase, smaller font
  - Includes tooltips on hover explaining each column

**Implementation** (`src/app/match/page.tsx`):
- State: `selectedZoneFilter` (future zone filtering)
- Calculation: Zone percentages use `analytics?.zones` with fallback to `playerMatchStats` thirds
- Action breakdown: Iterates actions array, calculates `(attempts / totalAttempts) * 100`
- Visual: Responsive grid, hover effects, border highlights for selected zones

### 3. Three-Layer Attribute System

**Player Attributes** (0-20 scale):
- **Technical**: handling, tackling, passing, shooting, heading, dribbling, crossing, setPieces, throw
- **Mental**: aggression, positioning, vision, bravery, leadership, teamwork, composure
- **Physical**: pace, acceleration, stamina, strength, agility, balance

**Experience Multiplier** (`applyExpToStat`):
- EXP caps at 1000 total (league-wide across all seasons)
- Multiplier: `(100 + exp / 5) / 100` → scales attributes up to +20%
- Applied per-player based on `player.exp` field before each match

**Condition/Fitness**:
- Range: 0-100% (affects all action weights in match engine)
- Decays after matches, recovers with rest
- Lower condition = lower action selection weights

### 3. Three-Layer Attribute System

**Player Attributes** (0-20 scale):
- **Technical**: handling, tackling, passing, shooting, heading, dribbling, crossing, setPieces, throw
- **Mental**: aggression, positioning, vision, bravery, leadership, teamwork, composure
- **Physical**: pace, acceleration, stamina, strength, agility, balance

**Experience Multiplier** (`applyExpToStat`):
- EXP caps at 1000 total (league-wide across all seasons)
- Multiplier: `(100 + exp / 5) / 100` → scales attributes up to +20%
- Applied per-player based on `player.exp` field before each match

**Condition/Fitness**:
- Range: 0-100% (affects all action weights in match engine)
- Decays after matches, recovers with rest
- Lower condition = lower action selection weights

### 4. Tactical System (6 Dimensions)

**Database Fields** (`Team` model):
- `formation` (4-4-2, 4-3-3, 5-3-2, 4-5-1) → position distribution
- `mentality` (ULTRA_DEFENSIVE to ALL_OUT_ATTACK) → action modifier buffs (1.0-1.5x)
- `passing` (SHORT, MIXED, LONG) → pass type weight distribution
- `tackling` (SOFT, NORMAL, HARD) → tackle success rate & foul probability
- `attacking_focus` (CENTER, MIXED, WINGS) → positional action bias ±40%
- `creative_freedom` (STRICT, NORMAL, FREEDOM) → shooting/dribbling weights ±20%

**Implementation**: Modifiers applied in `calculateActionWeights()` before action selection.

### 5. Data Flow: Financial & Reputation

**Weekly Processing** (`processWeeklyFinances`):
1. Calculate team revenue (stadium capacity × attendance % × ticket price)
2. Deduct wages for all squad players
3. Update player popularity (based on recent goal/assist activity)
4. Update team reputation (based on recent match results and league position)
5. Check FFP compliance and apply penalties if over budget

**Player Value** (`evaluateMarketValue`):
- Base: (overall * 10,000) + (age factor * 5,000,000)
- Modifiers: popularity, recent performance, remaining contract weeks
- Used for transfer market AI bids (`aiMarketService.ts`)

---

## Critical Conventions & Patterns

### Match Simulation Execution

**Required Setup**:
```typescript
// Convert DB Player to engine PlayerState
const playerState: PlayerState = {
    id: dbPlayer.id,
    attributes: toPlayerAttributes(dbPlayer),  // Convert 0-20 to engine format
    condition: dbPlayer.condition,
    exp: dbPlayer.exp,
    // ... other fields
};

// Apply effective attributes BEFORE simulation
const effectiveAttrs = getEffectiveAttributes(playerState.attributes, dbPlayer.exp);
```

**Never**:
- Modify DB directly during simulation (use `processMatchFinancials()` after)
- Apply condition/morale penalties twice
- Double-count experience in financial calculations

### API Route Pattern

**Location**: `src/app/api/[resource]/route.ts`

Standard structure:
```typescript
export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Process with Prisma
        // Call engine functions
        // Return JSON response
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

### Server Action Pattern

**Location**: `src/app/actions.ts`

All DB mutations use `'use server'` directive + `revalidatePath()`:
```typescript
export async function updateTacticalPosition(playerId: string, teamId: string, position: string) {
    // Transaction: clear other assignments, assign to this player
    await prisma.player.updateMany({...});
    revalidatePath('/squad');  // Critical for UI sync
}
```

### Experience Decay System

Runs at **month boundary**. See `processAgeBasedExpDecay()`:
- Players 30+ lose 5% EXP annually
- Players 35+ lose 10% EXP annually
- Losers get -20% multiplier (below age 30)
- Winners/Star players exempt

**Trigger**: Check `GlobalGameSettings.lastExpDecayMonth` on game time advance.

---

## Development Workflows

### Building & Running

```bash
npm run dev          # Start Next.js server (localhost:3000)
npm run build        # Type-check and build
npm run lint         # Run ESLint
npx prisma db push  # Sync schema to SQLite
npx prisma db seed  # Load seed data
```

### Database Inspection

```bash
npx prisma studio   # GUI browser for DB inspection
npx prisma migrate  # List/create migrations
```

### Common Tasks

**Add new tactical modifier**:
1. Add field to `Team` model in `schema.prisma`
2. Create migration: `npx prisma migrate dev --name add_tactic_x`
3. Define buff function in `match.ts` (returns multiplier object)
4. Apply in `calculateActionWeights()` or relevant function
5. Add UI control in `TacticsForm.tsx` or component

**Fix match simulation bug**:
1. Check `match.ts:calculateActionWeights()` for weight logic
2. Verify buffs are applied correctly (should never exceed 2x or go below 0.3x)
3. Ensure `condition` factor is applied last
4. Test with `test-power.js` or `ANALYZE_PLAYER.js` scripts

**Add new season mechanic**:
1. Implement logic in `src/lib/engine/financial.ts`
2. Call from `processAIMarketMovements()` or `calculateSeasonAwards()`
3. Add to migration if schema changes needed
4. Update `seasonAwards.ts` if affects standings/rewards

---

## Key Files by Purpose

| Purpose | Files |
|---------|-------|
| **Match Engine** | `match.ts`, `playerPower.ts`, `formulas.ts` |
| **Financial System** | `financial.ts`, `market.ts` (bidding) |
| **Experience & Progression** | `experience.ts`, `financial.ts` (decay) |
| **Services (Long-running)** | `matchSimulator.ts`, `aiMarketService.ts`, `seasonAwards.ts` |
| **Database** | `schema.prisma`, `prisma.ts` (singleton client) |
| **UI State & Forms** | `TacticsForm.tsx`, `SquadClient.tsx`, `PlayerModal.tsx` |
| **Game Time Management** | `gameTime.ts` (advance day, season transitions) |
| **API Routes** | See [API_REFERENCE.md](../API_REFERENCE.md) for complete endpoint guide |

---

## Debugging & Testing Scripts

Located in `scripts/` and root:
- `test-power.js` - Verify player power calculations
- `ANALYZE_PLAYER.js` - Deep dive into player attributes post-match
- `check-date.js` - Validate UTC game time
- `check-player-data.ts` - Inspect player state in DB

Run: `node scripts/test-power.js` (requires node, no build step)

---

## Common Gotchas

1. **Experience Multiplier Stacking**: Experience buff is applied in `getEffectiveAttributes()` BEFORE match simulation. Never re-apply in match stats aggregation.

2. **Condition Decay**: Applied to `player.condition` after each match via `processMatchFinancials()`. Check this field when debugging "players getting tired."

3. **Tactical Position vs Natural Position**: `tacticalPosition` (where player plays in match formation) is separate from `naturalPosition` (GK, FWR, etc.). Both must be set for valid lineups.

4. **Formation Slot Assignment**: Each formation (4-4-2, 4-3-3, etc.) has exact slot count. Always verify squad has enough players in required positions before lineup assignment.

5. **Time Zone Handling**: Game uses UTC internally (`GlobalGameSettings.currentDate`). All match scheduling respects this for calendar transitions.

---

## 🗂️ Related Documentation

**Before starting ANY development**:
1. Read this file (copilot-instructions.md) - Architecture overview
2. Check [API_REFERENCE.md](../API_REFERENCE.md) - To avoid duplicating endpoints/functions
3. Consult [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) - To find the right document for your task

**Other Reference Files**:
- [TACTICAL_GUIDE.md](../TACTICAL_GUIDE.md) - How each tactic affects match outcomes
- [POWER_CALCULATION_EXPLANATION.md](../POWER_CALCULATION_EXPLANATION.md) - Player power formula details
- [IMPLEMENTATION_COMPLETE.md](../IMPLEMENTATION_COMPLETE.md) - Phase 14 summary

---

## Updating Copilot Instructions

When modifying this file:
- Update "Project Overview" if core tech stack changes
- Add new tactical dimensions to "Tactical System" section
- Document new engine mechanics in "Architecture Knowledge"
- Link new key files in the file reference table
- Preserve examples from actual codebase

**IMPORTANT**: If you add a new API endpoint or service function, also update:
- [API_REFERENCE.md](../API_REFERENCE.md) with the new endpoint/function
- [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) if it changes the decision tree

Last updated: March 2026
