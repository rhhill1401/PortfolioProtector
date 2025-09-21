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

const SYSTEM_PROMPT = `You are a professional stock analyst analyzing charts.
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

IMPORTANT: Never apologize or explain. Always return JSON even with limited information.`;

const USER_INSTRUCTIONS = (
  context: string,
  ticker: string,
  priceContext: PriceContext,
) => `Analyze this ${context} chart for ${ticker}.
Current share price is $${priceContext.currentPrice ?? "Unknown"}.
Timeframe ≈ ${priceContext.timeframe ?? "Unknown"}, covering ~${priceContext.rangeDays ?? "Unknown"} days.

•  List any visible horizontal support or resistance lines as precise prices.
•  If values are not clear, output "Unknown" (do NOT invent).

Respond ONLY with JSON and include a "keyLevels" array like:
"keyLevels":[{"price":143.5,"type":"Resistance","strength":"strong"}]`;

interface ResponsesContentBlock { type?: string; text?: string }
interface ResponsesItem { content?: ResponsesContentBlock[] }
interface ResponsesApiResult {
  output_text?: string;
  output?: ResponsesItem[];
  error?: { message?: string };
}

interface ChatCompletionResult {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface VisionRequestContext {
  image: string;
  ticker: string;
  context: string;
  priceContext: PriceContext;
}

const collectResponsesText = (result: ResponsesApiResult): string => {
  if (typeof result.output_text === "string" && result.output_text.trim().length > 0) {
    return result.output_text;
  }
  if (!Array.isArray(result.output)) {
    return "";
  }
  return result.output
    .flatMap((item) => item.content ?? [])
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("")
    .trim();
};

const cleanModelOutput = (raw: string): string => {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  const sliced = first !== -1 && last !== -1 && last > first ? raw.slice(first, last + 1) : raw;
  return sliced.replace(/^\s*```(?:json)?/i, "").replace(/```+\s*$/i, "").trim();
};

const containsApology = (text: string): boolean => {
  const lower = text.toLowerCase();
  return lower.includes("sorry") || lower.includes("apologize");
};

const normalizeImageInput = (image: unknown): string | null => {
  if (typeof image === "string" && image.trim().length > 0) {
    return image;
  }
  if (image && typeof image === "object") {
    const maybeUrl = (image as { url?: string }).url;
    if (typeof maybeUrl === "string" && maybeUrl.trim().length > 0) {
      return maybeUrl;
    }
  }
  return null;
};

const fetchViaResponsesApi = async (
  params: { model: string } & VisionRequestContext,
): Promise<string> => {
  const { model, image, ticker, context, priceContext } = params;
  const body = {
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_image", image_url: image },
          { type: "input_text", text: USER_INSTRUCTIONS(context, ticker, priceContext) },
        ],
      },
    ],
    max_output_tokens: 800,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await res.json()) as ResponsesApiResult;
  if (!res.ok) {
    throw new Error(result.error?.message ?? "OpenAI error");
  }
  return collectResponsesText(result);
};

const fetchViaChatApi = async (
  params: { model: string } & VisionRequestContext,
): Promise<string> => {
  const { model, image, ticker, context, priceContext } = params;
  const body = {
    model,
    temperature: 0.3,
    max_tokens: 800,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          { type: "text", text: USER_INSTRUCTIONS(context, ticker, priceContext) },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await res.json()) as ChatCompletionResult;
  if (!res.ok) {
    throw new Error(result.error?.message ?? "OpenAI error");
  }
  return result.choices?.[0]?.message?.content ?? "";
};

const fetchVisionAnalysis = async (
  req: VisionRequestContext,
): Promise<string> => {
  const model = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
  const lower = model.toLowerCase();
  const useResponses = lower.startsWith("gpt-5") || lower.startsWith("gpt-4o");
  return useResponses
    ? fetchViaResponsesApi({ model, ...req })
    : fetchViaChatApi({ model: "gpt-4o", ...req });
};

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

  const normalizedImage = normalizeImageInput(image);

  if (!normalizedImage) {
    return jsonResponse({ success: false, error: "image (base64 or URL string) is required" }, 400);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse(
      { success: false, error: "OpenAI API key not configured" },
      500,
    );
  }

  try {
    const rawOutput = await fetchVisionAnalysis({
      image: normalizedImage,
      ticker,
      context,
      priceContext,
    });
    const cleaned = cleanModelOutput(rawOutput);

    if (containsApology(cleaned)) {
      const defaultAnalysis = {
        marketContext: "Unable to fully analyse chart",
        technical: {
          trend: "Unknown",
          rsi: "Not visible",
          macd: "Not visible",
          movingAverages: "Not visible",
        },
        recommendation: [
          { name: "Buy", value: 0 },
          { name: "Hold", value: 100 },
          { name: "Sell", value: 0 },
        ],
        risk: "Unable to assess – insufficient chart data",
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
