// Test script to call the integrated-analysis edge function directly
// This mimics the exact payload from the console logs

const SUPABASE_URL = 'https://twnldqhqbybnmqbsgvpq.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE';

const testPayload = {
  "ticker": "IBIT",
  "portfolio": {
    "positions": [
      {
        "symbol": "IBIT",
        "quantity": 1400,
        "purchasePrice": 59.09,
        "currentPrice": 60.72,
        "marketValue": 85008,
        "percentOfPortfolio": 99.79799265250662
      }
    ],
    "totalValue": 85180.07,
    "parseErrors": [],
    "metadata": {
      "source": "image_analysis",
      "brokerageType": "Unknown", 
      "extractionConfidence": "high",
      "fileName": "currentIbit-postions.png",
      "optionPositions": [
        {
          "symbol": "IBIT 61 Call",
          "optionType": "CALL",
          "strike": 61,
          "expiry": "Jul-18-2025",
          "contracts": -1,
          "position": "SHORT",
          "premiumCollected": 2.28,
          "currentValue": 2.1,
          "daysToExpiry": "Unknown",
          "profitLoss": 18.32,
          "percentReturn": "+8.02%",
          "status": "Unknown"
        },
        {
          "symbol": "IBIT 62 Call",
          "optionType": "CALL",
          "strike": 62,
          "expiry": "Aug-15-2025",
          "contracts": -1,
          "position": "SHORT",
          "premiumCollected": 3.59,
          "currentValue": 3.25,
          "daysToExpiry": "Unknown",
          "profitLoss": 34.32,
          "percentReturn": "+9.55%",
          "status": "Unknown"
        },
        {
          "symbol": "IBIT 63 Call",
          "optionType": "CALL",
          "strike": 63,
          "expiry": "Aug-15-2025",
          "contracts": -4,
          "position": "SHORT",
          "premiumCollected": 3.08,
          "currentValue": 2.82,
          "daysToExpiry": "Unknown",
          "profitLoss": 104.28,
          "percentReturn": "+8.46%",
          "status": "Unknown"
        },
        {
          "symbol": "IBIT 70 Call",
          "optionType": "CALL",
          "strike": 70,
          "expiry": "Dec-17-2027",
          "contracts": -2,
          "position": "SHORT",
          "premiumCollected": 19.74,
          "currentValue": 18.95,
          "daysToExpiry": "Unknown",
          "profitLoss": 158.58,
          "percentReturn": "+4.01%",
          "status": "Unknown"
        },
        {
          "symbol": "IBIT 80 Call",
          "optionType": "CALL",
          "strike": 80,
          "expiry": "Dec-17-2027",
          "contracts": -5,
          "position": "SHORT",
          "premiumCollected": 17.29,
          "currentValue": 16.15,
          "daysToExpiry": "Unknown",
          "profitLoss": 571.45,
          "percentReturn": "+6.60%",
          "status": "Unknown"
        },
        {
          "symbol": "IBIT 90 Call",
          "optionType": "CALL",
          "strike": 90,
          "expiry": "Dec-17-2027",
          "contracts": -1,
          "position": "SHORT",
          "premiumCollected": 18.04,
          "currentValue": 14.25,
          "daysToExpiry": "Unknown",
          "profitLoss": 379.32,
          "percentReturn": "+21.02%",
          "status": "Unknown"
        }
      ]
    }
  },
  "chartMetrics": [{
    "timeframe": "4h",
    "keyLevels": [
      { "price": 63.00, "type": "Resistance", "strength": "strong" },
      { "price": 61.50, "type": "Support", "strength": "medium" }
    ],
    "trend": "Bullish",
    "rsi": "55",
    "macd": "Positive"
  }],
  "priceContext": {
    "current": 62.19,
    "open": 62.205,
    "high": 62.94,
    "low": 62.015,
    "close": 62.19
  }
};

async function testEdgeFunction() {
  console.log('🚀 Testing integrated-analysis edge function...\n');
  console.log('📦 Payload being sent:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/integrated-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log('\n📨 Response status:', response.status);
    console.log('📋 Response:', JSON.stringify(result, null, 2));
    
    if (result.error && result.error.includes('AI invented prices')) {
      console.log('\n❌ ERROR: AI invented prices detected!');
      console.log('🔍 Invalid prices:', result.error);
      console.log('✅ Allowed prices:', result.allowed);
    } else if (result.success) {
      console.log('\n✅ SUCCESS: Analysis completed without price validation errors!');
      console.log('🎯 Wheel Strategy:', result.analysis?.wheelStrategy);
    }
    
  } catch (error) {
    console.error('\n❌ Error calling edge function:', error);
  }
}

// Get the API key from .env.local
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = join(__dirname, '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  const anonKeyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  
  if (anonKeyMatch) {
    process.env.VITE_SUPABASE_ANON_KEY = anonKeyMatch[1].trim();
    testEdgeFunction();
  } else {
    console.error('❌ Could not find VITE_SUPABASE_ANON_KEY in .env.local');
  }
} catch (error) {
  console.error('❌ Could not read .env.local:', error.message);
  console.log('💡 Make sure to set SUPABASE_ANON_KEY in the script');
}