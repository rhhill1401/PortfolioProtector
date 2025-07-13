#!/usr/bin/env node

/**
 * Direct test script for portfolio-vision edge function
 * Tests the actual parsing with the real portfolio image
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_FN_URL = 'https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ';
const IMAGE_PATH = '/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png';

async function testPortfolioVision() {
  console.log('🧪 [TEST] Starting portfolio-vision edge function test...\n');

  try {
    // Step 1: Read and encode the image
    console.log('📸 [TEST] Reading portfolio image...');
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    console.log(`✅ [TEST] Image loaded (${Math.round(base64Image.length / 1024)}KB)\n`);

    // Step 2: Call the edge function
    console.log('🚀 [TEST] Calling portfolio-vision edge function...');
    const payload = {
      image: base64Image,
      ticker: 'IBIT'
    };

    const response = await fetch(`${SUPABASE_FN_URL}/portfolio-vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload)
    });

    console.log(`📊 [TEST] Response status: ${response.status}`);
    
    // Step 3: Parse and analyze the response
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ [TEST] Edge function returned error:');
      console.error(JSON.stringify(responseData, null, 2));
      return;
    }

    // Step 4: Detailed analysis
    console.log('\n🔍 [TEST] DETAILED RESPONSE ANALYSIS:');
    console.log('=====================================');
    
    console.log('\n📋 [SUCCESS]:', responseData.success);
    
    if (responseData.portfolio) {
      const portfolio = responseData.portfolio;
      
      console.log('\n📊 [PORTFOLIO DETECTED]:', portfolio.portfolioDetected);
      console.log('🏦 [BROKERAGE TYPE]:', portfolio.brokerageType);
      console.log('💰 [TOTAL VALUE]:', portfolio.totalValue);
      console.log('🎯 [CONFIDENCE]:', portfolio.extractionConfidence);
      console.log('📝 [NOTES]:', portfolio.extractionNotes);
      
      console.log('\n📈 [STOCK POSITIONS]:');
      if (portfolio.positions && portfolio.positions.length > 0) {
        portfolio.positions.forEach((pos, i) => {
          console.log(`   ${i + 1}. ${pos.symbol}: ${pos.quantity} shares @ $${pos.currentPrice} = $${pos.marketValue}`);
        });
      } else {
        console.log('   No stock positions found');
      }
      
      console.log('\n📊 [OPTION POSITIONS]:');
      if (portfolio.metadata?.optionPositions && portfolio.metadata.optionPositions.length > 0) {
        portfolio.metadata.optionPositions.forEach((opt, i) => {
          console.log(`   ${i + 1}. ${opt.symbol} $${opt.strike} ${opt.optionType} ${opt.expiry}`);
          console.log(`       Contracts: ${opt.contracts} (${opt.position})`);
          console.log(`       Premium: $${opt.premiumCollected} | Current: $${opt.currentValue}`);
          console.log(`       P&L: $${opt.profitLoss} | DTE: ${opt.daysToExpiry || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   No option positions found');
      }
    }

    // Step 5: Expected vs Actual Analysis
    console.log('\n🎯 [EXPECTED VS ACTUAL ANALYSIS]:');
    console.log('================================');
    
    console.log('\nFrom the image, we should see:');
    console.log('✓ IBIT stock: 1,400 shares @ $67.21');
    console.log('✓ IBIT 61 Call (Jul-19-2025): -1 contract');
    console.log('✓ IBIT 62 Call (Aug-15-2025): -1 contract');
    console.log('✓ IBIT 63 Call (Aug-15-2025): -4 contracts');
    console.log('✓ IBIT 70 Call (Dec-17-2027): -2 contracts');
    console.log('✓ IBIT 80 Call (Dec-17-2027): -5 contracts');
    console.log('✓ IBIT 90 Call (Dec-17-2027): -1 contract');
    console.log('✓ NVDA stock: 200 shares @ $164.92');
    console.log('✓ NVDA 190 Call (Dec-17-2027): -1 contract');
    console.log('✓ NVDA 200 Call (Dec-17-2027): -1 contract');
    
    const extracted = responseData.portfolio;
    const stockCount = extracted?.positions?.length || 0;
    const optionCount = extracted?.metadata?.optionPositions?.length || 0;
    
    console.log(`\nExtracted: ${stockCount} stocks, ${optionCount} options`);
    console.log(`Expected: 2 stocks, 7 options`);
    
    if (stockCount === 2 && optionCount === 7) {
      console.log('🎉 [SUCCESS] All positions extracted correctly!');
    } else {
      console.log('⚠️  [PARTIAL] Some positions may be missing');
    }

    // Save the complete response for use in integrated-analysis test
    const outputFile = `portfolio-vision-actual-data.json`;
    await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
    console.log(`\n💾 [TEST] Full portfolio data saved to: ${outputFile}`);
    
    console.log('\n✅ [TEST] Portfolio vision test completed!\n');

  } catch (error) {
    console.error('\n💥 [TEST] Unexpected error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPortfolioVision();
}

module.exports = { testPortfolioVision };