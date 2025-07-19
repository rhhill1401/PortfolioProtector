#!/usr/bin/env node

/**
 * STANDARD FEATURE TEST TEMPLATE
 * 
 * Use this template for testing ANY feature that involves the analysis flow.
 * Copy this file and modify the verification section for your specific feature.
 * 
 * REQUIRED: Always test the FULL FLOW from image upload to final response.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  SUPABASE_URL: 'twnldqhqbybnmqbsgvpq.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ',
  // Use the portfolio without dashes for now
  PORTFOLIO_IMAGE: '/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png',
  CHART_IMAGE: '/Users/Killmunger/Documents/examples-portfolio/4hourChart.png',
  RESEARCH_FILE: '/Users/Killmunger/Documents/examples-portfolio/Market News on IBIT (iShares Bitcoin Trust ETF).pdf'
};

// Test state
const testState = {
  portfolio: null,
  greeks: {},
  analysisResponse: null,
  errors: []
};

// Helper function for HTTPS requests
async function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const options = {
      hostname: CONFIG.SUPABASE_URL,
      port: 443,
      path: `/functions/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${CONFIG.ANON_KEY}`,
        'apikey': CONFIG.ANON_KEY
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed, status: res.statusCode });
          } else {
            resolve({ success: false, error: parsed, status: res.statusCode });
          }
        } catch (e) {
          resolve({ success: false, error: responseData, status: res.statusCode });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// STEP 1: Upload Portfolio Image
async function uploadPortfolio() {
  console.log('\n📤 [STEP 1] Uploading portfolio image...');
  
  const imageBuffer = fs.readFileSync(CONFIG.PORTFOLIO_IMAGE);
  const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  
  const payload = {
    image: imageBase64,
    ticker: 'IBIT'
  };

  const result = await makeRequest('/portfolio-vision', 'POST', payload);
  
  if (result.success) {
    testState.portfolio = result.data.portfolio;
    console.log('✅ Portfolio uploaded successfully');
    console.log(`   - Stock positions: ${result.data.portfolio.positions.length}`);
    console.log(`   - Option positions: ${result.data.portfolio.metadata?.optionPositions?.length || 0}`);
    console.log(`   - Total value: $${result.data.portfolio.totalValue}`);
    
    // Log premium format detection
    const firstOption = result.data.portfolio.metadata?.optionPositions?.[0];
    if (firstOption) {
      console.log(`   - Premium format: ${firstOption.premiumCollected < 50 ? 'per-share' : 'total'} (${firstOption.premiumCollected})`);
    }
    
    return true;
  } else {
    console.error('❌ Portfolio upload failed:', result.status, result.error);
    testState.errors.push('Portfolio upload failed');
    return false;
  }
}

// STEP 2: Fetch Greeks (Mock for now - replace with real Greeks fetching)
async function fetchGreeks() {
  console.log('\n📊 [STEP 2] Fetching Greeks for option positions...');
  
  const positions = testState.portfolio?.metadata?.optionPositions || [];
  
  // In real implementation, this would call Polygon API
  // For now, using mock Greeks that match your actual data structure
  positions.forEach(pos => {
    const key = `${pos.symbol}-${pos.strike}-${pos.expiry}-${pos.optionType}`;
    testState.greeks[key] = {
      ticker: `O:${pos.symbol}${pos.expiry}C000${pos.strike}000`,
      strike: pos.strike,
      expiry: pos.expiry,
      type: 'call',
      delta: 0.5 + Math.random() * 0.3,
      gamma: 0.02 + Math.random() * 0.03,
      theta: -0.02 - Math.random() * 0.02,
      vega: 0.1 + Math.random() * 0.2,
      iv: 0.3 + Math.random() * 0.2,
      mid: pos.currentValue || 5.0
    };
  });
  
  console.log(`✅ Greeks fetched for ${Object.keys(testState.greeks).length} positions`);
  return true;
}

// STEP 3: Call Integrated Analysis
async function callIntegratedAnalysis() {
  console.log('\n🤖 [STEP 3] Calling integrated-analysis...');
  
  const payload = {
    ticker: 'IBIT',
    portfolio: testState.portfolio,
    charts: [{
      fileName: '4hourChart.png',
      analyzed: true,
      technicalAnalysis: {
        marketContext: 'The market shows a recent upward trend',
        trend: 'upward',
        rsi: '68.14',
        macd: 'bullish'
      }
    }],
    chartMetrics: [{
      timeframe: '4-hour',
      keyLevels: [
        {price: 72.15, type: 'Resistance', strength: 'strong'},
        {price: 66.06, type: 'Support', strength: 'medium'},
        {price: 53.89, type: 'Support', strength: 'strong'}
      ],
      trend: 'upward',
      rsi: '68.14',
      macd: 'bullish'
    }],
    research: [{name: 'Market News on IBIT.pdf'}],
    priceContext: {
      current: 67.21,
      open: 67.54,
      high: 67.838,
      low: 66.545,
      close: 67.21,
      volume: 50706700,
      date: new Date().toISOString()
    },
    optionGreeks: testState.greeks
  };

  const result = await makeRequest('/integrated-analysis', 'POST', payload);
  
  if (result.success) {
    testState.analysisResponse = result.data;
    console.log('✅ Analysis completed successfully');
    console.log(`   - Has wheel strategy: ${!!result.data.analysis?.wheelStrategy}`);
    console.log(`   - Total positions: ${result.data.analysis?.wheelStrategy?.currentPositions?.length || 0}`);
    return true;
  } else {
    console.error('❌ Analysis failed:', result.status, result.error);
    testState.errors.push('Integrated analysis failed');
    return false;
  }
}

// STEP 4: Verify Feature-Specific Results
async function verifyFeatureResults() {
  console.log('\n🔍 [STEP 4] Verifying feature-specific results...');
  
  const analysis = testState.analysisResponse?.analysis;
  if (!analysis) {
    console.error('❌ No analysis data received');
    return false;
  }
  
  // TODO: MODIFY THIS SECTION FOR YOUR SPECIFIC FEATURE
  // Example: Verify wheel metrics calculations
  console.log('\n📊 Wheel Strategy Metrics Verification:');
  
  const positions = analysis.wheelStrategy?.currentPositions || [];
  let totalPremium = 0;
  
  positions.forEach(pos => {
    const premium = pos.premiumCollected || 0;
    const isPerShare = premium < 50;
    const contracts = Math.abs(pos.contracts || 0);
    const premiumTotal = isPerShare ? premium * 100 * contracts : premium;
    
    console.log(`   - ${pos.symbol} $${pos.strike}: Premium=${premium} (${isPerShare ? 'per-share' : 'total'}) × ${contracts} = $${premiumTotal}`);
    totalPremium += premiumTotal;
  });
  
  console.log(`   - Total Premium Calculated: $${totalPremium}`);
  
  // Verify time-based grouping
  const today = new Date();
  const thirtyDayCount = positions.filter(p => {
    const days = Math.ceil((new Date(p.expiry) - today) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  }).length;
  
  const ninetyDayCount = positions.filter(p => {
    const days = Math.ceil((new Date(p.expiry) - today) / (1000 * 60 * 60 * 24));
    return days > 30 && days <= 90;
  }).length;
  
  const longTermCount = positions.filter(p => {
    const days = Math.ceil((new Date(p.expiry) - today) / (1000 * 60 * 60 * 24));
    return days > 90;
  }).length;
  
  console.log(`   - 30-day positions: ${thirtyDayCount}`);
  console.log(`   - 90-day positions: ${ninetyDayCount}`);
  console.log(`   - Long-term positions: ${longTermCount}`);
  
  // TODO: Add more specific verifications for your feature
  
  return totalPremium > 0;
}

// Main test runner
async function runFullFlowTest() {
  console.log('🚀 Starting FULL FLOW TEST...');
  console.log(`📁 Using portfolio: ${path.basename(CONFIG.PORTFOLIO_IMAGE)}`);
  console.log('━'.repeat(60));
  
  try {
    // Run all steps
    const step1Success = await uploadPortfolio();
    if (!step1Success) throw new Error('Portfolio upload failed');
    
    const step2Success = await fetchGreeks();
    if (!step2Success) throw new Error('Greeks fetching failed');
    
    const step3Success = await callIntegratedAnalysis();
    if (!step3Success) throw new Error('Integrated analysis failed');
    
    const step4Success = await verifyFeatureResults();
    if (!step4Success) throw new Error('Feature verification failed');
    
    // Save full response for debugging
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `test-results-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify({
      testState,
      timestamp: new Date().toISOString(),
      errors: testState.errors
    }, null, 2));
    
    console.log('\n━'.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log(`💾 Full results saved to: ${filename}`);
    
  } catch (error) {
    console.log('\n━'.repeat(60));
    console.error('❌ TEST FAILED:', error.message);
    console.error('Errors:', testState.errors);
    process.exit(1);
  }
}

// Run the test
runFullFlowTest().catch(console.error);