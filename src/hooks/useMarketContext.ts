import { useState, useEffect, useRef } from 'react';

interface MarketData {
  etfFlows?: {
    netFlows: string;
    trend: string;
    impact: string;
    recommendation: string;
    source?: { url: string; asOf: string };
  };
  navAnalysis?: {
    premium: string;
    discount: string;
    interpretation: string;
    tradingOpportunity: string;
    source?: { url: string; asOf: string };
  };
  volatilityMetrics?: {
    currentIV: string;
    ivRank: string;
    callPutSkew: string;
    premiumEnvironment: string;
    wheelStrategy: string;
  };
  optionsFlow?: {
    largeOrders: string;
    putCallRatio: string;
    openInterest: string;
    sentiment: string;
  };
  upcomingCatalysts?: Array<{
    event: string;
    date: string;
    impact: string;
    recommendation: string;
    source?: { url: string; asOf: string };
  }>;
}

interface UseMarketContextReturn {
  marketData: MarketData | null;
  sources: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarketContext(ticker: string): UseMarketContextReturn {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarketContext = async () => {
    if (!ticker) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      const functionUrl = `${supabaseUrl}/functions/v1/market-context`;
      
      console.log(`📊 [useMarketContext] Fetching market data for ${ticker}`);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ ticker }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch market context`);
      }

      const data = await response.json();

      if (data.success && data.marketData) {
        setMarketData(data.marketData);
        setSources(data.sources || []);
        console.log(`✅ [useMarketContext] Successfully fetched market data for ${ticker}`);
      } else {
        throw new Error(data.error || 'Failed to fetch market data');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`🚫 [useMarketContext] Request cancelled for ${ticker}`);
      } else {
        console.error(`❌ [useMarketContext] Error fetching market data:`, err);
        setError(err.message || 'Failed to fetch market context');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch market context when ticker changes
  useEffect(() => {
    if (!ticker) {
      setMarketData(null);
      setSources([]);
      return;
    }

    // Debounce the request by 500ms
    timeoutRef.current = setTimeout(() => {
      fetchMarketContext();
    }, 500);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [ticker]);

  return {
    marketData,
    sources,
    loading,
    error,
    refetch: fetchMarketContext,
  };
}