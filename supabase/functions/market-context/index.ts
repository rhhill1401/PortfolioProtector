import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

interface MarketData {
  etfFlows?: {
    netFlows: string;
    trend: string;
    impact: string;
    recommendation: string;
    source?: { url: string; asOf: string };
  };
  navAnalysis?: {
    premium: string;
    discount: string;
    interpretation: string;
    tradingOpportunity: string;
    source?: { url: string; asOf: string };
  };
  volatilityMetrics?: {
    currentIV: string;
    ivRank: string;
    callPutSkew: string;
    premiumEnvironment: string;
    wheelStrategy: string;
  };
  optionsFlow?: {
    largeOrders: string;
    putCallRatio: string;
    openInterest: string;
    sentiment: string;
  };
  upcomingCatalysts?: Array<{
    event: string;
    date: string;
    impact: string;
    recommendation: string;
    source?: { url: string; asOf: string };
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST" } });
  }

  try {
    const { ticker } = await req.json();
    
    if (!ticker) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Ticker is required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    console.log(`📊 [MARKET-CONTEXT] Fetching market data for ${ticker}`);
    
    // Check if this is a crypto ETF
    const cryptoETFs = ["IBIT", "ETHA", "GBTC", "BITO", "BITQ", "ARKB", "FBTC", "HODL", "BTCO", "EZBC", "BTCR"];
    const isCryptoETF = cryptoETFs.includes(ticker.toUpperCase());
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    // System prompt focused on market context only
    const systemPrompt = 
      "You are a market analyst providing real-time market context.\n" +
      "You MUST use web_search to find real dates and data.\n" +
      "After searching, output ONLY valid JSON with the exact format shown.\n" +
      "For any data you cannot find via web search, use the exact string 'Live data not available'.\n" +
      "Include source URLs and timestamps for all data claims.";
    
    // User prompt requesting specific market data
    const userPrompt = 
      `Current date: ${currentDate}\n` +
      `Ticker: ${ticker}\n\n` +
      "STEP 1: Use web_search to find:\n" +
      "- Search 'site:federalreserve.gov FOMC meeting schedule 2025' for next Fed meeting\n" +
      "- Search 'site:bls.gov CPI release dates 2025' for next CPI release\n" +
      (isCryptoETF ? "- Search 'site:farside.co.uk bitcoin ETF flows' for ETF flow data\n" : "") +
      (isCryptoETF ? "- Search 'site:blackrock.com IBIT NAV premium' for NAV data\n" : "") +
      "\n" +
      "STEP 2: Calculate the next triple witching date (third Friday of Mar/Jun/Sep/Dec)\n\n" +
      "STEP 3: Output this exact JSON structure:\n" +
      `{
        "marketData": {
          ${isCryptoETF ? `"etfFlows": {
            "netFlows": "[actual value or 'Live data not available']",
            "trend": "[actual trend or 'Live data not available']",
            "impact": "[actual impact or 'Live data not available']",
            "recommendation": "[actual recommendation or 'Live data not available']",
            "source": { "url": "[source URL]", "asOf": "${currentDate}" }
          },
          "navAnalysis": {
            "premium": "[actual premium or 'No NAV data']",
            "discount": "[actual discount or 'No NAV data']",
            "interpretation": "[actual interpretation or 'Non-conclusive on NAV impacts']",
            "tradingOpportunity": "[actual opportunity or 'None derived from current data']",
            "source": { "url": "[source URL]", "asOf": "${currentDate}" }
          },` : ''}
          "volatilityMetrics": {
            "currentIV": "[actual IV or 'Not available']",
            "ivRank": "[actual rank or 'Unknown']",
            "callPutSkew": "[actual skew or 'Balanced skew suggests no significant directional bias']",
            "premiumEnvironment": "[actual environment or 'Moderate - balanced approach']",
            "wheelStrategy": "[actual strategy or 'IV at 36.4% suggests standard wheel execution']"
          },
          "optionsFlow": {
            "largeOrders": "[actual orders or 'No unusual activity detected']",
            "putCallRatio": "[actual ratio or 'Balanced']",
            "openInterest": "[actual OI or 'Standard OI distribution']",
            "sentiment": "[actual sentiment or 'Neutral']"
          },
          "upcomingCatalysts": [
            {
              "event": "Fed Meeting (FOMC)",
              "date": "[ACTUAL DATE FROM WEB SEARCH]",
              "impact": "High - affects all risk assets",
              "recommendation": "Consider reducing position size before announcement",
              "source": { "url": "https://www.federalreserve.gov/...", "asOf": "${currentDate}" }
            },
            {
              "event": "CPI Release",
              "date": "[ACTUAL DATE FROM WEB SEARCH]",
              "impact": "High - inflation data impacts rates",
              "recommendation": "Monitor for volatility expansion",
              "source": { "url": "https://www.bls.gov/...", "asOf": "${currentDate}" }
            },
            {
              "event": "Triple Witching",
              "date": "[CALCULATED DATE]",
              "impact": "High - increased volatility",
              "recommendation": "Premium collection opportunities due to elevated IV",
              "source": { "url": "calculated", "asOf": "${currentDate}" }
            }
          ]
        },
        "sources": []
      }`;
    
    // Call OpenAI Responses API with web search
    const requestBody = {
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions: systemPrompt,
      input: userPrompt,
      tools: [{ 
        type: "web_search",
        filters: { 
          allowed_domains: [
            "federalreserve.gov",
            "bls.gov",
            "farside.co.uk",
            "blackrock.com",
            "ishares.com",
            "cmegroup.com"
          ] 
        }
      }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 4000,
      parallel_tool_calls: true
    };
    
    console.log("🔍 [MARKET-CONTEXT] Calling OpenAI with web search");
    
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${OPENAI_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(requestBody)
    });
    
    const raw = await res.json();
    
    if (!res.ok) {
      console.error("❌ [MARKET-CONTEXT] OpenAI API Error:", raw);
      throw new Error(raw?.error?.message || `OpenAI error ${res.status}`);
    }
    
    // Extract the text output
    let outputText = "";
    
    if (raw.output_text) {
      outputText = raw.output_text;
    } else if (Array.isArray(raw.output)) {
      // Find message type in output array
      const messageItem = raw.output.find((item: any) => item.type === "message");
      if (messageItem?.content) {
        outputText = messageItem.content
          .map((c: any) => c?.text || "")
          .filter(Boolean)
          .join("");
      }
      
      // If still no text, try concatenating all text content
      if (!outputText) {
        outputText = raw.output
          .flatMap((item: any) => 
            Array.isArray(item?.content) 
              ? item.content.map((c: any) => c?.text || "").filter(Boolean)
              : []
          )
          .join("");
      }
    }
    
    console.log("📄 [MARKET-CONTEXT] Output text length:", outputText.length);
    
    // Parse the JSON response
    let marketData: MarketData = {};
    let sources: any[] = [];
    
    try {
      const parsed = JSON.parse(outputText);
      marketData = parsed.marketData || {};
      sources = parsed.sources || [];
    } catch (e) {
      console.error("⚠️ [MARKET-CONTEXT] Failed to parse JSON:", e);
      // Return structured error response
      marketData = {
        upcomingCatalysts: [
          {
            event: "Data fetch error",
            date: currentDate,
            impact: "Unable to fetch real-time data",
            recommendation: "Try refreshing the page"
          }
        ]
      };
    }
    
    // Extract sources from web search calls
    const webSearchSources = raw.output
      ?.filter((item: any) => item.type === "web_search_call")
      ?.flatMap((item: any) => item.action?.sources || []) || [];
    
    console.log("✅ [MARKET-CONTEXT] Successfully processed market data");
    
    return new Response(JSON.stringify({
      success: true,
      marketData,
      sources: [...sources, ...webSearchSources],
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
    
  } catch (err) {
    console.error("💥 [MARKET-CONTEXT] Exception:", err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
      marketData: {
        upcomingCatalysts: [
          {
            event: "Service Error",
            date: new Date().toISOString().split('T')[0],
            impact: "Unable to fetch market data",
            recommendation: "Please try again"
          }
        ]
      }
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...cors } 
    });
  }
});