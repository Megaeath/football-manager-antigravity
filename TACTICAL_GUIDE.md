# Tactical Effects Reference Guide

## How Each Tactic Affects Match Outcomes

### 1. ATTACKING FOCUS (Center vs Wings vs Mixed)

#### CENTER Attack
- **Effect**: Team emphasizes play through the middle
- **Position Weighting**: 
  - Center positions (MC, AMC, FWC, DMC): +40% selection weight
  - Wing positions: -30% selection weight
  - Other positions: Normal weight
- **Real-World Strategy**: 
  - More through-balls from midfield
  - Build-up play in the center
  - Less crossing from wings
  - Better vs defensive formations

#### WINGS Attack
- **Effect**: Team emphasizes wide play and flanking moves
- **Position Weighting**:
  - Wing positions (MR, ML, AMR, AML, FWR, FWL, DR, DL, DMR, DML): +40% selection weight
  - Center positions: -30% selection weight
  - Other positions: Normal weight
- **Real-World Strategy**:
  - More crosses from wings
  - Flank-based attacks
  - Full-back involvement in attack
  - Better vs packed defenses

#### MIXED Attack (Default)
- **Effect**: Balanced approach, no positional bias
- **Use When**: Adapting to opponent or building possession

---

### 2. CREATIVE FREEDOM (Strict vs Normal vs Freedom)

#### STRICT Creative Freedom
- **Shooting**: -15% (players less likely to shoot)
- **Dribbling**: -20% (players less likely to dribble)
- **Risk-Taking**: -30% (fewer ambitious plays)
- **Team Behavior**:
  - Passes more, shoots less
  - Sticks to formations
  - Lower error rate
  - Slower attack tempo
- **Best For**: Protecting a lead, defensive shapes

#### NORMAL Creative Freedom (Default)
- **Effect**: Balanced between tactics and individual brilliance
- **Use When**: Standard attacking or defensive play

#### FREEDOM Creative Freedom
- **Shooting**: +20% (players more likely to shoot)
- **Dribbling**: +20% (players more likely to dribble)
- **Risk-Taking**: +30% (more ambitious plays)
- **Team Behavior**:
  - Shoots more, passes less
  - Players improvise more
  - Higher error rate
  - Faster attack tempo
  - More spectacular plays
- **Best For**: Chasing goals, needing quick results

---

### 3. PASSING STYLE (Short vs Mixed vs Long)

#### SHORT Pass Play
- **Short Pass Weight**: +30% (more likely)
- **Long Pass Weight**: -30% (less likely)
- **Team Behavior**:
  - Keep possession longer
  - Build up play slowly
  - More completed passes
  - Slower progress up field
  - Lower tempo
- **Real-World Strategy**: "Possession football" (Tiki-taka)
- **Best For**: 
  - Controlling tempo
  - Tire opponent
  - Possession-based tactics

#### MIXED Pass Play (Default)
- **Effect**: Balanced short and long ball usage
- **Use When**: No specific preference

#### LONG Pass Play
- **Short Pass Weight**: -30% (less likely)
- **Long Pass Weight**: +30% (more likely)
- **Team Behavior**:
  - Direct attacking play
  - Quick transitions
  - Fewer completed passes
  - Faster progress up field
  - Higher tempo
  - More long ball interceptions
- **Real-World Strategy**: "Direct play" (kick-and-rush, long-ball tactics)
- **Best For**:
  - Counter-attacking
  - Quick goals
  - Direct approach vs weak defenses

---

### 4. TACKLING INTENSITY (Soft vs Normal vs Hard)

#### SOFT Tackling
- **Tackle Success**: -15% (harder to win ball)
- **Foul Probability**: -30% (fewer fouls/cards)
- **Team Behavior**:
  - Defensive approach less aggressive
  - Let opponent have possession
  - Standing-off defense
  - Fewer yellow/red cards
  - Risk: Easier to play through
- **Real-World Strategy**: "Positional defense" (Atletico Madrid style)
- **Best For**:
  - Protecting key defenders
  - Avoiding suspensions
  - Compact defensive shapes
  - Maintaining discipline

#### NORMAL Tackling (Default)
- **Effect**: Standard tackling intensity
- **Use When**: Balanced defense

#### HARD Tackling
- **Tackle Success**: +15% (easier to win ball)
- **Foul Probability**: +30% (more fouls/cards)
- **Team Behavior**:
  - Aggressive pressing
  - High intensity challenges
  - Win more 50-50 balls
  - More yellow/red cards
  - Risk: More fouls and suspensions
- **Real-World Strategy**: "Gegenpressing" (Liverpool, Manchester City)
- **Best For**:
  - High pressing
  - Winning ball back quickly
  - Aggressive defense
  - Game state: Winning (can afford cards)

---

## Tactical Combinations - What Works Well Together

### AGGRESSIVE Attacking Setup
```
Attacking Focus: WINGS
Creative Freedom: FREEDOM
Passing: LONG
Tackling: HARD
Mentality: ALL_OUT_ATTACK
```
**Effect**: Relentless, high-tempo attacking with risk-taking  
**When to Use**: Down a goal late, need goals now  
**Risks**: Concede on counter-attacks, high foul rate

### CONTROLLED Possession
```
Attacking Focus: CENTER
Creative Freedom: STRICT
Passing: SHORT
Tackling: SOFT
Mentality: ATTACKING
```
**Effect**: Patient, possession-based build-up  
**When to Use**: In control of match, tire opponent  
**Risks**: Opponent counter-attack on long ball loss

### DEFENSIVE Block
```
Attacking Focus: CENTER
Creative Freedom: STRICT
Passing: SHORT
Tackling: SOFT
Mentality: DEFENSIVE
```
**Effect**: Compact, hard to break down  
**When to Use**: Protecting 1-0 lead  
**Risks**: Boring, easy to frustrate

### COUNTER-ATTACKING
```
Attacking Focus: WINGS
Creative Freedom: FREEDOM
Passing: LONG
Tackling: HARD
Mentality: ATTACKING
```
**Effect**: Quick transitions, explosive attacks  
**When to Use**: Vs possession-dominant opponents  
**Risks**: Disorganized if ball possession lost

### BALANCED (Default)
```
Attacking Focus: MIXED
Creative Freedom: NORMAL
Passing: MIXED
Tackling: NORMAL
Mentality: NORMAL
```
**Effect**: Stable, adaptable, no clear weakness  
**When to Use**: Standard match, adapting to opponent  
**Best for**: First half before tactical assessment

---

## Match Situation Recommendations

### SCENARIO 1: Leading 1-0, 10 Minutes Remaining
**Recommended Tactics**:
- Attacking Focus: **CENTER** (slow down play)
- Creative Freedom: **STRICT** (keep shape)
- Passing: **SHORT** (maintain possession)
- Tackling: **SOFT** (avoid cards/errors)
- Mentality: **DEFENSIVE**

**Rationale**: Protect lead, run down clock, safe possession

### SCENARIO 2: Losing 0-1, 20 Minutes Remaining
**Recommended Tactics**:
- Attacking Focus: **WINGS** (create chances)
- Creative Freedom: **FREEDOM** (need goals)
- Passing: **LONG** (faster tempo)
- Tackling: **HARD** (aggressive press)
- Mentality: **ALL_OUT_ATTACK**

**Rationale**: Create chances quickly, concede less important

### SCENARIO 3: Draw 1-1, 30 Minutes Remaining
**Recommended Tactics**:
- Attacking Focus: **MIXED** (flexible)
- Creative Freedom: **NORMAL** (balanced)
- Passing: **MIXED** (balanced)
- Tackling: **NORMAL** (standard)
- Mentality: **ATTACKING**

**Rationale**: Continue balanced play, look for winner

### SCENARIO 4: Leading 2-0, 40 Minutes Remaining
**Recommended Tactics**:
- Attacking Focus: **CENTER** (control)
- Creative Freedom: **STRICT** (minimize errors)
- Passing: **SHORT** (keep possession)
- Tackling: **SOFT** (preserve squad fitness)
- Mentality: **NORMAL**

**Rationale**: Manage game, accumulate possession, few risks

### SCENARIO 5: Match is Even, Early Game
**Recommended Tactics**: 
- Keep defaults (MIXED/NORMAL/MIXED/NORMAL)

**Rationale**: Assess opponent, adapt based on how match develops

---

## Measuring Effectiveness

### Watch for These Stats to Judge Tactic Success:

**Passing Short**: 
- ↑ Passes completed %
- ↑ Possession %
- ↓ Shots on target

**Passing Long**:
- ↓ Passes completed %
- ↓ Possession %
- ↑ Shots on target (immediate chances)

**Creative Freedom Strict**:
- ↓ Dribbles won
- ↓ Shots attempted
- ↓ Cards (yellow/red)

**Creative Freedom Freedom**:
- ↑ Dribbles won
- ↑ Shots attempted
- ↑ Cards (yellow/red)

**Attacking Center**:
- ↑ Passes through midfield
- ↑ Goals from open play
- ↓ Crosses completed

**Attacking Wings**:
- ↑ Crosses completed
- ↑ Chances from flanks
- ↓ Through ball assists

**Tackling Hard**:
- ↑ Tackles won
- ↑ Fouls committed
- ↑ Cards (yellow/red)
- ↑ Interceptions

**Tackling Soft**:
- ↓ Tackles won
- ↓ Fouls committed
- ↓ Cards (yellow/red)
- ↓ Interceptions (let possession happen)

---

## Tips for Championship Success

1. **Adapt to Opponent**: If opponent has strong midfield, use WINGS focus
2. **Protect Key Players**: Use SOFT tackling if star defender on yellow card
3. **Time Adjustments**: Change tactics based on match situation (see scenarios)
4. **Build Mentality**: STRICT + SOFT = Defensive shape; FREEDOM + HARD = Aggressive press
5. **Player Fitness**: HIGH tackling intensity (HARD) tires players faster
6. **Risk Management**: STRICT + SHORT = Lowest error rate; FREEDOM + LONG = Highest
7. **Test Combinations**: Try new tactical combos in friendlies before important matches

---

## Common Mistakes to Avoid

❌ **ALL_OUT_ATTACK + SOFT Tackling**: Aggressive mentality undermined by passive defense

❌ **SHORT Pass + WINGS Focus**: Wing play contradicts short passes

❌ **FREEDOM + DEFENSIVE Mentality**: Contradictory instructions confuse players

❌ **HARD Tackling in Final Hour**: Accumulates unnecessary cards when ahead

❌ **LONG Passes with STRICT Freedom**: Can't execute long-ball instructions if strict

✅ **DO**: Keep tactics consistent with mentality  
✅ **DO**: Adjust based on match situation  
✅ **DO**: Consider player fitness when using HIGH intensity tactics

---

## Season Strategy

### Early Season (Learning)
- Use default MIXED/NORMAL tactics
- Identify which formations work
- Build player fitness

### Mid Season (Refinement)
- Test tactical combinations
- Find winning formula for squad
- Develop predictable attacking patterns

### Late Season (Optimization)
- Use proven tactics for important matches
- Save best combinations for rivals
- Risk taking in winnable fixtures

### End of Season (Experimenting)
- Safe to experiment with new tactics
- Test youth in different roles
- Gather data for next season
