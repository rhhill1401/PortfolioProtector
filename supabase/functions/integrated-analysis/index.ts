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

  let body:
    | {
        ticker?: string;
        portfolio?: PortfolioData;
        charts?: unknown[];
        chartMetrics?: ChartMetric[];
        priceContext?: PriceContext;
        research?: unknown[];
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
          priceContext } = body ?? {};

  if (!ticker) return json({ success: false, error: "ticker required" }, 400);
  if (!OPENAI_API_KEY)
    return json({ success: false, error: "Missing OpenAI key" }, 500);

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
  const costBasis = portfolio?.positions?.find(p => p.symbol === ticker)?.purchasePrice || currentPrice;
  
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
  
  function calcOptionMetrics(opt: Record<string, unknown>, spotPrice: number, costBasis: number): CalculatedOption {
    const prem = Number(opt.premiumCollected) || 0;
    const cur  = Number(opt.currentValue)     || 0;
    const cnt  = Math.abs(Number(opt.contracts) || 1);
    const strike = Number(opt.strike) || 0;
    const isCall = opt.optionType === 'CALL';
    
    const pl = opt.position === 'SHORT' ? prem - cur : cur - prem;
    
    // Percent return on capital at risk
    const capital = opt.position === 'SHORT' ? Math.abs(prem) : Math.abs(prem);
    const ret = capital > 0 ? (pl / capital) * 100 : 0;
    
    const intrinsic = isCall 
      ? Math.max(0, spotPrice - strike) * 100 * cnt
      : Math.max(0, strike - spotPrice) * 100 * cnt;
    const extrinsic = Math.max(0, cur - intrinsic);
    
    const optionMTM = opt.position === 'SHORT' ? prem - cur : cur - prem;
    const shareGain = isCall 
      ? (strike - costBasis) * 100 * cnt
      : (costBasis - strike) * 100 * cnt;
    const wheelNet = shareGain + prem;
    
    return { 
      ...opt, 
      profitLoss: Math.round(pl),
      cycleReturn: Number(ret.toFixed(2)),
      intrinsic: Math.round(intrinsic),
      extrinsic: Math.round(extrinsic),
      optionMTM: Math.round(optionMTM),
      wheelNet: Math.round(wheelNet)
    };
  }
  
  const optionPositions = (portfolio?.metadata?.optionPositions || []).map((opt: Record<string, unknown>) => 
    calcOptionMetrics(opt, currentPrice, costBasis)
  );
  const currentOptionPositions =
    optionPositions.filter((opt: Record<string, unknown>) => (opt.symbol as string)?.startsWith(ticker));
  
  const totalPremiumCollected = currentOptionPositions.reduce((total: number, opt: Record<string, unknown>) => {
    const prem = Number(opt.premiumCollected) || 0;
    return total + prem;
  }, 0);
  
  const totalContracts = currentOptionPositions.reduce((total: number, opt: Record<string, unknown>) => {
    return total + Math.abs(Number(opt.contracts) || 0);
  }, 0);
  
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

${currentOptionPositions.length > 0 ? 
`UPLOADED OPTION POSITIONS (${currentOptionPositions.length} positions):
${currentOptionPositions.map((opt: unknown, index: number) => {
  const position = opt as Record<string, unknown>;
  return `${index + 1}. $${position.strike} ${position.optionType} expiring ${position.expiry}
   - Contracts: ${position.contracts} (${position.position})
   - Premium Collected: $${position.premiumCollected || 0}
   - Current Value: $${position.currentValue || 0}
   - P&L: $${position.profitLoss || 0}
   - Intrinsic Value: $${position.intrinsic || 0}
   - Extrinsic Value: $${position.extrinsic || 0}
   - Days to Expiry: ${position.daysToExpiry || 'Unknown'}`;
}).join('\n')}

TASK: For each position above, provide wheel strategy analysis:
1. Calculate assignment probability based on how far ITM/OTM (use intrinsic value)
2. Analyze opportunity cost if assigned vs premium collected
3. Recommend action: HOLD (let theta decay), ROLL (to new strike/expiry), or LET ASSIGN
4. Provide specific reasoning for each recommendation` 
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
    "currentPositions": [${currentOptionPositions.length > 0 ? 
      currentOptionPositions.map((opt: unknown) => {
        const position = opt as Record<string, unknown>;
        return `{
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
        "assignmentProbability": "Calculate based on intrinsic value and DTE",
        "opportunityCost": "Calculate missed upside if assigned at strike",
        "analysis": "Detailed wheel strategy analysis",
        "recommendation": "HOLD/ROLL/LET_ASSIGN",
        "reasoning": "Specific reasoning based on theta decay, assignment risk, and opportunity cost"
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
    "overallAssessment": "${currentOptionPositions.length > 0 ? 'Analysis of actual option positions performance' : 'Wheel strategy recommendations for new positions'}"
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
  "optionsStrategy": "Describe specific ${hasPosition ? 'covered call' : 'cash-secured put'} recommendation"
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
        max_tokens: 2000, // Increased for complete response
        messages: [
          { 
            role: "system", 
            content: "You are a precision swing-trade analyst. Output ONLY valid JSON using EXACT prices provided. Never invent prices." 
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const aiJson = await ai.json();
    if (!ai.ok) throw new Error(aiJson.error?.message || "OpenAI error");

    /* --- Extract JSON --- */
    let txt: string = aiJson.choices?.[0]?.message?.content ?? "";
    
    // Clean up response
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      txt = txt.slice(first, last + 1);
    }
    
    // Remove any markdown or code blocks
    txt = txt
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```+\s*$/i, "")
      .trim();

      let analysis;
      try {
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
        console.error("Failed to parse AI response:", txt);
        console.error("Parse error details:", err);
        throw new Error("Invalid JSON response from AI");
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