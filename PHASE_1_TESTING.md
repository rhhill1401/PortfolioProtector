# Phase 1 Testing Guide - Integrated Analysis V3

## ✅ What Should Be Working in Phase 1

### Prerequisites
1. **Feature flag is ON**: Check `.env.local` has `VITE_USE_INTEGRATED_ANALYSIS_V3=true`
2. **Edge function deployed**: integrated-analysis-v3 is live
3. **StockAnalysisV2 flag OFF**: `VITE_USE_STOCK_ANALYSIS_V2=false` (using original StockAnalysis)

### What You Should See

#### 1. Console Logs
When you click "Generate Analysis", check browser console for:
```
[Analysis] Using endpoint: integrated-analysis-v3 (v3=true)
```

#### 2. Option Position Cards Should Display:

**For SOLD positions (contracts < 0):**
- Header: `$36 Call 2025-10-17 (1 contract)`
- Badges: `LOW RISK` and `SOLD CALL`
- Premium shows correctly (e.g., `Premium: $261`)
- Days to expiry shows (e.g., `28 days to expiry • Short-dated`)

**For BOUGHT positions (contracts > 0):**
- Badges should show `BOUGHT CALL` or `BOUGHT PUT`
- Premium displayed as amount paid

#### 3. Data Structure Verification

Open browser DevTools Network tab and look for the `integrated-analysis-v3` request. The response should have:

```json
{
  "success": true,
  "analysis": {
    "wheelStrategy": {
      "shareCount": 800,  // Should match your shares
      "currentPhase": "COVERED_CALL",  // or "CASH_SECURED_PUT"
      "currentPositions": [
        {
          "symbol": "ETHA",
          "type": "CALL",  // Must be present
          "strike": 36,
          "expiry": "2025-10-17",  // YYYY-MM-DD format
          "contracts": -1,  // Negative = SOLD
          "risk": "LOW",  // Must be present
          "daysToExpiry": 27,
          "term": "SHORT_DATED"
          // Greeks will be null (Phase 3)
        }
      ]
    }
  }
}
```

## 🧪 Test Steps

### Step 1: Start Development Server
```bash
npm run dev
```
Navigate to: http://localhost:5173

### Step 2: Upload Test Portfolio
Use the screenshot: `/Users/Killmunger/Documents/Screenshot 2025-09-18 at 5.42.27 PM.png`

1. Enter ticker: **ETHA**
2. Upload portfolio screenshot to "Portfolio" section
3. Wait for "Ready" status

### Step 3: Generate Analysis
1. Click "Generate Analysis"
2. Watch console for endpoint confirmation
3. Check Network tab for response

### Step 4: Verify Display

#### ✅ What SHOULD Work:
- [ ] Position cards show immediately after analysis
- [ ] Shows "SOLD CALL" for negative contracts
- [ ] Shows "BOUGHT PUT" for positive contracts
- [ ] Premium amounts display correctly
- [ ] Days to expiry calculated
- [ ] Risk level badge shows (LOW/MEDIUM/HIGH)
- [ ] No console errors

#### ❌ What WON'T Work Yet:
- Greeks (delta, theta, etc.) - will be null
- Strategy cards (Bull Call Spread) - Phase 2
- Assignment probability from delta - Phase 3
- AI recommendations - Phase 4

## 🐛 Troubleshooting

### If positions don't show:
1. Check console for errors
2. Verify response has `wheelStrategy.currentPositions`
3. Check if `type` field is present (CALL/PUT)

### If wrong endpoint is called:
1. Verify `.env.local` has `VITE_USE_INTEGRATED_ANALYSIS_V3=true`
2. Restart dev server after changing .env
3. Check console log shows "v3=true"

### If "SOLD"/"BOUGHT" is wrong:
1. Check `contracts` field sign in response
2. Negative should show "SOLD"
3. Positive should show "BOUGHT"

## 📊 Expected Results for ETHA Portfolio

Based on your test screenshot, you should see:

1. **Share count**: 800 ETHA shares detected
2. **Option positions**:
   - SOLD 1 × $36 CALL (Oct-17-2025) - Premium: $261
   - BOUGHT 5 × $30 PUT (Oct-17-2025) - Premium: $503
   - SOLD 5 × $33 PUT (Oct-17-2025) - Premium: $1046
   - SOLD 1 × $35 CALL (Oct-24-2025) - Premium: $299

3. **Total premium collected**: ~$2,109

## 🚦 Success Criteria

Phase 1 is successful if:
- ✅ Positions display immediately (no waiting for AI)
- ✅ Contract direction correct (SOLD vs BOUGHT)
- ✅ Option type correct (CALL vs PUT)
- ✅ Premiums show actual values
- ✅ No crashes or undefined errors

## 📝 Report Issues

If something doesn't work:
1. Screenshot the issue
2. Copy console errors
3. Save Network tab response
4. Note which step failed

---

**Current Status**: Phase 1 COMPLETE - Ready for testing
**Feature Flag**: `VITE_USE_INTEGRATED_ANALYSIS_V3=true`
**Endpoint**: integrated-analysis-v3