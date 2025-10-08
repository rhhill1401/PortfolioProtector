/**
 * Unit tests for deterministic position extraction and normalization
 * Tests Phase 1: Eyes Module
 */

import { describe, it, expect } from 'vitest';
import type { OptionPositionRaw, PositionDet, PortfolioData } from '../../src/services/deterministic/types';
import { parseContractCount } from '../../supabase/functions/portfolio-vision/utils';

// Helper functions (replicated from edge function for testing)
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

function normalizePosition(
  opt: OptionPositionRaw,
  currentPrice: number,
  ticker: string
): PositionDet {
  const symbol = (opt.symbol || ticker).toUpperCase();
  const type = (opt.optionType || opt.type || 'CALL').toUpperCase() as 'CALL' | 'PUT';
  const strike = Number(opt.strike) || 0;
  const expiry = toYYYYMMDD(opt.expiry || '');
  const contracts = parseContractCount(opt.contracts) ?? 0;
  const daysToExpiry = calculateDaysToExpiry(expiry);
  const term = daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED';

  let premium = Number(opt.premium || opt.premiumCollected || 0);
  if (premium > 0 && premium < 100) {
    premium = premium * 100 * Math.abs(contracts);
  }

  return {
    symbol,
    type,
    strike,
    expiry,
    contracts,
    premium,
    premiumCollected: premium,
    currentValue: opt.currentValue || null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    iv: null,
    daysToExpiry,
    term,
    assignmentProb: null,
    risk: calculateRisk(type, strike, currentPrice),
    wheelPnl: premium,
    markPnl: 0
  };
}

describe('Position Extraction and Normalization', () => {
  const currentPrice = 34.73;
  const ticker = 'ETHA';

  describe('Date Normalization', () => {
    it('should convert MMM-DD-YYYY to YYYY-MM-DD', () => {
      expect(toYYYYMMDD('Oct-17-2025')).toBe('2025-10-17');
      expect(toYYYYMMDD('Jan-01-2026')).toBe('2026-01-01');
      expect(toYYYYMMDD('Dec-31-2025')).toBe('2025-12-31');
    });

    it('should preserve already normalized dates', () => {
      expect(toYYYYMMDD('2025-10-17')).toBe('2025-10-17');
      expect(toYYYYMMDD('2026-01-01')).toBe('2026-01-01');
    });

    it('should handle invalid dates gracefully', () => {
      expect(toYYYYMMDD('')).toBe('');
      expect(toYYYYMMDD('invalid')).toBe('invalid');
    });
  });

  describe('Days to Expiry Calculation', () => {
    it('should calculate days correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      const days = calculateDaysToExpiry(dateStr);
      expect(days).toBeGreaterThanOrEqual(29);
      // Allow a one-day tolerance because system clock differences can push
      // the computed value up by a day when the time component crosses
      // midnight in UTC.
      expect(days).toBeLessThanOrEqual(31);
    });

    it('should return 0 for past dates', () => {
      expect(calculateDaysToExpiry('2020-01-01')).toBe(0);
    });

    it('should handle empty dates', () => {
      expect(calculateDaysToExpiry('')).toBe(0);
    });
  });

  describe('Risk Level Calculation', () => {
    it('should classify CALL risk based on moneyness', () => {
      expect(calculateRisk('CALL', 30, 35)).toBe('HIGH');  // ITM
      expect(calculateRisk('CALL', 35, 34)).toBe('MEDIUM'); // Near ATM
      expect(calculateRisk('CALL', 40, 34)).toBe('LOW');   // OTM
    });

    it('should classify PUT risk based on moneyness', () => {
      expect(calculateRisk('PUT', 40, 35)).toBe('HIGH');   // ITM
      expect(calculateRisk('PUT', 35, 34)).toBe('HIGH');   // Near ATM (slightly ITM)
      expect(calculateRisk('PUT', 30, 34)).toBe('LOW');    // OTM
    });
  });

  describe('Position Normalization', () => {
    it('should extract SOLD CALL correctly', () => {
      const rawPosition: OptionPositionRaw = {
        symbol: 'ETHA',
        optionType: 'CALL',
        strike: 36,
        expiry: 'Oct-17-2025',
        contracts: -1,
        position: 'SHORT',
        premiumCollected: 261.33,
        currentValue: 209
      };

      const normalized = normalizePosition(rawPosition, currentPrice, ticker);

      expect(normalized.symbol).toBe('ETHA');
      expect(normalized.type).toBe('CALL');
      expect(normalized.strike).toBe(36);
      expect(normalized.expiry).toBe('2025-10-17');
      expect(normalized.contracts).toBe(-1);
      expect(normalized.premium).toBe(261.33);
      expect(normalized.term).toBe('SHORT_DATED');
      expect(normalized.risk).toBe('LOW'); // OTM call has low risk
    });

    it('should strip contract suffix markers while keeping the sign', () => {
      const rawPosition: OptionPositionRaw = {
        symbol: 'ETHA',
        optionType: 'CALL',
        strike: 34,
        expiry: 'Dec-19-2025',
        contracts: '-5 M',
        position: 'SHORT',
        premiumCollected: 515,
      };

      const normalized = normalizePosition(rawPosition, currentPrice, ticker);
      expect(normalized.contracts).toBe(-5);
    });

    it('should extract BOUGHT PUT correctly', () => {
      const rawPosition: OptionPositionRaw = {
        symbol: 'ETHA',
        type: 'PUT',  // Using 'type' instead of 'optionType'
        strike: 30,
        expiry: 'Oct-17-2025',
        contracts: 5,
        position: 'LONG',
        premium: 5.03,  // Per share premium
        currentValue: 355
      };

      const normalized = normalizePosition(rawPosition, currentPrice, ticker);

      expect(normalized.symbol).toBe('ETHA');
      expect(normalized.type).toBe('PUT');
      expect(normalized.strike).toBe(30);
      expect(normalized.contracts).toBe(5);
      expect(normalized.premium).toBe(2515);  // 5.03 * 100 * 5
      expect(normalized.risk).toBe('LOW');
    });

    it('should handle missing fields gracefully', () => {
      const rawPosition: OptionPositionRaw = {
        strike: 35,
        contracts: -1
      };

      const normalized = normalizePosition(rawPosition, currentPrice, ticker);

      expect(normalized.symbol).toBe('ETHA');
      expect(normalized.type).toBe('CALL');  // Default
      expect(normalized.strike).toBe(35);
      expect(normalized.contracts).toBe(-1);
      expect(normalized.premium).toBe(0);
      expect(normalized.currentValue).toBeNull();
    });

    it('should normalize premium correctly', () => {
      const testCases = [
        { input: 2.50, contracts: 1, expected: 250 },     // Per share to total
        { input: 250, contracts: 1, expected: 250 },      // Already total
        { input: 2.50, contracts: -2, expected: 500 },    // Multiple contracts
        { input: 0, contracts: 1, expected: 0 },          // Zero premium
      ];

      testCases.forEach(({ input, contracts, expected }) => {
        const rawPosition: OptionPositionRaw = {
          strike: 35,
          contracts,
          premium: input
        };

        const normalized = normalizePosition(rawPosition, currentPrice, ticker);
        expect(normalized.premium).toBe(expected);
      });
    });
  });

  describe('Complete Portfolio Processing', () => {
    it('should process ETHA portfolio correctly', () => {
      const portfolioData: PortfolioData = {
        positions: [
          {
            symbol: 'ETHA',
            quantity: 800,
            purchasePrice: 34.58
          }
        ],
        cashBalance: 7209.72,
        metadata: {
          optionPositions: [
            {
              symbol: 'ETHA',
              optionType: 'CALL',
              strike: 36,
              expiry: 'Oct-17-2025',
              contracts: -1,
              premiumCollected: 261.33
            },
            {
              symbol: 'ETHA',
              type: 'PUT',
              strike: 30,
              expiry: 'Oct-17-2025',
              contracts: 5,
              premium: 5.03
            }
          ]
        }
      };

      // Process positions
      const optionPositions = portfolioData.metadata?.optionPositions?.map(
        opt => normalizePosition(opt, currentPrice, ticker)
      ) || [];

      expect(optionPositions).toHaveLength(2);

      const soldCall = optionPositions.find(p => p.contracts < 0 && p.type === 'CALL');
      expect(soldCall).toBeDefined();
      expect(soldCall?.strike).toBe(36);
      expect(soldCall?.premium).toBe(261.33);

      const boughtPut = optionPositions.find(p => p.contracts > 0 && p.type === 'PUT');
      expect(boughtPut).toBeDefined();
      expect(boughtPut?.strike).toBe(30);
      expect(boughtPut?.contracts).toBe(5);
    });

    it('should calculate totals correctly', () => {
      const positions = [
        { premium: 261.33, contracts: -1, type: 'CALL' as const },
        { premium: 2515, contracts: 5, type: 'PUT' as const },
        { premium: 299.33, contracts: -1, type: 'CALL' as const }
      ];

      const totalPremium = positions.reduce((sum, p) => sum + p.premium, 0);
      expect(totalPremium).toBeCloseTo(3075.66);

      const countsByType = positions.reduce((counts, p) => {
        const label = `${p.contracts < 0 ? 'SOLD' : 'BOUGHT'} ${p.type}`;
        counts[label] = (counts[label] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(countsByType['SOLD CALL']).toBe(2);
      expect(countsByType['BOUGHT PUT']).toBe(1);
    });
  });
});
