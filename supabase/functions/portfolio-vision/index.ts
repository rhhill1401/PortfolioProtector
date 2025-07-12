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
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: `You are a financial data extraction specialist. Your job is to analyze portfolio screenshots and extract position data with 100% accuracy.

CRITICAL REQUIREMENTS:
1. ALWAYS return valid JSON even if image is unclear
2. Extract ALL visible positions: STOCKS AND OPTIONS
3. If you cannot read exact values, use "Unknown" - never guess
4. Focus on extracting: Stocks, Sold Options (Calls/Puts), Option details (Strike, Expiry, Premium)
5. Look for common brokerage interfaces (Robinhood, TD Ameritrade, E*TRADE, Schwab, etc.)
6. PAY SPECIAL ATTENTION TO OPTIONS: Look for call/put contracts you've SOLD (short positions)

Return JSON matching this EXACT structure:
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
- Never apologize or explain - only return JSON`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image } },
              {
                type: "text",
                text: `Extract all portfolio position data from this image with SPECIAL FOCUS ON OPTIONS. 
                
PRIMARY FOCUS: Look for ${ticker} positions (both stocks AND options), but extract ALL visible positions.

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

Return ONLY the JSON structure specified. No explanations.`,
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

    /* -------- Extract JSON block from the reply -------- */
    let txt: string = aiData.choices?.[0]?.message?.content ?? "";
    console.log(`📝 [PORTFOLIO VISION] Raw AI response: ${txt.substring(0, 200)}...`);

    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      txt = txt.slice(first, last + 1);
    }
    txt = txt
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```+\s*$/i, "")
      .trim();

    /* ----- Handle model apologies/refusals gracefully ----- */
    if (
      txt.toLowerCase().includes("sorry") ||
      txt.toLowerCase().includes("apologize") ||
      txt.toLowerCase().includes("cannot") ||
      txt.toLowerCase().includes("unable")
    ) {
      console.warn("⚠️ [PORTFOLIO VISION] AI returned apology/refusal – sending default response");
      const defaultResponse = {
        portfolioDetected: false,
        brokerageType: "Unknown",
        positions: [],
        totalValue: 0,
        extractionConfidence: "low",
        extractionNotes: "AI could not extract portfolio data from image"
      };
      return jsonResponse({ success: true, portfolio: defaultResponse });
    }

    try {
      const portfolio = JSON.parse(txt);
      
      // Post-process option positions to calculate daysToExpiry and term length
      if (portfolio.metadata?.optionPositions) {
        const today = new Date();
        
        portfolio.metadata.optionPositions = portfolio.metadata.optionPositions.map((opt: any) => {
          const d = new Date(opt.expiry);
          const days = isNaN(+d) ? 0 : Math.max(0, Math.ceil((d.getTime() - today.getTime()) / 86_400_000));
          
          return {
            ...opt,
            daysToExpiry: days,
            term: days > 365 ? 'LONG_DATED' : 'SHORT_DATED',
            position: opt.contracts < 0 ? 'SHORT' : 'LONG' // Keep position for bought/sold distinction
          };
        });
      }
      
      console.log(`✅ [PORTFOLIO VISION] Successfully parsed portfolio data:`, {
        portfolioDetected: portfolio.portfolioDetected,
        positionCount: portfolio.positions?.length || 0,
        optionPositionCount: portfolio.metadata?.optionPositions?.length || 0,
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
      console.error(`🔍 [PORTFOLIO VISION] Failed to parse text:`, txt);
      
      // Return fallback response
      const fallbackResponse = {
        portfolioDetected: false,
        brokerageType: "Unknown",
        positions: [],
        totalValue: 0,
        extractionConfidence: "low",
        extractionNotes: "Failed to parse AI response as valid JSON"
      };
      
      return jsonResponse({ 
        success: false, 
        error: "Failed to parse portfolio data", 
        portfolio: fallbackResponse 
      }, 200);
    }
  } catch (err) {
    console.error("💥 [PORTFOLIO VISION] Unexpected error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});