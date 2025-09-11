# PortfolioProtector Architecture Guidelines

## 1. System Overview

### Purpose
PortfolioProtector is a real-time market analysis platform that combines AI-powered insights with options trading strategies, specifically focusing on the Wheel Strategy. It provides comprehensive investment analysis by processing portfolio data, technical charts, and research documents through GPT-4.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │TickerPrice   │  │StockAnalysis │  │ Upload       │      │
│  │Search        │  │              │  │StatusTracker │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ Events & API Calls
┌────────────────────────┴────────────────────────────────────┐
│                   Supabase Edge Functions                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │integrated-   │  │chart-vision  │  │option-quote  │      │
│  │analysis-v2   │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ External APIs
┌────────────────────────┴────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │OpenAI GPT-4  │  │Polygon.io    │  │Marketstack   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript | UI Framework |
| **Build Tool** | Vite | Fast development & bundling |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Charts** | Recharts | Data visualization |
| **Components** | shadcn/ui | Reusable UI components |
| **Backend** | Supabase Edge Functions | Serverless API endpoints |
| **Runtime** | Deno | Edge function runtime |
| **AI** | OpenAI GPT-4 | Analysis & vision processing |
| **Market Data** | Marketstack, Polygon.io | Real-time quotes & options |
| **Package Manager** | npm (NOT yarn) | Dependency management |

## 2. Frontend Architecture

### Component Hierarchy

```
App.tsx
├── Header (logo, navigation)
├── Main Content
│   ├── TickerPriceSearch
│   │   ├── SearchInput
│   │   ├── PriceDisplay
│   │   ├── UploadTabs
│   │   │   ├── PortfolioTab
│   │   │   ├── ChartsTab
│   │   │   └── ResearchTab
│   │   └── AnalysisButton
│   ├── UploadStatusTracker
│   └── StockAnalysis
│       ├── PerformanceTab
│       ├── WheelExecutionTab
│       ├── RecommendationsTab
│       └── TechnicalAnalysisTab
└── Footer
```

### State Management Patterns

#### Local Component State
- Each component manages its own state using React hooks
- No global state management library (Redux/Zustand)
- State lifted to parent components when shared

#### Cross-Component Communication
Custom event system using browser events:

```typescript
// Dispatching events
window.dispatchEvent(new CustomEvent('price-update', { 
  detail: { price, change, percent } 
}));

// Listening to events
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setData(e.detail);
  };
  window.addEventListener('analysis-ready', handler);
  return () => window.removeEventListener('analysis-ready', handler);
}, []);
```

**Event Types:**
- `price-update`: Stock price changes
- `analysis-start`: Analysis begins
- `analysis-done`: Analysis completes
- `analysis-ready`: Results available

### File Upload Pipeline

```
User selects file → FileReader API → Process locally → Update state
                                          ↓
                                    Parse/Validate
                                          ↓
                                    Store in state
                                          ↓
                                    Update UI status
```

**Upload States:** `empty` → `uploading` → `processing` → `ready`

### Key Design Patterns

1. **Composition over Inheritance**: Small, focused components
2. **Container/Presenter Pattern**: Logic in containers, UI in presenters
3. **Custom Hooks**: Reusable logic extraction
4. **Event-Driven Updates**: Loose coupling between components

## 3. Backend Architecture (Supabase Edge Functions)

### Function Responsibilities

| Function | Purpose | External APIs |
|----------|---------|---------------|
| `integrated-analysis-v2` | Main AI analysis orchestrator | OpenAI GPT-4 |
| `chart-vision` | Technical chart image analysis | OpenAI GPT-4 Vision |
| `portfolio-vision` | Portfolio screenshot processing | OpenAI GPT-4 Vision |
| `option-quote` | Single option contract quotes | Polygon.io |
| `option-chain` | Full option chain data (deprecated) | Polygon.io |
| `option-expirations` | Available expiration dates | Polygon.io |

### Data Processing Flow

```
1. Receive request with auth headers
2. Validate input parameters
3. Call external APIs with proper keys
4. Transform/normalize response data
5. Apply business logic (calculations)
6. Cache if appropriate
7. Return standardized response
```

### Error Handling Strategy

```typescript
try {
  // Main logic
} catch (error) {
  console.error('[FUNCTION_NAME] Error:', error);
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: error.message 
    }),
    { status: 500, headers: corsHeaders }
  );
}
```

### Caching Strategies

- **Greeks Cache**: 1-hour TTL in localStorage
- **Option Quotes**: 30-second in-memory cache
- **Chart Analysis**: No cache (always fresh)
- **Portfolio Data**: Session-based

## 4. External API Integrations

### Marketstack API
- **Purpose**: Real-time stock quotes
- **Rate Limit**: 1000 requests/month (free tier)
- **Implementation**: Direct frontend calls with 500ms debounce
- **Fallback**: Manual price entry

### Polygon.io API
- **Purpose**: Options data, Greeks calculations
- **Plan**: Options Starter ($29/month)
- **Rate Limit**: 50 requests/10 seconds
- **CORS Issue**: All calls proxied through Supabase
- **Key Challenge**: Incomplete Greeks data sometimes

### OpenAI GPT-4
- **Models Used**: 
  - `gpt-4-turbo-preview`: Analysis
  - `gpt-4-vision-preview`: Image processing
  - `gpt-4o`: Reasoning model (v2)
- **Token Limits**: ~8000 tokens per request
- **Response Format**: Structured JSON

### Yahoo Finance/Stooq (VIX)
- **Purpose**: VIX volatility index
- **Implementation**: Fallback mechanism
- **No API key required**

## 5. Data Flow & Processing

### End-to-End User Journey

```
1. User enters ticker symbol
   → Marketstack API call
   → Display real-time quote
   
2. User uploads portfolio
   → Parse CSV/process image
   → Extract positions
   → Normalize option contracts
   
3. User uploads charts (max 3)
   → Convert to base64
   → Queue for batch processing
   
4. User clicks "Get AI Analysis"
   → Fetch Greeks for positions
   → Build analysis payload
   → Call integrated-analysis-v2
   → Process AI response
   → Display in tabs
```

### Critical Data Transformations

#### Date Format Normalization
```typescript
// Input formats: "Jul-18-2025", "2025-07-18", "07/18/2025"
// Output format: "2025-07-18" (ISO)
```

#### Greeks Key Format
```typescript
// Frontend: "IBIT-72-2025-09-30-CALL"
// Backend lookup: Must match exactly (uppercase)
```

#### Premium Calculations
```typescript
// Per-share → Total: premium × 100 × |contracts|
// Handle both formats from portfolio-vision
```

## 6. Development Standards

### Core Philosophy: "Upgrade, Don't Replace"
- Extend existing code before creating new
- Search for reusable patterns first
- Prevent codebase bloat

### TypeScript Requirements
```typescript
// ❌ BAD
const data: any = fetchData();

// ✅ GOOD
interface DataResponse {
  positions: OptionPosition[];
  totalValue: number;
}
const data: DataResponse = fetchData();
```

### Code Organization Rules
1. **No `any` types** - Use proper interfaces
2. **Single Responsibility** - One component, one job
3. **DRY Principle** - Extract common logic
4. **KISS Principle** - Simple solutions first
5. **Error Boundaries** - Handle failures gracefully

### Import Order Convention
```typescript
// 1. React/core libraries
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import axios from 'axios';

// 3. Local components
import { Button } from '@/components/ui/button';

// 4. Types
import type { OptionPosition } from '@/types/portfolio';

// 5. Utils/services
import { calculateGreeks } from '@/utils/options';
```

## 7. Deployment & Operations

### Supabase Deployment Rules

**Critical**: Always use `--use-api` flag on macOS to avoid Docker hangs

```bash
# ✅ CORRECT
supabase functions deploy integrated-analysis-v2 --project-ref twnldqhqbybnmqbsgvpq --use-api

# ❌ WRONG (will hang)
supabase functions deploy integrated-analysis-v2 --project-ref twnldqhqbybnmqbsgvpq
```

### NPM Scripts for Deployment

```bash
npm run deploy:ia          # Deploy integrated-analysis
npm run deploy:ia-v2       # Deploy integrated-analysis-v2
npm run deploy:chart       # Deploy chart-vision
npm run deploy:portfolio   # Deploy portfolio-vision
npm run deploy:options     # Deploy all option functions
npm run deploy:all         # Deploy everything
```

### Environment Variables

#### Frontend (.env.local)
```bash
VITE_MARKETSTACK_API_KEY=<your_key>
VITE_SUPABASE_URL=https://twnldqhqbybnmqbsgvpq.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
VITE_SUPABASE_FN_URL=<your_functions_url>
```

#### Backend (Supabase Dashboard)
```bash
OPENAI_API_KEY=<your_openai_key>
POLYGON_API_KEY=<your_polygon_key>
```

### Authentication Requirements
1. Run `supabase login` before any deployments
2. Access token stored in `~/Library/Application Support/supabase/access-token`
3. Check auth with `supabase projects list`

## 8. Project Structure

```
PortfolioProtector/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI components
│   │   └── *.tsx        # Feature components
│   ├── services/        # Business logic & API calls
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── assets/          # Static assets
├── supabase/
│   └── functions/       # Edge functions (Deno)
├── docs/                # Documentation
│   └── bugs-and-fixes/  # Bug tracking
├── rules/               # Project rules & standards
├── tests/               # Test files
└── public/              # Static public files
```

### File Naming Conventions
- **Components**: PascalCase (`StockAnalysis.tsx`)
- **Utils/Services**: camelCase (`greeksFetcher.ts`)
- **Types**: camelCase (`portfolio.ts`)
- **Edge Functions**: kebab-case (`integrated-analysis`)

## 9. Known Issues & Solutions

### Issue: Greeks Display as N/A

**Problem**: Theta, IV, Gamma show N/A while Delta works

**Root Causes**:
1. Key mismatch between frontend/backend
2. LLM dropping fields from response
3. Cache storing incomplete data

**Solutions**:
1. Normalize keys to uppercase in backend
2. Post-process AI response to patch missing Greeks
3. Validate data before caching

### Issue: Date Format Inconsistency

**Problem**: Multiple date formats cause API failures

**Solution**: Centralized date normalization to ISO format (YYYY-MM-DD)

### Issue: CORS with Polygon API

**Problem**: Direct browser calls to Polygon fail

**Solution**: All Polygon calls proxied through Supabase Edge Functions

### Issue: Portfolio Multiple Tickers

**Problem**: Portfolio contains multiple tickers but analysis for one

**Solution**: Filter positions by current ticker before Greeks fetch

## 10. Testing & Quality Assurance

### Testing Principles

1. **Use Real Data**: Never use mocks for integration tests
2. **End-to-End Flow**: Test complete user journeys
3. **Console Logging**: Gate behind `import.meta.env.DEV`
4. **Error Scenarios**: Always test failure paths

### Debug Logging Strategy

```typescript
const DEBUG = import.meta.env.DEV;

if (DEBUG) {
  console.log('🎯 [GREEKS] Fetching for positions:', positions);
}
```

### Critical Test Scenarios
- Portfolio with missing data (dashes)
- Multiple ticker positions
- Options near expiration
- Weekend/holiday dates
- API rate limiting

## 11. Security Considerations

### API Key Management
- Frontend keys in `.env.local` (gitignored)
- Backend keys in Supabase dashboard
- Never commit secrets to repository

### Input Validation
```typescript
// Validate at boundaries
if (!ticker || ticker.length > 10) {
  throw new Error('Invalid ticker symbol');
}
```

### XSS Prevention
- React handles escaping by default
- Avoid `dangerouslySetInnerHTML`
- Sanitize user inputs before API calls

### Rate Limiting Protection
- Frontend: Debouncing (500ms)
- Backend: Queue system for Greeks
- Polygon: 100ms delay between requests

## 12. Performance Optimization

### Frontend Optimizations

1. **Batch Processing**: Charts analyzed 3 at a time
2. **Debouncing**: 500ms for ticker search
3. **Memoization**: 
```typescript
const memoizedValue = useMemo(() => 
  expensiveCalculation(data), [data]
);
```
4. **Lazy Loading**: Components loaded on demand

### Backend Optimizations

1. **Caching**: Greeks cached for 1 hour
2. **Parallel Processing**: Multiple API calls in parallel
3. **Early Returns**: Fail fast on validation
4. **Compression**: Responses gzipped

### Bundle Size Management
- Check imports (avoid full library imports)
- Code splitting for large components
- Tree shaking enabled in Vite

## Key Architecture Principles

1. **All Polygon calls must proxy through Supabase** (CORS restriction)
2. **Always use npm, never yarn** (consistency)
3. **Test with real data flows** (accuracy)
4. **Greeks require YYYY-MM-DD format** (API requirement)
5. **Filter positions by ticker before analysis** (relevance)
6. **Extend existing code before writing new** (maintainability)
7. **Handle errors at boundaries** (robustness)
8. **Cache with validation** (performance + correctness)

## Monitoring & Debugging

### Key Metrics to Track
- API response times
- Greeks fetch success rate
- Analysis generation time
- Error rates by function

### Debug Commands
```bash
# Check Supabase function logs
supabase functions logs integrated-analysis-v2 --project-ref twnldqhqbybnmqbsgvpq

# Clear Greeks cache
localStorage.removeItem('greeks-cache')

# Test edge function locally
supabase functions serve integrated-analysis-v2 --no-verify-jwt
```

## Future Considerations

### Planned Enhancements
- User authentication system
- Data persistence layer
- Real-time WebSocket updates
- Mobile responsive design
- Advanced caching strategies

### Technical Debt
- Refactor large components (StockAnalysis.tsx)
- Extract shared Edge Function logic
- Standardize error handling
- Add comprehensive test coverage

---

*This architecture document is a living document and should be updated as the system evolves. Last updated: September 2025*