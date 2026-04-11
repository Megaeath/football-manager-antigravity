# Football Manager Engine - AI Coding Instructions

## Mandatory Read Order

Before making **any** code, API, schema, service, simulation, or UI change, read documents in this order:

1. `.github/personal-game-dev-skill.md`
2. `DOCUMENTATION_GUIDE.md`
3. `API_REFERENCE.md`
4. `.github/copilot-instructions.md`

This order is mandatory for all future work in this repository.

---

## Personal Developer Contract

This AI assistant acts as the user's **personal game developer** for this project.

That means every change must:
- preserve existing architecture and reuse existing APIs/services before creating anything new
- keep UX/UI aligned with the current visual and interaction language
- update the relevant documentation in the same task
- leave the project easier to debug than before

If a task changes behavior, structure, API contracts, setup, or screen behavior, documentation must be updated before the task is considered complete.

## Project Overview

A Next.js 16 + TypeScript tactical football simulation engine with Prisma persistence. The engine simulates realistic matches with 300-600 passes per team, dynamic player ratings, and deep squad management. Current date context: April 2026.

**Core Architecture**: Next.js App Router → Server Actions (actions.ts) → Prisma ORM → SQLite or Turso (libSQL adapter)  
**Match Engine**: Pure TypeScript simulation with minute-by-minute action resolution and probabilistic outcomes  
**State Pattern**: Database-driven with tactical/financial modifiers applied at match time

---

## Documentation Maintenance Rule

Every implementation task must also evaluate documentation impact.

At minimum:
- API changes → update `API_REFERENCE.md`
- architecture/workflow/debugging changes → update `.github/copilot-instructions.md`
- feature navigation / decision-tree changes → update `DOCUMENTATION_GUIDE.md`
- tactic behavior or UX wording changes → update `TACTICAL_GUIDE.md` when relevant

Never leave the repository with code that no longer matches the docs.

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

**Experience Multiplier** (`getExpBonus`, `getExpMultiplier`):
- EXP is clamped to `[-1000, 1000]`
- Uses 1.8-rule tiering (`0..179 => +0`, `180..279 => +2`, ... `980..1000 => +10`)
- Applied through `getEffectiveAttributes()` before each match

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

**AI Contract Auto-Renew Guardrails** (`autoRenewContracts`):
- Contract flow should not force immediate free-agent release for non-expiring players.
- Position-depth renewal floors are role-aware:
  - Center core (`DC`, `MC`, `FWC`) target minimum depth = 4
  - Specific positions (`GK`, `DR`, `DL`, wide/other roles) target minimum depth = 2
- If depth is above floor, the contract can be marked as non-auto-renew, but release decisions should be left to dedicated market logic.

**Player Value** (`evaluateMarketValue`):
- Base: (overall * 10,000) + (age factor * 5,000,000)
- Modifiers: popularity, recent performance, remaining contract weeks
- Used for transfer market AI bids (`aiMarketService.ts`)

### 6. Training System (Facility + Weekly Processing)

Training is a user-team feature (Phase 1) with dedicated state and weekly processing.

- Team field: `Team.trainingFacilityLevel` (Lv.1-Lv.9)
- Slot model: `TrainingAssignment` (max 5 slots/team)
- Decimal accumulation: `PlayerTrainingFraction` (remainder + lifetimeGain)
- Weekly idempotency: `TrainingWeeklyLedger` (`@@unique([teamId, weekKey])`)

Execution behavior:
1. On week boundary (`advanceDay()`), call `processWeeklyTraining(userTeamId, weekKey)`
2. If funds are insufficient for weekly fee, training is skipped (`SKIPPED_FUNDS`) and no gain is applied
3. If funds are sufficient, weekly fee is charged once and active slots roll random gain (`0.10..maxGain`)
4. Base attributes remain integers; decimal progress is stored in fraction table and shown in training UI analytics

### 6.1 AI Market Daily Distribution (Overdue + Emergency Depth)

**Location**: `src/lib/services/gameTime.ts` + `src/lib/services/aiMarketService.ts`

`advanceDay()` runs distributed AI transfer processing in two buckets:

1. **Overdue bucket**: teams not processed for 14+ days (default batch size `5`, via `AI_MARKET_BATCH_SIZE`)
2. **Emergency depth bucket**: extra teams with required-position depth `< 2` (default batch size `3`, via `AI_MARKET_ISSUE_BATCH_SIZE`)

Depth checks are formation-aware and normalized by role groups (`FW* -> FW`, `DC* -> DC`, `MC* -> MC`).
Effective depth also includes active incoming bids (`PENDING`/`ACCEPTED`/`HIJACKED` with live window),
to prevent emergency teams from over-bidding the same position every day.
This allows structurally short squads (e.g. only one GK) to get extra daily buying chances without waiting for monthly cadence.

### 6.2 Squad Transfer Tab (History + In-Process)

**Location**: `src/app/squad/page.tsx` + `src/app/squad/SquadClient.tsx`

The Squad transfer panel now shows two layers of transfer state:

- **Completed history** from `TransferHistory`
- **In-process deals** from active `Bid` records (`PENDING`/`ACCEPTED`/`HIJACKED`) with non-expired `windowEnds`

Design intent:
- Users can see players who already have an agreed/active deal but have not moved yet
- In-process entries should show direction (IN/OUT), status, fee, and move window deadline

### 7. Season Summary Analytics

**Location**: `src/app/season-summary/page.tsx`

The season summary page now includes richer records/leaderboards by selected season + competition filter:

- Top 5 transfer fees (`TransferHistory`)
- Highest total-goals match
- Highest winner-goals match
- Top 3 awards display (Golden Boot, Golden Glove, Player of the Season)
- Top 3 skill leaderboards (dribbles won, passes completed, assists)

When debugging mismatched numbers, verify filter scope first (`season`, `competition`, `division`) before checking raw records.

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

**Auto Lineup Rest Rule**:
- Auto lineup selectors should treat fitness as a hard rotation signal.
- If a candidate player has `condition < 85`, prefer a fresh replacement (`condition` near 100) even when base power is slightly lower.
- Keep this behavior consistent in both pre-assignment services and pre-match AI lineup fallback logic.
- Auto lineup selectors must prefer role-compatible natural positions for each tactical slot before allowing cross-position fallback picks.

### API Route Pattern

**Location**: `src/app/api/[resource]/route.ts`

Use shared Prisma singleton in routes:

```typescript
import prisma from '@/lib/prisma';
```

Do not instantiate `new PrismaClient()` directly in route files, to keep DB mode (SQLite/Turso) consistent.

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

### Home Dashboard Live Data

**Location**: `src/app/page.tsx`

The dashboard home page shows user-team-sensitive cards (team name, balance, next match, league position).

- The page must opt out of route caching with `noStore()` so it reflects the current `GlobalGameSettings.userTeamId`
- This is especially important after `initializeNewGame()`, day processing, or any balance-changing workflow
- If home dashboard cards show the wrong team or stale budget, check that `src/app/page.tsx` still calls `noStore()` before Prisma reads

### Experience Decay System

Current behavior:
- Legacy monthly decay path is disabled (kept only as month marker guard)
- Match EXP is applied per match with age efficiency in `processMatch()`
- Match EXP gain per player is hard-capped at `+3` per match before persistence (all positions including GK)
- Season-end correction is applied in `applySeasonExpAdjustments()`:
  - age efficiency + seasonal cap + award/relegation bonuses + annual decay
  - correction delta is written to `player.exp`

**Trigger**: `startNewSeason()` calls `applySeasonExpAdjustments()`.

---

## Development Workflows

### Required Workflow For Every Change

1. Read `.github/personal-game-dev-skill.md`
2. Read `DOCUMENTATION_GUIDE.md`
3. Read `API_REFERENCE.md` before adding or changing API-related behavior
4. Reuse existing server actions, services, engine functions, and UI patterns when possible
5. Implement the smallest correct change
6. Update docs in the same task
7. Verify UX/UI consistency on affected screens

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

**Add/modify training mechanic**:
1. Update constants in `src/lib/constants/training.ts`
2. Update processing logic in `src/lib/services/training.ts`
3. If weekly timing changes, update `advanceDay()` hook in `src/lib/services/gameTime.ts`
4. Keep API surface aligned in `API_REFERENCE.md`

**Import legend squads from CSV**:
1. Ensure `LegendPlayer` model in `prisma/schema.prisma` is up to date
2. Run `npx prisma db push` after schema changes
3. Run `npm run legends:import` to load files in `reports/legend-csv/`
4. Verify row count/team count in script output before using legend-mode features

**Fix/reset new game initialization**:
1. Ensure reset clears **all** match/tournament state in `initializeNewGame()`
2. Clear league + cup state together (Match, CupTournament, SwissStanding, SwissMatchHistory)
3. Clear training state tables (TrainingAssignment, PlayerTrainingFraction, TrainingWeeklyLedger)
4. Preserve and restore the `LegendPlayer` catalog across team resets before recreating squads
5. Rebuild fixtures only after all old state is fully removed

**Legend mode new game**:
1. Keep `normal` mode behavior unchanged (random squad generation)
2. For `legend` mode, recreate imported legend players from `LegendPlayer` first, then add random fillers until each squad reaches 23 players
3. Fit legend attributes against `calculatePlayerPower()` so the resulting in-game power matches stored legend power targets as closely as possible
4. Reassign starting `tacticalPosition` values from the final roster so mixed legend/random squads still open with a valid lineup

---

## Key Files by Purpose

| Purpose | Files |
|---------|-------|
| **Match Engine** | `match.ts`, `playerPower.ts`, `formulas.ts` |
| **Financial System** | `financial.ts`, `market.ts` (bidding) |
| **Experience & Progression** | `experience.ts`, `financial.ts` (decay) |
| **Training System** | `training.ts` (service), `constants/training.ts`, `app/training/*` |
| **Legend Data Import** | `scripts/import-legend-csv.mjs`, `reports/legend-csv/*`, `schema.prisma` (`LegendPlayer`) |
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

6. **Cup Season Year Mapping**: Cup tournament `season` is an index (1,2,3...), not a calendar year. Always map to real year when generating cup dates (season 1 => 2026) to avoid legacy dates like 1901 and perpetual “match due” behavior.

7. **Red Card Minutes**: In match simulation, when a player receives a red card, `PlayerMatchStats.minutes` must be clamped to the dismissal minute (e.g. red at 72' => max 72) so UI stats match match events.

---

## 🗂️ Related Documentation

**Before starting ANY development**:
1. Read [personal-game-dev-skill.md](personal-game-dev-skill.md) - Personal developer contract and mandatory workflow
2. Read this file (copilot-instructions.md) - Architecture overview
3. Check [API_REFERENCE.md](../API_REFERENCE.md) - To avoid duplicating endpoints/functions
4. Consult [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) - To find the right document for your task

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

If you change UX/UI behavior, setup flow, DB mode behavior, or architecture assumptions, also update the relevant documentation in the same task.

Last updated: April 2026 (Personal skill + documentation-first workflow + Turso-aware architecture)
