import { callFnJson } from '@/services/supabaseFns';

export interface OptionPosition {
  symbol: string;
  strike: number;
  expiry: string; // YYYY-MM-DD
  optionType: 'CALL' | 'PUT';
  contracts: number;
}

export interface OptionGreeks {
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

interface OptionGreeksResponse {
  success: boolean;
  greeks?: Record<string, OptionGreeks>;
  failed?: Array<{ key: string; reason: string }>;
  error?: string;
}

interface CacheEntry {
  data: OptionGreeks;
  timestamp: number;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes client-side (server caches 15)

const toRequest = (position: OptionPosition) => ({
  symbol: position.symbol.toUpperCase(),
  strike: Number(position.strike),
  expiry: position.expiry,
  type: position.optionType.toUpperCase() === 'PUT' ? 'PUT' : 'CALL',
});

const buildKey = (position: { symbol: string; strike: number; expiry: string; optionType?: string; type?: string }) => {
  const type = (position.optionType || position.type || 'CALL').toUpperCase();
  return `${position.symbol.toUpperCase()}-${Number(position.strike)}-${position.expiry}-${type}`;
};

export class GreeksFetcher {
  private cache = new Map<string, CacheEntry>();

  private getFromCache(key: string): OptionGreeks | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private saveToCache(key: string, data: OptionGreeks) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async fetchGreeksForPositions(positions: OptionPosition[]): Promise<Map<string, OptionGreeks>> {
    const map = new Map<string, OptionGreeks>();
    if (!positions || positions.length === 0) return map;

    const deduped: OptionPosition[] = [];
    const seen = new Set<string>();

    for (const pos of positions) {
      const key = buildKey(pos);
      const cached = this.getFromCache(key);
      if (cached) {
        map.set(key, cached);
        continue;
      }
      if (!seen.has(key)) {
        deduped.push(pos);
        seen.add(key);
      }
    }

    if (deduped.length > 0) {
      try {
        const payload = { positions: deduped.map(toRequest) };
        const { ok, status, data, text } = await callFnJson<OptionGreeksResponse>('option-greeks', payload);

        if (!ok || !data || !data.success) {
          console.error('[GREEKS] option-greeks failed', { status, data, text });
        } else if (data.greeks) {
          Object.entries(data.greeks).forEach(([key, value]) => {
            this.saveToCache(key, value);
            map.set(key, value);
          });
        }

        if (data?.failed && data.failed.length > 0) {
          console.warn('[GREEKS] Some greeks unavailable', data.failed);
        }
      } catch (error) {
        console.error('[GREEKS] Error fetching greeks', error);
      }
    }

    return map;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const greeksFetcher = new GreeksFetcher();

export const buildGreeksKey = buildKey;
