# Dynamic Ticker Selection - Implementation Spec

## 🎯 Goal
Replace hardcoded IBIT/ETHA ticker buttons with dynamic buttons generated from portfolio upload data.

## 🧠 Why Portfolio-Driven Approach?

### ✅ Advantages Over Free-Form Input:
1. **No Typos** - User can't mistype ticker symbols
2. **Automatic Validation** - Only shows tickers that exist in portfolio
3. **Better UX** - Clear visual indication of available tickers
4. **Multi-Ticker Support** - Easy to handle portfolios with 2+ tickers
5. **Less Error Handling** - No need to validate random user input

### ❌ Problems with Input Field:
- User could enter invalid/misspelled tickers
- Requires API validation for every ticker
- Complex error handling for "ticker not found"
- Harder to support multi-ticker portfolios

## 📋 Implementation Steps (Iterative)

### Step 1: Extract Tickers from Portfolio
**Goal**: Parse portfolio-vision response and extract unique ticker symbols

**Changes**:
- `TickerPriceSearch.tsx`: After portfolio upload, extract unique tickers
- Store tickers in state: `availableTickers: string[]`

**Test**:
- Upload portfolio with IBIT + AAPL positions
- Console log should show: `['IBIT', 'AAPL']`

---

### Step 2: Generate Dynamic Buttons
**Goal**: Replace hardcoded buttons with dynamic ones from portfolio data

**Changes**:
- Replace hardcoded `IBIT`, `ETHA`, `BOTH` buttons
- Generate buttons from `availableTickers` array
- Add "ALL" button if more than 1 ticker

**Test**:
- Upload portfolio → See dynamic buttons appear
- Buttons should be: `[IBIT] [AAPL] [ALL]`

---

### Step 3: Filter by Selected Ticker
**Goal**: When user clicks a ticker, filter positions/strategies to that ticker only

**Changes**:
- Add ticker filter logic in analysis event handlers
- Filter `wheelDeterministic.positions` by selected ticker
- Filter `wheelDeterministic.strategies` by selected ticker

**Test**:
- Click "IBIT" → Only see IBIT positions/strategies
- Click "AAPL" → Only see AAPL positions/strategies
- Click "ALL" → See all positions/strategies

---

### Step 4: Remove Hardcoded Conditionals
**Goal**: Clean up `tickerSymbol === 'IBIT' || tickerSymbol === 'ETHA'` checks

**Changes**:
- `StockAnalysisV2.tsx`: Make ETF flows work for any ticker (or disable)
- Remove special handling for `'IBIT,ETHA'` combined mode
- Make market context ticker-agnostic

**Test**:
- Upload any ticker → No errors
- ETF-specific features gracefully disabled for non-ETFs

---

### Step 5: Multi-Ticker Testing
**Goal**: Verify everything works with real multi-ticker portfolios

**Test Cases**:
1. Single ticker (IBIT only)
2. Two tickers (IBIT + AAPL)
3. Three+ tickers (IBIT + AAPL + TSLA)

**Expected**:
- Buttons appear correctly
- Filtering works
- Strategy detection works per ticker
- No crashes or errors

## 🧪 Testing Strategy

### After Each Step:
1. **Code Review**: Run portfolio-protector-reviewer agent
2. **Lint**: Run `npm run lint:eslint`
3. **Manual Test**: Upload test portfolio and verify behavior
4. **User Approval**: Wait for "done" before proceeding

### Test Data:
- IBIT portfolio (existing)
- Multi-ticker portfolio (create mock if needed)

## 🚨 Edge Cases to Handle

1. **Empty Portfolio**: No tickers extracted → Show error
2. **Single Ticker**: Don't show "ALL" button (unnecessary)
3. **Unknown Ticker**: Portfolio has ticker not in Marketstack → Handle gracefully
4. **Same Ticker, Different Symbols**: e.g., "IBIT" vs "O:IBIT" → Normalize

## 📝 Success Criteria

- ✅ Dynamic buttons appear based on portfolio upload
- ✅ Clicking a ticker filters to show only that ticker's data
- ✅ "ALL" button shows combined view
- ✅ No hardcoded IBIT/ETHA references remaining
- ✅ Works with any ticker (AAPL, TSLA, SPY, etc.)
- ✅ All tests pass
- ✅ Linting passes with no errors

## 🔄 Rollback Plan

If issues arise:
- Keep hardcoded buttons as fallback
- Feature flag: `VITE_USE_DYNAMIC_TICKERS=true/false`
- Can revert to IBIT/ETHA only mode
