# Supabase Edge Functions Agent Guide

This guide helps AI agents work effectively with Supabase Edge Functions in the PortfolioProtector project.

## Critical Deployment Rules

### 1. Authentication ALWAYS Required
```bash
# FIRST CHECK if authenticated (this will fail if not logged in)
supabase projects list

# If it hangs or fails, login first
supabase login
```
⚠️ **WARNING**: Without authentication, ALL deployment commands hang indefinitely with NO error message.

### 2. MANDATORY --use-api Flag on macOS
```bash
# ✅ CORRECT - Uses Management API
supabase functions deploy [function-name] --project-ref twnldqhqbybnmqbsgvpq --use-api

# ❌ WRONG - Hangs on macOS due to Docker issues
supabase functions deploy [function-name] --project-ref twnldqhqbybnmqbsgvpq
```

### 3. Always Use NPM Scripts
```bash
# Deploy specific functions
npm run deploy:ia          # integrated-analysis
npm run deploy:ia-v2       # integrated-analysis-v2 (GPT-5)
npm run deploy:chart       # chart-vision
npm run deploy:portfolio   # portfolio-vision
npm run deploy:options     # all option functions
npm run deploy:all         # everything

# Test deployments
npm run test:functions     # Verify functions work
```

## Edge Function Structure

### Required Files for Each Function
```
function-name/
├── index.ts     # Main function code with Deno.serve()
└── deno.json    # Required even if just {"imports": {}}
```

⚠️ **Without deno.json, deployment will hang!**

## Function-Specific Guidelines

### integrated-analysis-v2 (Main Orchestrator)
**Purpose**: Coordinates all AI analysis using GPT-5 reasoning model
**Model**: `gpt-5-reasoning`
**Key Responsibilities**:
- Orchestrates portfolio, charts, and research data
- Generates Wheel Strategy recommendations
- Produces structured JSON response

**Common Issues**:
- Missing Greeks fields → Post-process to patch
- Date format mismatches → Normalize to ISO (YYYY-MM-DD)
- Large payloads → Check token limits (~8000)

### chart-vision
**Purpose**: Analyzes technical chart images
**Model**: `gpt-4-vision-preview`
**Key Points**:
- Processes up to 3 charts in batch
- Extracts price levels, trends, patterns
- Returns timeframe-aware analysis

### portfolio-vision
**Purpose**: Extracts positions from screenshots/CSVs
**Model**: `gpt-4-vision-preview`
**Critical Processing**:
- Handles both CSV and image inputs
- Normalizes date formats
- Preserves position signs (negative = SHORT)
- Calculates `daysToExpiry` if missing

### option-quote
**Purpose**: Fetches single option contract data
**API**: Polygon.io
**Rate Limiting**: 50 requests/10 seconds
**Caching**: 30-second in-memory cache

### market-context
**Purpose**: Aggregates market indicators
**Data Sources**:
- VIX from Yahoo/Stooq
- ETF flows
- NAV premium/discount

**Implementation Notes**:
- Fallback mechanisms for each data source
- Real-time updates with caching

## Common Troubleshooting

### Deployment Hangs
1. Check authentication: `supabase login`
2. Ensure `--use-api` flag is used
3. Verify `deno.json` exists in function directory

### Function Returns 500 Error
```bash
# Check logs
supabase functions logs [function-name] --project-ref twnldqhqbybnmqbsgvpq
```

### CORS Issues
- All Polygon.io calls MUST go through Edge Functions
- Direct browser calls will fail

### Greeks Data Missing
- Normalize keys to uppercase
- Validate before caching
- Post-process AI responses to patch missing fields

## Environment Variables

### Required in Supabase Dashboard
```
OPENAI_API_KEY=sk-...
POLYGON_API_KEY=...
```

### Testing Locally
```bash
# Serve function locally
supabase functions serve [function-name] --no-verify-jwt

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/[function-name]' \
  --header 'Content-Type: application/json' \
  --data '{"your": "payload"}'
```

## Error Handling Pattern

```typescript
try {
  // Main logic

  // Always validate inputs
  if (!requiredField) {
    throw new Error('Missing required field');
  }

  // Make API calls
  const response = await fetch(...);

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  // Process and return
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: corsHeaders }
  );

} catch (error) {
  console.error(`[${FUNCTION_NAME}] Error:`, error);
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message
    }),
    { status: 500, headers: corsHeaders }
  );
}
```

## Performance Optimization

### Caching Strategy
- Greeks: 1-hour TTL in localStorage
- Option quotes: 30-second in-memory
- Market data: 5-minute cache
- Charts: No cache (always fresh)

### Parallel Processing
```typescript
// Good - Parallel API calls
const [greeks, quotes, vix] = await Promise.all([
  fetchGreeks(positions),
  fetchQuotes(tickers),
  fetchVIX()
]);

// Bad - Sequential calls
const greeks = await fetchGreeks(positions);
const quotes = await fetchQuotes(tickers);
const vix = await fetchVIX();
```

### Rate Limiting Protection
```typescript
// Add delay between Polygon calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const position of positions) {
  const data = await fetchOption(position);
  await delay(100); // 100ms between calls
}
```

## Testing Checklist

Before deploying:
- [ ] Test with real market data
- [ ] Verify error handling
- [ ] Check rate limiting
- [ ] Validate response format
- [ ] Test edge cases (weekends, missing data)
- [ ] Verify CORS headers

## Quick Reference

### Deploy a Function
```bash
npm run deploy:ia-v2
```

### Check Function Logs
```bash
supabase functions logs integrated-analysis-v2 --project-ref twnldqhqbybnmqbsgvpq
```

### Test Function Locally
```bash
supabase functions serve integrated-analysis-v2 --no-verify-jwt
```

### Fix Common Issues
- Hang → Check auth & use --use-api
- 500 Error → Check logs
- CORS → Ensure headers in response
- Missing data → Validate & patch response

## Key Principles

1. **Always authenticate before deploying**
2. **Use npm scripts (includes correct flags)**
3. **Test with real data, not mocks**
4. **Handle errors at boundaries**
5. **Cache with validation**
6. **Use parallel processing where possible**
7. **Respect rate limits**
8. **Log errors for debugging**

## Contact Points

- Project Ref: `twnldqhqbybnmqbsgvpq`
- Region: US East
- Dashboard: https://supabase.com/dashboard/project/twnldqhqbybnmqbsgvpq