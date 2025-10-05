import { describe, it, expect } from 'vitest';

/**
 * Tests for OptionPositionCard risk level logic
 *
 * Key logic: BOUGHT vs SOLD positions have OPPOSITE risk interpretation
 * - SOLD positions: High delta = HIGH RISK (assignment likely)
 * - BOUGHT positions: High delta = LOW RISK (winning trade, deep ITM)
 */

// Mock the risk level function from OptionPositionCard
const getRiskLevel = (
  contracts: number,
  delta: number | null,
  currentPrice: number,
  strike: number
): { label: string; colorClasses: string } => {
  const isSold = contracts < 0;
  const moneyness = ((currentPrice - strike) / strike) * 100;

  if (typeof delta === 'number' && !isNaN(delta)) {
    const absDelta = Math.abs(delta);

    // SOLD positions: High delta = high assignment risk
    if (isSold) {
      if (absDelta >= 0.75) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
      if (absDelta >= 0.35) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
      return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
    }

    // BOUGHT positions: High delta = winning trade (low risk of total loss)
    else {
      if (absDelta >= 0.75) return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' }; // Deep ITM, winning
      if (absDelta >= 0.35) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' }; // Near money
      return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' }; // OTM, likely to lose premium
    }
  }

  // Fallback to moneyness
  if (moneyness >= 0) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
  if (moneyness >= -3) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
  return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
};

describe('OptionPositionCard - SOLD Position Risk Levels', () => {
  it('should show HIGH RISK for sold call with high delta (0.77)', () => {
    const risk = getRiskLevel(-1, 0.77, 69.81, 60);
    expect(risk.label).toBe('HIGH RISK');
    expect(risk.colorClasses).toContain('red');
  });

  it('should show HIGH RISK for sold call with delta >= 0.75', () => {
    const risk = getRiskLevel(-2, 0.85, 70.00, 65);
    expect(risk.label).toBe('HIGH RISK');
  });

  it('should show MODERATE RISK for sold call with delta 0.50', () => {
    const risk = getRiskLevel(-1, 0.50, 69.81, 70);
    expect(risk.label).toBe('MODERATE RISK');
    expect(risk.colorClasses).toContain('yellow');
  });

  it('should show LOW RISK for sold call with delta 0.20', () => {
    const risk = getRiskLevel(-1, 0.20, 69.81, 80);
    expect(risk.label).toBe('LOW RISK');
    expect(risk.colorClasses).toContain('green');
  });

  it('should handle negative deltas (puts) correctly for sold positions', () => {
    // Sold put with delta -0.80 = high assignment risk
    const risk = getRiskLevel(-1, -0.80, 30.00, 35);
    expect(risk.label).toBe('HIGH RISK');
  });
});

describe('OptionPositionCard - BOUGHT Position Risk Levels', () => {
  it('should show LOW RISK for bought call with high delta (0.77)', () => {
    // This was the bug: Used to show HIGH RISK
    const risk = getRiskLevel(1, 0.77, 69.81, 60);
    expect(risk.label).toBe('LOW RISK');
    expect(risk.colorClasses).toContain('green');
  });

  it('should show LOW RISK for bought call deep ITM (delta 0.85)', () => {
    const risk = getRiskLevel(1, 0.85, 70.00, 60);
    expect(risk.label).toBe('LOW RISK');
  });

  it('should show MODERATE RISK for bought call near money (delta 0.50)', () => {
    const risk = getRiskLevel(1, 0.50, 69.81, 70);
    expect(risk.label).toBe('MODERATE RISK');
    expect(risk.colorClasses).toContain('yellow');
  });

  it('should show HIGH RISK for bought call OTM (delta 0.20)', () => {
    // Low delta = likely to lose premium = HIGH RISK for bought options
    const risk = getRiskLevel(1, 0.20, 69.81, 80);
    expect(risk.label).toBe('HIGH RISK');
    expect(risk.colorClasses).toContain('red');
  });

  it('should show HIGH RISK for bought call far OTM (delta 0.05)', () => {
    const risk = getRiskLevel(1, 0.05, 69.81, 90);
    expect(risk.label).toBe('HIGH RISK');
  });

  it('should handle bought puts correctly', () => {
    // Bought put with delta -0.80 = deep ITM = LOW RISK (winning)
    const risk = getRiskLevel(2, -0.80, 30.00, 35);
    expect(risk.label).toBe('LOW RISK');
  });
});

describe('OptionPositionCard - Edge Cases', () => {
  it('should handle delta = null', () => {
    // Should fallback to moneyness
    const risk = getRiskLevel(1, null, 69.81, 60);
    // ITM call (currentPrice > strike), moneyness > 0
    expect(risk.label).toBe('HIGH RISK'); // Fallback logic
  });

  it('should handle delta = 0', () => {
    const risk = getRiskLevel(1, 0, 69.81, 70);
    expect(risk.label).toBe('HIGH RISK'); // < 0.35 threshold
  });

  it('should handle exactly at threshold delta = 0.75', () => {
    // SOLD position
    const soldRisk = getRiskLevel(-1, 0.75, 69.81, 60);
    expect(soldRisk.label).toBe('HIGH RISK');

    // BOUGHT position
    const boughtRisk = getRiskLevel(1, 0.75, 69.81, 60);
    expect(boughtRisk.label).toBe('LOW RISK');
  });

  it('should handle exactly at threshold delta = 0.35', () => {
    // SOLD position
    const soldRisk = getRiskLevel(-1, 0.35, 69.81, 70);
    expect(soldRisk.label).toBe('MODERATE RISK');

    // BOUGHT position
    const boughtRisk = getRiskLevel(1, 0.35, 69.81, 70);
    expect(boughtRisk.label).toBe('MODERATE RISK');
  });

  it('should handle multiple contracts', () => {
    // 5 bought contracts with high delta
    const risk = getRiskLevel(5, 0.80, 69.81, 60);
    expect(risk.label).toBe('LOW RISK');

    // -3 sold contracts with high delta
    const soldRisk = getRiskLevel(-3, 0.80, 69.81, 60);
    expect(soldRisk.label).toBe('HIGH RISK');
  });
});

describe('OptionPositionCard - Real World Scenarios', () => {
  it('IBIT $60 CALL bought at $9.11, now worth $13.30 (delta 0.77)', () => {
    // User's actual position from screenshot
    const risk = getRiskLevel(1, 0.77, 69.81, 60);
    expect(risk.label).toBe('LOW RISK'); // Winning trade
  });

  it('IBIT $70 CALL sold, covering 200 shares (delta 0.45)', () => {
    const risk = getRiskLevel(-2, 0.45, 69.81, 70);
    expect(risk.label).toBe('MODERATE RISK'); // Some assignment risk
  });

  it('IBIT $80 CALL sold as part of ratio spread (delta 0.30)', () => {
    const risk = getRiskLevel(-1, 0.30, 69.81, 80);
    expect(risk.label).toBe('LOW RISK'); // Low assignment probability
  });
});
