# MODULE: PLAYER ROLES & TACTICAL LOGIC (REVISED v2 - ENGLISH)

## 1. Role Filter & Logic

Use `naturalPosition` from the Database to filter available roles and calculate specific logic and condition drain.

### [DF] Defenders (DR, DL, DC)

- **No-Nonsense Defender:** (Tackling, Strength, Heading, Positioning, **Balance**)
  *Logic:* Reduces opponent space by -10% | Condition Drain: +10%
- **Wingback:** (Crossing, Stamina, Pace, Dribbling, **Balance**)
  *Logic:* Increases Long Pass Success by +10% | Condition Drain: +10%
- **Man Marker (Shadow):** (Aggression, Bravery, Tackling, Positioning, Heading, **Balance**)
  *Logic:* Reduces opponent's shooting chance by -15% | Condition Drain: +15%

### [MF] Midfielders (MC, MR, ML, DMC, AMC)

- **Ball Winning Midfielder:** (Tackling, Aggression, Bravery, Positioning, **Balance**)
  *Logic:* Reduces opponent's success (Long Shot/Pass/Dribble) by -10% | Condition Drain: +10%
- **Playmaker:** (Passing, Composure, Vision, Dribbling, Positioning, **Balance**)
  *Logic:* Increases Pass (Short/Long) & Dribbling Success by +10% | Condition Drain: +10%
- **Box-to-Box:** (Stamina, Teamwork, Positioning, **Balance**)
  *Logic:* Increases Long Shot & Short Pass Success by +10% | Condition Drain: +10%
- **Trequartista (Free Role):** (Vision, Dribbling, Passing, Acceleration, Crossing, **Balance**)
  *Logic:* Increases Long Pass & Dribbling Success by +15% | Condition Drain: +15%
- **Traditional Winger:** (Crossing, Dribbling, Acceleration, Pace, Agility, **Balance**)
  *Logic:* Increases Cross & Dribbling Success by +15% | Condition Drain: +15%
- **Wide Playmaker:** (Crossing, Passing, Vision, Acceleration, **Balance**)
  *Logic:* Increases Key Pass & Long Pass Success by +15% | Condition Drain: +10%

### [FW] Forwards (FC, FWR, FWL)

- **Target Man:** (Strength, Position, Shooting, Heading, **Balance**)
  *Logic:* Increases Hold Ball & Short Pass Success by +10% | Condition Drain: +10%
- **Complete Forward (Iconic):** (Strength, Pace, Shooting, Dribbling, Heading, Vision, **Balance**)
  *Logic:* Increases all attacking actions success by +10% | Condition Drain: +10% | *Req: Multiplier x1.6+*
- **Poacher:** (Shooting, Composure, Acceleration, Pace, Positioning, Heading, **Balance**)
  *Logic:* Increases Finishing Success by +3% | Condition Drain:+10%
- **False 9:** (Passing, Dribbling, Acceleration, Vision, **Balance**)
  *Logic:* Increases Key Pass & Dribbling Success by +15% | Condition Drain: +10%
- **Inverted Winger:** (Crossing, Dribbling, Acceleration, Shooting, Pace, Agility, **Balance**)
  *Logic:* Increases Shooting & Dribbling Success by +15% | Condition Drain: +15%

---

## 2. Calculation & Action Selection

- **Role Suitability Calculation:** Uses position-specific **Player Power** calculation (0-100 scale) rather than simple attribute averaging for more accurate role fit evaluation. This considers:
  - Weighted attribute scoring per position
  - Experience bonus (0-20% boost)
  - Current condition/fitness
  - Converts to 1-5 star rating: 0-20 power = 1⭐, 21-40 = 2⭐, 41-60 = 3⭐, 61-80 = 4⭐, 81-100 = 5⭐
  
- **Bonus Weight:** Add the Role Bonus to the player's stats before the RNG comparison calculation.
- **Action Bias:** Players with assigned roles are 20% more likely to attempt actions related to their specific role (e.g., a Playmaker will prioritize passing over shooting).
- **Balance Impact:** The Balance attribute is used as an additional multiplier during physical duels or when a player needs to turn/shoot in tight spaces.

---

## 3. Squad Management UI

- **Role Tab:** Add a "Player Roles" tab next to the standard tactical plans (Normal/Behind/Leading).
- **Suitability:** Display a 1-5 Star rating based on the player's Primary Attributes compared to the role's requirements.
- **Filter System:** On the role assignment screen, filter only eligible positions and players who haven't been assigned to another role group.
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