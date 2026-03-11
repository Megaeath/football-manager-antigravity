# MODULE: PLAYER ROLES & TACTICAL LOGIC (IMPLEMENTATION REFERENCE - March 2026)

## 1. Role Filter & Logic

Uses `naturalPosition` from DB to filter eligible roles. In-match role effects are applied through:

- Action weight phase (`calculateActionWeights`)
- Action execution phase (`executePassShort`, `executePassLong`, `executeDribble`, `executeShoot`)
- Fitness drain phase (`updateFitness` + role drain multipliers)

### [DF] Defenders (DR, DL, DC)

- **No-Nonsense Defender:** (Tackling, Strength, Heading, Positioning)
  *Logic:* Reduces opponent space by -10% | Condition Drain: +10%
- **Wingback:** (Crossing, Stamina, Pace, Dribbling)
  *Logic:* Increases Long Pass Success by +10% | Condition Drain: +10%
- **Man Marker (Shadow):** (Aggression, Bravery, Tackling, Positioning, Heading)
  *Logic:* Reduces opponent's shooting chance by -15% | Condition Drain: +15%

### [MF] Midfielders (MC, MR, ML, DMC, AMC)

- **Ball Winning Midfielder:** (Tackling, Aggression, Bravery, Positioning)
  *Logic:* Reduces opponent's success (Long Shot/Pass/Dribble) by -10% | Condition Drain: +10%
- **Playmaker:** (Passing, Composure, Vision, Dribbling, Positioning)
  *Logic:* Increases Pass (Short/Long) & Dribbling Success by +10% | Condition Drain: +10%
- **Box-to-Box:** (Stamina, Teamwork, Positioning)
  *Logic:* Increases Long Shot & Short Pass Success by +10% | Condition Drain: +10%
- **Trequartista (Free Role):** (Vision, Dribbling, Passing, Acceleration, Crossing)
  *Logic:* Increases Long Pass & Dribbling Success by +15% | Condition Drain: +15%
- **Traditional Winger:** (Crossing, Dribbling, Acceleration, Pace, Agility)
  *Logic:* Increases Cross & Dribbling Success by +15% | Condition Drain: +15%
- **Wide Playmaker:** (Crossing, Passing, Vision, Acceleration)
  *Logic:* Increases Key Pass & Long Pass Success by +15% | Condition Drain: +10%

### [FW] Forwards (FC, FWR, FWL)

- **Target Man:** (Strength, Position, Shooting, Heading)
  *Logic:* Increases Hold Ball & Short Pass Success by +10% | Condition Drain: +10%
- **Complete Forward (Iconic):** (Strength, Pace, Shooting, Dribbling, Heading, Vision)
  *Logic:* Increases all attacking actions success by +10% | Condition Drain: +10%
- **Poacher:** (Shooting, Composure, Acceleration, Pace, Positioning, Heading)
  *Logic:* Increases Finishing Success by +3% | Condition Drain:+10%
- **False 9:** (Passing, Dribbling, Acceleration, Vision)
  *Logic:* Increases Key Pass & Dribbling Success by +15% | Condition Drain: +10%
- **Inverted Winger:** (Crossing, Dribbling, Acceleration, Shooting, Pace, Agility)
  *Logic:* Increases Shooting & Dribbling Success by +15% | Condition Drain: +15%

---

## 2. Calculation & Action Selection (Current Engine Behavior)

- **Role Suitability Calculation:** Uses position-specific **Player Power** calculation (0-100 scale) rather than simple attribute averaging for more accurate role fit evaluation. This considers:
  - Weighted attribute scoring per position
  - Experience bonus (0-20% boost)
  - Current condition/fitness
  - Converts to 1-5 star rating: 0-20 power = 1⭐, 21-40 = 2⭐, 41-60 = 3⭐, 61-80 = 4⭐, 81-100 = 5⭐
  
- **Bonus Weight:** Role modifiers are applied as multipliers to action weights and execution scores.
- **Action Bias:** There is no fixed `+20%` global bias. Bias depends on each role's `actionModifiers` and creative freedom influence.
- **Execution Impact:**
  - `PASS_SHORT` and `PASS_LONG` now use attacker role modifiers and defender role opponent penalties.
  - `DRIBBLE` uses defender role opponent penalties.
  - `SHOOT` uses attacker role modifiers and defender role opponent penalties.
  - If shooter is key-targeted and encounters `MAN_MARKER` in attacking zone, an additional `-15%` shoot effectiveness is applied.
- **Condition Trade-off:** Role condition drain is active via role multipliers, and key-player pressure also adds extra defender condition drain.

### 2.1 Role Modifier Alias Support

To match existing role definitions with engine actions:

- `crossing` modifier contributes to `PASS_LONG`
- `heading` modifier contributes to `SHOOT`

This allows roles like Wingback/Traditional Winger/Target Man to influence relevant match actions.

### 2.2 Key Player Neutralization by Zone

When a player is in `neutralization.targetPlayerIds`:

- **DEFENSIVE zone:** no dedicated mark pressure
- **MIDDLE zone:** pressure by `BALL_WINNING_MIDFIELDER`
- **ATTACKING zone:** pressure by `MAN_MARKER`
- Trigger chance is probabilistic (roughly 50%-80% based on marker profile)

---

## 3. Squad Management UI

- **Role Tab:** Add a "Player Roles" tab next to the standard tactical plans (Normal/Behind/Leading).
- **Suitability:** Display a 1-5 Star rating based on the player's Primary Attributes compared to the role's requirements.
- **Filter System:** On the role assignment screen, filter only eligible positions.

---

## 4. Recent Improvements (March 2026)

### Power Calculation Enhancement

- Changed role suitability calculation from simple attribute averaging to **position-specific Player Power** evaluation
- More accurate representation of actual in-match performance
- Accounts for experience bonuses and condition/fitness
- Better identifies players truly suited for roles

### Poacher Role Rebalancing

- **Finishing Success:** Reduced from +10% to **+3%** (was too effective)
- **Condition Drain:** Increased from +5% (1.05×) to **+10% (1.1×)**
- **Rationale:** Poacher was causing excessive shooting (shooting too much per match); lower bonus + higher fatigue now requires more tactical awareness to use effectively
- **Impact:** Poachers more selective with shots, conserve stamina better for key moments

### Match Engine Role Integration Upgrade

- Role effects are now applied beyond action selection and into execution outcomes.
- Defender role `opponentPenalty` is now used on pass/shot/dribble outcomes.
- Key-target + Man Marker encounter now directly reduces shot effectiveness by `-15%` on trigger.
- On-pitch-only player selection is enforced for random actor picks (bench players are no longer chosen during normal play).
