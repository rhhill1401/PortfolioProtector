const fs = require('fs').promises;
const axios = require('axios');

const API_URL = 'https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/portfolio-vision';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI5Njk5NDUsImV4cCI6MjAzODU0NTk0NX0._kFq9sYg_Hpn7M9g7M_F0SakluxXKJqaUJ9EqI1UaFc';

async function testPortfolioVision() {
  console.log('🧪 [TEST] Starting portfolio-vision test...\n');

  try {
    // Read the test portfolio image
    console.log('📸 [TEST] Reading portfolio image...');
    const imageBuffer = await fs.readFile('/Users/Killmunger/Documents/examples-portfolio/curreentportfolio.png');
    const base64Image = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;
    console.log(`✅ [TEST] Image loaded (${Math.round(imageBuffer.length / 1024)}KB)\n`);

    // Call portfolio-vision edge function
    console.log('🚀 [TEST] Calling portfolio-vision edge function...');
    const response = await axios.post(API_URL, {
      imageDataUrl: imageDataUrl
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 [TEST] Response status: ${response.status}\n`);

    if (response.data.success) {
      // Save the complete response
      const outputFile = `portfolio-vision-output-${new Date().toISOString()}.json`;
      await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
      console.log(`💾 [TEST] Portfolio data saved to: ${outputFile}\n`);
      
      // Show summary
      const portfolio = response.data.portfolio;
      console.log('📊 [SUMMARY]:');
      console.log(`- Total Value: $${portfolio.totalValue}`);
      console.log(`- Stock Positions: ${portfolio.positions.length}`);
      console.log(`- Option Positions: ${portfolio.metadata.optionPositions.length}`);
      
      // Count IBIT contracts
      const ibitPositions = portfolio.metadata.optionPositions.filter(opt => opt.symbol === 'IBIT');
      const totalContracts = ibitPositions.reduce((sum, opt) => sum + Math.abs(opt.contracts), 0);
      console.log(`- IBIT Positions: ${ibitPositions.length}`);
      console.log(`- IBIT Total Contracts: ${totalContracts}`);
      
      // Calculate total premium
      const totalPremium = ibitPositions.reduce((sum, opt) => sum + (opt.premiumCollected || 0), 0);
      console.log(`- IBIT Total Premium: $${totalPremium.toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ [ERROR]:', error.message);
  }
}

testPortfolioVision();