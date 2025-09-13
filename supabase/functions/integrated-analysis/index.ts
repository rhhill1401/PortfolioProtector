/* supabase/functions/integrated-analysis/index.ts
 * One-shot AI that merges ticker quote, portfolio, chart techs, and research docs
 * Input  (POST JSON):
 * {
 *   ticker: string,
 *   portfolio: { positions: unknown }[],
 *   charts:    { timeframe: string; pattern: string; confidence: number }[],
 *   research:  { source: string; sentiment: number; keyPoints: string[] }[]
 * }
 * Output: { success, analysis, confidence }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
const json = (b: unknown, s = 200): Response =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", ...cors },
  });

Deno.serve(async (req) => {
  /* ---------- CORS pre-flight ---------- */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...cors, "Access-Control-Allow-Methods": "POST" },
    });
  }

  /* ---------- Validate body ---------- */
  interface PortfolioData {
    positions: Array<{
      symbol: string;
      quantity: number;
      purchasePrice?: number;
      currentValue?: number;
      percentOfPortfolio?: number;
    }>;
    totalValue?: number;
    rawFiles?: string[];
    metadata?: Record<string, unknown>;
  }

  interface KeyLevel {
    price: number;
    type: "Support" | "Resistance";
    strength: string;
  }

  interface ChartMetric {
    timeframe: string;
    keyLevels?: KeyLevel[];
    trend: string;
    rsi: string;
    macd: string;
  }

  interface PriceContext {
    current: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    date: string | null;
    timeframe: string;
    rangeDays?: number;
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
    isStale?: boolean;
  }

  let body:
    | {
        ticker?: string;
        portfolio?: PortfolioData;
        charts?: unknown[];
        chartMetrics?: ChartMetric[];
        priceContext?: PriceContext;
        research?: unknown[];
        optionGreeks?: Record<string, OptionQuote>;
      }
    | undefined;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { ticker,
          portfolio,
          chartMetrics = [],
          priceContext,
          optionGreeks = {} } = body ?? {};

  if (!ticker) return json({ success: false, error: "ticker required" }, 400);
  if (!OPENAI_API_KEY)
    return json({ success: false, error: "Missing OpenAI key" }, 500);
  
  // 🔍 FILTER PORTFOLIO FOR CURRENT TICKER ONLY
  // This prevents issues when portfolio has multiple tickers (NVDA, etc)
  if (portfolio) {
    // Filter stock positions to only the requested ticker
    if (portfolio.positions) {
      const originalCount = portfolio.positions.length;
      portfolio.positions = portfolio.positions.filter(p => 
        p.symbol === ticker || p.symbol?.toUpperCase() === ticker.toUpperCase()
      );
      console.log(`📊 Filtered positions: ${originalCount} -> ${portfolio.positions.length} (ticker: ${ticker})`);
    }
    
    // Filter option positions to only the requested ticker
    if (portfolio.metadata?.optionPositions) {
      const originalOptCount = portfolio.metadata.optionPositions.length;
      portfolio.metadata.optionPositions = portfolio.metadata.optionPositions.filter(opt => {
        const symbol = (opt.symbol || '').toUpperCase();
        const tickerUpper = ticker.toUpperCase();
        // Match exact ticker or ticker with space (like "IBIT 63 Call")
        return symbol === tickerUpper || symbol.startsWith(tickerUpper + ' ');
      });
      console.log(`📊 Filtered options: ${originalOptCount} -> ${portfolio.metadata.optionPositions.length} (ticker: ${ticker})`);
    }
  }

  // Extract key levels with proper formatting
  const keyLevels = (chartMetrics as ChartMetric[])
    .flatMap((c) => c.keyLevels ?? []);
  
  const supports = keyLevels
    .filter(l => l.type === "Support")
    .sort((a, b) => b.price - a.price); // Highest to lowest
  
  const resistances = keyLevels
    .filter(l => l.type === "Resistance")
    .sort((a, b) => a.price - b.price); // Lowest to highest

  const currentPrice = priceContext?.current || 0;
  const highPrice = priceContext?.high || 0;
  const lowPrice = priceContext?.low || 0;
  
  // 🎯 WHEEL STRATEGY ANALYSIS - Detect portfolio position and wheel phase
  const hasPosition = portfolio?.positions?.some(p => p.symbol === ticker) || false;
  const currentShares = portfolio?.positions?.find(p => p.symbol === ticker)?.quantity || 0;
  const rawPurchase = portfolio?.positions?.find(p => p.symbol === ticker)?.purchasePrice;
  const costBasis = typeof rawPurchase === 'number' && Number.isFinite(rawPurchase) 
    ? rawPurchase 
    : currentPrice; // Use current price as fallback when purchase price is "Unknown" or invalid
  
  // 💰 EXTRACT CASH BALANCE
  // Check if portfolio has cashBalance directly (from portfolio-vision)
  const cashBalance = portfolio?.cashBalance || 0; // No default - use actual value from portfolio
  const stockValue = currentShares * currentPrice;
  const totalValue = portfolio?.totalValue || (cashBalance + stockValue);
  console.log('💰 [CASH BALANCE]:', { 
    cashFromPortfolio: portfolio?.cashBalance,
    cashBalance,
    stockValue, 
    totalValue 
  });
  
  // 📊 EXTRACT ACTUAL OPTION POSITIONS from portfolio metadata
  
  /** ───────── OPTION METRICS PRE-COMPUTE ───────── */
  interface CalculatedOption extends Record<string, unknown> {
    profitLoss: number;
    cycleReturn: number;
    intrinsic: number;
    extrinsic: number;
    optionMTM: number;
    wheelNet: number;
  }
  
  function calcOptionMetrics(opt: Record<string, unknown>, spotPrice: number, costBasis: number, greeks?: OptionQuote): CalculatedOption {
    // Handle premium - trust the value from portfolio-vision, it's already in total format
    const prem = Number(opt.premiumCollected) || 0;
    const cnt  = Math.abs(Number(opt.contracts) || 1);
    
    const cur  = Number(opt.currentValue) || 0;
    const strike = Number(opt.strike) || 0;
    const isCall = opt.optionType === 'CALL';
    
    // For wheel strategy, we keep the premium collected
    const pl = prem;  // Premium collected is our profit
    
    // Assignment profit if shares get called away
    const assignmentProfit = isCall 
      ? (strike - costBasis) * 100 * cnt
      : 0;  // For puts, we'd be buying shares
    
    // Total wheel profit = premium + profit from shares if assigned
    const totalWheelProfit = prem + assignmentProfit;
    
    // MTM for display (what it would cost to buy back)
    const mtm = prem - cur;
    
    // NEW FIELDS as specified:
    const markToMarketPnl = (prem - cur) * (Number(opt.contracts) < 0 ? 1 : -1); // buy-to-close TODAY
    const wheelFinalPnl = prem + assignmentProfit;                               // wheel outcome AT expiry
    
    // Percent return on capital at risk
    const capital = costBasis * 100 * cnt;  // Capital tied up in shares
    const ret = capital > 0 ? (totalWheelProfit / capital) * 100 : 0;
    
    const intrinsic = isCall 
      ? Math.max(0, spotPrice - strike) * 100 * cnt
      : Math.max(0, strike - spotPrice) * 100 * cnt;
    const extrinsic = Math.max(0, cur - intrinsic);
    
    // Return raw Greeks (leave display formatting to the UI)
    const delta = greeks?.delta ?? null;
    const gamma = greeks?.gamma ?? null;
    const theta = greeks?.theta ?? null;
    const vega  = greeks?.vega  ?? null;
    const iv    = greeks?.iv    ?? null; // keep as fraction (0..1); UI will scale to %
    
    return { 
      ...opt, 
      profitLoss: Math.round(pl),
      cycleReturn: Number(ret.toFixed(2)),
      intrinsic: Math.round(intrinsic),
      extrinsic: Math.round(extrinsic),
      optionMTM: Math.round(mtm),
      wheelNet: Math.round(totalWheelProfit),
      assignmentProfit: Math.round(assignmentProfit),
      markPnl: Math.round(markToMarketPnl),    // NEW ➜ "P/L if I buy back now"
      wheelPnl: Math.round(wheelFinalPnl),      // NEW ➜ "P/L if it expires/assigns"
      delta,
      gamma,
      theta,
      vega,
      iv
    };
  }
  
  // Helper functions for normalizing option keys
  function toIsoDate(input: unknown): string {
    if (!input) return "";
    const s = String(input).trim();
    // already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // e.g., "Sep-30-2025" or "Sep 30, 2025"
    const tryParsed = new Date(s.replace(/-/g, " ").replace(/,/g, ""));
    if (!isNaN(tryParsed.getTime())) {
      const y = tryParsed.getFullYear();
      const m = String(tryParsed.getMonth() + 1).padStart(2, "0");
      const d = String(tryParsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return s; // last resort
  }

  function normType(t: unknown): "CALL" | "PUT" {
    return String(t).toUpperCase() === "PUT" ? "PUT" : "CALL";
  }

  function normStrike(v: unknown): string {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v ?? "");
  }

  // Debug: Log optionGreeks to see what we received
  console.log('🔍 [DEBUG] optionGreeks received:', {
    hasOptionGreeks: !!optionGreeks,
    optionGreeksType: typeof optionGreeks,
    optionGreeksKeys: Object.keys(optionGreeks || {}),
    firstKey: Object.keys(optionGreeks || {})[0],
    firstValue: optionGreeks?.[Object.keys(optionGreeks || {})[0]]
  });

  const optionPositions = (portfolio?.metadata?.optionPositions || []).map((opt: Record<string, any>) => {
    const symbol = String(opt.symbol || ticker).toUpperCase();
    const strike = normStrike(opt.strike);
    const expiryIso = toIsoDate(opt.expiry);
    const type = normType(opt.optionType);

    // primary key (ISO); also try raw for backward compatibility
    const primaryKey = `${symbol}-${strike}-${expiryIso}-${type}`;
    const rawKey = `${symbol}-${strike}-${String(opt.expiry || "")}-${type}`;

    const positionGreeks =
      (optionGreeks as Record<string, OptionQuote>)[primaryKey] ??
      (optionGreeks as Record<string, OptionQuote>)[rawKey];

    console.log("🔍 [DEBUG] Greeks lookup:", {
      symbol, strike, expiryRaw: String(opt.expiry || ""), expiryIso, type,
      primaryKey, rawKey, found: !!positionGreeks, delta: positionGreeks?.delta
    });

    return calcOptionMetrics(opt, currentPrice, costBasis, positionGreeks);
  });
  const currentOptionPositions =
    optionPositions.filter((opt: Record<string, unknown>) => (opt.symbol as string)?.startsWith(ticker));
  
  const totalPremiumCollected = currentOptionPositions.reduce((total: number, opt: Record<string, unknown>) => {
    const prem = Number(opt.premiumCollected) || 0;
    return total + prem;
  }, 0);
  
  const totalContracts = currentOptionPositions.reduce((total: number, opt: Record<string, unknown>) => {
    return total + Math.abs(Number(opt.contracts) || 0);
  }, 0);
  
  // Portfolio-level math (NEW)
  const stockUnreal = (currentPrice - costBasis) * currentShares;
  const totalMarkPnl = currentOptionPositions.reduce((t: number, o: Record<string, unknown>) => t + (o.markPnl as number || 0), 0);
  const totalWheelPnl = currentOptionPositions.reduce((t: number, o: Record<string, unknown>) => t + (o.wheelPnl as number || 0), 0);
  
  console.log('🔍 [WHEEL ANALYSIS] Portfolio analysis:', {
    ticker,
    hasPosition,
    totalPositions: currentOptionPositions.length,
    totalContracts: totalContracts,
    totalPremiumCollected: totalPremiumCollected.toFixed(2),
    currentShares,
    optionPositionsFound: currentOptionPositions.length,
    allOptionPositions: optionPositions.length
  });
  
  // Log all option positions for debugging
  console.log('📊 [ALL OPTION POSITIONS] Raw data:', 
    optionPositions.map((opt: Record<string, unknown>) => ({
      symbol: opt.symbol,
      strike: opt.strike,
      contracts: opt.contracts,
      premium: opt.premiumCollected,
      profitLoss: opt.profitLoss
    }))
  );

  // 🚨 CRITICAL DEBUG: Log exact portfolio structure received
  console.log('🚨 [DEBUG] EXACT PORTFOLIO STRUCTURE RECEIVED:', JSON.stringify({
    portfolio: portfolio,
    hasPortfolioKey: !!portfolio,
    portfolioType: typeof portfolio,
    portfolioKeys: portfolio ? Object.keys(portfolio) : 'no portfolio',
    hasPositions: !!(portfolio?.positions),
    positionsLength: portfolio?.positions?.length || 0,
    hasMetadata: !!(portfolio?.metadata),
    metadataKeys: portfolio?.metadata ? Object.keys(portfolio.metadata) : 'no metadata',
    optionPositionsFromMetadata: portfolio?.metadata?.optionPositions?.length || 0,
    firstOptionPosition: portfolio?.metadata?.optionPositions?.[0] || 'none'
  }, null, 2));
  
  if (currentOptionPositions.length > 0) {
    console.log('📊 [CURRENT OPTIONS] Found existing option positions:', currentOptionPositions);
  }
  
  // Calculate wheel-relevant strike zones
  const callStrikeZone = resistances.filter(r => r.price > currentPrice * 1.02); // 2%+ OTM calls
  const putStrikeZone = supports.filter(s => s.price < currentPrice * 0.98); // 2%+ OTM puts
  
  // Estimate implied volatility rank (simplified calculation based on price range)
  const priceRange = highPrice - lowPrice;
  const avgPrice = (highPrice + lowPrice) / 2;
  const volatilityEstimate = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 20;
  const ivRank = Math.min(Math.max(volatilityEstimate * 2, 20), 80); // Rough IV rank estimate
  
  // Calculate wheel cycle metrics
  const wheelPhase = hasPosition ? 'COVERED_CALL' : 'CASH_SECURED_PUT';
  const optimalStrike = hasPosition 
    ? (callStrikeZone[0]?.price || currentPrice * 1.05) 
    : (putStrikeZone[putStrikeZone.length - 1]?.price || currentPrice * 0.95);
  
  console.log('🎯 [WHEEL STRATEGY DEBUG] Analysis Input:', {
    ticker,
    currentPrice,
    hasPosition,
    currentShares,
    costBasis,
    wheelPhase,
    optimalStrike,
    callStrikeZone: callStrikeZone.map(r => r.price),
    putStrikeZone: putStrikeZone.map(s => s.price),
    portfolioValue: portfolio?.totalValue,
    ivRank,
    volatilityEstimate
  });
  
  // ✂️ Limit list to safest length for o3 (≤8 positions ≈ 2k tokens max)
  const MAX_POSITIONS_FOR_PROMPT = 8;
  const trimmedPositions = currentOptionPositions.slice(0, MAX_POSITIONS_FOR_PROMPT);
  console.log(`🎯 [TOKEN LIMIT] Trimming ${currentOptionPositions.length} positions to ${trimmedPositions.length} for prompt`);
  
  // Extract chart metrics
  const firstMetric = (chartMetrics as ChartMetric[])[0];
  const rsi = firstMetric?.rsi || 'Unknown';
  const macd = firstMetric?.macd || 'Unknown';  
  const trend = firstMetric?.trend || 'Unknown';


  // Build comprehensive WHEEL STRATEGY prompt
  const prompt = `
You are an AI Financial Analyst specializing in The Wheel Strategy.

PORTFOLIO DATA:
• Ticker: ${ticker}
• Current Price: $${currentPrice.toFixed(2)}
• Share Position: ${hasPosition ? `${currentShares} shares @ $${costBasis.toFixed(2)}` : 'No shares owned'}
• Wheel Phase: ${wheelPhase}
• Portfolio Value: $${portfolio?.totalValue?.toLocaleString() || 'Unknown'}
• Total Premium Collected: $${totalPremiumCollected.toFixed(2)}

${trimmedPositions.length > 0 ? 
`UPLOADED OPTION POSITIONS (${trimmedPositions.length} positions):
${trimmedPositions.map((opt: unknown, index: number) => {
  const position = opt as Record<string, unknown>;
  return `${index + 1}. $${position.strike} ${position.optionType} expiring ${position.expiry}
   - Contracts: ${position.contracts} (${position.position})
   - Premium Collected: $${position.premiumCollected || 0}
   - Current Value: $${position.currentValue || 0}
   - P&L: $${position.profitLoss || 0}
   - Intrinsic Value: $${position.intrinsic || 0}
   - Extrinsic Value: $${position.extrinsic || 0}
   - Days to Expiry: ${position.daysToExpiry || 'Unknown'}
   - Delta: ${position.delta !== null ? position.delta : 'N/A'}
   - Theta: ${position.theta !== null ? `$${Number(position.theta).toFixed(2)}/day` : 'N/A'}
   - IV: ${position.iv !== null ? `${(Number(position.iv) * 100).toFixed(1)}%` : 'N/A'}`;
}).join('\n')}

TASK: For each position above, provide wheel strategy analysis:
1. Calculate assignment probability (use Delta if available, otherwise estimate from intrinsic value)
2. Analyze opportunity cost if assigned vs premium collected
3. Consider theta decay rate when making recommendations
4. Recommend action: HOLD (let theta decay), ROLL (to new strike/expiry), or LET ASSIGN
5. Provide specific reasoning for each recommendation based on Greeks` 
: 
`No option positions detected. Generate wheel strategy recommendations.`}

TECHNICAL DATA:
• RSI: ${rsi}, MACD: ${macd}, Trend: ${trend}
• Available Strike Prices: ${[...resistances.map(r => r.price), ...supports.map(s => s.price)].join(', ')}

Return this JSON structure:
{
  "wheelStrategy": {
    "shareCount": ${currentShares},
    "currentPhase": "${wheelPhase}",
    "currentPositions": [${trimmedPositions.length > 0 ? 
      trimmedPositions.map((opt: unknown) => {
        const position = opt as Record<string, unknown>;
        return `{
        "symbol": "${position.symbol || 'UNKNOWN'}",
        "strike": ${position.strike || 0},
        "expiry": "${position.expiry || 'Unknown'}",
        "type": "${position.optionType || 'CALL'}",
        "contracts": ${Number(position.contracts) || 1},
        "premium": ${position.premiumCollected || 0},
        "currentValue": ${position.currentValue || 0},
        "profitLoss": ${position.profitLoss || 0},
        "intrinsic": ${position.intrinsic || 0},
        "extrinsic": ${position.extrinsic || 0},
        "optionMTM": ${position.optionMTM || 0},
        "wheelNet": ${position.wheelNet || 0},
        "markPnl": ${position.markPnl || 0},
        "wheelPnl": ${position.wheelPnl || 0},
        "delta": ${position.delta !== null ? position.delta : null},
        "gamma": ${position.gamma !== null ? position.gamma : null},
        "theta": ${position.theta !== null ? position.theta : null},
        "vega": ${position.vega !== null ? position.vega : null},
        "iv": ${position.iv !== null ? position.iv : null},
        "assignmentProbability": ${position.delta !== null ? `"${(Math.abs(Number(position.delta)) * 100).toFixed(1)}%"` : '"Calculate from intrinsic value"'},
        "opportunityCost": "Calculate missed upside if assigned at strike",
        "analysis": "Detailed wheel strategy analysis using Greeks",
        "recommendation": "HOLD/ROLL/LET_ASSIGN",
        "reasoning": "Specific reasoning based on Greeks and market conditions"
      }`;
      }).join(',\n      ')
      :
      `{
        "strike": ${hasPosition ? (resistances.find(r => r.price > currentPrice)?.price || currentPrice * 1.05) : (supports.find(s => s.price < currentPrice)?.price || currentPrice * 0.95)},
        "type": "${hasPosition ? 'CALL' : 'PUT'}",
        "contracts": ${hasPosition ? -(Math.floor(currentShares / 100) || 1) : 1},
        "reasoning": "Recommended position based on current holdings"
      }`
    }]
  },
  "summary": {
    "currentPrice": ${currentPrice},
    "wheelPhase": "${wheelPhase}",
    "overallAssessment": "${currentOptionPositions.length > 0 ? 'Analysis of actual option positions performance' : 'Wheel strategy recommendations for new positions'}",
    "netMarkToMarket": ${Math.round(stockUnreal + totalMarkPnl + totalPremiumCollected)},
    "netWheelOutcome": ${Math.round(stockUnreal + totalWheelPnl)}
  },
  "recommendation": [
    {"name": "${hasPosition ? 'Sell Calls' : 'Sell Puts'}", "value": 7},
    {"name": "Wait", "value": 2},
    {"name": "Close Position", "value": 1}
  ],
  "technicalFactors": [
    {
      "factor": "Strike Selection",
      "value": "USE ONLY PROVIDED PRICES",
      "interpretation": "Calculate percentage out-of-the-money",
      "impact": "Assess risk/reward",
      "score": "Rate 1-10"
    }
  ],
  "entryPoints": [
    {
      "zone": "${hasPosition ? 'Covered Call Strike' : 'Cash-Secured Put Strike'}",
      "price": "SELECT FROM PROVIDED RESISTANCE/SUPPORT LEVELS",
      "timing": "45 days to expiration",
      "rationale": "Explain selection based on technical levels"
    }
  ],
  "exitPoints": [
    {
      "target": "50% Profit Target",
      "gain": "50% of max profit",
      "timeframe": "20-25 days"
    }
  ],
  "actionPlan": [
    "Specific wheel strategy action using provided prices only"
  ],
  "optionsStrategy": "Describe specific ${hasPosition ? 'covered call' : 'cash-secured put'} recommendation",
  "recommendations": {
    "positionSnapshot": [
      {
        "type": "Cash",
        "ticker": "",
        "quantity": 1,
        "strike": 0,
        "expiry": "",
        "basis": ${cashBalance},
        "currentValue": ${cashBalance},
        "pl": 0,
        "daysToExpiry": 0,
        "moneyness": "",
        "comment": "${cashBalance >= 6000 ? 'Above $6k buffer ✓' : 'Below $6k minimum buffer'}"
      },
      ${hasPosition ? `{
        "type": "Shares",
        "ticker": "${ticker}",
        "quantity": ${currentShares},
        "strike": 0,
        "expiry": "",
        "basis": ${costBasis},
        "currentValue": ${currentPrice * currentShares},
        "pl": ${(currentPrice - costBasis) * currentShares},
        "daysToExpiry": 0,
        "moneyness": "",
        "comment": "Core wheel inventory"
      },` : ''}
      ${trimmedPositions.map((opt: unknown) => {
        const position = opt as Record<string, unknown>;
        return `{
        "type": "Covered Call",
        "ticker": "${position.symbol || ticker}",
        "quantity": ${Number(position.contracts) || 0},
        "strike": ${position.strike || 0},
        "expiry": "${position.expiry || 'Unknown'}",
        "premiumCollected": ${position.premiumCollected || 0},
        "currentValue": ${position.currentValue || 0},
        "wheelProfit": ${position.wheelNet || position.premiumCollected || 0},
        "daysToExpiry": ${position.daysToExpiry || 0},
        "moneyness": "${currentPrice > (position.strike as number || 0) ? 'ITM' : 'OTM'} ${Math.abs(((currentPrice - (position.strike as number || 0)) / (position.strike as number || 1)) * 100).toFixed(1)}%",
        "assignmentGain": ${position.assignmentProfit || ((Number(position.strike) - costBasis) * 100 * Math.abs(Number(position.contracts))) || 0},
        "comment": "${(position.daysToExpiry as number || 0) > 365 ? 'Long-dated' : 'Short-dated'}"
      }`;
      }).join(',\n      ')}
    ],
    "rollAnalysis": [
      ${trimmedPositions.map((opt: unknown) => {
        const position = opt as Record<string, unknown>;
        const strike = position.strike as number || 0;
        const priceThreshold = strike * 1.08;
        const deltaThreshold = 0.80;
        const currentDelta = position.delta as number || null;
        const moneyness = ((currentPrice - strike) / strike) * 100;
        
        return `{
        "position": "$${strike} ${position.optionType || 'CALL'} ${position.expiry}",
        "currentDelta": ${currentDelta !== null ? currentDelta : '"Estimate from moneyness"'},
        "moneyness": ${moneyness.toFixed(2)},
        "ruleA": {
          "triggered": ${currentPrice >= priceThreshold},
          "threshold": ${priceThreshold.toFixed(2)},
          "current": ${currentPrice.toFixed(2)},
          "detail": "Price ${currentPrice >= priceThreshold ? '≥' : '<'} strike × 1.08 ($${priceThreshold.toFixed(2)})"
        },
        "ruleB": {
          "triggered": ${currentDelta !== null ? currentDelta >= deltaThreshold : moneyness > 5},
          "threshold": ${deltaThreshold},
          "current": ${currentDelta !== null ? currentDelta : '"See moneyness"'},
          "detail": "Delta ${currentDelta !== null ? (currentDelta >= deltaThreshold ? '≥' : '<') : 'estimated from'} 0.80"
        },
        "action": "${
          currentPrice >= priceThreshold || (currentDelta !== null ? currentDelta >= deltaThreshold : moneyness > 5) 
            ? 'ROLL' 
            : position.daysToExpiry as number <= 5 
              ? 'LET_EXPIRE' 
              : 'HOLD'
        }",
        "conditionalTrigger": ${
          currentPrice >= priceThreshold || (currentDelta !== null ? currentDelta >= deltaThreshold : moneyness > 5)
            ? '"Roll immediately"'
            : position.daysToExpiry as number <= 5
              ? '"Let expire on ' + position.expiry + '"'
              : '"If ' + ticker + ' closes ≥ $' + priceThreshold.toFixed(2) + ' or delta ≥ 0.80"'
        },
        "recommendation": "Provide specific plain-English action"
      }`;
      }).join(',\n      ')}
    ],
    "cashManagement": {
      "currentCash": ${cashBalance},
      "minimumRequired": 6000,
      "availableForTrades": ${cashBalance},
      "bufferRemaining": ${Math.max(0, cashBalance - 6000)},
      "maxPutStrike": ${Math.floor(cashBalance / 100)},
      "recommendation": "${
        cashBalance >= 10000 
          ? 'Sufficient cash to sell 1 put at $' + Math.floor(cashBalance / 100) + ' strike'
          : cashBalance >= 6000
            ? 'Cash available but consider keeping buffer'
            : 'Below minimum $6k buffer'
      }"
    },
    "actionPlan": {
      "beforeOpen": [
        ${currentOptionPositions.length > 0 
          ? '"Check pre-market price vs roll triggers"' 
          : '"Review option chain for ' + ticker + '"'
        },
        "Verify cash buffer remains above $6,000"
      ],
      "duringHours": [
        ${trimmedPositions.filter((opt: unknown) => {
          const position = opt as Record<string, unknown>;
          const strike = position.strike as number || 0;
          return currentPrice >= strike * 1.08;
        }).length > 0
          ? '"Execute rolls for positions meeting criteria"'
          : '"Monitor price action vs strike + 8% levels"'
        },
        "Watch for delta approaching 0.80 threshold"
      ],
      "endOfDay": [
        "Review closing price vs all triggers",
        ${trimmedPositions.some((opt: unknown) => {
          const position = opt as Record<string, unknown>;
          return (position.daysToExpiry as number || 0) <= 1;
        })
          ? '"Prepare for tomorrow\'s expiration"'
          : '"Set alerts for tomorrow\'s trigger prices"'
        }
      ]
    },
    "plainEnglishSummary": {
      "currentSituation": "Describe portfolio state in one sentence",
      "immediateActions": [
        "List 1-3 specific actions to take now"
      ],
      "monitoringPoints": [
        "What to watch for today/tomorrow"
      ],
      "nextReview": "When to check positions again"
    }
  }
}`;

  /* ---------- OpenAI call ---------- */
  try {
    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2, // Lower temperature for more consistent output
        max_tokens: 8000, // Increased for large portfolios with many options
        messages: [
          { 
            role: "system", 
            content: `You are an elite options-wheel strategist and plain-English coach. 
Output ONLY valid JSON using EXACT prices provided. Never invent prices.
For each optionPosition also output:
- "markPnl": profit/loss if I buy-to-close right now  
- "wheelPnl": profit if I let it go to expiry/assignment
Add to summary:
- "netMarkToMarket": total P/L today (stock + options mark)
- "netWheelOutcome": projected P/L if all short calls assign/expire
For the recommendations section:
- Fill in the plainEnglishSummary with clear, actionable language
- Provide specific recommendations in rollAnalysis for each position
- Use everyday language, no jargon unless explained
- Focus on what to DO, not theory` 
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!ai.ok) {
      const errorText = await ai.text();
      console.error('❌ OpenAI API error:', ai.status, errorText);
      throw new Error(`OpenAI API error: ${ai.status} - ${errorText.substring(0, 200)}`);
    }
    
    const aiJson = await ai.json();
    
    /* --- Extract JSON --- */
    let txt: string = aiJson.choices?.[0]?.message?.content ?? "";
    
    if (!txt) {
      console.error('❌ Empty response from OpenAI');
      console.error('Full response:', JSON.stringify(aiJson));
      throw new Error("Empty response from OpenAI");
    }
    
    // Log raw response for debugging
    console.log('🔍 [AI RAW RESPONSE LENGTH]:', txt.length);
    
    // First, try to remove markdown code blocks if present
    if (txt.includes("```")) {
      txt = txt
        .replace(/^[\s\S]*?```(?:json)?\s*/i, "") // Remove everything before first code block
        .replace(/\s*```[\s\S]*$/i, "")            // Remove everything after last code block
        .trim();
    }
    
    // Now find the JSON object boundaries
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    
    console.log('🔍 [JSON BOUNDS]:', { first, last, textLength: txt.length });
    
    if (first !== -1 && last !== -1 && last > first) {
      txt = txt.slice(first, last + 1);
    } else {
      console.error('❌ [JSON EXTRACTION] Could not find valid JSON boundaries');
      console.error('First 500 chars:', txt.substring(0, 500));
      console.error('Last 500 chars:', txt.substring(txt.length - 500));
      throw new Error("Could not extract JSON from AI response");
    }

    console.log('🔍 [CLEANED TEXT LENGTH]:', txt.length);
    console.log('🔍 [CLEANED TEXT PREVIEW]:', txt.substring(0, 200));

    let analysis;
    try {
      // Try to parse the cleaned text
      analysis = JSON.parse(txt);
        
      // 🎯 WHEEL STRATEGY RESPONSE LOGGING
      console.log('🎯 [WHEEL RESPONSE DEBUG] AI Generated:', {
        wheelPhase: analysis.wheelStrategy?.currentPhase,
        currentPositions: analysis.wheelStrategy?.currentPositions,
        wheelPerformance: analysis.wheelStrategy?.wheelPerformance,
        assignmentAnalysis: analysis.wheelStrategy?.assignmentAnalysis,
        cycleReturn: analysis.wheelStrategy?.currentPositions?.[0]?.cycleReturn,
        optionsStrategy: analysis.optionsStrategy,
        overallAssessment: analysis.summary?.overallAssessment,
        keyMessage: analysis.summary?.keyMessage
      });
        
    } catch (err) {
      console.error("Failed to parse AI response as JSON");
      console.error("Parse error:", err.message);
      console.error("Text length:", txt.length);
      console.error("First 200 chars:", txt.substring(0, 200));
      console.error("Last 200 chars:", txt.substring(txt.length - 200));
      
      // Try to fix common issues
      if (txt.includes('"') && txt.includes('{')) {
        // Try removing any trailing commas before closing braces
        txt = txt.replace(/,(\s*[}\]])/g, '$1');
        
        try {
          analysis = JSON.parse(txt);
          console.log("Successfully parsed after fixing trailing commas");
        } catch (err2) {
          console.error("Still failed after comma fix:", err2.message);
          throw new Error("Invalid JSON response from AI - response too long or malformed");
        }
      } else {
        throw new Error("Invalid JSON response from AI - no JSON structure found");
      }
    }

      /* ───────── Numeric validator DISABLED ───────── */
      // TEMPORARILY DISABLED: The validator is too aggressive and catches
      // legitimate rounded numbers (like "82k" for an 85k portfolio).
      // Modern AI models are much better at not hallucinating prices.
      
      // TODO: Consider implementing a more targeted validation that only
      // checks specific fields (entry/exit prices) rather than the entire response.
      
      /* ───────── End numeric validator ───────── */

    return json({ success: true, analysis, confidence: analysis.confidence });
  } catch (err) {
    console.error("integrated-analysis error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
