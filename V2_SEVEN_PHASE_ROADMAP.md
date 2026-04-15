# V2 Football AI Overhaul: 7-Phase Development Roadmap

**Project Goal**: Transform V2 engine from simple drift-based replay into authentic 22-player autonomous football AI with role-specific decision logic.

**Current Status**: Phase 1 ✅ COMPLETE  
**Next Phase**: Phase 2 (Movement Executor Wiring)  
**Total Estimated Effort**: 35-50 hours (spread across 7 phases)  
**Session Date**: April 14, 2026

---

## Phase Overview

| Phase | Name | Goal | Effort | Status |
|-------|------|------|--------|--------|
| 1 | Team Context Builder | Per-tick strategic state | ✅ COMPLETE | Ready |
| 2 | Movement Executor Wiring | Role-aware individual movement | 6h | BLOCKED ON 1 |
| 3 | Role Intent Generation | Per-player decision logic | 8h | BLOCKED ON 2 |
| 4 | Pass-Option Scoring | Intelligent target evaluation | 5h | BLOCKED ON 3 |
| 5 | Defensive Coordination | Pressing/covering assignments | 6h | BLOCKED ON 4 |
| 6 | Role Specialists | GK/CB/FB/MID/WING/FW modules | 10h | BLOCKED ON 5 |
| 7 | Telemetry & Tuning | Debug, visualization, balance | 8h | BLOCKED ON 6 |

---

## Phase 1: Team Context Builder ✅ COMPLETE

**Completed**: April 14, 2026

### Deliverables
- ✅ TeamContext type system (GamePhase, PressureLevel, DefensiveLineHeight, BallSide)
- ✅ buildTeamContext() function populating 8 strategic fields
- ✅ Integration into main simulation loop (1080 calls/match)
- ✅ Debug telemetry output (every 10 minutes)
- ✅ TypeScript/ESLint validation (0 errors)

### Output Example
```
Home: tick=120, minute=10, phase=ATTACK, pressure=70, lineHeight=65, ballSide=ATTACKING
Away: tick=120, minute=10, phase=DEFEND, pressure=45, lineHeight=40, ballSide=DEFENSIVE
```

### Files Modified
- `src/lib/engine/v2/types2d.ts` (+95 lines, new types)
- `src/lib/engine/v2/match2d.ts` (+90 lines, function + integration)

### Gate to Phase 2
- ✅ TeamContext available for all 22 players per tick
- ✅ No performance regression
- ✅ TypeScript strict mode pass

---

## Phase 2: Movement Executor Wiring (NEXT)

**Objective**: Wire isolated role-aware movement logic; replace generic drift with per-player target-based positioning.

### 2.1 Add RoleIntent Type System

**File**: `src/lib/engine/v2/types2d.ts`

**Changes**:
- Add `RoleJob` union: 'MARK' | 'PRESS' | 'SUPPORT' | 'DEFEND' | 'ATTACK' | 'POSITION' | 'COVER' | 'OFFSIDE_TRAP'
- Add `RoleIntent` interface:
  ```typescript
  interface RoleIntent {
    job: RoleJob;                    // What this player should do
    targetPosition: SpatialPosition; // Where to move
    priority: number;                // 1-100 (goal priority)
    utilityScore: number;            // Calculated value of this action
    context: string;                 // Why chosen ("close to ball", "run line", etc.)
  }
  ```

**Acceptance Criteria**:
- RoleIntent type compiles
- Job enum covers 8 primary football roles
- Target position is 2D coordinate
- Priority/utility numeric
- All types exported from types2d.ts

### 2.2 Implement Movement Executor Function

**File**: `src/lib/engine/v2/spatialEngine.ts` (currently dormant)

**Changes**:
- Activate `calculateTargetPosition()` function (currently stubbed)
- Signature: `(player: V2PlayerState, teamContext: TeamContext, teammates: V2PlayerState[], opponents: V2PlayerState[], ball: V2BallState) => SpatialPosition`
- Logic flow:
  1. Get player role (from position)
  2. Query ball possession and distance
  3. Apply role-specific gravity (GK toward box, ST toward goal, MID toward ball)
  4. Calculate teammate/opponent proximity weight
  5. Factor team context (phase, pressure, lineHeight)
  6. Return weighted target position

**Implementation Hints**:
- Use `roleConfig` from config.ts (speed, movement weights per role)
- Factor lineHeight into X positioning
- Ball side determines urgency direction
- Pressure level modulates attraction to ball

**Acceptance Criteria**:
- calculateTargetPosition() returns 2D coordinate on field
- Different outputs per role (GK vs FW vs MID)
- Uses team context data (phase, pressure, lineHeight)
- No hardcoded values (all configurable from config.ts)

### 2.3 Wire Movement Executor into Main Loop

**File**: `src/lib/engine/v2/match2d.ts`

**Changes**:
- Replace `advanceSupportMovement()` call with new executor flow:
  ```typescript
  // For each player, calculate intent and move
  for (const player of homePlayers) {
      const targetPosition = calculateTargetPosition(
          player,
          teamContexts.home,
          homePlayers,
          awayPlayers,
          ball
      );
      player.position2D = interpolateToward(
          player.position2D,
          targetPosition,
          0.18 // movement speed per tick
      );
  }
  ```
- Maintain role-based X/Y clamping (existing logic)
- Keep offside-safe clamping for attackers
- Preserve collision detection (prep for Phase 3)

**Acceptance Criteria**:
- Player positions update per tick based on movement executor
- Each player has independent target (not team-wide drift)
- Role clamping still applied (GK stays in box, etc.)
- Offside safety maintained
- Performance: no regression vs. current advanceSupportMovement()

### 2.4 Add Movement Telemetry & Debug Output

**File**: `src/lib/engine/v2/match2d.ts`

**Changes**:
- Log movement intent every 60 ticks (5 minutes):
  ```
  [V2-Phase2] Minute 5: Home ball carrier (ST) targets (70, 45), defenders form line at X=15
  ```
- Store movement history per player for phase 7 visualization

**Acceptance Criteria**:
- Telemetry output shows player intents
- Output every 5 minutes (18 logs/match)
- Can trace any player's movement targets

### 2.5 Validation & Testing

**Commands**:
```bash
npx tsc --noEmit --skipLibCheck    # Type check
npx eslint src/lib/engine/v2/* --max-warnings 0  # Lint
npm run dev                         # Start server
curl http://localhost:3000/api/test-v2-match  # Generate replay
```

**Acceptance Criteria**:
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 warnings
- ✅ Replay generation: < 1 second
- ✅ Canvas visual: Player movement smoother/more role-aware than current
- ✅ Telemetry: 18 logs output to console
- ✅ No regression: Match stats (possession, passes, shots) unchanged

### Phase 2 Estimated Effort: 6-8 hours

**Blockers**: Phase 1 must be complete (✅ now is)

**Next Gate**: Phase 3 (Role Intent Generation)

---

## Phase 3: Role Intent Generation

**Objective**: Add per-player decision intelligence (GK outlet plays, CB stacking, FB overlap, MID circulation, WING half-space, ST pinning).

### 3.1 GK Intent Module

**File**: `src/lib/engine/v2/roleIntents.ts` (NEW)

**Function**: `generateGKIntent(gk: V2PlayerState, teamContext: TeamContext, defenders: V2PlayerState[], ball: V2BallState): RoleIntent`

**Logic**:
- If possession: Move toward goal line, ready for outlet passes
- If opponent has ball: Track cross threats, position for saves
- Box management: Stay between posts if in goal mouth area
- Distribution: Offer safe pass option to defenders

### 3.2 CB/FB Intent Modules

**Functions**: `generateCBIntent()`, `generateFBIntent()`

**CB Logic**:
- Mark nearest attacker
- Maintain line with partner (via team context lineHeight)
- Cover spaces vacated by FB overlap
- Position for interceptions

**FB Logic**:
- Track winger/wing-back opponent
- When possession: Overlap forward (half-lane width)
- When defending: Hold line or track runs
- Signal availability for support passes

### 3.3 Midfielder Intent Module

**Function**: `generateMIDIntent(mid: V2PlayerState, teamContext: TeamContext, teammates: V2PlayerState[], opponents: V2PlayerState[], ball: V2BallState): RoleIntent`

**Logic**:
- If possession: Position for pass circulation (move to open space, show hands)
- If defending: Cover spaces between back line and forwards
- Transition: First touch in own half when losing ball
- Support: Always be outlet for defenders

### 3.4 Winger/Attacking Midfielder Intent Module

**Function**: `generateWINGIntent()`, `generateAMIntent()`

**WING Logic**:
- Own half: Wider than midfield, track opposing wing
- Opposition half: Move to half-space or byline (team context attacking_focus)
- Creation: Receive to feet, target box with crosses/cutbacks

**AM Logic**:
- Float between lines
- Mark opposing DM when defending
- Move into box on set pieces
- Supply striker with through balls

### 3.5 Striker Intent Module

**Function**: `generateSTIntent(st: V2PlayerState, teamContext: TeamContext, defenders: V2PlayerState[], ball: V2BallState): RoleIntent`

**Logic**:
- Positioning: Pin back line, stay onside-safe
- Movement: Run into channels when ball nearby
- Positioning: Drop back for link-up when isolated
- Finishing: Move toward goal when in shooting range

### 3.6 Integration into Main Loop

**File**: `src/lib/engine/v2/match2d.ts`

**Changes**:
```typescript
// For each player, generate role intent
for (const player of homePlayers) {
    const roleIntent = generateRoleIntent(
        player,
        teamContexts.home,
        homePlayers,
        awayPlayers,
        ball
    );
    // Use roleIntent.targetPosition for movement in Phase 2
}
```

**Acceptance Criteria**:
- Each role type generates appropriate intent
- Intent changes with team context (phase/pressure/lineHeight)
- Intent responds to ball position dynamically
- Output: 22 intents per tick (available for canvas debug)

### 3.7 Telemetry

**Output**: Every 60 ticks, log sample intents:
```
[V2-Phase3] Minute 5: Home ST targets (75, 50) [PIN_LINE], CB_L marks (away_9), MID_C supports (30, 50)
```

### Phase 3 Estimated Effort: 8-10 hours

**Blockers**: Phase 2 (Movement executor) must pass validation

**Next Gate**: Phase 4 (Pass-Option Scoring)

---

## Phase 4: Pass-Option Scoring

**Objective**: Evaluate pass targets intelligently; prefer open teammates, avoid risky passes near opponents.

### 4.1 Add PassOption Type

**File**: `src/lib/engine/v2/types2d.ts`

**Type**:
```typescript
interface PassOption {
    receiver: V2PlayerState;
    distance: number;
    successProbability: number;  // 0-1
    riskLevel: number;            // 0 (safe) - 1 (risky)
    urgency: number;              // How time-critical
    utility: number;              // Weighted score
}
```

### 4.2 Implement Pass Target Scorer

**File**: `src/lib/engine/v2/spatialEngine.ts` (extend from Phase 2)

**Function**: `scorePassTargets(carrier: V2PlayerState, teammates: V2PlayerState[], opponents: V2PlayerState[], ball: V2BallState, teamContext: TeamContext): PassOption[]`

**Scoring Factors**:
- Distance: Prefer mid-range (12-20 yards) over long (> 30) or short (< 5)
- Space: Bonus if receiver is in open space (no nearby opponents)
- Positioning: Bonus if receiver is deeper in opponent half (attacking orientation)
- Risk: Penalty for passes near opponent defenders
- Context: In FAST_BREAK, prefer direct; in BUILD_UP, prefer safe short passes

**Output**: Array of scored pass options, sorted by utility

### 4.3 Update Pass Selection Logic

**File**: `src/lib/engine/v2/match2d.ts`

**Changes**:
- Replace random pass target selection with scored option selection
- Use `scorePassTargets()` to get ranked options
- Select from top 3-5 options probabilistically

**Acceptance Criteria**:
- Pass target selection reflects field positions
- Passes reflect team tactics (SHORT passing = more short options)
- Risky passes occur less frequently (fewer interceptions)
- Pass completion rate improves by 5-10%

### 4.4 Telemetry

```
[V2-Phase4] Minute 15: Pass (MID_C→FW_R): score=85, distance=18yd, openness=0.7, risk=0.2
```

### Phase 4 Estimated Effort: 5-7 hours

**Blockers**: Phase 3 (Role intents) must be generating

---

## Phase 5: Defensive Coordination

**Objective**: Implement pressing/covering assignments; defenders communicate pressing triggers and support coverage.

### 5.1 Add DefensiveAssignment Type

**File**: `src/lib/engine/v2/types2d.ts`

**Type**:
```typescript
interface DefensiveAssignment {
    assigner: V2PlayerState;   // CB typically
    presser?: V2PlayerState;   // Who presses ball carrier
    cover?: V2PlayerState;     // Who covers presser's space
    lineHolders: V2PlayerState[]; // Defenders holding line
    priority: number;          // Urgency of press
}
```

### 5.2 Implement Defensive Coordinator

**File**: `src/lib/engine/v2/roleIntents.ts` (extend)

**Function**: `assignDefensiveRoles(defenseTeam: V2PlayerState[], attackTeam: V2PlayerState[], teamContext: TeamContext, ball: V2BallState): DefensiveAssignment`

**Logic**:
- If pressure > 65: Aggressive press (nearest defender presses ball carrier, adjacent covers)
- If pressure 40-65: Mid-block (CBs hold line, DM covers gaps)
- If pressure < 40: Deep defense (all hold line, goalkeeper sweeps)
- Marking: Each defender assigned to attacker in adjacent zones

**Output**: Single coordinated assignment structure

### 5.3 Update Movement Logic with Covering

**File**: `src/lib/engine/v2/spatialEngine.ts`

**Changes**:
- If defensive assignment calls for press: Move toward ball carrier
- If covering assignment: Position between presser and goal
- If holding line: Match lineHeight from team context

**Acceptance Criteria**:
- Defensive shape holds better (fewer gaps)
- Pressing is coordinated (not all rush at once)
- Line stays compact (no defenders isolated ahead of line)
- Tackle success increases 10-15%

### 5.4 Telemetry

```
[V2-Phase5] Minute 8: Defense coordination - CB_R presses (away_9), CB_L covers, line at X=18, DM sweeps at (20, 50)
```

### Phase 5 Estimated Effort: 6-8 hours

---

## Phase 6: Role Specialists (GK, CB, FB, MID, WING, FW)

**Objective**: Implement rich, football-authentic behavior for each of 6 role types (expand from basic intents to complex decision trees).

### 6.1 GK Specialist Module

**File**: `src/lib/engine/v2/roleSpecialists/goalkeeper.ts` (NEW)

**Features**:
- Box management: Track threats, position for saves
- Angle play: Move to narrow shooting angles
- Distribution: Identify outlet passes to defenders
- Sweeper: Leave box to intercept through balls (based on pressure)
- Set pieces: Position for corners/free kicks

### 6.2 CB/FB Specialist Modules

**File**: `src/lib/engine/v2/roleSpecialists/defender.ts` (NEW)

**CB Features**:
- Positioning: Hold line at team lineHeight
- Marking: Assign to attacker, track runs
- Interception: Move to cut out passes
- Aerial: Position for defensive headers
- Ball-playing: Step up to offer passes

**FB Features**:
- Lane coverage: Track wing opponent
- Overlap: Advanced positioning when possession
- Defensive: Track back when losing ball
- Crossing: Deliver crosses from wing
- Support: Link with midfield

### 6.3 MID Specialist Module

**File**: `src/lib/engine/v2/roleSpecialists/midfielder.ts` (NEW)

**Features**:
- Circulation: Move to open passing lanes
- Pressing: Close down ball quickly
- Support: Always available to defenders
- Box presence: Move into box on attacks
- Distribution: Transition between phases

### 6.4 WING/AM Specialist Module

**File**: `src/lib/engine/v2/roleSpecialists/attacking.ts` (NEW)

**WING Features**:
- Half-space: Move to dangerous pockets
- Width: Stretch defense wide
- Creation: Deliver from byline or cutback
- Pressing: Check back when possession lost

**AM Features**:
- Creativity: Float between lines
- Shooting: Move into box
- Through balls: Link front two
- Work-rate: Defensive cover in middle

### 6.5 FW Specialist Module

**File**: `src/lib/engine/v2/roleSpecialists/forward.ts` (NEW)

**Features**:
- Positioning: Pin back line, stay onside
- Movement: Run into channels
- Link play: Receive to feet for teammates
- Finishing: Aggressive box movement
- Pressing: Chase ball aggressively

### 6.6 Integration

**File**: `src/lib/engine/v2/match2d.ts`

**Changes**:
```typescript
// For each player, get specialist module and generate intent
const specialist = getSpecialistModule(player.position);
const roleIntent = specialist.generateIntent(
    player,
    teamContexts.home,
    teammates,
    opponents,
    ball
);
```

**Acceptance Criteria**:
- Each role type generates distinct, football-authentic behavior
- GK stays in box and sweeps appropriately
- Defenders hold line and mark
- Midfielders circulate and press
- Wingers create width and chances
- Strikers pin line and create space
- No two roles move identically

### 6.7 Telemetry & Canvas Debug

- Log specialist decisions every 60 ticks
- Highlight roles on canvas with different colors
- Show decision context ("pressing", "marking", "supporting")

### Phase 6 Estimated Effort: 10-14 hours

---

## Phase 7: Telemetry & Tuning

**Objective**: Instrument behavior for analysis and balance; create debug tools for iterative tuning.

### 7.1 Add Telemetry Infrastructure

**File**: `src/lib/engine/v2/telemetry.ts` (NEW)

**Features**:
- Collect all intent decisions, movements, passes, shots
- Aggregate per-tick statistics (possession, pressure, line height)
- Generate per-match summaries (avg formation width, press frequency, etc.)
- Export JSON for external analysis

### 7.2 Canvas Debug Visualization

**File**: `src/app/match/components/MatchCanvas.tsx` (extend)

**New Debug Layers**:
- Intent vectors: Arrows showing each player's target
- Role highlights: Color-code by position (GK=blue, DEF=red, MID=green, ATT=orange)
- Defensive shape: Show line holders and pressers
- Pass lanes: Highlight scored pass options
- Zone heatmaps: Show action concentration (own half, middle, box)

### 7.3 Tuning Parameters

**File**: `src/lib/engine/v2/config.ts` (extend)

**New Section**: `TUNING_PARAMS`
```typescript
export const TUNING_PARAMS = {
    // Movement
    playerMovementSpeed: 0.18,      // interpolation speed per tick
    roleXBounds: { GK: [...], FB: [...], ... },
    
    // Intent generation
    pressProbability: 0.6,          // How often to press
    supportRadius: 15,              // How far to support
    
    // Passes
    passSuccessBonus: 0.15,         // How much space = success boost
    riskThreshold: 0.3,             // Risky pass acceptance
    
    // Defending
    markingDistance: 5,             // How close to mark
    coverDistance: 8,               // How far to cover
    lineHeight: { attack: 65, defend: 40 },
};
```

### 7.4 Per-Role Tuning Dashboard

**New Page**: `/debug/v2-tuning`

**Features**:
- Slider controls for all TUNING_PARAMS
- Real-time replay regeneration with new values
- Side-by-side comparison of stat changes
- Save/load tuning presets
- Export data for external analysis

### 7.5 Balance Validation

**Tests**:
- Avg team possession: 50% ± 5%
- Avg pass success: 70% ± 5%
- Shot ratio: 2-3 shots per team per half
- Defensive shape: Line compact, gaps < 8 units wide
- Movement variety: Different players move to different targets

### 7.6 Performance Profiling

**Metrics**:
- Replay generation time (target: < 1 second)
- per-tick CPU cost breakdown (movement, intents, passes, etc.)
- Memory usage (frames, events, telemetry)

### 7.7 Documentation & Release

- Update copilot-instructions.md with new V2 architecture
- Update API_REFERENCE.md with new telemetry endpoints
- Create V2_ARCHITECTURE.md deep-dive guide
- Record telemetry output format spec

### Phase 7 Estimated Effort: 8-10 hours

---

## Cross-Phase Dependencies & Sequencing

### Critical Path
```
Phase 1 (Team Context)
    ↓ (requires context)
Phase 2 (Movement Executor)
    ↓ (requires executor)
Phase 3 (Role Intents)
    ↓ (requires intents)
Phase 4 (Pass Scoring)      Phase 5 (Defense)     Phase 6 (Specialists)
    ↓                             ↓                      ↓
        All feed into         Phase 7 (Telemetry)
```

### Parallel Phases (Phase 4, 5, 6)
- Can develop in parallel once Phase 3 is stable
- Estimate 1-2 week parallel development (4-5 devs)

### Suggested Sequencing
1. **Week 1**: Phase 1 (1-2 days, done) + Phase 2 (6-8 days)
2. **Week 2**: Phase 3 (8-10 days, spans to week 3)
3. **Week 3**: Phase 4/5/6 (parallel, 10-14 days each)
4. **Week 4**: Phase 7 (tuning, doc, release)

---

## Risk Mitigation

### Risk 1: Overcomplicating Too Fast
**Mitigation**: Each phase has clear gates (TypeScript pass, telemetry output, replay generation < 1s)

### Risk 2: Performance Regression
**Mitigation**: Benchmark replay generation time before/after each phase; revert if > 10% slower

### Risk 3: Behavior Diverging from Football Reality
**Mitigation**: Phase 7 telemetry dashboard; compare stats to real league averages

### Risk 4: API Contract Breakage
**Mitigation**: No changes to `simulateMatch2D()` signature; all changes internal or via new telemetry endpoints

### Risk 5: Canvas Visualization Lag
**Mitigation**: Stream frame data in chunks; implement frame buffering in PlaybackControls

---

## Success Criteria (End of Phase 7)

- ✅ All 22 players move autonomously per role and team context
- ✅ Replay shows realistic football shapes (lines, gaps, pressing, covering)
- ✅ Pass selection reflects field positions (open targets prioritized)
- ✅ Defensive shape compact and coordinated
- ✅ GK behavior: distribution, angle play, sweeping
- ✅ Attacker behavior: pinning, runs, positioning
- ✅ No performance regression (replay < 1 second)
- ✅ Canvas visualization shows role-specific colors and movement intents
- ✅ Telemetry available for tuning and analysis
- ✅ Documentation updated and comprehensive

---

## Next Action

**START PHASE 2**: Activate spatialEngine.ts and wire movement executor into main loop.

**Estimated time to Phase 2 completion**: 6-8 hours of focused development.

---

## Session Notes

- **Phase 1 Completed**: April 14, 2026 ✅
- **Phase 1 Output**: Team context built, telemetry logging, no regressions
- **Phase 2 Readiness**: Ready to begin immediately
- **Recommended Schedule**: Phase 2 start today if available

