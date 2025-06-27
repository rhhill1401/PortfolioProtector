import "jsr:@supabase/functions-js/edge-runtime.d.ts"


type FundamentalMetric = { metric: string; value: string; assessment: string; comparison: string };

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const FMP_API_KEY = Deno.env.get('FMP_API_KEY')

Deno.serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { ticker } = await req.json()
    
    if (!ticker) {
      throw new Error('Ticker symbol is required')
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Call OpenAI GPT-4o for stock analysis
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional stock analyst. 
Return ONLY valid minified JSON that matches this schema:
{
  "marketContext": string,
  "technical": {
    "trend": string,
    "rsi": string,
    "macd": string,
    "movingAverages": string
  },
  "technicalFactors": [
    { "factor": string, "value": string, "interpretation": string, "impact": string, "score": number }
  ],
  "fundamentals": [
    { "metric": string, "value": string, "assessment": string, "comparison": string }
  ],
  "entryPoints": [
    { "zone": string, "price": string, "timing": string, "rationale": string, "probability": string }
  ],
  "exitPoints": [
    { "target": string, "price": string, "gain": string, "timeframe": string, "probability": string }
  ],
  "positionManagement": [string],
  "recommendation": [
    { "name": "Buy" | "Hold" | "Sell", "value": number }
  ],
  "investmentThesis": [string],
  "optionsStrategy": string,
  "risk": string,
  "actionPlan": [string]
}`
          },
          {
            role: 'user',
            content: `Analyze ${ticker} stock and populate EVERY field in the schema with realistic values (or "N/A" if data unavailable). Output only the JSON—no markdown fences, no commentary.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    const openaiData = await openaiResponse.json()
    
    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiData.error?.message || 'Unknown error'}`)
    }

    // Parse the JSON response from OpenAI
    let analysisText = openaiData.choices[0].message.content ?? ''

    // Attempt to grab the first {...} JSON block even if there is prose around it
    const firstBrace = analysisText.indexOf('{')
    const lastBrace  = analysisText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      analysisText = analysisText.slice(firstBrace, lastBrace + 1)
    }

    // Remove ```json or ``` fences if present
    analysisText = analysisText
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```+\s*$/i, '')
      .trim()

    const analysis = JSON.parse(analysisText)
    // guarantee summary object so we can safely add fields later
    if (!analysis.summary || typeof analysis.summary !== 'object') {
      analysis.summary = {};
    }

    // --- Add candle‑based support/resistance & ATR ---
    try {
      const candleResp = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=6mo`
      );
      const candleJson = await candleResp.json();
      const res = candleJson.chart?.result?.[0];
      const highs: number[] =
        res?.indicators?.quote?.[0]?.high?.filter((n: number) => n != null) ??
        [];
      const lows: number[] =
        res?.indicators?.quote?.[0]?.low?.filter((n: number) => n != null) ??
        [];
      const closes: number[] =
        res?.indicators?.quote?.[0]?.close?.filter(
          (n: number) => n != null
        ) ?? [];

      if (closes.length >= 30) {
        const recentHighs = highs.slice(-30);
        const recentLows = lows.slice(-30);

        const support = Math.min(...recentLows);
        const resistance = Math.max(...recentHighs);
        const current = closes[closes.length - 1];

        // Simple ATR(14)
        const trueRanges: number[] = [];
        for (let i = 1; i < closes.length; i++) {
          const h = highs[i];
          const l = lows[i];
          const prevClose = closes[i - 1];
          if ([h, l, prevClose].every((v) => typeof v === 'number')) {
            const tr = Math.max(
              h - l,
              Math.abs(h - prevClose),
              Math.abs(l - prevClose)
            );
            trueRanges.push(tr);
          }
        }
        const atr14 =
          trueRanges.slice(-14).reduce((sum, v) => sum + v, 0) / 14 || null;

        // Inject deterministic strategy arrays into analysis
        analysis.entryPoints = [
          {
            zone: 'Support',
            price: support.toFixed(2),
            timing: 'On pullback',
            rationale: '30‑day swing‑low support',
            probability: '60%',
          },
        ];
        analysis.exitPoints = [
          {
            target: 'Resistance',
            price: resistance.toFixed(2),
            gain: `${((resistance - current) / current * 100).toFixed(1)}%`,
            timeframe: '1‑3 months',
            probability: '55%',
          },
        ];
        analysis.positionManagement = [
          atr14
            ? `Use ${atr14.toFixed(2)} ATR trailing stop`
            : 'Use 1.5 % trailing stop',
        ];
      }
    } catch (cErr) {
      console.warn('Candle fetch error:', cErr);
    }

    /* ---------- Build Buy/Hold/Sell + confidence ---------- */
    let techScore = 0.5
    const rsiVal = parseFloat(analysis.technical?.rsi || '')
    if (!isNaN(rsiVal)) {
      techScore = rsiVal > 70 ? 0.2 : rsiVal < 30 ? 0.8 : 0.5
    }

    let srScore = 0.5
    if (analysis.entryPoints?.[0] && analysis.exitPoints?.[0]) {
      const sup = parseFloat(analysis.entryPoints[0].price)
      const resi = parseFloat(analysis.exitPoints[0].price)
      const cur  = parseFloat(analysis.summary?.currentPrice || '0')
      if (sup && resi && cur) {
        const ratio = (cur - sup) / (resi - sup)
        srScore = 1 - Math.max(0, Math.min(1, ratio)) // closer to support bullish
      }
    }

    let fundScore = 0.5;
    if (Array.isArray(analysis.fundamentals) && analysis.fundamentals.length) {
      const fundamentals = analysis.fundamentals as FundamentalMetric[];
      const positive = fundamentals.filter((f) =>
        /(healthy|better|above)/i.test(f.comparison)
      ).length;
      fundScore = positive / fundamentals.length;
    }

    let vixScore = 0.5
    const vix = analysis.summary?.vix
    if (typeof vix === 'number') {
      vixScore = vix < 20 ? 0.7 : vix > 30 ? 0.3 : 0.5
    }

    let analystScore = 0.5
    if (FMP_API_KEY) {
      try {
        const f = await fetch(`https://financialmodelingprep.com/api/v3/analyst-estimates/${ticker}?apikey=${FMP_API_KEY}`)
        const j = await f.json()
        const rat = j?.[0]?.rating ?? ''
        analystScore = /buy/i.test(rat) ? 0.8 : /sell/i.test(rat) ? 0.2 : 0.5
      } catch (analystErr) {
        console.warn('Analyst fetch error:', analystErr);
      }
    }

    const final = (
      techScore * 0.25 +
      srScore   * 0.15 +
      fundScore * 0.20 +
      vixScore  * 0.10 +
      analystScore * 0.10 +
      0.10 // manual confidence
    )

    const clipped = Math.min(Math.max(final, 0), 1)

    const buyPct  = Math.round(clipped * 100)
    const sellPct = Math.round((1 - clipped) * 100 * 0.60)
    const holdPct = 100 - buyPct - sellPct

    analysis.recommendation = [
      { name: 'Buy',  value: buyPct },
      { name: 'Hold', value: holdPct },
      { name: 'Sell', value: sellPct },
    ]

    analysis.confidence = +(clipped * 10).toFixed(1)

    analysis.summary.overallAssessment =
      buyPct >= 60 ? 'Bullish' : sellPct >= 60 ? 'Bearish' : 'Neutral'

    return new Response(
      JSON.stringify({
        success: true,
        ticker,
        analysis
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Analysis error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})