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

async function testEndToEndFlow() {
  console.log('🧪 [END-TO-END TEST] Starting real portfolio flow...\n');

  try {
    // STEP 1: Call portfolio-vision with real image
    console.log('📸 [STEP 1] Calling portfolio-vision with real image...');
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
    console.log(`✅ [STEP 1] Portfolio extracted: ${portfolio.metadata.optionPositions.length} options, ${portfolio.positions.length} stocks\n`);

    // Show extracted IBIT option data
    const ibitOptions = portfolio.metadata.optionPositions.filter(opt => opt.symbol === 'IBIT');
    console.log('📊 [EXTRACTED IBIT OPTIONS]:');
    ibitOptions.forEach((opt, i) => {
      console.log(`${i+1}. $${opt.strike} ${opt.optionType} ${opt.expiry}`);
      console.log(`   Contracts: ${opt.contracts}`);
      console.log(`   Premium Collected: $${opt.premiumCollected}`);
      console.log(`   Current Value: $${opt.currentValue}`);
      console.log(`   P&L from vision: $${opt.profitLoss}`);
      console.log('');
    });

    // STEP 2: Call integrated-analysis with extracted data
    console.log('🔬 [STEP 2] Calling integrated-analysis with extracted data...');
    
    const payload = {
      ticker: 'IBIT',
      portfolio: portfolio,
      chartAnalyses: [
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
      ],
      researchDocs: [],
      priceContext: {
        current: 67.21,
        open: 66.85,
        high: 67.50,
        low: 66.50,
        close: 67.21
      }
    };

    const analysisResponse = await axios.post(`${SUPABASE_URL}/functions/v1/integrated-analysis`, payload, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!analysisResponse.data.success) {
      throw new Error(`Integrated-analysis failed: ${analysisResponse.data.error}`);
    }

    console.log('✅ [STEP 2] Analysis completed\n');

    // STEP 3: Compare P&L values
    console.log('⚖️ [STEP 3] P&L COMPARISON:');
    console.log('=====================================');
    
    const analysisPositions = analysisResponse.data.analysis.wheelStrategy.currentPositions;
    
    console.log('Portfolio-Vision P&L vs Integrated-Analysis P&L:');
    ibitOptions.forEach((extractedOpt, i) => {
      const analysisOpt = analysisPositions[i];
      if (analysisOpt) {
        console.log(`\n$${extractedOpt.strike} ${extractedOpt.optionType}:`);
        console.log(`  Vision P&L:    $${extractedOpt.profitLoss}`);
        console.log(`  Analysis P&L:  $${analysisOpt.profitLoss}`);
        console.log(`  Match: ${extractedOpt.profitLoss == analysisOpt.profitLoss ? '✅' : '❌'}`);
        
        if (analysisOpt.intrinsic !== undefined) {
          console.log(`  Intrinsic:     $${analysisOpt.intrinsic}`);
          console.log(`  Extrinsic:     $${analysisOpt.extrinsic}`);
        }
      }
    });

    // Calculate totals
    const visionTotalPL = ibitOptions.reduce((sum, opt) => sum + (opt.profitLoss || 0), 0);
    const analysisTotalPL = analysisPositions.reduce((sum, opt) => sum + (opt.profitLoss || 0), 0);
    
    console.log('\n📈 [TOTALS]:');
    console.log(`Vision Total P&L:    $${visionTotalPL.toFixed(2)}`);
    console.log(`Analysis Total P&L:  $${analysisTotalPL.toFixed(2)}`);
    console.log(`Match: ${Math.abs(visionTotalPL - analysisTotalPL) < 1 ? '✅' : '❌'}`);

    // Save full response
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(`end-to-end-test-${timestamp}.json`, JSON.stringify({
      portfolioExtraction: portfolioResponse.data,
      analysisResult: analysisResponse.data
    }, null, 2));
    
    console.log(`\n💾 [SAVED] Full test results: end-to-end-test-${timestamp}.json`);

  } catch (error) {
    console.error('\n❌ [ERROR]:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testEndToEndFlow();