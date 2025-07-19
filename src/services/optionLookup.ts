/**
 * Service for fetching specific option quotes from Polygon
 * Used to get current market prices for existing positions
 */

interface WheelPosition {
  symbol: string;
  strike: number;
  expiry: string; // YYYY-MM-DD format
  type: 'CALL' | 'PUT';
  contracts: number;
  premium?: number;
  premiumCollected?: number;
}

interface OptionQuote {
  ticker: string;
  strike: number;
  expiry: string;
  type: string;
  dte: number;
  mid: number;
  bid: number | null;
  ask: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  openInterest: number | null;
  dayVolume: number | null;
  lastUpdated: number;
}

interface QuoteResponse {
  success: boolean;
  quote?: OptionQuote;
  error?: string;
  ts?: number;
}

/**
 * Fetch current quotes for multiple option positions
 * Makes parallel requests to minimize latency
 */
export async function fetchQuotes(positions: WheelPosition[]): Promise<QuoteResponse[]> {
  const supabaseFnUrl = import.meta.env.VITE_SUPABASE_FN_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseFnUrl) {
    throw new Error('Supabase Functions URL not configured');
  }

  // Make parallel requests for all positions
  const promises = positions.map(async (position) => {
    try {
      const params = new URLSearchParams({
        ticker: position.symbol,
        strike: String(position.strike),
        expiry: position.expiry,
        contract_type: position.type.toLowerCase()
      });

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json' 
      };
      if (supabaseAnonKey) {
        headers.Authorization = `Bearer ${supabaseAnonKey}`;
      }

      const response = await fetch(
        `${supabaseFnUrl}/option-quote?${params}`,
        { headers }
      );

      const data: QuoteResponse = await response.json();
      
      if (!response.ok) {
        console.error(`Failed to fetch quote for ${position.symbol} ${position.strike} ${position.expiry}:`, data.error);
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`
        };
      }

      return data;
    } catch (error) {
      console.error(`Error fetching quote for ${position.symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Fetch a single option quote
 */
export async function fetchSingleQuote(
  symbol: string,
  strike: number,
  expiry: string,
  type: 'call' | 'put'
): Promise<QuoteResponse> {
  const position: WheelPosition = {
    symbol,
    strike,
    expiry,
    type: type.toUpperCase() as 'CALL' | 'PUT',
    contracts: 1
  };

  const results = await fetchQuotes([position]);
  return results[0];
}

/**
 * Calculate total cost to close all positions
 */
export function calculateTotalCostToClose(
  positions: WheelPosition[],
  quotes: QuoteResponse[]
): number {
  return positions.reduce((total, position, index) => {
    const quote = quotes[index];
    // Guard against failed quotes
    if (!quote?.success || !quote.quote) return total;
    
    // Cost to close = mid price × 100 × number of contracts
    // For short positions (negative contracts), this will be a positive cost
    const costPerContract = quote.quote.mid * 100;
    const totalCost = costPerContract * Math.abs(position.contracts);
    return total + totalCost;
  }, 0);
}

/**
 * Calculate aggregate metrics from positions and quotes
 */
export function calculateAggregateMetrics(
  positions: WheelPosition[],
  quotes: QuoteResponse[]
) {
  console.log('[WHEEL METRICS] calculateAggregateMetrics called with:', {
    positionsCount: positions.length,
    quotesCount: quotes.length,
    firstPosition: positions[0]
  });
  
  let totalPremiumCollected = 0;
  let totalCostToClose = 0;
  let weightedDelta = 0;
  let totalContracts = 0;

  positions.forEach((position, index) => {
    const quote = quotes[index];
    const contractCount = Math.abs(position.contracts);
    
    // Log the entire position to see what fields it has
    console.log(`[WHEEL METRICS] Full position data:`, position);
    
    // Premium collected (from position data) - check all possible field names
    const premium = position.premium || position.premiumCollected || 0;
    
    // Check if premium is per-share (small value) or total (large value)
    // If premium is less than 50, it's likely per-share and needs multiplication
    const isPerShare = premium < 50;
    const premiumTotal = isPerShare ? premium * 100 * contractCount : premium;
    
    console.log(`[WHEEL METRICS] Position ${position.symbol} $${position.strike}:`, {
      premium,
      isPerShare,
      contractCount,
      premiumTotal,
      hasQuote: !!quote?.success
    });
    
    totalPremiumCollected += premiumTotal;
    
    // Guard against failed quotes
    if (!quote?.success || !quote.quote) {
      // Skip this position for market value calculations
      return;
    }
    
    // Current market value (from quote)
    const costPerContract = quote.quote.mid * 100;
    totalCostToClose += costPerContract * contractCount;
    
    // Weighted delta
    if (quote.quote.delta !== null) {
      weightedDelta += quote.quote.delta * contractCount;
      totalContracts += contractCount;
    }
  });

  const unrealizedPL = totalPremiumCollected - totalCostToClose;
  const averageDelta = totalContracts > 0 ? weightedDelta / totalContracts : null;

  return {
    totalPremiumCollected,
    totalCostToClose,
    unrealizedPL,
    unrealizedPLPercent: totalPremiumCollected > 0 
      ? (unrealizedPL / totalPremiumCollected) * 100 
      : 0,
    averageDelta,
    netPremiumRemaining: Math.max(0, totalCostToClose - totalPremiumCollected)
  };
}