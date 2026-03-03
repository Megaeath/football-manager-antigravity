# MODULE: PLAYER ROLES & TACTICAL LOGIC (REVISED)

## 1. Role Filter & Logic

Use `naturalPosition` to filter and apply specific logic & condition drain.

### [DF] Defenders (DR, DL, DC)

- **No-Nonsense Defender:** (Tackling, Strength, Heading, Positioning)
  *Logic:* Reduce opponent space -10% | Condition Drain: +10%
- **Wingback:** (Crossing, Stamina, Pace, Dribbling)
  *Logic:* Long Pass Success +10% | Condition Drain: +10%
- **Man Marker (Shadow):** (Aggression, Bravery, Tackling, Positioning)
  *Logic:* Opponent Shoot Chance -15% | Condition Drain: +15%

### [MF] Midfielders (MC, MR, ML, DMC, AMC)

- **Ball Winning Midfielder:** (Tackling, Aggression, Bravery, Positioning)
  *Logic:* Opponent Success (Pass/Dribble/Long shot) -10% | Condition Drain: +10%
- **Playmaker:** (Passing, Composure, Vision, Dribbling, Positioning)
  *Logic:* Short/Long Pass & Dribble Success +10% | Condition Drain: +10%
- **Box-to-Box:** (Stamina, Teamwork, Positioning)
  *Logic:* Long Shot & Short Pass Success +10% | Condition Drain: +10%
- **Trequartista (Free Role):** (Vision, Dribbling, Passing, Acceleration, Crossing)
  *Logic:* Long Pass & Dribble Success +15% | Condition Drain: +15%
- **Traditional Winger:** (Crossing, Dribbling, Acceleration, Pace)
  *Logic:* Cross & Dribble Success +15% | Condition Drain: +15%
- **Wide Playmaker:** (Crossing, Passing, Vision, Acceleration)
  *Logic:* Key Pass & Long Pass Success +15% | Condition Drain: +10%

### [FW] Forwards (FC, FWR, FWL)

- **Target Man:** (Strength, Position, Shooting, Heading)
  *Logic:* Hold Ball & Short Pass Success +10% | Condition Drain: +10%
- **Complete Forward (Iconic):** (Strength, Pace, Shooting, Dribbling, Heading, Vision)
  *Logic:* All Attack Action Success +10% | Condition Drain: +10%
- **Poacher:** (Shooting, Composure, Acceleration, Pace, Positioning,Heading,Balance)
  *Logic:* Finishing Success +10% | Condition Drain: +5% (Low energy consumption)
- **False 9:** (Passing, Dribbling, Acceleration, Vision)
  *Logic:* Key Pass & Dribble Success +15% | Condition Drain: +10%
- **Inverted Winger:** (Crossing, Dribbling, Acceleration, Shooting)
  *Logic:* Dribble & Shooting Success +15% | Condition Drain: +15%

## 2. Calculation & Action Selection

- **Bonus Weight:** Add Role Bonus to player stats before RNG comparison.
- **Action Bias:** Players with roles are 20% more likely to attempt actions related to their role (e.g., Playmaker will try more passes).

## 3. Squad Management UI

- **Role Tab:** Add "Player Roles" tab next to Normal/Behind/Leading plans.
- **Suitability:** Display 1-5 Stars based on Primary Attributes vs Role Requirements.
