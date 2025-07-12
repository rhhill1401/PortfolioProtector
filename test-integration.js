// Quick test of Polygon integration
const SUPABASE_FN_URL = 'https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ';

async function test() {
  console.log('Testing Polygon integration...\n');
  
  const response = await fetch(
    `${SUPABASE_FN_URL}/option-chain?ticker=AAPL`,
    { 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      } 
    }
  );

  const data = await response.json();
  
  console.log('Response status:', response.status);
  console.log('Response data:', JSON.stringify(data, null, 2));
  
  if (data.success) {
    console.log('✅ Success! Option chain data:');
    console.log(`Strike: $${data.chain.strike}`);
    console.log(`Expiry: ${data.chain.expiry}`);
    console.log(`DTE: ${data.chain.dte} days`);
    console.log(`Delta: ${data.chain.delta.toFixed(3)}`);
    console.log(`Mid: $${data.chain.mid.toFixed(2)}`);
    if (data.underlying) {
      console.log(`Stock: $${data.underlying.toFixed(2)}`);
    }
  } else {
    console.log('❌ Error:', data.error || 'Unknown error');
  }
}

test().catch(console.error);