import { detectStrategies } from '../../src/services/deterministic/calculator';
import type { PositionDet } from '../../src/services/deterministic/types';

// Test IBIT portfolio from screenshot (Jan-16-2026 positions only)
const ibitPositions: PositionDet[] = [
  {
    symbol: 'IBIT',
    type: 'CALL',
    strike: 60,
    expiry: '2026-01-16',
    contracts: 1, // LONG
    premium: 910.67,
    currentValue: 1330,
    profitLoss: 419.33,
    daysToExpiry: 103,
    term: 'SHORT_DATED',
    position: 'LONG',
  },
  {
    symbol: 'IBIT',
    type: 'CALL',
    strike: 70,
    expiry: '2026-01-16',
    contracts: 1, // LONG
    premium: 757.67,
    currentValue: 730,
    profitLoss: -27.67,
    daysToExpiry: 103,
    term: 'SHORT_DATED',
    position: 'LONG',
  },
  {
    symbol: 'IBIT',
    type: 'CALL',
    strike: 80,
    expiry: '2026-01-16',
    contracts: -1, // SHORT
    premiumCollected: 389.33,
    currentValue: 380,
    profitLoss: 9.33,
    daysToExpiry: 103,
    term: 'SHORT_DATED',
    position: 'SHORT',
  },
];

const result = detectStrategies({
  positions: ibitPositions,
  shareCount: 400,
  cashBalance: 3383.3,
  currentPrice: 69.81,
  shareBasis: 63.07,
});

console.log('=== IBIT RATIO SPREAD DETECTION TEST ===\n');
console.log('Input Positions:');
console.log('- LONG 1 × $60 CALL (2026-01-16)');
console.log('- LONG 1 × $70 CALL (2026-01-16)');
console.log('- SHORT 1 × $80 CALL (2026-01-16)\n');

console.log('Detected Strategies:');
result.strategies.forEach((strategy, idx) => {
  console.log(`\n${idx + 1}. ${strategy.label}`);
  console.log(`   ID: ${strategy.id}`);
  console.log(`   Legs: ${strategy.legCount}`);
  console.log(`   Net Premium: $${strategy.netPremium?.toFixed(2) || 'N/A'}`);
  console.log(`   Max Loss: $${strategy.maxLoss?.toFixed(2) || 'N/A'}`);
  console.log(`   Risk Profile: ${strategy.riskProfile}`);
  console.log(`   Tags: ${strategy.tags?.join(', ') || 'None'}`);
  console.log(`   Components:`);
  strategy.components?.forEach(comp => console.log(`     - ${comp}`));
  console.log(`   Description: ${strategy.description || 'N/A'}`);
});

console.log('\n=== EXPECTED RESULT ===');
console.log('Should detect: "2:1 Long Call Ratio Spread"');
console.log('Should NOT detect: "Bull Call Spread"');
console.log('Should show: Unlimited upside above $80');

// Validation
const hasRatioSpread = result.strategies.some(s => s.label.includes('Ratio Spread'));
const hasBullSpread = result.strategies.some(s => s.label === 'Bull Call Spread');

console.log('\n=== TEST RESULT ===');
console.log(`✓ Ratio Spread Detected: ${hasRatioSpread ? '✅ PASS' : '❌ FAIL'}`);
console.log(`✓ No Bull Spread: ${!hasBullSpread ? '✅ PASS' : '❌ FAIL'}`);
console.log(`\nOverall: ${hasRatioSpread && !hasBullSpread ? '✅ ALL TESTS PASS' : '❌ TESTS FAILED'}`);
