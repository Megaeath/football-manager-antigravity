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
- Log timeline now supports tick-level sequencing for replay-grade fidelity: `minute`, `tick`, `sequence`
- `TICK_SNAPSHOT` rows keep compact all-player positions in `metadata`; dedicated `POSITION_SAMPLE` movement rows now persist per-player `x` / `y` so a single player's path can be audited directly by `playerId`
- Per-tick all-player positions are persisted as compact snapshot JSON in tick-snapshot rows (`actionType = TICK_SNAPSHOT`) to avoid per-player movement row explosion
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

**V2 Replay Integration (Develop Mode)**:
- `/match` now renders V2 Canvas as the primary/only replay visualization (legacy V1 toggle removed)
- V2 replay is generated on-demand from `GET /api/match/[id]/v2-sim`
- สำหรับ persisted match, V2 replay บน `/match` ควร stable ข้าม refresh โดยใช้ deterministic seed จาก `matchId`; การขอ replay ใหม่ควรเกิดจาก action `Regenerate V2 Replay` เท่านั้น
- V2 frames can include `ballTransitions` so the canvas shows pass/shot arcs instead of teleporting the ball carrier state
- Saved shots now evaluate goalkeeper reach based on keeper position + reflex attributes; difficult angles can beat the keeper, while reachable shots can be caught or parried
- Parried saves can produce a second `SAVE` transition (deflection/rebound) so nearby attackers can follow up or defenders can clear
- Goal events are shown after the shot flight reaches the goal line, and kickoff reset is delayed briefly so users can visually read full goal transition
- V2 scoreboard overlay follows replay timeline (cumulative GOAL events up to current frame) instead of showing final generated score immediately at kickoff
- V2 canvas player markers are intentionally small/lightweight so spacing remains readable; oversized markers can visually exaggerate movement speed and crowding
- Base shape in V2 should remain role-realistic: goalkeeper stays inside usable box depth, back lines hold below midfield, and forwards must stay offside-safe relative to the defensive line when idling/supporting
- Goal validation in V2 must respect the actual goal mouth; shots that finish outside the post range should remain saved/off-target instead of being counted as goals
- V2 now applies V1-style incident conditions for `THROW_IN`, `CORNER`, `FOUL`, `CARD_YELLOW`, and `CARD_RED` in dribble/pass/shot resolution, including foul-driven free-kicks and dismissal handling
- V2 set-piece taker selection is role-aware: throw-ins prefer `DR`/`DL` or highest `throw`, corners/free-kicks prefer highest `setPieces` profile, corners pull `DC`/target attackers into the box, and foul free-kicks choose direct-shot vs long-delivery restart by distance-to-goal
- At playback `15x/20x`, canvas overlays switch to highlight-only mode (major events + major transitions) to reduce visual spam
- Highlight event text now includes shot distance (meters from shooter to target) so long-range shot volume is easy to inspect during replay tuning
- On `/match`, the V2 panel prioritizes replay viewport height; top telemetry cards are removed so the canvas/highlight area can be taller and easier to read
- On `/match`, the V2 replay panel hides the old visualization header strip (`Visualization`, `V2 Canvas`, `Regenerate V2 Replay`) to keep focus on scoreboard/canvas/highlight flow
- Highlight commentary now promotes major incidents (goal/shot/cards) as large ticker-style text in the commentary area for quick readability
- Live commentary box on `/match` should remain a single-line ticker (ellipsis for overflow) so replay controls/filter areas keep enough visible space on smaller screens
- For unprocessed matches (`isPlayed = false`), `/match` should show only the top scoreboard state (typically `0-0`); replay/session panel and all lower tabs (`stats/events/home/away/heatmap`) must stay hidden until the match is processed
- Replay panel on `/match` now includes an `Animation Event` filter (`all`, `SHOT`, `PASS`, `DRIBBLE`) that controls which on-canvas event markers and live ticker event texts are shown during playback
- When `Animation Event` filter is not `all`, replay playback should prioritize filtered incident windows by playing the event minute plus the following minute, then skipping ahead to the next matching window
- For already-played matches in authoritative mode, `PASS`/`DRIBBLE` animation filtering should use replay incident stream for visualization windows (persisted authoritative events typically do not include dense pass/dribble incidents)
- Highlight ticker on `/match` should be event-config driven (currently: `SHOT`, `FREE_KICK`/foul context, `YELLOW_CARD`, `RED_CARD`) and persist for ~30 ticks unless a new configured event arrives (then replace/reset window)
- When `Animation Event` filter is active (not `all`), ticker hold logic should also retain the selected filtered event text briefly so `PASS` / `DRIBBLE` windows remain readable
- หลังเหตุการณ์สำคัญของ replay (`GOAL`, `SHOT`, `FREE_KICK/FOUL`, `YELLOW_CARD`, `RED_CARD`) ควรมี action-cooldown ~2 ticks เพื่อกันข้อความ/เหตุการณ์วิ่งเร็วเกินอ่าน
- Live commentary บน `/match` ควรคงข้อความเดิมไว้ในช่วง tick ว่างหลังเหตุการณ์ใหญ่ (อย่างน้อย 2 ticks)
- V2 ball rendering now uses a football-style patterned sprite with spin animation (instead of a static white circle) so ball movement is easier to read
- On `/match`, V2 canvas now shows always-on `x,y` labels for both every player marker and the ball so replay positions can be compared directly against persisted DB/action-log coordinates
- V2 player marker rendering should remain visually continuous frame-to-frame using player-id-based interpolation, but must avoid blending across large jump frames (set-piece/reset-like jumps) to reduce number-swap illusions
- Sent-off players should not remain as active on-field markers; `/match` now surfaces them in an off-field `Sent off` strip for clearer dismissal context

- V2 now tracks continuous per-tick movement analytics per player (movement distance, carry distance/time, zone occupancy seconds), which can be used as base data for future heatmap features
- `/match` includes a **Heat Map** tab that renders dual-team possession density using only V2 frame data (`frame.ball.position` + `frame.ball.possession`), with separate home/away colors
- Heat Map tab supports dropdown filters:
  - Event filter: `all`, `SHOT`, `PASS`, `DRIBBLE`
  - Team filter: `all`, `home`, `away`
  - Player filter: `all` (default) or specific on-field player (options follow current team filter, sorted by role group `GK -> DF -> MF -> FW`, show `name + position`, and include only players who actually appeared on-field in replay frames, with persisted played-minutes fallback for legacy rows)
- Event dropdown values ควรอิงจาก master config ชุดเดียวกันระหว่าง Heat Map และ event list filter
  - Goal markers remain visible on the pitch and respect selected team filtering
- Heat Map density uses spread/smoothing across neighboring cells so single-player traces look like realistic movement zones instead of thin straight bars
  - For already-persisted matches, Heat Map goal-marker count must follow authoritative persisted `GOAL` events/score, not all regenerated V2 replay goals
- Heat Map pitch drawing should follow the same field geometry/proportions as V2 canvas FieldLayer (3:2 display ratio, matching penalty/goal box and corner arc layout)
- Heat Map marker/source data should keep replay raw coordinates in `0..100`; rendering uses a 150x100 SVG pitch (`3:2`) with linear mapping `renderX = rawX * 1.5`, `renderY = rawY`
- Heat Map marker data sources:
  - `SHOT`/`PASS`/`DRIBBLE` markers use `v2Replay.visualEvents[].position`
  - `GOAL` markers are authoritative from persisted match `GOAL` events, with replay-goal position as preferred placement and deterministic fallback position when replay marker is missing
- Heat Map event markers should show their event minute label on the pitch to support quick timeline-vs-position audit (alongside hover tooltip source details)
- On `/match`, authoritative score/event/player-stat/team-stat data must come from persisted match tables (`GET /api/match/[id]`), not from on-demand V2 replay generation; V2 replay is visualization-only and may be regenerated without replacing saved result data
- Replay scoreboard in `/match` should follow authoritative persisted goal progression and reconcile with final persisted score (so late/missing replay-only events do not drift from saved result)
- Replay highlight/commentary flow on `/match` should be **authoritative-first** for played matches: only persisted match events drive ticker/commentary/highlight labels, so replay-generated incidents never contradict saved score/events
- Replay timeline bar in `/match` should include a +1 minute display window (showing up to ~91) so 90th-minute incidents remain reachable/visible on slider endpoints
- On `/match`, playback time labels should use single-minute display (`0` ... `90`) for replay UX; canonical persisted event minute remains `1..90` in DB/API
- For already-played matches, V2 replay should prefer the authoritative match participants (players with persisted minutes) so current squad changes or stale tactical assignments do not introduce players who did not actually appear in that match
- If an `AI vs AI` match is opened directly before another scheduler step processes it, the match detail route may simulate and persist that AI-only match first so the page still renders saved results rather than ephemeral replay-only values
- Dribble metrics now count only opponent-beating dribble duels; simple lane carries are treated as possession-space progression, not `dribblesWon`
- On `/match` player tabs (`home`/`away`), list ordering should stay stable by bucket: starting XI first, then reserves; each bucket sorts by role group `GK -> DF -> MF -> FW`, and substitutions must not reshuffle starter rows so reserve players who came on remain visible as reserve entries

### 1.3 V2 Spatial Decision Model (Develop Mode)

**Location**: `src/lib/engine/v2/match2d.ts` + `src/lib/engine/v2/spatialEngine.ts`

V2 action selection now uses a **utility-style weighted decision** (not simple fixed thresholds):
- Builds context from pressure, distance-to-goal, forward space, and game state (leading/trailing + late-minute urgency)
- Adds pass-lane risk (opponents near pass segment) and receiver-angle quality into pass target evaluation
- Uses lightweight transition mode (`FAST_BREAK` vs `SETTLED`) to bias direct actions
- Applies tactical bias from team instructions (`mentality`, `passing`, `creative_freedom`)
- Scores PASS/SHOOT/DRIBBLE and samples by weighted probability

Loose-ball ownership when no carrier is also upgraded:
- Evaluate nearest candidate from each side
- Compare arrival time using running power (`pace`, `acceleration`, `stamina`, `condition`)
- Resolve close races with a small duel tie-break (`bravery` + randomness)

Dribble duels are no longer fixed chance only:
- Tackle success now depends on tackler vs dribbler attribute blend
- Nearby support defenders increase tackle win probability

Phase 4/5 develop-mode upgrades (current implementation):
- Pass target selection uses `scorePassTargets()` to rank receivers by distance profile, openness, forward progress, urgency, and pass-lane risk, then samples from top options
- Defensive side uses `assignDefensiveRoles()` each tick (presser/cover/line holders) so pressing shape stays coordinated instead of all players collapsing on ball
- Movement loop applies defensive assignment overrides before clamped movement/offside checks (`PRESS`, `COVER`, `DEFEND` role-intent labels)
- Telemetry markers:
  - `[V2-Phase4]` selected pass utility/risk/success snapshot
  - `[V2-Phase5]` defensive coordination snapshot (presser/cover/lineX)

Phase 6/7 develop-mode baseline (current implementation):
- Added role specialist modules (`roleSpecialists/*`) for GK/DEF/MID/ATT/FW and merged specialist intents with base movement intent each tick
- Added `TUNING_PARAMS` in `config.ts` to centralize movement lerp, specialist blend, pass option count, cover offsets, and telemetry intervals
- Added telemetry collector (`telemetry.ts`) that aggregates intent-job counts, press/cover counts, and sampled pass selection risk/utility
- `MatchFrame` can carry optional `debug` overlay payload (intent vectors + defensive assignment lines), and `V2MatchState` can carry aggregated `telemetry`

Phase 6/7 realism hardening (current implementation):
- Team ownership in V2 no longer relies on player-id string heuristics; side context is explicit (`V2PlayerState.side`) and propagated through movement + telemetry
- Specialist logic is now state-aware per player (`DEFENDING` / `IN_POSSESSION` / `ON_BALL`) and corridor-clamped via role buckets (GK/DC/FB/DMC/CM/AMC/WM/WINGER/ST)
- Movement loop applies anti-collapse teammate spacing guard to reduce unrealistic multi-player clustering around the same point
- Movement execution now uses pace-table top speed (1-20), acceleration ramp (time-to-top-speed), on-ball penalty, and late-game stamina decay rather than fixed lerp-only stepping
- Defensive coordination now keeps line-holder overrides on defender/DM roles only (not full-team collapse), and mentality drives defensive line/pressure (normal shape holds zones; ultra-defensive stays deeper)
- Role corridors are treated as **base zones** (not hard cages): in-possession and on-ball players can overflow corridor limits contextually, then naturally recover back toward role shape using pace/acceleration-driven movement
- In-possession support is now more role-aware: forwards/AMs can drop short into receive pockets when buildup is deeper, while midfielders and defenders step into open passing lanes instead of standing on static role spots
- Full-backs in possession can now overlap much higher when the ball is already advanced, giving clearer wide support lanes in sustained attacks
- Out-of-possession first-line pressing is now more realistic: forwards drop below their high line to press passing lanes and support the midfield block instead of only hovering high
- On-ball decision now includes progressive dribble behavior: wide/on-ball carriers can carry into space until pressure arrives, then resolve via pass/dribble duel with turnover risk under crowding
- Goalkeepers should distribute quickly after claiming possession (no prolonged hold when not in major-event cooldown)
- In advanced attacking zones, pass selection should avoid unrealistic deep back-passes (especially to own GK) and prefer nearest safe support options when lanes are available
- Dribble/pass pressure windows are configurable in `TUNING_PARAMS` (default: immediate dribble pressure radius = 2, receiver open-space radius = 5, contested receiver window = 2..5)
- Near-byline carriers can attempt early crosses into the box (configurable chance + byline zone), enabling cutback/cross chance creation for forwards
- Shooting is role-zone gated (`shotMinXHomeByRole`) so low-probability own-half/long-range spam is suppressed by role
- Passing now uses deterministic short/long resolution in V2:
  - **Short pass** checks lane blockers along segment `A→B` (defender within ~2 units of line ⇒ immediate turnover)
  - **Short pass receive** checks nearest defender within ~2 units of target and resolves by defender `tackling+positioning` vs receiver secure score
  - **Long pass** ignores lane blockers but runs arrival-time contest at target area: nearest defender must be able to reach the target radius by pace/acceleration-based travel distance (no random speed), then duel by `tackling+heading+positioning`
- On-ball dribble displacement is capped by each player's pace-driven per-tick movement (`movementSpeed * movementTickSeconds`) to prevent unrealistic carrier teleporting and keep chasers relevant
- After all per-tick updates, V2 now applies a final anti-warp clamp for **every player** using deterministic pace/acceleration reach for that tick, so direct assignment flows (set-pieces/restarts/etc.) cannot move a player farther than their physical reach in one tick
- After a goal event resolves, V2 now performs a center-circle kickoff reset (ball to midfield with conceding side possession) to avoid post-goal stalled play
- Kickoff reset ใน V2 ต้องจัดตำแหน่งผู้เล่นกลับฝั่งตัวเอง (forwards stay kickoff-safe at/behind halfway line)
- Shots that finish off target should restart via explicit `GOAL_KICK` state (not loose-ball chaos behind goal)
- V2 simulation cadence now runs at `10 ticks/minute` (config-driven). Carrier decisions are evaluated every tick, while movement remains hard-capped by pace-table + acceleration + fitness/stamina so players cannot warp or exceed speed limits
- Non-major possession actions should now resolve continuously at tick cadence: outside cooldown windows, V2 can chain one action per tick (for example pass receipt → next decision on the same receiving tick), while major incidents like shots/goals/cards still apply cooldown for readability

**Tuning note**: if V2 over-shoots volume, tune coefficients in `selectAction()` first before changing global movement constants.

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

**Jersey Number Management** (`jerseyNumberService.ts` + transfer/contract flows):
- Squad numbering rule: starting XI prioritized to `1..11`, remaining squad assigned from `12+`
- Incoming player assignment rule: always use the **lowest available** squad number first (reuse vacated numbers before new numbers)
- When a player leaves team context (free agent/retired/contract release), `jerseyNumber` must be cleared (`null`)
- Applies to both user and AI teams (new game initialization + market transfer completion + release paths)

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

### Sticky App Header

**Location**: `src/components/Header.tsx`

- The global sticky header collapses on downward scroll to return more vertical space to the active screen
- In compact mode, the `⚽ FOOTBALL MANAGER` brand is intentionally reduced to about half of its normal visual size
- Compact mode also trims header padding and secondary pill/button sizing; keep future header changes consistent with this space-saving behavior

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

### Requirement Analysis Before Development (PO Mode)

When a request is still at requirement/discovery stage (before implementation), use:

- `.github/football-production-owner-skill.md`

Expected output at this stage is a **Requirement Analysis Pack** (problem, scope, KPI, acceptance criteria, risk, task breakdown, handoff), then proceed to implementation only after scope is agreed.

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
| **Debug Visualization UI** | `src/app/debug/page.tsx` (full match action flow, loop navigator, chain analytics) |
| **Game Time Management** | `gameTime.ts` (advance day, season transitions) |
| **API Routes** | See [API_REFERENCE.md](../API_REFERENCE.md) for complete endpoint guide |

---

## Debugging & Testing Scripts

Located in `scripts/` and root:
- `test-power.js` - Verify player power calculations
- `ANALYZE_PLAYER.js` - Deep dive into player attributes post-match
- `check-date.js` - Validate UTC game time
- `check-player-data.ts` - Inspect player state in DB
- `verify-v2-batch.mjs` - Run repeated V2 simulations and report average goals/shots for balance tuning

Run: `node scripts/test-power.js` (requires node, no build step)
Run V2 batch check: `node scripts/verify-v2-batch.mjs 50`

For in-app behavior debugging, use `/debug`:
- Full action stream (`loop-by-loop`) from raw logs
- Flow visualization by `ballPosition` across loops
- Chain/zone/action-type analytics for regression checks after engine changes

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
