import { useEffect, useState } from 'react';

interface OptionChainData {
  expiry: string;
  strike: number;
  dte: number;
  delta: number;
  mid: number;
  iv: number | null;
}

interface OptionChainResponse {
  success: boolean;
  chain?: OptionChainData;
  underlying?: number | null;
  ts?: number;
  error?: string;
  reason?: string;
  stale?: boolean; // Added to indicate when using cached data after error
}

interface UseOptionChainReturn {
  data: OptionChainResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const CACHE_KEY_PREFIX = 'option-chain-cache:';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

/**
 * React hook to fetch option chain data from the edge function
 * Includes caching, error handling, and retry logic
 */
export function useOptionChain(ticker: string): UseOptionChainReturn {
  const [data, setData] = useState<OptionChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOptionChain = async () => {
    if (!ticker) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check localStorage cache first
      const cacheKey = `${CACHE_KEY_PREFIX}${ticker}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          const cacheAge = Date.now() - parsedCache.ts;
          
          if (cacheAge < CACHE_DURATION) {
            setData(parsedCache);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Invalid cache, remove it
          localStorage.removeItem(cacheKey);
        }
      }

      // Fetch from edge function
      const supabaseFnUrl = import.meta.env.VITE_SUPABASE_FN_URL;
      if (!supabaseFnUrl) {
        throw new Error('Supabase Functions URL not configured');
      }

      const response = await fetch(
        `${supabaseFnUrl}/option-chain?ticker=${ticker}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const responseData: OptionChainResponse = await response.json();

      if (!response.ok) {
        // Handle rate limiting specially
        if (response.status === 429 || responseData.reason === 'rate') {
          const retryError = new Error('Rate limited. Please try again in 60 seconds.');
          retryError.name = 'RateLimitError';
          throw retryError;
        }
        throw new Error(responseData.error || `HTTP ${response.status}`);
      }

      if (responseData.success) {
        // Cache successful response
        localStorage.setItem(cacheKey, JSON.stringify({
          ...responseData,
          ts: responseData.ts || Date.now()
        }));
        setData(responseData);
      } else {
        throw new Error(responseData.error || 'Failed to fetch option chain');
      }
    } catch (err) {
      console.error('Error fetching option chain:', err);
      setError(err as Error);
      
      // Try to use stale cache as fallback
      const cacheKey = `${CACHE_KEY_PREFIX}${ticker}`;
      const staleCache = localStorage.getItem(cacheKey);
      if (staleCache) {
        const parsedCache = JSON.parse(staleCache);
        setData({ ...parsedCache, stale: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    if (ticker && mounted) {
      fetchOptionChain();
    }

    return () => {
      mounted = false;
    };
  }, [ticker]);

  return {
    data,
    loading,
    error,
    refetch: fetchOptionChain
  };
}