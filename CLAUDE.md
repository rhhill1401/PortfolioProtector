# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PortfolioProtector is a React + TypeScript + Vite application for real-time market data and AI-powered investment analysis. It allows users to analyze stocks by uploading portfolio CSV files, chart images, and research documents, then generates comprehensive investment recommendations using AI.

## Essential Commands

```bash
# Development
yarn dev          # Start development server on http://localhost:5173

# Build
yarn build        # Type-check and build for production

# Linting
yarn lint         # Run ESLint on all files

# Preview production build
yarn preview      # Preview production build locally
```

## Architecture Overview

### Frontend Stack
- **React 19** with TypeScript for UI
- **Vite** for fast development and building
- **TailwindCSS** with custom color palette
- **Recharts** for data visualization
- **shadcn/ui components** (custom implementations in `/src/components/ui/`)
- **Axios** for API requests
- **PapaParse** for CSV parsing

### Core Components

1. **App.tsx** - Main application shell with header/footer and layout
2. **TickerPriceSearch.tsx** - Stock lookup with real-time quotes from Marketstack API, handles file uploads for portfolio/charts/research
3. **StockAnalysis.tsx** - Displays AI-powered analysis with tabs for recommendations, technical analysis, fundamentals, and entry/exit strategies
4. **UploadStatusTracker.tsx** - Visual progress tracker for file upload readiness

### API Integration

- **Marketstack API** - Real-time stock quotes (requires `VITE_MARKETSTACK_API_KEY`)
- **Yahoo Finance/Stooq** - VIX data with fallback mechanism
- **Supabase Edge Functions** - AI analysis endpoints:
  - `/chart-vision` - Analyzes uploaded chart images using GPT-4 Vision
  - `/integrated-analysis` - Combines all data for comprehensive swing-trade analysis
  - `/stock-analysis` - Legacy endpoint for basic analysis

### State Management

- Component-level state with React hooks
- Custom event system for cross-component communication:
  - `price-update` - Broadcasts price changes
  - `analysis-start` / `analysis-done` - Analysis progress events
  - `analysis-ready` - Delivers completed analysis

### File Upload System

Three upload categories with specific requirements:
1. **Portfolio** - CSV files with positions (symbol, quantity, price)
2. **Charts** - Image files for technical analysis (processed in batches of 3)
3. **Research** - Documents for fundamental analysis

Upload states: `empty` → `uploading` → `processing` → `ready`

### Environment Variables

Required in `.env.local`:
```
VITE_MARKETSTACK_API_KEY=your_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_FN_URL=your_functions_url
```

## Key Technical Details

### TypeScript Configuration
- Strict mode enabled
- Path alias `@/*` maps to `./src/*`
- Multiple tsconfig files for app and node environments

### Styling Approach
- TailwindCSS for utility-first styling
- Custom purple/blue color scheme (#9089FC, #766DFB, #0066FF)
- Responsive design with mobile-first approach

### Data Flow
1. User enters ticker → Marketstack API fetch (500ms debounce)
2. User uploads files → Local processing with state tracking
3. Analysis button → Supabase Edge Function with all data
4. AI response → Update UI components via events

### Error Handling
- Graceful fallbacks for missing data
- Loading states for all async operations
- User-friendly error messages
- Mock data available for development

## Important Patterns

- Always validate environment variables before API calls
- Use proper TypeScript types (see `/src/types/`)
- Handle both successful and error states in UI
- Maintain consistent color scheme and styling
- Use shadcn/ui component patterns for new UI elements
- Chart analysis includes timeframe detection from filenames
- AI responses are validated to use only actual price levels from charts
- Blob URLs are properly cleaned up after use
- Event listeners include cleanup in useEffect hooks

## Explanation Style Preferences
- Always explain solutions using first principles
- Break down complex concepts like explaining to a 10-year-old
- Explain what each part does and why it's needed
- Use simple analogies and step-by-step reasoning

## Troubleshooting Tips
- For any troubleshooting, always use Puppeteer to navigate to localhost:5173

## Code Review Standards
- After implementing any solution, refer to `/docs/CODE_REVIEW_STANDARDS.md`
- Always follow the "Upgrade, Don't Replace" philosophy
- Search for existing implementations before creating new code
- Ensure all changes meet the code review checklist

## Memories
- Perfect what every you did to get that to work remember before we make our next tweeks

## Options Trading Lessons Learned (2025-07-05)

### Critical Data Format Requirements
1. **Contract Signs**: 
   - Negative contracts = SHORT/SOLD positions (e.g., -1, -4, -5)
   - Positive contracts = LONG/BOUGHT positions
   - NEVER use Math.abs() on contract values - the sign carries meaning!

2. **Terminology Clarity**:
   - Position direction: SHORT (sold) vs LONG (bought)
   - Term length: Short-dated (≤365 days) vs Long-dated (>365 days)
   - NEVER use "short calls" when you mean "sold calls" - be explicit

3. **Data Field Handling**:
   - Always calculate `daysToExpiry` from expiry date if missing
   - Check both `premium` and `premiumCollected` fields
   - Add fallback calculations for any missing fields

4. **Premium Calculations**:
   - Formula: premium × 100 × |contracts|
   - Premium is per share, but collected per contract (100 shares)
   - Always use absolute value of contracts for quantity

5. **Backend Response Format**:
   - integrated-analysis must preserve negative contract values
   - portfolio-vision should calculate daysToExpiry and term
   - Always deploy edge functions immediately after changes

### Performance Tab Implementation Status
✅ Completed:
- Position Status card with share count and contract breakdown
- IV Environment card with VIX data
- Assignment Risk card
- Current Positions display with risk-based colors
- Premium calculations
- Days to expiry calculations
- Term classification (short-dated/long-dated)
- Proper SHORT/LONG position labeling

❌ Not Implemented (Optional Phase 6):
- Options Greeks chart showing assignment probabilities
- Wheel Execution, Assignment Success, Continuation Plan tab content