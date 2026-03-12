# Football Player Evolution System (Implemented Reference - March 2026)

This document reflects what is currently implemented in code.

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

## 2) Match EXP Gains/Penalties

Per match EXP is calculated by `calculateMatchExp()` with:

- Starter `>=45 min`: `+1`
- Sub `>0 min`: `+0.5`
- MOTM: `+5`
- Rating `>=9.0`: `+3`
- Rating `>=7.5`: `+1.5`
- Goals + Assists: `+1` each (max `+3`)
- Clean sheet (GK/DF): `+1.5`
- Rating `<5.0`: `-5`
- Rating `<=5.5`: `-2`
- Red card: `-10`
- Yellow card: `-2` each
- Own goal: `-5` each (supported by function input)
- Penalty conceded: `-3` each (supported by function input)

Then match EXP is age-adjusted and persisted:

- Age efficiency is applied per match via `applyAgeEfficiency()`
- Result is rounded to integer before writing to `player.exp` (Int field)

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

