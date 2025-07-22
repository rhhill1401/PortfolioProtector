# Recommendations Tab Implementation Guide

## Overview
Replace the "Assignment Success" tab with an AI-powered "Recommendations" tab that provides sophisticated wheel strategy guidance in plain English, similar to an elite options coach.

## Implementation Approach: Start Simple
We're taking a phased approach:
1. **Phase 1**: Use existing data (no web search) with GPT-4o
2. **Phase 2**: Test quality of recommendations
3. **Phase 3**: Only add complexity (web search, Greeks APIs) if needed

This approach minimizes changes while delivering value quickly.

## Data Available Without Web Search
- Current stock price ✓
- Portfolio positions and cash ✓
- Option positions with strikes/expiries ✓
- Basic Greeks (if provided by portfolio-vision) ✓
- VIX data ✓
- Chart technical indicators ✓

## Data NOT Available (Phase 3 enhancements)
- Real-time BTC price
- IBIT IV rank
- ETF flow data
- Live option chain Greeks

## Simple Prompt Approach

### Recipe to Follow
```markdown
**You are an elite wheel-strategy coach.  
Goals: maximize 35-40% cash-on-cash per year, keep ≥ $6,000 idle cash,  
and explain everything in everyday English.**

### INPUTS
1. Current underlying price: ${currentPrice}
2. Portfolio positions: ${JSON.stringify(positions)}
3. Cash available: ${cashBalance}
4. Option positions with details

### ROLL RULES
- Rule A: Roll if price ≥ strike × 1.08
- Rule B: Roll if delta ≥ 0.80 (estimate from moneyness if no Greeks)

### CASH BUFFER RULE
Must maintain ≥ $6,000 free cash

### OUTPUT FORMAT
1. Position Snapshot Table
2. Roll Analysis for Each Position
3. Cash Management Calculations
4. Plain-English Action Plan
5. Conditional Orders (if applicable)
```

## Phase 1: Backend Enhancement

### 1.1 Modify integrated-analysis/index.ts

Add to the existing prompt:
```javascript
// After the current wheel strategy analysis, add:
const recommendationsPrompt = `
Based on the above analysis, generate detailed recommendations:

1. POSITION SNAPSHOT
Create a table showing:
- Each position (shares, options)
- Current value and P&L
- Days to expiry
- Moneyness percentage

2. ROLL ANALYSIS
For each option position:
- Check Rule A: Is price ≥ strike × 1.08? 
- Check Rule B: Is delta ≥ 0.80? (estimate if needed)
- Action: HOLD, ROLL, or CONDITIONAL_ROLL
- If CONDITIONAL_ROLL, specify trigger

3. CASH MANAGEMENT
- Current cash: $${cashBalance}
- Minimum required: $6,000
- Available for new positions: $${Math.max(0, cashBalance - 6000)}
- Can sell puts at strike: $${Math.floor((cashBalance - 6000) / 100)}

4. ACTION PLAN
Step-by-step plain English instructions:
- Before market open
- During trading hours
- End of day checks

Return as "recommendations" in the JSON structure.
`;
```

### 1.2 Response Structure Addition

```typescript
interface IntegratedAnalysisResponse {
  // ... existing fields ...
  
  recommendations: {
    positionSnapshot: Array<{
      type: string;
      symbol: string;
      quantity: number;
      strike?: number;
      expiry?: string;
      currentValue: number;
      pl: number;
      daysToExpiry?: number;
      moneyness?: string;
    }>;
    
    rollAnalysis: Array<{
      position: string;
      ruleA: { triggered: boolean; detail: string };
      ruleB: { triggered: boolean; detail: string };
      action: 'HOLD' | 'ROLL' | 'CONDITIONAL_ROLL';
      conditionalTrigger?: string;
    }>;
    
    cashManagement: {
      currentCash: number;
      minimumRequired: number;
      availableForTrades: number;
      maxPutStrike: number;
    };
    
    actionPlan: {
      beforeOpen: string[];
      duringHours: string[];
      endOfDay: string[];
    };
  };
}
```

## Phase 2: Frontend Implementation

### 2.1 Tab Replacement
In StockAnalysis.tsx:
```tsx
// Change from:
<TabsTrigger value='assignment-success'>Assignment Success</TabsTrigger>

// To:
<TabsTrigger value='recommendations'>Recommendations</TabsTrigger>
```

### 2.2 Component Structure
```tsx
<TabsContent value='recommendations'>
  <RecommendationsTab 
    recommendations={analysisData?.recommendations}
    ticker={tickerSymbol}
  />
</TabsContent>
```

### 2.3 Visual Design
- Match the clean style of wheel execution tab
- Use cards for each section
- Color code risk levels
- Clear typography for plain English text

## Testing Strategy

### Test File: /tests/edge-functions/test-recommendations.cjs
1. Use real portfolio data from IBIT.png
2. Call enhanced integrated-analysis
3. Verify recommendations structure
4. Check calculations are correct
5. Save output for UI development

### Success Criteria
- Recommendations use only available data
- Roll rules calculate correctly
- Cash buffer math is accurate
- Plain English is clear and actionable
- No hallucinated prices or data

## Future Enhancements (Phase 3)
Only implement if Phase 1 recommendations lack critical data:

1. **Web Search Integration**
   - Add function calling for market data
   - Fetch BTC price, IV rank, ETF flows

2. **Options Chain API**
   - Get real-time Greeks
   - More accurate delta calculations

3. **Model Upgrade**
   - Consider o3 for deeper analysis
   - Test if it improves recommendations

## Current Status
- [x] Test files organized
- [x] Implementation plan documented
- [ ] Backend enhancement
- [ ] Test creation
- [ ] Frontend implementation