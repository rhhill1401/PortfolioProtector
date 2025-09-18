import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

// Helper function to fetch ETF Flow data from our dedicated etf-flows service
async function fetchETFFlowData(ticker: string): Promise<{ 
  netFlows: string | null; 
  trend: string | null; 
  impact: string | null;
  recommendation: string | null;
  source: { url: string; asOf: string } | null;
}> {
  try {
    console.log(`📊 [FETCH-FLOWS] Fetching from etf-flows service for ${ticker}`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/etf-flows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ ticker })
    });
    
    if (!response.ok) {
      console.log(`⚠️ [FETCH-FLOWS] Failed to fetch ETF flows: ${response.status}`);
      return { netFlows: null, trend: null, impact: null, recommendation: null, source: null };
    }
    
    const data = await response.json();
    console.log(`📊 [FETCH-FLOWS] Response:`, data);
    
    if (data.success && data.etfFlows) {
      return {
        netFlows: data.etfFlows.netFlows || null,
        trend: data.etfFlows.trend || null,
        impact: data.etfFlows.impact || null,
        recommendation: data.etfFlows.recommendation || null,
        source: data.etfFlows.source || null
      };
    }
    
    return { netFlows: null, trend: null, impact: null, recommendation: null, source: null };
  } catch (error) {
    console.error(`❌ [FETCH-FLOWS] Error:`, error);
    return { netFlows: null, trend: null, impact: null, recommendation: null, source: null };
  }
}

// Helper function to fetch NAV data from our dedicated nav-premium service
async function fetchNAVData(ticker: string): Promise<{
  premium: string | null;
  discount: string | null;
  source: string | null
}> {
  try {
    console.log(`📊 [FETCH-NAV] Fetching from nav-premium service for ${ticker}`);

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
    console.error(`❌ [FETCH-NAV] Error:`, error);
    return { premium: null, discount: null, source: null };
  }
}

// Helper function to fetch NAV via web search
async function fetchNavViaWebSearch(ticker: string): Promise<{
  premium: string | null;
  discount: string | null;
  source: string | null;
  asOf: string | null;
}> {
  try {
    const tickerUpper = ticker.toUpperCase();
    const productHint =
      tickerUpper === "IBIT"
        ? "iShares Bitcoin Trust ETF"
        : tickerUpper === "ETHA"
          ? "iShares Ethereum Trust ETF"
          : tickerUpper;

    const system = [
      "You are a strict financial data extractor.",
      "Return ONLY JSON with this exact shape:",
      '{"navAnalysis":{"premium":"+0.07%","discount":null,"source":"https://...","asOf":"YYYY-MM-DD"}}',
      "Rules:",
      "- Use only ishares.com, blackrock.com, or ycharts.com.",
      "- Extract the CURRENT premium/discount to NAV for the specific fund.",
      "- If it is a premium, fill premium and set discount=null; if a discount, fill discount and set premium=null.",
      "- Use ISO date (YYYY-MM-DD) for asOf.",
      "- If you cannot confirm, return premium=null, discount=null, source=null, asOf=null.",
      "- No commentary. No placeholders. JSON only.",
    ].join("\n");

    const user = [
      `Fund: ${productHint} (${tickerUpper})`,
      "Task: find CURRENT premium/discount vs NAV and the as-of date.",
      "Sources whitelist: ishares.com, blackrock.com, ycharts.com.",
      "Return JSON only with premium/discount (+/- and %), source URL, and asOf.",
    ].join("\n");

    const body = {
      model: "gpt-5",
      instructions: system,
      input: user,
      tools: [
        {
          type: "web_search",
          filters: {
            allowed_domains: ["ishares.com", "blackrock.com", "ycharts.com"],
          },
        },
      ],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 1200,
      parallel_tool_calls: false,
      reasoning: { effort: "low" },
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json();
    if (!res.ok) {
      console.error("❌ [NAV-WS] OpenAI error:", raw);
      return { premium: null, discount: null, source: null, asOf: null };
    }

    // Extract text
    let text = "";
    if (typeof raw.output_text === "string") {
      text = raw.output_text;
    } else if (Array.isArray(raw.output)) {
      text = raw.output
        .flatMap((it: any) =>
          Array.isArray(it?.content)
            ? it.content.map((c: any) => c?.text || "").filter(Boolean)
            : []
        )
        .join("");
    }

    // Parse JSON
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // attempt to trim junk and parse again
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        parsed = JSON.parse(text.slice(first, last + 1));
      }
    }

    const obj = parsed?.navAnalysis ?? {};
    const premium = typeof obj.premium === "string" ? obj.premium : null;
    const discount = typeof obj.discount === "string" ? obj.discount : null;
    const source = typeof obj.source === "string" ? obj.source : null;
    const asOf = typeof obj.asOf === "string" ? obj.asOf : null;

    // Minimal validation: must end with '%' when present
    const pctLike = (s: string | null) =>
      !!s && /-?\+?\d+(\.\d+)?%$/.test(s.trim());

    const out = {
      premium: pctLike(premium) ? premium : null,
      discount: pctLike(discount) ? discount : null,
      source,
      asOf,
    };

    // Normalize mutual exclusivity (premium XOR discount)
    if (out.premium && out.discount) {
      // prefer whichever has absolute larger magnitude
      const p = Math.abs(parseFloat(out.premium));
      const d = Math.abs(parseFloat(out.discount));
      if (p >= d) out.discount = null;
      else out.premium = null;
    }

    console.log("✅ [NAV-WS] Result:", out);
    return out;
  } catch (err) {
    console.error("💥 [NAV-WS] Exception:", err);
    return { premium: null, discount: null, source: null, asOf: null };
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
    
    // Pre-fetch NAV and ETF Flow data for crypto ETFs
    let navData = { premium: null, discount: null, source: null };
    let flowData = { netFlows: null, trend: null, impact: null, recommendation: null, source: null };
    
    if (isCryptoETF) {
      console.log(`📊 [MARKET-CONTEXT] Pre-fetching NAV and Flow data for crypto ETF ${ticker}`);
      // Fetch both in parallel
      const [nav, flows] = await Promise.all([
        fetchNAVData(ticker.toUpperCase()),
        fetchETFFlowData(ticker.toUpperCase())
      ]);
      navData = nav;
      flowData = flows;
      console.log(`📊 [MARKET-CONTEXT] Pre-fetched NAV data:`, navData);
      console.log(`📊 [MARKET-CONTEXT] Pre-fetched Flow data:`, flowData);
    }
    
    // System prompt for Upcoming Catalysts ONLY
    const systemPrompt = 
      "You are a market analyst providing upcoming catalyst dates.\n" +
      "You will be provided with pre-fetched ETF flow and NAV data.\n" +
      "Your job is ONLY to find upcoming catalyst dates via web search.\n" +
      "Output ONLY valid JSON with the exact format shown.\n" +
      "For ETF flows and NAV, use the pre-fetched values provided (don't search for these).\n" +
      "For any missing data (null values), return null in the JSON.";
    
    // User prompt with pre-fetched data
    const userPrompt = 
      `Current date: ${currentDate}\n` +
      `Ticker: ${ticker}\n\n` +
      "PRE-FETCHED DATA:\n" +
      (isCryptoETF ? 
        `NAV Data:\n` +
        `- Premium: ${navData.premium || 'null'}\n` +
        `- Discount: ${navData.discount || 'null'}\n` +
        `- Source: ${navData.source || 'null'}\n\n` +
        `ETF Flow Data:\n` +
        `- Net Flows: ${flowData.netFlows || 'null'}\n` +
        `- Trend: ${flowData.trend || 'null'}\n` +
        `- Impact: ${flowData.impact || 'null'}\n` +
        `- Recommendation: ${flowData.recommendation || 'null'}\n` +
        `- Source: ${flowData.source?.url || 'null'}\n\n` : "") +
      "INSTRUCTIONS:\n" +
      "1. Use web_search to find upcoming catalyst dates:\n" +
      "   - Search federalreserve.gov for next FOMC meeting date\n" +
      "   - Search bls.gov for next CPI release date\n" +
      "2. Calculate the next triple witching date (third Friday of Mar/Jun/Sep/Dec)\n" +
      "3. Use the pre-fetched NAV and ETF flow values provided above (don't search for these)\n\n" +
      "Output this exact JSON structure:\n" +
      `{
        "marketData": {
          ${isCryptoETF ? `"etfFlows": {
            "netFlows": ${flowData.netFlows ? `"${flowData.netFlows}"` : 'null'},
            "trend": ${flowData.trend ? `"${flowData.trend}"` : 'null'},
            "impact": ${flowData.impact ? `"${flowData.impact}"` : 'null'},
            "recommendation": ${flowData.recommendation ? `"${flowData.recommendation}"` : 'null'},
            "source": ${flowData.source ? `{ "url": "${flowData.source.url}", "asOf": "${flowData.source.asOf}" }` : 'null'}
          },
          "navAnalysis": {
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
      parallel_tool_calls: false
    };
    
    console.log("🔍 [MARKET-CONTEXT] Calling OpenAI for upcoming catalysts");
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
    let marketData: any = {};
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

    // Override navAnalysis ONLY for crypto ETFs with web search data
    if (isCryptoETF) {
      const navWS = await fetchNavViaWebSearch(ticker.toUpperCase());
      const haveWS = !!(navWS.premium || navWS.discount);

      if (haveWS) {
        // Helper to build interpretation/opportunity without changing the card's shape
        const toNumber = (s: string | null): number | null => {
          if (!s) return null;
          const m = s.match(/-?\+?\d+(\.\d+)?/);
          return m ? parseFloat(m[0]) : null;
        };
        const pct = toNumber(navWS.premium ?? navWS.discount ?? null);
        let interpretation: string | null = null;
        let tradingOpportunity: string | null = null;

        if (pct != null) {
          const a = Math.abs(pct);
          if (a < 0.30) {
            interpretation = "Trading near NAV";
            tradingOpportunity = "Standard wheel execution conditions";
          } else if (pct > 0) {
            interpretation = "Trading at a premium to NAV";
            tradingOpportunity = "Favor covered-call sales into strength";
          } else {
            interpretation = "Trading at a discount to NAV";
            tradingOpportunity = "Potential mean-reversion entry; size conservatively";
          }
        }

        marketData.navAnalysis = {
          premium: navWS.premium,
          discount: navWS.discount,
          interpretation,
          tradingOpportunity,
          source: {
            url: navWS.source || "",
            asOf: navWS.asOf || new Date().toISOString().split("T")[0],
          },
        };
      } else {
        // Leave whatever you already had (from previous code) — do not alter other cards
        // If you previously set nulls, keep them null; no placeholders.
      }
    }

    console.log("✅ [MARKET-CONTEXT] Successfully processed market data");

    const response = {
      success: true,
      marketData,
      sources: [...sources, ...webSearchSources],
      timestamp: new Date().toISOString(),
      ...(debug ? {
        debug: {
          preFetchedData: { nav: navData, flow: flowData },
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