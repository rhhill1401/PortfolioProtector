# Bug #002: Portfolio-Vision Changes Output Format with Dashes

**Date Discovered**: July 19, 2025  
**Severity**: Medium  
**Status**: Documented for Later Fix

## The Bug

When portfolio images contain dashes (--) for cost basis, portfolio-vision changes how it returns premium values:
- **With normal cost basis**: Returns total premium (e.g., `premiumCollected: 228.32`)
- **With dashes (--)**: Returns per-share premium (e.g., `premiumCollected: 3.08`)

This causes the frontend to display incorrect total premium ($62 instead of $16,219).

## Example

### Normal Portfolio (with cost basis):
```json
{
  "symbol": "IBIT",
  "strike": 61,
  "contracts": -1,
  "premiumCollected": 228.32,  // Total premium
  "averageCostBasis": 59.09    // Has real cost basis
}
```

### Portfolio with Dashes:
```json
{
  "symbol": "IBIT", 
  "strike": 63,
  "contracts": -4,
  "premiumCollected": 3.08,    // Per-share premium!
  "averageCostBasis": "--"      // Dashes in screenshot
}
```

## Impact

1. Total premium shows as $62 instead of $16,219
2. P&L calculations use current price instead of cost basis
3. But system doesn't crash (main issue fixed)

## Temporary Workaround

Use portfolio images without dashes for accurate calculations.

## Permanent Fix (Phase 4)

Update frontend to:
1. Detect if premium is per-share (<$50) or total
2. Multiply by 100 × contracts if needed
3. Handle both formats gracefully

## Related Issues

- Phase 4: Fix Wheel Strategy Metrics will address this
- Edge case: only happens with incomplete broker data
- User typically has complete data (dashes are rare)