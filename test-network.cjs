// Minimal network test
const https = require('https');

const options = {
  hostname: 'twnldqhqbybnmqbsgvpq.supabase.co',
  port: 443,
  path: '/functions/v1/integrated-analysis',
  method: 'OPTIONS',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000
};

console.log('Testing connection to Supabase...');

const req = https.request(options, (res) => {
  console.log(`✅ Connection successful! Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
});

req.on('error', (err) => {
  console.log('❌ Connection failed:', err.message);
  if (err.code === 'ENOTFOUND') {
    console.log('🔍 DNS resolution failed. This might be a temporary network issue.');
  }
});

req.on('timeout', () => {
  console.log('❌ Connection timed out');
  req.destroy();
});

req.end();