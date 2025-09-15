import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface ETFFlowData {
  netFlows: string | null;
  trend: string | null;
  impact: string | null;
  recommendation: string | null;
  source: { url: string; asOf: string };
}

interface ETFFlowResponse {
  success: boolean;
  ticker: string;
  etfFlows: ETFFlowData | null;
}

interface UseETFFlowsReturn {
  data: ETFFlowData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEtfFlows(ticker: string | null): UseETFFlowsReturn {
  const [data, setData] = useState<ETFFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    if (!ticker) {
      setData(null);
      return;
    }

    // Only support IBIT and ETHA for now
    const supportedTickers = ['IBIT', 'ETHA'];
    if (!supportedTickers.includes(ticker.toUpperCase())) {
      setData(null);
      setError(`ETF flows only available for ${supportedTickers.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      const response = await axios.post<ETFFlowResponse>(
        `${supabaseUrl}/functions/v1/etf-flows`,
        { ticker: ticker.toUpperCase() },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      if (response.data.success && response.data.etfFlows) {
        setData(response.data.etfFlows);
      } else {
        // If no data but successful response, set data with source info
        setData({
          netFlows: null,
          trend: null,
          impact: null,
          recommendation: null,
          source: response.data.etfFlows?.source || {
            url: 'https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf',
            asOf: new Date().toISOString().split('T')[0]
          }
        });
      }
    } catch (err) {
      console.error('Error fetching ETF flows:', err);
      setError('Failed to fetch ETF flow data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  return {
    data,
    loading,
    error,
    refetch: fetchFlows,
  };
}