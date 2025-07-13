# OpenAI JSON Mode Fix Documentation

## Problem
The portfolio-vision edge function was failing with "Failed to parse AI response as valid JSON" errors. This was causing zero positions to be extracted from portfolio screenshots.

## Root Cause
1. **Token Truncation**: The AI response was getting cut off mid-JSON due to insufficient max_tokens (was 1000)
2. **No JSON Guarantee**: Without JSON mode, OpenAI can return markdown-wrapped JSON or explanatory text

## Solution Applied

### 1. Enable OpenAI JSON Mode
```typescript
// portfolio-vision/index.ts
const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 2000, // Increased from 1000
    response_format: { type: "json_object" }, // Forces valid JSON
    messages: [
      {
        role: "system",
        content: `You MUST respond with valid JSON only. No markdown, no explanations.`
      },
      // ... rest of messages
    ]
  })
});
```

### 2. Key Changes
- Added `response_format: { type: "json_object" }` to force JSON-only responses
- Increased `max_tokens` from 1000 to 2000 to prevent truncation
- Updated system prompt to emphasize JSON-only requirement
- Added explicit "You MUST respond with valid JSON only" instruction

## Testing & Validation
```javascript
// Test script created: test-portfolio-vision.cjs
// Confirmed extraction of:
// - 6 IBIT positions (14 total contracts)
// - 2 NVDA positions (2 total contracts)
// - Total premium: $16,219.27
```

## Future Considerations
1. Monitor token usage - may need to increase further for larger portfolios
2. Consider implementing streaming responses for very large portfolios
3. Add retry logic with exponential backoff for API failures

## References
- [OpenAI JSON Mode Documentation](https://platform.openai.com/docs/guides/text-generation/json-mode)
- Fix implemented: July 13, 2025
- Error ID referenced: [ERN] [ID: JSON-GUARD-004]