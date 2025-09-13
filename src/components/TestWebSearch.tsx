import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TestWebSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const runTest = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const functionUrl = `${supabaseUrl}/functions/v1/test-web-search`;
      console.log('🧪 [TEST] Calling test-web-search function at:', functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ test: true })
      });
      
      const data = await response.json();
      console.log('🧪 [TEST] Response:', data);
      
      setResult(data);
      
      if (!response.ok) {
        setError(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('🧪 [TEST] Error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Web Search Test</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={runTest} 
          disabled={loading}
          className="mb-4"
        >
          {loading ? 'Testing...' : 'Test Web Search'}
        </Button>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded mb-4">
            <p className="text-red-600 font-medium">Error:</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
        
        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="font-medium mb-2">Debug Info:</p>
              <ul className="text-sm space-y-1">
                <li>✅ Web Search Called: {result.debugInfo?.hasWebSearchCall ? 'Yes' : 'No'}</li>
                <li>📊 Status: {result.debugInfo?.webSearchStatus || 'N/A'}</li>
                <li>📄 Has Output: {result.debugInfo?.hasOutputText ? 'Yes' : 'No'}</li>
                <li>🌐 Sources Found: {result.debugInfo?.sources?.length || 0}</li>
              </ul>
            </div>
            
            {result.parsedResult?.events && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="font-medium mb-2">Events Found:</p>
                {result.parsedResult.events.map((event: any, idx: number) => (
                  <div key={idx} className="mb-2 text-sm">
                    <p>📅 {event.event}: {event.date}</p>
                    <p className="text-xs text-gray-500">Source: {event.source}</p>
                  </div>
                ))}
              </div>
            )}
            
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">Raw Response (click to expand)</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}