import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// 30-second cache to respect rate limits
const cache = new Map<string, { ts: number; res: Response }>();

interface PolygonOptionQuote {
  details: {
    strike_price: number;
    expiration_date: string;
    contract_type: 'call' | 'put';
    ticker: string;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  day?: {
    close: number;
    high: number;
    low: number;
    vwap: number;
  };
  last_quote?: {
    ask: number;
    bid: number;
    last_updated: number;
  };
  implied_volatility?: number;
  open_interest?: number;
}

interface PolygonResponse {
  results?: PolygonOptionQuote[];
  status: string;
  request_id?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("POLYGON_API_KEY");
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "").toUpperCase();
    const strike = parseFloat(searchParams.get("strike") || "0");
    const expiry = searchParams.get("expiry") || "";
    const contractType = searchParams.get("contract_type") || "call";
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!ticker || !strike || !expiry) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters: ticker, strike, expiry" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create cache key from params
    const cacheKey = `${ticker}-${strike}-${expiry}-${contractType}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30_000) {
      return cached.res.clone();
    }

    // Fetch specific option from Polygon
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 second timeout
    
    try {
      // Query for specific strike and expiration
      const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?` + 
        `apiKey=${apiKey}&` +
        `strike_price=${strike}&` +
        `expiration_date=${expiry}&` +
        `contract_type=${contractType}&` +
        `limit=1`;
      
      console.log(`Fetching option quote: ${ticker} ${strike} ${expiry} ${contractType}`);
      
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ success: false, reason: "rate", error: "Rate limit exceeded" }), 
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Polygon API error: ${response.status}`);
      }

      const data: PolygonResponse = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Option not found",
            searched: { ticker, strike, expiry, contractType }
          }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const option = data.results[0];
      
      // Log raw response for debugging
      console.log('Raw Polygon response:', JSON.stringify(option, null, 2));
      
      // Calculate days to expiration
      const today = new Date();
      const expiryDate = new Date(option.details.expiration_date);
      const dte = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Extract pricing
      let mid = 0;
      let bid = null;
      let ask = null;
      
      // Note: Polygon snapshot API doesn't include bid/ask in starter plan
      // Real-time quotes require Options Starter ($29/mo) or higher
      if (option.last_quote?.ask && option.last_quote?.bid) {
        // This would work with higher tier plans
        ask = option.last_quote.ask / 10000;
        bid = option.last_quote.bid / 10000;
        mid = (ask + bid) / 2;
      } else if (option.day?.close) {
        // Use day's close as mid price (starter plan limitation)
        mid = option.day.close;
        console.log(`Using day close as mid: ${mid} (bid/ask requires higher tier Polygon plan)`);
      }
      
      // Build response
      const quoteData = {
        success: true,
        quote: {
          ticker: option.details.ticker,
          strike: option.details.strike_price,
          expiry: option.details.expiration_date,
          type: option.details.contract_type,
          dte,
          mid,
          bid,
          ask,
          delta: option.greeks?.delta || null,
          gamma: option.greeks?.gamma || null,
          theta: option.greeks?.theta || null,
          vega: option.greeks?.vega || null,
          iv: option.implied_volatility || null,
          openInterest: option.open_interest || null,
          dayVolume: option.day?.volume || null,
          lastUpdated: option.last_quote?.last_updated || Date.now()
        },
        ts: Date.now(),
        note: bid === null && ask === null ? 
          "Bid/Ask unavailable - Polygon starter plan limitation. Using day's close as mid price." : 
          undefined
      };
      
      const successResponse = new Response(
        JSON.stringify(quoteData), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
      // Cache the successful response
      cache.set(cacheKey, { ts: Date.now(), res: successResponse.clone() });
      
      return successResponse;
    
    } catch (timeoutError) {
      if (timeoutError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ success: false, error: "Request timeout after 10 seconds" }), 
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw timeoutError;
    } finally {
      clearTimeout(timeout);
    }

  } catch (error) {
    console.error('Error in option-quote function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});