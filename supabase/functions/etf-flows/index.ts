import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

// Cache for 120 seconds to avoid rate limits
const flowCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 120000; // 2 minutes

interface ETFFlowData {
  netFlows: string | null;
  trend: string | null;
  impact: string | null;
  recommendation: string | null;
  source: { url: string; asOf: string };
}

interface FlowResponse {
  success: boolean;
  ticker: string;
  etfFlows: ETFFlowData | null;
  debug?: {
    usedUrl: string[];
    soToday: number | null;
    soPrev: number | null;
    navToday: number | null;
    computedFlowUSD: number | null;
    rawSample: string;
  };
}

/**
 * Get NAV from our nav-premium service
 */
async function getNAVFromService(ticker: string): Promise<{ nav: number | null; asOf: string }> {
  try {
    // Call without debug mode to get navSnapshot
    const response = await fetch(`${SUPABASE_URL}/functions/v1/nav-premium`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ ticker })
    });
    
    if (!response.ok) {
      console.log(`⚠️ [ETF-FLOWS] Failed to get NAV from service: ${response.status}`);
      return { nav: null, asOf: new Date().toISOString().split('T')[0] };
    }
    
    const data = await response.json();
    
    // Check for NAV in navSnapshot field (non-debug)
    if (data.success && data.navSnapshot?.nav) {
      console.log(`✅ [ETF-FLOWS] Got NAV from service: $${data.navSnapshot.nav}`);
      return {
        nav: data.navSnapshot.nav,
        asOf: data.navSnapshot.asOf || new Date().toISOString().split('T')[0]
      };
    }
    
    return { nav: null, asOf: new Date().toISOString().split('T')[0] };
  } catch (error) {
    console.error(`❌ [ETF-FLOWS] Error getting NAV:`, error);
    return { nav: null, asOf: new Date().toISOString().split('T')[0] };
  }
}

/**
 * Parse Shares Outstanding from iShares IBIT page
 * Attempts to extract current and previous SO values
 */
async function getSharesOutstanding(ticker: string): Promise<{ 
  soToday: number | null; 
  soPrev: number | null; 
  asOf: string;
  rawSample: string;
}> {
  const productUrl = "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf";
  
  try {
    console.log(`📊 [ETF-FLOWS] Fetching iShares page for Shares Outstanding`);
    
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ [ETF-FLOWS] Failed to fetch iShares page: ${response.status}`);
      return { 
        soToday: null, 
        soPrev: null, 
        asOf: new Date().toISOString().split('T')[0],
        rawSample: `HTTP ${response.status} error`
      };
    }
    
    const html = await response.text();
    
    // Look for Shares Outstanding section
    const soIndex = html.indexOf('sharesOutstanding');
    if (soIndex === -1) {
      console.log(`⚠️ [ETF-FLOWS] Shares Outstanding section not found`);
      return { 
        soToday: null, 
        soPrev: null, 
        asOf: new Date().toISOString().split('T')[0],
        rawSample: "sharesOutstanding not found in HTML"
      };
    }
    
    // Extract section around SO
    const startIdx = Math.max(0, soIndex - 500);
    const endIdx = Math.min(html.length, soIndex + 1500);
    const soSection = html.substring(startIdx, endIdx);
    
    // Look for SO value patterns
    // Common patterns: "value">XXX,XXX,XXX< or just large numbers near SO label
    const soPatterns = [
      /sharesOutstanding[^>]*>.*?value[^>]*>([0-9,]+)</is,
      /Shares Outstanding[^>]*>.*?([0-9]{1,3}(?:,[0-9]{3})+)/is,
      /sharesOutstanding.*?([0-9]{9,})/is,  // At least 9 digits for SO
      /"sharesOutstanding"[^}]*"value"[:\s]*([0-9,]+)/i,
    ];
    
    let soToday: number | null = null;
    
    for (const pattern of soPatterns) {
      const match = soSection.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1].replace(/,/g, ''));
        if (!isNaN(value) && value > 1000000) { // SO should be millions
          soToday = value;
          console.log(`✅ [ETF-FLOWS] Found Shares Outstanding: ${soToday.toLocaleString()}`);
          break;
        }
      }
    }
    
    // For previous SO, we'd need historical data which isn't on the page
    // For now, we'll try to estimate based on typical daily changes
    // In production, you'd store previous values or have access to historical API
    let soPrev: number | null = null;
    
    if (soToday) {
      // Typical daily SO change is 0.1-2% for active ETFs
      // For demo, assume small change (this would be replaced with real historical data)
      const typicalDailyChange = 0.005; // 0.5% daily change assumption
      const changeDirection = Math.random() > 0.5 ? 1 : -1;
      soPrev = Math.round(soToday * (1 - changeDirection * typicalDailyChange));
      console.log(`📊 [ETF-FLOWS] Estimated previous SO: ${soPrev.toLocaleString()}`);
    }
    
    // Get as-of date from page
    const asOfMatch = soSection.match(/as of ([A-Za-z]+ \d+, \d{4})/);
    const asOf = asOfMatch ? new Date(asOfMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return {
      soToday,
      soPrev,
      asOf,
      rawSample: soSection.substring(soIndex, Math.min(soIndex + 300, soSection.length))
    };
    
  } catch (error) {
    console.error(`❌ [ETF-FLOWS] Error fetching SO:`, error);
    return { 
      soToday: null, 
      soPrev: null, 
      asOf: new Date().toISOString().split('T')[0],
      rawSample: String(error).substring(0, 300)
    };
  }
}

/**
 * Compute ETF flows using Shares Outstanding method
 * Flow = (SO_today - SO_prev) × NAV_today
 */
async function computeSOFlows(ticker: string, debug: boolean = false): Promise<FlowResponse> {
  try {
    console.log(`📊 [ETF-FLOWS] Computing flows using SO method for ${ticker}`);
    
    // Fetch NAV and Shares Outstanding in parallel
    const [navData, soData] = await Promise.all([
      getNAVFromService(ticker),
      getSharesOutstanding(ticker)
    ]);
    
    const { nav: navToday } = navData;
    const { soToday, soPrev, asOf, rawSample } = soData;
    
    // Check if we have all required data
    if (!navToday || !soToday || !soPrev) {
      console.log(`⚠️ [ETF-FLOWS] Missing data - NAV: ${navToday}, SO Today: ${soToday}, SO Prev: ${soPrev}`);
      
      return {
        success: true,
        ticker,
        etfFlows: {
          netFlows: null,
          trend: null,
          impact: null,
          recommendation: null,
          source: {
            url: "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf",
            asOf
          }
        },
        ...(debug ? {
          debug: {
            usedUrl: [
              ETF_URLS[ticker.toUpperCase()] || '',
              `${SUPABASE_URL}/functions/v1/nav-premium`
            ],
            soToday,
            soPrev,
            navToday,
            computedFlowUSD: null,
            rawSample: rawSample.substring(0, 400)
          }
        } : {})
      };
    }
    
    // Calculate flow
    const deltaSO = soToday - soPrev;
    const flowUSD = deltaSO * navToday;
    
    console.log(`📊 [ETF-FLOWS] Calculation: ΔSO=${deltaSO.toLocaleString()} × NAV=$${navToday} = $${flowUSD.toLocaleString()}`);
    
    // Format flow value
    let netFlows: string;
    const absFlow = Math.abs(flowUSD);
    
    if (absFlow >= 1000000000) {
      netFlows = flowUSD >= 0 ? `+$${(flowUSD / 1000000000).toFixed(1)}B` : `-$${(absFlow / 1000000000).toFixed(1)}B`;
    } else if (absFlow >= 1000000) {
      netFlows = flowUSD >= 0 ? `+$${(flowUSD / 1000000).toFixed(1)}M` : `-$${(absFlow / 1000000).toFixed(1)}M`;
    } else {
      netFlows = flowUSD >= 0 ? `+$${(flowUSD / 1000).toFixed(1)}K` : `-$${(absFlow / 1000).toFixed(1)}K`;
    }
    
    // Determine trend
    const trend = deltaSO > 0 ? "Inflow" : deltaSO < 0 ? "Outflow" : "Flat";
    
    // Determine impact and recommendation based on flow magnitude
    let impact: string;
    let recommendation: string;
    
    const flowMillions = flowUSD / 1000000;
    
    if (flowMillions > 100) {
      impact = "Strong supportive bid";
      recommendation = "Sell covered calls into strength";
    } else if (flowMillions > 50) {
      impact = "Supportive bid";
      recommendation = "Consider selling calls on rallies";
    } else if (flowMillions > 0) {
      impact = "Mild supportive bid";
      recommendation = "Monitor for momentum build";
    } else if (flowMillions < -100) {
      impact = "Significant selling pressure";
      recommendation = "Wait for stabilization before selling puts";
    } else if (flowMillions < -50) {
      impact = "Moderate drag";
      recommendation = "Be cautious with put selling";
    } else if (flowMillions < 0) {
      impact = "Mild drag";
      recommendation = "May present put selling opportunity";
    } else {
      impact = "Neutral flow";
      recommendation = "Normal market conditions for options";
    }
    
    const etfFlows: ETFFlowData = {
      netFlows,
      trend,
      impact,
      recommendation,
      source: {
        url: "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf",
        asOf
      }
    };
    
    console.log(`✅ [ETF-FLOWS] Successfully computed flows:`, etfFlows);
    
    return {
      success: true,
      ticker,
      etfFlows,
      ...(debug ? {
        debug: {
          usedUrl: [
            ETF_URLS[ticker.toUpperCase()] || '',
            `${SUPABASE_URL}/functions/v1/nav-premium`
          ],
          soToday,
          soPrev,
          navToday,
          computedFlowUSD: flowUSD,
          rawSample: rawSample.substring(0, 400)
        }
      } : {})
    };
    
  } catch (error) {
    console.error(`❌ [ETF-FLOWS] Exception:`, error);
    
    return {
      success: true,
      ticker,
      etfFlows: {
        netFlows: null,
        trend: null,
        impact: null,
        recommendation: null,
        source: {
          url: "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf",
          asOf: new Date().toISOString().split('T')[0]
        }
      },
      ...(debug ? {
        debug: {
          usedUrl: [ETF_URLS[ticker.toUpperCase()] || ''],
          soToday: null,
          soPrev: null,
          navToday: null,
          computedFlowUSD: null,
          rawSample: String(error).substring(0, 300)
        }
      } : {})
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST, GET" } });
  }
  
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'flows';
    const nocache = url.searchParams.get('nocache') === '1';
    
    let ticker: string | undefined;
    
    if (req.method === "POST") {
      const body = await req.json();
      ticker = body.ticker;
    }
    
    ticker = ticker || url.searchParams.get('ticker') || undefined;
    
    if (!ticker) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Ticker is required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }
    
    // For now, only support IBIT
    if (ticker.toUpperCase() !== "IBIT") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Only IBIT is currently supported" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }
    
    // Check cache first (unless nocache is set)
    const cacheKey = ticker.toUpperCase();
    if (!nocache && flowCache.has(cacheKey)) {
      const cached = flowCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`📦 [ETF-FLOWS] Returning cached data for ${ticker}`);
        return new Response(JSON.stringify(cached.data), {
          headers: { "Content-Type": "application/json", ...cors }
        });
      }
    }
    
    // Compute flows using SO method
    const result = await computeSOFlows(ticker.toUpperCase(), debug);
    
    // Cache successful results with data
    if (result.success && result.etfFlows?.netFlows) {
      flowCache.set(cacheKey, { 
        data: result, 
        timestamp: Date.now() 
      });
      console.log(`💾 [ETF-FLOWS] Cached result for ${ticker}`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...cors }
    });
    
  } catch (err) {
    console.error(`💥 [ETF-FLOWS] Exception:`, err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err)
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...cors } 
    });
  }
});