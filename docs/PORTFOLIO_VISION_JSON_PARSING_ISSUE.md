# Portfolio Vision JSON Parsing Issue - Troubleshooting Guide

## Problem Summary
The `portfolio-vision` Supabase edge function is failing to parse AI responses even after implementing OpenAI's JSON mode. The function should extract stock and option positions from portfolio screenshots but returns zero positions with JSON parsing errors.

## SOLUTION FOUND
The issue was that the system prompt's JSON example contained TypeScript-style type annotations (e.g., `"optionType": "CALL" | "PUT"`) which are not valid JSON. The model was copying these literals, causing parse errors.

## Error Details
When running the test script with a valid portfolio image, we get:
```
📋 [SUCCESS]: true
📊 [PORTFOLIO DETECTED]: false
💰 [TOTAL VALUE]: 0
🎯 [CONFIDENCE]: low
📝 [NOTES]: JSON parsing failed despite JSON mode. This is unusual. Error: Expected ',' or '}' after property value in JSON at position 3375 (line 127 column 22)
```

## Expected vs Actual Results
**Expected to extract:**
- IBIT stock: 1,400 shares @ $67.21
- IBIT 61 Call (Jul-19-2025): -1 contract
- IBIT 62 Call (Aug-15-2025): -1 contract
- IBIT 63 Call (Aug-15-2025): -4 contracts
- IBIT 70 Call (Dec-17-2027): -2 contracts
- IBIT 80 Call (Dec-17-2027): -5 contracts
- IBIT 90 Call (Dec-17-2027): -1 contract
- NVDA stock: 200 shares @ $164.92
- NVDA 190 Call (Dec-17-2027): -1 contract
- NVDA 200 Call (Dec-17-2027): -1 contract

**Actually extracted:** 0 stocks, 0 options

## Changes Made to Implement JSON Mode

### Original Code (Working Before Polygon Integration)
The function was working correctly before commit ed51da0 which added Polygon integration.

### Current Code with JSON Mode Implementation
```typescript
// supabase/functions/portfolio-vision/index.ts

const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: "json_object" }, // ADDED: Enable JSON mode
    messages: [
      {
        role: "system",
        content: `You are a financial data extraction specialist. Your job is to analyze portfolio screenshots and extract position data with 100% accuracy.

CRITICAL REQUIREMENTS:
1. You MUST respond with valid JSON - this is required  // UPDATED: Explicitly mention JSON
2. Extract ALL visible positions: STOCKS AND OPTIONS
3. If you cannot read exact values, use "Unknown" - never guess
4. Focus on extracting: Stocks, Sold Options (Calls/Puts), Option details (Strike, Expiry, Premium)
5. Look for common brokerage interfaces (Robinhood, TD Ameritrade, E*TRADE, Schwab, etc.)
6. PAY SPECIAL ATTENTION TO OPTIONS: Look for call/put contracts you've SOLD (short positions)

Return ONLY valid JSON matching this EXACT structure:  // UPDATED: Emphasize JSON only
{
  "portfolioDetected": boolean,
  "brokerageType": string (e.g., "Robinhood", "TD Ameritrade", "Unknown"),
  "positions": [
    {
      "symbol": string,
      "quantity": number,
      "purchasePrice": number,
      "currentPrice": number,
      "marketValue": number,
      "percentChange": string,
      "gainLoss": number
    }
  ],
  "metadata": {
    "optionPositions": [
      {
        "symbol": string,
        "optionType": "CALL" | "PUT",
        "strike": number,
        "expiry": string,
        "contracts": number,
        "position": "SHORT" | "LONG",
        "premiumCollected": number,
        "currentValue": number,
        "daysToExpiry": number,
        "profitLoss": number,
        "percentReturn": string,
        "status": string
      }
    ]
  },
  "totalValue": number,
  "extractionConfidence": string ("high", "medium", "low"),
  "extractionNotes": string (what you could/couldn't see clearly)
}

IMPORTANT: 
- If you see ANY portfolio data, set portfolioDetected: true
- If image shows no portfolio (e.g., just charts), set portfolioDetected: false
- Extract ALL positions visible, not just the target ticker
- MUST return valid JSON - no explanations or apologies`,  // UPDATED: No text outside JSON
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          {
            type: "text",
            text: `Extract all portfolio position data from this image with SPECIAL FOCUS ON OPTIONS. 
            
PRIMARY FOCUS: Look for ${ticker} positions (both stocks AND options), but extract ALL visible positions.

[... rest of prompt ...]

Return ONLY valid JSON following the exact structure specified. No text before or after the JSON.`,  // UPDATED
          },
        ],
      },
    ],
  }),
});
```

### Simplified JSON Extraction Logic
```typescript
/* -------- With JSON mode, response is guaranteed to be valid JSON -------- */
const txt: string = aiData.choices?.[0]?.message?.content ?? "{}";
console.log(`📝 [PORTFOLIO VISION] Raw AI response (first 200 chars): ${txt.substring(0, 200)}...`);

/* ----- Check for refusal in the response ----- */
if (aiData.choices?.[0]?.message?.refusal) {
  console.warn("⚠️ [PORTFOLIO VISION] AI refused the request:", aiData.choices[0].message.refusal);
  const defaultResponse = {
    portfolioDetected: false,
    brokerageType: "Unknown",
    positions: [],
    metadata: { optionPositions: [] },
    totalValue: 0,
    extractionConfidence: "low",
    extractionNotes: "AI refused to process the image"
  };
  return jsonResponse({ success: true, portfolio: defaultResponse });
}

try {
  const portfolio = JSON.parse(txt);
  // ... rest of processing
} catch (parseError) {
  console.error(`❌ [PORTFOLIO VISION] JSON parse error:`, parseError);
  console.error(`🔍 [PORTFOLIO VISION] Failed to parse text (length: ${txt.length}):`, txt.substring(0, 500));
  
  // With JSON mode enabled, this should rarely happen
  const fallbackResponse = {
    portfolioDetected: false,
    brokerageType: "Unknown",
    positions: [],
    metadata: { optionPositions: [] },
    totalValue: 0,
    extractionConfidence: "low",
    extractionNotes: `JSON parsing failed despite JSON mode. This is unusual. Error: ${parseError.message}`
  };
  
  return jsonResponse({ 
    success: true, 
    portfolio: fallbackResponse 
  }, 200);
}
```

## Test Script Used
```javascript
// test-portfolio-vision.cjs
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const PORTFOLIO_IMAGE_PATH = '/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png';

async function testPortfolioVision() {
  // Read and encode image
  const imageBuffer = fs.readFileSync(PORTFOLIO_IMAGE_PATH);
  const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  
  // Call edge function
  const response = await axios.post(
    `${SUPABASE_URL}/functions/v1/portfolio-vision`,
    { image: base64Image, ticker: 'IBIT' },
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // Analyze response...
}
```

## Key Questions for Troubleshooting

1. **Why is JSON mode not preventing parse errors?**
   - According to OpenAI docs, `response_format: { type: "json_object" }` should guarantee valid JSON
   - We're still getting parse errors at specific positions (e.g., position 3375)

2. **Is the model actually using JSON mode?**
   - The error suggests the AI is still returning malformed JSON
   - Could there be an issue with how we're passing the response_format parameter?

3. **Is there a model version issue?**
   - We're using `gpt-4o` - does this model support JSON mode?
   - Documentation suggests gpt-4o-2024-08-06 has better JSON support

4. **Could the image content be causing issues?**
   - The portfolio image is 571KB - is this too large?
   - Are there special characters in the portfolio that break JSON encoding?

5. **Is the prompt too complex?**
   - The prompt includes type annotations like `"CALL" | "PUT"` which aren't valid JSON
   - Should we simplify the schema example?

## Environment Details
- Supabase Edge Functions (Deno runtime)
- OpenAI API with gpt-4o model
- Test image: Portfolio screenshot showing IBIT and NVDA positions
- Function deployed and accessible at production URL

## What We Need Help With
1. Understanding why JSON mode isn't preventing parse errors
2. Determining if we're implementing response_format correctly
3. Finding alternative approaches if JSON mode isn't working as expected
4. Debugging the exact JSON structure being returned by the AI

## Additional Context
- This was working before Polygon integration (commit ed51da0)
- The post-processing code for date parsing was causing issues but has been made defensive
- User instructed to use OpenAI's JSON mode instead of regex repairs
- Research showed JSON mode should guarantee valid JSON with `response_format: { type: "json_object" }`

## Resolution Status
- ✅ Implemented JSON mode with `response_format: { type: "json_object" }`
- ✅ Updated system message to explicitly mention "JSON" as required
- ✅ Cleaned JSON example to remove TypeScript annotations
- ✅ **FIXED**: Increased `max_tokens` from 1000 to 2000 to prevent truncation
- ✅ **WORKING**: Portfolio extraction now successfully extracts all positions

## Final Solution
The "Unexpected end of JSON input" error was caused by the OpenAI response being truncated due to hitting the token limit. Image prompts are token-heavy, and with complex portfolio data, 1000 tokens wasn't enough.

**Fix applied:**
```typescript
// portfolio-vision/index.ts
max_tokens: 2000,  // Increased from 1000 to prevent truncation
```

**Result:** 
- Successfully extracts all stock positions (IBIT, NVDA)
- Successfully extracts all option positions with complete details
- Returns valid JSON with high confidence
- Total portfolio value calculated correctly: $133,408.66

## Key Learnings
1. JSON mode requires explicit "JSON" mention in system message
2. Token limits must account for image analysis overhead
3. "Unexpected end of JSON input" = truncation issue, not JSON mode failure
4. Always test with actual portfolio images, not just simple test cases