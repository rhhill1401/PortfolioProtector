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

import {
  analyzeWheelStrategy,
  type CalculatedOption,
  type ChartMetric,
  type OptionQuote,
  type PortfolioData,
  type PriceContext,
  type WheelStrategyResult,
} from "./strategies.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5";

const OPENAI_TIMEOUT_MS = 50_000; // 50s safety window (Supabase limit is 60s)

async function runWithTimeout<T>(timeoutMs: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export { runWithTimeout };

async function callOpenAI(OPENAI_API_KEY: string, OPENAI_MODEL: string, prompt: string): Promise<Record<string, unknown>> {
  const model = OPENAI_MODEL;
  const systemPrompt =
    "You are an elite options-wheel strategist, market analyst, and plain-English coach.\n" +
    "Output ONLY valid JSON using EXACT prices provided. Never invent prices.\n" +
    'For each optionPosition also output:\n- "markPnl": profit/loss if I buy-to-close right now\n- "wheelPnl": profit if I let it go to expiry/assignment\n' +
    'Add to summary:\n- "netMarkToMarket": total P/L today (stock + options mark)\n- "netWheelOutcome": projected P/L if all short calls assign/expire\n' +
    "For the recommendations section:\n- Fill in the plainEnglishSummary with clear, actionable language\n- Provide specific recommendations in rollAnalysis for each position\n- Use everyday language, no jargon unless explained\n- Focus on what to DO, not theory\n" +
    "For market sentiment analysis:\n- Analyze ETF flows when dealing with crypto assets (IBIT, ETH ETFs)\n- Check NAV premium/discount for ETF products\n- Evaluate implied volatility levels and options skew\n- Track large options flow and open interest patterns\n- Identify upcoming catalysts that affect trading decisions";

  const started = Date.now();
  const promptChars = prompt.length;
  const promptLines = prompt.split("\n").length;

  console.log('🚀 [AI CALL] Starting OpenAI request', {
    model,
    promptChars,
    promptLines,
    timeoutMs: OPENAI_TIMEOUT_MS
  });

  let res: Response;
  try {
    res = await runWithTimeout(OPENAI_TIMEOUT_MS, (signal) =>
      fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          max_output_tokens: 8000
        }),
        signal
      })
    );
  } catch (err) {
    const duration = Date.now() - started;
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error('⏱️ [AI CALL] Timed out', { durationMs: duration, promptChars, promptLines });
      const timeoutError = new Error("AI_TIMEOUT");
      (timeoutError as Error & { cause?: unknown }).cause = err;
      throw timeoutError;
    }
    console.error('💥 [AI CALL] Fetch failed before completion', { durationMs: duration, error: err?.message ?? String(err) });
    throw err;
  }

  const duration = Date.now() - started;
  console.log('✅ [AI CALL] Completed', { durationMs: duration, status: res.status, promptChars });

  const raw = await res.json();
  if (!res.ok) throw new Error(raw?.error?.message ?? `OpenAI error ${res.status}`);

  if (typeof raw.output_text === "string" && raw.output_text.trim().length > 0) {
    return raw as Record<string, unknown>;
  }

  if (Array.isArray(raw.output)) {
    const joined = (raw.output as Array<Record<string, unknown>>)
      .flatMap((item: any) =>
        Array.isArray(item?.content)
          ? item.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).filter(Boolean)
          : []
      )
      .join("")
      .trim();
    (raw as any).output_text = joined;
    return raw as Record<string, unknown>;
  }

  (raw as any).output_text = "";
  return raw as Record<string, unknown>;
}

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
          optionGreeks: optionGreeksRaw = {},
          marketData = {} } = body ?? {};

  const optionGreeks: Record<string, OptionQuote> = optionGreeksRaw as Record<string, OptionQuote>;

  if (!ticker) return json({ success: false, error: "ticker required" }, 400);
  
  // Guard against comma-separated tickers (BOTH mode is handled client-side)
  if (ticker.includes(',')) {
    return json({ 
      success: false, 
      error: "Send ONE ticker per request (BOTH mode is handled client-side)" 
    }, 400);
  }
  
  if (!OPENAI_API_KEY)
    return json({ success: false, error: "Missing OpenAI key" }, 500);
  
  // Define crypto ETF tickers for enhanced analysis
  const cryptoETFs = ['IBIT', 'ETH', 'ETHA', 'GBTC', 'BITO', 'BITQ', 'ARKB', 'FBTC', 'HODL', 'BTCO', 'EZBC', 'BTCR'];
  const isCryptoETF = cryptoETFs.includes(ticker.toUpperCase());
  
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

  const wheelAnalysis: WheelStrategyResult = analyzeWheelStrategy({
    ticker,
    portfolio,
    chartMetrics: chartMetrics as ChartMetric[],
    priceContext,
    optionGreeks,
  });

  const {
    currentPrice,
    hasPosition,
    currentShares,
    costBasis,
    cashBalance,
    stockValue,
    totalValue,
    optionPositions,
    currentOptionPositions,
    supports,
    resistances,
    totalPremiumCollected,
    stockUnreal,
    totalMarkPnl,
    totalWheelPnl,
    wheelPhase,
    optimalStrike,
    callStrikeZone,
    putStrikeZone,
    volatilityEstimate,
    ivRank,
    rsi,
    macd,
    trend,
  } = wheelAnalysis;

  console.log('💰 [CASH BALANCE]:', {
    cashFromPortfolio: portfolio?.cashBalance,
    cashBalance,
    stockValue,
    totalValue,
  });

  console.log('📊 [ALL OPTION POSITIONS] Raw data:', optionPositions.map((opt) => ({
    symbol: opt.symbol,
    strike: opt.strike,
    contracts: opt.contracts,
    premium: opt.premiumCollected,
    profitLoss: opt.profitLoss,
  })));

  console.log('🎯 [WHEEL STRATEGY DEBUG] Analysis Input:', {
    ticker,
    currentPrice,
    hasPosition,
    currentShares,
    costBasis,
    wheelPhase,
    optimalStrike,
    callStrikeZone,
    putStrikeZone,
    portfolioValue: totalValue,
    ivRank,
    volatilityEstimate,
  });

  // ✂️ Limit list to safest length for o3 (≤8 positions ≈ 2k tokens max)
  const MAX_POSITIONS_FOR_PROMPT = 8;
  const trimmedPositions: CalculatedOption[] = currentOptionPositions.slice(0, MAX_POSITIONS_FOR_PROMPT);
  console.log(`🎯 [TOKEN LIMIT] Trimming ${currentOptionPositions.length} positions to ${trimmedPositions.length} for prompt`);
  
  const buildFallbackAnalysis = (warning: string) => {
    const fallbackPositions = trimmedPositions.map((position) => ({
      symbol: position.symbol || ticker,
      strike: position.strike || 0,
      expiry: position.expiry || 'Unknown',
      type: position.optionType || 'CALL',
      contracts: position.contracts || 0,
      premium: position.premiumCollected || 0,
      currentValue: position.currentValue || 0,
      profitLoss: position.profitLoss || 0,
      markPnl: position.markPnl || 0,
      wheelPnl: position.wheelPnl || 0,
      delta: position.delta,
      gamma: position.gamma,
      theta: position.theta,
      vega: position.vega,
      iv: position.iv,
    }));

    const defaultRecommendation = [
      { name: hasPosition ? 'Sell Calls' as const : 'Sell Puts' as const, value: 5 },
      { name: 'Hold' as const, value: 3 },
      { name: 'Close Position' as const, value: 2 },
    ];

    const marketSentiment = {
      etfFlows: {
        netFlows: String(isCryptoETF ? (etfFlows.netFlows ?? etfFlows.netFlow ?? 'No data') : 'N/A for non-ETF'),
        trend: String(isCryptoETF ? (etfFlows.trend ?? 'No data') : 'N/A'),
        impact: String(isCryptoETF ? (etfFlows.impact ?? 'No data') : 'N/A'),
        recommendation: String(isCryptoETF ? (etfFlows.recommendation ?? 'Monitor flows for impact') : 'Focus on technical levels'),
        source: etfFlows.source ? { url: etfFlows.source.url ?? '', asOf: etfFlows.source.asOf ?? currentDate } : undefined,
      },
      navAnalysis: {
        premium: String(isCryptoETF ? (navData.premium ?? 'No NAV data') : 'N/A'),
        discount: String(isCryptoETF ? (navData.discount ?? 'No NAV data') : 'N/A'),
        interpretation: String(isCryptoETF ? (navData.interpretation ?? 'NAV data unavailable') : 'N/A'),
        tradingOpportunity: String(isCryptoETF ? (navData.tradingOpportunity ?? 'Monitor for NAV updates') : 'N/A'),
        source: navData.source ? { url: navData.source.url ?? '', asOf: navData.source.asOf ?? currentDate } : undefined,
      },
      volatilityMetrics: {
        currentIV: String(currentIV),
        ivRank: String(volatilityData.ivRank ?? ivRank.toFixed(1)),
        callPutSkew: String(volatilityData.callPutSkew ?? volatilityData.skew ?? 'Unavailable'),
        premiumEnvironment: Number(parseFloat(String(currentIV))) > 50 ? 'Rich - good for selling' : 'Moderate - balanced approach',
        wheelStrategy: Number(parseFloat(String(currentIV))) > 50 ? 'Favor premium collection into strength' : 'Standard wheel execution conditions',
      },
      optionsFlow: {
        largeOrders: String(optionsFlowData.largeOrders ?? 'No unusual activity detected'),
        openInterest: String(optionsFlowData.openInterest ?? 'Standard distribution'),
        putCallRatio: String(optionsFlowData.putCallRatio ?? optionsFlowData.pcRatio ?? 'Balanced'),
        sentiment: String(optionsFlowData.sentiment ?? 'Neutral'),
      },
      upcomingCatalysts: upcomingEvents && Array.isArray(upcomingEvents) && upcomingEvents.length > 0
        ? upcomingEvents.map((event: any) => ({
            event: String(event.event ?? 'Upcoming Event'),
            date: String(event.date ?? 'TBD'),
            impact: String(event.impact ?? 'Medium'),
            preparation: String(event.preparation ?? 'Review positioning'),
            source: event.source ? { url: String(event.source.url ?? ''), asOf: String(event.source.asOf ?? currentDate) } : undefined,
          }))
        : [
            {
              event: 'Fed Meeting (FOMC)',
              date: nextFedMeeting,
              impact: 'High - affects all risk assets',
              preparation: 'Consider reducing position size before announcement',
              source: { url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', asOf: currentDate },
            },
            {
              event: 'Triple Witching',
              date: tripleWitching,
              impact: 'High - increased volatility',
              preparation: 'Potential premium collection opportunity',
              source: { url: 'calculated', asOf: currentDate },
            },
          ],
      overallSentiment: {
        summary: `Deterministic fallback: ${warning}`,
        confidence: 'Low',
        recommendation: 'Use wheel metrics above and rerun analysis later for AI summary.',
      },
    };

    const positionSnapshot = [
      {
        type: 'Cash',
        ticker: '',
        quantity: 1,
        strike: 0,
        expiry: '',
        basis: cashBalance,
        currentValue: cashBalance,
        pl: 0,
        daysToExpiry: 0,
        moneyness: '',
        comment: cashBalance >= 6000 ? 'Above $6k buffer ✓' : 'Below $6k minimum buffer',
      },
      ...(hasPosition
        ? [{
            type: 'Shares',
            ticker,
            quantity: currentShares,
            strike: 0,
            expiry: '',
            basis: costBasis,
            currentValue: currentPrice * currentShares,
            pl: (currentPrice - costBasis) * currentShares,
            daysToExpiry: 0,
            moneyness: '',
            comment: 'Core wheel inventory',
          }]
        : []),
      ...fallbackPositions.map((pos) => ({
        type: wheelPhase === 'COVERED_CALL' ? 'Covered Call' : 'Cash-Secured Put',
        ticker: pos.symbol || ticker,
        quantity: pos.contracts,
        strike: pos.strike,
        expiry: pos.expiry,
        premiumCollected: pos.premium ?? pos.premiumCollected ?? 0,
        currentValue: pos.currentValue ?? 0,
        wheelProfit: pos.wheelPnl ?? pos.wheelNet ?? 0,
        daysToExpiry: pos.daysToExpiry ?? 0,
        moneyness: pos.strike
          ? `${currentPrice > pos.strike ? 'ITM' : 'OTM'} ${Math.abs(((currentPrice - pos.strike) / pos.strike) * 100).toFixed(1)}%`
          : 'Unknown',
        assignmentGain: pos.wheelPnl ?? 0,
        comment: (pos.daysToExpiry ?? 0) > 365 ? 'Long-dated' : 'Short-dated',
      }))
    ];

    return {
      wheelStrategy: {
        shareCount: currentShares,
        currentPhase: wheelPhase,
        currentPositions: fallbackPositions,
      },
      summary: {
        currentPrice,
        wheelPhase,
        overallAssessment: warning,
        netMarkToMarket: Math.round(stockUnreal + totalMarkPnl + totalPremiumCollected),
        netWheelOutcome: Math.round(stockUnreal + totalWheelPnl),
      },
      recommendation: defaultRecommendation,
      technicalFactors: [],
      entryPoints: [],
      exitPoints: [],
      actionPlan: [],
      optionsStrategy: 'AI summary unavailable; using deterministic fallback.',
      marketSentiment,
      recommendations: {
        positionSnapshot,
        rollAnalysis: [],
        cashManagement: {
          currentCash: cashBalance,
          minimumRequired: 6000,
          availableForTrades: cashBalance,
          bufferRemaining: Math.max(0, cashBalance - 6000),
          recommendation: cashBalance >= 6000
            ? 'Cash buffer above minimum requirements.'
            : 'Consider freeing cash to reach $6k buffer.',
        },
        actionPlan: {
          beforeOpen: [hasPosition ? 'Review covered call strikes vs resistances.' : 'Review put strikes near supports.'],
          duringHours: ['Monitor price vs key levels and delta thresholds.'],
          endOfDay: ['Re-run analysis later for fresh AI guidance.'],
        },
        plainEnglishSummary: {
          currentSituation: warning,
          immediateActions: ['Review positions using fallback metrics.'],
          monitoringPoints: ['Watch price relative to calculated strike zones.'],
          nextReview: 'Next trading session',
        },
      },
    };
  };

  // 📊 PREPARE MARKET DATA FOR ANALYSIS
  // Extract real market data from marketData object (passed from frontend)
  const etfFlows = marketData.etfFlows || {};
  const navData = marketData.navData || {};
  const volatilityData = marketData.volatility || {};
  const optionsFlowData = marketData.optionsFlow || {};
  const upcomingEvents = marketData.upcomingEvents || [];
  
  // Calculate key market metrics
  const currentDate = new Date().toISOString().split('T')[0];
  const nextFedMeeting = marketData.nextFedMeeting || "2025-01-29"; // FOMC Jan 28-29, 2025
  const tripleWitching = marketData.tripleWitching || "2025-12-19"; // Dec 19, 2025
  
  // Get actual IV from Greeks or estimate
  const currentIV = currentOptionPositions.length > 0 && currentOptionPositions[0].iv 
    ? (currentOptionPositions[0].iv * 100).toFixed(1) + '%'
    : volatilityData.currentIV || "Moderate";

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
${trimmedPositions.map((position, index) => {
  const thetaText = position.theta !== null ? `$${Number(position.theta ?? 0).toFixed(2)}/day` : 'N/A';
  const ivText = position.iv !== null ? `${Number((position.iv ?? 0) * 100).toFixed(1)}%` : 'N/A';
  const deltaText = position.delta !== null ? position.delta : 'N/A';
  return `${index + 1}. $${position.strike} ${position.optionType} expiring ${position.expiry}
   - Contracts: ${position.contracts} (${position.position})
   - Premium Collected: $${position.premiumCollected || 0}
   - Current Value: $${position.currentValue || 0}
   - P&L: $${position.profitLoss || 0}
   - Intrinsic Value: $${position.intrinsic || 0}
   - Extrinsic Value: $${position.extrinsic || 0}
   - Days to Expiry: ${position.daysToExpiry ?? 'Unknown'}
   - Delta: ${deltaText}
   - Theta: ${thetaText}
   - IV: ${ivText}`;
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

MARKET CONTEXT DATA:
${isCryptoETF ? `• ETF Net Flows: ${etfFlows.netFlow || 'No data'}
• NAV Premium/Discount: ${navData.premium || navData.discount || 'No data'}` : '• Non-ETF asset'}
• Current IV: ${currentIV}
• IV Rank: ${volatilityData.ivRank || 'Unknown'}
• Options Flow: ${optionsFlowData.sentiment || 'Neutral'}
• Put/Call Ratio: ${optionsFlowData.pcRatio || 'Balanced'}
• Upcoming Events:
  - Fed Meeting: ${nextFedMeeting}
  - Triple Witching: ${tripleWitching}
  ${upcomingEvents.map((e: any) => `- ${e.event}: ${e.date}`).join('\n  ')}

INSTRUCTIONS:
1. Analyze the provided market data to give specific, actionable insights
2. For marketSentiment fields, provide analysis based on the actual data above
3. Do NOT generate placeholder text like "check schedule" or "analyze flows"
4. If data is missing, state "No data available" rather than generic instructions
5. Focus on how the market conditions affect wheel strategy execution

Return this JSON structure:
{
  "wheelStrategy": {
    "shareCount": ${currentShares},
    "currentPhase": "${wheelPhase}",
    "currentPositions": [${trimmedPositions.length > 0 ? 
      trimmedPositions.map((position) => {
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
  "marketSentiment": {
    "etfFlows": {
      "netFlows": "${isCryptoETF ? (etfFlows.netFlow || 'No flow data available') : 'N/A for non-ETF'}",
      "trend": "${isCryptoETF ? (etfFlows.trend || 'Analyze flow direction') : 'N/A'}",
      "impact": "${isCryptoETF ? (etfFlows.impact || 'Assess impact on spot price') : 'N/A'}",
      "recommendation": "${isCryptoETF ? 'Adjust strategy based on flows' : 'Focus on technical levels'}"
    },
    "navAnalysis": {
      "premium": "${isCryptoETF ? (navData.premium || 'No NAV data') : 'N/A for non-ETF'}",
      "discount": "${isCryptoETF ? (navData.discount || 'No NAV data') : 'N/A'}",
      "interpretation": "${isCryptoETF ? 'Analyze NAV divergence' : 'N/A'}",
      "tradingOpportunity": "${isCryptoETF ? 'Look for mean reversion' : 'N/A'}"
    },
    "volatilityMetrics": {
      "currentIV": "${currentIV}",
      "ivRank": "${volatilityData.ivRank || 'Calculate from 52-week range'}",
      "callPutSkew": "${volatilityData.skew || 'Analyze options skew'}",
      "premiumEnvironment": "${Number(currentIV) > 50 ? 'Rich - good for selling' : 'Moderate - balanced approach'}",
      "wheelStrategy": "IV at ${currentIV} suggests ${Number(currentIV) > 50 ? 'aggressive premium collection' : 'standard wheel execution'}"
    },
    "optionsFlow": {
      "largeOrders": "${optionsFlowData.largeOrders || 'No unusual activity detected'}",
      "openInterest": "${optionsFlowData.openInterest || 'Standard OI distribution'}",
      "putCallRatio": "${optionsFlowData.pcRatio || 'Balanced'}",
      "sentiment": "${optionsFlowData.sentiment || 'Neutral'}"
    },
    "upcomingCatalysts": [
      {
        "event": "Fed Meeting (FOMC)",
        "date": "${nextFedMeeting}",
        "impact": "High - affects all risk assets",
        "preparation": "Consider reducing position size before announcement"
      },
      {
        "event": "Triple Witching",
        "date": "${tripleWitching}",
        "impact": "High - increased volatility",
        "preparation": "Premium collection opportunities due to elevated IV"
      },
      ${upcomingEvents.length > 0 ? upcomingEvents.map((e: any) => `{
        "event": "${e.event || 'Unknown'}",
        "date": "${e.date || 'TBD'}",
        "impact": "${e.impact || 'Medium'}",
        "preparation": "${e.preparation || 'Monitor closely'}"
      }`).join(',') : ''}
    ],
    "overallSentiment": {
      "summary": "Based on ${currentIV} IV, ${isCryptoETF ? 'ETF flows, ' : ''}and upcoming ${nextFedMeeting} Fed meeting, market conditions ${Number(currentIV) > 50 ? 'favor aggressive premium selling' : 'suggest standard wheel approach'}",
      "confidence": "${marketData.confidence || 'Medium'}",
      "recommendation": "Continue wheel strategy with ${Number(currentIV) > 50 ? 'wider strikes for safety' : 'standard strike selection'}"
    }
  },
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
      ${trimmedPositions.map((position) => {
        const strike = position.strike || 0;
        const contractsAbs = Math.abs(position.contracts) || 1;
        const moneynessPercent = strike !== 0 ? Math.abs(((currentPrice - strike) / strike) * 100).toFixed(1) : '0.0';
        const assignmentGain = position.assignmentProfit || ((strike - costBasis) * 100 * contractsAbs) || 0;
        const comment = (position.daysToExpiry ?? 0) > 365 ? 'Long-dated' : 'Short-dated';
        return `{
        "type": "Covered Call",
        "ticker": "${position.symbol || ticker}",
        "quantity": ${position.contracts || 0},
        "strike": ${strike},
        "expiry": "${position.expiry || 'Unknown'}",
        "premiumCollected": ${position.premiumCollected || 0},
        "currentValue": ${position.currentValue || 0},
        "wheelProfit": ${position.wheelNet || position.premiumCollected || 0},
        "daysToExpiry": ${position.daysToExpiry ?? 0},
        "moneyness": "${currentPrice > strike ? 'ITM' : 'OTM'} ${moneynessPercent}%",
        "assignmentGain": ${assignmentGain},
        "comment": "${comment}"
      }`;
      }).join(',\n      ')}
    ],
    "rollAnalysis": [
      ${trimmedPositions.map((position) => {
        const strike = position.strike || 0;
        const priceThreshold = strike * 1.08;
        const deltaThreshold = 0.80;
        const currentDelta = typeof position.delta === 'number' ? position.delta : null;
        const moneyness = ((currentPrice - strike) / strike) * 100;
        const daysToExpiry = position.daysToExpiry ?? 0;

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
            : daysToExpiry <= 5 
              ? 'LET_EXPIRE' 
              : 'HOLD'
        }",
        "conditionalTrigger": ${
          currentPrice >= priceThreshold || (currentDelta !== null ? currentDelta >= deltaThreshold : moneyness > 5)
            ? '"Roll immediately"'
            : daysToExpiry <= 5
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
        ${trimmedPositions.filter((position) => {
          const strike = position.strike || 0;
          return currentPrice >= strike * 1.08;
        }).length > 0
          ? '"Execute rolls for positions meeting criteria"'
          : '"Monitor price action vs strike + 8% levels"'
        },
        "Watch for delta approaching 0.80 threshold"
      ],
      "endOfDay": [
        "Review closing price vs all triggers",
        ${trimmedPositions.some((position) => (position.daysToExpiry ?? 0) <= 1)
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
    const aiJson = await callOpenAI(OPENAI_API_KEY, OPENAI_MODEL, prompt);
    
    /* --- Extract JSON --- */
    let txt: string = (aiJson as any).output_text ?? "";
    
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

      // 📊 MARKET SENTIMENT RESPONSE LOGGING
      console.log('📊 [MARKET SENTIMENT DEBUG] AI Generated:', {
        etfFlows: analysis.marketSentiment?.etfFlows,
        navAnalysis: analysis.marketSentiment?.navAnalysis,
        volatilityMetrics: analysis.marketSentiment?.volatilityMetrics,
        optionsFlow: analysis.marketSentiment?.optionsFlow,
        upcomingCatalysts: analysis.marketSentiment?.upcomingCatalysts,
        overallSentiment: analysis.marketSentiment?.overallSentiment
      });

      // 🔧 Merge reliable Greeks from payload into AI output (LLM can drop fields)
      try {
        const positions = analysis?.wheelStrategy?.currentPositions as Array<Record<string, unknown>> | undefined;
        if (positions && optionGreeks) {
          const normalizeExpiry = (s: string): string => {
            if (!s) return s;
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            const m = s.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
            if (!m) return s;
            const months: Record<string, string> = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
            const mon = months[m[1] as keyof typeof months];
            return mon ? `${m[3]}-${mon}-${m[2].padStart(2,'0')}` : s;
          };

          const mergeCount = positions.reduce((acc, pos) => {
            const sym = String(pos.symbol || '').toUpperCase();
            const strike = Number(pos.strike || 0);
            const expiry = normalizeExpiry(String(pos.expiry || ''));
            const optType = String((pos.optionType || pos.type || '')).toUpperCase();
            const key = `${sym}-${strike}-${expiry}-${optType}`;
            const g = optionGreeks[key];
            if (g) {
              // Only patch if missing or null; do not change existing numbers
              if (pos.delta == null) pos.delta = g.delta;
              // Gamma fix: Always use fetched gamma when available (AI often returns 0)
              if (g.gamma != null && g.gamma !== undefined) {
                pos.gamma = g.gamma;
              } else if (pos.gamma == null) {
                pos.gamma = g.gamma;
              }
              if (pos.theta == null) pos.theta = g.theta;
              if (pos.vega  == null) pos.vega  = g.vega;
              if (pos.iv    == null) pos.iv    = g.iv;
              acc += 1;
            }
            return acc;
          }, 0);

          console.log('🔧 [POST-MERGE GREEKS] Patched positions with Greeks:', { merged: mergeCount, total: positions.length });
          
          // Debug logging for gamma merge issue
          positions.forEach((pos, idx) => {
            const sym = String(pos.symbol || '').toUpperCase();
            const strike = Number(pos.strike || 0);
            const expiry = normalizeExpiry(String(pos.expiry || ''));
            const optType = String((pos.optionType || pos.type || '')).toUpperCase();
            const key = `${sym}-${strike}-${expiry}-${optType}`;
            const g = optionGreeks[key];
            
            if (g?.gamma != null) {
              console.log('🔍 [GAMMA MERGE DEBUG]', {
                position: key,
                aiGamma: positions[idx].gamma,
                fetchedGamma: g.gamma,
                finalGamma: pos.gamma,
                wasReplaced: pos.gamma === g.gamma
              });
            }
          });
        }
      } catch (mergeErr) {
        console.warn('⚠️ [POST-MERGE GREEKS] Merge step failed:', mergeErr);
      }
        
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

    // 📤 LOG FINAL RESPONSE BEFORE SENDING
    console.log('📤 [FINAL RESPONSE] Sending to frontend:', {
      hasMarketSentiment: !!analysis.marketSentiment,
      marketSentimentKeys: analysis.marketSentiment ? Object.keys(analysis.marketSentiment) : [],
      ticker: ticker,
      wheelPhase: analysis.wheelStrategy?.currentPhase
    });

    return json({ success: true, analysis, confidence: analysis.confidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const aiRelated = message === 'AI_TIMEOUT' || message.startsWith('OpenAI');
    if (aiRelated) {
      console.error('⚠️ [AI FALLBACK] Returning deterministic analysis due to AI issue:', message);
      const fallback = buildFallbackAnalysis(message === 'AI_TIMEOUT'
        ? 'AI summary timed out. Showing baseline metrics.'
        : `AI summary unavailable (${message}).`);
      return json({ success: true, analysis: fallback, warning: message }, 200);
    }

    console.error("integrated-analysis error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
