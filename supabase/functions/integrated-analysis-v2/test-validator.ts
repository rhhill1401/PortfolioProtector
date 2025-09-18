// Test script to verify the price validator fix
// Run with: deno run test-validator.ts

// Simulate the validator logic
function testValidator() {
  // Test data matching the bug scenario
  const currentPrice = 62.19;
  const supports = [{ price: 61.50 }, { price: 60.00 }];
  const resistances = [{ price: 63.00 }, { price: 64.50 }];
  const optionStrikes: number[] = [];
  const optionNumericValues: number[] = [];
  
  // Portfolio with purchase price that was causing the error
  const portfolio = {
    positions: [
      {
        symbol: "IBIT",
        quantity: 1400,
        purchasePrice: 59.09, // This was causing "59" error
        currentValue: 60.72,
      }
    ]
  };

  // OLD CODE (would fail)
  console.log("=== TESTING OLD VALIDATOR (without fix) ===");
  const allowedOld = new Set<number>([
    currentPrice,
    ...supports.map(s => s.price),
    ...resistances.map(r => r.price),
    ...optionStrikes,
    ...optionNumericValues
  ]);
  
  console.log("Old allowed prices:", [...allowedOld].sort((a, b) => a - b));
  console.log("Purchase price 59.09 allowed?", allowedOld.has(59.09));
  console.log("Rounded price 59 allowed?", [...allowedOld].some(a => Math.abs(a - 59) < a * 0.01));

  // NEW CODE (with fix)
  console.log("\n=== TESTING NEW VALIDATOR (with fix) ===");
  const portfolioPurchasePrices = portfolio?.positions
    ?.map(p => p.purchasePrice)
    .filter((price): price is number => price != null && !isNaN(price)) || [];
  
  const allowedNew = new Set<number>([
    currentPrice,
    ...supports.map(s => s.price),
    ...resistances.map(r => r.price),
    ...optionStrikes,
    ...optionNumericValues,
    ...portfolioPurchasePrices // ← THE FIX
  ]);
  
  console.log("New allowed prices:", [...allowedNew].sort((a, b) => a - b));
  console.log("Purchase price 59.09 allowed?", allowedNew.has(59.09));
  console.log("Rounded price 59 allowed?", [...allowedNew].some(a => Math.abs(a - 59) < a * 0.01));

  // Test the upper limit fix
  console.log("\n=== TESTING UPPER LIMIT FIX ===");
  const maxAllowedPrice = Math.max(...allowedNew, 2000);
  const upperLimit = Math.max(maxAllowedPrice * 1.1, 2000);
  console.log("Max allowed price:", maxAllowedPrice);
  console.log("Upper limit for validation:", upperLimit);
  
  // Simulate AI response with price "59"
  const aiResponse = {
    wheelStrategy: {
      currentPhase: "COVERED_CALL",
      currentPositions: [{
        strike: 59, // AI might round 59.09 to 59
        type: "CALL"
      }]
    }
  };
  
  const jsonString = JSON.stringify(aiResponse);
  const priceLike = /\$?(\d{2,5}(?:\.\d+)?)/g;
  let m;
  const bad: number[] = [];
  
  while ((m = priceLike.exec(jsonString)) !== null) {
    const n = parseFloat(m[1]);
    if (n > 50 && n < upperLimit) {
      const legal = [...allowedNew].some(a => Math.abs(a - n) < a * 0.01);
      if (!legal) bad.push(n);
    }
  }
  
  console.log("\n=== VALIDATION RESULT ===");
  console.log("Invalid prices found:", bad);
  console.log("Would trigger error?", bad.length > 0 ? "YES ❌" : "NO ✅");
}

testValidator();