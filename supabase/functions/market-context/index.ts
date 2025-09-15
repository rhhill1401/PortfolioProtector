import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

interface MarketData {
  navAnalysis?: {
    premium: string | null;
    discount: string | null;
    interpretation: string | null;
    tradingOpportunity: string | null;
    source?: { url: string; asOf: string };
  };
  volatilityMetrics?: {
    currentIV: string | null;
    ivRank: string | null;
    callPutSkew: string | null;
    premiumEnvironment: string | null;
    wheelStrategy: string | null;
  };
  optionsFlow?: {
    largeOrders: string | null;
    putCallRatio: string | null;
    openInterest: string | null;
    sentiment: string | null;
  };
  upcomingCatalysts?: Array<{
    event: string;
    date: string;
    impact: string;
    recommendation: string;
    source?: { url: string; asOf: string };
  }>;
}

// Helper function to fetch NAV data from our dedicated nav-premium service
async function fetchNAVData(ticker: string): Promise<{ premium: string | null; discount: string | null; source: string | null }> {
  try {
    console.log(`📊 [FETCH-NAV] Fetching from nav-premium service for ${ticker}`);
    
    // Call our dedicated nav-premium edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/nav-premium`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ ticker })
    });
    
    if (!response.ok) {
      console.log(`⚠️ [FETCH-NAV] Failed to fetch from nav-premium: ${response.status}`);
      return { premium: null, discount: null, source: null };
    }
    
    const data = await response.json();
    
    if (data.success && data.navAnalysis) {
      console.log(`✅ [FETCH-NAV] Got NAV data from nav-premium service:`, data.navAnalysis);
      return {
        premium: data.navAnalysis.premium,
        discount: data.navAnalysis.discount,
        source: data.navAnalysis.source?.url || null
      };
    }
    
    return { premium: null, discount: null, source: null };
  } catch (error) {
    console.error(`❌ [FETCH-NAV] Error calling nav-premium:`, error);
    return { premium: null, discount: null, source: null };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST" } });
  }

  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'market-context';
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
    
    // Pre-fetch NAV data for crypto ETFs
    let navData = { premium: null, discount: null, source: null };
    
    if (isCryptoETF) {
      console.log(`📊 [MARKET-CONTEXT] Pre-fetching NAV data for crypto ETF ${ticker}`);
      navData = await fetchNAVData(ticker.toUpperCase());
      console.log(`📊 [MARKET-CONTEXT] Pre-fetched NAV data:`, navData);
    }
    
    // System prompt focused on market context only
    const systemPrompt = 
      "You are a market analyst providing real-time market context.\n" +
      "You will be provided with pre-fetched data and should analyze it.\n" +
      "Output ONLY valid JSON with the exact format shown.\n" +
      "For any missing data (null values), return null in the JSON.\n" +
      "Do NOT use placeholder text like 'Live data not available' - use null instead.\n" +
      "Include source URLs and timestamps when provided.";
    
    // User prompt with pre-fetched data
    const userPrompt = 
      `Current date: ${currentDate}\n` +
      `Ticker: ${ticker}\n\n` +
      "PRE-FETCHED DATA:\n" +
      (isCryptoETF ? 
        `NAV Data:\n` +
        `- Premium: ${navData.premium || 'null'}\n` +
        `- Discount: ${navData.discount || 'null'}\n` +
        `- Source: ${navData.source || 'null'}\n\n` : "") +
      "INSTRUCTIONS:\n" +
      "1. Use web_search ONLY for FOMC and CPI dates if needed\n" +
      "2. Calculate the next triple witching date (third Friday of Mar/Jun/Sep/Dec)\n" +
      "3. For NAV data, use the pre-fetched values provided above\n" +
      "4. If a value is null, return null (not text)\n\n" +
      "Output this exact JSON structure:\n" +
      `{
        "marketData": {
          ${isCryptoETF ? `"navAnalysis": {
            "premium": ${navData.premium ? `"${navData.premium}"` : 'null'},
            "discount": ${navData.discount ? `"${navData.discount}"` : 'null'},
            "interpretation": "[analyze NAV divergence if data available]",
            "tradingOpportunity": "[identify opportunities based on NAV]",
            "source": { "url": "${navData.source || ''}", "asOf": "${currentDate}" }
          },` : ''}
          "volatilityMetrics": {
            "currentIV": null,
            "ivRank": null,
            "callPutSkew": null,
            "premiumEnvironment": null,
            "wheelStrategy": null
          },
          "optionsFlow": {
            "largeOrders": null,
            "putCallRatio": null,
            "openInterest": null,
            "sentiment": null
          },
          "upcomingCatalysts": [
            {
              "event": "Fed Meeting (FOMC)",
              "date": "[search federalreserve.gov for actual date]",
              "impact": "High - affects all risk assets",
              "recommendation": "Consider reducing position size before announcement",
              "source": { "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "asOf": "${currentDate}" }
            },
            {
              "event": "CPI Release",
              "date": "[search bls.gov for actual date]",
              "impact": "High - inflation data impacts rates",
              "recommendation": "Monitor for volatility expansion",
              "source": { "url": "https://www.bls.gov/schedule/news_release/cpi.htm", "asOf": "${currentDate}" }
            },
            {
              "event": "Triple Witching",
              "date": "[calculate third Friday of Mar/Jun/Sep/Dec]",
              "impact": "High - increased volatility",
              "recommendation": "Premium collection opportunities due to elevated IV",
              "source": { "url": "calculated", "asOf": "${currentDate}" }
            }
          ]
        },
        "sources": []
      }`;
    
    // Call OpenAI Responses API (web search only for dates now)
    const requestBody = {
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions: systemPrompt,
      input: userPrompt,
      tools: [{ 
        type: "web_search",
        filters: { 
          allowed_domains: [
            "federalreserve.gov",  // For FOMC dates
            "bls.gov"              // For CPI dates
          ] 
        }
      }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 4000,
      parallel_tool_calls: false  // Sequential for reliability
    };
    
    console.log("🔍 [MARKET-CONTEXT] Calling OpenAI with pre-fetched data");
    if (debug) {
      console.log("🐛 [DEBUG] Request body:", JSON.stringify(requestBody, null, 2));
    }
    
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
    
    if (debug) {
      console.log("🐛 [DEBUG] Raw output (first 2000 chars):", outputText.substring(0, 2000));
    }
    
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
    
    const response = {
      success: true,
      marketData,
      sources: [...sources, ...webSearchSources],
      timestamp: new Date().toISOString(),
      ...(debug ? {
        debug: {
          preFetchedData: { nav: navData },
          parsedMarketData: marketData,
          topSources: webSearchSources.slice(0, 2)
        }
      } : {})
    };
    
    if (debug) {
      console.log("🐛 [DEBUG] Final response:", JSON.stringify(response, null, 2));
    }
    
    return new Response(JSON.stringify(response), {
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