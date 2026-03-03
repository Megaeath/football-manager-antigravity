# Match Page Player Analysis Enhancement

## Overview

Enhanced the `/match` page player stats section with interactive zone filtering, action breakdown analysis, and detailed column headers. Users can now click on individual players to analyze their on-field performance with granular data breakdowns.

## Implementation Details

### 1. Column Header Row
**Location**: `src/app/match/page.tsx` (lines ~870-890)

Added a descriptive header row above player stats table with column abbreviations:
- **POS**: Player position (e.g., FWR, MC, DC)
- **NAME**: Player full name
- **MIN**: Minutes played
- **RAT**: Match rating (1.0-10.0 scale)
- **FIT**: Fitness/Condition at match end (0-100)
- **SHO**: Shots on target / Total shots
- **PAS**: Passes completed / Passes attempted
- **CRS**: Crosses completed / Crosses attempted
- **DRB**: Dribbles won / Dribbles attempted
- **TCK**: Tackles won / Tackles attempted

**Styling**:
- Light background (#f8fafc)
- Uppercase text (CSS `textTransform: 'uppercase'`)
- Smaller font (0.75rem)
- Bold weight for clarity
- Tooltips on hover to explain each abbreviation

### 2. Clickable Zone Distribution Chart
**Location**: `src/app/match/page.tsx` (expanded player card section, lines ~920-960)

Interactive stacked bar chart showing where on the field a player received the ball:

**Zones**:
- 🛡️ **Defensive**: Touches in 1-30 range (blue #3b82f6)
- ⚙️ **Middle**: Touches in 31-70 range (green #10b981)
- ⚽ **Attacking**: Touches in 71-100 range (orange #f59e0b)

**Interactivity**:
- Click on any zone segment to toggle filter/highlight
- Highlights selected zone (opacity 1.0), dims others (opacity 0.4)
- White border indicates selected zone
- Click again to deselect
- Displays absolute touch count and percentage in tooltip on hover

**Data Display**:
- Shows percentage only if segment >= 15% width (prevents text overflow)
- Below chart displays: "🛡️ 42% • ⚙️ 35% • ⚽ 23%"
- Shows selected filter status: "(Filtered: middle)" when active

**Height**: 24px for readability with dual-level information

### 3. Action Breakdown Percentage Table
**Location**: `src/app/match/page.tsx` (expanded player card section, lines ~962-980)

Shows what percentage of each action type the player attempted, always totaling to 100%:

**Action Types**:
- **PASS_SHORT**: Short passes
- **PASS_LONG**: Long/direct passes
- **DRIBBLE**: Ball-carrying dribbles
- **SHOOT**: Shot attempts

**Data Displayed Per Action**:
- **Percentage (bold)**: Of total attempts this action represents (e.g., 42%)
- **Attempts**: Raw count of action attempts (e.g., 28 attempts)
- **Success Rate**: Percentage of successful actions (e.g., 88% success)

**Calculation**:
```typescript
totalAttempts = sum of all action attempts across 4 types
percentage = (action.attempts / totalAttempts) * 100

// Always totals to 100% (or near 100% due to rounding)
```

**Visual Layout**:
- Grid of 4 columns (one per action type)
- Fixed minimum width of 80px per column
- Light background (#fafafa) for distinction
- Shows total attempts in header: "Total: 234 attempts = 100%"

### 4. Detailed Action Stats Section
**Location**: `src/app/match/page.tsx` (expanded player card section, lines ~982-1000)

Displays detailed success metrics for each action type:

**Per-Action Metrics**:
- Action type name (e.g., "PASS SHORT")
- Success rate percentage (0-100%)
- Success count / Total attempts ratio (e.g., 24/28)

**Visual**:
- Grid of 4 columns (same as action breakdown)
- Light background (#f8fafc)
- Success rate in bold primary color
- Smaller font for count details

**Purpose**: Compare action efficiency across types (e.g., "Why is DRIBBLE only 56% but PASS_SHORT is 88%?")

## State Management

### New State Variables
```typescript
const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
```

Tracks which zone (if any) the user has selected for filtering:
- `null`: No filter active
- `'defensive'`: Highlighting defensive zone
- `'middle'`: Highlighting middle zone
- `'attacking'`: Highlighting attacking zone

### Zone Filter Logic
```typescript
// Toggle zone selection on click
setSelectedZoneFilter(selectedZoneFilter === zone.key ? null : zone.key);

// Visual opacity based on filter state
opacity: selectedZoneFilter === null || selectedZoneFilter === zone.key ? 1 : 0.4;

// Border highlight for selected zone
border: selectedZoneFilter === zone.key ? '2px solid white' : 'none'
```

### Future Enhancement
Zone filtering could be extended to filter the action breakdown table to show only actions taken in that zone:
```typescript
// Pseudo-code for zone-specific action filtering
const filteredActions = selectedZoneFilter 
  ? actionBreakdown.filter(a => a.zone === selectedZoneFilter)
  : actionBreakdown;
```

## Data Sources

### Analytics from Raw Action Logs
All player analysis is calculated from `matchActionAnalytics?.byPlayer?.[playerId]`:

```typescript
{
  zones: {
    defensive: number,
    middle: number,
    attacking: number,
    total: number
  },
  actions: {
    PASS_SHORT: { attempts, success, fail, successRate },
    PASS_LONG: { attempts, success, fail, successRate },
    DRIBBLE: { attempts, success, fail, successRate },
    SHOOT: { attempts, success, fail, successRate }
  }
}
```

### Fallback to Match Stats
If analytics not available, falls back to player match stats database fields:
```typescript
const defPct = Math.round(((analytics?.zones?.defensive ?? p.defensiveThirdTouches ?? 0) / totalZoneTouches) * 100);
```

## Visual Hierarchy

### Player Card Structure
```
┌─────────────────────────────────────────────────┐
│ [COMPACT ROW] Position | Name | Min | Rat | ... │  (Always visible)
├─────────────────────────────────────────────────┤
│ [EXPANDED ROW - Hidden by default, click to show]│
│                                                 │
│ Field Zone Distribution (Click to filter):     │
│ ┌────────────────────────────────────────────┐  │
│ │ 🛡️ 42%  │ ⚙️ 35%  │ ⚽ 23% │              │  │
│ └────────────────────────────────────────────┘  │
│ 🛡️ 42% • ⚙️ 35% • ⚽ 23%                        │
│                                                 │
│ Action Breakdown (Total: 234 attempts = 100%): │
│ ┌──────┬──────┬──────┬──────┐                  │
│ │ PASS │ PASS │ DRBL │ SHOT │                  │
│ │SHORT │ LONG │      │      │                  │
│ │ 42%  │ 28%  │ 18%  │ 12%  │                  │
│ │ 98   │ 65   │ 42   │ 28   │                  │
│ │ 88%  │ 75%  │ 56%  │ 45%  │                  │
│ └──────┴──────┴──────┴──────┘                  │
│                                                 │
│ Detailed Action Stats:                         │
│ ┌──────┬──────┬──────┬──────┐                  │
│ │ ...  │ ...  │ ...  │ ...  │                  │
│ └──────┴──────┴──────┴──────┘                  │
└─────────────────────────────────────────────────┘
```

## Code Quality

### TypeScript Type Safety
- All state properly typed
- Analytics objects include proper null checks
- No `any` casts for player data

### Responsive Design
- Grid layout uses CSS Grid for alignment
- Minimum column widths ensure readability on mobile
- Proper gap spacing between elements

### Accessibility
- Hover tooltips with full information
- Keyboard accessible (tab through expandable rows)
- Color-blind friendly zone colors (blue, green, orange with distinct shades)
- Title attributes on interactive elements

### Performance
- Calculations done at render time from pre-loaded analytics
- No additional API calls when expanding cards
- Memoization could be added if needed for large squads

## Files Modified

| File | Changes |
|------|---------|
| `src/app/match/page.tsx` | Added state, header row, interactive zone chart, action breakdown, detailed stats |
| `.github/copilot-instructions.md` | Added section 1.2 documenting Player Analysis UI |

## Testing Recommendations

1. **Expand a player card** on `/match` → HOME or AWAY tabs
2. **Verify zone chart displays**:
   - Correct percentages (should sum to ~100%)
   - Correct colors (blue/green/orange)
   - Touch count visible on hover
3. **Click zone segments**:
   - First click: Highlight selected zone
   - Second click: Deselect and show all zones
   - Check opacity changes
4. **Check action breakdown**:
   - Percentages add up to 100%
   - Counts match raw action logs
   - Success rates display correctly
5. **Verify column header**:
   - Shows before first player row
   - Has proper styling and tooltips
   - Abbreviations are clear

## Browser Compatibility

- Chrome/Edge: Full support (CSS Grid, modern tooltips)
- Firefox: Full support
- Safari: Full support
- Mobile: Touch-friendly interface with proper spacing

## Future Enhancement Ideas

1. **Zone-specific action filtering**: Click zone to show only actions in that zone
2. **Comparison view**: Side-by-side comparison of two players' analytics
3. **Heatmap visualization**: Show cluster of touches by position on pitch
4. **Time-based breakdown**: Show action distribution by game periods (0-30, 30-60, 60-90 min)
5. **Pressure situations**: Highlight actions taken when low on condition or under pressure
6. **Player role adaptation**: Show if player changed role/position during match
7. **Opposition comparison**: Compare player's zone usage vs team average

## Documentation Updates

- ✅ `.github/copilot-instructions.md`: Added section 1.2 "Player Analysis UI on Match Page"
- Key documentation links:
  - [API_REFERENCE.md](API_REFERENCE.md) - Action logs API endpoints
  - [TACTICAL_GUIDE.md](TACTICAL_GUIDE.md) - How tactics affect action selection
  - [POWER_CALCULATION_EXPLANATION.md](POWER_CALCULATION_EXPLANATION.md) - Overall calculation

Last updated: March 3, 2026
Build Status: ✅ Compiled successfully (npm run build)
