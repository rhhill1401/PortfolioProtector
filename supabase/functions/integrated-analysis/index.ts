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
    timeframe: string;
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
          charts = [],
          chartMetrics = [],
          priceContext,
          research = [] } = body ?? {};

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

      // Added: concise level summary for prompt
  const lvlSummary = `Resistances: ${resistances.map(r => `$${r.price.toFixed(2)}`).join(", ")} | Supports: ${supports.map(s => `$${s.price.toFixed(2)}`).join(", ")}`;


  const currentPrice = priceContext?.current || 0;
  
  // Find nearest support and resistance
  const nearestSupport = supports.find(s => s.price < currentPrice) || supports[0];
  const nearestResistance = resistances.find(r => r.price > currentPrice) || resistances[0];
  
  // Extract chart metrics
  const firstMetric = (chartMetrics as ChartMetric[])[0];
  const rsi = firstMetric?.rsi || 'Unknown';
  const macd = firstMetric?.macd || 'Unknown';  
  const trend = firstMetric?.trend || 'Unknown';

  // Format portfolio positions
  const portfolioSummary = portfolio?.positions?.length ? 
    portfolio.positions.map(p => 
      `${p.symbol}: ${p.quantity} shares @ $${p.purchasePrice || 'N/A'}`
    ).join(', ') : 'No current positions';

  // Build comprehensive prompt
  const prompt = `
You are an elite swing‑trade analyst. Provide **exact** entry/exit analysis using ONLY the price levels below.

REAL‑TIME CONTEXT
• Ticker: ${ticker}
• Current price: $${currentPrice.toFixed(2)}
• Chart timeframe: ${priceContext?.timeframe ?? "Unknown"}
• Key levels: ${lvlSummary}

KEY PRICE LEVELS:
Resistances: ${resistances.map(r => `$${r.price.toFixed(2)} (${r.strength})`).join(', ')}
Supports: ${supports.map(s => `$${s.price.toFixed(2)} (${s.strength})`).join(', ')}

TECHNICAL INDICATORS:
- RSI: ${rsi}
- MACD: ${macd}
- Trend: ${trend}

PORTFOLIO:
- Positions: ${portfolioSummary}
- Total Value: $${portfolio?.totalValue?.toLocaleString() || 'Unknown'}

ANALYSIS CONTEXT:
- Charts analyzed: ${charts.length}
- Research documents: ${research.length}
- Current price is ${nearestSupport ? `$${(currentPrice - nearestSupport.price).toFixed(2)} above support at $${nearestSupport.price.toFixed(2)}` : 'below all supports'}
- Next resistance at ${nearestResistance ? `$${nearestResistance.price.toFixed(2)} (+${((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(1)}%)` : 'above all resistances'}

CRITICAL RULES:
1. Every entry must be *at or above the listed Supports* and every exit at *one of the listed Resistances*. Never invent new prices.
2. Exit prices MUST be at resistance levels: ${resistances.map(r => `$${r.price.toFixed(2)}`).join(', ')}
3. Stop loss = support price minus 1-2%
4. All prices must be exact numbers from the lists above
5. Calculate risk/reward using actual price differences

Output this EXACT JSON structure with REAL NUMBERS:
{
  "summary": {
    "currentPrice": ${currentPrice},
    "priceChange": 0,
    "priceChangePercent": "0%",
    "vix": 18.5,
    "overallAssessment": "${rsi < 30 ? 'Oversold Bounce' : rsi > 70 ? 'Overbought' : 'Neutral'}",
    "technicalStance": "${trend} trend, RSI ${rsi}",
    "technicalDetail": "Price at $${currentPrice.toFixed(2)}, ${nearestSupport ? `support at $${nearestSupport.price.toFixed(2)}` : 'no nearby support'}",
    "fundamentalAssessment": "Based on ${research.length} research documents",
    "fundamentalDetail": "Portfolio exposure: ${portfolio?.positions?.length || 0} positions",
    "marketContext": "Swing trade setup",
    "marketContextDetail": "${trend} trend with ${macd} MACD divergence",
    "investmentThesis": ["Technical bounce play", "Risk/reward favorable at support", "Clear stop loss level"],
    "bullCase": ["RSI oversold bounce", "Support holding"],
    "bearCase": ["MACD still ${macd}", "Resistance overhead"],
    "positionManagement": ["Use trailing stop above entry", "Scale out at resistance levels"],
    "entryTriggers": ["Limit order at support", "Confirm with volume"]
  },
  "opportunity": "${nearestSupport ? `Entry at $${nearestSupport.price.toFixed(2)} support with ${((nearestResistance.price - nearestSupport.price) / nearestSupport.price * 100).toFixed(1)}% upside to resistance` : 'Wait for pullback to support'}",
  "risk": "Stop at $${nearestSupport ? (nearestSupport.price * 0.98).toFixed(2) : (currentPrice * 0.95).toFixed(2)} (${nearestSupport ? '2% below support' : '5% stop loss'})",
  "confidence": ${rsi < 30 && nearestSupport ? 8 : rsi > 70 ? 4 : 6},
  "recommendation": [
    {"name": "Buy", "value": ${rsi < 30 && nearestSupport ? 70 : 30}},
    {"name": "Hold", "value": ${rsi >= 30 && rsi <= 70 ? 50 : 20}},
    {"name": "Sell", "value": ${rsi > 70 ? 50 : 10}}
  ],
  "detail": {
    "technicalSignals": "${trend} trend with RSI at ${rsi}",
    "portfolioAlignment": "${portfolio?.positions?.length ? 'Adding to existing positions' : 'New position'}",
    "researchConsensus": "Based on ${research.length} documents analyzed"
  },
  "technicalFactors": [
    {
      "factor": "Primary Support",
      "value": "$${nearestSupport ? nearestSupport.price.toFixed(2) : 'N/A'}",
      "interpretation": "${nearestSupport ? nearestSupport.strength + ' support level' : 'No support identified'}",
      "impact": "${nearestSupport && currentPrice > nearestSupport.price ? 'Bullish' : 'Bearish'}",
      "score": ${nearestSupport ? 7 : 3}
    },
    {
      "factor": "RSI",
      "value": "${rsi}",
      "interpretation": "${rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral'}",
      "impact": "${rsi < 30 ? 'Bullish' : rsi > 70 ? 'Bearish' : 'Neutral'}",
      "score": ${rsi < 30 ? 8 : rsi > 70 ? 3 : 5}
    }
  ],
  "fundamentals": [
    {
      "metric": "Portfolio Weight",
      "value": "${portfolio?.positions?.find(p => p.symbol === ticker)?.percentOfPortfolio?.toFixed(1) || '0'}%",
      "assessment": "${portfolio?.positions?.find(p => p.symbol === ticker) ? 'Existing position' : 'New position'}",
      "comparison": "vs portfolio total"
    }
  ],
  "entryPoints": [
    {
      "zone": "Primary Support",
      "price": "$${nearestSupport ? nearestSupport.price.toFixed(2) : (currentPrice * 0.95).toFixed(2)}",
      "timing": "Limit order",
      "rationale": "${nearestSupport ? nearestSupport.strength + ' support level' : 'Technical entry'}",
      "probability": "${nearestSupport ? '70%' : '50%'}"
    }${supports.length > 1 ? `,
    {
      "zone": "Secondary Support",
      "price": "$${supports[1].price.toFixed(2)}",
      "timing": "If breaks first support",
      "rationale": "${supports[1].strength} support level",
      "probability": "30%"
    }` : ''}
  ],
  "exitPoints": [
    {
      "target": "First Resistance",
      "price": "$${nearestResistance ? nearestResistance.price.toFixed(2) : (currentPrice * 1.05).toFixed(2)}",
      "gain": "${nearestResistance ? ((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(1) : '5.0'}%",
      "timeframe": "1-2 weeks",
      "probability": "60%"
    }${resistances.length > 1 ? `,
    {
      "target": "Major Resistance",
      "price": "$${resistances[resistances.length - 1].price.toFixed(2)}",
      "gain": "${((resistances[resistances.length - 1].price - currentPrice) / currentPrice * 100).toFixed(1)}%",
      "timeframe": "2-4 weeks",
      "probability": "40%"
    }` : ''}
  ],
  "keyLevels": ${JSON.stringify(keyLevels)},
  "actionPlan": [
    "Place limit buy at $${nearestSupport ? nearestSupport.price.toFixed(2) : (currentPrice * 0.95).toFixed(2)}",
    "Set stop loss at $${nearestSupport ? (nearestSupport.price * 0.98).toFixed(2) : (currentPrice * 0.93).toFixed(2)}",
    "Target 1: $${nearestResistance ? nearestResistance.price.toFixed(2) : (currentPrice * 1.05).toFixed(2)} (partial exit)",
    "${resistances.length > 1 ? `Target 2: $${resistances[resistances.length - 1].price.toFixed(2)} (final exit)` : 'Trail stop for remaining position'}"
  ],
  "optionsStrategy": "${nearestSupport && nearestResistance ? `Bull call spread: Buy ${ticker} ${new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})} ${Math.round(nearestSupport.price / 5) * 5}C / Sell ${Math.round(nearestResistance.price / 5) * 5}C` : 'Wait for better setup'}",
  "marketContext": "${trend} market with ${macd} momentum",
  "technical": {
    "trend": "${trend}",
    "rsi": "${rsi}",
    "macd": "${macd}",
    "movingAverages": "Price ${currentPrice > nearestSupport?.price ? 'above' : 'below'} key support"
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
      } catch (err) {
        console.error("Failed to parse AI response:", txt);
        console.error("Parse error details:", err);
        throw new Error("Invalid JSON response from AI");
      }

      /* ───────── Numeric validator (NEW) ───────── */
      {
        // 1 – build the whitelist of legal prices
        const allowed = new Set<number>([
          currentPrice,
          ...supports.map(s => s.price),
          ...resistances.map(r => r.price),
        ]);

        // 2 – scan every number appearing in the JSON string
        const jsonString = JSON.stringify(analysis);
        const priceLike = /\$?(\d{2,5}(?:\.\d+)?)/g;
        let m; const bad: number[] = [];
        while ((m = priceLike.exec(jsonString)) !== null) {
          const n = parseFloat(m[1]);
       
          if (n > 50 && n < 2000) {
            const legal = [...allowed].some(a => Math.abs(a - n) < a * 0.01);  
            if (!legal) bad.push(n);
          }
        }

        // 3 – abort if any illegal numbers detected
        if (bad.length) {
          return json({
            success: false,
            error: `AI invented prices: ${bad.join(", ")}`,
            allowed: [...allowed],
          }, 200);
        }
      }
      /* ───────── End numeric validator ───────── */

    return json({ success: true, analysis, confidence: analysis.confidence });
  } catch (err) {
    console.error("integrated-analysis error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});