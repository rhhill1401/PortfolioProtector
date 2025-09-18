#!/usr/bin/env node

// Diagnostic test for integrated-analysis function
// Tests if the function is deployed and responding correctly

const SUPABASE_URL = 'https://twnldqhqbybnmqbsgvpq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ';

async function testIntegratedAnalysis() {
  const endpoint = `${SUPABASE_URL}/functions/v1/integrated-analysis`;
  
  const testPayload = {
    ticker: 'TEST',
    portfolio: {
      positions: [],
      totalValue: 10000,
      metadata: {
        optionPositions: []
      }
    },
    chartMetrics: [],
    priceContext: {
      current: 100,
      high: 105,
      low: 95,
      timeframe: 'daily'
    }
  };

  console.log(`POST ${endpoint}`);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    const contentType = response.headers.get('content-type');
    console.log(`Status: ${response.status} CT: ${contentType}`);
    
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      
      if (response.ok && data.success) {
        console.log('✅ Function is working correctly!');
        console.log('Response keys:', Object.keys(data));
        if (data.analysis) {
          console.log('Analysis structure:', Object.keys(data.analysis));
        }
      } else {
        console.log('❌ Function returned an error:');
        console.log('Error:', data.error || 'Unknown error');
      }
      
      // Show first 600 chars of response for debugging
      console.log('Body first 600 chars:');
      console.log(' ' + text.substring(0, 600));
      
    } catch (parseError) {
      console.log('❌ Response is not valid JSON');
      console.log('Raw response:', text.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testIntegratedAnalysis();