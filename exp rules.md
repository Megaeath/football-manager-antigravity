
# Football Player Evolution System (Implemented Reference - March 2026, Updated)

This document reflects the current implementation in code, including the latest EXP calculation logic and GK save bonus.

## 1) Core EXP Tier Logic (1.8 Rule in code)

- Base: `EXP = 0` => `x1.0`
- Cap: clamped to `[-1000, 1000]`
- Tiering uses the 1.8 threshold behavior in code:
  - `0..179` => tier `0` => bonus `+0`
  - `180..279` => tier `2` => bonus `+2`
  - `280..379` => tier `3` => bonus `+3`
  - ...
  - `980..1000` => tier `10` => bonus `+10` (`x2.0`)

Applied through:

- `getExpBonus(exp)`
- `getExpMultiplier(exp)`
- `getEffectiveAttributes()` in power calculation

## 2) Match EXP Gains/Penalties (calculateMatchExp)

For each match, EXP is calculated as follows:

### Base Gain

- Starter (minutes >= 45): `+1`
- Substitute (minutes > 0): `+0.5`

### Performance Gain

- Man of the Match (MOTM): `+5`
- Rating >= 9.0: `+3`
- Rating >= 7.0: `+1.5`
- Clean sheet (GK/DF only): `+1.5` (if no goals conceded)
- **GK Save Bonus:**
  - If `saves` stat exists: `saves * 0.1`
  - Else: `(teamShotsOnTargetConceded - goalsConceded) * 0.1` (if > 0)

### Action Gain

- Goals: `+1` per goal (no cap)
- Assists: `+1` per assist (no cap)

### Penalty Loss

- Rating < 5.0: `-2`
- Rating <= 5.5: `-1`
- Red card: `-5`
- Yellow card: `-1` each
- Own goal: `-5` each (if provided)
- Penalty conceded: `-2` each (if provided)

### Total Gain

`totalGain = baseGain + performanceGain + actionGain - penaltyLoss`

### Age Efficiency Adjustment

- Age 16-21: 100%
- Age 22-28: 70%
- Age 29-33: 40%
- Age 34+: 10%

`adjustedGain = totalGain * efficiency`

### Rounding

- The final EXP gain is rounded to the nearest integer: `Math.round(adjustedGain)`
- This value is added to `player.exp` after the match

### Example (GK)

Suppose a GK plays 90 minutes, rating 6.5, 0 goals, 0 assists, 0 cards, not MOTM, not clean sheet, opponent shots on target = 27, goals conceded = 1, age 25:

- baseGain = 1
- performanceGain = (GK save bonus: (27-1)*0.1 = 2.6)
- actionGain = 0
- penaltyLoss = 0
- totalGain = 1 + 2.6 + 0 - 0 = 3.6
- age efficiency (age 25): 0.7
- adjustedGain = 3.6 * 0.7 = 2.52
- final EXP = Math.round(2.52) = 3

## 3) Seasonal Bonuses/Penalties (Enabled)

At season rollover, `applySeasonExpAdjustments()` applies:

- Player of the Season: `+20`
- Golden Boot (Top Scorer): `+15`
- Top Assist: `+15`
- League Champion squad participants: `+10`
- Relegated teams (bottom 3) participants: `-30`

## 4) Age Constraints + Seasonal Cap + Annual Decay (Enabled)

Season adjustment uses this table:

| Age Range | Efficiency | Seasonal Cap (positive net) | Annual Decay |
| :--- | :--- | :--- | :--- |
| 16 - 21 | 100% | +80 | 0 |
| 22 - 28 | 70% | +50 | 0 |
| 29 - 33 | 40% | +20 | 40 |
| 34+ | 10% | +10 | 80 |

Flow at season close:

1. Recompute season raw EXP from match stats.
2. Apply age efficiency.
3. Cap positive net by seasonal cap.
4. Add seasonal bonuses/penalties.
5. Subtract annual decay.
6. Compute delta vs raw match EXP already applied during season.
7. Apply correction delta to `player.exp`.

## 5) Injury Rule Status

- Rule "out 4+ months => -15 EXP and -5% accumulated EXP" is **not enabled yet**.
- Reason: current schema has no injury-duration tracking model.

## 6) Runtime Trigger Points

- Match-time EXP: in `processMatch()` after each played match.
- Seasonal EXP corrections: in `startNewSeason()` via `applySeasonExpAdjustments()`.
- Legacy monthly EXP decay function is disabled (to avoid double-decay).
