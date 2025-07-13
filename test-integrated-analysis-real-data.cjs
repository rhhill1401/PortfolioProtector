const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Read env vars from .env.local manually
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

// Read the actual portfolio data from portfolio-vision
async function getActualPortfolioData() {
  // Based on the portfolio-vision output, here's the actual data structure
  return {
    success: true,
    portfolio: {
      totalValue: 127408.66,
      positions: [
        { symbol: "IBIT", quantity: 1400, purchasePrice: 67.21, currentValue: 94094 },
        { symbol: "NVDA", quantity: 200, purchasePrice: 164.92, currentValue: 32984 }
      ],
      metadata: {
        optionPositions: [
          {
            symbol: "IBIT",
            strike: 61,
            expiry: "2025-07-18",
            optionType: "CALL",
            contracts: -1,
            position: "SHORT",
            premiumCollected: 228.32,
            currentValue: 635,
            daysToExpiry: 6,
            profitLoss: -406.68,
            percentReturn: "-178.16%",
            status: "Open",
            term: "SHORT_DATED"
          },
          {
            symbol: "IBIT",
            strike: 62,
            expiry: "2025-08-15",
            optionType: "CALL",
            contracts: -1,
            position: "SHORT",
            premiumCollected: 359.32,
            currentValue: 674,
            daysToExpiry: 34,
            profitLoss: -314.68,
            percentReturn: "-87.56%",
            status: "Open",
            term: "SHORT_DATED"
          },
          {
            symbol: "IBIT",
            strike: 63,
            expiry: "2025-08-15",
            optionType: "CALL",
            contracts: -4,
            position: "SHORT",
            premiumCollected: 1232.28,
            currentValue: 2404,
            daysToExpiry: 34,
            profitLoss: -1171.72,
            percentReturn: "-95.09%",
            status: "Open",
            term: "SHORT_DATED"
          },
          {
            symbol: "IBIT",
            strike: 70,
            expiry: "2027-12-17",
            optionType: "CALL",
            contracts: -2,
            position: "SHORT",
            premiumCollected: 3948.58,
            currentValue: 4386,
            daysToExpiry: 888,
            profitLoss: -437.42,
            percentReturn: "-11.08%",
            status: "Open",
            term: "LONG_DATED"
          },
          {
            symbol: "IBIT",
            strike: 80,
            expiry: "2027-12-17",
            optionType: "CALL",
            contracts: -5,
            position: "SHORT",
            premiumCollected: 8646.45,
            currentValue: 9400,
            daysToExpiry: 888,
            profitLoss: -753.55,
            percentReturn: "-8.71%",
            status: "Open",
            term: "LONG_DATED"
          },
          {
            symbol: "IBIT",
            strike: 90,
            expiry: "2027-12-17",
            optionType: "CALL",
            contracts: -1,
            position: "SHORT",
            premiumCollected: 1804.32,
            currentValue: 1610,
            daysToExpiry: 888,
            profitLoss: 194.32,
            percentReturn: "10.77%",
            status: "Open",
            term: "LONG_DATED"
          },
          {
            symbol: "NVDA",
            strike: 190,
            expiry: "2027-12-17",
            optionType: "CALL",
            contracts: -1,
            position: "SHORT",
            premiumCollected: 3439.32,
            currentValue: 3756,
            daysToExpiry: 888,
            profitLoss: -316.68,
            percentReturn: "-9.21%",
            status: "Open",
            term: "LONG_DATED"
          },
          {
            symbol: "NVDA",
            strike: 200,
            expiry: "2027-12-17",
            optionType: "CALL",
            contracts: -1,
            position: "SHORT",
            premiumCollected: 3404.32,
            currentValue: 3440,
            daysToExpiry: 888,
            profitLoss: -35.68,
            percentReturn: "-1.05%",
            status: "Open",
            term: "LONG_DATED"
          }
        ]
      },
      brokerageType: "Unknown",
      extractionConfidence: "high",
      extractionNotes: "All positions clearly visible"
    }
  };
}

async function testIntegratedAnalysis() {
  console.log('🧪 [TEST] Starting integrated-analysis test with REAL portfolio data...\n');

  try {
    // Get actual portfolio data
    const portfolioData = await getActualPortfolioData();
    const portfolio = portfolioData.portfolio;
    
    // Mock chart and research data (same as before)
    const mockChartData = [
      {
        timeframe: "6M",
        keyLevels: [
          { price: 70, type: "Resistance", strength: "Strong" },
          { price: 68, type: "Resistance", strength: "Medium" },
          { price: 65, type: "Support", strength: "Strong" },
          { price: 62, type: "Support", strength: "Medium" }
        ],
        trend: "Bullish",
        rsi: "65 (Neutral-Bullish)",
        macd: "Bullish crossover"
      }
    ];

    const payload = {
      ticker: 'IBIT',
      portfolio: portfolio,
      chartAnalyses: mockChartData,
      researchDocs: [],
      priceContext: {
        current: 67.21,
        open: 66.85,
        high: 67.50,
        low: 66.50,
        close: 67.21
      }
    };

    // Calculate IBIT totals
    const ibitPositions = portfolio.metadata.optionPositions.filter(opt => opt.symbol === 'IBIT');
    const totalContracts = ibitPositions.reduce((sum, opt) => sum + Math.abs(opt.contracts), 0);
    const totalPremium = ibitPositions.reduce((sum, opt) => sum + opt.premiumCollected, 0);
    
    console.log('📊 [PORTFOLIO SUMMARY]:');
    console.log(`- IBIT Positions: ${ibitPositions.length}`);
    console.log(`- IBIT Total Contracts: ${totalContracts}`);
    console.log(`- IBIT Total Premium Collected: $${totalPremium.toFixed(2)}`);
    console.log(`- Current IBIT Price: $${payload.priceContext.current}\n`);
    
    // Show intrinsic/extrinsic preview
    console.log('📈 [POSITION ANALYTICS PREVIEW]:');
    ibitPositions.forEach(pos => {
      const intrinsic = Math.max(0, payload.priceContext.current - pos.strike) * 100 * Math.abs(pos.contracts);
      const extrinsic = Math.max(0, (pos.currentValue * Math.abs(pos.contracts)) - intrinsic);
      console.log(`- $${pos.strike} CALL: Intrinsic=$${intrinsic}, Extrinsic=$${extrinsic}`);
    });
    console.log('');

    console.log('📤 [TEST] Sending payload to integrated-analysis...');
    console.log('Payload summary:', {
      ticker: payload.ticker,
      portfolioPositions: portfolio.positions.length,
      optionPositions: portfolio.metadata.optionPositions.length,
      ibitOptionPositions: ibitPositions.length,
      currentPrice: payload.priceContext.current
    });
    console.log('');

    const API_URL = `${SUPABASE_URL}/functions/v1/integrated-analysis`;
    const AUTH_KEY = SUPABASE_ANON_KEY;

    const response = await axios.post(API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${AUTH_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 [TEST] Response status: ${response.status}`);
    console.log('✅ [TEST] Request successful!\\n');

    const analysis = response.data.analysis;
    
    if (analysis?.wheelStrategy) {
      const ws = analysis.wheelStrategy;
      console.log('📊 [WHEEL STRATEGY RESPONSE]:');
      console.log(`- Current Phase: ${ws.currentPhase}`);
      console.log(`- Share Count: ${ws.shareCount}`);
      console.log(`- Positions Returned: ${ws.currentPositions?.length || 0}`);
      
      // Calculate total premium from response
      const responseTotalPremium = ws.currentPositions?.reduce((sum, pos) => {
        return sum + (pos.premium || pos.premiumCollected || 0);
      }, 0) || 0;
      
      console.log(`- Total Premium in Response: $${responseTotalPremium.toFixed(2)}`);
      console.log(`\\n⚠️  COMPARISON:`);
      console.log(`- Sent ${ibitPositions.length} IBIT positions with $${totalPremium.toFixed(2)} total premium`);
      console.log(`- Received ${ws.currentPositions?.length || 0} positions with $${responseTotalPremium.toFixed(2)} total premium`);
      
      if (ws.currentPositions?.length !== ibitPositions.length) {
        console.log('\\n❌ ISSUE: Not all positions were returned!');
      }
    }

    // Save full response
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `test-integrated-analysis-real-data-response-${timestamp}.json`;
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    console.log(`\\n💾 [TEST] Full response saved to: ${outputFile}`);

  } catch (error) {
    console.error('\\n❌ [ERROR]:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testIntegratedAnalysis();