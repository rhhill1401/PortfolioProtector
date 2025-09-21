# 📋 Implementation Spec: Deterministic-First Portfolio Analysis

## 🎯 Executive Summary
Transform the monolithic AI analysis flow into a **crash-proof, incremental system** where:
1. **Deterministic analysis runs immediately** after portfolio upload (client-side)
2. **Greeks fetch enriches data progressively** without blocking UI
3. **AI analysis becomes optional** and never blocks core functionality
4. **UI renders progressively** as each data layer arrives

## 🏗️ Architecture Changes

### Current (BROKEN)
```
Upload → Edge Function (60s timeout) → AI + Greeks + Everything → UI
         ↓ FAILS
         Timeout/Crash → Generic fallback → User frustration
```

### New (RESILIENT)
```
Upload → Deterministic (instant) → UI renders immediately
      ↓
      Greeks fetch (async) → Enriches UI
      ↓
      AI (optional later) → Additional insights
```

## 📁 Files to Create/Modify

### New Files (5 total)
1. `src/services/deterministic/types.ts` - Type definitions
2. `src/services/deterministic/analyze.ts` - Core strategy detection
3. `src/services/greeks/polygon.ts` - Greeks fetching service
4. `src/utils/analysisEvents.ts` - Event dispatching helpers
5. `scripts/gen-deterministic-json.ts` - Deno test harness

### Files to Modify (2 total)
1. `src/components/upload/PortfolioUpload.tsx` - Trigger deterministic analysis
2. `src/components/StockAnalysis.tsx` - Listen to events, progressive render

## 🔄 Implementation Phases

### Phase 1: Deterministic Analysis Module
**Files**: `types.ts`, `analyze.ts`, `gen-deterministic-json.ts`

**Functionality**:
- Parse portfolio positions and normalize option data
- Detect strategies (Bull Put Spread, Covered Call, etc.)
- Calculate premiums, risk levels, assignment probabilities
- Output structured JSON matching the successful Deno script format

**Key Logic** (reuse from existing `strategies.ts`):
```typescript
// Strategy detection with proper grouping
detectOptionStrategies(positions, shares, cash)
// Risk labeling based on delta/moneyness
labelRisk(position, currentPrice)
// Assignment probability calculation
assignmentProb(type, price, strike, delta)
```

### Phase 2: Greeks Integration
**Files**: `polygon.ts`

**Functionality**:
- Fetch Greeks from Polygon API (reuse existing setup)
- Build normalized keys: `SYMBOL-STRIKE-YYYY-MM-DD-TYPE`
- Merge Greeks into positions without blocking
- Handle rate limits (5 req/s) and failures gracefully

### Phase 3: Event System
**Files**: `analysisEvents.ts`

**Events**:
- `analysis:deterministic-ready` - Positions + strategies ready
- `analysis:greeks-ready` - Greeks merged into positions
- `analysis:ai-ready` - AI insights (future phase)

### Phase 4: UI Integration
**Files**: `PortfolioUpload.tsx`, `StockAnalysis.tsx`

**Changes**:
- Upload triggers deterministic analysis immediately
- StockAnalysis listens to events and updates progressively
- Remove dependency on edge function for initial render
- Display strategy cards with correct labels and premiums

## 📊 Data Structures

```typescript
export interface PositionDet {
  symbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;       // YYYY-MM-DD
  contracts: number;    // negative = short
  premium: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  currentValue?: number | null;
  daysToExpiry: number;
  term: 'SHORT_DATED' | 'LONG_DATED';
  assignmentProb: number | null;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface StrategySummary {
  id: string;
  label: string; // "Bull Put Spread", "Covered Call", etc.
  legCount: number;
  netPremium: number;
  maxProfit?: number;
  maxLoss?: number;
  riskProfile: 'defined' | 'covered' | 'undefined';
}

export interface DeterministicResult {
  ticker: string;
  currentPrice: number | null;
  shareCount: number;
  totalPremiumCollected: number;
  strategies: StrategySummary[];
  positions: PositionDet[];
  countsByLabel: Record<string, number>;
}
```

## 🧪 Test Strategy

### Unit Tests (Deno)
```bash
# Test with ETHA sample payload
deno run --allow-read --allow-env --allow-write scripts/gen-deterministic-json.ts scripts/sample-wheel-payload.json

# Expected output matches:
{
  "countsByLabel": {
    "Bull Put Spread": 1,
    "Covered Call": 4,
    "Bear Call Spread": 1
  },
  "strategies": [...],
  "totalPremiumCollected": 2364
}
```

### Integration Tests
1. Upload ETHA portfolio → See strategies immediately
2. Greeks arrive → Risk badges update
3. Disconnect network → Still see deterministic data

## ✅ Success Criteria

### Must Have (Phase 1)
- [ ] Strategy detection matches Deno script output exactly
- [ ] UI renders within 100ms of upload
- [ ] No crashes when Greeks/AI fail
- [ ] Correct strategy labels (no more "all Covered Call")
- [ ] Accurate premium calculations

### Should Have (Phase 2)
- [ ] Greeks enrich data without reload
- [ ] Risk badges show LOW/MEDIUM/HIGH
- [ ] Assignment probabilities display
- [ ] Performance < 500ms for 20 positions

### Nice to Have (Future)
- [ ] AI recommendations in separate tab
- [ ] Wheel execution guidance
- [ ] Advanced strategy recognition (Iron Condor, etc.)

## 🚨 Critical Implementation Rules

1. **NEVER dispatch undefined** - Always use empty arrays/0/empty strings
2. **Normalize consistently**:
   - Expiry: YYYY-MM-DD
   - Type: CALL/PUT (uppercase)
   - Contracts: negative = short
   - Symbol: uppercase
3. **Event order matters**:
   - deterministic-ready → greeks-ready → ai-ready
4. **Risk calculation priority**:
   - Use delta if available
   - Fallback to moneyness calculation
5. **No blocking operations** - Everything async except initial parse

## 🔧 Implementation Order

### Step 1: Build & Test Deterministic (Day 1)
1. Create types.ts with all interfaces
2. Port strategy detection to analyze.ts
3. Create Deno test script
4. Validate against ETHA sample

### Step 2: Wire Upload Path (Day 1-2)
1. Modify PortfolioUpload to call analyze()
2. Dispatch deterministic-ready event
3. Test UI receives event

### Step 3: Update UI Components (Day 2)
1. Modify StockAnalysis to listen to events
2. Remove edge function dependency
3. Render strategy cards immediately
4. Test with real portfolio upload

### Step 4: Add Greeks (Day 2-3)
1. Create polygon.ts service
2. Fetch and merge Greeks
3. Dispatch greeks-ready event
4. Verify UI enrichment

### Step 5: Polish & Deploy (Day 3)
1. Add error handling
2. Implement caching
3. Performance optimization
4. Deploy to production

## 🎉 Expected Outcome

Users will see:
- **Instant strategy recognition** after upload
- **Correct labels** (Bull Put Spread, not Covered Call)
- **Accurate premiums** and risk assessments
- **No more timeouts** or crashes
- **Progressive enhancement** as Greeks arrive

The system will be **resilient**, **fast**, and **accurate** - fixing the critical bug while improving overall UX.

## 📝 Implementation Notes

### Key Helpers to Port

**Date Normalizer** (MMM-DD-YYYY → YYYY-MM-DD):
```typescript
export function toYYYYMMDD(s: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
  if (!m) return s;
  const mon = {
    'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06',
    'Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12'
  }[m[1]];
  return mon ? `${m[3]}-${mon}-${m[2].padStart(2,'0')}` : s;
}
```

**Risk Labeling**:
```typescript
export function labelRisk(p: {
  type: 'CALL'|'PUT';
  strike: number;
  delta: number|null;
  price: number
}): 'LOW'|'MEDIUM'|'HIGH' {
  if (p.delta != null) {
    const a = Math.abs(p.delta);
    if (a >= 0.75) return 'HIGH';
    if (a >= 0.35) return 'MEDIUM';
    return 'LOW';
  }
  const m = p.type === 'CALL'
    ? (p.price - p.strike) / p.strike
    : (p.strike - p.price) / p.strike;
  if (m >= 0) return 'HIGH';
  if (m >= -0.03) return 'MEDIUM';
  return 'LOW';
}
```

**Assignment Probability**:
```typescript
export function assignmentProb(
  type: 'CALL'|'PUT',
  price: number,
  strike: number,
  delta: number|null
): number {
  if (delta != null) return Math.min(1, Math.max(0, Math.abs(delta)));
  const m = type === 'CALL'
    ? (price - strike)/strike
    : (strike - price)/strike;
  if (m >= 0.05) return 0.9;
  if (m >= 0.00) return 0.7;
  if (m >= -0.03) return 0.45;
  return 0.2;
}
```

### Environment Variables
- Client: `VITE_POLYGON_API_KEY` for Greeks fetching
- Edge (if needed later): `POLYGON_API_KEY` in Supabase dashboard
- API Key from tracker: `1ruAYGgS50FbzXUDxGZSVrnuxY2AVlE2`

### Test Payload Location
- `/scripts/sample-wheel-payload.json` - ETHA portfolio with 8 option positions
- Expected to detect: 1 Bull Put Spread, 4 Covered Calls, 1 Bear Call Spread

## 🚀 Next Steps

1. **Immediate**: Begin Phase 1 implementation with types.ts
2. **Today**: Complete deterministic analyzer and test with Deno
3. **Tomorrow**: Wire up UI integration and test end-to-end
4. **Day 3**: Add Greeks enrichment and polish