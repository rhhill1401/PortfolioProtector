/* supabase/functions/portfolio-vision/index.ts
 * Edge Function: portfolio-vision
 * Receives { image: base64, ticker?: string }
 * Calls OpenAI Vision to extract portfolio positions and returns structured data.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/* ---------------- CORS helpers ---------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/* ---------------- Edge entrypoint ---------------- */
Deno.serve(async (req) => {
  /* Pre-flight for browsers */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST" },
    });
  }

  /* ----------- Input validation ----------- */
  let payload: { image?: string; ticker?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { image, ticker = "UNKNOWN" } = payload;

  if (!image) {
    return jsonResponse({ success: false, error: "image is required" }, 400);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse(
      { success: false, error: "OpenAI API key not configured" },
      500,
    );
  }

  /* ----------- OpenAI Vision call for Portfolio Analysis ----------- */
  try {
    console.log(`🔍 [PORTFOLIO VISION] Starting analysis for ticker: ${ticker}`);

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1, // Lower temperature for more accurate data extraction
        max_tokens: 2000, // Increased to prevent truncation with image prompts
        response_format: { type: "json_object" }, // Enable JSON mode for guaranteed valid JSON
        messages: [
          {
            role: "system",
            content: `You MUST respond with valid JSON only. You are a financial data extraction specialist analyzing portfolio screenshots.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no other text
2. Extract ALL visible positions: CASH, STOCKS AND OPTIONS
3. If you cannot read exact values, use "Unknown" - never guess
4. Focus on extracting: Cash Balance, Stocks, Sold Options (Calls/Puts), Option details (Strike, Expiry, Premium)
5. Look for common brokerage interfaces (Robinhood, TD Ameritrade, E*TRADE, Schwab, etc.)
6. PAY SPECIAL ATTENTION TO CASH: Look for "Cash", "Money Market", "Cash Balance" entries
7. PAY SPECIAL ATTENTION TO OPTIONS: Look for call/put contracts you've SOLD (short positions)

Your response must be valid JSON matching this EXACT structure:
{
  "portfolioDetected": true,
  "brokerageType": "Robinhood",
  "cashBalance": 10589.30,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "purchasePrice": 150.50,
      "currentPrice": 175.25,
      "marketValue": 17525.00,
      "percentChange": "+16.4%",
      "gainLoss": 2475.00
    }
  ],
  "metadata": {
    "optionPositions": [
      {
        "symbol": "AAPL",
        "optionType": "CALL",
        "strike": 180,
        "expiry": "2025-08-15",
        "contracts": -1,
        "position": "SHORT",
        "premiumCollected": 350,
        "currentValue": 200,
        "daysToExpiry": 30,
        "profitLoss": 150,
        "percentReturn": "+42.8%",
        "status": "Open"
      }
    ]
  },
  "totalValue": 28114.30,
  "extractionConfidence": "high",
  "extractionNotes": "All positions clearly visible"
}

IMPORTANT: 
- If you see ANY portfolio data, set portfolioDetected: true
- If image shows no portfolio (e.g., just charts), set portfolioDetected: false
- Extract ALL positions visible, not just the target ticker
- Response MUST be valid JSON only - no text before or after`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image } },
              {
                type: "text",
                text: `Extract all portfolio position data from this image with SPECIAL FOCUS ON CASH AND OPTIONS. 
                
PRIMARY FOCUS: Look for ${ticker} positions (both stocks AND options), but extract ALL visible positions.

CRITICAL: Look for CASH BALANCE:
- Look for rows labeled "Cash", "Money Market", "Cash Balance", or similar
- Extract the exact dollar amount shown for cash
- This is crucial for wheel strategy calculations

CRITICAL: Look for OPTION positions you have SOLD (covered calls, cash-secured puts):
- Option symbols (e.g., "IBIT 61C JUL19", "AAPL 150P DEC15")
- Strike prices (e.g., $61, $65.44, $150)
- Expiry dates (e.g., "Jul-19-2025", "Aug-15-2025")
- Number of contracts (e.g., -1, -4, +2)
- Premium collected/paid
- Current option value
- Profit/Loss on options
- Days to expiry

ALSO look for stock positions (extract into main "positions" array):
- Stock symbols (like AAPL, TSLA, MSFT, IBIT, etc.)
- Share quantities (number of shares owned)
- Purchase/cost basis prices
- Current market prices
- Total market values
- Gain/loss percentages

WHEEL STRATEGY FOCUS: If you see sold calls (-1 contracts, -4 contracts), extract ALL details into metadata.optionPositions:
- Exact strike prices
- Exact expiry dates  
- Premium collected
- Current profit/loss
- Performance metrics

Return ONLY valid JSON following the exact structure specified. No text before or after the JSON.`,
              },
            ],
          },
        ],
      }),
    });

    const aiData = await aiResp.json();
    console.log(`📊 [PORTFOLIO VISION] OpenAI response status: ${aiResp.status}`);

    if (!aiResp.ok) {
      console.error(`❌ [PORTFOLIO VISION] OpenAI error:`, aiData);
      throw new Error(aiData.error?.message || "OpenAI error");
    }

    // Debug: Check if response_format was applied
    console.log(`🔍 [PORTFOLIO VISION] AI model used: ${aiData.model}`);
    console.log(`🔍 [PORTFOLIO VISION] Finish reason: ${aiData.choices?.[0]?.finish_reason}`);
    console.log(`🔍 [PORTFOLIO VISION] Usage:`, aiData.usage);
    
    /* -------- With JSON mode, response is guaranteed to be valid JSON -------- */
    const txt: string = aiData.choices?.[0]?.message?.content ?? "{}";
    console.log(`📝 [PORTFOLIO VISION] Raw AI response length: ${txt.length} chars`);
    console.log(`📝 [PORTFOLIO VISION] Response starts with: ${txt.substring(0, 50)}`);
    console.log(`📝 [PORTFOLIO VISION] Response ends with: ${txt.substring(txt.length - 50)}`);

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
      
      // 🛡️ DEFENSIVE: Post-process option positions with error handling
      // This was causing JSON parsing failures when date parsing crashed
      if (portfolio.metadata?.optionPositions && Array.isArray(portfolio.metadata.optionPositions)) {
        const today = new Date();
        
        try {
          portfolio.metadata.optionPositions = portfolio.metadata.optionPositions.map((opt: any) => {
            let days = 0;
            
            // 🛡️ DEFENSIVE: Safe date parsing with multiple fallbacks
            try {
              if (opt.expiry) {
                const d = new Date(opt.expiry);
                if (!isNaN(d.getTime())) {
                  days = Math.max(0, Math.ceil((d.getTime() - today.getTime()) / 86_400_000));
                } else {
                  console.warn(`⚠️ [PORTFOLIO VISION] Invalid expiry date format: ${opt.expiry}`);
                }
              }
            } catch (dateError) {
              console.warn(`⚠️ [PORTFOLIO VISION] Date parsing error for ${opt.expiry}:`, dateError);
            }
            
            return {
              ...opt,
              daysToExpiry: days,
              term: days > 365 ? 'LONG_DATED' : 'SHORT_DATED',
              position: opt.contracts < 0 ? 'SHORT' : 'LONG' // Keep position for bought/sold distinction
            };
          });
        } catch (postProcessError) {
          console.error(`⚠️ [PORTFOLIO VISION] Post-processing failed, keeping original data:`, postProcessError);
          // Keep original optionPositions if post-processing fails
        }
      }
      
      console.log(`✅ [PORTFOLIO VISION] Successfully parsed portfolio data:`, {
        portfolioDetected: portfolio.portfolioDetected,
        positionCount: portfolio.positions?.length || 0,
        optionPositionCount: portfolio.metadata?.optionPositions?.length || 0,
        cashBalance: portfolio.cashBalance || 0,
        totalValue: portfolio.totalValue,
        confidence: portfolio.extractionConfidence,
        brokerageType: portfolio.brokerageType
      });

      // 🔍 CRITICAL DEBUG: Log exact structure being returned
      console.log('🔍 [PORTFOLIO VISION] EXACT RESPONSE STRUCTURE:', JSON.stringify({
        success: true,
        portfolio: portfolio
      }, null, 2));

      // Detailed logging of extracted positions
      if (portfolio.positions && portfolio.positions.length > 0) {
        console.log(`📈 [POSITIONS EXTRACTED]:`, portfolio.positions);
        portfolio.positions.forEach((pos: any, index: number) => {
          console.log(`   Stock ${index + 1}: ${pos.symbol} - ${pos.quantity} shares @ $${pos.currentPrice}`);
        });
      }

      // Detailed logging of extracted option positions
      if (portfolio.metadata?.optionPositions && portfolio.metadata.optionPositions.length > 0) {
        console.log(`📊 [OPTION POSITIONS EXTRACTED]:`, portfolio.metadata.optionPositions);
        portfolio.metadata.optionPositions.forEach((pos: any, index: number) => {
          console.log(`   Option ${index + 1}: ${pos.symbol} $${pos.strike}${pos.optionType} ${pos.expiry} - ${pos.contracts} contracts (${pos.position}) DTE: ${pos.daysToExpiry || 'N/A'} P&L: $${pos.profitLoss}`);
        });
      }

      if (!portfolio.positions?.length && !portfolio.metadata?.optionPositions?.length) {
        console.log(`❌ [PORTFOLIO VISION] No positions extracted from image`);
      }

      return jsonResponse({ success: true, portfolio }, 200);
    } catch (parseError) {
      console.error(`❌ [PORTFOLIO VISION] JSON parse error:`, parseError);
      console.error(`🔍 [PORTFOLIO VISION] Failed to parse text (length: ${txt.length})`);
      console.error(`🔍 [PORTFOLIO VISION] First 1000 chars:`, txt.substring(0, 1000));
      console.error(`🔍 [PORTFOLIO VISION] Last 500 chars:`, txt.substring(txt.length - 500));
      
      // Log the exact position where parsing failed
      const errorMatch = parseError.message.match(/at position (\d+)/);
      if (errorMatch) {
        const errorPos = parseInt(errorMatch[1]);
        console.error(`🔍 [PORTFOLIO VISION] Error position ${errorPos}, context:`, 
          txt.substring(Math.max(0, errorPos - 50), Math.min(txt.length, errorPos + 50)));
      }
      
      // With JSON mode enabled, this should rarely happen
      // Return a minimal valid response
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
  } catch (err) {
    console.error("💥 [PORTFOLIO VISION] Unexpected error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});