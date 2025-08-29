// Simple test - just like the browser does it
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_FN_URL = envContent.match(/VITE_SUPABASE_FN_URL=(.+)/)?.[1]?.trim();
const SUPABASE_ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

// Since I can't access the Desktop screenshot directly, I'll use the logo as a test image
// In real usage, you'd use the actual portfolio screenshot
const imagePath = path.join(__dirname, '../public/portfolioLogo.png');
const imageBuffer = fs.readFileSync(imagePath);
const base64 = imageBuffer.toString('base64');
const imageDataUrl = `data:image/png;base64,${base64}`;

console.log('📸 Testing with image, size:', imageBuffer.length, 'bytes\n');

// Step 1: Call portfolio-vision
console.log('Step 1: Calling portfolio-vision...');
fetch(`${SUPABASE_FN_URL}/portfolio-vision`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY
  },
  body: JSON.stringify({
    image: imageDataUrl,
    ticker: 'IBIT'
  })
})
.then(res => res.text())
.then(text => {
  console.log('Vision response:', text.substring(0, 500));
  
  const visionResult = JSON.parse(text);
  
  // Step 2: Call integrated-analysis with whatever portfolio-vision returned
  // OR use fallback data if vision failed
  const portfolio = visionResult.success ? visionResult.portfolio : {
    positions: [{
      symbol: 'IBIT',
      quantity: 1300,
      purchasePrice: 59.02
    }],
    totalValue: 87932,
    metadata: {
      optionPositions: [
        {
          symbol: "IBIT",
          optionType: "CALL",
          strike: 63,
          expiry: "Aug-15-2025",
          contracts: -2,
          position: "SHORT",
          premiumCollected: 608
        }
      ]
    }
  };
  
  console.log('\nStep 2: Calling integrated-analysis...');
  
  return fetch(`${SUPABASE_FN_URL}/integrated-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      ticker: 'IBIT',
      portfolio: portfolio,
      chartMetrics: [{
        timeframe: "4h",
        keyLevels: [
          { price: 70, type: "Resistance", strength: "strong" },
          { price: 65, type: "Support", strength: "medium" }
        ],
        trend: "Bullish",
        rsi: "58",
        macd: "Positive"
      }],
      priceContext: {
        current: 67.64,
        open: 67.90,
        high: 68.64,
        low: 67.37,
        close: 67.64
      }
    })
  });
})
.then(res => res.text())
.then(text => {
  console.log('\n🔍 RAW INTEGRATED-ANALYSIS RESPONSE:');
  console.log('Length:', text.length);
  console.log('First 300 chars:', text.substring(0, 300));
  
  try {
    const result = JSON.parse(text);
    if (result.success) {
      console.log('\n✅ SUCCESS!');
    } else {
      console.log('\n❌ ERROR:', result.error);
      console.log('THIS IS THE "Invalid JSON response from AI" ERROR!');
    }
  } catch (e) {
    console.log('\n❌ FAILED TO PARSE JSON:', e.message);
    console.log('Response was:', text.substring(0, 1000));
  }
})
.catch(err => console.error('Failed:', err));