import { describe, it, expect } from 'vitest';
import { detectStrategies } from '../../src/services/deterministic/calculator';
import type { PositionDet } from '../../src/services/deterministic/types';

const basePosition = (overrides: Partial<PositionDet>): PositionDet => ({
  symbol: 'ETHA',
  type: 'CALL',
  strike: 0,
  expiry: '2025-12-19',
  contracts: 0,
  premium: 0,
  premiumCollected: 0,
  currentValue: 0,
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  iv: null,
  daysToExpiry: 90,
  term: 'SHORT_DATED',
  assignmentProb: null,
  risk: 'LOW',
  wheelPnl: 0,
  markPnl: 0,
  ...overrides,
});

describe('detectStrategies', () => {
  it('detects covered calls, bull call spreads, and cash secured puts', () => {
    const positions: PositionDet[] = [
      basePosition({
        symbol: 'ETHA',
        type: 'CALL',
        strike: 40,
        contracts: -1,
        premium: 304.33,
        expiry: '2025-12-19',
      }),
      basePosition({
        symbol: 'ETHA',
        type: 'CALL',
        strike: 34,
        contracts: 1,
        premium: 575.67,
        expiry: '2025-12-19',
      }),
      basePosition({
        symbol: 'ETHA',
        type: 'PUT',
        strike: 30,
        contracts: -1,
        premium: 503.37,
        expiry: '2025-10-17',
        risk: 'LOW',
      }),
    ];

    const { strategies, wheelPhase } = detectStrategies({
      positions,
      shareCount: 100,
      cashBalance: 10000,
      currentPrice: 34.73,
    });

    expect(wheelPhase).toBe('COVERED_CALL');
    expect(strategies.length).toBeGreaterThanOrEqual(3);

    const coveredCall = strategies.find((s) => s.label === 'Covered Call');
    expect(coveredCall).toBeTruthy();
    expect(coveredCall?.netPremium).toBeCloseTo(304.33, 2);

    const bullSpread = strategies.find((s) => s.label === 'Bull Call Spread');
    expect(bullSpread).toBeTruthy();
    expect(bullSpread?.netPremium).toBeCloseTo(-271.34, 2);
    expect(bullSpread?.maxProfit).toBeCloseTo(328.66, 2);
    expect(bullSpread?.maxLoss).toBeCloseTo(271.34, 2);

    const cashPut = strategies.find((s) => s.label === 'Cash Secured Put');
    expect(cashPut).toBeTruthy();
    expect(cashPut?.netPremium).toBeCloseTo(503.37, 2);
    expect(cashPut?.maxLoss).toBeCloseTo(2496.63, 2);
  });

  it('detects bull put spreads (short higher strike, long lower strike)', () => {
    const positions: PositionDet[] = [
      basePosition({
        type: 'PUT',
        strike: 33,
        contracts: -1,
        premium: 209.33,
        expiry: '2025-10-17',
      }),
      basePosition({
        type: 'PUT',
        strike: 30,
        contracts: 1,
        premium: 100.67,
        expiry: '2025-10-17',
      }),
    ];

    const { strategies } = detectStrategies({
      positions,
      shareCount: 0,
      cashBalance: 0,
      currentPrice: 34.73,
    });

    const spread = strategies.find((s) => s.label === 'Bull Put Spread');
    expect(spread).toBeTruthy();
    // Net credit = 209.33 - 100.67 = 108.66
    expect(spread?.netPremium).toBeCloseTo(108.66, 2);
    // Width = (33-30)*100 = 300 → MaxLoss = 300 - 108.66 = 191.34
    expect(spread?.maxLoss).toBeCloseTo(191.34, 2);
    // Credit strategy → MaxProfit = credit
    expect(spread?.maxProfit).toBeCloseTo(108.66, 2);
    expect(spread?.legCount).toBe(2);
    expect(spread?.riskProfile).toBe('defined');
  });
});
