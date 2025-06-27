/* supabase/functions/chart-vision/index.ts
 * Edge Function: chart-vision
 * Receives { image: base64, ticker?: string, context?: 'portfolio' | 'chart' }
 * Calls OpenAI Vision and returns { success, analysis } with full CORS support.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface PriceContext {
  currentPrice?: number;   // e.g. 135.13
  timeframe?: string;      // e.g. "4-hour"
  rangeDays?: number;      // e.g. 180
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/* ---------------- CORS helpers ---------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/* ---------------- Edge entrypoint ---------------- */
Deno.serve(async (req) => {
  /* Pre-flight for browsers */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST" },
    });
  }

  /* ----------- Input validation ----------- */
  let payload: { image?: string; ticker?: string; context?: string; priceContext?: PriceContext };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { image, ticker = "UNKNOWN", context = "chart", priceContext = {} } = payload;

  if (!image) {
    return jsonResponse({ success: false, error: "image is required" }, 400);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse(
      { success: false, error: "OpenAI API key not configured" },
      500,
    );
  }

  /* ----------- OpenAI Vision call ----------- */
  try {
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are a professional stock analyst analyzing charts. 
        ALWAYS return valid JSON even if the image is unclear. If you cannot determine exact values, use reasonable estimates or "Unknown".
        
        Return JSON matching this structure:
        {
          "marketContext": string (describe overall market conditions visible),
          "technical": {
            "trend": string (upward/downward/sideways/unclear),
            "rsi": string (number or "Not visible"),
            "macd": string (bullish/bearish/neutral/Not visible),
            "movingAverages": string (describe MA positions if visible)
          },
          "recommendation": [
            { "name": "Buy", "value": number },
            { "name": "Hold", "value": number },
            { "name": "Sell", "value": number }
          ],
          "risk": string,
"keyLevels":[{ "price": number, "type":"Support|Resistance", "strength":"weak|medium|strong" }]
        }
        
        IMPORTANT: Never apologize or explain. Always return JSON even with limited information.`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image } },
              {
                type: "text",
                text: `
          Analyze this ${context} chart for ${ticker}.
          Current share price is $${priceContext.currentPrice ?? "Unknown"}.
          Timeframe ≈ ${priceContext.timeframe ?? "Unknown"}, covering ~${priceContext.rangeDays ?? "Unknown"} days.
          
          •  List any visible horizontal support or resistance lines as precise prices.
          •  If values are not clear, output "Unknown" (do NOT invent).
          
          Remember, respond ONLY with JSON and include a "keyLevels" array like:
          "keyLevels":[{"price":143.5,"type":"Resistance","strength":"strong"}]`,
              },
            ],
          },
        ],
      }),
    });

    const aiData = await aiResp.json();
    if (!aiResp.ok) throw new Error(aiData.error?.message || "OpenAI error");

    /* -------- Extract JSON block from the reply -------- */
    let txt: string = aiData.choices?.[0]?.message?.content ?? "";
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      txt = txt.slice(first, last + 1);
    }
    txt = txt
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```+\s*$/i, "")
      .trim();

    /* ----- handle model apologies/refusals gracefully ----- */
    if (
      txt.toLowerCase().includes("sorry") ||
      txt.toLowerCase().includes("apologize")
    ) {
      console.warn("AI returned apology – sending default analysis");
      const defaultAnalysis = {
        marketContext: "Unable to fully analyse chart",
        technical: {
          trend: "Unknown",
          rsi: "Not visible",
          macd: "Not visible",
          movingAverages: "Not visible",
        },
        recommendation: [
          { name: "Buy",  value: 0 },
          { name: "Hold", value: 100 },
          { name: "Sell", value: 0 },
        ],
        risk: "Unable to assess – insufficient chart data",
      };
      return jsonResponse({ success: true, analysis: defaultAnalysis });
    }

    try {
      const analysis = JSON.parse(txt);
      return jsonResponse({ success: true, analysis }, 200);
    } catch {
      // Malformed or non‑JSON response
      return jsonResponse(
        { success: false, error: "Model returned invalid JSON" },
        200,
      );
    }
  } catch (err) {
    console.error("chart-vision:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});