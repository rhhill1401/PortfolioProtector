import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, { ts: number; data: OptionGreeksResponse }>();

interface OptionRequest {
  symbol: string;
  strike: number;
  expiry: string;
  type: 'CALL' | 'PUT';
}

interface OptionGreeksResponse {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  dte: number | null;
  mid: number | null;
  bid: number | null;
  ask: number | null;
  lastUpdated: number | null;
}

interface PolygonOptionQuote {
  details: {
    strike_price: number;
    expiration_date: string;
    contract_type: 'call' | 'put';
    ticker: string;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  day?: {
    close?: number;
    high?: number;
    low?: number;
    vwap?: number;
    volume?: number;
  };
  last_quote?: {
    ask?: number;
    bid?: number;
    last_updated?: number;
  };
  implied_volatility?: number;
  open_interest?: number;
}

interface PolygonResponse {
  results?: PolygonOptionQuote[];
  status: string;
  error?: string;
}

type GreeksMap = Record<string, OptionGreeksResponse>;

type GreeksResult = {
  success: boolean;
  greeks: GreeksMap;
  failed: Array<{ key: string; reason: string }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function makeKey(req: OptionRequest): string {
  const type = req.type.toUpperCase();
  return `${req.symbol.toUpperCase()}-${Number(req.strike)}-${req.expiry}-${type}`;
}

function cacheGet(key: string): OptionGreeksResponse | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function cacheSet(key: string, data: OptionGreeksResponse): void {
  cache.set(key, { ts: Date.now(), data });
}

function parseRequest(body: unknown): OptionRequest[] {
  if (!body || typeof body !== 'object') throw new Error('Invalid payload (expected JSON body)');
  const positions = (body as { positions?: unknown }).positions;
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error('Payload must include non-empty positions array');
  }
  return positions.map((pos, idx) => {
    if (!pos || typeof pos !== 'object') {
      throw new Error(`Position at index ${idx} is invalid`);
    }
    const symbol = String((pos as any).symbol || '').trim().toUpperCase();
    const strike = Number((pos as any).strike);
    const expiry = String((pos as any).expiry || '').trim();
    let type = String((pos as any).type || (pos as any).optionType || 'CALL').toUpperCase();
    if (type !== 'CALL' && type !== 'PUT') type = 'CALL';
    if (!symbol || !strike || !expiry) {
      throw new Error(`Missing required fields for position at index ${idx}`);
    }
    return { symbol, strike, expiry, type: type as 'CALL' | 'PUT' };
  });
}

async function fetchPolygonGreeks(req: OptionRequest, apiKey: string): Promise<OptionGreeksResponse | null> {
  const { symbol, strike, expiry, type } = req;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const url =
      `https://api.polygon.io/v3/snapshot/options/${symbol}` +
      `?apiKey=${apiKey}` +
      `&strike_price=${strike}` +
      `&expiration_date=${expiry}` +
      `&contract_type=${type.toLowerCase()}` +
      `&limit=1`;

    console.log(`Fetching Greeks for ${symbol} ${strike} ${expiry} ${type}`);

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Polygon rate limit exceeded');
        return null;
      }
      throw new Error(`Polygon API error: ${response.status}`);
    }

    const data = (await response.json()) as PolygonResponse;
    if (!data.results || data.results.length === 0) {
      console.warn('Polygon returned no results for', req);
      return null;
    }

    const option = data.results[0];
    const expiryDate = new Date(option.details.expiration_date);
    const today = new Date();
    const dte = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let bid: number | null = null;
    let ask: number | null = null;
    let mid: number | null = null;

    if (typeof option.last_quote?.bid === 'number' && typeof option.last_quote?.ask === 'number') {
      bid = option.last_quote.bid / 10000;
      ask = option.last_quote.ask / 10000;
      mid = (bid + ask) / 2;
    } else if (typeof option.day?.close === 'number') {
      mid = option.day.close;
    }

    return {
      delta: option.greeks?.delta ?? null,
      gamma: option.greeks?.gamma ?? null,
      theta: option.greeks?.theta ?? null,
      vega: option.greeks?.vega ?? null,
      iv: option.implied_volatility ?? null,
      dte: Number.isFinite(dte) ? dte : null,
      mid: mid ?? null,
      bid,
      ask,
      lastUpdated: option.last_quote?.last_updated ?? null,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Polygon request timed out for', req);
      return null;
    }
    console.error('Polygon fetch failed for', req, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('POLYGON_API_KEY') ?? Deno.env.get('VITE_POLYGON_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'POLYGON_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const positions = parseRequest(body);

    const uniqueKeys = new Set<string>();
    const greeks: GreeksMap = {};
    const failed: Array<{ key: string; reason: string }> = [];

    for (const pos of positions) {
      const key = makeKey(pos);
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);

      const cached = cacheGet(key);
      if (cached) {
        greeks[key] = cached;
        continue;
      }

      const data = await fetchPolygonGreeks(pos, apiKey);
      if (data) {
        greeks[key] = data;
        cacheSet(key, data);
      } else {
        failed.push({ key, reason: 'unavailable' });
      }
    }

    const response: GreeksResult = {
      success: true,
      greeks,
      failed,
    };

    return new Response(JSON.stringify(response), {
      status: failed.length > 0 && Object.keys(greeks).length === 0 ? 502 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('option-greeks error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
