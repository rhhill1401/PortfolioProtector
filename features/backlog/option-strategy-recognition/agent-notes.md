# Agent Notes: Option Strategy Recognition Feature

## Feature-Specific Context

This feature fixes a **CRITICAL BUG** where all option positions are incorrectly labeled as "Covered Call" regardless of actual strategy type.

## Key Files to Modify

### Backend
- `/supabase/functions/integrated-analysis-v2/index.ts` - Line 702 has hardcoded "Covered Call"
- Create new: `/supabase/functions/integrated-analysis-v2/strategyDetector.ts`

### Frontend
- `/src/components/StockAnalysis.tsx` - Lines 1495-1504 check for "Covered Call"
- Create new: `/src/types/strategies.ts`

## Test Data Examples

### Bull Put Spread (Currently Broken)
- User has: Short $30 put (5 contracts) + Long $33 put (-5 contracts)
- Currently shows as: Two separate "Covered Calls" ❌
- Should show as: "Bull Put Spread" with max loss $297 ✓

### Covered Call (Currently Works)
- User has: 800 shares + Short $36 call (-1 contract)
- Currently shows as: "Covered Call" ✓
- Should show as: "Covered Call" ✓

## Implementation Gotchas

1. **Contract Signs Matter**:
   - Negative = SHORT position (sold)
   - Positive = LONG position (bought)
   - NEVER use Math.abs() without preserving direction

2. **Premium Calculations**:
   - Spreads need NET premium (received - paid)
   - Single legs need GROSS premium
   - Formula: premium × 100 × |contracts|

3. **Risk Assessment**:
   - Spreads have DEFINED risk (max loss calculable)
   - Naked options have UNDEFINED risk
   - Covered positions have COVERED risk

## Phase-Specific Notes

### Phase 2 (Backend)
- Start with `strategyDetector.ts`
- Test with curl using example data below
- Log detection results for debugging

### Phase 3 (Frontend)
- Update type displays first
- Then update calculations
- Finally update risk indicators

## Test Commands

### Test Backend Detection
```bash
# After implementing strategyDetector
curl -X POST http://localhost:54321/functions/v1/integrated-analysis-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "ETHA",
    "portfolio": {
      "metadata": {
        "optionPositions": [
          {"symbol": "ETHA", "strike": 30, "optionType": "PUT", "contracts": 5},
          {"symbol": "ETHA", "strike": 33, "optionType": "PUT", "contracts": -5}
        ]
      }
    }
  }'
```

## Common Strategies to Detect

1. **Bull Put Spread**: Short put + Long put (lower strike)
2. **Bear Call Spread**: Short call + Long call (higher strike)
3. **Covered Call**: Short call + 100 shares per contract
4. **Cash-Secured Put**: Short put + cash to cover
5. **Iron Condor**: Bull put spread + Bear call spread
6. **Naked Options**: No coverage

## Success Validation

When complete, this query should show "Bull Put Spread":
```sql
-- Pseudo query for validation
SELECT type FROM positions
WHERE ticker = 'ETHA'
AND strikes = '30/33'
-- Should return: "Bull Put Spread" not "Covered Call"
```

## Related Documentation
- [User Story](./user-story.md)
- [Technical Spec](./spec.md)
- [Implementation Plan](./implementation-plan.md)
- Parent bug report: `/docs/bugs-and-fixes/008-option-strategy-recognition-bug.md` (create this)

## Questions for User
1. Should we support calendar spreads (different expiries)?
2. How to display partially closed spreads?
3. Priority order for strategy detection?

## Notes from User Feedback
- "It's showing inaccurate premiums like it's not right"
- "These are not covered calls, but it's labeled them as covered calls"
- "AI should be able to recognize what is a covered call vs a regular call"
- Bull put spread showing as "HIGH RISK" when it's defined risk