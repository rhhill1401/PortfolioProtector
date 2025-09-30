/* supabase/functions/portfolio-vision/index.ts
 * Edge Function: portfolio-vision
 * Receives { image: base64, ticker?: string }
 * Calls OpenAI Vision to extract portfolio positions and returns structured data.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parseContractCount, parseContractsFromQuantityText } from "./utils.ts";

interface PortfolioRequestPayload {
  image?: string | { url?: string };
  ticker?: string;
}

interface OptionPosition {
  symbol?: string;
  optionType?: string;
  strike?: number;
  expiry?: string;
  contracts?: number;
  position?: string;
  premiumCollected?: number;
  premium?: number;
  currentValue?: number;
  profitLoss?: number;
  percentReturn?: string;
  daysToExpiry?: number;
  term?: string;
  quantityText?: string;
  positionText?: string;
  directionConfidence?: 'HIGH' | 'LOW';
  signSource?: 'quantityText' | 'model';
  [key: string]: unknown;
}

interface PortfolioResult {
  portfolioDetected?: boolean;
  brokerageType?: string;
  positions?: Array<Record<string, unknown>>;
  metadata?: { optionPositions?: OptionPosition[]; [key: string]: unknown };
  totalValue?: number;
  extractionConfidence?: string;
  extractionNotes?: string;
  [key: string]: unknown;
}

interface AiMessage {
  content?: string;
  refusal?: unknown;
}

interface AiChoice {
  message?: AiMessage;
}

interface AiResponse {
  model?: string;
  usage?: unknown;
  choices?: AiChoice[];
  error?: { message?: string };
}

interface AnalysisOutcome {
  success: boolean;
  portfolio: PortfolioResult;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Strict function-calling schema: the model must put data in function.arguments JSON.
const PORTFOLIO_TOOL = [{
  type: "function",
  function: {
    name: "extract_portfolio",
    description: "Extract portfolio (cash, stocks, options) from a brokerage screenshot.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        portfolioDetected: { type: "boolean" },
        brokerageType: { type: "string" },
        cashBalance: { type: "number" },
        positions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              symbol: { type: "string" },
              quantity: { type: "number" },
              purchasePrice: { type: "number" },
              currentPrice: { type: "number" },
              marketValue: { type: "number" }
            },
            required: ["symbol","quantity","currentPrice","marketValue"]
          }
        },
        metadata: {
          type: "object",
          additionalProperties: true,
          properties: {
            optionPositions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  symbol: { type: "string" },
                  optionType: { type: "string", enum: ["CALL","PUT"] },
                  strike: { type: "number" },
                  expiry: { type: "string" },
                  contracts: { type: "number" },
                  quantityText: { type: "string" },
                  position: { type: "string", enum: ["SHORT","LONG"] },
                  premium: { type: "number" },
                  premiumCollected: { type: "number" },
                  currentValue: { type: "number" },
                  profitLoss: { type: "number" },
                  daysToExpiry: { type: "number" },
                  term: { type: "string", enum: ["LONG_DATED","SHORT_DATED"] }
                },
                required: ["symbol","optionType","strike","expiry","contracts"]
              }
            }
          }
        },
        totalValue: { type: "number" },
        extractionConfidence: { type: "string" },
        extractionNotes: { type: "string" }
      },
      required: ["portfolioDetected","metadata"]
    }
  }
}];

/* ---------------- JSON repair helpers ---------------- */
const stripFences = (s: string) =>
  s.replace(/```(?:json)?/gi, "```").replace(/^.*?```/s, "").replace(/```.*$/s, "").trim();

const sliceToBraces = (s: string) => {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return (a >= 0 && b > a) ? s.slice(a, b+1) : s;
};

function repairJson(txt: string) {
  let s = stripFences(txt);
  s = sliceToBraces(s);
  s = s.replace(/,(\s*[}\]])/g, "$1");                 // trailing commas
  s = s.replace(/[\u0000-\u001F](?!\n|\r|\t)/g, "");   // stray controls
  return s;
}

async function parseWithRetry(raw: string, tries = 2) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return JSON.parse(repairJson(raw)); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 200*(i+1))); }
  }
  throw last;
}

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

const handleCorsPreflight = (req: Request): Response | null => {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", {
    headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST" },
  });
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

const buildDefaultPortfolio = (notes: string): PortfolioResult => ({
  portfolioDetected: false,
  brokerageType: "Unknown",
  positions: [],
  metadata: { optionPositions: [] },
  totalValue: 0,
  extractionConfidence: "low",
  extractionNotes: notes,
});

const enrichOptionPositions = (positions: OptionPosition[] | undefined): OptionPosition[] | undefined => {
  if (!Array.isArray(positions)) return positions;

  const today = new Date();
  let correctedSigns = 0;
  let missingQuantityText = 0;

  const normalized = positions.map((opt) => {
    let daysToExpiry = 0;
    if (opt.expiry) {
      try {
        const parsed = new Date(opt.expiry);
        if (!Number.isNaN(parsed.getTime())) {
          const diff = parsed.getTime() - today.getTime();
          daysToExpiry = Math.max(0, Math.ceil(diff / 86_400_000));
        }
      } catch (dateErr) {
        console.warn(`⚠️ [PORTFOLIO VISION] Date parsing error for ${opt.expiry}:`, dateErr);
      }
    }

    const rawQuantityText = typeof opt.quantityText === "string" ? opt.quantityText.trim() : "";
    const quantityParse = parseContractsFromQuantityText(rawQuantityText);
    const parsedContracts = parseContractCount(opt.contracts);
    const rawContracts = typeof opt.contracts === "number" ? opt.contracts : 0;
    const rawPosition = typeof opt.position === "string" ? opt.position.toUpperCase() : undefined;

    let contracts = parsedContracts ?? rawContracts;
    let signSource: 'quantityText' | 'model' = 'model';
    let directionConfidence: 'HIGH' | 'LOW' = 'LOW';

    if (quantityParse.contracts !== null) {
      signSource = 'quantityText';
      directionConfidence = quantityParse.confidence;
      if (contracts !== quantityParse.contracts) {
        correctedSigns += 1;
      }
      contracts = quantityParse.contracts;
    } else {
      if (!rawQuantityText) {
        missingQuantityText += 1;
      }
      directionConfidence = 'LOW';
      if (rawPosition === 'SHORT' && contracts > 0) {
        contracts = -Math.abs(contracts);
      } else if (rawPosition === 'LONG' && contracts < 0) {
        contracts = Math.abs(contracts);
      }
    }

    const normalizedPosition = contracts < 0 ? 'SHORT' : 'LONG';

    return {
      ...opt,
      quantityText: quantityParse.normalizedText || rawQuantityText || undefined,
      positionText: typeof opt.positionText === "string" ? opt.positionText : undefined,
      contracts,
      daysToExpiry,
      term: daysToExpiry > 365 ? "LONG_DATED" : "SHORT_DATED",
      position: normalizedPosition,
      directionConfidence,
      signSource,
    };
  });

  if (normalized.length > 0) {
    console.log(`ℹ️ [PORTFOLIO VISION] Quantity sign enforcement: corrected ${correctedSigns}/${normalized.length} legs; missing quantityText: ${missingQuantityText}`);
  }

  return normalized;
};

const logPortfolioSummary = (portfolio: PortfolioResult): void => {
  console.log(`✅ [PORTFOLIO VISION] Successfully parsed portfolio data:`, {
    portfolioDetected: portfolio.portfolioDetected,
    positionCount: portfolio.positions?.length ?? 0,
    optionPositionCount: portfolio.metadata?.optionPositions?.length ?? 0,
    cashBalance: portfolio.cashBalance ?? 0,
    totalValue: portfolio.totalValue,
    confidence: portfolio.extractionConfidence,
    brokerageType: portfolio.brokerageType,
  });

  console.log('🔍 [PORTFOLIO VISION] EXACT RESPONSE STRUCTURE:', JSON.stringify({
    success: true,
    portfolio,
  }, null, 2));

  if (Array.isArray(portfolio.positions) && portfolio.positions.length > 0) {
    console.log(`📈 [POSITIONS EXTRACTED]:`, portfolio.positions);
    portfolio.positions.forEach((pos, index) => {
      const symbol = (pos.symbol as string | undefined) ?? 'Unknown';
      const quantity = pos.quantity ?? 'Unknown';
      const price = pos.currentPrice ?? 'Unknown';
      console.log(`   Stock ${index + 1}: ${symbol} - ${quantity} shares @ $${price}`);
    });
  }

  const optionPositions = portfolio.metadata?.optionPositions;
  if (Array.isArray(optionPositions) && optionPositions.length > 0) {
    console.log(`📊 [OPTION POSITIONS EXTRACTED]:`, optionPositions);
    optionPositions.forEach((pos, index) => {
      console.log(`   Option ${index + 1}: ${pos.symbol} $${pos.strike}${pos.optionType} ${pos.expiry} - ${pos.contracts} contracts (${pos.position}) DTE: ${pos.daysToExpiry ?? 'N/A'} P&L: $${pos.profitLoss ?? 'N/A'}`);
    });
  }

  if (!(portfolio.positions?.length) && !(portfolio.metadata?.optionPositions?.length)) {
    console.log(`❌ [PORTFOLIO VISION] No positions extracted from image`);
  }
};

const SYSTEM_PROMPT = `You are a financial data extraction specialist analyzing portfolio screenshots.

HARD REQUIREMENTS:
- You MUST return data by CALLING the function "extract_portfolio". Do not write prose.
- Include CASH, STOCKS, and OPTIONS if visible.
- STRICTLY LIMIT FIELDS to the function schema. No extra keys.
- LIMIT option legs to the most recent 20 by expiry. If more exist in the image, include only the 20 most relevant.
- For each option, include "quantityText" exactly as shown if visible. If unreadable, "quantityText":"UNKNOWN" and contracts:null (do NOT guess).
- Derive "contracts" sign from minus/parentheses; letters like "M" do not change sign.
- Extract CASH BALANCE precisely if shown.
- If no portfolio is visible, set "portfolioDetected": false and add a brief "extractionNotes".

Return data ONLY by function call arguments.

Your response must be valid JSON matching this EXACT structure:
{
  "portfolioDetected": true,
  "brokerageType": "Robinhood",
  "cashBalance": 10589.30,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "purchasePrice": 150.50,
      "currentPrice": 175.25,
      "marketValue": 17525.00,
      "percentChange": "+16.4%",
      "gainLoss": 2475.00
    }
  ],
  "metadata": {
    "optionPositions": [
      {
        "symbol": "AAPL",
        "optionType": "CALL",
        "strike": 180,
        "expiry": "2025-08-15",
        "contracts": -1,
        "position": "SHORT",
        "quantityText": "-1 M",
        "positionText": "Short",
        "premiumCollected": 350,
        "currentValue": 200,
        "daysToExpiry": 30,
        "profitLoss": 150,
        "percentReturn": "+42.8%",
        "status": "Open"
      },
      {
        "symbol": "SPY",
        "optionType": "PUT",
        "strike": 420,
        "expiry": "2025-07-20",
        "contracts": 2,
        "position": "LONG",
        "quantityText": "2 M",
        "positionText": "Long",
        "premium": 800,
        "currentValue": 1200,
        "daysToExpiry": 15,
        "profitLoss": 400,
        "percentReturn": "+50%",
        "status": "Open"
      }
    ]
  },
  "totalValue": 28114.30,
  "extractionConfidence": "high",
  "extractionNotes": "All positions clearly visible"
}

IMPORTANT:
- If you see ANY portfolio data, set portfolioDetected: true
- If image shows no portfolio (e.g., just charts), set portfolioDetected: false
- Extract ALL positions visible, not just the target ticker
- Response MUST be valid JSON only - no text before or after`;

const buildUserPrompt = (ticker: string) => `Extract all portfolio position data from this image with SPECIAL FOCUS ON CASH AND OPTIONS.

PRIMARY FOCUS: Look for ${ticker} positions (both stocks AND options), but extract ALL visible positions.

CRITICAL: Look for CASH BALANCE:
- Look for rows labeled "Cash", "Money Market", "Cash Balance", or similar
- Extract the exact dollar amount shown for cash
- This is crucial for wheel strategy calculations

CRITICAL: Look for OPTION positions (covered calls, cash-secured puts, long options):
- Option symbols (e.g., "IBIT 61C JUL19", "AAPL 150P DEC15")
- Strike prices (e.g., $61, $65.44, $150)
- Expiry dates (e.g., "Jul-19-2025", "Aug-15-2025")
- Number of contracts (capture the Quantity column text exactly, e.g., "-1 M", "5 M", "(5)").
- Premium collected/paid
- Current option value
- Profit/Loss on options
- Days to expiry

ALSO look for stock positions (extract into main "positions" array):
- Stock symbols (like AAPL, TSLA, MSFT, IBIT, etc.)
- Share quantities (number of shares owned)
- Purchase/cost basis prices
- Current market prices
- Total market values
- Gain/loss percentages

OPTION POSITION RULES - CRITICAL:
- SOLD options (you wrote/sold): the Quantity cell will have a minus sign or parentheses (e.g., "-1 M", "(3)").
- BOUGHT options (you purchased): the Quantity cell has no minus sign or parentheses (e.g., "1", "5 M").
- Letters like "M" or other suffixes do NOT affect the sign; rely solely on the minus sign or parentheses.
- Include 'quantityText' and 'positionText' fields in the JSON for every option position.
- Provide the numeric 'contracts' with the correct sign derived from 'quantityText'.
- If the quantity cell is unreadable, set 'quantityText' to "UNKNOWN" and 'contracts' to null (do NOT infer the sign).

WHEEL STRATEGY FOCUS: Extract ALL option details into metadata.optionPositions:
- Exact strike prices
- Exact expiry dates
- Premium collected (for sold) or paid (for bought)
- Current profit/loss
- Performance metrics
- Contract direction (positive for bought, negative for sold)

Return ONLY valid JSON following the exact structure specified. No text before or after the JSON.`;

const buildRequestBody = (image: string, ticker: string) => ({
  model: "gpt-4o",
  temperature: 0,
  max_tokens: 3500, // give headroom; real fix is caps + function calling
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        { type: "text", text: buildUserPrompt(ticker) },
      ],
    },
  ],
  tools: PORTFOLIO_TOOL,
  tool_choice: { type: "function", function: { name: "extract_portfolio" } }
});

const QUANTITY_SYSTEM_PROMPT = `You are verifying option quantity/contract values for a brokerage screenshot.
- Always read the Quantity/Contracts column EXACTLY as rendered (e.g., "-5 M", "5", "(3)").
- Respond with JSON: { "quantities": [ { "key": string, "quantityText": string } ] }.
- If a quantity is unreadable, set quantityText to "UNKNOWN" (do NOT guess).
- Do not provide explanations or additional text.`;

const buildQuantityFollowupBody = (image: string, legs: OptionPosition[]) => {
  const lines = legs.map((leg, index) => {
    const symbol = leg.symbol ?? "UNKNOWN";
    const type = (leg.optionType ?? leg.type ?? "").toUpperCase();
    const strike = leg.strike ?? "UNKNOWN";
    const expiry = leg.expiry ?? "UNKNOWN";
    const key = buildOptionKey(leg);
    return `${index + 1}. key: ${key}\n   symbol: ${symbol}\n   optionType: ${type}\n   strike: ${strike}\n   expiry: ${expiry}`;
  }).join('\n\n');

  const instructions = `Read the Quantity/Contracts column for each of the following option rows. Return JSON with an array called quantities. Each entry must include the provided key and the exact quantityText. Do not infer or normalise.\n\n${lines}`;

  return {
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: QUANTITY_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          { type: "text", text: instructions },
        ],
      },
    ],
  };
};

const buildOptionKey = (opt: OptionPosition): string => {
  const symbol = (opt.symbol ?? '').toUpperCase();
  const type = (opt.optionType ?? opt.type ?? '').toUpperCase();
  const strike = opt.strike ?? '';
  const expiry = opt.expiry ?? '';
  return `${symbol}|${type}|${strike}|${expiry}`;
};

const fetchQuantityOverrides = async (
  image: string,
  legs: OptionPosition[],
): Promise<Map<string, string>> => {
  if (legs.length === 0) return new Map();

  const body = buildQuantityFollowupBody(image, legs);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI quantity follow-up error");
  }

  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: { quantities?: Array<{ key?: string; quantityText?: string }> } = {};
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("⚠️ [PORTFOLIO VISION] Quantity follow-up JSON parse failed:", err);
    return new Map();
  }

  const overrides = new Map<string, string>();
  for (const entry of parsed.quantities ?? []) {
    if (!entry?.key || typeof entry.quantityText !== "string") continue;
    overrides.set(entry.key, entry.quantityText);
  }
  return overrides;
};

const fetchAiResponse = async (image: string, ticker: string, apiKey: string) => {
  console.log(`🔍 [PORTFOLIO VISION] Starting analysis for ticker: ${ticker}`);
  const body = buildRequestBody(image, ticker);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const aiData = (await response.json()) as AiResponse & {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string }
        }>
      }
    }>
  };

  console.log(`📊 [PORTFOLIO VISION] OpenAI status: ${response.status}`);
  if (!response.ok) {
    console.error(`❌ [PORTFOLIO VISION] OpenAI error:`, aiData);
    throw new Error(aiData?.error?.message || "OpenAI error");
  }

  const message = aiData.choices?.[0]?.message;
  const toolArgs =
    message?.tool_calls?.find(tc => tc.function?.name === "extract_portfolio")
      ?.function?.arguments ?? "{}";

  const rawText = typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs);
  console.log(`📝 [PORTFOLIO VISION] Function arguments length: ${rawText.length}`);

  return { aiData, rawText };
};

const analyzePortfolioImage = async (image: string, ticker: string, apiKey: string): Promise<AnalysisOutcome> => {
  const { aiData, rawText } = await fetchAiResponse(image, ticker, apiKey);

  if (aiData.choices?.[0]?.message?.refusal) {
    console.warn("⚠️ [PORTFOLIO VISION] AI refused the request:", aiData.choices[0].message.refusal);
    return { success: false, portfolio: buildDefaultPortfolio("AI refused to process the image") };
  }

  try {
    const portfolio = await parseWithRetry(rawText) as PortfolioResult;

    // Hard caps for stability
    if (Array.isArray(portfolio.metadata?.optionPositions)) {
      portfolio.metadata.optionPositions = portfolio.metadata.optionPositions
        .sort((a,b) => new Date(a?.expiry ?? '').getTime() - new Date(b?.expiry ?? '').getTime())
        .slice(-20);
    }
    if (Array.isArray(portfolio.positions)) {
      portfolio.positions = portfolio.positions.slice(0, 50);
    }
    const optionPositions = portfolio.metadata?.optionPositions;
    let normalizedOptionPositions: OptionPosition[] | undefined;
    try {
      normalizedOptionPositions = enrichOptionPositions(optionPositions);
      portfolio.metadata = {
        ...portfolio.metadata,
        optionPositions: normalizedOptionPositions,
      };
    } catch (postProcessError) {
      console.error(`⚠️ [PORTFOLIO VISION] Post-processing failed, keeping original data:`, postProcessError);
    }

    const optionPositionsArray = normalizedOptionPositions ?? [];
    const missingQuantity = optionPositionsArray.filter((pos) => pos.signSource !== 'quantityText' || !pos.quantityText);
    if (missingQuantity.length > 0) {
      try {
        const overrides = await fetchQuantityOverrides(image, missingQuantity);
        let followUpCorrections = 0;

        optionPositionsArray.forEach((pos) => {
          const key = buildOptionKey(pos);
          const overrideText = overrides.get(key);
          if (!overrideText) return;

          if (overrideText === 'UNKNOWN') {
            pos.quantityText = 'UNKNOWN';
            pos.directionConfidence = 'LOW';
            pos.signSource = pos.signSource ?? 'model';
            return;
          }

          const parsed = parseContractsFromQuantityText(overrideText);
          if (parsed.contracts === null) {
            pos.quantityText = parsed.normalizedText || overrideText;
            pos.signSource = pos.signSource ?? 'model';
            pos.directionConfidence = 'LOW';
            return;
          }

          if (pos.contracts !== parsed.contracts) {
            followUpCorrections += 1;
          }

          pos.quantityText = parsed.normalizedText || overrideText;
          pos.contracts = parsed.contracts;
          pos.position = pos.contracts < 0 ? 'SHORT' : 'LONG';
          pos.directionConfidence = parsed.confidence;
          pos.signSource = 'quantityText';
        });

        if (followUpCorrections > 0) {
          console.log(`ℹ️ [PORTFOLIO VISION] Quantity follow-up corrected ${followUpCorrections} legs via secondary pass`);
        }
      } catch (followUpError) {
        console.error('⚠️ [PORTFOLIO VISION] Quantity follow-up failed:', followUpError);
      }
    }

    logPortfolioSummary(portfolio);
    return { success: true, portfolio };
  } catch (parseError) {
    const rawTextLength = rawText?.length ?? 0;
    console.error(`❌ [PORTFOLIO VISION] JSON parse error:`, parseError);
    console.error(`🔍 [PORTFOLIO VISION] Failed to parse text (length: ${rawTextLength})`);
    if (rawTextLength > 0) {
      console.error(`🔍 [PORTFOLIO VISION] First 1000 chars:`, rawText.substring(0, 1000));
      console.error(`🔍 [PORTFOLIO VISION] Last 500 chars:`, rawText.substring(Math.max(0, rawTextLength - 500)));
    }

    const fallback = buildDefaultPortfolio("JSON parsing failed despite JSON mode");
    return { success: false, portfolio: fallback };
  }
};

const validatePayload = async (req: Request): Promise<
  | { ok: true; value: { image: string; ticker: string } }
  | { ok: false; response: Response }
> => {
  let payload: PortfolioRequestPayload;
  try {
    payload = await req.json();
  } catch {
    return { ok: false, response: jsonResponse({ success: false, error: "Invalid JSON body" }, 400) };
  }

  const ticker = typeof payload.ticker === "string" && payload.ticker.trim().length > 0 ? payload.ticker.trim() : "UNKNOWN";
  const normalizedImage = normalizeImageInput(payload.image);

  if (!normalizedImage) {
    return { ok: false, response: jsonResponse({ success: false, error: "image is required" }, 400) };
  }

  return { ok: true, value: { image: normalizedImage, ticker } };
};

/* ---------------- Edge entrypoint ---------------- */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const validation = await validatePayload(req);
  if (!validation.ok) return validation.response;

  if (!OPENAI_API_KEY) {
    return jsonResponse({ success: false, error: "OpenAI API key not configured" }, 500);
  }

  try {
    const { image, ticker } = validation.value;
    const analysis = await analyzePortfolioImage(image, ticker, OPENAI_API_KEY);
    return jsonResponse(analysis, 200);
  } catch (err) {
    console.error("💥 [PORTFOLIO VISION] Unexpected error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});
