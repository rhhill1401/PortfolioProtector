# Recommendations Tab Specification
## AI-Powered Portfolio Analysis & Optimization

### 🎯 Vision
Create a comprehensive, grade-based portfolio analysis that:
1. Analyzes current positions with letter grades (A-F)
2. Identifies weaknesses and missed opportunities
3. Provides specific, actionable trade recommendations
4. Shows upgrade path from current grade to A/A+
5. Handles dynamic portfolios (no hardcoding)

### 📋 Based On
This spec captures the analysis style from the IBIT and ETHA portfolio reviews conducted on 2025-10-03, which received user approval for clarity, depth, and actionability.

---

## Section 1: Current Portfolio Analysis

### 1.1 Portfolio Summary Card

**Display:**
```
Portfolio: [TICKER] Options Strategy
Overall Grade: [A-F] ([Score]/100)
Current Value: $XX,XXX
Total P&L: +$X,XXX (+XX.X%)
```

**Components:**
- Underlying shares: count, average cost basis, current P&L
- Option positions: count by type (SOLD calls, BOUGHT calls, SOLD puts, BOUGHT puts)
- Cash balance
- Total portfolio value

---

### 1.2 Position Breakdown

**Format:**
```markdown
## Underlying Stock Position
- **Shares**: [count] shares @ $[basis] avg cost
- **Current Price**: $[price]
- **Current Value**: $[value]
- **Unrealized P&L**: +$[amount] (+X.X%)

## Option Positions ([count] Total)

### SOLD Calls ([count] contracts - Covered Call positions)
| Strike | Expiry | Qty | Premium Collected | Current Value | Days to Expiry | Moneyness |
|--------|--------|-----|-------------------|---------------|----------------|-----------|
| $XX    | Nov-21 | -2  | ~$XXX            | -$XXX        | XX days        | OTM (X%) |

### BOUGHT Calls ([count] contracts)
| Strike | Expiry | Qty | Cost Paid | Current Value | Days to Expiry | Status |
|--------|--------|-----|-----------|---------------|----------------|--------|
| $XX    | Dec-05 | +1  | -$XXX    | $XXX         | XX days        | ITM (+$XXX) |
```

**Data Requirements:**
- Pull from `wheelStrategy.currentPositions` (deterministic data)
- Calculate days to expiry dynamically
- Determine moneyness from current price vs strike
- Show realized premium vs current mark-to-market value

---

### 1.3 Detected Strategies Section

**Format:**
```markdown
## Detected Strategies 🎯

### Strategy 1: [Strategy Name] ✅
**Structure**: [Description of legs]

**Breakdown by expiration**:
- **[Timeframe]**: [count] contracts at $[strikes]
- **[Timeframe]**: [count] contracts at $[strikes]

**Metrics**:
- **Coverage Ratio**: X% ([math] = [result])
- **Total Premium Collected**: $X,XXX
- **Net Option P&L**: $XXX (mark-to-market)
- **Wheel Status**: [COVERED_CALL | CASH_SECURED_PUT]

**Risk Assessment**:
[Strike-by-strike analysis with moneyness, delta estimate, assignment probability]
```

**Strategy Types to Detect** (Phase 2.5):
- Covered Calls (shares + sold calls)
- Cash Secured Puts (sold puts + cash)
- Bull Call Spread (long lower + short higher)
- Bull Put Spread (long lower + short higher put)
- **Call Ratio Spread** (e.g., +1 $60C, +1 $70C, -1 $80C) ← CRITICAL
- **Put Ratio Spread**
- **Butterflies** (long-short-short-long)
- **Iron Condors**
- **Calendar Spreads** (same strike, different expirations)

**Required Logic:**
- Group positions by expiration
- Detect multi-leg patterns dynamically
- Calculate profit/loss zones
- Identify unlimited vs defined risk

---

## Section 2: Portfolio Grading System

### 2.1 Overall Grade Calculation

**Grade Components** (weighted):
1. **Coverage Efficiency** (25%): How much of portfolio generates income
2. **Premium Income** (20%): Yield on capital from option selling
3. **Risk Management** (30%): Downside protection, defined vs undefined risk
4. **Upside Potential** (15%): Ability to participate in rallies
5. **Strategy Sophistication** (10%): Use of advanced structures

**Grade Scale:**
- **A+ (95-100)**: Elite institutional-grade portfolio
- **A (90-94)**: Excellent risk-adjusted structure
- **B+ (85-89)**: Strong with minor improvements needed
- **B (80-84)**: Good but missing key elements
- **C+ (75-79)**: Adequate, significant room for improvement
- **C (70-74)**: Concerning gaps in strategy
- **D (60-69)**: Poor risk/reward profile
- **F (<60)**: Dangerous or incoherent structure

### 2.2 Component Grading Detail

**Example Output:**
```markdown
### Coverage Efficiency: B+ (85/100)
- ✅ 75% of shares covered (300/400)
- ⚠️ 100 shares idle (no income generation)
- ✅ Layered expirations reduce concentration risk

### Premium Income: B (82/100)
- ✅ $2,158 collected on $13,704 = 15.7% yield
- ⚠️ Could increase to 17%+ with full coverage
- ✅ Annualized ~40% return (strong)

### Risk Management: C+ (75/100)
- ❌ No downside protection (naked to crash)
- ⚠️ Long call losing value (-$96)
- ✅ Short-dated calls near-term risk defined

### Upside Potential: B- (78/100)
- ✅ 25% uncovered shares (full upside)
- ⚠️ 75% capped (miss >$50 rallies)
- ⚠️ No leverage structures (ratio spreads, etc.)

### Strategy Sophistication: B- (78/100)
- ✅ Simple covered calls (easy to manage)
- ❌ Missing advanced structures (ratio spreads)
- ⚠️ Long call doesn't fit overall strategy
```

---

## Section 3: Scenario Analysis

### 3.1 Directional Exposure Table

**Format:**
```markdown
## Directional Coverage 📈

**Upside Protection:** ✅ Excellent
- [Scenario analysis text]

**Downside Protection:** ⚠️ Moderate
- [Scenario analysis text]

**Sideways Market:** ✅ Good
- [Scenario analysis text]

### Coverage Analysis:
| Scenario | Outcome | Grade |
|----------|---------|-------|
| [Ticker] → $XX | [P&L calculation] | [A-F] |
| [Ticker] → $XX | [P&L calculation] | [A-F] |
```

**Calculation Requirements:**
- Compute P&L at key price levels: -30%, -15%, flat, +15%, +30%, +50%, +100%
- Show breakdown by position type (shares, sold calls, bought calls, etc.)
- Calculate net result dynamically (no hardcoded values)
- Identify best/worst scenarios

### 3.2 Example Scenario Breakdown

**Format:**
```markdown
**Net if [TICKER] → $XX:**
- Uncovered shares: [count] × ($XX - $[basis]) = **+$X,XXX**
- $[strike] covered shares: [count] × ($[strike] - $[basis]) + $[premium] = **+$X,XXX** (capped)
- [Strategy name]: [calculation] = **+$X,XXX**
- **Total gain**: **+$X,XXX** (+XX% on $XX,XXX position)
```

---

## Section 4: What Could Be Improved

### 4.1 Weakness Identification

**Format:**
```markdown
## Weaknesses ⚠️
- **Issue 1**: [Specific problem]
  - Impact: [Quantified loss or missed opportunity]
  - Why it matters: [Explanation]

- **Issue 2**: [Specific problem]
  - Impact: [Quantified loss or missed opportunity]
  - Why it matters: [Explanation]
```

**Detection Logic:**
- Uncovered shares: `shareCount - (sum of sold call contracts × 100) > 0`
- Underwater positions: `currentValue - costBasis < 0`
- No downside protection: `count of protective puts === 0`
- Missing strategies: Compare detected vs known optimal patterns
- Premium efficiency: `premiumCollected / portfolioValue < 15%`

### 4.2 Improvement Suggestions

**Format:**
```markdown
## Recommendations 🎯

### Immediate Actions (Priority: HIGH)

**1. [Action Title]**
- **Option A - [Approach]**: [Details]
  - **Why**: [Rationale]
  - **When**: [Trigger condition]

- **Option B - [Approach]**: [Details]
  - **Why**: [Rationale]
  - **When**: [Trigger condition]

**2. [Action Title]**
[Same format]
```

---

## Section 5: Upgrade Path (Current → A/A+)

### 5.1 Step-by-Step Transformation

**Format:**
```markdown
## How to Make Portfolio an A (90-95/100) 🎯

**Current State: [Grade] ([Score]/100)**

**What's holding it back:**
1. ❌ [Issue with quantified impact]
2. ❌ [Issue with quantified impact]
3. ⚠️ [Issue with quantified impact]

**Target State: A ([Score]/100)** ✨

### 3-Step Transformation Plan

### STEP 1: [Action Name] 🔧

**Current Problem:**
[Description]

**Solution: [Trade Name]**

**Trade:**
```
[Exact trade instructions with strikes, expirations, quantities]
```

**New Metrics:**
- **[Metric]**: [Before] → [After]
- **[Metric]**: [Before] → [After]

**Why This Works:**
- ✅ [Benefit 1]
- ✅ [Benefit 2]
- ⚠️ [Tradeoff]

**Grade Impact:** [Component] [Before Grade] → [After Grade]
```

**Requirements:**
- Each step must be **actionable** (specific strikes, expirations)
- Show **before/after metrics** (P&L, yield, max loss, etc.)
- Explain **tradeoffs** (nothing is free)
- Quantify **grade improvement**

### 5.2 Final State Comparison

**Format:**
```markdown
## Final A-Grade Portfolio Structure 🏆

### After All 3 Steps:

**Underlying:**
- [Share count] shares @ $[basis]

**Options Positions ([count] total):**

**SOLD Calls ([count] contracts):**
1. [Position details]
2. [Position details with ← NEW marker for additions]

**BOUGHT Calls ([count] contracts):**
3. [Position details]

**BOUGHT Puts ([count] contracts):**
4. [Position details with ← NEW marker]

### New Portfolio Metrics (A-Grade) 📊

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Premium Collected | $X,XXX | $X,XXX | +$XXX |
| Yield on Shares | XX% | XX% | +X.X% |
| Covered Shares | XX% | XXX% | +XX% |

### Risk Profile:
| Scenario | Before Loss | After Loss | Protection |
|----------|-------------|------------|------------|
| [Ticker] → $XX | -$X,XXX | -$XXX | **+XX%** |
```

---

## Section 6: A+ Portfolio (Unlimited Upside)

### 6.1 A+ Design Principles

**Trigger Condition:**
User mentions parabolic move potential (e.g., "ETH could go to $10,000")

**Response:**
```markdown
## A+ Portfolio (95/100): Unlimited Upside + Downside Protection 🚀

### The Problem with "A" Portfolio:
- Caps at $XX = miss **XXX% rally** if [scenario]
- Conservative structure = **wrong bet** for parabolic moves

### A+ Design Philosophy:
**"Participate in the moon, protect against the crash"**

### STEP 1: Keep Unlimited Upside → Ratio Spread

[Trade details showing how to structure 2:1 or 3:2 ratio spread]

**Profit at Different Prices:**
| Price | Profit/Loss | Explanation |
|-------|-------------|-------------|
| $XX | -$XXX | All calls expire worthless |
| $XX | +$XXX | [Calculation] |
| $XXX (moon) | **+$X,XXX** | Unlimited gains above $XX |
```

**Key Requirements for A+:**
1. **No upside caps** (or caps so high they're irrelevant: >100% OTM)
2. **Defined downside** (put spreads, not collars)
3. **Leverage structures** (ratio spreads, not just shares)
4. **Tradeoff acceptance**: Lower protection to keep unlimited upside

### 6.2 Parabolic Scenario Table

**Format:**
```markdown
### Upside Scenarios (The Moon Shot):

| [Underlying] Price | [Ticker] Price | Profit | Breakdown |
|-------------------|----------------|--------|-----------|
| $X,XXX | $XX | +$X,XXX | Premium only |
| $X,XXX | $XX | +$XX,XXX | Shares + ratio spread |
| $XX,XXX | $XXX | **+$XXX,XXX** | Full parabolic exposure! |

**At [Underlying] $XX,XXX / [Ticker] $XXX:**
[Detailed line-by-line breakdown showing each position contribution]
**Total: +$XXX,XXX on $XX,XXX position** = **+XXX% gain** 🚀
```

---

## Section 7: Trade Execution Plan

### 7.1 Exact Trade List

**Format:**
```markdown
## Action Plan - Exact Trades 📝

**Execute these in order:**

### Trade 1: [Trade Name] (Step X)
```
Action: [SELL TO OPEN | BUY TO OPEN | BUY TO CLOSE | SELL TO CLOSE]
Contract: [TICKER] $[strike] [Call/Put] [expiration]
Quantity: [number]
Expected [Credit/Debit]: $[amount]
Order Type: Limit at $[price] or better
```

**Total Capital Required:** ~$XXX (after offsetting credits)
**Total Time to Execute:** [estimate] minutes
```

**Requirements:**
- List trades in optimal execution order
- Provide limit prices (not market orders)
- Calculate net debit/credit accounting for all legs
- Estimate execution time

### 7.2 Before/After Comparison

**Format:**
```markdown
## Comparison: [Current Grade] vs [Target Grade] Portfolio

| Aspect | Current ([Grade]) | Optimized ([Grade]) |
|--------|-------------------|---------------------|
| **Premium Income** | $X,XXX | $X,XXX (+X.X%) |
| **Downside Risk** | -$X,XXX | -$XXX (-XX%) |
| **Upside Cap** | $XX or None | $XXX or None |
| **Coverage** | XX% | XXX% |
| **Complexity** | X positions | X positions |
| **Risk Profile** | [Undefined/Defined] | **Defined** ✅ |
| **Grade** | [Grade] ([Score]/100) | **[Grade] ([Score]/100)** |
```

---

## Section 8: AI Prompt Structure

### 8.1 System Prompt for Recommendations Tab

```typescript
const RECOMMENDATIONS_SYSTEM_PROMPT = `You are an elite options trading advisor analyzing a real portfolio.

Your task:
1. Grade the current portfolio (A-F scale) with detailed scoring
2. Identify weaknesses with quantified impact
3. Provide step-by-step upgrade path to A or A+ grade
4. Give exact, actionable trade recommendations (no vague suggestions)
5. Show before/after metrics for every recommendation
6. Handle parabolic scenarios if user mentions major upside potential

CRITICAL RULES:
- NO HARDCODING: All analysis based on actual positions provided
- QUANTIFY EVERYTHING: Every claim needs numbers ($X impact, X% improvement)
- SPECIFIC TRADES: Include strikes, expirations, quantities, limit prices
- GRADE JUSTIFICATION: Explain why each component gets its score
- TRADEOFFS: Always mention what user gives up for each gain
- DYNAMIC SCENARIOS: Calculate P&L at multiple price levels
- USER CONTEXT: If user mentions "$10K ETH" or similar, optimize for parabolic moves

OUTPUT FORMAT:
1. Current Portfolio Analysis (Section 1)
2. Grading Breakdown (Section 2)
3. Scenario Analysis (Section 3)
4. Weaknesses & Improvements (Section 4)
5. Upgrade Path to A/A+ (Section 5-6)
6. Exact Trade List (Section 7)

Use markdown tables, emoji for visual hierarchy, and clear section headers.
`;
```

### 8.2 User Prompt Template

```typescript
const buildRecommendationsPrompt = (portfolio: WheelStrategy, currentPrice: number, userContext?: string) => `
Analyze this portfolio and provide comprehensive recommendations:

**Ticker:** ${portfolio.ticker}
**Current Price:** $${currentPrice}
**Share Count:** ${portfolio.shareCount} shares @ $${portfolio.averageCost} basis

**Current Option Positions:**
${portfolio.currentPositions.map(pos => `
- ${pos.contracts > 0 ? 'BOUGHT' : 'SOLD'} ${Math.abs(pos.contracts)} ${pos.type} $${pos.strike} ${pos.expiry}
  Premium: $${pos.premium || pos.premiumCollected}
  Current Value: $${pos.currentValue}
  Days to Expiry: ${pos.daysToExpiry}
`).join('\n')}

**Detected Strategies:**
${portfolio.detectedStrategies?.map(s => `- ${s.label}: ${s.legs.length} legs`).join('\n') || 'None auto-detected'}

**User Context:**
${userContext || 'Standard bullish wheel strategy. Looking for income + modest growth.'}

**Greeks Available:**
${portfolio.greeks ? 'Yes - include delta/gamma analysis' : 'No - use moneyness estimates'}

Provide:
1. Letter grade (A-F) with detailed breakdown
2. Specific weaknesses with $ impact
3. Step-by-step upgrade path with exact trades
4. Before/after metrics tables
5. Parabolic scenario analysis if relevant

Be quantitative, specific, and actionable.
`;
```

---

## Section 9: Implementation Requirements

### 9.1 Data Dependencies

**Required Data:**
- `wheelStrategy.currentPositions[]` - All option positions with:
  - `symbol, strike, expiry, type, contracts, premium, currentValue, daysToExpiry`
- `wheelStrategy.shareCount` - Underlying shares
- `wheelStrategy.shareBasis` - Average cost basis
- `currentPrice` - Real-time or latest close
- `optionGreeks` - Delta, gamma, theta, IV (optional but preferred)
- `detectedStrategies[]` - From Phase 2.5 strategy detection

**Calculated Fields:**
- Moneyness per position: `(currentPrice - strike) / strike`
- Total premium collected: Sum of all sold option premiums
- Coverage ratio: `(sum of sold call contracts × 100) / shareCount`
- Portfolio value: `shareCount × currentPrice + netOptionValue`
- Yield: `premiumCollected / portfolioValue`

### 9.2 AI Model Requirements

**Model:** GPT-4 or GPT-4o (requires strong reasoning + math)

**Tools Enabled:**
- `web_search`: For live market context (VIX, IV rank, upcoming catalysts)
- `python`: For complex P/L calculations across scenarios

**Response Format:** Structured markdown (no function calling schema)

**Token Budget:** 4,000-6,000 tokens output (detailed analysis)

**Caching Strategy:**
- Cache prompt template (system prompt)
- Cache portfolio structure (if unchanged)
- Invalidate on price updates > 2% or new trades

### 9.3 UI Components

**New Component:** `<RecommendationsTab />`

**Sub-Components:**
- `<PortfolioGradeCard />` - Overall grade display
- `<ComponentGradesTable />` - Breakdown by category
- `<ScenarioAnalysisTable />` - P/L at different prices
- `<UpgradeStepCard />` - Each step in transformation plan
- `<TradeExecutionList />` - Actionable trade checklist
- `<BeforeAfterComparison />` - Side-by-side metrics

**State Management:**
```typescript
interface RecommendationsState {
  isLoading: boolean;
  currentGrade: string; // "B", "A-", etc.
  currentScore: number; // 80, 92, etc.
  targetGrade: string;
  targetScore: number;
  componentGrades: {
    coverage: { score: number; grade: string; feedback: string };
    income: { score: number; grade: string; feedback: string };
    risk: { score: number; grade: string; feedback: string };
    upside: { score: number; grade: string; feedback: string };
    sophistication: { score: number; grade: string; feedback: string };
  };
  weaknesses: Array<{ issue: string; impact: string; severity: 'high' | 'medium' | 'low' }>;
  upgradeSteps: Array<{
    stepNumber: number;
    title: string;
    problem: string;
    solution: string;
    trades: Array<{ action: string; contract: string; quantity: number; price: number }>;
    metrics: { before: Record<string, any>; after: Record<string, any> };
    gradeImpact: string;
  }>;
  scenarios: Array<{ price: number; profit: number; breakdown: string }>;
  aplusTrigger?: boolean; // If user mentioned parabolic move
}
```

---

## Section 10: Testing & Validation

### 10.1 Test Cases

**Test Portfolio 1: Simple Covered Calls (Should grade B)**
- 400 ETHA shares
- 3 sold calls (75% coverage)
- 1 long call (underwater)
- No protection
- Expected: B grade (80-84 range)

**Test Portfolio 2: IBIT Ratio Spread (Should grade A-)**
- 400 IBIT shares
- 4 sold calls (100% coverage)
- 2 long calls + 1 short call = ratio spread
- Expected: A- grade (88-92 range)

**Test Portfolio 3: Protective Collar (Should grade A)**
- Shares + sold calls + protective puts
- 100% coverage
- Downside protected
- Expected: A grade (90-94 range)

**Test Portfolio 4: Naked Calls (Should grade D/F)**
- Sold calls with no underlying shares
- Undefined risk
- Expected: D or F grade (60-69 range)

### 10.2 Validation Checklist

- [ ] Grades are consistent across multiple runs (same portfolio = same grade)
- [ ] Recommendations are actionable (specific strikes, expirations, quantities)
- [ ] Math is correct (P&L calculations verified manually)
- [ ] No hardcoded tickers/strikes (works for ANY portfolio)
- [ ] Handles edge cases (0 positions, all long, all short, etc.)
- [ ] Parabolic scenarios only appear when user context mentions big moves
- [ ] Before/after metrics sum correctly
- [ ] Trade execution order is logical (spreads executed atomically)

### 10.3 User Acceptance Criteria

**From 2025-10-03 User Feedback:**
> "I love the way you did these IBIT and ETHA analysis. Can you write a detailed implementation spec so that when we get ready to do the integrated analysis version 3, the recommendations tab will be exactly like this?"

**Success Criteria:**
- ✅ Letter grade with detailed breakdown
- ✅ "What could be improved" section with specific $ impacts
- ✅ Step-by-step upgrade path (B → A → A+)
- ✅ Exact trade recommendations (not vague)
- ✅ Before/after comparison tables
- ✅ Handles user context (e.g., "ETH could go to $10K")
- ✅ Dynamic analysis (no hardcoded portfolios)

---

## Section 11: Phase Integration

### 11.1 How This Fits Into Integrated-Analysis-V3

**Phase 4: Coach Module** includes Recommendations Tab

**Orchestrator Flow:**
```typescript
// integrated-analysis-v3/index.ts
const response = {
  wheelDeterministic: { /* Phase 2 data */ },
  wheelStrategy: { /* Phase 1 data */ },
  optionGreeks: { /* Phase 3 data */ },

  // NEW: Phase 4 Coach outputs
  wheelExecution: await coachWheel.generate(payload),
  rollDecisions: await coachRoll.generate(payload),
  recommendations: await coachRecommendations.generate(payload), // ← THIS SPEC
  actionPlan: await coachAction.generate(payload),
};
```

**Coach Recommendations Module:**
```
/supabase/functions/integrated-analysis-v3/coach/recommendations.ts
```

**Implements:**
1. Grading system (Section 2)
2. Strategy detection review (Section 1.3)
3. Scenario analysis (Section 3)
4. Upgrade path generation (Section 5-6)
5. Trade execution plan (Section 7)

**Dependencies:**
- Phase 1 (Eyes): Portfolio extraction
- Phase 2 (Calculator): Strategy detection
- Phase 2.5: Advanced strategy detection (ratio spreads, butterflies)
- Phase 3 (Weather): Greeks for delta-based risk assessment
- User context from upload flow

### 11.2 Client-Side Integration

**Wire into StockAnalysisV2:**
```typescript
// src/components/StockAnalysisV2.tsx

<TabsContent value='recommendations' className='space-y-4'>
  {analysisData?.recommendations ? (
    <>
      <PortfolioGradeCard
        grade={analysisData.recommendations.currentGrade}
        score={analysisData.recommendations.currentScore}
        components={analysisData.recommendations.componentGrades}
      />

      <ScenarioAnalysisTable
        scenarios={analysisData.recommendations.scenarios}
        currentPrice={priceInfo.price || analysisData.summary.currentPrice}
      />

      {analysisData.recommendations.upgradeSteps.map((step, idx) => (
        <UpgradeStepCard key={idx} step={step} />
      ))}

      <TradeExecutionList
        trades={analysisData.recommendations.upgradeSteps.flatMap(s => s.trades)}
      />

      <BeforeAfterComparison
        before={analysisData.recommendations.currentMetrics}
        after={analysisData.recommendations.targetMetrics}
      />
    </>
  ) : (
    <Card>
      <CardContent className="py-8 text-center text-gray-500">
        Recommendations will appear here once analysis completes.
      </CardContent>
    </Card>
  )}
</TabsContent>
```

---

## Section 12: Example Output (Complete Flow)

**Input Portfolio:**
- ETHA: 400 shares @ $34.64 basis, current $34.26
- Options: -1 $36C Nov-07, -2 $50C Dec-2027, +1 $34C Dec-05

**AI Output (Markdown):**

```markdown
# ETHA Portfolio Analysis 📊

## Overall Grade: B (80/100)

**Current Value:** $13,704
**Total P&L:** -$150 (-1.09%)
**Premium Collected:** $2,158

---

## Component Grades

### Coverage Efficiency: B+ (85/100)
✅ 75% of shares covered (300/400)
⚠️ 100 shares idle (no income generation)
⚠️ Potential +$100/month missed from uncovered shares

### Premium Income: B (82/100)
✅ $2,158 on $13,704 = 15.7% yield (annualized ~40%)
⚠️ Could improve to 17%+ with 4th covered call

### Risk Management: C+ (75/100)
❌ No downside protection (max loss = -$13,704)
⚠️ Long $34 call underwater (-$96)
✅ Short-term calls reduce near-term risk

### Upside Potential: B- (78/100)
✅ 100 uncovered shares (25% rally participation)
⚠️ 200 shares capped at $50 (miss >45% moves)
❌ No leverage structures (ratio spreads)

### Strategy Sophistication: B- (78/100)
✅ Simple covered calls (easy to manage)
❌ No advanced structures
⚠️ Long call doesn't fit strategy

---

## Weaknesses ⚠️

1. **25% Uncovered Shares**
   - Impact: Missing $50-100/month premium income
   - Why it matters: Opportunity cost of ~$600/year

2. **Underwater Long Call**
   - Impact: -$96 unrealized loss, accelerating theta decay
   - Why it matters: Breakeven too far ($39.76, +15.9% needed)

3. **No Downside Protection**
   - Impact: If ETHA → $28, lose -$2,504 (only $2,158 cushion)
   - Why it matters: Exposed to market crash scenarios

---

## How to Upgrade to A (92/100) 🎯

### STEP 1: Convert Long Call to Bull Call Spread

**Current Problem:** +1 $34 Call losing value, breakeven $39.76

**Solution: Debit Spread**

**Trade:**
```
SELL TO OPEN: -1 ETHA $40 Call Dec-05-2025
Expected Credit: $100-150
```

**New Metrics:**
- Net Cost: $576 → $426 (-$150 risk reduction)
- Breakeven: $39.76 → $38.26 (-4%)
- Max Profit: $174 at $40 (+41% ROI)

**Grade Impact:** Risk Management C+ → B+

---

### STEP 2: Cover Remaining Shares

**Trade:**
```
SELL TO OPEN: -1 ETHA $38 Call Nov-21-2025
Expected Credit: $80-120
```

**Result:**
- Coverage: 75% → 100%
- Premium: $2,158 → $2,258 (+$100)
- Yield: 15.7% → 16.5%

**Grade Impact:** Coverage Efficiency B+ → A

---

### STEP 3: Add Downside Protection

**Trade:**
```
BUY: +1 ETHA $30 Put Dec-19-2025 ($150)
SELL: -1 ETHA $28 Put Dec-19-2025 ($70)
Net Cost: $80
```

**Result:**
- Max Loss: -$2,504 → -$426 (-83% reduction)
- Protected below $30
- Upside: Still unlimited ✅

**Grade Impact:** Risk Management B+ → A

---

## Final A-Grade Portfolio

**After All Steps:**
- Grade: A (92/100)
- Premium: $2,258 (+$100)
- Downside Risk: -$426 (-83% improved)
- Coverage: 100%

### Before vs After

| Metric | Before (B) | After (A) |
|--------|------------|-----------|
| Premium | $2,158 | $2,328 (+7.9%) |
| Downside Risk | -$2,504 | -$426 (-83%) |
| Coverage | 75% | 100% |
| Grade | 80/100 | **92/100** |

---

## Exact Trades to Execute 📝

1. **Create Bull Spread**: Sell -1 $40C Dec-05 @ $1.20 limit
2. **Cover Shares**: Sell -1 $38C Nov-21 @ $1.00 limit
3. **Add Protection**: Buy/Sell $30/$28 put spread @ $0.80 debit

**Total Capital:** ~$80
**Time:** 10-15 minutes
```

---

## Section 13: Future Enhancements (Post-MVP)

### 13.1 Phase 5+ Features

**Dynamic Adjustment Plans:**
- Auto-generate rolling schedules
- Trigger rules: "If price > $X at Y DTE, roll to $Z"
- Calendar reminders for position management

**Tax Optimization:**
- Identify short vs long-term cap gains
- Suggest wash sale avoidance
- Qualified covered call compliance

**Volatility Plays:**
- Detect IV expansion opportunities
- Suggest calendar spreads around earnings
- Straddle/strangle recommendations for events

**Multi-Asset Correlation:**
- Portfolio-level analysis (not just single ticker)
- Hedge suggestions across positions
- Sector/beta exposure balancing

### 13.2 User Customization

**Risk Tolerance Settings:**
- Conservative: Focus on collars, defined risk
- Moderate: Balanced approach (current default)
- Aggressive: Ratio spreads, leverage structures
- Moonshot: Optimize for parabolic moves (A+ mode)

**Goal-Based Recommendations:**
- Income priority: Maximize premium collection
- Growth priority: Optimize upside participation
- Protection priority: Minimize downside risk
- Tax priority: Minimize tax drag

---

## Section 14: Success Metrics

### 14.1 User Satisfaction KPIs

- **Clarity Score**: User survey "Did you understand the recommendations?" (Target: >90% yes)
- **Actionability Score**: User survey "Did you execute any trades?" (Target: >60% yes)
- **Grade Accuracy**: Portfolio performance matches predicted grade (Target: ±5 points)
- **Engagement**: Time spent on Recommendations tab (Target: >2 min avg)

### 14.2 Technical Performance KPIs

- **Response Time**: Recommendations generated in <10s (Target: <5s)
- **Accuracy**: Math calculations error-free (Target: 100%)
- **Consistency**: Same portfolio = same grade (Target: 100%)
- **Coverage**: Handles all portfolio types (Target: >95%)

---

## Appendix: AI Grading Rubric (For Prompt Engineering)

### Coverage Efficiency Rubric

| Score | Description |
|-------|-------------|
| 95-100 | 100% shares covered, optimal strike selection, layered expirations |
| 90-94 | 100% covered, some suboptimal strikes |
| 85-89 | 75-99% covered, good structure |
| 80-84 | 50-74% covered, missing opportunities |
| 75-79 | 25-49% covered |
| <75 | <25% covered or naked short positions |

### Premium Income Rubric

| Score | Yield | Description |
|-------|-------|-------------|
| 95-100 | >20% | Elite income generation |
| 90-94 | 17-20% | Excellent yield |
| 85-89 | 15-17% | Strong yield |
| 80-84 | 12-15% | Good yield |
| 75-79 | 10-12% | Adequate yield |
| <75 | <10% | Poor yield or no premium |

### Risk Management Rubric

| Score | Description |
|-------|-------------|
| 95-100 | Downside protected, defined max loss, hedged tail risks |
| 90-94 | Downside protected, defined max loss |
| 85-89 | Partial protection (e.g., stop losses) |
| 80-84 | Premium cushion only |
| 75-79 | Some undefined risks |
| <75 | Large undefined risks or naked short positions |

### Upside Potential Rubric

| Score | Description |
|-------|-------------|
| 95-100 | Unlimited upside + leverage (ratio spreads) |
| 90-94 | Substantial uncapped exposure (>50% shares) |
| 85-89 | Moderate uncapped exposure (25-50% shares) |
| 80-84 | Limited uncapped exposure (<25% shares) |
| 75-79 | Mostly capped but reasonable strikes |
| <75 | Fully capped at near-term strikes |

### Strategy Sophistication Rubric

| Score | Description |
|-------|-------------|
| 95-100 | Advanced multi-leg, dynamic hedging, tax-optimized |
| 90-94 | Ratio spreads, butterflies, calendars |
| 85-89 | Vertical spreads, collars |
| 80-84 | Simple covered calls, CSPs |
| 75-79 | Basic long/short positions |
| <75 | Random positions, no coherent strategy |

---

## Implementation Checklist

### Phase 4: Coach Recommendations Module

- [ ] Create `coach/recommendations.ts` with grading logic
- [ ] Implement scenario analysis calculations
- [ ] Build upgrade step generator
- [ ] Add trade execution formatter
- [ ] Write unit tests for grade consistency
- [ ] Create mock portfolios for testing
- [ ] Integrate with orchestrator
- [ ] Add UI components (PortfolioGradeCard, etc.)
- [ ] Wire into StockAnalysisV2 Recommendations tab
- [ ] Test with IBIT/ETHA real portfolios
- [ ] Validate A+ mode triggers correctly
- [ ] Ensure no hardcoded values (dynamic only)

### User Acceptance Testing

- [ ] Upload ETHA screenshot → Grade: B (80-84)
- [ ] Verify weaknesses section shows uncovered shares
- [ ] Check upgrade steps show exact strikes/expirations
- [ ] Confirm before/after tables calculate correctly
- [ ] Test A+ mode with user context "ETH could go to $10K"
- [ ] Validate trade execution list is actionable
- [ ] Review output matches 2025-10-03 analysis style
- [ ] Get user sign-off on format/clarity

---

**End of Specification**

This spec captures the exact analysis style that received user approval on 2025-10-03 for IBIT and ETHA portfolios. All sections are designed to be dynamic (no hardcoding) and quantitative (every claim backed by numbers).
