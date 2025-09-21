#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Deno smoke test for integrated-analysis-v3
 * Tests the Eyes module (Phase 1) with sample portfolio data
 */

// Sample test data based on ETHA portfolio screenshot
const testPortfolioData = {
  positions: [
    {
      symbol: "ETHA",
      quantity: 800,
      purchasePrice: 34.58,
      currentPrice: 34.73,
      marketValue: 27784,
      percentChange: "+0.43%",
      gainLoss: 119.5
    }
  ],
  cashBalance: 7209.72,
  metadata: {
    optionPositions: [
      {
        symbol: "ETHA",
        optionType: "CALL",
        strike: 36,
        expiry: "Oct-17-2025",
        contracts: -1,
        position: "SHORT",
        premiumCollected: 261.33,
        currentValue: 209,
        daysToExpiry: 28
      },
      {
        symbol: "ETHA",
        optionType: "PUT",
        strike: 30,
        expiry: "Oct-17-2025",
        contracts: 5,
        position: "LONG",
        premiumCollected: 503.37,
        currentValue: 355
      },
      {
        symbol: "ETHA",
        optionType: "PUT",
        strike: 33,
        expiry: "Oct-17-2025",
        contracts: -5,
        position: "SHORT",
        premiumCollected: 1046.63,
        currentValue: 825
      },
      {
        symbol: "ETHA",
        optionType: "CALL",
        strike: 35,
        expiry: "Oct-24-2025",
        contracts: -1,
        position: "SHORT",
        premiumCollected: 299.33
      }
    ]
  }
};

// Import functions from the edge function (simplified for testing)
function toYYYYMMDD(dateStr: string): string {
  if (!dateStr) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const monthMatch = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
  if (monthMatch) {
    const monthMap: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = monthMap[monthMatch[1]];
    if (month) {
      return `${monthMatch[3]}-${month}-${monthMatch[2].padStart(2, '0')}`;
    }
  }

  return dateStr;
}

function calculateDaysToExpiry(expiryStr: string): number {
  if (!expiryStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

function calculateRisk(
  type: 'CALL' | 'PUT',
  strike: number,
  currentPrice: number
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const moneyness = type === 'CALL'
    ? (currentPrice - strike) / strike
    : (strike - currentPrice) / strike;

  if (moneyness >= 0) return 'HIGH';
  if (moneyness >= -0.03) return 'MEDIUM';
  return 'LOW';
}

// Process the test data
function processPortfolio(portfolioData: any, ticker: string, currentPrice: number) {
  const tickerUpper = ticker.toUpperCase();

  // Extract stock positions
  const stockPositions = (portfolioData.positions || [])
    .filter((pos: any) => pos.symbol?.toUpperCase() === tickerUpper);

  const shareCount = stockPositions.reduce(
    (sum: number, pos: any) => sum + (pos.quantity || 0),
    0
  );

  // Process option positions
  const optionPositions = (portfolioData.metadata?.optionPositions || [])
    .map((opt: any) => {
      const type = (opt.optionType || opt.type || 'CALL').toUpperCase() as 'CALL' | 'PUT';
      const strike = Number(opt.strike) || 0;
      const expiry = toYYYYMMDD(opt.expiry || '');
      const contracts = Number(opt.contracts) || 0;
      const daysToExpiry = calculateDaysToExpiry(expiry);

      let premium = Number(opt.premium || opt.premiumCollected || 0);
      if (premium > 0 && premium < 100) {
        premium = premium * 100 * Math.abs(contracts);
      }

      return {
        symbol: tickerUpper,
        type,
        strike,
        expiry,
        contracts,
        position: contracts < 0 ? 'SHORT' : 'LONG',
        premium,
        premiumCollected: premium,
        currentValue: opt.currentValue || null,
        delta: null,
        gamma: null,
        theta: null,
        vega: null,
        iv: null,
        daysToExpiry,
        term: daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED',
        assignmentProb: null,
        risk: calculateRisk(type, strike, currentPrice),
        wheelPnl: premium,
        markPnl: 0
      };
    });

  // Calculate totals
  const totalPremiumCollected = optionPositions.reduce(
    (sum: number, pos: any) => sum + (pos.premium || 0),
    0
  );

  // Count positions by type
  const countsByLabel: Record<string, number> = {};
  optionPositions.forEach((pos: any) => {
    const label = `${pos.position === 'SHORT' ? 'SOLD' : 'BOUGHT'} ${pos.type}`;
    countsByLabel[label] = (countsByLabel[label] || 0) + 1;
  });

  return {
    ticker: tickerUpper,
    currentPrice,
    shareCount,
    totalPremiumCollected,
    strategies: [], // Phase 2 will add strategy detection
    positions: optionPositions,
    countsByLabel,
    wheelPhase: shareCount > 0 ? 'COVERED_CALL' : 'CASH_SECURED_PUT',
    cashBalance: portfolioData.cashBalance || 0
  };
}

// Run the test
console.log("🧪 Running Deterministic Analysis Smoke Test");
console.log("=".repeat(50));

const result = processPortfolio(testPortfolioData, "ETHA", 34.73);

console.log("\n📊 Analysis Results:");
console.log(`Ticker: ${result.ticker}`);
console.log(`Current Price: $${result.currentPrice}`);
console.log(`Share Count: ${result.shareCount}`);
console.log(`Total Premium Collected: $${result.totalPremiumCollected.toFixed(2)}`);
console.log(`Wheel Phase: ${result.wheelPhase}`);
console.log(`Cash Balance: $${result.cashBalance.toFixed(2)}`);

console.log("\n📈 Position Counts:");
Object.entries(result.countsByLabel).forEach(([label, count]) => {
  console.log(`  ${label}: ${count}`);
});

console.log("\n🎯 Option Positions:");
result.positions.forEach((pos: any, idx: number) => {
  console.log(`\n  Position ${idx + 1}:`);
  console.log(`    ${pos.position} ${Math.abs(pos.contracts)} × $${pos.strike} ${pos.type}`);
  console.log(`    Expiry: ${pos.expiry} (${pos.daysToExpiry} days)`);
  console.log(`    Premium: $${pos.premium.toFixed(2)}`);
  console.log(`    Risk: ${pos.risk}`);
  console.log(`    Term: ${pos.term}`);
});

// Validate critical fields
console.log("\n✅ Validation:");
let testsPassed = 0;
let testsFailed = 0;

// Test 1: Share count
if (result.shareCount === 800) {
  console.log("  ✅ Share count correct (800)");
  testsPassed++;
} else {
  console.log(`  ❌ Share count incorrect (expected 800, got ${result.shareCount})`);
  testsFailed++;
}

// Test 2: Position count
if (result.positions.length === 4) {
  console.log("  ✅ Position count correct (4)");
  testsPassed++;
} else {
  console.log(`  ❌ Position count incorrect (expected 4, got ${result.positions.length})`);
  testsFailed++;
}

// Test 3: SOLD CALL detection
const soldCalls = result.positions.filter((p: any) => p.position === 'SHORT' && p.type === 'CALL');
if (soldCalls.length === 2) {
  console.log("  ✅ SOLD CALL detection correct (2)");
  testsPassed++;
} else {
  console.log(`  ❌ SOLD CALL detection incorrect (expected 2, got ${soldCalls.length})`);
  testsFailed++;
}

// Test 4: Date normalization
const firstPosition = result.positions[0];
if (firstPosition && /^\d{4}-\d{2}-\d{2}$/.test(firstPosition.expiry)) {
  console.log("  ✅ Date normalization correct (YYYY-MM-DD)");
  testsPassed++;
} else {
  console.log(`  ❌ Date normalization failed (got ${firstPosition?.expiry})`);
  testsFailed++;
}

// Test 5: Risk calculation
const hasRiskLevels = result.positions.every((p: any) =>
  ['LOW', 'MEDIUM', 'HIGH'].includes(p.risk)
);
if (hasRiskLevels) {
  console.log("  ✅ Risk levels assigned correctly");
  testsPassed++;
} else {
  console.log("  ❌ Risk levels missing or incorrect");
  testsFailed++;
}

// Final summary
console.log("\n" + "=".repeat(50));
console.log("📊 TEST SUMMARY");
console.log("=".repeat(50));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log("\n🎉 All tests passed! Ready for Phase 1 deployment.");

  // Output the JSON for reference
  console.log("\n📄 Output JSON:");
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("\n⚠️  Some tests failed. Please review and fix before deployment.");
}

Deno.exit(testsFailed > 0 ? 1 : 0);