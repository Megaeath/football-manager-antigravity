# Match Engine V2 - Implementation Progress

> **Project**: 2D Match Engine with Real-Time Player Positioning & Konva Visualization  
> **Status**: Phase 1 - Backend (In Progress)  
> **Last Updated**: April 13, 2026

---

## ✅ Completed Components

### 1. Type System Foundation (✅ Complete)
**File**: `src/lib/engine/v2/types2d.ts`

- ✅ `SpatialPosition` - 2D coordinates (x, y) on 100×100 field
- ✅ `Velocity` - Movement vectors for physics
- ✅ `V2PlayerState` - Extends base PlayerState with spatial positioning
- ✅ `V2BallState` - Ball with 2D physics and trajectory prediction
- ✅ `VisualEvent` - Canvas-renderable events (goals, passes, tackles, cards)
- ✅ `MatchFrame` - Snapshot of single game tick
- ✅ `V2MatchState` - Complete match data with spatial replay
- ✅ `MovementWeights`, `RoleMovementConfig` - AI configuration types
- ✅ `SetPieceSetup` - Corner/free-kick positioning templates
- ✅ `PlayerCollision` - Collision detection results
- ✅ `RenderingHints` - Canvas optimization metadata

**Lines**: 295 lines of comprehensive type definitions

---

### 2. Configuration Constants (✅ Complete)
**File**: `src/lib/engine/v2/config.ts`

**Field Dimensions**:
- ✅ 100×100 normalized coordinate system
- ✅ 3:2 aspect ratio for realistic pitch display
- ✅ Zone definitions (defensive/middle/attacking thirds)
- ✅ Penalty area & goal dimensions

**Formation Coordinate Maps**:
- ✅ 4-4-2 Formation (11 positions mapped)
- ✅ 4-3-3 Formation (11 positions mapped)
- ✅ 5-3-2 Formation (11 positions mapped)
- ✅ 4-5-1 Formation (11 positions mapped)

**Movement AI Weights**:
- ✅ Base weights: ball attraction (0.4), role position (0.3), spacing (0.2), marking (0.1)
- ✅ Role-specific configs: Goalkeeper, Defender, Midfielder, Forward, Winger
- ✅ Movement speeds: Walking (1), Jogging (3), Running (5), Sprinting (8)
- ✅ Collision constants: Min distance (2), tackle range (3), push force (1.5)

**Set Piece Templates**:
- ✅ Corner kick positions (near post, far post, zonal defending)
- ✅ Free kick wall setup (player count by distance)
- ✅ Throw-in receiver spacing

**Tactical Modifiers**:
- ✅ Mentality position adjustments (ALL_OUT_ATTACK to ULTRA_DEFENSIVE)
- ✅ Pressing intensity configurations

**Animation & Optimization**:
- ✅ Transition timings (500ms position, 300ms ball)
- ✅ Playback speed multipliers [0.5×, 1×, 2×, 5×, 10×]
- ✅ Spatial grid cell size (10×10 yards)
- ✅ Lazy update thresholds (30 yard ball distance)

**Lines**: 320 lines of configuration constants

---

### 3. Formation Position Mapper (✅ Complete)
**File**: `src/lib/engine/v2/formation.ts`

**Core Functions**:
- ✅ `mapTacticalPositionTo2D()` - Converts tactical slot → (x,y) coordinates
  - Handles formation variations (4-4-2, 4-3-3, 5-3-2, 4-5-1)
  - Auto-mirrors for away team
  - Fallback for unknown positions
  
- ✅ `assignFormationPositions()` - Batch position assignment for whole team
- ✅ `applyMentalityAdjustment()` - Shifts formation based on tactics
  - X-axis shift (attacking/defensive)
  - Y-axis compactness (narrow/wide)

**Utility Functions**:
- ✅ `getFormationRole()` - Returns GOALKEEPER/DEFENDER/MIDFIELDER/FORWARD
- ✅ `isWingPosition()` - Detects wide players
- ✅ `isCentralPosition()` - Detects central players
- ✅ `getPreferredYPosition()` - Returns 25/50/75 for left/center/right
- ✅ `getDistance()` - Euclidean distance calculation
- ✅ `findNearestPosition()` - Proximity search
- ✅ `clampToField()` - Bounds checking
- ✅ `interpolatePosition()` - Smooth transitions

**Lines**: 240 lines with comprehensive position mapping

---

### 4. Spatial Movement Engine (✅ Complete)
**File**: `src/lib/engine/v2/spatialEngine.ts`

**Player Movement AI**:
- ✅ `calculateTargetPosition()` - Multi-factor AI decision making
  - Ball attraction (weighted by distance & role)
  - Role positioning (tactical discipline)
  - Teammate spacing (anti-crowding)
  - Man-marking (opponent tracking)
  
- ✅ `updatePlayerPosition()` - Physics-based movement execution
  - Pace-based speed calculation
  - Ball carrier speed reduction (70%)
  - Condition/fatigue modifiers
  - Velocity & facing direction updates
  - Sprint detection

**Ball Physics**:
- ✅ `simulatePassTrajectory()` - Linear interpolation for passes
  - 10-point trajectory
  - Distance & strength-based timing
  
- ✅ `simulateShotTrajectory()` - Parabolic arc for shots
  - 15-point trajectory with height array
  - Power-based arc calculation
  
- ✅ `simulateDribbleMovement()` - Directional dribble vectors

**Collision Detection**:
- ✅ `checkPlayerCollision()` - Proximity detection (< 2 yards)
  - Returns collision data with separation vector
  - Detects tackle attempts (< 3 yards)
  
- ✅ `resolveCollision()` - Push players apart
- ✅ `findNearbyPlayers()` - Radius search

**Spatial Optimization**:
- ✅ `SpatialGrid` class - O(1) nearest-neighbor lookups
  - Grid-based hashing (10×10 cells)
  - Efficient range queries

**Out of Bounds**:
- ✅ `checkBallOutOfBounds()` - Sideline & goal line detection
  - Returns CORNER / GOAL_KICK / THROW_IN with position

**Lines**: 410 lines of movement AI and physics

---

## 🚧 In Progress

### 5. Main V2 Simulation Loop
**File**: `src/lib/engine/v2/match2d.ts` (To be created)

**Required Implementation**:
- [ ] `simulateMatch2D()` main entry point
- [ ] Match initialization with formation positioning
- [ ] 90-minute × 12 ticks/minute loop (1,080 ticks)
- [ ] Player position updates every tick
- [ ] Ball physics integration
- [ ] Action execution (pass/shoot/dribble) with 2D distances
- [ ] Collision detection & resolution
- [ ] Out-of-bounds handling (throw-ins, corners, goal kicks)
- [ ] Visual event generation
- [ ] Frame recording (all 1,080 frames or key frames only)
- [ ] Compatibility with V1 statistics output

**Estimated Lines**: 800-1000 lines

**Key Challenges**:
- Maintaining V1 stat compatibility (goals, assists, passes, etc.)
- Performance optimization (22 players × 1,080 ticks = 23,760 position updates)
- Spatial-aware action selection (replace zone-based with proximity-based)

---

## 📋 Remaining Phase 1 Tasks (Backend)

### 6. Service Layer Integration
**File**: `src/lib/services/matchSimulator.ts`

- [ ] Add feature flag check `settings.enableMatch2D`
- [ ] Route to `simulateMatch2D()` or `simulateMatch()` based on flag
- [ ] Save V2 spatial data (if enabled)
- [ ] Maintain backward compatibility

**Estimated Changes**: 20-30 lines in `processMatch()` function

---

### 7. Database Schema Extension
**File**: `prisma/schema.prisma`

**New Tables**:
```prisma
model PlayerPositionLog {
  id         String   @id @default(cuid())
  matchId    String
  playerId   String
  minute     Int
  tick       Int
  x          Float    // 0-100
  y          Float    // 0-100
  
  @@index([matchId, playerId])
  @@index([matchId, minute])
}

model BallTrajectoryLog {
  id         String   @id @default(cuid())
  matchId    String
  minute     Int
  tick       Int
  x          Float
  y          Float
  z          Float?   // Height
  eventType  String?  // PASS, SHOOT, DRIBBLE
  
  @@index([matchId, minute])
}

model VisualEventLog {
  id              String   @id @default(cuid())
  matchId         String
  type            String   // GOAL, SHOT, PASS, TACKLE, etc.
  minute          Int
  tick            Int
  positionX       Float
  positionY       Float
  playerId        String?
  teamId          String
  metadata        String?  // JSON
  
  @@index([matchId, minute])
}
```

**Storage Considerations**:
- Full replay: ~23,760 position logs per match (huge!)
- Key frames only: ~50-100 events per match (manageable)
- **Recommendation**: Store key frames + ability to re-simulate on demand

---

### 8. Feature Flag Addition
**File**: `prisma/schema.prisma`

```prisma
model GlobalGameSettings {
  // ... existing fields ...
  enableMatch2D  Boolean @default(false)  // NEW
}
```

**Migration**: `npx prisma migrate dev --name add_match_2d_flag`

---

## 📋 Phase 2 Tasks (Frontend)

### 9. React-Konva Installation
```bash
npm install konva react-konva
npm install --save-dev @types/react-konva
```

---

### 10. MatchCanvas Component Foundation
**File**: `src/app/match/components/MatchCanvas.tsx`

**Structure**:
```tsx
import { Stage, Layer } from 'react-konva';

export function MatchCanvas({ matchData, currentMinute }) {
  // Responsive sizing (3:2 aspect ratio)
  // Coordinate scaling (100×100 → pixel canvas)
  // Layer architecture:
  //   1. Field layer (static)
  //   2. Players layer (animated)
  //   3. Ball layer (animated)
  //   4. Events layer (overlays)
  
  return (
    <Stage width={canvasWidth} height={canvasHeight}>
      <FieldLayer />
      <PlayersLayer players={...} />
      <BallLayer ball={...} />
      <EventsLayer events={...} />
    </Stage>
  );
}
```

---

### 11. Field Rendering Layer
**Component**: `<FieldLayer>`

- [ ] Green grass background (#2d8a3e)
- [ ] White field markings:
  - Touchlines (border)
  - Goal lines
  - Halfway line
  - Center circle
  - Penalty areas (both ends)
  - Goal boxes
  - Corner arcs
  - Penalty spots

**Reference**: Standard football pitch markings

---

### 12. Players Visualization Layer
**Component**: `<PlayersLayer>`

- [ ] 22 circles (11 home blue, 11 away red)
- [ ] Jersey numbers/names as text
- [ ] Position sync with frame data
- [ ] Konva `.to()` tween for smooth movement (500ms)
- [ ] Hover tooltips (player name, stats)
- [ ] Highlight ball carrier (glow effect)

---

### 13. Ball Visualization Layer
**Component**: `<BallLayer>`

- [ ] White circle (smaller than players)
- [ ] Shadow effect (`shadowBlur`, `shadowOffset`)
- [ ] Trajectory line preview (dashed for passes/shots)
- [ ] Smooth position transitions (300ms)

---

### 14. Playback Controls
**Component**: `<PlaybackControls>`

- [ ] Play/Pause button
- [ ] Minute slider (0-90)
- [ ] Speed selector (1×, 2×, 5×, 10×)
- [ ] Current score display
- [ ] Match clock
- [ ] Auto-play loop

**State Management**:
```tsx
const [currentMinute, setCurrentMinute] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [playbackSpeed, setPlaybackSpeed] = useState(1);
```

---

### 15. Visual Events Overlay
**Component**: `<EventsLayer>`

**Event Types**:
- [ ] Goal celebration (icon + animation)
- [ ] Yellow/Red cards (popup card image)
- [ ] Substitution arrow
- [ ] Injury notification
- [ ] Shot marker (dotted line to goal)
- [ ] Tackle impact effect

**Animation**: Fade-in → stay 2s → fade-out

---

### 16. Match Page Integration
**File**: `src/app/match/page.tsx`

**Changes**:
```tsx
// Auto-detect V2 data
const isV2Match = matchData?.frames?.length > 0;

return (
  <div>
    {isV2Match ? (
      <>
        <MatchCanvas matchData={matchData} />
        <button onClick={() => setShowCanvas(!showCanvas)}>
          {showCanvas ? 'Show Stats' : 'Show Canvas'}
        </button>
      </>
    ) : (
      <StaticMatchResults data={matchData} />
    )}
  </div>
);
```

---

## 📊 Overall Progress

**Phase 1 (Backend)**: 50% Complete
- ✅ Types (100%)
- ✅ Config (100%)
- ✅ Formation (100%)
- ✅ Spatial Engine (100%)
- 🚧 Main Loop (0%)
- ⏳ Service Integration (0%)
- ⏳ Database Schema (0%)
- ⏳ Feature Flag (0%)

**Phase 2 (Frontend)**: 0% Complete
- ⏳ All canvas components pending

**Total Implementation**: 25% Complete

---

## 🎯 Next Steps

### Immediate (Continue Phase 1):
1. ✅ Complete `src/lib/engine/v2/match2d.ts` (main simulation loop)
2. Add feature flag to schema.prisma
3. Update matchSimulator.ts with V2 routing
4. Add spatial data tables (optional - can use re-simulation approach)
5. Write unit tests for V2 engine

### Then (Start Phase 2):
6. Install Konva dependencies
7. Create MatchCanvas component
8. Build field/players/ball layers
9. Implement playback controls
10. Integrate into match page

---

## 📝 Key Design Decisions

1. **V1 Preservation**: Zero changes to existing match.ts - V2 is completely separate
2. **Type Extension**: V2 types extend base types for compatibility
3. **Feature Flag**: enableMatch2D allows gradual rollout
4. **Storage Strategy**: Store key frames only, re-simulate on demand for full replay
5. **Backward Compatibility**: V2 returns all V1 stats (goals, assists, etc.)
6. **Formation First**: All positions mapped before simulation starts
7. **Movement AI**: Multi-factor weighted decision making (ball/role/spacing/marking)
8. **Performance**: Spatial grid hashing for O(1) collision checks
9. **Canvas Architecture**: Layered rendering (field → players → ball → events)
10. **Animation**: Konva tweens for smooth 60fps movement

---

## 🔧 Development Commands

```bash
# Type checking
npm run build

# Lint
npm run lint

# Database migration (when ready)
npx prisma migrate dev --name add_match_2d_system

# Run development server
npm run dev

# Test V2 engine (when complete)
node scripts/test-match-2d.js
```

---

## 📚 Documentation Updates Needed

Once complete, update:
- `.github/copilot-instructions.md` - Add V2 engine section
- `API_REFERENCE.md` - Document V2 endpoints
- `DOCUMENTATION_GUIDE.md` - Add V2 navigation
- `TACTICAL_GUIDE.md` - Update with spatial tactics

---

**Implementation Started**: April 13, 2026  
**Target Completion**: Phase 1 - April 20, 2026 | Phase 2 - April 27, 2026
