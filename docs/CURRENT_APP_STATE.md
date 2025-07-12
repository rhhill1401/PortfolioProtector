# PortfolioProtector Current Application State

## Overview
PortfolioProtector is a React + TypeScript application for real-time market data and AI-powered investment analysis, specializing in the Wheel Strategy for options trading.

## Working Features ✅

### 1. Market Data Integration
- **Real-time stock quotes** from Marketstack API
- **VIX data** from Yahoo Finance with Stooq fallback
- **Price updates** with 500ms debounce
- **Current price display** with daily change indicators

### 2. File Upload System
- **Portfolio Upload**: 
  - Accepts CSV or image files
  - AI vision extracts positions from screenshots
  - Detects stock positions and option positions
  - Calculates total portfolio value
  
- **Chart Upload**:
  - Accepts multiple chart images
  - AI analyzes technical patterns
  - Extracts support/resistance levels
  - Processes in batches

- **Research Upload**:
  - Document analysis for fundamental research
  - Sentiment extraction

### 3. AI Analysis Pipeline
- **Portfolio Vision** (`/portfolio-vision`): Extracts positions from images
- **Chart Vision** (`/chart-vision`): Analyzes chart patterns
- **Integrated Analysis** (`/integrated-analysis`): Combines all data for comprehensive analysis

### 4. Wheel Strategy Analysis
- Detects current phase (COVERED_CALL or CASH_SECURED_PUT)
- Analyzes existing option positions
- Provides recommendations for each position
- Calculates P&L and assignment risk

### 5. UI Components
- **TickerPriceSearch**: Main component handling search and uploads
- **StockAnalysis**: Displays analysis results in tabs
- **UploadStatusTracker**: Visual progress for file readiness

## Current Data Flow

```
User Input → File Upload → AI Processing → Edge Functions → Analysis Display
     ↓            ↓              ↓                ↓              ↓
  Ticker      Portfolio      Chart Vision    Integrated    Performance
  Search      CSV/Image      GPT-4 Vision    Analysis        Tab
```

## Recent Bug Fixes ✅

### AI Invented Prices Error
**Problem**: Validator was rejecting legitimate rounded numbers
**Solution**: Disabled overly aggressive price validation
**Result**: AI can now reference portfolio values naturally

### Type Safety Issues
**Problem**: Missing keyLevels in TypeScript interface
**Solution**: Updated ChartAnalysisResult interface
**Result**: Proper type checking for chart analysis

## Known Issues & Limitations

### UI/UX
1. Single column layout in performance tab (needs two columns)
2. Premium display shows per-share price instead of total collected
3. Gray banner spacing issue in strategic investment section
4. Missing total premium collected summary

### Data Display
1. Performance tab shows basic info, needs enhancement
2. No options Greeks visualization
3. No aggregate wheel strategy metrics

### Technical Debt
1. Some TypeScript `any` types need proper typing
2. Component re-rendering could be optimized
3. Mock data still present in some areas

## Environment Configuration

### Required Environment Variables
```
VITE_MARKETSTACK_API_KEY=your_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_FN_URL=your_functions_url
```

### Edge Functions Deployed
- `integrated-analysis` - Main analysis endpoint
- `chart-vision` - Chart pattern analysis
- `portfolio-vision` - Portfolio extraction from images
- `stock-analysis` - Legacy endpoint

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS, shadcn/ui components
- **Data Viz**: Recharts
- **API Client**: Axios
- **CSV Parsing**: PapaParse
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: OpenAI GPT-4 Vision API

## Testing Approach
- Manual testing via browser
- Direct edge function testing with Node.js scripts
- Console logging for debugging
- Browser developer tools integration

## Next Steps
1. Enhance performance tab with two-column layout
2. Fix premium calculations and display
3. Add status cards (Position, IV, Assignment Risk)
4. Implement wheel strategy metrics
5. Add options Greeks visualization