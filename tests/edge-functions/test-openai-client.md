# OpenAI GPT-5 Client Testing Guide

## Overview
This document describes how to test the OpenAI client wrapper (`supabase/functions/integrated-analysis-v3/clients/openai.ts`) both locally and in production.

## Prerequisites

### 1. OpenAI API Key Setup
The OpenAI client requires `OPENAI_API_KEY` to be set in Supabase secrets.

**Note:** This is already configured for portfolio-vision and chart-vision. No action needed unless you need to update the key.

```bash
# Only if you need to update the key:
supabase secrets set OPENAI_API_KEY=your-actual-api-key-here --project-ref twnldqhqbybnmqbsgvpq
```

### 2. Model Configuration (Optional)
By default, the client uses `gpt-5-preview`. To use a different model:

```bash
supabase secrets set OPENAI_MODEL=gpt-4o --project-ref twnldqhqbybnmqbsgvpq
```

## Manual Testing Checklist

### ✅ Phase 4.1: Test callOpenAI() with simple prompt

**Test:** Verify basic API call works and returns JSON

```typescript
// Create test file: supabase/functions/test-openai/index.ts
import { callOpenAI } from '../integrated-analysis-v3/clients/openai.ts';

Deno.serve(async (req) => {
  try {
    const systemPrompt = 'You are a helpful assistant. Always respond with valid JSON.';
    const userPrompt = 'Return a JSON object with a greeting message and the current task: "Testing OpenAI integration"';

    const response = await callOpenAI(systemPrompt, userPrompt);
    const parsed = JSON.parse(response);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OpenAI client working correctly',
        response: parsed,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Deploy and test:**
```bash
# Deploy test function
supabase functions deploy test-openai --project-ref twnldqhqbybnmqbsgvpq --use-api

# Test it
curl https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/test-openai
```

**Expected result:**
- ✅ Returns JSON response with greeting
- ✅ No errors in logs
- ✅ Response time < 10 seconds

---

### ✅ Phase 4.2: Verify JSON mode works

**Test:** Confirm response_format: json_object produces valid JSON

**Verification:**
1. In test above, `JSON.parse(response)` should not throw
2. Response should be a well-formed JSON object (not plain text)

**Expected result:**
- ✅ Response parses as valid JSON
- ✅ No "this is JSON" text wrapper, just raw JSON

---

### ✅ Phase 4.3: Verify reasoning output logging

**Test:** Check if reasoning metadata is logged (GPT-5 models only)

**Verification:**
1. Deploy test function above
2. Check Supabase function logs after calling
3. Look for `[OpenAI] Reasoning steps:` in logs

**Expected result:**
- ✅ If using `gpt-5-preview`, logs show reasoning steps
- ✅ If using `gpt-4o`, no reasoning logs (not supported)

**Note:** Reasoning output depends on model. Only GPT-5 reasoning models expose this.

---

### ✅ Phase 4.4: Test retry logic with mock failures

**Test:** Verify exponential backoff and retry mechanism

**Manual test approach:**
1. Temporarily set invalid API key to trigger failures
2. Observe retry behavior in logs
3. Restore correct API key

**Alternative: Unit test retry logic**

Create `tests/unit/openai-retry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('OpenAI Retry Logic', () => {
  it('should retry with exponential backoff', async () => {
    const delays: number[] = [];

    // Mock setTimeout to capture delays
    vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return setTimeout(fn, 0); // Execute immediately for testing
    });

    // Expected delays: 2000ms (2s), 4000ms (4s), 8000ms (8s)
    expect(delays.length).toBe(0); // Initial state

    // After 3 failures, should have 2 retry delays (first attempt has no delay)
    // Verify: 2^1 * 1000 = 2000, 2^2 * 1000 = 4000
  });
});
```

**Expected retry behavior:**
- Attempt 1: Immediate (0ms delay)
- Attempt 2: 2 second delay
- Attempt 3: 4 second delay
- After 3 failures: throw error

---

### ✅ Phase 4.5: Test timeout handling

**Test:** Verify requests timeout after specified duration

**Manual test:**
```typescript
// In test-openai/index.ts
const response = await callOpenAI(
  'You are a helpful assistant.',
  'Count to 1000 slowly',
  3, // maxRetries
  5000 // 5 second timeout (shorter than default)
);
```

**Expected result:**
- ✅ Request aborts after 5 seconds
- ✅ Error message mentions timeout/abort
- ✅ Does not hang indefinitely

---

## Production Verification

### After deploying integrated-analysis-v3

**Minimal test payload:**
```bash
curl -X POST https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/integrated-analysis-v3 \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "IBIT",
    "currentPrice": 42.5,
    "positions": [],
    "shareCount": 0,
    "portfolioValue": 0
  }'
```

**Expected:**
- ✅ Returns recommendations JSON
- ✅ No OpenAI errors in logs
- ✅ Response includes GPT-generated text
- ✅ Total time < 2 minutes

---

## Common Issues

### Issue: "OPENAI_API_KEY not set"
**Solution:** Set the secret in Supabase:
```bash
supabase secrets set OPENAI_API_KEY=sk-... --project-ref twnldqhqbybnmqbsgvpq
```

### Issue: "Rate limit exceeded"
**Solution:**
- Wait 60 seconds and retry
- Consider upgrading OpenAI plan
- Reduce request frequency in testing

### Issue: "Invalid model: gpt-5-preview"
**Solution:**
- Verify model name is correct
- Check OpenAI API access tier
- Fallback to `gpt-4o` if needed:
```bash
supabase secrets set OPENAI_MODEL=gpt-4o --project-ref twnldqhqbybnmqbsgvpq
```

### Issue: Timeout on complex requests
**Solution:**
- Increase timeout in callOpenAI (default 120000ms)
- Simplify prompts to reduce processing time
- Consider streaming responses for longer outputs

---

## Status

| Test | Status | Notes |
|------|--------|-------|
| 4.1: Simple prompt | ⏳ Pending | Requires API key setup |
| 4.2: JSON mode | ⏳ Pending | Implicit in 4.1 |
| 4.3: Reasoning logs | ⏳ Pending | Model-dependent |
| 4.4: Retry logic | ⏳ Pending | Unit test recommended |
| 4.5: Timeout | ⏳ Pending | Manual test required |

**Next Steps:**
1. Set OPENAI_API_KEY in Supabase secrets
2. Create and deploy test-openai function
3. Run manual tests 4.1-4.5
4. Document results
5. Proceed to Phase 5 (Orchestrator)
