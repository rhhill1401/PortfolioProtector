import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchQuotes } from '@/services/optionLookup';

interface WheelPosition {
  symbol: string;
  strike: number;
  expiry: string;
  type: 'CALL' | 'PUT';
  contracts: number;
  premium?: number;
  premiumCollected?: number;
}

interface OptionQuote {
  ticker: string;
  strike: number;
  expiry: string;
  type: string;
  dte: number;
  mid: number;
  bid: number | null;
  ask: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  openInterest: number | null;
  dayVolume: number | null;
  lastUpdated: number;
}

interface QuoteResponse {
  success: boolean;
  quote?: OptionQuote;
  error?: string;
  ts?: number;
  stale?: boolean;
}

interface UseWheelQuotesReturn {
  quotes: QuoteResponse[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const CACHE_KEY_PREFIX = 'wheel-quotes-cache:';
const CACHE_DURATION = 5 * 60 * 1000;
export function useWheelQuotes(positions?: WheelPosition[]): UseWheelQuotesReturn {
  const [quotes, setQuotes] = useState<QuoteResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  console.log('🎯 [useWheelQuotes] Hook called with positions:', positions?.length || 0, positions);

  const fetchWheelQuotes = useCallback(async () => {
    if (!positions || positions.length === 0) {
      console.log('⚠️ [useWheelQuotes] No positions to fetch quotes for');
      setQuotes([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🚀 [useWheelQuotes] Starting to fetch quotes for', positions.length, 'positions');

      const cacheKey = `${CACHE_KEY_PREFIX}${JSON.stringify(positions.map(p => 
        `${p.symbol}-${p.strike}-${p.expiry}-${p.type}`
      ).sort())}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          const cacheAge = Date.now() - parsedCache.ts;
          
          if (cacheAge < CACHE_DURATION) {
            setQuotes(parsedCache.quotes);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }

      const fetchedQuotes = await fetchQuotes(positions);
      
      fetchedQuotes.forEach((quote, index) => {
        if (!quote.success) {
          console.warn(`Failed to fetch quote for position ${index}:`, {
            position: positions[index],
            error: quote.error
          });
        }
      });

      localStorage.setItem(cacheKey, JSON.stringify({
        quotes: fetchedQuotes,
        ts: Date.now()
      }));

      setQuotes(fetchedQuotes);
    } catch (err) {
      console.error('Error fetching wheel quotes:', err);
      setError(err as Error);
      
      const cacheKey = `${CACHE_KEY_PREFIX}${JSON.stringify(positions.map(p => 
        `${p.symbol}-${p.strike}-${p.expiry}-${p.type}`
      ).sort())}`;
      const staleCache = localStorage.getItem(cacheKey);
      if (staleCache) {
        try {
          const parsedCache = JSON.parse(staleCache);
          setQuotes(parsedCache.quotes.map((q: QuoteResponse) => ({ ...q, stale: true })));
        } catch {
          setQuotes([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [positions]);

  const positionsKey = useMemo(() => {
    if (!positions || positions.length === 0) return '';
    return positions
      .map(p => `${p.symbol}-${p.strike}-${p.expiry}-${p.type}`)
      .sort()
      .join('|');
  }, [positions]);

  useEffect(() => {
    if (positionsKey) {
      fetchWheelQuotes();
    }
  }, [positionsKey, fetchWheelQuotes]);

  return {
    quotes,
    loading,
    error,
    refetch: fetchWheelQuotes
  };
}

/**
 * Helper hook to get a quote for a specific position
 */
export function usePositionQuote(
  position: WheelPosition | undefined
): UseWheelQuotesReturn {
  return useWheelQuotes(position ? [position] : undefined);
}
