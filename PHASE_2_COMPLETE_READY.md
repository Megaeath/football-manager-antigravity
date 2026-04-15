# Phase 2 ✅ COMPLETE - Phase 3 Ready

## Phase 2 Completion Status

```
✅ RoleIntent Type System
✅ Movement Intent Generator
✅ Per-Player Movement Executor
✅ Offside Safety Restoration
✅ Movement Telemetry
✅ TypeScript Validation (0 errors)
✅ ESLint Validation (0 warnings)
✅ Code Documentation
✅ Ready for Build
```

---

## Current Architecture (Phase 1 + 2)

```
TICK LOOP (1080 ticks per 90-minute match)
│
├─ [1] Build TeamContext (Phase 1 - EXISTING)
│  ├─ Input: possession, minute, ball.position, score
│  ├─ Output: TeamContext { phase, pressure, lineHeight, ... }
│  └─ For: HOME team and AWAY team
│
├─ [2] Generate Movement Intents (Phase 2 - NEW)
│  ├─ For each of 44 players (22 × 2 teams):
│  │  ├─ Call generateMovementIntent()
│  │  ├─ Read TeamContext for job selection
│  │  ├─ Return RoleIntent { job, target, priority, ... }
│  │  └─ Store in homeIntents / awayIntents dicts
│  │
│  └─ Apply Per-Player Movement (Phase 2 - NEW)
│     ├─ For each player:
│     │  ├─ Apply role clamping (clampRoleX)
│     │  ├─ Apply offside safety (applyOffsideSafeX)
│     │  └─ Update player.position2D with damped movement
│     │
│     └─ Log Telemetry (Phase 2.4)
│        └─ Every 5 minutes: carrier intent metadata
│
├─ [3] Process Ball Transitions (Phase 3 - NEXT)
│  ├─ If activeTransition: advance ball along trajectory
│  ├─ Else: decide action (pass, shot, dribble)
│  └─ Update possession and carrier
│
└─ Frame Output (for canvas replay)
   └─ Store frame { ball, players, events, transitions }
```

---

## Phase 3: Possession Recovery & Ball Transitions

### 3.1 Loose-Ball Duel Logic

**When**: Ball becomes loose (turnover, clearance, interception)  
**What**: Determine which player wins the loose ball  
**How**:
- Find nearest player from each team
- Calculate arrival time: distance / player.pace
- Add bravery randomness (±0.5 seconds)
- Winner becomes new carrier

**Code Location**: `src/lib/engine/v2/spatialEngine.ts`  
**Function**: `resolveLoseBallDuel(ball, homePlayers, awayPlayers) → V2PlayerState`

### 3.2 Tackle Success Modifier

**When**: Defender challenges ball carrier  
**What**: Calculate tackle success probability  
**How**:
- Base chance: 40%
- Defender attributes: +tackling (max +25%)
- Carrier attributes: -dribbling (max -25%)
- Nearby support defenders: +5% each
- Result: 15-65% success rate

**Code Location**: `src/lib/engine/v2/spatialEngine.ts`  
**Function**: `calculateTackleSuccess(defender, carrier, supporterCount) → number`

### 3.3 Interception Zones

**When**: Passer considers pass target  
**What**: Calculate risk of interception per pass lane  
**How**:
- Define pass lane: line from passer to receiver
- Check defenders within 2m of pass lane
- Each defender: +10% interception risk
- Weather/field conditions: ±5%
- Result: 0-100% interception risk

**Code Location**: `src/lib/engine/v2/spatialEngine.ts`  
**Function**: `calculatePassLaneRisk(passer, receiver, defenders) → number`

### 3.4 Fast-Break Detection

**When**: Possession just changed or ball lost in attacking third  
**What**: Detect counter-attack opportunity  
**How**:
- Count attacking players ahead of ball
- Estimate time to recover for defending team
- If 3+ attackers and >2 seconds recovery = FAST_BREAK
- Set transitionMode = 'FAST_BREAK' for 5 seconds
- Affects movement intensity (+50%)

**Code Location**: `src/lib/engine/v2/match2d.ts` (buildTeamContext)  
**Function**: `buildTeamContext() → { transitionMode }`

### 3.5 Ball Transition Integration

**When**: Action selection (every ~5 ticks during possession)  
**What**: Execute pass, shot, or dribble  
**How**:
- Use RoleIntent.job to bias action selection
- ATTACK job: +shooting weight, +dribble weight
- SUPPORT job: +passing weight
- DEFEND/PRESS job: no action (ball not with defender)
- Execute via existing action selection logic

**Code Location**: `src/lib/engine/v2/match2d.ts`  
**Update**: selectActionWithIntents(carrier, intent, ...) → action

---

## Phase 3 Dependencies

### Must Exist (Phase 1 + 2)
- ✅ TeamContext built per tick
- ✅ RoleIntent generated per player
- ✅ homeIntents / awayIntents stored
- ✅ Player positions updated
- ✅ Ball state maintained

### Phase 3 Inputs
- ✅ Player positions (from Phase 2 movement)
- ✅ Ball position (from current possession)
- ✅ Player attributes (existing in PlayerState)
- ✅ RoleIntent for action selection (from Phase 2)
- ✅ TeamContext for transition detection (from Phase 1)

### Phase 3 Outputs
- New BallTransition for pass/shot/dribble
- Updated possession state
- Updated carrier (if loose-ball won)
- Tackle/interception events

---

## Phase 3 Implementation Plan

### Step 1: Add Helper Functions (1-2 hours)
```typescript
// spatialEngine.ts additions:
export function resolveLoseBallDuel(...): V2PlayerState
export function calculateTackleSuccess(...): number
export function calculatePassLaneRisk(...): number
```

### Step 2: Integrate into Main Loop (1 hour)
```typescript
// match2d.ts updates:
// In action selection phase:
if (Math.random() < actionChance) {
    const action = selectActionWithIntents(carrier, homeIntents[carrier.id], ...);
    // ... execute action ...
}
```

### Step 3: Add Telemetry (30 min)
```typescript
// match2d.ts updates:
// Log every 60 ticks:
console.log(`[V2-Phase3] Minute ${minute}: ${team} ${action.type} from ${from.position} to ${to.position} risk=${risk.toFixed(0)}%`);
```

### Step 4: Validate (1 hour)
```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/lib/engine/v2/*.ts --max-warnings 0
npm run dev  # Test replay generation
```

---

## Phase 3 Estimated Timeline

| Task | Duration | Status |
|------|----------|--------|
| Step 1: Helper functions | 1-2h | ⏳ TODO |
| Step 2: Main loop integration | 1h | ⏳ TODO |
| Step 3: Telemetry | 30min | ⏳ TODO |
| Step 4: Validation | 1h | ⏳ TODO |
| **TOTAL** | **3.5-4.5h** | ⏳ TODO |

---

## Quick Start: Phase 3

When ready to start Phase 3, execute these steps:

### 1. Create Phase 3 branch (optional)
```bash
git checkout -b phase-3-possession-recovery
```

### 2. Add to spatialEngine.ts
- [ ] Import player attribute types
- [ ] Implement resolveLoseBallDuel()
- [ ] Implement calculateTackleSuccess()
- [ ] Implement calculatePassLaneRisk()

### 3. Update match2d.ts
- [ ] Import new Phase 3 functions
- [ ] Find action selection phase (existing code)
- [ ] Apply selectActionWithIntents() instead of selectAction()
- [ ] Update ball transition logic
- [ ] Add Phase 3 telemetry logging

### 4. Validate
```bash
cd /Users/auii/Project/game
npx tsc --noEmit --skipLibCheck
npx eslint src/lib/engine/v2/match2d.ts src/lib/engine/v2/spatialEngine.ts --max-warnings 0
npm run build
```

### 5. Test
```bash
npm run dev
# Navigate to /match page with V2 replay
# Observe ball transitions and action selection
```

---

## Phase 2 → Phase 3 Transition

```
Current State (Phase 2 END):
├─ Team Context: Built per tick ✅
├─ Movement Intents: Generated per player ✅
├─ Player Positions: Updated per tick ✅
├─ Telemetry: Logs carrier intents every 5 min ✅
└─ Ready: For action selection and ball transitions

Phase 3 Adds:
├─ Loose-ball duel logic
├─ Tackle success modifier
├─ Interception zone calculation
├─ Fast-break detection
└─ Ball transition execution with intent awareness
```

---

## Documentation Updates

After Phase 3 is complete, update:

1. **PHASE_2_ROADMAP_STATUS.md**
   - Mark Phase 3 as COMPLETE
   - Add Phase 3 details

2. **.github/copilot-instructions.md**
   - Add Phase 3 to architecture section
   - Document loose-ball duel logic
   - Document tackle success formula

3. **API_REFERENCE.md**
   - Add any new APIs if created

4. **DOCUMENTATION_GUIDE.md**
   - Link to Phase 3 guide

---

## Success Criteria for Phase 3

✅ All loose-ball scenarios resolved correctly  
✅ Tackle success probability reasonable (15-65%)  
✅ Interception zones calculated per pass  
✅ Fast-break transitions smooth  
✅ Ball transitions smooth and realistic  
✅ TypeScript: 0 errors  
✅ ESLint: 0 warnings  
✅ Replay generation: <1 second  
✅ Canvas visual: Smooth possession transitions  
✅ Telemetry: Clear action logs every 5 minutes  

---

## Summary

✅ **Phase 2 COMPLETE**: Per-player movement with role awareness  
🔄 **Phase 3 READY**: Waiting for start signal  
📋 **Estimated Phase 3**: 3.5-4.5 hours  
🎯 **Next**: Start Phase 3 when ready (Possession Recovery & Ball Transitions)

**Command to start Phase 3**:
```bash
echo "Ready to start Phase 3? (yes/no)"
# When ready, begin Phase 3 implementation
```

---

## Appendix: Phase 2 Artifacts

- ✅ `PHASE_2_MOVEMENT_EXECUTOR_COMPLETE.md` - Full Phase 2 documentation
- ✅ `PHASE_2_ROADMAP_STATUS.md` - Roadmap progress
- ✅ `PHASE_2_COMPLETE_SUMMARY.md` - Quick summary
- ✅ `PHASE_2_CODE_CHANGES_REFERENCE.md` - Exact code changes
- ✅ `PHASE_2_COMPLETE_READY.md` - This document

All Phase 2 code is production-ready and fully validated.

