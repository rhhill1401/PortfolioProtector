import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

// Cache for 120 seconds to avoid rate limits
const navCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 120000; // 2 minutes

interface NavAnalysis {
  premium: string | null;
  discount: string | null;
  interpretation: string | null;
  tradingOpportunity: string | null;
  source: { url: string; asOf: string };
}

interface NavResponse {
  success: boolean;
  ticker: string;
  navAnalysis: NavAnalysis | null;
  navSnapshot?: {
    nav: number;
    asOf: string;
  };
  debug?: {
    usedUrl: string;
    priceSource: string;
    navValue: number | null;
    marketPrice: number | null;
    computedPremiumPct: number | null;
    statusCode: number;
    rawSample: string;
  };
}

/**
 * Get IBIT market price from Polygon API
 */
async function getMarketPrice(ticker: string): Promise<{ price: number | null; priceAsOf: string }> {
  try {
    // Try to get the latest snapshot
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(snapshotUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === "OK" && data.ticker) {
        const price = data.ticker.day?.c || data.ticker.prevDay?.c || null; // Current close or previous close
        const priceAsOf = new Date().toISOString();
        console.log(`✅ [POLYGON] Got price for ${ticker}: $${price}`);
        return { price, priceAsOf };
      }
    }
    
    // Fallback: Try previous close
    const prevCloseUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`;
    const prevResponse = await fetch(prevCloseUrl);
    
    if (prevResponse.ok) {
      const prevData = await prevResponse.json();
      if (prevData.status === "OK" && prevData.results?.length > 0) {
        const price = prevData.results[0].c;
        const priceAsOf = new Date(prevData.results[0].t).toISOString();
        console.log(`✅ [POLYGON] Got previous close for ${ticker}: $${price}`);
        return { price, priceAsOf };
      }
    }
    
    console.log(`⚠️ [POLYGON] Could not get price for ${ticker}`);
    return { price: null, priceAsOf: new Date().toISOString() };
    
  } catch (error) {
    console.error(`❌ [POLYGON] Error fetching price:`, error);
    return { price: null, priceAsOf: new Date().toISOString() };
  }
}

/**
 * Parse NAV from iShares HTML page
 * We'll fetch the page and look for NAV in the HTML
 */
async function getNavFromIShares(ticker: string): Promise<{ nav: number | null; navAsOf: string; sourceUrl: string }> {
  const productUrl = "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf";
  
  try {
    console.log(`📊 [NAV] Fetching iShares page for NAV`);
    
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ [NAV] Failed to fetch iShares page: ${response.status}`);
      return { nav: null, navAsOf: new Date().toISOString().split('T')[0], sourceUrl: productUrl };
    }
    
    const html = await response.text();
    
    // Look for NAV in various patterns in the HTML
    // The NAV is typically displayed alongside the market price
    // Look for patterns like: NAV $66.18 or "nav": "66.18"
    const navPatterns = [
      /NAV[^$]*\$([0-9]+\.[0-9]+)/i,  // NAV $66.18
      /"nav"[:\s]+["']?([0-9]+\.[0-9]+)/i,  // "nav": "66.18"
      /"navPrice"[:\s]+["']?([0-9]+\.[0-9]+)/i,  // "navPrice": "66.18"
      /"netAssetValue"[:\s]+["']?([0-9]+\.[0-9]+)/i,  // "netAssetValue": "66.18"
      /Net Asset Value[^$]*\$([0-9]+\.[0-9]+)/i,  // Net Asset Value $66.18
      />NAV<[^>]*>[^$]*\$([0-9]+\.[0-9]+)/,  // >NAV<...>$66.18
    ];
    
    let nav: number | null = null;
    
    for (const pattern of navPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        nav = parseFloat(match[1]);
        if (!isNaN(nav) && nav > 0 && nav < 1000) { // Sanity check
          console.log(`✅ [NAV] Found NAV: $${nav}`);
          break;
        }
      }
    }
    
    // If we still don't have NAV, try looking for it in JSON-LD or script tags
    if (!nav) {
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          // Look for price in structured data
          if (jsonData.price) {
            nav = parseFloat(jsonData.price);
          }
        } catch (e) {
          // JSON parse failed, continue
        }
      }
    }
    
    // Get the as-of date (usually today or previous business day)
    const asOfMatch = html.match(/as\s+of[^0-9]*([\d\/\-]+)/i);
    const navAsOf = asOfMatch ? new Date(asOfMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    // If we couldn't find NAV and it's IBIT, it typically trades very close to market price
    // As a fallback for IBIT, we can look for the first price on the page which is usually NAV
    if (!nav && ticker === "IBIT") {
      const priceMatch = html.match(/\$([0-9]+\.[0-9]+)/);
      if (priceMatch && priceMatch[1]) {
        const potentialNav = parseFloat(priceMatch[1]);
        if (!isNaN(potentialNav) && potentialNav > 30 && potentialNav < 200) {
          nav = potentialNav;
          console.log(`✅ [NAV] Found price (likely NAV) for IBIT: $${nav}`);
        }
      }
    }
    
    if (nav) {
      console.log(`✅ [NAV] Successfully extracted NAV: $${nav} as of ${navAsOf}`);
    } else {
      console.log(`⚠️ [NAV] Could not extract NAV from HTML`);
    }
    
    return { nav, navAsOf, sourceUrl: productUrl };
    
  } catch (error) {
    console.error(`❌ [NAV] Error fetching/parsing iShares page:`, error);
    return { nav: null, navAsOf: new Date().toISOString().split('T')[0], sourceUrl: productUrl };
  }
}

/**
 * Compute premium/discount deterministically
 */
function computePremiumDiscount(marketPrice: number | null, nav: number | null): {
  premiumPct: number | null;
  premium: string | null;
  discount: string | null;
  interpretation: string | null;
  tradingOpportunity: string | null;
} {
  if (!marketPrice || !nav) {
    return {
      premiumPct: null,
      premium: null,
      discount: null,
      interpretation: null,
      tradingOpportunity: null
    };
  }
  
  // Calculate premium/discount percentage
  const premiumPct = ((marketPrice - nav) / nav) * 100;
  
  // Format as strings
  const premium = premiumPct >= 0 ? `${premiumPct.toFixed(2)}%` : null;
  const discount = premiumPct < 0 ? `${Math.abs(premiumPct).toFixed(2)}%` : null;
  
  // Deterministic interpretation based on percentage
  let interpretation: string;
  let tradingOpportunity: string;
  
  if (Math.abs(premiumPct) <= 0.10) {
    interpretation = "Trading near NAV";
    tradingOpportunity = "Fair value - suitable for market orders";
  } else if (premiumPct > 0.50) {
    interpretation = "Trading at a notable premium to NAV";
    tradingOpportunity = "Consider waiting for premium to normalize before buying";
  } else if (premiumPct > 0.10) {
    interpretation = "Trading at a slight premium to NAV";
    tradingOpportunity = "Minor premium suggests normal market demand";
  } else if (premiumPct < -0.50) {
    interpretation = "Trading at a notable discount to NAV";
    tradingOpportunity = "Potential buying opportunity at discount";
  } else {
    interpretation = "Trading at a slight discount to NAV";
    tradingOpportunity = "Minor discount may present entry opportunity";
  }
  
  return {
    premiumPct,
    premium,
    discount,
    interpretation,
    tradingOpportunity
  };
}

/**
 * Main function to fetch IBIT NAV data
 */
async function fetchIBITNav(debug: boolean = false): Promise<NavResponse> {
  const ticker = "IBIT";
  
  try {
    console.log(`📊 [NAV-PREMIUM] Starting data fetch for ${ticker}`);
    
    // Fetch market price and NAV in parallel
    const [priceData, navData] = await Promise.all([
      getMarketPrice(ticker),
      getNavFromIShares(ticker)
    ]);
    
    // Compute premium/discount
    const calculation = computePremiumDiscount(priceData.price, navData.nav);
    
    // Build response
    const navAnalysis: NavAnalysis = {
      premium: calculation.premium,
      discount: calculation.discount,
      interpretation: calculation.interpretation,
      tradingOpportunity: calculation.tradingOpportunity,
      source: {
        url: navData.sourceUrl,
        asOf: navData.navAsOf
      }
    };
    
    const response: NavResponse = {
      success: true,
      ticker,
      navAnalysis: calculation.premium || calculation.discount ? navAnalysis : null
    };
    
    // Always include navSnapshot if we have NAV data
    if (navData.nav) {
      response.navSnapshot = {
        nav: navData.nav,
        asOf: navData.navAsOf
      };
    }
    
    if (debug) {
      response.debug = {
        usedUrl: navData.sourceUrl,
        priceSource: `Polygon API - ${priceData.priceAsOf}`,
        navValue: navData.nav,
        marketPrice: priceData.price,
        computedPremiumPct: calculation.premiumPct,
        statusCode: 200,
        rawSample: `Market Price: $${priceData.price?.toFixed(2) || 'N/A'}, NAV: $${navData.nav?.toFixed(2) || 'N/A'}, Premium/Discount: ${calculation.premiumPct?.toFixed(2) || 'N/A'}%`
      };
    }
    
    console.log(`✅ [NAV-PREMIUM] Completed calculation:`, {
      marketPrice: priceData.price,
      nav: navData.nav,
      premiumPct: calculation.premiumPct
    });
    
    return response;
    
  } catch (error) {
    console.error(`❌ [NAV-PREMIUM] Exception:`, error);
    
    return {
      success: false,
      ticker,
      navAnalysis: null,
      ...(debug ? {
        debug: {
          usedUrl: "",
          priceSource: "Error",
          navValue: null,
          marketPrice: null,
          computedPremiumPct: null,
          statusCode: 500,
          rawSample: String(error).substring(0, 300)
        }
      } : {})
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST" } });
  }
  
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === 'nav';
    const nocache = url.searchParams.get('nocache') === '1';
    
    const body = await req.json();
    const ticker = body.ticker || url.searchParams.get('ticker');
    
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
    if (!nocache && navCache.has(cacheKey)) {
      const cached = navCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`📦 [NAV-PREMIUM] Returning cached data for ${ticker}`);
        return new Response(JSON.stringify(cached.data), {
          headers: { "Content-Type": "application/json", ...cors }
        });
      }
    }
    
    // Fetch fresh data
    const result = await fetchIBITNav(debug);
    
    // Cache successful results
    if (result.success && result.navAnalysis) {
      navCache.set(cacheKey, { 
        data: result, 
        timestamp: Date.now() 
      });
      console.log(`💾 [NAV-PREMIUM] Cached result for ${ticker}`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...cors }
    });
    
  } catch (err) {
    console.error(`💥 [NAV-PREMIUM] Exception:`, err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err)
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...cors } 
    });
  }
});