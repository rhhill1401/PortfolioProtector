# Integrated-Analysis-V3 Implementation Spec (REVISED)
## Client-Side First, Progressive Enhancement Architecture

### ⚠️ CRITICAL ARCHITECTURE CHANGE
**We are NOT creating edge functions for Phase 1-2!** Everything runs client-side for instant display.

### 🎯 Vision
Create a CLIENT-SIDE analysis system that shows positions and strategies immediately without any edge function calls, then progressively enhances with Greeks and AI recommendations.

### 🧪 Testing Portfolio-Vision Edge Function

**ALWAYS USE THIS TEST** when working with portfolio-vision:
```bash
# Test with ETHA ticker (default)
node tests/edge-functions/test-portfolio-vision.cjs

# Test with specific ticker
node tests/edge-functions/test-portfolio-vision.cjs IBIT
```

**Test Details:**
- **Script Location:** `tests/edge-functions/test-portfolio-vision.cjs`
- **Image Source:** Automatically reads latest PNG from `/Users/Killmunger/Documents/examples-portfolio/`
- **For ETHA:** Uses portfolio screenshot with "5.43.04" in filename
- **Output:** Saves to `tests/outputs/portfolio-vision-[ticker]-[timestamp].json`
- **Credentials:** Reads from `.env.local`

**Understanding Contract Signs:**
- **Negative contracts** (e.g., -5) = SOLD/SHORT positions (you wrote/sold the option)
- **Positive contracts** (e.g., 5) = BOUGHT/LONG positions (you purchased the option)
- The "M" suffix in screenshots (e.g., "5 M") is just a display marker
- The AI reads the exact Quantity column text - if no minus sign, it's positive

### 🏗️ Architecture Overview

```
Data Flow:
1. Upload → portfolio-vision (existing) → Positions JSON
2. CLIENT-SIDE Calculator → Display positions + strategies immediately
3. Edge Function for Greeks (Weather) → Enhance with risk labels
4. Edge Function for AI (Coach) → Add recommendations

Key Points:
- Phase 1-2: Pure client-side (no new edge functions)
- Phase 3: Edge function for Greeks only (protect API keys)
- Phase 4: Edge function for AI only
- Uses StockAnalysisV2 component (enabled via flag)
```

### 📋 Implementation TODO List

## Phase 1: Eyes Module (CLIENT-SIDE) ✅ COMPLETED

### ❌ What We Did Wrong
- Created `integrated-analysis-v3` edge function (should NOT exist yet)
- Routed through edge function unnecessarily
- This caused empty positions in UI

### ✅ What We Should Do
- [x] Enable StockAnalysisV2 flag
- [x] Create `/src/services/deterministic/eyes.ts` (CLIENT-SIDE)
- [x] Parse portfolio-vision response directly in StockAnalysisV2
- [x] Display OptionPositionCards immediately (no edge function)
- [x] Test with ETHA portfolio screenshot
- [x] Verify cards display without any edge function calls

## Phase 2: Calculator Module (CLIENT-SIDE) 🚧 IN PROGRESS

- [ ] Create `/src/services/deterministic/calculator.ts`
- [ ] Implement strategy detection (CLIENT-SIDE):
  - [ ] Covered calls (shares + sold calls)
  - [ ] Bull spreads (bought low strike + sold high strike)
  - [ ] Cash secured puts (sold puts with cash)
  - [ ] Wheel phase detection
- [ ] Create StrategyCard component
- [ ] Display strategy cards immediately after position cards
- [ ] Add unit tests for strategy detection
- [ ] NO EDGE FUNCTION - all client-side math

## Phase 3: Weather Module (Greeks via Edge Function) 📅 PLANNED

- [ ] Create `/supabase/functions/option-greeks/index.ts`
- [ ] Create `/src/services/greeks/fetcher.ts` (client)
- [ ] Implement batch Greeks fetching
- [ ] Add 15-minute cache in edge function
- [ ] Progressively update risk labels when Greeks arrive
- [ ] Update assignment probability from delta
- [ ] Handle API failures gracefully

## Phase 4: Coach Module (AI via Edge Function) 💭 FUTURE

- [ ] Create `/supabase/functions/integrated-analysis-v3/index.ts` (NOW it exists)
- [ ] Send computed positions + strategies to AI
- [ ] Generate recommendations
- [ ] Fill Wheel Execution tab
- [ ] Add Action Plan section
- [ ] Cache responses for 30 minutes

---

## 🔄 Migration Path

### Current State (WRONG)
```typescript
// TickerPriceSearch.tsx
const endpoint = useV3 ? 'integrated-analysis-v3' : 'integrated-analysis';
// This is WRONG for Phase 1!
```

### Target State (CORRECT)
```typescript
// StockAnalysisV2.tsx
useEffect(() => {
  // Listen for portfolio-vision results
  window.addEventListener('portfolio-ready', (e) => {
    // CLIENT-SIDE processing
    const positions = eyes.parsePositions(e.detail);
    const strategies = calculator.detectStrategies(positions);

    // Display immediately!
    setPositions(positions);
    setStrategies(strategies);

    // Then enhance with Greeks (Phase 3)
    weather.fetchGreeks(positions).then(enriched => {
      setPositions(enriched);
    });
  });
}, []);
```

## 📊 Data Models

### Position (from portfolio-vision)
```typescript
interface RawPosition {
  symbol: string;
  optionType?: 'CALL' | 'PUT';
  strike?: number;
  expiry?: string;
  contracts?: number;
  premium?: number;
  shares?: number;
}
```

### Normalized Position (client-side)
```typescript
interface NormalizedPosition {
  symbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;  // YYYY-MM-DD
  contracts: number;  // negative = SOLD
  premium: number;

  // Calculated client-side
  daysToExpiry: number;
  term: 'SHORT_DATED' | 'LONG_DATED';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';  // from moneyness

  // Added in Phase 3
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  iv?: number;
}
```

### Strategy (client-side detection)
```typescript
interface Strategy {
  type: 'COVERED_CALL' | 'BULL_SPREAD' | 'CASH_SECURED_PUT';
  legs: NormalizedPosition[];
  netPremium: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
}
```

## 🧪 Test Plan

### Phase 1 Test (CLIENT-SIDE ONLY)
1. Upload ETHA screenshot
2. portfolio-vision extracts positions
3. StockAnalysisV2 receives data
4. OptionPositionCards display IMMEDIATELY
5. NO integrated-analysis-v3 call
6. Console shows: "Positions displayed: 4"

### Phase 2 Test (STILL CLIENT-SIDE)
1. After positions display
2. Strategy cards appear showing:
   - Bull Put Spread detected
   - Covered Calls detected
3. NO edge function calls yet
4. Console shows: "Strategies detected: 2"

### Phase 3 Test (FIRST EDGE FUNCTION)
1. After positions + strategies display
2. Greeks fetch begins
3. Risk badges update from "LOW" to actual delta-based
4. Assignment % appears
5. Console shows: "Greeks enhanced: 4 positions"

### Phase 4 Test (AI EDGE FUNCTION)
1. All above complete
2. AI recommendations appear in sidebar
3. Wheel Execution tab fills
4. Action Plan populates

## ❗ Common Mistakes to Avoid

1. **DON'T** create edge functions for Phase 1-2
2. **DON'T** wait for API responses to show positions
3. **DON'T** block UI while fetching Greeks
4. **DO** show data incrementally as it arrives
5. **DO** handle failures gracefully (show what we have)

## 🚀 Success Criteria

- **Phase 1**: Positions display in < 100ms after portfolio-vision completes
- **Phase 2**: Strategies display in < 50ms after positions
- **Phase 3**: Greeks enhance labels within 2-3 seconds
- **Phase 4**: AI recommendations within 5-10 seconds

## 📝 Notes

- The `integrated-analysis-v3` edge function created earlier should be DELETED or repurposed for Phase 4 only
- StockAnalysisV2 is the correct component to use (not original StockAnalysis)
- All deterministic math happens client-side for speed
- Edge functions only for API key protection (Greeks) and AI
