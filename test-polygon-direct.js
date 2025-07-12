// Test Polygon API directly
const API_KEY = 'UgMrYPQ2pvp8ClkTvuEsWZ7jLj7B_ixu';

async function testDirect() {
  console.log('Testing Polygon API directly...\n');
  
  const url = `https://api.polygon.io/v3/snapshot/options/AAPL?apiKey=${API_KEY}&limit=10&contract_type=call`;
  
  console.log('URL:', url);
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500) + '...');
  
  if (response.ok && data.results) {
    console.log(`\n✅ Found ${data.results.length} options`);
    if (data.results[0]) {
      const opt = data.results[0];
      console.log('\nFirst option:');
      console.log('- Contract:', opt.details?.contract_type, opt.details?.strike_price, opt.details?.expiration_date);
      console.log('- Greeks:', opt.greeks);
    }
  }
}

testDirect().catch(console.error);