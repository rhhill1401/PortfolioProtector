const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read env vars from .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^(VITE_[^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const PORTFOLIO_IMAGE_PATH = '/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png';

console.log('🔍 [DEBUG] Environment check:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`   Portfolio image exists: ${fs.existsSync(PORTFOLIO_IMAGE_PATH) ? '✓' : '✗'}`);

async function testPortfolioVisionDebug() {
  console.log('\n🧪 [TEST] Starting portfolio-vision edge function debug test...\n');

  try {
    // Read and encode the image
    console.log('📸 [TEST] Reading portfolio image...');
    const imageBuffer = fs.readFileSync(PORTFOLIO_IMAGE_PATH);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    console.log(`✅ [TEST] Image loaded (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

    // Call the edge function
    console.log('\n🚀 [TEST] Calling portfolio-vision edge function...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/portfolio-vision`;
    console.log(`   URL: ${functionUrl}`);
    
    const response = await axios.post(
      functionUrl,
      {
        image: base64Image,
        ticker: 'IBIT'
      },
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Accept any status to see error responses
      }
    );

    console.log(`📊 [TEST] Response status: ${response.status}`);
    console.log(`📊 [TEST] Response headers:`, response.headers);
    
    // Log the raw response
    console.log('\n🔍 [DEBUG] RAW RESPONSE:');
    console.log('=====================================');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('=====================================\n');
    
    // Show the full portfolio data if successful
    if (response.data.success && response.data.portfolio) {
      console.log('\n📊 [FULL PORTFOLIO DATA]:');
      console.log('=====================================');
      console.log(JSON.stringify(response.data.portfolio, null, 2));
      console.log('=====================================\n');
    }

    // If we have a portfolio in the response, analyze it
    if (response.data.portfolio) {
      const portfolio = response.data.portfolio;
      
      // Check if the AI response itself had issues
      if (portfolio.extractionNotes && portfolio.extractionNotes.includes('JSON parsing failed')) {
        console.log('\n⚠️  [ERROR] JSON Mode Failed!');
        console.log('Despite using response_format: { type: "json_object" }, the AI returned invalid JSON.');
        console.log('This suggests the JSON mode is not being applied correctly.\n');
      }

      // Try to understand what went wrong
      console.log('🔍 [DEBUG] Portfolio extraction details:');
      console.log(`   Detected: ${portfolio.portfolioDetected}`);
      console.log(`   Confidence: ${portfolio.extractionConfidence}`);
      console.log(`   Notes: ${portfolio.extractionNotes}`);
      
      if (portfolio.debugInfo) {
        console.log('\n🔍 [DEBUG] Additional debug info from edge function:');
        console.log(JSON.stringify(portfolio.debugInfo, null, 2));
      }
    }

    // If there's an error field
    if (response.data.error) {
      console.log('\n❌ [ERROR] Edge function returned error:');
      console.log(`   ${response.data.error}`);
    }

  } catch (error) {
    console.error('\n💥 [ERROR] Test failed with exception:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }

  console.log('\n✅ [TEST] Debug test completed!');
}

// Run the test
testPortfolioVisionDebug();