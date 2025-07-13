/**
 * Simple test to check the raw response format from portfolio-vision
 */

const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Read env vars
const envPath = path.join(__dirname, '.env.local');
const envContent = fsSync.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^(VITE_[^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function testPortfolioVisionRaw() {
  console.log('🧪 Testing Portfolio Vision Raw Response...\n');
  
  try {
    const imageBuffer = await fs.readFile('/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png');
    const base64Image = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;
    
    console.log('📸 Calling portfolio-vision API...');
    const response = await axios.post(`${SUPABASE_URL}/functions/v1/portfolio-vision`, {
      image: imageDataUrl,
      ticker: 'IBIT'
    }, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('\n📦 RAW RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.portfolio?.metadata?.optionPositions) {
      console.log('\n📊 OPTION POSITION DATE FORMATS:');
      response.data.portfolio.metadata.optionPositions.forEach((pos, i) => {
        console.log(`${i + 1}. ${pos.symbol} $${pos.strike} - expiry: "${pos.expiry}" (type: ${typeof pos.expiry})`);
      });
    }
    
    // Save raw response
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(`portfolio-vision-raw-${timestamp}.json`, JSON.stringify(response.data, null, 2));
    console.log(`\n💾 Saved raw response to: portfolio-vision-raw-${timestamp}.json`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

testPortfolioVisionRaw();