# Wheel P&L Patch Implementation

## Problem Statement
The current P&L calculation shows only mark-to-market losses/gains, which doesn't reflect the true wheel strategy profitability. Wheel traders need two perspectives:

1. **Mark-to-market P&L** (paper gains/losses)
2. **Wheel strategy net profit** (real profit if assigned)

## Solution: Two P&L Metrics

### 1. optionMTM (Mark-to-Market)
```
Formula: (premiumCollected - currentValue) × |contracts|
Purpose: Day-to-day paper gain/loss tracking
Display: Small gray text (transparency only)
```

### 2. wheelNet (Strategy Profit)
```
Formula: (strike - costBasis) × 100 × |contracts| + premiumCollected
Purpose: Real profit if leg assigns or rolls for net credit
Display: Large bold text (green if positive, red if negative)
```

## Example Calculation
For IBIT $63 CALL with -4 contracts, cost basis $59:

**optionMTM**: (1232.28 - 2404) × 4 = **-$4,686.88** (mark-to-market loss)
**wheelNet**: (63 - 59) × 100 × 4 + 1232.28 = **$2,832.28** (wheel profit)

The trader doesn't care about the mark-to-market loss because the wheel strategy is profitable!

## Implementation Plan

### Backend Changes
1. Update `calcOptionMetrics` in `integrated-analysis/index.ts`
2. Extract cost basis from `portfolio.positions[].purchasePrice`
3. Calculate both optionMTM and wheelNet
4. Return both values in JSON response

### Frontend Changes
1. Display `wheelNet` as main P&L figure (large, bold, colored)
2. Show `optionMTM` as secondary gray text
3. Keep existing card layout (no redesign)

### Data Flow
```
Portfolio Image → Portfolio-Vision → Cost Basis + Option Data → 
Integrated-Analysis → Calculate optionMTM & wheelNet → 
Frontend → Display wheelNet prominently
```

## Testing Requirements
1. End-to-end test with real portfolio image
2. Verify cost basis extraction (should be $59 for IBIT)
3. Confirm both metrics calculated correctly
4. Check UI displays wheelNet prominently, optionMTM as gray
5. Ensure no existing functionality broken

## Success Criteria
- ✅ Both optionMTM and wheelNet calculated correctly
- ✅ UI shows wheelNet as main metric (bold, colored)
- ✅ optionMTM shown as secondary gray text
- ✅ No breaking changes to existing functionality
- ✅ End-to-end test passes with real data