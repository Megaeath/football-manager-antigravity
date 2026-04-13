# 🗺️ Match Engine 2D Migration Plan

## 📋 Executive Summary

แผนการย้ายระบบ Match Engine จาก **1D (X-axis only)** เป็น **2D Coordinate System (X, Y)** บนพื้นที่สนาม **100×100** เพื่อให้การจำลองตำแหน่งนักเตะสมจริงขึ้น สามารถแสดงแผนผังการเล่น และวิเคราะห์ zone usage ได้ละเอียดขึ้น

---

## 🎯 วัตถุประสงค์

1. **เพิ่มมิติ Y** - ให้บอลและนักเตะมีตำแหน่ง 2D แทนที่จะเป็นแค่ X (0-100)
2. **Euclidean Distance** - ใช้สูตรระยะทาง 2D แทนการคำนวณ 1D
3. **Boundary Checking** - ตรวจสอบการออกนอกสนามทั้ง 4 ด้าน (left, right, top, bottom)
4. **Backward Compatibility** - รองรับข้อมูลเก่า (migration อัตโนมัติ)
5. **Zone Analysis** - แสดง heatmap และ zone distribution แบบละเอียด

---

## 📊 สถานะปัจจุบัน (1D System)

### ️ Database Schema
```prisma
model PlayerActionLog {
  ballPosition        Int // 0-100 field position (X-axis only)
  zone                String // DEFENSIVE | MIDDLE | ATTACKING
}
```

### ⚙️ Engine Code
```typescript
interface BallState {
    position: number; // 0-100 (0=home goal, 100=away goal)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
}

// Distance calculation (1D)
const distance = isAttacking ? 100 - ball.position : ball.position;
```

###  ปัญหาปัจจุบัน
- ❌ ไม่สามารถแสดงตำแหน่งแนวกว้าง (width) ของสนาม
- ❌ การจ่ายบอลสั้น/ยาว คำนวณแค่แนวตั้ง (X)
- ❌ ไม่สามารถจำลองการตัดบอลด้านข้างได้
- ❌ Zone แบ่งแค่ 3 เขต (DEF/MID/ATT) ไม่ละเอียดพอ

---

## 🏗️ แผนการเปลี่ยนแปลง

### Phase 1: Database Schema Changes

#### 1.1 แก้ไข `PlayerActionLog` Model

**Before:**
```prisma
model PlayerActionLog {
  ballPosition        Int // 0-100 field position
  zone                String // DEFENSIVE | MIDDLE | ATTACKING
}
```

**After:**
```prisma
model PlayerActionLog {
  // NEW: 2D coordinates
  ballX               Int // 0-100 (X-axis: 0=home goal, 100=away goal)
  ballY               Int // 0-100 (Y-axis: 0=left touchline, 100=right touchline)
  
  // DEPRECATED: kept for backward compatibility
  ballPosition        Int? // 0-100 (legacy, auto-calculated from ballX)
  zone                String? // DEFENSIVE | MIDDLE | ATTACKING (legacy, auto-calculated)
  
  // NEW: 2D zone system
  zoneX               String? // DEFENSIVE | MIDDLE | ATTACKING (from ballX)
  zoneY               String? // LEFT | CENTER | RIGHT (from ballY)
  zone2D              String? // Combined zone (e.g. "ATTACKING_RIGHT")
}
```

#### 1.2 Migration Strategy

```sql
-- Step 1: Add new columns (nullable)
ALTER TABLE PlayerActionLog 
  ADD COLUMN ballX INTEGER,
  ADD COLUMN ballY INTEGER,
  ADD COLUMN zoneX TEXT,
  ADD COLUMN zoneY TEXT,
  ADD COLUMN zone2D TEXT;

-- Step 2: Migrate existing data
UPDATE PlayerActionLog 
SET 
  ballX = ballPosition,
  ballY = 50, -- Default to center
  zoneX = zone,
  zoneY = 'CENTER',
  zone2D = zone || '_CENTER';

-- Step 3: Make old columns nullable (if not already)
-- (Prisma handles this)

-- Step 4: After verification, consider removing old columns in future
```

#### 1.3 Prisma Migration

```bash
# Generate migration
npx prisma migrate dev --name add_2d_coordinate_system

# Migration file will include:
# 1. Add new columns with defaults
# 2. Backfill existing data
# 3. Update indexes
```

---

### Phase 2: Engine Type System Updates

#### 2.1 Update `BallState` Interface

**Before:**
```typescript
interface BallState {
    position: number; // 0-100 (0=home goal, 100=away goal)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
}
```

**After:**
```typescript
interface BallState {
    x: number; // 0-100 (X-axis: 0=home goal, 100=away goal)
    y: number; // 0-100 (Y-axis: 0=left touchline, 100=right touchline)
    possession: 'home' | 'away';
    carrier: PlayerState | null;
    
    // Computed properties (getters)
    get position(): number { return this.x; } // Backward compatibility
    get zone(): 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING' {
        return getZoneFromPosition(this.x, this.possession === 'home');
    }
}
```

#### 2.2 Update `PlayerActionLog` Interface

```typescript
interface PlayerActionLog {
    playerId: string;
    teamId: string;
    minute: number;
    
    // NEW: 2D coordinates
    ballX: number;
    ballY: number;
    
    // DEPRECATED: kept for backward compatibility
    ballPosition?: number; // Legacy
    zone?: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING'; // Legacy
    
    // NEW: 2D zones
    zoneX: 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING';
    zoneY: 'LEFT' | 'CENTER' | 'RIGHT';
    zone2D: string; // e.g. "ATTACKING_RIGHT"
    
    actionType: 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT' | 'TACKLE' | 'SAVE' | 'INTERCEPTION' | 'FOUL';
    result: 'SUCCESS' | 'FAIL' | 'GOAL' | 'SAVED' | 'BLOCKED' | 'OFF_TARGET';
    isSuccessful: boolean;
    expectedSuccessRate?: number;
    targetPlayerId?: string;
    metadata?: string;
}
```

---

### Phase 3: Core Engine Logic Changes

#### 3.1 Euclidean Distance Calculation

**Before (1D):**
```typescript
// Distance to goal (1D)
const distanceToGoal = isAttacking ? 100 - ball.position : ball.position;
```

**After (2D):**
```typescript
// Goal positions in 2D
const HOME_GOAL = { x: 0, y: 50 };   // Center of left goal
const AWAY_GOAL = { x: 100, y: 50 };  // Center of right goal

// Euclidean distance formula
function calculateDistance2D(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Distance to goal (2D)
function getDistanceToGoal(
    ball: BallState,
    isHomeAttacking: boolean
): number {
    const goal = isHomeAttacking ? AWAY_GOAL : HOME_GOAL;
    return calculateDistance2D(
        { x: ball.x, y: ball.y },
        goal
    );
}

// Usage in shooting
const distanceToGoal = getDistanceToGoal(ball, isHomeAttacking);
```

#### 3.2 Ball Movement Updates

**Before (1D):**
```typescript
// Pass short moves ball forward/backward
const movement = 2 + Math.random() * 3;
ball.position = isHomeAttacking
    ? Math.max(0, Math.min(100, ball.position + movement))
    : Math.max(0, Math.min(100, ball.position - movement));
```

**After (2D):**
```typescript
// Pass short moves ball in 2D
function moveBall2D(
    ball: BallState,
    deltaX: number,
    deltaY: number,
    isHomeAttacking: boolean
): void {
    // Calculate new position
    let newX = isHomeAttacking ? ball.x + deltaX : ball.x - deltaX;
    let newY = ball.y + deltaY;
    
    // Boundary checking (Phase 5)
    const clamped = clampToField(newX, newY);
    ball.x = clamped.x;
    ball.y = clamped.y;
}

// Pass short implementation
const deltaX = 2 + Math.random() * 3;
const deltaY = (Math.random() - 0.5) * 4; // Random lateral movement ±2
moveBall2D(ball, deltaX, deltaY, isHomeAttacking);
```

#### 3.3 Player Positioning in 2D

**New: Player Distribution Across Field Width**

```typescript
// Formation defines X positions, but Y positions vary by role
function getPlayerStartPosition(
    tacticalPosition: string,
    isHomeTeam: boolean
): { x: number; y: number } {
    const formation = parseFormation(tacticalPosition);
    
    // X position based on formation
    const x = isHomeTeam ? formation.x : 100 - formation.x;
    
    // Y position based on lateral position
    const y = formation.y; // e.g., left=20, center=50, right=80
    
    return { x, y };
}

// Example positions:
// GK:       { x: 5, y: 50 }
// DC_L:     { x: 20, y: 30 }
// DC_R:     { x: 20, y: 70 }
// MC:       { x: 50, y: 50 }
// MR:       { x: 50, y: 80 }
// ML:       { x: 50, y: 20 }
// FWC:      { x: 80, y: 50 }
```

---

### Phase 4: Action Calculations with 2D

#### 4.1 Pass Calculations

```typescript
function calculatePassSuccess(
    passer: PlayerState,
    ball: BallState,
    targetX: number,
    targetY: number,
    defendingTeam: TeamState
): number {
    // Calculate pass distance (Euclidean)
    const passDistance = calculateDistance2D(
        { x: ball.x, y: ball.y },
        { x: targetX, y: targetY }
    );
    
    // Distance penalty (exponential for 2D)
    const distancePenalty = Math.exp(-passDistance / 30); // Decay factor
    
    // Angle factor (passes across field harder than forward)
    const angleToGoal = Math.atan2(
        targetY - 50, // Center Y
        isHomeAttacking ? targetX - ball.x : ball.x - targetX
    );
    const anglePenalty = Math.cos(angleToGoal); // Forward passes easier
    
    // Base pass score
    const baseScore = calculateActionScore('pass', passer.attributes, 'attacker', passer.condition);
    
    // Apply modifiers
    const successRate = baseScore * distancePenalty * anglePenalty;
    
    return clampRate(successRate);
}
```

#### 4.2 Shooting Calculations

```typescript
function calculateShotSuccess(
    shooter: PlayerState,
    ball: BallState,
    gk: PlayerState,
    defendingTeam: TeamState
): { shootScore: number; saveScore: number } {
    // Distance to goal (2D Euclidean)
    const goalPos = isHomeAttacking ? AWAY_GOAL : HOME_GOAL;
    const distanceToGoal = calculateDistance2D(
        { x: ball.x, y: ball.y },
        goalPos
    );
    
    // Angle to goal (how open is the shot?)
    const angleToGoal = calculateAngleToGoal(ball, isHomeAttacking);
    const angleFactor = Math.max(0.3, angleToGoal); // Wider angle = better
    
    // Position factor (combine distance and angle)
    const positionFactor = angleFactor * Math.exp(-distanceToGoal / 40);
    
    // Shoot score
    const shootScore = calculateActionScore('shoot', shooter.attributes, 'attacker', shooter.condition)
        * positionFactor
        * getMentalityBuff(defendingTeam.tactics.mentality).shooting;
    
    // GK save score (positioning matters more in 2D)
    const gkDistanceToBall = calculateDistance2D(
        { x: gkX, y: gkY }, // GK's current position
        { x: ball.x, y: ball.y }
    );
    const gkPositionFactor = Math.exp(-gkDistanceToBall / 15);
    
    const saveScore = calculateActionScore('save', gk.attributes, 'defender', gk.condition)
        * gkPositionFactor
        * getMentalityBuff(defendingTeam.tactics.mentality).save;
    
    return { shootScore, saveScore };
}

function calculateAngleToGoal(
    ball: BallState,
    isHomeAttacking: boolean
): number {
    const goalCenter = { x: isHomeAttacking ? 100 : 0, y: 50 };
    const goalWidth = 14; // Goal is ~14 units wide (7 units each side)
    
    // Calculate angle from ball to goal edges
    const dx = goalCenter.x - ball.x;
    const dy1 = (goalCenter.y + goalWidth/2) - ball.y;
    const dy2 = (goalCenter.y - goalWidth/2) - ball.y;
    
    const angle1 = Math.atan2(dy1, dx);
    const angle2 = Math.atan2(dy2, dx);
    
    // Angle width (wider = better chance)
    const angleWidth = Math.abs(angle1 - angle2);
    
    // Normalize to 0-1 (max angle ~0.5 radians from center)
    return Math.min(1, angleWidth / 0.5);
}
```

#### 4.3 Dribbling Calculations

```typescript
function executeDribble2D(
    ball: BallState,
    dribbler: PlayerState,
    defendingTeam: TeamState
): { newX: number; newY: number; success: boolean } {
    // Dribble direction (toward goal + random lateral)
    const isHomeAttacking = ball.possession === 'home';
    const towardGoalX = isHomeAttacking ? 3 + Math.random() * 4 : -(3 + Math.random() * 4);
    const lateralY = (Math.random() - 0.5) * 6; // ±3 units lateral
    
    // Calculate target position
    const targetX = ball.x + towardGoalX;
    const targetY = ball.y + lateralY;
    
    // Check for defender interception
    const nearestDefender = findNearestDefender(defendingTeam, ball, isHomeAttacking);
    const defenderDistance = nearestDefender 
        ? calculateDistance2D(
            { x: nearestDefender.x, y: nearestDefender.y },
            { x: targetX, y: targetY }
          )
        : 100;
    
    // Success depends on dribbling vs defender positioning
    const dribbleScore = calculateActionScore('dribble', dribbler.attributes, 'attacker', dribbler.condition);
    const defenseScore = defenderDistance < 5 
        ? calculateActionScore('tackle', nearestDefender.attributes, 'defender', nearestDefender.condition)
        : 0.3;
    
    const success = dribbleScore > defenseScore;
    
    // If success, move ball; else, defender intercepts
    if (success) {
        const clamped = clampToField(targetX, targetY);
        return { newX: clamped.x, newY: clamped.y, success: true };
    } else {
        // Ball lost, defender gains possession
        return { 
            newX: nearestDefender.x, 
            newY: nearestDefender.y, 
            success: false 
        };
    }
}
```

---

### Phase 5: Boundary Checking System

#### 5.1 Field Boundaries

```typescript
const FIELD_BOUNDARIES = {
    minX: 0,    // Home goal line
    maxX: 100,  // Away goal line
    minY: 0,    // Left touchline
    maxY: 100,  // Right touchline
};

// Special zones
const GOAL_AREA = {
    minX: 0,
    maxX: 18,
    minY: 30,
    maxY: 70,
};

const PENALTY_AREA = {
    minX: 0,
    maxX: 40,
    minY: 16,
    maxY: 84,
};
```

#### 5.2 Clamp Function

```typescript
interface ClampedPosition {
    x: number;
    y: number;
    wentOutOfBounds: boolean;
    outOfBoundsSide: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | 'GOAL_LEFT' | 'GOAL_RIGHT' | null;
}

function clampToField(x: number, y: number): ClampedPosition {
    let wentOutOfBounds = false;
    let outOfBoundsSide: ClampedPosition['outOfBoundsSide'] = null;
    
    // Check X boundaries
    if (x < FIELD_BOUNDARIES.minX) {
        x = FIELD_BOUNDARIES.minX;
        wentOutOfBounds = true;
        outOfBoundsSide = 'GOAL_LEFT'; // Home goal
    } else if (x > FIELD_BOUNDARIES.maxX) {
        x = FIELD_BOUNDARIES.maxX;
        wentOutOfBounds = true;
        outOfBoundsSide = 'GOAL_RIGHT'; // Away goal
    }
    
    // Check Y boundaries
    if (y < FIELD_BOUNDARIES.minY) {
        y = FIELD_BOUNDARIES.minY;
        wentOutOfBounds = true;
        outOfBoundsSide = outOfBoundsSide || 'LEFT'; // Left touchline
    } else if (y > FIELD_BOUNDARIES.maxY) {
        y = FIELD_BOUNDARIES.maxY;
        wentOutOfBounds = true;
        outOfBoundsSide = outOfBoundsSide || 'RIGHT'; // Right touchline
    }
    
    return { x, y, wentOutOfBounds, outOfBoundsSide };
}
```

#### 5.3 Out of Bounds Handling

```typescript
function handleOutOfBounds(
    ball: BallState,
    clamped: ClampedPosition,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    if (!clamped.wentOutOfBounds) return;
    
    const { outOfBoundsSide } = clamped;
    
    // Case 1: Ball went out side touchline → Throw-in
    if (outOfBoundsSide === 'LEFT' || outOfBoundsSide === 'RIGHT') {
        executeThrowIn(ball, matchState, defendingTeam, attackingTeam, !isHomeAttacking);
        return;
    }
    
    // Case 2: Ball went out behind goal line
    if (outOfBoundsSide === 'GOAL_LEFT' || outOfBoundsSide === 'GOAL_RIGHT') {
        // Check if it was last touched by defender
        const lastTouchTeam = ball.possession;
        const isDefenderLastTouch = lastTouchTeam !== (isHomeAttacking ? 'home' : 'away');
        
        if (isDefenderLastTouch) {
            // Corner kick for attacking team
            executeCornerKick(ball, matchState, attackingTeam, defendingTeam, isHomeAttacking);
        } else {
            // Goal kick for defending team
            executeGoalKick(ball, matchState, defendingTeam, attackingTeam, !isHomeAttacking);
        }
        return;
    }
}

function executeThrowIn(
    ball: BallState,
    matchState: MatchState,
    throwingTeam: TeamState,
    opposingTeam: TeamState,
    isHomeThrowing: boolean
): void {
    // Reset ball to touchline
    const throwY = ball.y < 50 ? 5 : 95; // Left or right touchline
    ball.x = 50; // Midfield throw-in (simplified)
    ball.y = throwY;
    ball.possession = isHomeThrowing ? 'home' : 'away';
    ball.carrier = getNearestPlayer(throwingTeam, ball, isHomeThrowing);
    
    matchState.events.push({
        minute: matchState.minute,
        type: 'THROW_IN',
        text: `Throw-in for ${throwingTeam.name}`,
        teamId: throwingTeam.id,
    });
}

function executeCornerKick(
    ball: BallState,
    matchState: MatchState,
    attackingTeam: TeamState,
    defendingTeam: TeamState,
    isHomeAttacking: boolean
): void {
    // Corner position (near goal line, at edge)
    ball.x = isHomeAttacking ? 95 : 5;
    ball.y = ball.y < 50 ? 10 : 90;
    ball.possession = isHomeAttacking ? 'home' : 'away';
    
    matchState.events.push({
        minute: matchState.minute,
        type: 'CORNER',
        text: `Corner kick for ${attackingTeam.name}`,
        teamId: attackingTeam.id,
    });
    
    // Update stats
    const teamStats = isHomeAttacking ? matchState.teamStats.home : matchState.teamStats.away;
    teamStats.corners++;
}

function executeGoalKick(
    ball: BallState,
    matchState: MatchState,
    defendingTeam: TeamState,
    attackingTeam: TeamState,
    isHomeDefending: boolean
): void {
    // Goal kick position (inside goal area)
    ball.x = isHomeDefending ? 10 : 90;
    ball.y = 50; // Center
    ball.possession = isHomeDefending ? 'home' : 'away';
    
    matchState.events.push({
        minute: matchState.minute,
        type: 'GOAL_KICK',
        text: `Goal kick for ${defendingTeam.name}`,
        teamId: defendingTeam.id,
    });
}
```

---

### Phase 6: Zone System Enhancement

#### 6.1 2D Zone Calculation

```typescript
type ZoneX = 'DEFENSIVE' | 'MIDDLE' | 'ATTACKING';
type ZoneY = 'LEFT' | 'CENTER' | 'RIGHT';

function getZoneFrom2DPosition(
    x: number,
    y: number,
    isHomeAttacking: boolean
): { zoneX: ZoneX; zoneY: ZoneY; zone2D: string } {
    // X zone (same as before)
    let zoneX: ZoneX;
    if (isHomeAttacking) {
        if (x <= 30) zoneX = 'DEFENSIVE';
        else if (x <= 70) zoneX = 'MIDDLE';
        else zoneX = 'ATTACKING';
    } else {
        if (x >= 70) zoneX = 'DEFENSIVE';
        else if (x >= 30) zoneX = 'MIDDLE';
        else zoneX = 'ATTACKING';
    }
    
    // Y zone (new)
    let zoneY: ZoneY;
    if (y <= 33) zoneY = 'LEFT';
    else if (y <= 66) zoneY = 'CENTER';
    else zoneY = 'RIGHT';
    
    // Combined zone
    const zone2D = `${zoneX}_${zoneY}`; // e.g. "ATTACKING_RIGHT"
    
    return { zoneX, zoneY, zone2D };
}
```

#### 6.2 Zone-Based Actions

```typescript
// Actions behave differently based on 2D zone
function getZoneActionModifier(
    actionType: string,
    zoneX: ZoneX,
    zoneY: ZoneY
): number {
    // Example: Wingers more effective in wide areas
    if (actionType === 'CROSS' && (zoneY === 'LEFT' || zoneY === 'RIGHT')) {
        return 1.2; // +20% in wide areas
    }
    
    // Example: Shooting harder from wide angles
    if (actionType === 'SHOOT' && (zoneY === 'LEFT' || zoneY === 'RIGHT')) {
        return 0.8; // -20% from wide angles
    }
    
    // Example: Through balls better from center
    if (actionType === 'PASS_LONG' && zoneY === 'CENTER') {
        return 1.15; // +15% from center
    }
    
    return 1.0;
}
```

---

### Phase 7: UI Updates (Analytics)

#### 7.1 Heatmap Visualization

```typescript
// Frontend: Display 2D heatmap
interface HeatmapCell {
    x: number; // 0-9 (grid column)
    y: number; // 0-9 (grid row)
    touches: number;
    actions: {
        pass: number;
        shoot: number;
        dribble: number;
        tackle: number;
    };
}

function generateHeatmap(actionLogs: PlayerActionLog[]): HeatmapCell[][] {
    // Initialize 10x10 grid
    const grid: HeatmapCell[][] = Array(10).fill(null).map(() => 
        Array(10).fill(null).map(() => ({
            x: 0, y: 0, touches: 0,
            actions: { pass: 0, shoot: 0, dribble: 0, tackle: 0 }
        }))
    );
    
    // Populate grid
    actionLogs.forEach(log => {
        const gridX = Math.floor(log.ballX / 10);
        const gridY = Math.floor(log.ballY / 10);
        
        if (gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 10) {
            const cell = grid[gridX][gridY];
            cell.touches++;
            cell.actions[log.actionType.toLowerCase()]++;
        }
    });
    
    return grid;
}
```

#### 7.2 Zone Distribution Chart

```typescript
// Show 9-zone breakdown instead of 3-zone
type Zone2D = 'DEF_LEFT' | 'DEF_CENTER' | 'DEF_RIGHT' |
             'MID_LEFT' | 'MID_CENTER' | 'MID_RIGHT' |
             'ATT_LEFT' | 'ATT_CENTER' | 'ATT_RIGHT';

function getZoneDistribution(actionLogs: PlayerActionLog[]): Record<Zone2D, number> {
    const distribution: Record<Zone2D, number> = {
        DEF_LEFT: 0, DEF_CENTER: 0, DEF_RIGHT: 0,
        MID_LEFT: 0, MID_CENTER: 0, MID_RIGHT: 0,
        ATT_LEFT: 0, ATT_CENTER: 0, ATT_RIGHT: 0,
    };
    
    actionLogs.forEach(log => {
        const { zoneX, zoneY } = getZoneFrom2DPosition(log.ballX, log.ballY, true);
        const zone2D = `${zoneX}_${zoneY}` as Zone2D;
        distribution[zone2D]++;
    });
    
    return distribution;
}
```

---

### Phase 8: Testing Strategy

#### 8.1 Unit Tests

```typescript
describe('2D Coordinate System', () => {
    test('calculateDistance2D', () => {
        expect(calculateDistance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
    
    test('getZoneFrom2DPosition', () => {
        expect(getZoneFrom2DPosition(10, 20, true)).toEqual({
            zoneX: 'DEFENSIVE',
            zoneY: 'LEFT',
            zone2D: 'DEFENSIVE_LEFT'
        });
    });
    
    test('clampToField - left boundary', () => {
        expect(clampToField(-5, 50)).toEqual({
            x: 0, y: 50,
            wentOutOfBounds: true,
            outOfBoundsSide: 'GOAL_LEFT'
        });
    });
    
    test('clampToField - top boundary', () => {
        expect(clampToField(50, -10)).toEqual({
            x: 50, y: 0,
            wentOutOfBounds: true,
            outOfBoundsSide: 'LEFT'
        });
    });
});
```

#### 8.2 Integration Tests

```typescript
describe('Match Engine 2D', () => {
    test('pass short moves ball in 2D', () => {
        const ball: BallState = { x: 50, y: 50, possession: 'home', carrier: null };
        executePassShort(ball, player, matchState, homeTeam, awayTeam, true);
        
        expect(ball.x).toBeGreaterThan(50); // Moved forward
        expect(ball.y).toBeGreaterThanOrEqual(0); // Within bounds
        expect(ball.y).toBeLessThanOrEqual(100);
    });
    
    test('shot from wide angle has lower success', () => {
        const ball: BallState = { x: 80, y: 10, possession: 'home', carrier: null }; // Wide left
        const result = calculateShotSuccess(shooter, ball, gk, awayTeam);
        
        expect(result.shootScore).toBeLessThan(
            calculateShotSuccess(shooter, { ...ball, y: 50 }, gk, awayTeam).shootScore
        );
    });
    
    test('ball out of bounds triggers throw-in', () => {
        const ball: BallState = { x: 50, y: 105, possession: 'home', carrier: null };
        const clamped = clampToField(ball.x, ball.y);
        
        expect(clamped.wentOutOfBounds).toBe(true);
        expect(clamped.outOfBoundsSide).toBe('RIGHT');
    });
});
```

---

## 📅 Timeline & Milestones

### Week 1: Foundation
- [ ] Update Prisma schema (Phase 1)
- [ ] Create migration script
- [ ] Update TypeScript types (Phase 2)
- [ ] Write boundary checking system (Phase 5)

### Week 2: Engine Core
- [ ] Implement Euclidean distance (Phase 3.1)
- [ ] Update ball movement logic (Phase 3.2)
- [ ] Update player positioning (Phase 3.3)
- [ ] Test with existing match data

### Week 3: Action Logic
- [ ] Update pass calculations (Phase 4.1)
- [ ] Update shooting calculations (Phase 4.2)
- [ ] Update dribbling calculations (Phase 4.3)
- [ ] Implement out of bounds handling (Phase 5.3)

### Week 4: UI & Analytics
- [ ] Update zone system (Phase 6)
- [ ] Create heatmap visualization (Phase 7.1)
- [ ] Update zone distribution chart (Phase 7.2)
- [ ] Add 2D position to match events

### Week 5: Testing & Polish
- [ ] Write unit tests (Phase 8.1)
- [ ] Write integration tests (Phase 8.2)
- [ ] Performance testing
- [ ] Bug fixes and optimization

---

## ⚠️ Risks & Mitigation

### Risk 1: Backward Compatibility
**Risk**: Existing match data breaks
**Mitigation**: 
- Migration script auto-fills Y=50 for old data
- Keep old columns nullable for gradual transition
- Test with production data dump first

### Risk 2: Performance Impact
**Risk**: 2D calculations slower than 1D
**Mitigation**:
- Use efficient distance calculations
- Cache frequently computed values
- Profile with large datasets

### Risk 3: UI Complexity
**Risk**: 2D visualization confusing
**Mitigation**:
- Start with simple 2D grid
- Provide tooltips and legends
- A/B test with users

---

## 🎯 Success Criteria

- ✅ All existing matches can be viewed with 2D positions
- ✅ New matches simulate in 2D correctly
- ✅ Boundary checking works for all 4 sides
- ✅ Heatmap visualization displays correctly
- ✅ Zone distribution shows 9 zones
- ✅ No performance degradation
- ✅ All tests pass (unit + integration)

---

## 📝 Notes

### Key Design Decisions

1. **Keep X as 0-100, add Y as 0-100** - Maintains consistency, easy to understand
2. **Euclidean distance over Manhattan** - More realistic for football
3. **9-zone system** - Good balance between detail and complexity
4. **Boundary events logged** - Throw-ins, corners, goal kicks tracked
5. **Backward compatibility** - Old data auto-migrated, columns kept for transition

### Future Enhancements (Post-2D)

- [ ] Player movement paths (trajectories)
- [ ] Passing lanes visualization
- [ ] Defensive shape analysis
- [ ] Pressing triggers based on 2D position
- [ ] Set piece positioning (corners, free kicks)
- [ ] 3D visualization (height for crosses/long balls)

---

**Last Updated**: April 2026
**Status**: Planning Phase
**Next Step**: Review with team and approve before implementation
