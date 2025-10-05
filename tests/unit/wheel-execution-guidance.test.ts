import { describe, it, expect } from 'vitest';

/**
 * Tests for wheel execution guidance logic in StockAnalysisV2
 *
 * Key logic: BOUGHT vs SOLD positions get different guidance
 * - SOLD positions: Focus on assignment risk
 * - BOUGHT positions: Focus on profit/loss management
 */

interface PositionGuidance {
  action: string;
  watching: string;
  trigger: string;
  riskLevel: string;
}

// Mock the guidance function from StockAnalysisV2
const generatePositionGuidance = (
  contracts: number,
  delta: number,
  isCall: boolean,
  daysToExpiry: number,
  currentPrice: number,
  strike: number,
  theta: number,
  tickerSymbol: string,
  expiry: string
): PositionGuidance => {
  const isSold = contracts < 0;
  const moneyness = ((currentPrice - strike) / strike) * 100;

  let action = '';
  let watching = '';
  let trigger = '';
  let riskLevel = 'low';

  // BOUGHT POSITIONS: You own the option, no assignment risk
  if (!isSold) {
    const intrinsicValue = isCall
      ? Math.max(0, currentPrice - strike)
      : Math.max(0, strike - currentPrice);
    const isProfitable = intrinsicValue > 0;

    if (daysToExpiry <= 5) {
      if (isProfitable) {
        action = `Sell to close or exercise before ${expiry}`;
        watching = `In-the-money by $${intrinsicValue.toFixed(2)}. Don't let it expire!`;
        trigger = `Sell before market close on ${expiry}`;
        riskLevel = 'medium';
      } else {
        action = `Let it expire worthless. Loss limited to premium paid`;
        watching = `Out-of-the-money. Max loss = premium paid`;
        riskLevel = 'high';
      }
    } else if (Math.abs(delta) > 0.70) {
      action = `Hold for more profit or take gains now`;
      watching = `Strong position! Delta: ${(Math.abs(delta) * 100).toFixed(0)}%. Gaining $${Math.abs(theta).toFixed(2)}/day`;
      trigger = `Consider taking profit if ${tickerSymbol} ${isCall ? 'rises above' : 'falls below'} $${(strike * (isCall ? 1.15 : 0.85)).toFixed(2)}`;
      riskLevel = 'low';
    } else if (Math.abs(delta) > 0.30) {
      action = `Hold and monitor. Position has potential`;
      watching = `Delta: ${(Math.abs(delta) * 100).toFixed(0)}%. Time value remaining`;
      trigger = `Reassess if ${tickerSymbol} moves ${isCall ? 'below' : 'above'} $${strike.toFixed(2)}`;
      riskLevel = 'medium';
    } else {
      action = `Consider cutting losses if no recovery expected`;
      watching = `Out-of-the-money. Delta: ${(Math.abs(delta) * 100).toFixed(0)}%. Losing $${Math.abs(theta).toFixed(2)}/day`;
      trigger = `Close position if ${tickerSymbol} moves further ${isCall ? 'below' : 'above'} $${(strike * (isCall ? 0.95 : 1.05)).toFixed(2)}`;
      riskLevel = 'high';
    }
  }
  // SOLD POSITIONS: Assignment risk based on delta
  else {
    if (daysToExpiry <= 5) {
      if (isCall && moneyness > 0) {
        action = `Do nothing. Let it be called away on ${expiry} at $${strike}`;
        watching = `Stock will be sold at $${strike} if price stays above strike`;
        riskLevel = 'medium';
      } else if (isCall && moneyness < 0) {
        action = `Let it expire worthless on ${expiry}. Keep your shares and the premium`;
        watching = `Option will expire worthless if ${tickerSymbol} stays below $${strike}`;
        riskLevel = 'low';
      }
    } else if (Math.abs(delta) > 0.90) {
      if (isCall) {
        action = `Consider rolling if you want to keep shares. Otherwise, prepare for assignment`;
        trigger = `Roll ONE at a time when ${tickerSymbol} drops below $${(strike * 0.98).toFixed(2)}`;
        watching = `Very likely to be assigned. Delta: ${(Math.abs(delta) * 100).toFixed(0)}%`;
      }
      riskLevel = 'high';
    } else if (Math.abs(delta) > 0.70) {
      action = `Hold for now. Monitor daily`;
      trigger = `Consider action if ${tickerSymbol} ${isCall ? 'rises above' : 'falls below'} $${(strike * (isCall ? 1.05 : 0.95)).toFixed(2)}`;
      watching = `Assignment probability: ${(Math.abs(delta) * 100).toFixed(0)}%`;
      riskLevel = 'high';
    } else if (Math.abs(delta) > 0.30) {
      action = `Hold and collect theta decay`;
      watching = `Earning $${Math.abs(theta).toFixed(2)}/day from time decay`;
      trigger = `Watch if ${tickerSymbol} moves ${isCall ? 'above' : 'below'} $${(strike * (isCall ? 0.98 : 1.02)).toFixed(2)}`;
      riskLevel = 'medium';
    } else {
      action = `Hold to expiration. Very safe`;
      watching = `Low assignment risk (${(Math.abs(delta) * 100).toFixed(0)}%). Earning $${Math.abs(theta).toFixed(2)}/day`;
      riskLevel = 'low';
    }
  }

  return { action, watching, trigger, riskLevel };
};

describe('Wheel Execution Guidance - BOUGHT Positions', () => {
  it('should give profit-taking guidance for bought call with high delta', () => {
    const guidance = generatePositionGuidance(
      1, // BOUGHT
      0.77,
      true, // CALL
      103,
      69.81,
      60,
      0.03,
      'IBIT',
      '2026-01-16'
    );

    expect(guidance.action).toContain('Hold for more profit');
    expect(guidance.watching).toContain('Strong position');
    expect(guidance.trigger).toContain('rises above'); // Correct direction for calls
    expect(guidance.riskLevel).toBe('low');
  });

  it('should warn about expiring ITM bought call', () => {
    const guidance = generatePositionGuidance(
      1,
      0.80,
      true,
      3, // Expiring soon
      70.00,
      60,
      0.05,
      'IBIT',
      '2025-10-08'
    );

    expect(guidance.action).toContain('Sell to close or exercise');
    expect(guidance.watching).toContain('In-the-money');
    expect(guidance.trigger).toContain('Sell before market close');
    expect(guidance.riskLevel).toBe('medium');
  });

  it('should suggest cutting losses for OTM bought call', () => {
    const guidance = generatePositionGuidance(
      1,
      0.15, // Low delta
      true,
      50,
      69.81,
      85,
      -0.05,
      'IBIT',
      '2025-12-01'
    );

    expect(guidance.action).toContain('Consider cutting losses');
    expect(guidance.watching).toContain('Out-of-the-money');
    expect(guidance.riskLevel).toBe('high');
  });

  it('should handle neutral bought position', () => {
    const guidance = generatePositionGuidance(
      2,
      0.50,
      true,
      60,
      69.81,
      70,
      -0.02,
      'IBIT',
      '2025-12-05'
    );

    expect(guidance.action).toContain('Hold and monitor');
    expect(guidance.watching).toContain('Delta: 50%');
    expect(guidance.riskLevel).toBe('medium');
  });
});

describe('Wheel Execution Guidance - SOLD Positions', () => {
  it('should give assignment warning for sold call with high delta', () => {
    const guidance = generatePositionGuidance(
      -2, // SOLD
      0.77,
      true,
      47,
      69.81,
      70,
      -0.03,
      'IBIT',
      '2025-11-21'
    );

    expect(guidance.action).toContain('Hold for now. Monitor daily');
    expect(guidance.watching).toContain('Assignment probability: 77%');
    expect(guidance.trigger).toContain('rises above'); // Price moving up increases assignment risk
    expect(guidance.riskLevel).toBe('high');
  });

  it('should recommend theta collection for OTM sold call', () => {
    const guidance = generatePositionGuidance(
      -1,
      0.20,
      true,
      45,
      69.81,
      80,
      -0.04,
      'IBIT',
      '2025-11-19'
    );

    expect(guidance.action).toContain('Hold to expiration. Very safe');
    expect(guidance.watching).toContain('Low assignment risk');
    expect(guidance.riskLevel).toBe('low');
  });

  it('should handle expiring ITM sold call', () => {
    const guidance = generatePositionGuidance(
      -2,
      0.85,
      true,
      2, // Expiring soon
      71.00,
      70,
      -0.10,
      'IBIT',
      '2025-10-07'
    );

    expect(guidance.action).toContain('Let it be called away');
    expect(guidance.watching).toContain('Stock will be sold at $70');
    expect(guidance.riskLevel).toBe('medium');
  });

  it('should recommend rolling for very deep ITM sold call', () => {
    const guidance = generatePositionGuidance(
      -1,
      0.95,
      true,
      60,
      75.00,
      65,
      -0.05,
      'IBIT',
      '2025-12-05'
    );

    expect(guidance.action).toContain('Consider rolling');
    expect(guidance.watching).toContain('Very likely to be assigned');
    expect(guidance.riskLevel).toBe('high');
  });
});

describe('Wheel Execution Guidance - Critical Bug Fixes', () => {
  it('should NOT show assignment probability for bought calls', () => {
    const guidance = generatePositionGuidance(1, 0.77, true, 103, 69.81, 60, 0.03, 'IBIT', '2026-01-16');

    expect(guidance.watching).not.toContain('Assignment probability');
    expect(guidance.watching).toContain('Strong position'); // BOUGHT calls don't get assigned
  });

  it('should show correct trigger direction for bought calls', () => {
    const guidance = generatePositionGuidance(1, 0.77, true, 103, 69.81, 60, 0.03, 'IBIT', '2026-01-16');

    // Bought calls: You WANT price to rise, so trigger is "if rises above X"
    expect(guidance.trigger).toContain('rises above');
    expect(guidance.trigger).not.toContain('falls below');
  });

  it('should show correct trigger direction for sold calls', () => {
    const guidance = generatePositionGuidance(-1, 0.77, true, 47, 69.81, 70, -0.03, 'IBIT', '2025-11-21');

    // Sold calls: You DON'T want price to rise (assignment risk), so trigger is "if rises above X"
    expect(guidance.trigger).toContain('rises above');
  });

  it('should have opposite risk levels for same delta but different direction', () => {
    // BOUGHT call with delta 0.77
    const boughtGuidance = generatePositionGuidance(1, 0.77, true, 103, 69.81, 60, 0.03, 'IBIT', '2026-01-16');
    expect(boughtGuidance.riskLevel).toBe('low'); // Winning trade

    // SOLD call with delta 0.77
    const soldGuidance = generatePositionGuidance(-1, 0.77, true, 47, 69.81, 70, -0.03, 'IBIT', '2025-11-21');
    expect(soldGuidance.riskLevel).toBe('high'); // High assignment risk
  });
});

describe('Wheel Execution Guidance - Real World Scenarios', () => {
  it('User IBIT $60 bought call: Delta 0.77, +$420 profit', () => {
    const guidance = generatePositionGuidance(1, 0.77, true, 103, 69.81, 60, 0.03, 'IBIT', '2026-01-16');

    expect(guidance.action).toBe('Hold for more profit or take gains now');
    expect(guidance.watching).toContain('Strong position! Delta: 77%');
    expect(guidance.trigger).toContain('Consider taking profit if IBIT rises above $69'); // 60 * 1.15 = 69
    expect(guidance.riskLevel).toBe('low');
  });

  it('User IBIT $70 sold call: Delta 0.45, covering 200 shares', () => {
    const guidance = generatePositionGuidance(-2, 0.45, true, 47, 69.81, 70, -0.03, 'IBIT', '2025-11-21');

    expect(guidance.action).toBe('Hold and collect theta decay');
    expect(guidance.watching).toContain('Earning $0.03/day from time decay');
    expect(guidance.trigger).toContain('Watch if IBIT moves above $68'); // 70 * 0.98 = 68.6
    expect(guidance.riskLevel).toBe('medium');
  });

  it('User IBIT $80 sold call (ratio spread short leg): Delta 0.30', () => {
    const guidance = generatePositionGuidance(-1, 0.30, true, 103, 69.81, 80, -0.02, 'IBIT', '2026-01-16');

    expect(guidance.action).toBe('Hold to expiration. Very safe');
    expect(guidance.watching).toContain('Low assignment risk (30%)');
    expect(guidance.riskLevel).toBe('low');
  });
});
