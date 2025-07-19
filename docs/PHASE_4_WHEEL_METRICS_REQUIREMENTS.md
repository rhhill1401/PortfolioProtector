# Phase 4: Fix Wheel Strategy Metrics

## Overview
The Wheel Strategy Metrics card currently shows placeholder values instead of real calculations. This phase will connect the actual portfolio data and option quotes to display accurate metrics.

## Current Issues (From Screenshot)

### 1. Total Premium Collected: $0
- **Expected**: $16,219 (sum of all premiumCollected from option positions)
- **Root Cause**: Component not receiving or calculating premium data
- **Fix**: Sum premiumCollected from all option positions in analysis data

### 2. Unrealized P&L: "Loading..."
- **Expected**: Calculated value based on current market prices
- **Root Cause**: useWheelQuotes hook not completing or data not connected
- **Fix**: Calculate from option positions' current values vs premium collected

### 3. Cost to Close: "Loading..."
- **Expected**: Total cost to buy back all short positions at current prices
- **Root Cause**: Live quotes not being fetched or processed
- **Fix**: Sum current values of all short positions

### 4. Max Profit Potential: $0.00
- **Expected**: Maximum profit if all positions expire worthless
- **Root Cause**: Calculation not implemented
- **Fix**: Total premium collected (if all expire worthless)

### 5. Next 30-45% Wheel Opportunity
- **Current**: Hardcoded "IBIT $72 CALL 2025-08-15"
- **Expected**: Dynamically calculated optimal strike
- **Fix**: Calculate strike at 30-45% above current price with optimal DTE

### 6. Assignment Probability: 8%
- **Current**: Static value
- **Expected**: Based on actual delta values from Greeks
- **Fix**: Use weighted average of deltas from all positions

## Implementation Strategy

### Step 1: Debug Data Flow
1. Add console logs to trace data from StockAnalysis → Wheel Metrics component
2. Verify analysis prop contains:
   - positions array with premiumCollected
   - optionGreeks data
   - current stock price

### Step 2: Fix Premium Calculation
```typescript
const totalPremium = analysis.positions
  .filter(p => p.optionType)
  .reduce((sum, pos) => sum + (pos.premiumCollected || 0), 0);
```

### Step 3: Connect Live Quotes
1. Debug useWheelQuotes hook
2. Ensure it receives correct position data
3. Calculate unrealized P&L and cost to close from quotes

### Step 4: Implement Dynamic Calculations
1. Max Profit = Total Premium Collected
2. Unrealized P&L = Premium Collected - Current Cost to Close
3. Assignment Probability = Weighted average of position deltas

### Step 5: Calculate Next Wheel Opportunity
1. Get current stock price
2. Calculate 30-45% above current
3. Find nearest strike and expiration
4. Display with expected premium

## Key Files to Modify
1. `/src/components/StockAnalysis.tsx` - Main display component
2. `/src/hooks/useWheelQuotes.ts` - Live quote fetching
3. `/src/services/wheelMath.ts` - Calculation functions

## Testing Requirements
1. Upload portfolio with option positions
2. Verify all metrics display real values
3. No "Loading..." or $0 placeholders
4. Dynamic updates when data changes

## Success Criteria
- Total Premium shows actual sum (e.g., $16,219)
- P&L calculations update in real-time
- Next opportunity calculated dynamically
- Assignment probability based on real Greeks
- All values formatted properly (no decimals for dollars)