# Bug #001: Greeks API 400 Error - Date Format Mismatch

**Date Discovered**: July 13, 2025  
**Severity**: Critical  
**Status**: FIXED ✅

## The Bug

When fetching option Greeks after portfolio upload, all requests to the Polygon API were returning 400 (Bad Request) errors.

### Error Messages
```
Failed to fetch quote for IBIT 61 Jul-18-2025: Polygon API error: 400
Failed to fetch quote for IBIT 62 Aug-15-2025: Polygon API error: 400
Failed to fetch quote for IBIT 63 Aug-15-2025: Polygon API error: 400
```

## Root Cause

The portfolio-vision API was returning expiry dates in human-readable format:
- `"Jul-18-2025"`
- `"Aug-15-2025"`
- `"Dec-17-2027"`

But the Polygon API expects ISO date format:
- `"2025-07-18"`
- `"2025-08-15"`
- `"2027-12-17"`

## Why It Wasn't Caught in Testing

**Critical Testing Flaw**: The end-to-end test was using mock data with dates already in ISO format instead of using the actual portfolio-vision response. This meant the test passed even though the real application would fail.

```javascript
// BAD TEST - Used pre-formatted data
const testPositions = [
  { expiry: "2025-07-18", ... }  // Already in ISO format!
];
```

## The Fix

Added date format conversion in `TickerPriceSearch.tsx` before passing to Greeks fetcher:

```typescript
// Convert date format from "Jul-18-2025" to "2025-07-18"
const convertDateFormat = (dateStr: string): string => {
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  // Check if already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Convert from "Jul-18-2025" to "2025-07-18"
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthNum = months[parts[0]];
    if (monthNum) {
      return `${parts[2]}-${monthNum}-${parts[1].padStart(2, '0')}`;
    }
  }
  
  console.warn(`⚠️ [GREEKS] Unable to convert date format: ${dateStr}`);
  return dateStr;
};
```

## Lessons Learned

1. **End-to-end tests MUST use actual API responses**, not mock data
2. **Always log the exact data being sent to APIs** during development
3. **Date format conversions should be documented** in API integration points
4. **Test with real data flow** from start to finish

## Files Modified

- `/src/components/TickerPriceSearch.tsx` - Added date conversion logic (lines 662-693)
- `/test-end-to-end-greeks.cjs` - Fixed to show actual API response data

## How to Verify Fix

1. Upload portfolio image
2. Check browser console for: `📅 [GREEKS] Date conversion sample:`
3. Verify Greeks are fetched successfully (no 400 errors)
4. Check Performance tab shows real delta values and assignment probabilities

## Related Issues

- Portfolio-vision API may return different date formats
- Consider standardizing all date handling to ISO format throughout the app