import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// 30-second cache to respect rate limits
const cache = new Map<string, { ts: number; res: Response }>();

interface PolygonOption {
  details: {
    strike_price: number;
    expiration_date: string;
    contract_type: 'call' | 'put';
    ticker: string;
  };
  greeks?: {
    delta?: number;
    Delta?: number; // Some API responses use capitalized Greek letters
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
  };
  implied_volatility?: number;
}

interface PolygonResponse {
  results?: PolygonOption[];
  status: string;
}

interface PolygonPriceResponse {
  results?: Array<{
    c: number; // closing price
  }>;
}

interface TransformedOption {
  expiry: string;
  strike: number;
  dte: number;
  delta: number;
  mid: number;
  iv: number | null;
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
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: "Ticker parameter required" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    const cached = cache.get(ticker);
    if (cached && Date.now() - cached.ts < 30_000) {
      return cached.res.clone();
    }

    // Declare variables outside try block for proper scoping
    let data: PolygonResponse;
    let chain: TransformedOption | null;
    let underlying: number | null = null;

    // Fetch options snapshot from Polygon with greeks enabled (with timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 second timeout
    
    try {
      // Calculate date range for 20-60 days out
      const today = new Date();
      const minDate = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000);
      const maxDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      const minDateStr = minDate.toISOString().split('T')[0];
      const maxDateStr = maxDate.toISOString().split('T')[0];
      
      const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?apiKey=${apiKey}&limit=250&contract_type=call&expiration_date.gte=${minDateStr}&expiration_date.lte=${maxDateStr}`;
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

      data = await response.json();
      
      // Debug log the response structure
      console.log(`Polygon response for ${ticker}:`, {
        hasResults: !!data.results,
        resultsLength: data.results?.length || 0,
        status: data.status,
        keys: Object.keys(data),
        firstOption: data.results?.[0]
      });
      
      if (!data.results || data.results.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No options data available" }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch underlying stock price
      try {
        const pxResp = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${apiKey}`
        );
        if (pxResp.ok) {
          const pxData: PolygonPriceResponse = await pxResp.json();
          underlying = pxData.results?.[0]?.c ?? null;
        }
      } catch (err) {
        console.error('Failed to fetch underlying price:', err);
      }

      // Transform the data to find the optimal wheel strategy option
      chain = transformPolygon(data.results, underlying);
      
      if (!chain) {
        return new Response(
          JSON.stringify({ success: false, error: "No suitable options found" }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build and cache the response
      const responseData = { success: true, chain, underlying, ts: Date.now() };
      const successResponse = new Response(
        JSON.stringify(responseData), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
      // Cache the successful response
      cache.set(ticker, { ts: Date.now(), res: successResponse.clone() });
      
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
    console.error('Error in option-chain function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Find the optimal option for wheel strategy targeting 30-45% annual returns:
 * - Call options only
 * - 20-60 days to expiration
 * - Calculate annualized return and filter for 30-45% range
 * - Among qualifying options, prefer delta around 0.30-0.35
 */
function transformPolygon(options: PolygonOption[], underlying?: number | null): TransformedOption | null {
  const today = new Date();
  
  console.log(`transformPolygon: Processing ${options.length} options`);
  
  // Filter for calls with proper data
  const validCalls = options
    .filter(opt => {
      // Check if it's a call from details or root level
      const isCall = opt.details?.contract_type === 'call' || opt.contract_type === 'call';
      console.log(`Option ${opt.details?.ticker}: type=${opt.details?.contract_type || opt.contract_type}, isCall=${isCall}`);
      return isCall;
    })
    .map(opt => {
      // Get delta with fallbacks for different API response formats
      const greeks = opt.greeks || opt.details?.greeks;
      const deltaValue = greeks?.delta ?? greeks?.Delta ?? null;
      
      console.log(`Option ${opt.details?.ticker}: delta=${deltaValue}, greeks=${JSON.stringify(greeks)}`);
      
      if (deltaValue === null || deltaValue === undefined) {
        return null;
      }
      
      // Use day close price if no quote data
      let mid = 0;
      if (opt.last_quote?.ask && opt.last_quote?.bid) {
        // Polygon quotes come as integer × 1e4, always normalize to dollars
        const norm = (p: number) => p / 10000;
        const ask = norm(opt.last_quote.ask);
        const bid = norm(opt.last_quote.bid);
        if (ask > 0 && bid > 0 && ask >= bid) {
          mid = (ask + bid) / 2;
        }
      } else if (opt.day?.close) {
        // Use day's close price as fallback
        mid = opt.day.close;
      }
      
      if (mid === 0) {
        console.log(`Option ${opt.details?.ticker}: No valid price found`);
        return null;
      }
      
      const expiry = new Date(opt.details.expiration_date);
      const dte = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const delta = Math.abs(deltaValue);
      
      return {
        expiry: opt.details.expiration_date,
        strike: opt.details.strike_price,
        dte,
        delta,
        mid,
        iv: opt.implied_volatility ?? null // null instead of 0 for missing IV
      };
    })
    .filter((opt): opt is TransformedOption => {
      if (opt === null) return false;
      console.log(`Filtering option: strike=${opt.strike}, dte=${opt.dte}, delta=${opt.delta}`);
      
      // Temporarily more permissive for debugging
      const passes = opt.dte >= 15 && 
        opt.dte <= 90 &&
        opt.delta >= 0.15 &&
        opt.delta <= 0.50;
      
      console.log(`Option passes filter: ${passes}`);
      return passes;
    });

  if (validCalls.length === 0) {
    return null;
  }

  // If we don't have underlying price, fall back to delta-based selection
  if (!underlying || underlying <= 0) {
    console.log('No underlying price available, using delta-based selection');
    const targetDelta = 0.325;
    validCalls.sort((a, b) => 
      Math.abs(a.delta - targetDelta) - Math.abs(b.delta - targetDelta)
    );
    return validCalls[0];
  }

  // Calculate annualized return for each option
  const optionsWithReturns = validCalls.map(opt => {
    // Annualized Return = (Premium / Strike) × (365 / DTE) × 100
    const annualizedReturn = (opt.mid / opt.strike) * (365 / opt.dte) * 100;
    return { ...opt, annualizedReturn };
  });

  console.log('Options with annualized returns:', optionsWithReturns.map(o => ({
    strike: o.strike,
    dte: o.dte,
    premium: o.mid,
    annualReturn: o.annualizedReturn.toFixed(1) + '%',
    delta: o.delta
  })));

  // Filter for options that yield 30-45% annually
  const highYieldOptions = optionsWithReturns.filter(opt => 
    opt.annualizedReturn >= 30 && opt.annualizedReturn <= 45
  );

  // If we have high-yield options, pick the one with delta closest to 0.325
  if (highYieldOptions.length > 0) {
    const targetDelta = 0.325;
    highYieldOptions.sort((a, b) => 
      Math.abs(a.delta - targetDelta) - Math.abs(b.delta - targetDelta)
    );
    console.log(`Found ${highYieldOptions.length} options with 30-45% annual return`);
    return highYieldOptions[0];
  }

  // If no options yield 30-45%, find the highest yielding option with reasonable delta
  const reasonableDeltaOptions = optionsWithReturns.filter(opt => 
    opt.delta >= 0.20 && opt.delta <= 0.40
  );

  if (reasonableDeltaOptions.length > 0) {
    // Sort by annualized return (highest first)
    reasonableDeltaOptions.sort((a, b) => b.annualizedReturn - a.annualizedReturn);
    console.log(`No 30-45% options found, returning highest yield option: ${reasonableDeltaOptions[0].annualizedReturn.toFixed(1)}%`);
    return reasonableDeltaOptions[0];
  }

  // Final fallback: just return the option with best delta
  const targetDelta = 0.325;
  validCalls.sort((a, b) => 
    Math.abs(a.delta - targetDelta) - Math.abs(b.delta - targetDelta)
  );
  return validCalls[0];
}