# 🎨 Football Manager - Design System Analysis & Consistency Guide

> **Complete analysis of every page, component, and styling pattern**  
> **Created**: March 17, 2026  
> **Purpose**: Ensure consistent look and feel across all pages

---

## 📋 Executive Summary

This document provides a **complete audit** of the Football Manager game's visual design, identifying:
- ✅ Current design patterns and conventions
- ⚠️ Inconsistencies across pages
- 🎯 Recommendations for unified styling
- 📐 Reusable component patterns

**Key Finding**: The project uses a **hybrid approach** with both `className` (Tailwind) and inline `style` attributes, leading to inconsistencies. This guide establishes the canonical design system.

---

## 🎨 Design System Foundations

### 1. Color Palette

#### CSS Variables (Defined in `globals.css`)

```css
:root {
  /* Primary Colors */
  --primary: #2563eb;          /* Blue - Main actions, links */
  --primary-rgb: 37, 99, 235;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;    /* Light blue backgrounds */

  /* Secondary Colors */
  --secondary: #64748b;        /* Gray - Secondary text */
  --accent: #f59e0b;           /* Amber - Highlights, special actions */

  /* Semantic Colors */
  --success: #10b981;          /* Green - Positive actions, money */
  --danger: #ef4444;           /* Red - Errors, negative actions */

  /* UI Elements */
  --border: #e2e8f0;           /* Light gray - Borders */
  --card-bg: #ffffff;          /* White - Card backgrounds */
  --muted: #94a3b8;            /* Gray - Muted text */

  /* Layout */
  --sidebar-bg: #1e293b;       /* Dark slate - Sidebar */
  --sidebar-text: #f1f5f9;     /* Light - Sidebar text */
  --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

#### Color Usage Guide

| Element | Color | Usage |
|---------|-------|-------|
| **Primary Buttons** | `var(--primary)` | Main CTAs, active states |
| **Secondary Buttons** | `var(--secondary)` | Cancel, back actions |
| **Accent Buttons** | `var(--accent)` | Special actions (Next Process) |
| **Success** | `#4caf50` | Money, positive stats |
| **Warning** | `#ff9800` | Caution, upcoming matches |
| **Danger** | `#dc2626` | Losses, errors, cards |
| **Background Gradient** | `linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)` | Hero sections |

---

### 2. Typography

#### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

#### Font Sizes

| Element | Desktop | Mobile | Weight |
|---------|---------|--------|--------|
| **Page Title (H1)** | 2.5rem (40px) | 1.75rem (28px) | 700-800 |
| **Section Title (H2)** | 1.75rem (28px) | 1.5rem (24px) | 600-700 |
| **Card Title (H3)** | 1.25rem (20px) | 1.1rem (18px) | 600 |
| **Body Text** | 1rem (16px) | 0.9rem (14px) | 400 |
| **Small Text** | 0.875rem (14px) | 0.8rem (13px) | 400 |
| **Caption** | 0.75rem (12px) | 0.7rem (11px) | 500 |

#### Line Heights
- **Headings**: 1.2
- **Body**: 1.5
- **Loose**: 1.6

---

### 3. Spacing System

#### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px (0.25rem) | Tight gaps |
| `sm` | 8px (0.5rem) | Small gaps |
| `md` | 16px (1rem) | Standard gaps |
| `lg` | 24px (1.5rem) | Section gaps |
| `xl` | 32px (2rem) | Large section gaps |
| `2xl` | 48px (3rem) | Page sections |

#### Page Padding
```css
--content-padding: 24px;  /* Desktop */
--content-padding: 20px;  /* Tablet (≤1024px) */
--content-padding: 16px;  /* Mobile (≤768px) */
--content-padding: 12px;  /* Small mobile (≤640px) */
```

---

### 4. Layout Structure

#### App Shell
```
┌─────────────────────────────────────────┐
│            Header (64px)                │
├─────────┬───────────────────────────────┤
│ Sidebar │                               │
│ (260px) │         Main Content          │
│         │         (flex-1)              │
│         │                               │
└─────────┴───────────────────────────────┘
```

#### Responsive Breakpoints
- **Desktop**: > 768px (md)
- **Tablet**: 641px - 768px
- **Mobile**: ≤ 640px

#### Container Max Width
```css
max-width: 1200px;
margin: 0 auto;
```

---

## 🧩 Component Patterns

### 1. Cards

#### Standard Card
```tsx
<div className="card">
  <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Title</h3>
  <p>Content...</p>
</div>
```

**CSS Definition**:
```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--card-shadow);
}
```

#### Card Variants

**Gradient Left Border**:
```tsx
<div className="card" style={{
  background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.1) 0%, rgba(13, 110, 253, 0.05) 100%)',
  borderLeft: '4px solid var(--primary)'
}}>
```

**Hero Card**:
```tsx
<div style={{
  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
  color: 'white',
  padding: '1.25rem',
  borderRadius: '16px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
}}>
```

---

### 2. Buttons

#### Base Button Class
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;  /* 10px 20px */
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  gap: 0.5rem;
  transition: all 0.2s ease;
}
```

#### Button Variants

**Primary**:
```tsx
<button className="btn btn-primary">
  Action
</button>
```
```css
.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-primary:hover {
  background: var(--primary-hover);
}
```

**Secondary**:
```tsx
<button className="btn btn-secondary" style={{ background: 'var(--secondary)' }}>
  Cancel
</button>
```

**Accent**:
```tsx
<button className="btn btn-primary" style={{ background: 'var(--accent)' }}>
  🏁 Next Process
</button>
```

**Small**:
```tsx
<button className="btn btn-sm" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
  View
</button>
```

**Full Width (Mobile)**:
```tsx
<button style={{ width: '100%' }} className="md:w-auto">
  Action
</button>
```

---

### 3. Forms & Inputs

#### Select Dropdown
```tsx
<select style={{
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'var(--foreground)',
  cursor: 'pointer'
}}>
  <option>Option 1</option>
</select>
```

#### Text Input
```tsx
<input
  type="text"
  placeholder="Search..."
  style={{
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '0.95rem'
  }}
/>
```

#### Form Label
```tsx
<label style={{
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: '600',
  marginBottom: '0.5rem'
}}>
  Label Text
</label>
```

---

### 4. Tables

#### Desktop Table
```tsx
<table style={{
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem'
}}>
  <thead>
    <tr style={{ borderBottom: '2px solid var(--border)' }}>
      <th style={{ padding: '12px', textAlign: 'left' }}>Header</th>
    </tr>
  </thead>
  <tbody>
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '12px' }}>Cell</td>
    </tr>
  </tbody>
</table>
```

#### Responsive Pattern
```tsx
{/* Desktop Table */}
<table className="hidden md:block">...</table>

{/* Mobile Cards */}
<div className="flex flex-col gap-2 md:hidden">
  {data.map(item => (
    <div className="card" style={{ padding: '12px' }}>
      <div style={{ fontWeight: '700' }}>{item.name}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.value}</div>
    </div>
  ))}
</div>
```

---

### 5. Badges & Tags

#### Badge Component
```tsx
<span style={{
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.25rem 0.75rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: '600',
  background: '#fbbf24',
  color: 'white'
}}>
  {count}
</span>
```

#### Badge Colors
- **Info**: `var(--primary)` (#2563eb)
- **Success**: `#4caf50`
- **Warning**: `#f59e0b`
- **Danger**: `#ef4444`

---

### 6. Navigation

#### Tab Navigation
```tsx
<div style={{
  display: 'flex',
  gap: '1rem',
  marginBottom: '2rem',
  borderBottom: '2px solid var(--border)',
  overflowX: 'auto'
}}>
  <button
    onClick={() => setActiveTab('tab1')}
    style={{
      padding: '12px 16px',
      background: 'none',
      border: 'none',
      borderBottom: activeTab === 'tab1' ? '3px solid var(--primary)' : 'none',
      cursor: 'pointer',
      fontWeight: activeTab === 'tab1' ? 'bold' : 'normal',
      color: activeTab === 'tab1' ? 'var(--primary)' : 'inherit'
    }}
  >
    Tab 1
  </button>
</div>
```

---

## 📄 Page-by-Page Analysis

### 1. Home Page (`/`)

#### Layout
- **Hero Section**: Gradient background with date selector
- **Stats Cards**: 3-column grid (Team, Finance, Upcoming Match)
- **League Table**: Left column (2/3 width)
- **Top Scorers**: Right column (1/3 width)
- **News Section**: Full width card
- **Recent Matches**: Grid of match cards

#### Key Styles
```tsx
// Hero gradient
background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)'

// Stats grid
gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'

// League table highlight rows
background: team.isUserTeam ? 'rgba(13, 110, 253, 0.1)' : 
            index < 3 ? 'rgba(76, 175, 80, 0.05)' : 
            index > 6 ? 'rgba(220, 38, 38, 0.05)' : 'transparent'
```

#### Inconsistencies Found
⚠️ **Issue**: League table uses inline styles instead of CSS classes
⚠️ **Issue**: Card links have inconsistent button styling

---

### 2. Squad Page (`/squad`)

#### Layout
- **Header**: Title + team info
- **Tab Navigation**: Squad | Matches | Tactics | Roles | Match Prep | Transfer
- **Content Area**: Dynamic based on active tab

#### Key Components
- **Player Cards**: Grid with suitability indicators
- **Formation Selector**: Dropdown with tactical positions
- **Tactics Form**: 3-tab form (Normal/Behind/Leading)

#### Key Styles
```tsx
// Tab navigation
borderBottom: activeTab === 'squad' ? '3px solid var(--primary)' : 'none'

// Player card
background: isUnavailable ? 'rgba(239, 68, 68, 0.1)' : 'white'

// Power indicator
color: getPowerColor(power)  // Returns green/yellow/orange/red
```

#### Inconsistencies Found
⚠️ **Issue**: Mixed use of `className` and `style` for same elements
⚠️ **Issue**: Some buttons use `btn-primary`, others use inline `background`

---

### 3. Fixtures Page (`/fixtures`)

#### Layout
- **Header**: Title + Season Selector
- **Team Filter**: Dropdown card
- **Match List**: Grouped by date

#### Key Styles
```tsx
// Match card
padding: '1rem',
background: 'white',
borderRadius: '12px',
border: '1px solid var(--border)',
boxShadow: '0 2px 4px rgba(0,0,0,0.02)'

// Score display
background: 'var(--sidebar-bg)',
color: 'white',
padding: '4px 12px',
borderRadius: '6px',
fontWeight: 'bold'
```

#### Inconsistencies Found
⚠️ **Issue**: Date headers use inline `color: 'var(--primary)'` inconsistently
⚠️ **Issue**: Match cards could be reusable components

---

### 4. Match Page (`/match`)

#### Layout
- **Match Selector**: Today's matches list
- **Match View**: Tabs (Stats | Events | Home | Away)
- **Player Cards**: Expandable with analytics

#### Key Styles
```tsx
// Player card expanded
background: 'rgba(37, 99, 235, 0.05)',
border: '1px solid var(--primary)',
borderRadius: '12px'

// Zone distribution chart
height: '24px',
borderRadius: '4px',
overflow: 'hidden'

// Action breakdown
gridTemplateColumns: 'repeat(4, 1fr)',
gap: '8px'
```

#### Inconsistencies Found
⚠️ **Issue**: Very long file (1818 lines) - should be split into components
⚠️ **Issue**: Inline console.log statements in production code
⚠️ **Issue**: Player analytics section has different styling than rest

---

### 5. League Page (`/league`)

#### Layout
- **Header**: Title + Season Selector
- **Table**: Desktop table view
- **Cards**: Mobile card view (responsive)

#### Key Styles
```tsx
// Table header
background: 'var(--sidebar-bg)',
color: 'white',
padding: '15px'

// Position badge
color: index === 0 ? 'var(--success)' : 'inherit',
fontWeight: index < 3 ? 'bold' : 'normal'

// Power indicator
color: 'var(--success)',
fontWeight: 'bold',
fontSize: '0.9rem'
```

#### Inconsistencies Found
⚠️ **Issue**: Table uses `15px` padding everywhere instead of spacing tokens
⚠️ **Issue**: Mobile cards have duplicated logic from desktop table

---

### 6. Players Page (`/players`)

#### Layout
- **Hero**: Gradient header with search
- **Filter Card**: Multi-field filter form
- **Results Table**: Paginated player list

#### Key Styles
```tsx
// Hero section
background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
color: 'white',
padding: '1.25rem',
borderRadius: '12px'

// Power color function
getPowerColor(power) {
  if (power >= 80) return '#4caf50';
  if (power >= 70) return '#8bc34a';
  if (power >= 60) return '#ffc107';
  if (power >= 50) return '#ff9800';
  return '#f44336';
}
```

#### Inconsistencies Found
⚠️ **Issue**: Filter grid uses `minmax(150px, 1fr)` vs `minmax(200px, 1fr)` elsewhere
⚠️ **Issue**: Pagination styling not consistent with other pages

---

### 7. Team Page (`/team/[id]`)

#### Layout
- **Header**: Team name + power
- **Tabs**: Squad | Matches | Tactics
- **Content**: Based on tab

#### Key Styles
```tsx
// Team power badge
background: 'var(--success)',
color: 'white',
padding: '4px 12px',
borderRadius: '6px',
fontWeight: 'bold'
```

---

### 8. Finances Page (`/finances`)

#### Layout
- **Header**: Team name + balance
- **Summary Cards**: Grid of financial metrics
- **Transaction List**: Table of events

---

### 9. Training Page (`/training`)

#### Layout
- **Facility Info**: Level + upgrade button
- **Slots Grid**: 5 training slots
- **Analytics**: Training history

---

## ⚠️ Identified Inconsistencies

### Critical Issues

#### 1. **Mixed Styling Approaches**
**Problem**: Some components use `className`, others use inline `style`, many use both.

**Example**:
```tsx
// Inconsistent
<div className="card" style={{ padding: '1.5rem' }}>...</div>

// Better
<div className="card card-padded">...</div>
```

**Solution**: Create utility CSS classes for common patterns.

---

#### 2. **Button Variants**
**Problem**: Multiple ways to style buttons.

**Found Patterns**:
```tsx
<button className="btn btn-primary">Action</button>
<button className="btn" style={{ background: 'var(--primary)' }}>Action</button>
<button style={{ padding: '8px 16px', background: 'var(--primary)' }}>Action</button>
```

**Solution**: Define all button variants in CSS, use only `className`.

---

#### 3. **Spacing Inconsistencies**
**Problem**: Same spacing written differently.

**Found**:
- `padding: '1rem'` (16px)
- `padding: '16px'` (16px)
- `padding: '1.5rem'` (24px)
- `padding: '24px'` (24px)

**Solution**: Use spacing tokens consistently.

---

#### 4. **Color Usage**
**Problem**: Same color defined multiple ways.

**Found**:
- `var(--primary)` 
- `#2563eb`
- `rgb(37, 99, 235)`

**Solution**: Always use CSS variables.

---

#### 5. **Card Styling**
**Problem**: Cards have different paddings and borders.

**Found**:
- `padding: '1rem'` (16px)
- `padding: '1.5rem'` (24px)
- `padding: '2rem'` (32px)

**Solution**: Standardize card padding to `1.5rem`.

---

### Medium Issues

#### 6. **Font Sizes**
**Problem**: Similar font sizes written differently.

**Found**:
- `fontSize: '0.9rem'`
- `fontSize: '0.95rem'`
- `className="text-sm"`

**Solution**: Define typography scale and stick to it.

---

#### 7. **Border Radius**
**Problem**: Inconsistent rounding.

**Found**:
- `borderRadius: '6px'`
- `borderRadius: '8px'`
- `borderRadius: '12px'`
- `borderRadius: '16px'`

**Solution**: Standardize:
- Small: 6px (buttons, inputs)
- Medium: 8px (cards, badges)
- Large: 12px (modals, hero)
- XL: 16px (special cards)

---

#### 8. **Shadow Inconsistency**
**Problem**: Some cards have shadows, others don't.

**Found**:
- `boxShadow: '0 2px 4px rgba(0,0,0,0.02)'`
- `boxShadow: 'var(--card-shadow)'`
- No shadow

**Solution**: Use `var(--card-shadow)` for all cards.

---

## 🎯 Recommendations

### Immediate Actions (Priority 1)

#### 1. **Create Utility CSS Classes**

Add to `globals.css`:

```css
/* Spacing utilities */
.p-xs { padding: 4px; }
.p-sm { padding: 8px; }
.p-md { padding: 16px; }
.p-lg { padding: 24px; }
.p-xl { padding: 32px; }

/* Gap utilities */
.gap-xs { gap: 4px; }
.gap-sm { gap: 8px; }
.gap-md { gap: 16px; }
.gap-lg { gap: 24px; }

/* Card variants */
.card-gradient-primary {
  background: linear-gradient(135deg, rgba(13, 110, 253, 0.1) 0%, rgba(13, 110, 253, 0.05) 100%);
  border-left: 4px solid var(--primary);
}

.card-gradient-success {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
  border-left: 4px solid #4caf50;
}

.card-gradient-warning {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%);
  border-left: 4px solid #ff9800;
}

/* Button variants */
.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-accent {
  background: var(--accent);
  color: white;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.8rem;
}

.btn-block {
  width: 100%;
}

/* Typography utilities */
.text-muted { color: var(--muted); }
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.text-primary { color: var(--primary); }

.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }

/* Responsive utilities */
@media (max-width: 768px) {
  .card-responsive {
    padding: 12px;
  }
}
```

---

#### 2. **Create Reusable Components**

**`src/components/ui/Card.tsx`**:
```tsx
interface CardProps {
  variant?: 'default' | 'gradient-primary' | 'gradient-success' | 'gradient-warning';
  children: React.ReactNode;
  className?: string;
}

export function Card({ variant = 'default', children, className = '' }: CardProps) {
  const variantClasses = {
    'default': '',
    'gradient-primary': 'card-gradient-primary',
    'gradient-success': 'card-gradient-success',
    'gradient-warning': 'card-gradient-warning'
  };

  return (
    <div className={`card ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
```

**`src/components/ui/Button.tsx`**:
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  onClick,
  disabled = false
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    fullWidth ? 'btn-block' : ''
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
```

---

#### 3. **Standardize Existing Components**

Update these files to use new utilities:
- `src/components/TacticsForm.tsx` → Use `Card` and `Button` components
- `src/components/PlayerModal.tsx` → Standardize spacing
- `src/components/MatchPrepForm.tsx` → Use consistent form styling

---

### Medium-Term Actions (Priority 2)

#### 4. **Refactor Large Pages**

Split these files:
- `src/app/match/page.tsx` (1818 lines) → Extract player cards, analytics
- `src/app/squad/SquadClient.tsx` (1318 lines) → Extract tabs as components
- `src/app/players/page.tsx` (790 lines) → Extract filter form

---

#### 5. **Create Design Token File**

`src/lib/designTokens.ts`:
```tsx
export const colors = {
  primary: '#2563eb',
  secondary: '#64748b',
  accent: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  // ...
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px'
};

export const typography = {
  h1: { fontSize: '2.5rem', fontWeight: '800' },
  h2: { fontSize: '1.75rem', fontWeight: '700' },
  h3: { fontSize: '1.25rem', fontWeight: '600' },
  body: { fontSize: '1rem', fontWeight: '400' },
  small: { fontSize: '0.875rem', fontWeight: '400' }
};
```

---

#### 6. **Add Storybook (Optional)**

For component documentation and testing.

---

## 📐 Canonical Patterns

### The Right Way to Style Common Elements

#### 1. Page Header
```tsx
<div style={{
  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
  color: 'white',
  padding: '1.25rem',
  borderRadius: '16px',
  marginBottom: '2rem'
}}>
  <h1 style={{ margin: 0, fontSize: '2rem' }}>Page Title</h1>
  <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Subtitle</p>
</div>
```

#### 2. Stats Grid
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '1.5rem',
  marginBottom: '2rem'
}}>
  <Card variant="gradient-primary">
    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Title</h4>
    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Value</div>
  </Card>
  {/* More cards... */}
</div>
```

#### 3. Data Table
```tsx
<div className="card" style={{ padding: 0, overflow: 'hidden' }}>
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead style={{ background: 'var(--sidebar-bg)', color: 'white' }}>
      <tr>
        <th style={{ padding: '15px', textAlign: 'left' }}>Header</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, index) => (
        <tr key={item.id} style={{
          borderBottom: '1px solid var(--border)',
          background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
        }}>
          <td style={{ padding: '15px' }}>{item.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

#### 4. Tab Navigation
```tsx
<div style={{
  display: 'flex',
  gap: '1rem',
  marginBottom: '2rem',
  borderBottom: '2px solid var(--border)',
  overflowX: 'auto'
}}>
  {tabs.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      style={{
        padding: '12px 16px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
        cursor: 'pointer',
        fontWeight: activeTab === tab.id ? 'bold' : 'normal',
        color: activeTab === tab.id ? 'var(--primary)' : 'inherit'
      }}
    >
      {tab.label}
    </button>
  ))}
</div>
```

#### 5. Filter Form
```tsx
<div className="card">
  <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🎯 Filters</h3>
  
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  }}>
    <div>
      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        Field Name
      </label>
      <input
        type="text"
        placeholder="Search..."
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          fontSize: '0.95rem'
        }}
      />
    </div>
    {/* More fields... */}
  </div>
  
  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
    <Button variant="secondary">Reset</Button>
    <Button variant="primary">Apply</Button>
  </div>
</div>
```

---

## 📊 Canonical Table Styles (Updated March 2026)

### League Table - Cool Style Pattern

This is the **approved table style** used in the Home page league table.

```tsx
{/* Desktop League Table */}
<table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
  <thead>
    <tr style={{ borderBottom: '2px solid var(--border)' }}>
      <th className="text-center" style={{ padding: '12px', width: '50px', fontWeight: 'bold' }}>Pos</th>
      <th style={{ padding: '12px', fontWeight: 'bold' }}>Club</th>
      <th className="text-center" style={{ padding: '12px', width: '50px' }}>P</th>
      <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--success)', fontWeight: 'bold' }}>W</th>
      <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--accent)' }}>D</th>
      <th className="text-center" style={{ padding: '12px', width: '50px', color: 'var(--danger)' }}>L</th>
      <th className="text-center" style={{ padding: '12px', width: '70px' }}>GD</th>
      <th className="text-center" style={{ padding: '12px', width: '60px', fontWeight: 'bold', fontSize: '1rem' }}>Pts</th>
    </tr>
  </thead>
  <tbody>
    {data.map((item, index) => (
      <tr key={item.id} style={{
        borderBottom: '1px solid var(--border)',
        background: item.isUserTeam ? 'rgba(13, 110, 253, 0.1)' : 
                  index < 3 ? 'rgba(76, 175, 80, 0.05)' : 
                  index > data.length - 4 ? 'rgba(220, 38, 38, 0.05)' : 'transparent'
      }}>
        <td className="text-center" style={{ 
          padding: '10px', 
          fontWeight: index < 3 ? 'bold' : 'normal', 
          color: index === 0 ? 'var(--success)' : 'inherit' 
        }}>{index + 1}</td>
        <td style={{ padding: '10px' }}>
          <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {item.name}
            {item.isUserTeam && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>👑</span>}
          </div>
        </td>
        <td className="text-center" style={{ padding: '10px' }}>{item.played}</td>
        <td className="text-center" style={{ padding: '10px', color: 'var(--success)', fontWeight: 'bold' }}>{item.wins}</td>
        <td className="text-center" style={{ padding: '10px', color: 'var(--accent)' }}>{item.draws}</td>
        <td className="text-center" style={{ padding: '10px', color: 'var(--danger)' }}>{item.losses}</td>
        <td className="text-center" style={{ padding: '10px' }}>{item.goalDiff > 0 ? '+' : ''}{item.goalDiff}</td>
        <td className="text-center" style={{ padding: '10px', fontWeight: 'bold', fontSize: '1.05rem' }}>{item.points}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Key Style Points**:
- Header: `padding: 12px`, `borderBottom: 2px solid var(--border)`
- Body rows: `padding: 10px`, `borderBottom: 1px solid var(--border)`
- Column widths: Pos/P/L/D (50px), GD (70px), Pts (60px)
- Color coding: Wins (green), Draws (amber), Losses (red)
- Row highlighting: Top 3 (light green), User team (light blue), Relegation (light red)
- Points column: Bold, larger font (1.05rem)
- First position: Green color

### Mobile Table Cards

```tsx
<div className="md:hidden flex flex-col gap-2">
  {data.map((item, index) => (
    <div
      key={item.id}
      className="card"
      style={{
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        background: item.isUserTeam
          ? 'rgba(13, 110, 253, 0.1)'
          : index < 3
            ? 'rgba(76, 175, 80, 0.05)'
            : index > data.length - 4
              ? 'rgba(220, 38, 38, 0.05)'
              : 'transparent'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
          #{index + 1} {item.name}
          {item.isUserTeam && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}>👑</span>}
        </div>
        <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>{item.points} Pts</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
        <div>P: <strong style={{ color: 'var(--foreground)' }}>{item.played}</strong></div>
        <div>W: <strong style={{ color: 'var(--success)' }}>{item.wins}</strong></div>
        <div>D: <strong style={{ color: 'var(--accent)' }}>{item.draws}</strong></div>
        <div>L: <strong style={{ color: 'var(--danger)' }}>{item.losses}</strong></div>
      </div>
    </div>
  ))}
</div>
```

---

## ✅ Checklist for Consistency

### Before Merging Any Page/Component

- [ ] Uses `var(--*)` CSS variables for colors (not hex codes)
- [ ] Uses spacing tokens (xs, sm, md, lg, xl) consistently
- [ ] Card padding is `1.5rem` (24px) unless有特殊 reason
- [ ] Buttons use `.btn` classes (not inline styles)
- [ ] Typography follows scale (H1: 2.5rem, H2: 1.75rem, H3: 1.25rem)
- [ ] Border radius consistent (6px/8px/12px/16px)
- [ ] Mobile responsive (uses `md:` breakpoints)
- [ ] No hardcoded pixel values (use rem where possible)
- [ ] No console.log in production code
- [ ] Component extracted if > 500 lines

---

## 📚 Related Files

- `src/app/globals.css` - Base styles and CSS variables
- `src/components/AppShell.tsx` - Layout wrapper
- `src/components/Header.tsx` - Top navigation
- `src/components/Sidebar.tsx` - Side navigation
- `src/components/TacticsForm.tsx` - Form pattern example
- `MASTER_DEVELOPMENT_GUIDE.md` - Overall development guide

---

## 🎯 Next Steps

1. **Week 1**: Add utility CSS classes to `globals.css`
2. **Week 2**: Create `Card` and `Button` reusable components
3. **Week 3**: Refactor Home, Squad, Fixtures pages to use new components
4. **Week 4**: Refactor Match, League, Players pages
5. **Week 5**: Add TypeScript types for all components
6. **Week 6**: Create Storybook documentation (optional)

---

**Goal**: Achieve 100% visual consistency across all pages while maintaining the current aesthetic and improving code maintainability.
