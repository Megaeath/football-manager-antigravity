# 🔄 Complete Migration Plan: Design Consistency + English Localization + AD Date Format

> **Phase-by-phase implementation plan**  
> **Created**: March 17, 2026  
> **Estimated Timeline**: 2-3 weeks  
> **Total Files to Update**: ~50 files

---

## 📋 Overview

### Three Major Changes:

1. **🎨 Design Consistency**: Apply unified styling across all pages
2. **🌐 English Localization**: Convert all Thai text to English
3. **📅 AD Date Format**: Change from Buddhist Era (BE) to Gregorian (AD)

---

## 🎯 Success Criteria

### Design Consistency ✅
- [ ] All cards use consistent padding (1.5rem / 24px)
- [ ] All buttons use `.btn` classes with variants
- [ ] All colors use CSS variables (no hex codes)
- [ ] Typography follows scale (H1: 2.5rem, H2: 1.75rem, H3: 1.25rem)
- [ ] Spacing uses tokens (xs/sm/md/lg/xl)
- [ ] Mobile responsive with consistent breakpoints

### English Localization ✅
- [ ] All UI text in English (labels, buttons, titles, messages)
- [ ] All placeholders in English
- [ ] All error messages in English
- [ ] All success messages in English
- [ ] All navigation items in English
- [ ] All tooltips in English

### AD Date Format ✅
- [ ] All dates display as "March 17, 2026" (not "17 มีนาคม 2569")
- [ ] Date format: `MMMM D, YYYY` or `MMM D, YYYY`
- [ ] Remove `'th-TH-u-ca-gregory'` locale
- [ ] Use `'en-US'` or `'en-GB'` locale

---

## 🗓️ Phase Breakdown

### Phase 1: Foundation (Days 1-2)
**Goal**: Set up utility classes and reusable components

#### Tasks:
1. Update `globals.css` with utility classes
2. Create reusable UI components
3. Update date formatting utility
4. Create translation constants

#### Files to Create:
- `src/components/ui/Card.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/lib/dateFormat.ts`
- `src/lib/constants/uiLabels.ts`

#### Files to Update:
- `src/app/globals.css`

---

### Phase 2: Core Layout (Days 3-4)
**Goal**: Update app shell and navigation

#### Files to Update:
1. `src/components/AppShell.tsx`
2. `src/components/Header.tsx`
3. `src/components/Sidebar.tsx`
4. `src/components/Breadcrumbs.tsx`

#### Changes:
- Convert Thai menu items to English
- Standardize header styling
- Update date display format
- Apply consistent spacing

---

### Phase 3: Home Page (Days 5-6)
**Goal**: Perfect the dashboard as template for other pages

#### File: `src/app/page.tsx`

#### Changes:
- Thai → English for all text
- Update date format
- Apply card variants
- Standardize button styles
- Fix league table styling
- Update hero section

**Example Changes**:
```diff
- <h1>⚽ FOOTBALL MANAGER</h1>
- <p>อบรม ${userTeam.name} ไปสู่ความเป็นแชมป์</p>
+ <h1>⚽ FOOTBALL MANAGER</h1>
+ <p>Lead {userTeam.name} to Championship Glory</p>

- date.toLocaleDateString('th-TH-u-ca-gregory', {...})
+ date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

- <div style={{ padding: '1.25rem' }}>
+ <div className="card card-gradient-primary">
```

---

### Phase 4: Squad Management (Days 7-9)
**Goal**: Update complex squad page with tabs

#### Files to Update:
1. `src/app/squad/page.tsx`
2. `src/app/squad/SquadClient.tsx`
3. `src/components/TacticsForm.tsx`
4. `src/components/TacticsTabs.tsx`

#### Changes:
- Convert all Thai labels to English
- Update tactical position names (already in English, verify consistency)
- Standardize tab styling
- Fix player card layout
- Update formation labels

**Thai → English Examples**:
```diff
- "จัดการทีม (Squad Management)"
+ "Squad Management"

- "ทีมปัจจุบัน"
+ "Current Team"

- "พร้อมเริ่มแข่งแล้วใช่ไหม?"
+ "Ready to Start the Match?"

- "คู่แข่ง"
+ "Opponent"

- "เริ่มแข่ง"
+ "Start Match"

- "ดูคู่แข่ง"
+ "View Opponent"
```

---

### Phase 5: Match Pages (Days 10-12)
**Goal**: Update match viewing and simulation

#### Files to Update:
1. `src/app/match/page.tsx`
2. `src/app/fixtures/page.tsx`
3. `src/app/matches/page.tsx`
4. `src/components/MatchTacticsSelector.tsx`
5. `src/components/MatchPrepForm.tsx`
6. `src/components/MatchPrepTab.tsx`

#### Changes:
- Convert match events to English
- Update statistics labels
- Fix date formats
- Standardize player card styling
- Update analytics section

**Thai → English Examples**:
```diff
- "รายละเอียด"
+ "Details"

- "สถิติ"
+ "Statistics"

- "เหตุการณ์"
+ "Events"

- "ทีมเหย้า"
+ "Home Team"

- "ทีมเยือน"
+ "Away Team"

- "ผู้เล่นยอดเยี่ยม"
+ "Player of the Match"
```

---

### Phase 6: League & Tables (Days 13-14)
**Goal**: Update league standings and statistics

#### Files to Update:
1. `src/app/league/page.tsx`
2. `src/app/league/fixtures/page.tsx`
3. `src/app/league/stats/page.tsx`
4. `src/components/SeasonSelector.tsx`
5. `src/components/TeamFilter.tsx`

#### Changes:
- Convert table headers to English
- Update season labels
- Fix team filter labels
- Standardize table styling

**Thai → English Examples**:
```diff
- "ตารางคะแนนปัจจุบัน"
+ "Current League Standings"

- "ประวัติฤดูกาลที่"
+ "Season History"

- "ฤดูกาลที่"
+ "Season"

- "(ปัจจุบัน)"
+ "(Current)"

- "สโมสร"
+ "Club"

- "แข่ง"
+ "P" (Played)

- "ชนะ"
+ "W" (Won)

- "เสมอ"
+ "D" (Drawn)

- "แพ้"
+ "L" (Lost)

- "ได้"
+ "GF" (Goals For)

- "เสีย"
+ "GA" (Goals Against)

- "+/-"
+ "GD" (Goal Difference)

- "แต้ม"
+ "Pts" (Points)

- "จัดการ"
+ "Manage"

- "ดูทีม"
+ "View Team"
```

---

### Phase 7: Players & Search (Days 15-16)
**Goal**: Update player search and profiles

#### Files to Update:
1. `src/app/players/page.tsx`
2. `src/app/player/[id]/page.tsx`
3. `src/components/PlayerModal.tsx`
4. `src/components/PlayerSearchModal.tsx`
5. `src/components/TeamFilter.tsx`

#### Changes:
- Convert filter labels to English
- Update player attributes display
- Fix market value labels
- Standardize form styling

**Thai → English Examples**:
```diff
- "ค้นหานักเตะ"
+ "Player Search"

- "ค้นหาและกรอง"
+ "Search & Filters"

- "ชื่อนักเตะ"
+ "Player Name"

- "พิมพ์ชื่อ..."
+ "Search by name..."

- "ตำแหน่ง"
+ "Position"

- "ทั้งหมด"
+ "All Positions"

- "อายุ"
+ "Age"

- "ราคาตลาด"
+ "Market Value"

- "สัญญาเหลือ"
+ "Contract"

- "ทั้งหมด"
+ "All"

- "จบเร็ว ๆ นี้"
+ "Ending Soon"

- "ฟรีเอเยนต์"
+ "Free Agents Only"
```

---

### Phase 8: Finance & Contracts (Days 17-18)
**Goal**: Update financial pages

#### Files to Update:
1. `src/app/finances/page.tsx`
2. `src/app/contracts/page.tsx`
3. `src/components/TeamFinanceTab.tsx`
4. `src/components/ContractTab.tsx`
5. `src/components/FFPWarning.tsx`

#### Changes:
- Convert financial terms to English
- Update currency formatting
- Fix contract status labels
- Standardize transaction table

**Thai → English Examples**:
```diff
- "สถานะการเงิน"
+ "Financial Status"

- "ยอดเงินคงเหลือ"
+ "Balance"

- "รายได้สัปดาห์นี้"
+ "Weekly Income"

- "รายจ่ายสัปดาห์นี้"
+ "Weekly Expenses"

- "กำไร/ขาดทุน"
+ "Profit/Loss"

- "สถานะ FFP"
+ "FFP Status"

- "รายการล่าสุด"
+ "Recent Transactions"

- "ต่อสัญญา"
+ "Renew Contract"

- "สิ้นสุดสัญญา"
+ "Contract Expiry"

- "สัปดาห์"
+ "Weeks"
```

---

### Phase 9: Training & Settings (Days 19-20)
**Goal**: Update training facility and settings

#### Files to Update:
1. `src/app/training/page.tsx`
2. `src/app/settings/page.tsx`
3. `src/components/TrainingReadOnlyTab.tsx`
4. `src/components/PlayerRolesTab.tsx`
5. `src/components/PlayerRolesReadOnlyTab.tsx`

#### Changes:
- Convert training labels to English
- Update facility level descriptions
- Fix settings options
- Standardize slot styling

**Thai → English Examples**:
```diff
- "ระบบฝึกซ้อม"
+ "Training System"

- "ระดับศูนย์ฝึก"
+ "Facility Level"

- "อัปเกรด"
+ "Upgrade"

- "สล็อตฝึกซ้อม"
+ "Training Slots"

- "ตั้งค่า"
+ "Settings"

- "การแสดงผล"
+ "Display"

- "ทั่วไป"
+ "General"

- "ภาษาไทย"
+ "English" (already changed)
```

---

### Phase 10: Additional Pages (Days 21-22)
**Goal**: Update remaining pages

#### Files to Update:
1. `src/app/market/page.tsx`
2. `src/app/news/page.tsx`
3. `src/app/rankings/page.tsx`
4. `src/app/season-summary/page.tsx`
5. `src/app/team/[id]/page.tsx`
6. `src/app/analysis/popularity/page.tsx`

#### Changes:
- Market: Convert bid labels to English
- News: Convert news types to English
- Rankings: Convert ranking labels to English
- Season Summary: Convert award labels to English
- Team: Convert team profile labels to English
- Analysis: Convert analytics labels to English

---

## 📝 Detailed File-by-File Checklist

### Core Components

#### `src/components/Sidebar.tsx`
```diff
const navItems = [
-   { name: 'หน้าหลัก', href: '/', icon: '🏠' },
-   { name: 'จัดการทีม', href: '/squad', icon: '📋' },
-   { name: 'ตารางการแข่งขัน', href: '/fixtures', icon: '📅' },
-   { name: 'ระบบลีก', href: '/league', icon: '🏆' },
-   { name: 'ตลาดซื้อขาย', href: '/market', icon: '💱' },
-   { name: 'ข่าวสาร', href: '/news', icon: '📰' },
-   { name: 'สรุปฤดูกาล', href: '/season-summary', icon: '🏅' },
-   { name: 'อันดับนักเตะ', href: '/rankings', icon: '📊' },
-   { name: 'ค้นหานักเตะ', href: '/players', icon: '🔍' },
-   { name: 'การเงิน', href: '/finances', icon: '💰' },
-   { name: 'สัญญา', href: '/contracts', icon: '📄' },
-   { name: 'จำลองการแข่ง', href: '/match', icon: '⚽' },
-   { name: 'การฝึกซ้อม', href: '/training', icon: '🏋️' },
-   { name: 'ตั้งค่า', href: '/settings', icon: '⚙️' },
+   { name: 'Home', href: '/', icon: '🏠' },
+   { name: 'Squad', href: '/squad', icon: '📋' },
+   { name: 'Fixtures', href: '/fixtures', icon: '📅' },
+   { name: 'League', href: '/league', icon: '🏆' },
+   { name: 'Market', href: '/market', icon: '💱' },
+   { name: 'News', href: '/news', icon: '📰' },
+   { name: 'Season Summary', href: '/season-summary', icon: '🏅' },
+   { name: 'Rankings', href: '/rankings', icon: '📊' },
+   { name: 'Players', href: '/players', icon: '🔍' },
+   { name: 'Finances', href: '/finances', icon: '💰' },
+   { name: 'Contracts', href: '/contracts', icon: '📄' },
+   { name: 'Match', href: '/match', icon: '⚽' },
+   { name: 'Training', href: '/training', icon: '🏋️' },
+   { name: 'Settings', href: '/settings', icon: '⚙️' },
];
```

---

#### `src/components/Header.tsx`
```diff
- <span className="hidden sm:inline">Football Manager Game</span>
- <span className="sm:hidden">FM Game</span>
+ <span className="hidden sm:inline">Football Manager</span>
+ <span className="sm:hidden">FM</span>

- date.toLocaleDateString('th-TH-u-ca-gregory', {
+ date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
```

---

### Page Files

#### `src/app/page.tsx` (Home)
```diff
- <p>อบรม ${userTeam.name} ไปสู่ความเป็นแชมป์</p>
+ <p>Lead {userTeam.name} to Championship Glory</p>

- <div>วันที่ปัจจุบัน</div>
+ <div>Current Date</div>

- <div>ฤดูกาล {settings?.currentSeason || 1}</div>
+ <div>Season {settings?.currentSeason || 1}</div>

- <h4>👕 ทีมของคุณ</h4>
+ <h4>👕 Your Team</h4>

- <div>อันดับที่:</div>
+ <div>Position:</div>

- <div>นักเตะในทีม</div>
+ <div>Players in Squad</div>

- <Link>จัดการทีม →</Link>
+ <Link>Manage Squad →</Link>

- <h4>💰 สถานะการเงิน</h4>
+ <h4>💰 Financial Status</h4>

- <div>งบประมาณที่มี</div>
+ <div>Available Budget</div>

- <Link>ดูรายละเอียด →</Link>
+ <Link>View Details →</Link>

- <h4>🎯 แมตช์ถัดไป</h4>
+ <h4>🎯 Next Match</h4>

- <Link>ดูแมตช์ →</Link>
+ <Link>View Match →</Link>

- <h3>📊 ตารางคะแนนลีก</h3>
+ <h3>📊 League Table</h3>

- <th>ลำดับ</th>
+ <th>Pos</th>

- <th>ทีม</th>
+ <th>Team</th>

- <th>นัด</th>
+ <th>P</th>

- <th>ชนะ</th>
+ <th>W</th>

- <th>เสมอ</th>
+ <th>D</th>

- <th>แพ้</th>
+ <th>L</th>

- <th>G.D.</th>
+ <th>GD</th>

- <th>คะแนน</th>
+ <th>Pts</th>

- <Link>ดูตารางเต็ม →</Link>
+ <Link>View Full Table →</Link>

- <h3>⚽ แข้งทองสูงสุด</h3>
+ <h3>⚽ Top Scorers</h3>

- <h3>📰 ข่าวล่าสุด</h3>
+ <h3>📰 Latest News</h3>

- <Link>ดูทั้งหมด →</Link>
+ <Link>View All →</Link>

- <h3>📅 แมตช์ที่ผ่านมา</h3>
+ <h3>📅 Recent Matches</h3>
```

---

#### `src/app/squad/page.tsx`
```diff
- <h2>จัดการทีม (Squad Management)</h2>
+ <h2>Squad Management</h2>

- <p>ทีมปัจจุบัน: <strong>{team.name}</strong> • วางแผนการเล่นและกำหนดกลยุทธ์</p>
+ <p>Current Team: <strong>{team.name}</strong> • Plan Your Tactics and Strategy</p>
```

---

#### `src/app/squad/SquadClient.tsx`
```diff
- <h3>พร้อมเริ่มแข่งแล้วใช่ไหม?</h3>
+ <h3>Ready to Start the Match?</h3>

- <p>คู่แข่ง: <strong>{opponent.name}</strong></p>
+ <p>Opponent: <strong>{opponent.name}</strong></p>

- <button>🔍 ดูคู่แข่ง</button>
+ <button>🔍 View Opponent</button>

- <button>เริ่มแข่ง</button>
+ <button>Start Match</button>

- <button>Squad ({players.length})</button>
+ <button>Squad ({players.length})</button>

- <button>Matches ({seasonMatches.length})</button>
+ <button>Matches ({seasonMatches.length})</button>

- <button>⚙️ Tactics</button>
+ <button>⚙️ Tactics</button>

- <button>📋 Transfer History</button>
+ <button>📋 Transfer History</button>

- <h3>ผู้เล่นทั้งหมด</h3>
+ <h3>All Players</h3>

- <th>หมายเลข</th>
+ <th>#</th>

- <th>ชื่อ</th>
+ <th>Name</th>

- <th>ตำแหน่ง</th>
+ <th>Pos</th>

- <th>อายุ</th>
+ <th>Age</th>

- <th>ลง</th>
+ <th>Apps</th>

- <th>ประตู</th>
+ <th>Gls</th>

- <th>แอสซิสต์</th>
+ <th>Ast</th>

- <th>คะแนน</th>
+ <th>Rat</th>

- <th>ฟิต</th>
+ <th>Fit</th>

- <th>พลัง</th>
+ <th>Power</th>

- <button>จัดตัวอัตโนมัติ</button>
+ <button>Auto Select</button>

- <button>ล้างทั้งหมด</button>
+ <button>Clear All</button>
```

---

## 🛠️ Implementation Steps Per File

### For Each File:

1. **Backup**: Create git branch
2. **Thai → English**: Replace all Thai text
3. **Date Format**: Update `toLocaleDateString()` calls
4. **Design Consistency**:
   - Replace inline styles with utility classes
   - Use Card component wrapper
   - Use Button component for buttons
   - Apply consistent spacing
5. **Test**: Run `npm run build` and check page
6. **Commit**: Commit changes with clear message

---

## 🧪 Testing Strategy

### Per Page Testing Checklist:

- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All text displays in English
- [ ] Dates show in AD format (e.g., "March 17, 2026")
- [ ] Cards have consistent padding
- [ ] Buttons styled correctly
- [ ] Mobile responsive (test at 375px, 768px, 1024px)
- [ ] Desktop layout correct (1200px+)
- [ ] No visual regressions
- [ ] All interactions work (clicks, hovers, forms)

### Cross-Page Testing:

- [ ] Navigation works between all pages
- [ ] Breadcrumbs display correctly
- [ ] Sidebar highlights active page
- [ ] Date format consistent everywhere
- [ ] Color scheme consistent
- [ ] Typography consistent

---

## 📊 Priority Order

### Week 1: Core Experience
1. ✅ Foundation (globals.css, UI components)
2. ✅ Layout (Header, Sidebar, Breadcrumbs)
3. ✅ Home Page (dashboard)
4. ✅ Squad Page (most used feature)

### Week 2: Match Experience
5. ✅ Fixtures Page
6. ✅ Match Page
7. ✅ League Page
8. ✅ Team Page

### Week 3: Management Features
9. ✅ Players Page
10. ✅ Finances Page
11. ✅ Contracts Page
12. ✅ Training Page
13. ✅ Settings Page
14. ✅ Market Page
15. ✅ News Page
16. ✅ Rankings Page
17. ✅ Season Summary Page

---

## 🚀 Quick Start Commands

```bash
# 1. Create feature branch
git checkout -b feature/design-english-migration

# 2. Start dev server
npm run dev

# 3. After each file update, test
npm run build

# 4. Commit changes
git add .
git commit -m "Update [page]: English + AD dates + consistent design"

# 5. Push and create PR
git push origin feature/design-english-migration
```

---

## 📝 Translation Glossary

### Common Terms (Thai → English)

| Thai | English |
|------|---------|
| หน้าหลัก | Home |
| จัดการทีม | Squad |
| ตารางการแข่งขัน | Fixtures |
| ระบบลีก | League |
| ตลาดซื้อขาย | Market |
| ข่าวสาร | News |
| สรุปฤดูกาล | Season Summary |
| อันดับนักเตะ | Rankings |
| ค้นหานักเตะ | Players |
| การเงิน | Finances |
| สัญญา | Contracts |
| จำลองการแข่ง | Match |
| การฝึกซ้อม | Training |
| ตั้งค่า | Settings |
| ทีมปัจจุบัน | Current Team |
|คู่แข่ง | Opponent |
| เริ่มแข่ง | Start Match |
| ดูรายละเอียด | View Details |
| ทั้งหมด | All |
| ค้นหา | Search |
| กรอง | Filter |
| บันทึก | Save |
| ยกเลิก | Cancel |
| ยืนยัน | Confirm |
| กลับ | Back |
| ถัดไป | Next |
| ก่อนหน้า | Previous |
| กำลังโหลด | Loading |
| ไม่มีข้อมูล | No Data |
| ข้อผิดพลาด | Error |
| สำเร็จ | Success |

---

## ✅ Final Verification

### Before Merging:

- [ ] All 50+ files updated
- [ ] Zero Thai text remaining
- [ ] All dates in AD format
- [ ] Design consistent across all pages
- [ ] All tests passing
- [ ] No console errors
- [ ] Mobile responsive verified
- [ ] Desktop layout verified
- [ ] Performance acceptable
- [ ] Accessibility check passed

---

**Estimated Total Time**: 80-100 hours  
**Files to Update**: ~50  
**Components to Create**: 5-7  
**Lines of Code to Change**: ~5,000+

Let me know if you want me to start with Phase 1 (Foundation) and create the utility components!
