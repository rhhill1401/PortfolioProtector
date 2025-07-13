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

// Mock data that simulates what the frontend would send
const mockPortfolioData = {
  portfolioDetected: true,
  brokerageType: "Unknown",
  positions: [
    {
      symbol: "IBIT",
      quantity: 1400,
      purchasePrice: 59.09,
      currentPrice: 67.21,
      marketValue: 94094,
      percentChange: "+13.74%",
      gainLoss: 11372.33
    },
    {
      symbol: "NVDA",
      quantity: 200,
      purchasePrice: 118.87,
      currentPrice: 164.92,
      marketValue: 32984,
      percentChange: "+38.74%",
      gainLoss: 9210.25
    }
  ],
  metadata: {
    optionPositions: [
      {
        symbol: "IBIT",
        optionType: "CALL",
        strike: 61,
        expiry: "Jul-18-2025",
        contracts: -1,
        position: "SHORT",
        premiumCollected: 228.32,
        currentValue: 635,
        daysToExpiry: 6,
        profitLoss: -406.68,
        percentReturn: "-178.12%",
        status: "Open",
        term: "SHORT_DATED"
      },
      {
        symbol: "IBIT",
        optionType: "CALL",
        strike: 62,
        expiry: "Aug-15-2025",
        contracts: -1,
        position: "SHORT",
        premiumCollected: 359.32,
        currentValue: 674,
        daysToExpiry: 34,
        profitLoss: -314.68,
        percentReturn: "-87.58%",
        status: "Open",
        term: "SHORT_DATED"
      },
      {
        symbol: "IBIT",
        optionType: "CALL",
        strike: 63,
        expiry: "Aug-15-2025",
        contracts: -4,
        position: "SHORT",
        premiumCollected: 1232.28,
        currentValue: 2404,
        daysToExpiry: 34,
        profitLoss: -1171.72,
        percentReturn: "-95.09%",
        status: "Open",
        term: "SHORT_DATED"
      }
    ]
  },
  totalValue: 133408.66,
  extractionConfidence: "high",
  extractionNotes: "All positions clearly visible"
};

// Mock chart data
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

// Mock price context
const mockPriceContext = {
  current: 67.21,
  open: 66.85,
  high: 67.50,
  low: 66.50,
  close: 67.21,
  volume: 1234567,
  date: new Date().toISOString(),
  timeframe: "1D"
};

async function testIntegratedAnalysis() {
  console.log('🧪 [TEST] Starting integrated-analysis test...\n');

  try {
    const payload = {
      ticker: "IBIT",
      portfolio: mockPortfolioData,
      charts: mockChartData,
      chartMetrics: mockChartData,
      priceContext: mockPriceContext,
      research: []
    };

    console.log('📤 [TEST] Sending payload to integrated-analysis...');
    console.log('Payload summary:', {
      ticker: payload.ticker,
      portfolioPositions: payload.portfolio.positions.length,
      optionPositions: payload.portfolio.metadata.optionPositions.length,
      currentPrice: payload.priceContext.current
    });

    const response = await axios.post(
      `${SUPABASE_URL}/functions/v1/integrated-analysis`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Accept any status to see error responses
      }
    );

    console.log(`\n📊 [TEST] Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ [TEST] Request successful!\n');
      
      // Save full response for inspection
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = `test-integrated-analysis-response-${timestamp}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(response.data, null, 2));
      console.log(`💾 [TEST] Full response saved to: ${outputFile}\n`);
      
      // Analyze the response structure
      if (response.data.success) {
        const analysis = response.data.analysis;
        
        console.log('🔍 [RESPONSE STRUCTURE]:');
        console.log('=======================');
        console.log('Top-level keys:', Object.keys(analysis || {}));
        
        if (analysis) {
          // Check for wheel strategy data
          if (analysis.wheelStrategy) {
            console.log('\n📊 [WHEEL STRATEGY DATA]:');
            console.log('- Current Phase:', analysis.wheelStrategy.currentPhase);
            console.log('- Share Count:', analysis.wheelStrategy.shareCount);
            console.log('- Positions:', analysis.wheelStrategy.currentPositions?.length || 0);
            
            if (analysis.wheelStrategy.currentPositions?.length > 0) {
              console.log('\n📈 [OPTION POSITIONS ANALYSIS]:');
              analysis.wheelStrategy.currentPositions.forEach((pos, idx) => {
                console.log(`\nPosition ${idx + 1}:`);
                console.log(`  Strike: $${pos.strike}`);
                console.log(`  Type: ${pos.type}`);
                console.log(`  Expiry: ${pos.expiry}`);
                console.log(`  Contracts: ${pos.contracts}`);
                console.log(`  Analysis: ${pos.analysis}`);
                console.log(`  Next Action: ${pos.nextAction}`);
              });
            }
          }
          
          // Check other important fields
          if (analysis.summary) {
            console.log('\n📋 [SUMMARY]:');
            console.log(JSON.stringify(analysis.summary, null, 2));
          }
          
          if (analysis.recommendation) {
            console.log('\n💡 [RECOMMENDATIONS]:');
            console.log(JSON.stringify(analysis.recommendation, null, 2));
          }
          
          if (analysis.actionPlan) {
            console.log('\n📌 [ACTION PLAN]:');
            console.log(JSON.stringify(analysis.actionPlan, null, 2));
          }
          
          // Check if response might cause rendering issues
          console.log('\n🔍 [POTENTIAL ISSUES]:');
          const hasUndefinedValues = JSON.stringify(analysis).includes('undefined');
          const hasNullValues = JSON.stringify(analysis).includes('null');
          console.log(`- Contains undefined values: ${hasUndefinedValues}`);
          console.log(`- Contains null values: ${hasNullValues}`);
          
          // Check for any non-standard data types
          const checkForIssues = (obj, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
              const currentPath = path ? `${path}.${key}` : key;
              if (value === undefined) {
                console.log(`  ⚠️ Undefined value at: ${currentPath}`);
              } else if (value === null) {
                console.log(`  ⚠️ Null value at: ${currentPath}`);
              } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                checkForIssues(value, currentPath);
              }
            }
          };
          
          checkForIssues(analysis);
        }
        
      } else {
        console.log('❌ [TEST] Request failed!');
        console.log('Error response:', response.data);
      }
    } else {
      console.log(`❌ [TEST] HTTP Error ${response.status}`);
      console.log('Response:', response.data);
    }

  } catch (error) {
    console.error('\n💥 [ERROR] Test failed with exception:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }

  console.log('\n✅ [TEST] Integrated analysis test completed!');
}

// Run the test
testIntegratedAnalysis();