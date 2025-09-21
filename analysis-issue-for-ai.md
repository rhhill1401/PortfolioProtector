# Option Position Display Issue - BOUGHT vs SOLD

## THE PROBLEMS (TWO SEPARATE ISSUES)

### ISSUE 1: DATA EXTRACTION PROBLEM
The portfolio-vision edge function is incorrectly extracting BOUGHT positions as SOLD. At least one PUT position should be BOUGHT but is coming back as SOLD.

### ISSUE 2: DISPLAY GROUPING PROBLEM
Even when data is correct (like the 34 CALL with positive contracts), it's being displayed in the wrong group.

## ACTUAL DATA FROM BACKEND
```javascript
positions: [
  {symbol: 'ETHA', type: 'CALL', strike: 36, expiry: '2025-10-17', contracts: -1},  // SOLD ✅
  {symbol: 'ETHA', type: 'PUT', strike: 30, expiry: '2025-10-17', contracts: -5},   // ❌ WRONG - should be BOUGHT (positive)
  {symbol: 'ETHA', type: 'PUT', strike: 33, expiry: '2025-10-17', contracts: -5},   // ❌ WRONG - should be BOUGHT (positive)
  {symbol: 'ETHA', type: 'CALL', strike: 35, expiry: '2025-10-24', contracts: -1},  // SOLD ✅
  {symbol: 'ETHA', type: 'CALL', strike: 36, expiry: '2025-10-24', contracts: -1},  // SOLD ✅
  {symbol: 'ETHA', type: 'CALL', strike: 34, expiry: '2025-12-19', contracts: 1},   // BOUGHT ✅ (positive!)
  {symbol: 'ETHA', type: 'CALL', strike: 40, expiry: '2025-12-19', contracts: -1},  // SOLD ✅
  {symbol: 'ETHA', type: 'CALL', strike: 40, expiry: '2027-12-17', contracts: -1},  // SOLD ✅
]
```

## WHAT'S DISPLAYED (MULTIPLE ISSUES)
1. All PUTs showing as "SOLD PUT" when some should be "BOUGHT PUT"
2. The 34 CALL (which correctly has contracts: 1) shows "BOUGHT CALL" label but appears in the SOLD section
3. No separation between BOUGHT and SOLD positions - everything grouped together

## KEY CODE - OptionPositionCard.tsx

This component correctly determines BOUGHT vs SOLD:
```typescript
// Line 85 - This is CORRECT
const displayDirection = position.contracts < 0 ? 'SOLD' : 'BOUGHT';

// Line 131 - This displays correctly
<span className="text-xs text-gray-500">
  {displayDirection} {position.type}  // Shows "BOUGHT CALL" or "SOLD CALL"
</span>
```

## THE ISSUE
The cards are being GROUPED wrong. The 34 CALL shows "BOUGHT CALL" in its label but appears under the "SOLD CALL" section.

## WHERE TO LOOK

1. **Find the grouping logic** - The component that groups positions into "Current Call Positions" and "Current Put Positions"
2. **The grouping should be based on**:
   - `position.contracts < 0` → SOLD group
   - `position.contracts > 0` → BOUGHT group
   - NOT just on position.type (CALL/PUT)

3. **Expected groups should be**:
   - SOLD CALLS (5 positions)
   - BOUGHT CALLS (1 position - the 34 strike)
   - SOLD PUTS (2 positions)

## FILES TO CHECK

### For ISSUE 1 (Data Extraction):
- `/supabase/functions/portfolio-vision/index.ts` - The AI prompt that reads screenshots
- The prompt includes rules for BOUGHT vs SOLD but the AI is still misreading the screenshot
- Lines 173-178 have the critical rules about contract signs

### For ISSUE 2 (Display Grouping):
- `/src/components/StockAnalysisV2.tsx` - Main display component
- `/src/components/TickerPriceSearch.tsx` - Where data processing happens
- Look for functions that group or filter positions
- Search for where "Current Call Positions" and "Current Put Positions" text is generated

## SOLUTIONS NEEDED

### Fix 1: Better Screenshot Reading
The portfolio-vision AI needs to better identify BOUGHT vs SOLD from the brokerage screenshot. Current rules say:
- Negative contracts = SOLD (you wrote/sold the option)
- Positive contracts = BOUGHT (you purchased the option)

But it's returning BOUGHT PUTs as negative contracts (SOLD).

### Fix 2: Proper Display Grouping
Find where positions are grouped and create 4 separate groups:
- BOUGHT CALLS (contracts > 0 AND type = 'CALL')
- SOLD CALLS (contracts < 0 AND type = 'CALL')
- BOUGHT PUTS (contracts > 0 AND type = 'PUT')
- SOLD PUTS (contracts < 0 AND type = 'PUT')

Currently it's only grouping by CALL vs PUT, ignoring BOUGHT vs SOLD.

## CURRENT DISPLAY OUTPUT (SHOWING THE BUG)
```
Current Call Positions
$36 CALL - shows "SOLD CALL" ✅
$34 CALL - shows "BOUGHT CALL" but in wrong group! ❌
$35 CALL - shows "SOLD CALL" ✅
...

Current Put Positions
$30 PUT - shows "SOLD PUT" but should be "BOUGHT PUT" ❌
$33 PUT - shows "SOLD PUT" but should be "BOUGHT PUT" ❌
```

## ENVIRONMENT
- Using StockAnalysisV2 component (feature flag enabled)
- Phase 1 client-side processing is working
- portfolio-vision edge function is deployed
- React + TypeScript + Vite

## CODE FILES NEEDED TO FIX THIS

### 1. For Display Grouping Issue - Find where positions are grouped/rendered
You need to look at:
- `/src/components/StockAnalysisV2.tsx` - The main component that displays the positions
- Search for where the positions array is being filtered or mapped
- Look for any code that groups positions by type (CALL/PUT)
- Find where "Current Call Positions" or "Current Put Positions" headers are rendered

### 2. The Working Card Component (for reference)
- `/src/components/cards/OptionPositionCard.tsx` - This correctly shows BOUGHT vs SOLD based on contract sign

### 3. Where the data comes from
- `/src/components/TickerPriceSearch.tsx` - Look for the dispatchLocalEyes function around line 1550-1650
- This is where positions are normalized and dispatched to StockAnalysisV2

### SPECIFIC CODE TO FIND AND FIX

Look for code that does something like this (WRONG):
```typescript
// WRONG - Only groups by type
const callPositions = positions.filter(p => p.type === 'CALL');
const putPositions = positions.filter(p => p.type === 'PUT');
```

And change it to this (CORRECT):
```typescript
// CORRECT - Groups by both type AND direction
const boughtCalls = positions.filter(p => p.type === 'CALL' && p.contracts > 0);
const soldCalls = positions.filter(p => p.type === 'CALL' && p.contracts < 0);
const boughtPuts = positions.filter(p => p.type === 'PUT' && p.contracts > 0);
const soldPuts = positions.filter(p => p.type === 'PUT' && p.contracts < 0);
```

### THE KEY INSIGHT
The positions are being grouped ONLY by type (CALL vs PUT) but need to be grouped by BOTH type AND direction (contracts > 0 vs contracts < 0).