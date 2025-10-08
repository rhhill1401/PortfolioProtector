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
Client Event Timeline
┌───────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐
│ Local Eyes    │→│ Determinist │→│ Weather (EF) │→│ Coach Orchestr│
│ (portfolio)   │ │ Calculator  │ │ Greeks in BG │ │ (EF, modular) │
└───────────────┘  └────────────┘  └─────────────┘  └──────────────┘
      │                    │               │                 │
      │  UI cards render   │  Strategies   │  Risk badges    │  Wheel/roll/action
      ▼                    ▼               ▼                 ▼

Key Principles
- Keep option/strategy cards instant via client-only phases.
- Run Greeks (`option-greeks` edge function) asynchronously; merge deltas on arrival.
- Rewrite integrated-analysis-v3 as a thin orchestrator that delegates to focused coach modules (wheel execution, roll decisions, action plan).
- Each coach module may be its own helper or edge function, but the orchestrator returns a single JSON envelope for the UI.
- All prompts, retries, and caching live inside the edge function layer so secrets stay server-side.
```

**Progressive UX:** Option and strategy cards render instantly from deterministic data. Greeks enhance risk labels asynchronously, and coach modules run in the background so Wheel Execution / Roll Decisions / Action Plan tabs stay accessible with loaders until AI responses arrive.

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

## Phase 2: Calculator Module (CLIENT-SIDE) ✅ COMPLETED

- [x] Create `/src/services/deterministic/calculator.ts`
- [x] Implement strategy detection (CLIENT-SIDE):
  - [x] Covered calls (shares + sold calls)
  - [x] Bull call spreads (long lower strike + short higher strike)
  - [x] Bull put spreads (short higher strike + long lower strike)
  - [x] Cash secured puts (sold puts with cash)
  - [x] Wheel phase detection
- [x] **Number Display Formatting**: Round ALL monetary values to nearest whole dollar
  - [x] StrategyCard displays rounded-up values (Net Premium / Max P/L)
  - [x] Calculator keeps decimals internally; UI rounds on render
  - [x] Apply round-up to Breakeven and other metrics
- [x] Create StrategyCard component (risk‑tinted background; accessible contrast)
- [x] Display strategy cards immediately after option position cards
- [x] Add header toggle to switch between Current Positions and Detected Strategies (default: Positions)
- [x] Show Breakeven in StrategyCard metrics
- [x] Covered Call metrics use cost basis: Max Profit, Max Loss (to $0), Breakeven
- [x] Breakeven metric includes tooltip (basis − credit per share)
- [x] Current Option Positions: hide Premium and Wheel P&L for BOUGHT calls/puts
- [x] Current values display as whole dollars; small per‑share decimals are shown ×100 with rounding
- [x] Add unit tests for strategy detection
- [x] NO EDGE FUNCTION - all client-side math

### Phase 2 Status Notes

- The StrategyCard is implemented and now rounds up dollar values for display only, matching the presentation rule.
- Risk tint mapping now matches OptionPositionCard (LOW=green, MEDIUM=amber, HIGH=red) with ≥4.5:1 contrast.
- Deterministic calculator detects: Covered Calls, Bull Call Spreads, and Cash‑Secured Puts; it also derives Wheel Phase.
- Bull Put Spread detection is implemented; ETHA 30P/33P credit spread is recognized with credit, max loss, and breakeven.
- Strategy view toggle sits in the Current Option Positions card header; OFF shows Positions, ON shows Strategies.
- Covered Calls calculate with actual average cost basis from portfolio-vision when available; otherwise fall back to current price.
- StrategyCard shows Breakeven when available (Covered, CSP, Bull spreads) with tooltip explaining basis − credit/share; otherwise displays "—".
- Current Option Positions: Wheel P&L is only shown for SOLD positions; BOUGHT calls/puts show real P&L using portfolio-vision profitLoss when available.
- Added unit tests validating Covered Call (basis-aware), Bull Call Spread, Bull Put Spread, and Cash-Secured Put metrics including breakeven outputs and basis fallback.

## Phase 2.5: Portfolio Extraction & Advanced Strategy Detection 🏗️ IN PROGRESS

**Priority:** HIGH - Fixes core accuracy issues affecting all downstream analysis

### **Problem Statement**
Current Issues:
1. **Portfolio-vision AI** sometimes misreads contract signs (SOLD vs BOUGHT)
2. **Strategy detection** only handles simple patterns (covered calls, bull spreads)
3. **Complex strategies** not detected: ratio spreads, butterflies, same-strike grouping
4. **Multiple positions** at same strike/expiry treated as separate (e.g., -2 contracts shown as 2 separate -1s)

### **Root Causes Identified**
- Vision AI struggles with small text, negative signs in Quantity column
- `calculator.ts` only detects 4 strategy types (covered calls, bull call/put spreads, CSPs)
- No logic to group positions by expiration + analyze strike patterns
- No validation UI to catch extraction errors before analysis

---

### Sub-Phase 2.5a: Enhanced Portfolio-Vision Extraction ✅ COMPLETED

**File:** `supabase/functions/portfolio-vision/index.ts`

- [x] Add "SAME STRIKE GROUPING" instruction to AI prompt
- [x] Enhance quantityText extraction with visual examples in prompt
- [x] Add validation step: re-read Quantity column for positions with confidence < HIGH
- [x] Implement multi-pass extraction for positions with >1 contract
- [x] Add extraction confidence scoring per position (HIGH/MEDIUM/LOW)
- [x] Test with real IBIT/ETHA screenshots (6+ positions, multiple same-strike)

**Success Criteria:** ✅ ALL MET
- Contract sign accuracy: 100% (target: 95%+)
- Same-strike grouping: 100% (IBIT $70 Nov-21 shows -2, ETHA $50 shows -2)
- Confidence scoring: All positions have directionConfidence: "HIGH"
- All 13 positions detected (was missing 3 before)

**Testing Results:**
```bash
node tests/edge-functions/test-portfolio-vision.cjs IBIT
# ✅ Verified: IBIT $70 Nov-21 shows single position with contracts: -2
# ✅ Verified: ETHA $50 Dec-17 shows single position with contracts: -2
# ✅ Verified: All 7 IBIT positions detected across different strikes/expirations
```

---

### Sub-Phase 2.5b: Advanced Strategy Detection (Client-Side) 🏗️ IN PROGRESS

**File:** `src/services/deterministic/calculator.ts`

**Phase 2.5b Implementation Checklist:**
- [x] Implement `detectCallRatioSpreads()` in calculator.ts
- [x] Fix detection priority order (complex strategies first)
- [x] Test with IBIT portfolio (+1 $60C, +1 $70C, -1 $80C Jan-16)
- [x] Run code review on changes
- [ ] User verification in browser (PENDING)

**New Detection Functions:**

- [x] `detectCallRatioSpreads()` - Detect 2:1, 3:1, 3:2 long:short call ratios
  - Pattern: Multiple long calls + fewer short calls, same expiry
  - Example: +1 $60C, +1 $70C, -1 $80C = 2:1 ratio spread
  - Calculate: Net premium, max loss (debit), unlimited upside
  - **Status**: ✅ IMPLEMENTED - Detects IBIT 2:1 ratio spread correctly

- [ ] `detectPutRatioSpreads()` - Same as calls, but for puts
  - Pattern: Multiple long puts + fewer short puts, same expiry

- [ ] `detectCallButterflies()` - Long wing + short body + long wing
  - Pattern: +1 lower strike, -2 middle strike, +1 higher strike
  - Example: +1 $60C, -2 $70C, +1 $80C

- [ ] `detectIronCondors()` - Bull put spread + bear call spread
  - Pattern: +1 put low, -1 put mid-low, -1 call mid-high, +1 call high

- [ ] `detectCalendarSpreads()` - Same strike, different expirations
  - Pattern: +1 $70C Jan, -1 $70C Nov (same strike, different dates)

- [ ] `detectMultiStrikeGroups()` - Group by expiration, analyze strikes
  - Groups all positions by expiry date
  - Analyzes strike patterns within each group
  - Calls appropriate strategy detector based on pattern

**Enhanced Existing Functions:**

- [ ] Update `detectCoveredCalls()` to handle multiple contracts per strike
  - Currently: Treats -2 contracts as 2 separate positions
  - Fix: Group by strike+expiry, sum contracts

**Dynamic Strategy Detection Algorithm:**
```typescript
// Pseudo-code (no hardcoding)
function detectStrategies(positions: Position[]): Strategy[] {
  const strategies: Strategy[] = [];

  // Group by expiration
  const byExpiry = groupByExpiration(positions);

  // For each expiry group, detect patterns
  byExpiry.forEach(group => {
    // Try ratio spreads
    strategies.push(...detectRatioSpreads(group));

    // Try butterflies
    strategies.push(...detectButterflies(group));

    // Try vertical spreads
    strategies.push(...detectVerticalSpreads(group));
  });

  // Cross-expiry strategies
  strategies.push(...detectCalendarSpreads(positions));
  strategies.push(...detectDiagonalSpreads(positions));

  return strategies;
}
```

**Unit Tests:**

- [ ] Add test for call ratio spread (2:1, 3:1 ratios)
- [ ] Add test for put ratio spread
- [ ] Add test for butterfly
- [ ] Add test for iron condor
- [ ] Add test for calendar spread
- [ ] Add test for same-strike grouping (-2 contracts)
- [ ] Add test with IBIT real portfolio data (6 positions, ratio spread)

**Testing:**
```bash
npm run test:unit
# Verify: All new strategy patterns detected correctly
# Verify: No false positives (random positions not grouped)
```

---

### Sub-Phase 2.5c: Strategy Validation Dashboard (Optional - Phase 5 candidate)

**File:** `src/components/StrategyValidation.tsx` (NEW)

**Features:**
- [ ] Show raw portfolio-vision extraction JSON
- [ ] Display AI confidence scores per position
- [ ] Allow manual override of contract signs (toggle SOLD ↔ BOUGHT)
- [ ] Preview detected strategies BEFORE running full analysis
- [ ] "Looks correct?" confirmation button
- [ ] Save corrections to local storage for future uploads

**UX Flow:**
1. User uploads portfolio screenshot
2. portfolio-vision extracts positions
3. StrategyValidation component shows preview:
   - "Found 6 positions: 2 BOUGHT calls, 4 SOLD calls"
   - "Detected strategies: Covered Calls (4), Call Ratio Spread (1)"
   - Confidence badges (HIGH/LOW) per position
4. User confirms or corrects
5. Analysis proceeds with validated data

**Why This Helps:**
- Catch misreads immediately (no wasted analysis time)
- Build trust in AI extraction accuracy
- Learn from corrections (future prompt improvements)

**Decision:** Move to Phase 5 (polish) unless accuracy remains < 90% after 2.5a/2.5b

---

### Sub-Phase 2.5d: Data Model Updates

**Files:** `src/services/deterministic/types.ts`, `src/types/analysis.ts`

- [ ] Add `StrategyType` enum with new strategy types:
  ```typescript
  type StrategyType =
    | 'COVERED_CALL'
    | 'CASH_SECURED_PUT'
    | 'BULL_CALL_SPREAD'
    | 'BULL_PUT_SPREAD'
    | 'BEAR_CALL_SPREAD'
    | 'BEAR_PUT_SPREAD'
    | 'CALL_RATIO_SPREAD'
    | 'PUT_RATIO_SPREAD'
    | 'CALL_BUTTERFLY'
    | 'PUT_BUTTERFLY'
    | 'IRON_CONDOR'
    | 'CALENDAR_SPREAD'
    | 'DIAGONAL_SPREAD';
  ```

- [ ] Update `StrategySummary` interface to include:
  ```typescript
  interface StrategySummary {
    id: string;
    type: StrategyType;
    label: string;
    legCount: number;
    legs: PositionDet[];
    netPremium: number;
    maxProfit: number | 'UNLIMITED';
    maxLoss: number | 'UNLIMITED';
    breakeven: number | number[]; // can be multiple breakevens
    riskProfile: 'covered' | 'defined' | 'undefined';
    expiryGroup?: string; // ISO date for expiry-based grouping
  }
  ```

---

### Testing & Validation Plan

**Test Portfolio Requirements:**
- Use REAL screenshots (no hardcoded data)
- Test with multiple tickers (IBIT, ETHA, TSLA, etc.)
- Include edge cases:
  - Multiple same-strike positions (-2 contracts)
  - Complex strategies (ratio spreads, butterflies)
  - Mixed expirations (short-term + long-term)
  - 10+ positions

**Acceptance Criteria:**
| Metric | Target | Current |
|--------|--------|---------|
| Contract sign accuracy | ≥95% | ~80% |
| Simple strategy detection | 100% | 100% |
| Complex strategy detection | ≥90% | 0% |
| Same-strike grouping | 100% | 0% |
| False positive rate | <5% | Unknown |

**Test Checklist:**
- [ ] Upload IBIT screenshot → detects 6 positions (not 8)
- [ ] Verify -2 $70 Nov calls shown as single position
- [ ] Detect call ratio spread (+1 $60C, +1 $70C, -1 $80C)
- [ ] Detect 4 covered calls correctly
- [ ] No false strategies detected
- [ ] Upload ETHA screenshot → detects bull put spread
- [ ] Upload portfolio with butterfly → detects correctly
- [ ] Upload portfolio with 15+ positions → all grouped correctly

---

### Implementation Order (Priority Queue)

**Week 1: Core Fixes (Highest ROI)**
1. Sub-Phase 2.5a: Portfolio extraction enhancements (2 hours)
2. Sub-Phase 2.5b: Ratio spread detection (3 hours)
3. Sub-Phase 2.5b: Same-strike grouping fix (1 hour)
4. Testing with IBIT/ETHA screenshots (1 hour)

**Week 2: Advanced Detection**
5. Sub-Phase 2.5b: Butterfly detection (2 hours)
6. Sub-Phase 2.5b: Calendar spread detection (2 hours)
7. Sub-Phase 2.5d: Data model updates (1 hour)
8. Unit tests for all new detectors (3 hours)

**Week 3: Polish (Optional)**
9. Sub-Phase 2.5c: Validation dashboard (6 hours)
10. Integration testing with 10+ real portfolios (2 hours)

**Total Estimated Time:** 23 hours (can be split into smaller PRs)

---

### Success Metrics

**Before Phase 2.5:**
- Strategy detection: 4 types (covered call, bull spread, bear spread, CSP)
- Extraction accuracy: ~80%
- Complex strategies: 0% detection rate

**After Phase 2.5:**
- Strategy detection: 13+ types (all common multi-leg strategies)
- Extraction accuracy: ≥95%
- Complex strategies: ≥90% detection rate
- User trust: Validation dashboard allows manual verification

**Blocker for Phase 3?**
- No - Phase 3 (Greeks) can proceed with current extraction
- However, Phase 2.5 ensures Greeks are applied to correct positions
- Recommended: Complete 2.5a + 2.5b (core fixes) before Phase 3

---

### Documentation Updates

- [ ] Update CLAUDE.md with new strategy types
- [ ] Add examples to implementation-spec.md showing ratio spread detection
- [ ] Document common misreads and how to fix them
- [ ] Add troubleshooting guide for portfolio uploads

---

### Phase 2.5 Status Notes

**Current Status:** IN PROGRESS

**Completed:**
- None yet

**In Progress:**
- Planning and specification complete
- Ready to begin implementation

**Next Steps:**
1. Start with Sub-Phase 2.5a (portfolio extraction enhancements)
2. Test extraction accuracy improvements
3. Move to Sub-Phase 2.5b (ratio spread detection)

**Notes:**
- **NO HARDCODING**: All detection is pattern-based, works with any portfolio
- **DYNAMIC**: Supports any number of positions, any strikes, any expirations
- **TESTABLE**: Unit tests ensure no regressions
- **PROGRESSIVE**: Can implement incrementally (ratio spreads first, butterflies later)
- **BACKWARD COMPATIBLE**: Existing strategy detection still works

This phase addresses the root cause of why "every AI seems to not detect the right strategy" - we're fixing both the extraction layer (portfolio-vision) and the interpretation layer (calculator.ts).

---

## Phase 3: Weather Module (Greeks via Edge Function) ✅ COMPLETED

- [x] Create `/supabase/functions/option-greeks/index.ts`
- [x] Create `/src/services/greeks/fetcher.ts` (client)
- [x] Implement batch Greeks fetching
- [x] Add 15-minute cache in edge function
- [x] Progressively update risk labels when Greeks arrive
- [x] Update assignment probability from delta
- [x] Handle API failures gracefully

### Phase 3 Status Notes

- `option-greeks` edge function batches Polygon snapshot calls, caches results for 15 minutes, and returns keyed greeks maps.
- Client fetcher consolidates requests, caches locally, and dispatches `analysis:greeks-ready` events for progressive UI updates.
- `TickerPriceSearch` includes Greeks in analysis payloads and fires events for both local deterministic flow and edge-function flow.
- StockAnalysisV2 merges Greeks into wheel positions, updating delta/gamma/theta/vega/IV, recalculating risk badges, and surfacing assignment probability.
- Option cards now compute risk tiers using delta (≥0.75 high, ≥0.35 medium, else low) with moneyness fallback when Greeks are missing.
- API failures yield warning logs but do not block deterministic data, preserving Phase 1/2 behavior offline.

### Out of Scope moved here (future strategy detection/enrichment)
- Bear spreads (Bear Call Spread, Bear Put Spread)
- Calendars and diagonals
- Iron Condors and Butterflies
- Straddles and Strangles
- Multi‑leg synthetic constructions (e.g., covered strangle)

## 🎓 RECOMMENDATIONS SYSTEM (A-F Grading) - SEPARATE WORKSTREAM ✅ Phase 1 Complete

**Location:** `supabase/functions/integrated-analysis-v3/`

**Purpose:** Provide portfolio-wide A-F grading with upgrade recommendations using GPT-5 reasoning model

**Architecture:** Edge function with modular graders → scenario analysis → AI recommendations

### Phase 1: Folder Structure & Types ✅ COMPLETED (2025-01-05)

**Files Created:**
- ✅ `types/recommendations.ts` - All TypeScript interfaces (140 lines)
- ✅ `coach/graders/coverage.ts` - Coverage grader stub
- ✅ `coach/graders/income.ts` - Income grader stub
- ✅ `coach/graders/risk.ts` - Risk grader stub
- ✅ `coach/graders/upside.ts` - Upside grader stub
- ✅ `coach/graders/sophistication.ts` - Sophistication grader stub
- ✅ `coach/scenario.ts` - Scenario analysis calculator stub
- ✅ `coach/prompts/recommendations.ts` - GPT-5 system/user prompts
- ✅ `coach/recommendations.ts` - Main orchestrator (throws error until Phase 2-5 complete)
- ✅ `clients/openai.ts` - GPT-5 client with retry logic, reasoning output
- ✅ `index.ts` - Edge function entry point
- ✅ `deno.json` - OpenAI dependency config

**Key Decisions:**
- ✅ Default model: `gpt-5-preview` (via `OPENAI_MODEL` env var)
- ✅ Scenario levels: -30%, -15%, 0%, +15%, +30%, +50%, +100% (spec-compliant)
- ✅ Orchestrator throws error (prevents misleading F/0% grades during development)
- ✅ All graders return F/0% stubs (Phase 2 will implement real logic)

**Lint Status:** 0 errors, 138 warnings (3 new in v3 files, all acceptable)

### Phase 2: Pure Grader Functions with Tests ✅ COMPLETED

**Goal:** Implement all 5 graders with real logic + 5+ unit tests each

**Checklist:**
- [x] Implement `gradeCoverage()` - How well shares are covered with options ✅ COMPLETED
  - [x] Write 5+ unit tests (14 tests created)
  - [x] Run tests, verify 100% pass ✅ 14/14 passing
- [x] Implement `gradeIncome()` - Premium yield and theta decay efficiency ✅ COMPLETED
  - [x] Write 5+ unit tests (19 tests created)
  - [x] Run tests, verify 100% pass ✅ 19/19 passing
- [x] Implement `gradeRisk()` - Naked positions, unlimited risk, assignment risk ✅ COMPLETED
  - [x] Write 5+ unit tests (17 tests created)
  - [x] Run tests, verify 100% pass ✅ 17/17 passing
- [x] Implement `gradeUpside()` - Unlimited profit potential, uncapped gains ✅ COMPLETED
  - [x] Write 5+ unit tests (19 tests created)
  - [x] Run tests, verify 100% pass ✅ 19/19 passing
- [x] Implement `gradeSophistication()` - Strategy complexity (basic → advanced) ✅ COMPLETED
  - [x] Write 5+ unit tests (22 tests created)
  - [x] Run tests, verify 100% pass ✅ 22/22 passing

**Testing:** `npx vitest run tests/unit/recommendations/graders/` (91 tests passing: 14 coverage + 19 income + 17 risk + 19 upside + 22 sophistication)

### Phase 3: Scenario Analysis Calculator ✅ COMPLETED

- [x] Implement `calculateScenario()` - P/L at specific price level ✅ COMPLETED
- [x] Calculate intrinsic value for calls/puts ✅ COMPLETED
- [x] Calculate portfolio value (shares + options) ✅ COMPLETED
- [x] Write unit tests with IBIT data (7 price levels) ✅ COMPLETED
- [x] Verify breakeven, profit, loss, max profit status labels ✅ COMPLETED

**Testing:** `npx vitest run tests/unit/recommendations/scenario.test.ts` (22 tests passing)

**Total Tests:** 113 tests passing (91 grader tests + 22 scenario tests)

### Phase 4: OpenAI GPT-5 Client ✅ DOCUMENTED (Manual Testing Pending)

- [x] Review `callOpenAI()` implementation ✅ COMPLETED
- [x] Document testing procedures ✅ COMPLETED
- [ ] Test `callOpenAI()` with simple prompt (requires OPENAI_API_KEY secret)
- [ ] Verify JSON mode works (requires deployment)
- [ ] Verify reasoning output logging (model-dependent)
- [ ] Test retry logic with mock failures (unit test created)
- [ ] Test timeout handling (manual test documented)

**Testing Guide:** `tests/edge-functions/test-openai-client.md`

**Implementation Status:**
- Client wrapper exists and is well-implemented
- Retry logic with exponential backoff (2s, 4s, 8s)
- Timeout handling via AbortController
- JSON mode enabled for structured output
- Reasoning metadata logging (GPT-5 models only)

**Manual Testing Required:**
- Deploy test function to Supabase
- Run tests 4.1-4.5 from testing guide
- Verify all 5 test cases pass

**Note:** OPENAI_API_KEY is already configured in Supabase (used by portfolio-vision). Manual testing can be done anytime by deploying a test function.

### Phase 5: Prompts & Recommendations Orchestrator ✅ COMPLETED

- [x] Implement data extraction from input ✅ COMPLETED
- [x] Wire all graders with real data ✅ COMPLETED
- [x] Wire scenario analysis with real data ✅ COMPLETED
- [x] Parse GPT-5 JSON response ✅ COMPLETED
- [x] Write integration test with IBIT portfolio ✅ COMPLETED

**Files Updated:**
- `coach/recommendations.ts` - Full orchestrator implementation
- `tests/edge-functions/test-integrated-analysis-v3.cjs` - Integration test script

**Implementation Details:**
- ✅ RecommendationsInput interface defines expected payload
- ✅ Data extraction for all 5 graders
- ✅ Weighted overall score calculation (Coverage 25%, Income 20%, Risk 25%, Upside 20%, Sophistication 10%)
- ✅ Scenario analysis for 7 price levels
- ✅ GPT-5 prompt building with grades and scenarios
- ✅ **Resilient AI parsing**: Try/catch around JSON.parse with markdown code fence stripping
- ✅ **Runtime type validation**: `validateAIResponse()` checks structure before trusting AI data
- ✅ **Graceful degradation**: Returns deterministic grades/scenarios even if AI fails
- ✅ **Error logging**: Logs raw AI response (first 500 chars) when parsing fails
- ✅ **Type safety**: Replaced `any` with `RecommendationsAIResponse` interface
- ✅ **shareBasis fallback**: Defaults to currentPrice if missing (prevents NaN in scenarios)

### Phase 6: Main Edge Function & Deploy ✅ COMPLETED

- [x] Uncomment orchestrator imports ✅ COMPLETED
- [x] Remove error-throwing code ✅ COMPLETED
- [x] Wire `generateRecommendations()` with real data ✅ COMPLETED
- [x] Add input validation ✅ COMPLETED
- [x] Add detailed logging ✅ COMPLETED
- [x] Create integration test script ✅ COMPLETED
- [x] Add resilient AI parsing with graceful degradation ✅ COMPLETED
- [x] Deploy to Supabase ✅ COMPLETED
- [x] Run integration test ✅ COMPLETED

**Deployment Results:**
- ✅ Deployed successfully in 8.92s
- ✅ All 12 files uploaded (index, types, graders, scenario, prompts, client)
- ✅ Integration test passed with A- overall grade (93/100)
- ✅ All 5 graders working correctly
- ✅ Scenario analysis accurate (-30% to +100%)
- ✅ AI recommendations generated successfully
- ✅ All 13 validation checks passed

**Test Output Example (IBIT Covered Call Portfolio):**
- Coverage: A- (92/100) - 5 covered calls detected
- Income: A+ (100/100) - $925 premium collected
- Risk: A+ (100/100) - Fully covered position
- Upside: A- (90/100) - Capped at $3425 max profit
- Sophistication: D (65/100) - 1-leg strategies only
- AI Recommendation: "Buy protective puts at $40 strike for downside protection"

**Live Endpoint:** `https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/integrated-analysis-v3`

**Deployment Commands:**
```bash
# 1. Deploy function (OPENAI_API_KEY already configured from portfolio-vision)
npm run deploy:ia-v3

# 2. Test deployment
node tests/edge-functions/test-integrated-analysis-v3.cjs
```

**Note:** OPENAI_API_KEY is already set in Supabase secrets (used by portfolio-vision and chart-vision). No additional API key setup needed.

**Files Ready for Deployment:**
- `supabase/functions/integrated-analysis-v3/index.ts` (main edge function)
- `supabase/functions/integrated-analysis-v3/coach/recommendations.ts` (orchestrator)
- `supabase/functions/integrated-analysis-v3/coach/graders/*.ts` (5 graders)
- `supabase/functions/integrated-analysis-v3/coach/scenario.ts` (scenario calculator)
- `supabase/functions/integrated-analysis-v3/clients/openai.ts` (AI client)
- `supabase/functions/integrated-analysis-v3/deno.json` (dependencies)

### Phase 7: UI Components ✅ COMPLETED

- [x] Create `RecommendationsOverview.tsx` - Overall grade + summary ✅ COMPLETED
- [x] Create `GradeBreakdown.tsx` - 5 grade cards ✅ COMPLETED
- [x] Create `ScenarioChart.tsx` - P/L chart ✅ COMPLETED
- [x] Create `UpgradeSteps.tsx` - Action items ✅ COMPLETED
- [x] Create shared types (`src/types/recommendations.ts`) ✅ COMPLETED

**Components Created:**

**1. RecommendationsOverview** (`src/components/recommendations/RecommendationsOverview.tsx`)
- Displays overall A-F grade with large badge
- Shows portfolio summary from AI
- Grid of 5 grade category cards (Coverage, Income, Risk, Upside, Sophistication)
- Market context section
- Color-coded by grade (green for A, blue for B, yellow for C, orange for D, red for F)

**2. GradeBreakdown** (`src/components/recommendations/GradeBreakdown.tsx`)
- Detailed view of each grade category
- Shows icon, title, description for each category
- Displays feedback, strengths, and weaknesses
- Color-coded left border matching grade
- Responsive two-column layout for strengths/weaknesses

**3. ScenarioChart** (`src/components/recommendations/ScenarioChart.tsx`)
- Interactive Recharts line chart showing P/L across 7 price levels
- Scenarios: Bearish (-30%), Moderate Bearish (-15%), Flat (0%), Moderate Bullish (+15%), Bullish (+30%), Very Bullish (+50%), Moonshot (+100%)
- Custom tooltip showing price, P/L, and status
- Reference line at breakeven (P/L = $0)
- Summary table below chart with all scenario details
- Color-coded by status (red for losses, green for profits)

**4. UpgradeSteps** (`src/components/recommendations/UpgradeSteps.tsx`)
- Execution plan from AI
- Tabbed interface for "Next Steps", "To A Grade", "To A+ Grade"
- Priority badges (immediate, short_term, long_term)
- Risk level badges (low, medium, high)
- Numbered steps with action, reasoning, and impact
- Empty state messages for tabs with no recommendations

**Files Created:**
- `src/types/recommendations.ts` - Shared TypeScript interfaces
- `src/components/recommendations/RecommendationsOverview.tsx` - 148 lines
- `src/components/recommendations/GradeBreakdown.tsx` - 165 lines
- `src/components/recommendations/ScenarioChart.tsx` - 241 lines
- `src/components/recommendations/UpgradeSteps.tsx` - 200 lines
- `src/components/recommendations/index.ts` - Barrel export

**Design Features:**
- ✅ Dark mode support throughout
- ✅ Responsive layouts (mobile, tablet, desktop)
- ✅ Accessible color contrast (WCAG AA)
- ✅ Consistent with existing app styling (Tailwind CSS)
- ✅ Interactive elements (hover states, tooltips)
- ✅ Empty states handled gracefully

### Phase 8: Integration & E2E Testing ⏳ PENDING

- [ ] Wire to StockAnalysisV2 Recommendations tab
- [ ] Test with IBIT portfolio screenshot
- [ ] Verify grades are accurate
- [ ] Verify scenario chart renders
- [ ] Verify upgrade recommendations make sense
- [ ] Run full test suite

**NOTE:** This is a **separate workstream** from Phase 2.5b (advanced strategy detection). The grading system consumes strategy data but doesn't detect it.

---

## Phase 4: Coach Module (AI via Edge Function) 🚧 NEW PLAN

### Architecture & Separation of Concerns
- [ ] Replace monolithic v2 logic with `/supabase/functions/integrated-analysis-v3/index.ts` orchestrator that:
  - [ ] Validates payload (ticker, deterministic wheel data, charts, research).
  - [ ] Delegates to **Coach Wheel**, **Coach Roll**, and **Coach Action** helpers (separate modules under `supabase/functions/integrated-analysis-v3/coach/`).
  - [ ] Calls OpenAI `gpt-5.1-mini` with the `web_search` tool enabled (per [OpenAI Web Search docs](https://platform.openai.com/docs/guides/web-search)) so each helper can ground recommendations with fresh market sources.
  - [ ] Merges helper results into one JSON envelope (`wheelExecution`, `rollDecisions`, `actionPlan`) while preserving `wheelStrategy` and `wheelDeterministic` pass-through fields.
  - [ ] Applies shared concerns (timeout, retries, content filtering, response schema validation, 30‑minute cache).

- [ ] Wire OpenAI client in `supabase/functions/integrated-analysis-v3/clients/openai.ts` that exposes a `runGptMiniSearch(prompt, system, searchOptions)` helper preconfigured with `model: "gpt-5.1-mini", tools: [{type: "web_search", ...}]` and sensible defaults (max tokens, low reasoning effort).

### Coach Wheel Module (Wheel Execution Tab)
- [ ] Implement prompt helper `coach/wheel.ts` returning actionable execution plan blocks using `runGptMiniSearch`.
- [ ] Unit test prompt assembly and response parsing (`supabase/functions/integrated-analysis-v3/__tests__/wheel.test.ts`).
- [ ] Provide CLI harness `node tests/edge-functions/test-integrated-wheel.cjs` to hit the function locally before UI wiring.
- [ ] UI validation: ensure Wheel Execution tab renders with deterministic data while coach data is loading (spinner), then fills in plan once response arrives.

- [ ] Implement `coach/roll.ts` with clear mapping between positions and roll suggestions, sourcing catalyst data via `runGptMiniSearch`.
- [ ] Add Vitest coverage for rule triggers and fallback messaging.
- [ ] Create integration script `tests/edge-functions/test-integrated-roll.cjs` that prints sample response for ETHA portfolio.
- [ ] In UI, confirm roll tab remains accessible and shows deterministic placeholders until coach data merges.

- [ ] Implement `coach/action.ts` summarising portfolio-wide playbook (risk flags, next steps) using `runGptMiniSearch` to incorporate latest macro context.
- [ ] Unit test JSON schema and ensure unknown model output fails fast with descriptive error.
- [ ] Integration script `tests/edge-functions/test-integrated-action.cjs` for pre-prod validation.
- [ ] Verify Action Plan tab renders once coach orchestrator dispatches enriched payload.

- [ ] Expose orchestrator via `callFnJson('integrated-analysis-v3', payload)` guarded by feature flag.
- [ ] Ensure client dispatches deterministic event first, then separately requests coach analysis so option/strategy cards stay instant.
- [ ] Iterate tab-by-tab: enable Wheel Execution first, validate in dev, then gate Roll tab, finally Action Plan. Do not enable next tab until prior passes manual UI test checklist.
- [ ] Document request/response examples in `docs/INTEGRATED_ANALYSIS_RESPONSE_STRUCTURE.md` after each tab is stable.

### Client Call Sites
- [ ] Update `TickerPriceSearch.handleAIAnalysis` to kick off coach request only after deterministic dispatch by calling a new helper `requestCoachAnalysis(ticker, deterministicPayload)` that wraps `callFnJson('integrated-analysis-v3', ...)`.
- [ ] Update `StockAnalysisV2` to listen for `analysis-coach-ready` events so the deterministic and coach payloads remain decoupled; fall back gracefully if the feature flag is disabled or the edge function errors.

### Testing & Tooling Requirements
- [ ] Each helper module ships with Vitest unit tests (run via `npx vitest run supabase/functions/integrated-analysis-v3/__tests__`).
- [ ] Edge orchestrator covered by contract test using recorded sample payload (`tests/edge-functions/test-integrated-analysis-v3.cjs`).
- [ ] Add Mock payload fixtures under `tests/test-data/integrated-analysis-v3/` for repeatable dev testing.
- [ ] Add mock client that records `gpt-5.1-mini` web-search calls so unit tests run offline; integration scripts must confirm live responses before UI release.
- [ ] Update CI script to run new tests before deployment; block deploy if orchestrator or helper tests fail.
- [ ] Provide README in `supabase/functions/integrated-analysis-v3/` explaining how to run local tests before touching the UI.

### UX Guardrails
- [ ] Maintain progressive loading states in StockAnalysisV2 so tabs show skeletons/spinners until coach data arrives.
- [ ] Log coach errors to console with actionable guidance, but keep deterministic panels visible.
- [ ] Surface toast/banner when coach response missing to prompt retry without blocking core flow.

## Phase 5: Refactor & UX Polish 📌 BACKLOG

- [ ] Reduce `StockAnalysisV2.tsx` complexity below ESLint thresholds
  - [ ] Resolve "Function 'StockAnalysis' has a complexity of..." errors
  - [ ] Break down complex render logic into focused subcomponents
  - [ ] Extract repeated calculations into shared helpers
  - [ ] Ensure all functions remain under complexity 30 post-refactor
- [ ] Re-run full lint/test/portfolio-vision flows after refactor
- [ ] Align documentation (Phase 1 testing guide, analysis issue notes) with new modular architecture once coach tabs are live
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
