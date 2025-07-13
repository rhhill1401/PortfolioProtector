# PortfolioProtector - Complete Project Overview

## Project Summary

PortfolioProtector is a React + TypeScript application that provides real-time market data and AI-powered investment analysis. Users analyze stocks by uploading portfolio CSVs, chart images, and research documents. The system generates comprehensive investment recommendations using GPT-4, with a focus on wheel strategy options trading.

## Architecture Overview

### Frontend Stack
- **React 19** with TypeScript
- **Vite** for build/dev server
- **TailwindCSS** for styling
- **Recharts** for data visualization
- **shadcn/ui** components (custom implementations)
- **Axios** for HTTP requests
- **PapaParse** for CSV parsing

### Backend Services
- **Supabase Edge Functions** (Deno runtime)
- **OpenAI GPT-4** for analysis
- **Marketstack API** for stock quotes
- **Polygon.io API** for options data
- **Yahoo Finance/Stooq** for VIX data

## Current Application State

### What's Working ✅
1. Stock ticker search with real-time quotes
2. File uploads (portfolio, charts, research)
3. AI analysis generation
4. Tab-based results display
5. Basic Polygon integration (for known dates)

### What's Broken ❌
1. **Polygon Option Discovery** - Can't fetch available dates (CORS)
2. **Wheel Strategy Metrics** - Not displaying on Performance tab
3. **Bid/Ask Prices** - Returning null from Polygon
4. **Number Formatting** - Raw numbers without currency format

## API Keys & Environment

```bash
# .env.local
VITE_MARKETSTACK_API_KEY=your_key
VITE_SUPABASE_URL=https://twnldqhqbybnmqbsgvpq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_FN_URL=your_functions_url

# Supabase Edge Functions (set in dashboard)
OPENAI_API_KEY=your_openai_key
POLYGON_API_KEY=UgMrYPQ2pvp8ClkTvuEsWZ7jLj7B_ixu
```

## Key Components

### Frontend Components

1. **App.tsx** - Main app shell, routing
2. **TickerPriceSearch.tsx** - Stock lookup, file uploads
3. **StockAnalysis.tsx** - Analysis display with tabs
4. **UploadStatusTracker.tsx** - Upload progress UI
5. **PolygonTester.tsx** - Testing component for options

### Edge Functions

1. **`/integrated-analysis`**
   - Combines all uploaded data
   - Sends to GPT-4 for analysis
   - Returns comprehensive trading recommendations

2. **`/chart-vision`**
   - Analyzes chart images using GPT-4 Vision
   - Extracts price levels, patterns, trends

3. **`/option-quote`**
   - Fetches individual option quotes from Polygon
   - Handles CORS by proxying requests
   - Currently has bid/ask null issue

4. **`/option-chain`** (deprecated)
   - Was for fetching full option chains
   - Too broad, replaced by option-quote

## Current Bug Details

### 1. Polygon Date Discovery (CORS)
```javascript
// PolygonTester.tsx - THIS FAILS
const url = `https://api.polygon.io/v3/reference/options/contracts?...`
const response = await fetch(url); // CORS error
```
**Fix**: Need edge function to proxy this call

### 2. Wheel Metrics Not Showing
- Data exists in `analysisData.wheelAnalysis`
- Not displaying on Performance tab
- Possible state/rendering issue

### 3. Bid/Ask Null Issue
```javascript
// option-quote/index.ts line 136-137
ask = option.last_quote.ask / 10000; // May be wrong
bid = option.last_quote.bid / 10000;
```
**Fix**: Need to verify Polygon's actual format

### 4. Number Formatting
- Currently: `16000`
- Needed: `$16,000`
- Affects all financial displays

## Data Flow

1. User enters ticker → Marketstack API
2. User uploads files → Local processing
3. "Get AI Analysis" → Supabase Edge Functions
4. Edge Functions → OpenAI GPT-4
5. Results → Update UI via events

## Event System

```javascript
// Custom events for cross-component communication
window.dispatchEvent(new CustomEvent('price-update', { detail }));
window.dispatchEvent(new CustomEvent('analysis-ready', { detail }));
```

## File Structure
```
/src
  /components - React components
  /hooks - Custom React hooks
  /services - Business logic
  /types - TypeScript types
  /utils - Utilities
/supabase/functions - Edge functions
```

## Testing Approach

Currently testing requires full upload flow. Phase 3.5 will add:
- Direct edge function testing
- Saved test scenarios
- Mock data generation

## Next Steps

1. Fix Polygon CORS issue (Phase 1)
2. Verify option data structure (Phase 2)
3. Fix bid/ask prices (Phase 3)
4. Add test infrastructure (Phase 3.5)
5. Fix wheel metrics display (Phase 4)

## Known Constraints

- Polygon API: Options Starter plan ($29/month)
- Rate limits on all APIs
- CORS restrictions require edge functions
- No persistence (yet)
- Single user (no auth)

## Development Commands

```bash
yarn dev      # Start dev server
yarn build    # Build for production
yarn lint     # Run ESLint
yarn preview  # Preview production build

# Test modes
http://localhost:5173?test=polygon  # Polygon tester
```

## Critical Information for Continuation

If starting fresh:
1. Current focus: Creating `/option-expirations` edge function
2. PolygonTester needs update to use edge function
3. Must test with strikes: 61, 63, 67, 70
4. Target months: Jan 2026, Dec 2025, Nov 2025, Sep 2025
5. All Polygon calls must go through Supabase (CORS)