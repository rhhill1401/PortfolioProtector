# PortfolioProtector Implementation Roadmap

Last Updated: July 13, 2025
Status: Phase 3.6 Completed, Phase 3.7 Current (P&L Bug Fix)

## Current Bugs & Issues 🐛

### Critical Bugs (Must Fix)
- [x] **Polygon Date Discovery Failing** - PolygonTester shows "no expiration dates found" due to CORS ✅ FIXED
- [x] **Portfolio Vision Parsing Failing** - AI response JSON parsing fails ✅ FIXED with JSON mode
- [x] **Premium Calculation Wrong** - Was multiplying by 100 unnecessarily ✅ FIXED  
- [x] **Number Formatting** - Shows decimals instead of whole numbers ✅ FIXED
- [ ] **P&L Calculation Incorrect** - Formula needs verification ⚡ CURRENT
- [ ] **AI Response Truncation** - Only 3 of 6 positions returned
- [ ] **Option Greeks Not Fetched** - Need Polygon integration after upload

### Known Issues
- [ ] Can only upload one chart at a time
- [ ] Manual research upload required
- [ ] No persistence/database
- [ ] No chat interface

## Implementation Phases

### 🚨 IMMEDIATE PHASES (Core Bug Fixes)

#### Phase 1: Fix Polygon Option Discovery ✅ COMPLETED
- [x] Create `/option-expirations` Supabase edge function
  - [x] Accept ticker parameter
  - [x] Call Polygon contracts endpoint server-side
  - [x] Return available expirations
  - [x] Filter for Jan 2026, Dec 2025, Nov 2025, Sep 2025
- [x] Update PolygonTester component
  - [x] Remove direct browser → Polygon calls
  - [x] Call new edge function instead
  - [x] Display real expiration dates as buttons
- [x] Test with IBIT ticker

#### Phase 2: Test & Verify Option Data ✅ COMPLETED
- [x] Test $61 strike for each expiration
- [x] Verify complete response structure
- [x] Confirm all fields populated (except bid/ask - known issue)
- [x] Document actual response format

#### Phase 3: Fix Bid/Ask Prices ✅ COMPLETED
- [x] Debug Polygon response in edge function
- [x] Log raw response before normalization
- [x] Fix price calculation (plan limitation - bid/ask requires higher tier)
- [x] Test multiple strikes: 61, 63, 67, 70
- [x] Document plan limitation in response

#### Phase 3.1: Fix Portfolio Vision Parsing Bug ✅ COMPLETED
- [x] Identify root cause of JSON parsing failure (token truncation)
- [x] Fix by implementing OpenAI JSON mode with response_format
- [x] Increase max_tokens from 1000 to 2000 to prevent truncation
- [x] Test with actual portfolio image (test script created)
- [x] Verify all positions extract correctly (6 IBIT + 2 NVDA)
- [x] Deploy fixed edge function
- [x] Document fix in OPENAI_JSON_MODE_FIX.md

#### Phase 3.5: Testing & Debugging Infrastructure ✅ COMPLETED
- [x] Create edge function testers
  - [x] Portfolio vision test script (test-portfolio-vision.cjs)
  - [x] Integrated analysis test script (test-integrated-analysis.cjs)
  - [x] Real data test script (test-integrated-analysis-real-data.cjs)
- [x] Use actual portfolio image for testing
  - [x] /Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png
  - [x] Extracts 6 IBIT + 2 NVDA positions correctly
- [x] Save test responses for debugging
  - [x] Portfolio vision responses saved to JSON
  - [x] Integrated analysis responses saved with timestamps
- [x] Created test infrastructure that helped fix:
  - [x] JSON parsing issues
  - [x] Premium calculation bugs
  - [x] Position extraction verification

### 🚨 CRITICAL BUG FIXES

#### Phase 3.6: Fix Premium Calculation & Display ✅ COMPLETED
- [x] Fix frontend multiplying premium by 100 unnecessarily
- [x] Pre-compute P&L metrics on backend for accuracy
- [x] Fix all dollar displays to show whole numbers only
- [x] Verify total shows $16,219 for 14 contracts
- [x] Document fix in OPTION_PREMIUM_FIX.md

#### Phase 3.7: Fix P&L Calculation Bug ✅ COMPLETED
- [x] Identified issue: Need two P&L metrics (optionMTM vs wheelNet)
- [x] Implemented backend wheel analytics (intrinsic/extrinsic values)
- [x] Enhanced AI prompt with assignment probability analysis
- [x] Added wheel strategy recommendations (HOLD/ROLL/LET_ASSIGN)
- [x] Fixed decimal display to show whole numbers only

#### Phase 3.8: Implement Wheel P&L Patch 🎯 CURRENT
- [ ] Add optionMTM calculation: (premiumCollected - currentValue) × |contracts|
- [ ] Add wheelNet calculation: (strike - costBasis) × 100 × |contracts| + premiumCollected
- [ ] Extract cost basis from portfolio.positions[].purchasePrice
- [ ] Update frontend to display wheelNet prominently, optionMTM as gray text
- [ ] Test end-to-end flow with real portfolio data
- [ ] Verify UI shows correct wheel strategy metrics

#### Phase 3.9: Fetch Option Greeks from Polygon 🎯 NEXT
- [ ] After portfolio upload, extract all option positions
- [ ] Call Polygon API to fetch current Greeks for each position
- [ ] Store Greeks data (delta, gamma, theta, vega, IV)
- [ ] Make Greeks available for wheel strategy recommendations
- [ ] Cache Greeks data to avoid repeated API calls

### 🎯 NEAR-TERM PHASES (Complete Core Features)

#### Phase 4: Fix Wheel Strategy Metrics
- [ ] Debug why metrics don't display
- [ ] Connect real Polygon data to calculations
- [ ] Implement all formulas:
  - [ ] Annualized Return = (credit/capital) × (365/DTE) × 100
  - [ ] Assignment Probability (dynamic)
  - [ ] Compounded 12-month returns
- [ ] Test with real positions

#### Phase 5: Number Formatting
- [ ] Create formatting utilities
- [ ] Currency: 16000 → $16,000 (no cents)
- [ ] Percentages: 0.0825 → 8.25%
- [ ] Apply to all displays:
  - [ ] Performance tab
  - [ ] Wheel metrics
  - [ ] Portfolio values
  - [ ] All financial data

#### Phase 6: Integrate into Main App
- [ ] Update StockAnalysis.tsx
- [ ] Replace ALL hardcoded values
- [ ] Wire real Polygon quotes
- [ ] Test every tab
- [ ] Ensure no regressions

#### Phase 7: Complete Tab Implementation
- [ ] Performance Analysis (fix display)
- [ ] Wheel Execution (NEW - combine with Assignment Success)
  - [ ] Current positions display
  - [ ] Assignment probability
  - [ ] Roll strategies
  - [ ] Success tracking
- [ ] Market Context (market analysis)

#### Phase 8: Multiple Chart Upload
- [ ] Update upload component
- [ ] Handle array of files
- [ ] Process in batches
- [ ] Support different timeframes

#### Phase 9: Additional Testing Tools
- [ ] Option chain viewer
- [ ] Data validation tester
- [ ] Strategy simulator

### 🔮 FUTURE PHASES (Research Spikes)

#### Phase 10: Database Design Spike
- [ ] Research schema design
- [ ] Portfolio version history
- [ ] Strategy tracking
- [ ] Results storage
- [ ] User authentication needs

#### Phase 11: Dynamic Research Fetching Spike
- [ ] Evaluate data sources
- [ ] Legal/licensing review
- [ ] API cost analysis
- [ ] Curation approach

#### Phase 12: Dynamic Chart Fetching Spike
- [ ] Chart API options
- [ ] Licensing concerns
- [ ] Real-time vs snapshot
- [ ] Cost implications

#### Phase 13: Chatbot Integration Spike
- [ ] Wait for UI design
- [ ] Context management
- [ ] Integration approach
- [ ] Response streaming

#### Phase 14: Advanced Features Spike
- [ ] Multiple portfolios
- [ ] Backtesting
- [ ] Risk analytics
- [ ] Performance attribution

## Current Focus 🎯

Working on: **Phase 3.8 - Implement Wheel P&L Patch**

Next up: **Phase 3.9 - Fetch Option Greeks from Polygon**

## Success Criteria ✅

Each phase must:
- Fix bugs without breaking existing features
- Use real data (no mocks in production)
- Include proper error handling
- Format numbers professionally
- Be thoroughly tested