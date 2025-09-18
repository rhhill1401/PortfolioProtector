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

  const normalizedImage = typeof image === "string"
    ? image
    : (image && typeof image === "object" && typeof (image as { url?: string }).url === "string"
      ? (image as { url: string }).url
      : null);

  if (!normalizedImage) {
    return jsonResponse({ success: false, error: "image (base64 or URL string) is required" }, 400);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse(
      { success: false, error: "OpenAI API key not configured" },
      500,
    );
  }

  /* ----------- OpenAI Vision call ----------- */
  try {
  const MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
  const modelLower = MODEL.toLowerCase();
  const USE_RESPONSES_API = modelLower.startsWith("gpt-5") || modelLower.startsWith("gpt-4o");

  let aiData: any;
  let txt = "";

  if (USE_RESPONSES_API) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "system",
            content: `You are a professional stock analyst analyzing charts. 
ALWAYS return valid JSON even if the image is unclear. If you cannot determine exact values, use reasonable estimates or "Unknown".

Return JSON matching this structure:
{
  "marketContext": string,
  "technical": {
    "trend": string,
    "rsi": string,
    "macd": string,
    "movingAverages": string
  },
  "recommendation": [
    { "name": "Buy", "value": number },
    { "name": "Hold", "value": number },
    { "name": "Sell", "value": number }
  ],
  "risk": string,
  "keyLevels":[{ "price": number, "type":"Support|Resistance", "strength":"weak|medium|strong" }]
}

IMPORTANT: Never apologize or explain. Always return JSON even with limited information.`
          },
          {
            role: "user",
            content: [
              { type: "input_image", image_url: normalizedImage },
              { type: "input_text", text: `Analyze this ${context} chart for ${ticker}.
Current share price is $${priceContext.currentPrice ?? "Unknown"}.
Timeframe ≈ ${priceContext.timeframe ?? "Unknown"}, covering ~${priceContext.rangeDays ?? "Unknown"} days.

•  List any visible horizontal support or resistance lines as precise prices.
•  If values are not clear, output "Unknown" (do NOT invent).

Respond ONLY with JSON and include a "keyLevels" array like:
"keyLevels":[{"price":143.5,"type":"Resistance","strength":"strong"}]` }
            ]
          }
        ],
        max_output_tokens: 800
      })
    });
    aiData = await res.json();
    if (!res.ok) throw new Error(aiData.error?.message || "OpenAI error");
    if (typeof aiData.output_text === "string" && aiData.output_text.trim().length > 0) {
      txt = aiData.output_text;
    } else if (Array.isArray(aiData.output)) {
      txt = (aiData.output || [])
        .flatMap((item: any) =>
          Array.isArray(item?.content)
            ? item.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).filter(Boolean)
            : []
        )
        .join("")
        .trim();
    } else {
      txt = "";
    }
  } else {
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
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
  "marketContext": string,
  "technical": {
    "trend": string,
    "rsi": string,
    "macd": string,
    "movingAverages": string
  },
  "recommendation": [
    { "name": "Buy", "value": number },
    { "name": "Hold", "value": number },
    { "name": "Sell", "value": number }
  ],
  "risk": string,
  "keyLevels":[{ "price": number, "type":"Support|Resistance", "strength":"weak|medium|strong" }]
}

IMPORTANT: Never apologize or explain. Always return JSON even with limited information.`
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: normalizedImage } },
              {
                type: "text",
                text: `Analyze this ${context} chart for ${ticker}.
Current share price is $${priceContext.currentPrice ?? "Unknown"}.
Timeframe ≈ ${priceContext.timeframe ?? "Unknown"}, covering ~${priceContext.rangeDays ?? "Unknown"} days.

•  List any visible horizontal support or resistance lines as precise prices.
•  If values are not clear, output "Unknown" (do NOT invent).

Respond ONLY with JSON and include a "keyLevels" array like:
"keyLevels":[{"price":143.5,"type":"Resistance","strength":"strong"}]`
              }
            ]
          }
        ]
      })
    });
    aiData = await aiResp.json();
    if (!aiResp.ok) throw new Error(aiData.error?.message || "OpenAI error");
    txt = aiData.choices?.[0]?.message?.content ?? "";
  }

  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  let cleaned = txt;
  if (first !== -1 && last !== -1 && last > first) cleaned = txt.slice(first, last + 1);
  cleaned = cleaned.replace(/^\s*```(?:json)?/i, "").replace(/```+\s*$/i, "").trim();

  if (
    cleaned.toLowerCase().includes("sorry") ||
    cleaned.toLowerCase().includes("apologize")
  ) {
    const defaultAnalysis = {
      marketContext: "Unable to fully analyse chart",
      technical: { trend: "Unknown", rsi: "Not visible", macd: "Not visible", movingAverages: "Not visible" },
      recommendation: [{ name: "Buy", value: 0 }, { name: "Hold", value: 100 }, { name: "Sell", value: 0 }],
      risk: "Unable to assess – insufficient chart data"
    };
    return jsonResponse({ success: true, analysis: defaultAnalysis });
  }

  try {
    const analysis = JSON.parse(cleaned);
    return jsonResponse({ success: true, analysis }, 200);
  } catch {
    return jsonResponse({ success: false, error: "Model returned invalid JSON" }, 200);
  }
} catch (err) {
  console.error("chart-vision:", err);
  return jsonResponse({ success: false, error: String(err) }, 500);
}
});
