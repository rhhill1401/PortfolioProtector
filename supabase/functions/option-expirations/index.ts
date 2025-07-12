import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface PolygonContract {
  cfi?: string;
  contract_type?: string;
  exercise_style?: string;
  expiration_date?: string;
  primary_exchange?: string;
  shares_per_contract?: number;
  strike_price?: number;
  ticker?: string;
  underlying_ticker?: string;
}

interface PolygonResponse {
  results?: PolygonContract[];
  status: string;
  next_url?: string;
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
        JSON.stringify({ success: false, error: "Missing required parameter: ticker" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching option expirations for ticker: ${ticker}`);

    // Get all option contracts for this ticker
    const url = `https://api.polygon.io/v3/reference/options/contracts?` + 
      `underlying_ticker=${ticker}&` +
      `expired=false&` +
      `limit=1000&` +
      `order=asc&` +
      `sort=expiration_date&` +
      `apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded" }), 
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
          error: "No options found for ticker",
          ticker
        }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract unique expiration dates
    const expirationDates = new Set<string>();
    
    data.results.forEach(contract => {
      if (contract.expiration_date) {
        expirationDates.add(contract.expiration_date);
      }
    });

    // Convert to array and sort
    const sortedExpirations = Array.from(expirationDates).sort();
    
    // Filter for the requested months: Jan 2026, Dec 2025, Nov 2025, Sep 2025
    const filteredExpirations = sortedExpirations.filter(date => {
      return date.includes('2026-01') || // January 2026
             date.includes('2025-12') || // December 2025
             date.includes('2025-11') || // November 2025
             date.includes('2025-09');   // September 2025
    });

    console.log(`Found ${sortedExpirations.length} total expirations, filtered to ${filteredExpirations.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        ticker,
        expirations: filteredExpirations,
        totalAvailable: sortedExpirations.length,
        filteredCount: filteredExpirations.length
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in option-expirations function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});