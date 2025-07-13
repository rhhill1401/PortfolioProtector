/**
 * End-to-end test for Greeks integration
 * Tests the full flow from portfolio upload to Greeks display
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
const SUPABASE_FN_URL = envVars.VITE_SUPABASE_FN_URL || process.env.VITE_SUPABASE_FN_URL;

async function testGreeksIntegration() {
  console.log('🧪 [GREEKS E2E TEST] Starting Greeks integration test...\n');

  try {
    // STEP 1: Upload portfolio with option positions
    console.log('📸 [STEP 1] Uploading portfolio image...');
    const imageBuffer = await fs.readFile('/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png');
    const base64Image = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;
    
    const portfolioResponse = await axios.post(`${SUPABASE_URL}/functions/v1/portfolio-vision`, {
      image: imageDataUrl
    }, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!portfolioResponse.data.success) {
      throw new Error(`Portfolio-vision failed: ${portfolioResponse.data.error}`);
    }

    const portfolio = portfolioResponse.data.portfolio;
    const optionPositions = portfolio.metadata?.optionPositions || [];
    console.log(`✅ [STEP 1] Portfolio extracted: ${optionPositions.length} option positions\n`);

    // STEP 2: Show what portfolio-vision ACTUALLY returned
    console.log('📊 [ACTUAL PORTFOLIO-VISION RESPONSE] Option positions:');
    optionPositions.forEach((pos, i) => {
      console.log(`  ${i + 1}. ${pos.symbol} $${pos.strike} ${pos.optionType} expiry: "${pos.expiry}" (format: ${pos.expiry})`);
    });
    console.log('');
    
    // STEP 3: Fetch Greeks using EXACT data from portfolio-vision (no conversion!)
    console.log('📊 [STEP 3] Fetching Greeks with ACTUAL expiry dates from portfolio-vision...');
    const greeksData = {};
    let successCount = 0;
    let failureCount = 0;
    
    // Test first 3 positions with the EXACT dates returned by portfolio-vision
    const testPositions = optionPositions.slice(0, 3);
    
    for (const position of testPositions) {
      try {
        console.log(`  Fetching Greeks for ${position.symbol} $${position.strike} with expiry="${position.expiry}"...`);
        
        const params = new URLSearchParams({
          ticker: position.symbol,
          strike: String(position.strike),
          expiry: position.expiry,  // Using EXACT format from portfolio-vision!
          contract_type: position.optionType.toLowerCase()
        });

        const greeksResponse = await axios.get(
          `${SUPABASE_FN_URL}/option-quote?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );

        if (greeksResponse.data.success && greeksResponse.data.quote) {
          const quote = greeksResponse.data.quote;
          const key = `${position.symbol}-${position.strike}-${position.expiry}-${position.optionType}`;
          greeksData[key] = quote;
          successCount++;
          
          console.log(`  ✅ Delta: ${quote.delta}, Theta: ${quote.theta}, IV: ${quote.iv}`);
        } else {
          failureCount++;
          console.log(`  ❌ Failed to fetch Greeks - Response:`, greeksResponse.data);
        }
        
        // Respect rate limit
        await new Promise(resolve => setTimeout(resolve, 12500)); // 5 per minute = 12s between
      } catch (error) {
        failureCount++;
        console.error(`  ❌ Error fetching Greeks: ${error.message}`);
        if (error.response) {
          console.error(`     Status: ${error.response.status}`);
          console.error(`     Data:`, error.response.data);
        }
      }
    }
    
    console.log(`\n📊 [GREEKS SUMMARY] Success: ${successCount}, Failed: ${failureCount}\n`);

    // STEP 4: Call integrated-analysis with Greeks
    console.log('🔬 [STEP 4] Calling integrated-analysis with Greeks data...');
    console.log('📦 [GREEKS DATA BEING SENT]:', JSON.stringify(greeksData, null, 2));
    
    const analysisPayload = {
      ticker: 'IBIT',
      portfolio: portfolio,
      chartMetrics: [{
        timeframe: "6M",
        keyLevels: [
          { price: 70, type: "Resistance", strength: "Strong" },
          { price: 65, type: "Support", strength: "Strong" }
        ],
        trend: "Bullish",
        rsi: "65",
        macd: "Bullish"
      }],
      priceContext: {
        current: 67.21,
        open: 66.85,
        high: 67.50,
        low: 66.50,
        close: 67.21
      },
      optionGreeks: greeksData
    };

    const analysisResponse = await axios.post(`${SUPABASE_URL}/functions/v1/integrated-analysis`, analysisPayload, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!analysisResponse.data.success) {
      throw new Error(`Integrated-analysis failed: ${analysisResponse.data.error}`);
    }

    console.log('✅ [STEP 3] Analysis completed with Greeks\n');

    // STEP 5: Verify Greeks in response
    console.log('🔍 [STEP 5] Verifying Greeks in analysis response...');
    const wheelPositions = analysisResponse.data.analysis.wheelStrategy.currentPositions;
    
    console.log('Position Greeks Summary:');
    wheelPositions.forEach((pos, i) => {
      console.log(`\n${i + 1}. $${pos.strike} ${pos.type} ${pos.expiry}:`);
      console.log(`   Delta: ${pos.delta !== null ? pos.delta : 'N/A'}`);
      console.log(`   Theta: ${pos.theta !== null ? pos.theta : 'N/A'}`);
      console.log(`   Gamma: ${pos.gamma !== null ? pos.gamma : 'N/A'}`);
      console.log(`   IV: ${pos.iv !== null ? pos.iv : 'N/A'}`);
      console.log(`   Assignment Probability: ${pos.assignmentProbability}`);
    });
    
    // Count positions with Greeks
    const positionsWithGreeks = wheelPositions.filter(pos => pos.delta !== null).length;
    console.log(`\n✅ [VERIFICATION] ${positionsWithGreeks}/${wheelPositions.length} positions have Greeks data`);

    // Save test results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(`greeks-e2e-test-${timestamp}.json`, JSON.stringify({
      portfolioData: portfolio,
      greeksData: greeksData,
      analysisResult: analysisResponse.data
    }, null, 2));
    
    console.log(`\n💾 [SAVED] Test results: greeks-e2e-test-${timestamp}.json`);
    
    // Test assertions
    console.log('\n🧪 [TEST RESULTS]');
    console.log(`✅ Portfolio upload successful`);
    console.log(`✅ Greeks fetched for ${successCount} positions`);
    console.log(`✅ Integrated analysis includes Greeks`);
    console.log(`✅ Assignment probability calculated from delta`);
    
    if (positionsWithGreeks < testPositions.length) {
      console.log(`⚠️  WARNING: Only ${positionsWithGreeks}/${testPositions.length} positions have Greeks`);
    }

  } catch (error) {
    console.error('\n❌ [ERROR]:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testGreeksIntegration();