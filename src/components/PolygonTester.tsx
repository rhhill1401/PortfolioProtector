import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWheelQuotes } from '@/hooks/useWheelQuotes';

type OptionSide = 'CALL' | 'PUT';

export function PolygonTester() {
  const [testInput, setTestInput] = useState<{
    symbol: string;
    strike: string;
    expiry: string;
    type: OptionSide;
  }>({
    symbol: 'IBIT',
    strike: '61',
    expiry: 'Jul-18-2025', // Test with AI format
    type: 'CALL'
  });

  const [testPositions, setTestPositions] = useState<any[]>([]);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [loadingExpirations, setLoadingExpirations] = useState(false);
  const [expirationError, setExpirationError] = useState<string | null>(null);
  const { quotes, loading, error, refetch } = useWheelQuotes(testPositions);

  // Fetch available option expirations from Supabase edge function
  const fetchAvailableExpirations = async () => {
    setLoadingExpirations(true);
    setExpirationError(null);
    try {
      const supabaseFnUrl = import.meta.env.VITE_SUPABASE_FN_URL || import.meta.env.VITE_SUPABASE_URL + '/functions/v1';
      
      const url = `${supabaseFnUrl}/option-expirations?ticker=${testInput.symbol}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch expirations: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.expirations) {
        setAvailableExpirations(data.expirations);
        console.log(`Fetched ${data.expirations.length} expirations for ${testInput.symbol}`);
      } else {
        setExpirationError(data.error || 'No expirations found');
        setAvailableExpirations([]);
      }
    } catch (err: any) {
      console.error('Error fetching expirations:', err);
      setExpirationError(err.message || 'Failed to fetch expirations');
      setAvailableExpirations([]);
    } finally {
      setLoadingExpirations(false);
    }
  };

  useEffect(() => {
    fetchAvailableExpirations();
  }, [testInput.symbol]);

  const parseExpiry = (dateStr: string): string => {
    // Case 1 ─ already correct
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Case 2 ─ "Jul-18-2025" (MMM-DD-YYYY)
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04',
      May: '05', Jun: '06', Jul: '07', Aug: '08',
      Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };

    const match = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
    if (match) {
      const [, monStr, day, year] = match;
      const monthKey = monStr.charAt(0).toUpperCase() + monStr.slice(1).toLowerCase();
      const month = monthMap[monthKey];
      if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
    }

    console.warn('⚠️  parseExpiry: unrecognised format →', dateStr);
    return dateStr;
  };

  // Format date for display (YYYY-MM-DD to human readable)
  const formatDateForDisplay = (dateStr: string): string => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month, day] = dateStr.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    return `${monthName} ${parseInt(day)}, ${year}`;
  };

  const runTest = () => {
    const position = {
      symbol: testInput.symbol,
      strike: parseFloat(testInput.strike),
      expiry: parseExpiry(testInput.expiry), // Convert date format here!
      type: testInput.type,
      contracts: -1,
      premium: 2.28
    };
    setTestPositions([position]);
  };

  // Test strike prices as requested
  const testStrikes = ['61', '63', '67', '70'];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Polygon API Tester</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Symbol</label>
                <input
                  type="text"
                  value={testInput.symbol}
                  onChange={(e) => setTestInput({ ...testInput, symbol: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Strike</label>
                <input
                  type="text"
                  value={testInput.strike}
                  onChange={(e) => setTestInput({ ...testInput, strike: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiry (Any Format)</label>
                <input
                  type="text"
                  value={testInput.expiry}
                  onChange={(e) => setTestInput({ ...testInput, expiry: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={testInput.type}
                  onChange={(e) => setTestInput({ ...testInput, type: e.target.value as OptionSide })}
                  className="w-full p-2 border rounded"
                >
                  <option value="CALL">CALL</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={runTest} disabled={loading}>
                {loading ? 'Testing...' : 'Test Polygon API'}
              </Button>
              <Button onClick={refetch} variant="outline" disabled={loading}>
                Refetch
              </Button>
            </div>

            {/* Strike price quick select */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Quick strike selection:</p>
              <div className="flex flex-wrap gap-2">
                {testStrikes.map((strike) => (
                  <Button
                    key={strike}
                    size="sm"
                    variant={testInput.strike === strike ? "default" : "outline"}
                    onClick={() => setTestInput({ ...testInput, strike })}
                  >
                    ${strike}
                  </Button>
                ))}
              </div>
            </div>

            {/* Available expirations */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Available option expiration dates:
                {loadingExpirations && " (Loading...)"}
              </p>
              <div className="flex flex-wrap gap-2">
                {expirationError && (
                  <div className="w-full flex items-center gap-2">
                    <p className="text-sm text-red-600">{expirationError}</p>
                    <Button size="sm" variant="outline" onClick={fetchAvailableExpirations}>
                      Retry
                    </Button>
                  </div>
                )}
                {availableExpirations.length === 0 && !loadingExpirations && !expirationError && (
                  <p className="text-sm text-gray-500">No expirations found for {testInput.symbol}</p>
                )}
                {availableExpirations.map((expiry) => (
                  <Button
                    key={expiry}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTestInput({ ...testInput, expiry });
                      setTestPositions([{
                        symbol: testInput.symbol,
                        strike: parseFloat(testInput.strike),
                        expiry: expiry, // Already in correct format from API
                        type: testInput.type,
                        contracts: -1
                      }]);
                    }}
                  >
                    {formatDateForDisplay(expiry)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="mt-6 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="font-medium text-red-800">Error:</p>
                <pre className="text-sm text-red-700">{error.message}</pre>
              </div>
            )}

            {testPositions.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium text-blue-800">Test Position:</p>
                <pre className="text-sm text-blue-700">{JSON.stringify(testPositions[0], null, 2)}</pre>
              </div>
            )}

            {quotes.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="font-medium text-green-800">API Response:</p>
                <pre className="text-sm text-green-700">{JSON.stringify(quotes, null, 2)}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
