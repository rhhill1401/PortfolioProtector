# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PortfolioProtector is a React + TypeScript + Vite application for real-time market data and AI-powered investment analysis. It allows users to analyze stocks by uploading portfolio CSV files, chart images, and research documents, then generates comprehensive investment recommendations using AI.

## Essential Commands

```bash
# Development
npm run dev       # Start development server on http://localhost:5173

# Build
npm run build     # Type-check and build for production

# Linting - MANDATORY AFTER ANY CODE CHANGES
npm run lint      # Run ESLint on all files - MUST RUN AFTER EVERY CODE CHANGE

# Preview production build
npm run preview   # Preview production build locally
```

## CRITICAL: Code Review Process

**ALWAYS run these steps when reviewing or modifying code:**
1. **Run `npm run lint` IMMEDIATELY after any code changes** - This catches unused variables and other issues
2. **Check ESLint output** - Fix all errors (red) before considering the code complete
3. **Address warnings** - Review yellow warnings for potential issues
4. **Never rely on manual review alone** - Always use automated tools first

### Common Issues ESLint Catches:
- Unused variables (e.g., `'highPrice' is assigned a value but never used`)
- Type safety issues
- Complexity warnings
- Code style violations

## Architecture Overview

### Frontend Stack
- **React 19** with TypeScript for UI
- **Vite** for fast development and building
- **TailwindCSS** with custom color palette
- **Recharts** for data visualization
- **shadcn/ui components** (custom implementations in `/src/components/ui/`)
- **Axios** for API requests
- **PapaParse** for CSV parsing
- **Package Manager**: npm (DO NOT use yarn)

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

## Supabase Deployment Rules

### 1. Authentication Required Before Deployment
**CRITICAL**: Always verify Supabase authentication before attempting any deployments:
```bash
# Check if logged in by testing a simple command
supabase projects list

# If it hangs or fails, login first:
supabase login
```
- The login command opens a browser for authentication
- Without authentication, ALL deployment commands will hang indefinitely with no error message
- Access token is stored in ~/Library/Application Support/supabase/access-token

### 2. Use API Flag for Deployments
**MANDATORY**: Always use `--use-api` flag when deploying Supabase functions:
```bash
# CORRECT - Uses Management API (works)
supabase functions deploy [function-name] --project-ref twnldqhqbybnmqbsgvpq --use-api

# WRONG - Uses Docker (hangs on macOS)
supabase functions deploy [function-name] --project-ref twnldqhqbybnmqbsgvpq
```
- Docker-based bundling (`--use-docker` default) hangs on macOS systems
- The `--use-api` flag uses Supabase's Management API for remote bundling
- This is a known issue with Docker Desktop on macOS

### 3. Use NPM Scripts for Deployment
**ALWAYS USE THESE NPM SCRIPTS** instead of manual Supabase commands:
```bash
# Deploy specific functions
npm run deploy:ia          # Deploy integrated-analysis
npm run deploy:chart       # Deploy chart-vision
npm run deploy:portfolio   # Deploy portfolio-vision
npm run deploy:options     # Deploy all option functions
npm run deploy:all         # Deploy everything

# Test after deployment
npm run test:functions     # Verify functions are working
```
- These scripts automatically include the correct project-ref and --use-api flag
- Prevents forgetting flags or typing wrong project references
- Located in package.json scripts section

### 4. Required Files for Function Deployment
**EVERY Supabase Edge Function MUST have**:
1. `index.ts` - The function code with `Deno.serve()`
2. `deno.json` - Even if just `{"imports": {}}` 
3. No test files in the function directory (move to `/tests/`)

Without `deno.json`, the bundler will hang during deployment

## Code Review Standards
- **FIRST STEP**: Run `npm run lint` to catch all basic issues
- After implementing any solution, refer to `/docs/CODE_REVIEW_STANDARDS.md`
- Always follow the "Upgrade, Don't Replace" philosophy
- Search for existing implementations before creating new code
- Ensure all changes meet the code review checklist
- **NEVER** skip linting - it catches issues humans miss

## Memories
- Perfect what every you did to get that to work remember before we make our next tweeks

### Supabase Deployment Fix (2025-09-07)
**Problem**: Supabase CLI deploy commands were hanging indefinitely without error messages
**Root Causes**: 
1. Not authenticated (`supabase login` required)
2. Docker bundling hangs on macOS (must use `--use-api` flag)
**Solution**: Created npm scripts that automatically use correct flags
**Key Learning**: Always check authentication first when Supabase commands hang

## Package Manager
**IMPORTANT**: This project uses **npm** exclusively. Do NOT use yarn.
- Always use `npm install` for dependencies
- Always use `npm run <script>` for scripts
- The `package-lock.json` file must be committed

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

## Testing Principles
- When performing integrated tests, use real data. Do not hardcode data. So if you're running an end-to-end test, it should be with real data. For example, if you had to upload an image, you should upload a real image, run all the APIs and tests with that data and then show the results. Don't hardcode in data.