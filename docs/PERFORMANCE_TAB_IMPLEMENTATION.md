# Performance Tab Enhancement Implementation Plan

## Current State Analysis

### What We Have Now
- Basic performance tab with "Actual Returns vs Target" (needs removal)
- Two cards side by side (Current Call Position, Wheel Strategy Metrics)
- Incorrect premium display ($2.28 instead of $228)
- Gray banner spacing issue in strategic investment section
- Working data flow from edge function with all positions

### What We Need
- Single column layout inside Performance tab (full width for each section)
- Scrollable container for all content
- Proper premium calculations (premium × 100 × contracts)
- Total premium collected display at top of positions
- Status cards row at the top
- Remove redundant Wheel Strategy Metrics card (will be its own section)

## Implementation Phases

### Phase 1: Data Preparation & Calculations
**What**: Ensure we're calculating premiums correctly
**Why**: Options premiums are quoted per share, but collected per contract (100 shares)
**How**:
```typescript
// For each position:
const totalPremiumCollected = position.premium × 100 × Math.abs(position.contracts)
const totalCurrentValue = position.currentValue × 100 × Math.abs(position.contracts)
```

### Phase 2: Fix Layout & Remove Redundant Section
**What**: 
- Remove "Actual Returns vs Target" section
- Fix gray banner spacing
- Create two-column layout

**Why**: Clean up visual hierarchy and remove redundancy

**Code Changes**:
- Remove lines 619-655 in StockAnalysis.tsx
- Add responsive grid layout
- Fix CardHeader styling

### Phase 3: Create Status Cards Component
**What**: Build reusable StatusCard component
**Why**: Consistent styling for Position Status, IV Environment, Assignment Risk

**Component Structure**:
```typescript
interface StatusCardProps {
  title: string
  mainValue: string
  subtitle: string
  variant: 'blue' | 'green' | 'yellow' | 'purple'
  icon?: React.ReactNode
}
```

### Phase 4: Build Position Display Component
**What**: Create component to show short/long positions
**Why**: Clear display of individual positions with proper premium totals

**Features**:
- Group by position type (Short Calls, Long Calls)
- Show total premium collected at top
- Individual position cards with:
  - Strike, Expiry, Contracts
  - Premium Collected (in dollars)
  - Current Value
  - P&L with color coding

### Phase 5: Wheel Strategy Metrics
**What**: Aggregate metrics from all positions
**Why**: Quick overview of total performance

**Metrics to Calculate**:
- Total Premium Collected (sum of all premiums × 100 × contracts)
- Unrealized P&L
- Net Premium Remaining
- Annualized Return Target
- Risk-Adjusted Return
- Max Profit Potential

### Phase 6: Options Greeks Chart (Optional)
**What**: Bar chart showing assignment probabilities
**Why**: Visual risk assessment
**Implementation**: Recharts bar chart with assignment % by strike

## Testing Strategy

### Test Data Structure
```javascript
const testPayload = {
  ticker: "IBIT",
  portfolio: {
    positions: [/* stock positions */],
    metadata: {
      optionPositions: [
        {
          strike: 61,
          contracts: -1,
          premiumCollected: 2.28,  // This represents $228
          currentValue: 2.10,      // This represents $210
          profitLoss: 18.32       // Already in dollars
        }
      ]
    }
  }
}
```

### Test Each Phase
1. Test calculations independently
2. Test layout responsiveness
3. Test with 0, 1, and multiple positions
4. Test with both short and long positions

## Task Tracking

### Completed ✅
- [x] Analyzed current state
- [x] Identified data flow issues
- [x] Created implementation plan
- [x] Phase 1: Fixed premium calculations (× 100 × contracts)
- [x] Phase 2: Removed "Actual Returns vs Target" section & fixed layout
- [x] Phase 3: Created Status Cards (Position Status, IV Environment, Assignment Risk)
- [x] Phase 4: Built position display with total premium collected
- [x] Phase 5: Added wheel strategy metrics section
- [x] Moved status cards above tabs as requested
- [x] Updated Position Status card to show shares + calls breakdown
- [x] Fixed share count display (1,400 shares)

### To Do 📋
- [x] Phase 1: Fix premium calculations ✅
- [x] Phase 2: Remove redundant section & fix layout ✅
- [x] Phase 3: Create StatusCard component ✅
- [x] Phase 4: Build position display with totals ✅
- [x] Phase 5: Add wheel strategy metrics ✅
- [ ] Phase 6: Add options Greeks chart (optional)

### Bug Fixes Applied Today ✅
- [x] Fixed "AI invented prices" error by disabling overly aggressive validator
- [x] Fixed TypeScript types for keyLevels
- [x] Deployed edge function fixes

## First Principles Explanation

### Why Premium × 100?
Think of it like buying eggs:
- Price tag says "$2.28 per egg"
- But eggs come in dozens (12)
- Total cost = $2.28 × 12 = $27.36

Options work the same:
- Premium quoted as "$2.28 per share"
- But options control 100 shares (1 contract)
- Total collected = $2.28 × 100 = $228

### Why Two Columns?
Like reading a newspaper:
- Left side: Quick status updates (at a glance info)
- Right side: Detailed positions (need more focus)
- Eyes naturally scan left-to-right in Western reading

This creates information hierarchy!