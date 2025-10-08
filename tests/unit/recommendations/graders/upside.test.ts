import { describe, it, expect } from 'vitest';
import { gradeUpside } from '../../../../supabase/functions/integrated-analysis-v3/coach/graders/upside.ts';
import type { UpsideInput } from '../../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Upside Grader', () => {
  const currentPrice = 70;

  describe('A+ Grade - Excellent Upside', () => {
    it('should give A+ for 50%+ unlimited + multiple long calls', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Naked Put', maxProfit: null, riskProfile: 'unlimited' },
          { label: 'Naked Put', maxProfit: null, riskProfile: 'unlimited' },
        ],
        boughtCallPositions: [
          { delta: 0.6, strike: 65, expiry: '2025-03-21' }, // ITM
          { delta: 0.55, strike: 68, expiry: '2025-03-21' }, // ITM
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.feedback).toContain('Excellent upside');
      expect(result.strengths.some((s) => s.includes('4 unlimited upside'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('2 long call'))).toBe(true);
    });

    it('should bonus ITM calls (+2 points)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.7, strike: 60, expiry: '2025-03-21' }, // Deep ITM
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      // Base A+ (97-100) + ITM bonus (+2) = should be capped at 100
      expect(result.strengths.some((s) => s.includes('ITM long call'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('immediate upside'))).toBe(true);
    });
  });

  describe('A Grade - Strong Upside', () => {
    it('should give A for 40% unlimited + 1 OTM call', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
        ],
        boughtCallPositions: [
          { delta: 0.35, strike: 75, expiry: '2025-03-21' }, // OTM (>7% away)
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      // 40% unlimited + 1 call: 93 + min((0.4*5 + 1*0.5), 3) = 95.5 → A
      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.strengths.some((s) => s.includes('2 unlimited upside'))).toBe(true);
    });

    it('should give A for 2+ long calls (even without unlimited)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
        ],
        boughtCallPositions: [
          { delta: 0.5, strike: 70, expiry: '2025-03-21' }, // ATM
          { delta: 0.3, strike: 75, expiry: '2025-03-21' }, // OTM
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.grade).toBe('A');
      expect(result.strengths.some((s) => s.includes('2 long call'))).toBe(true);
    });
  });

  describe('A- Grade - Good Upside', () => {
    it('should give A- for 1 long call', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
        ],
        boughtCallPositions: [
          { delta: 0.4, strike: 72, expiry: '2025-03-21' },
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('1 long call'))).toBe(true);
    });

    it('should give A- for 33% unlimited strategies (no long calls)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Naked Put', maxProfit: null, riskProfile: 'unlimited' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 500, riskProfile: 'covered' },
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      // 33% unlimited: score = 90 + min(0.33*5, 2) = 91.67 → A-
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('1 unlimited upside'))).toBe(true);
    });
  });

  describe('B Grade - Moderate Upside', () => {
    it('should give B for all capped with 20%+ max profit', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 1500, riskProfile: 'covered' }, // ~21% of current price
          { label: 'Covered Call', maxProfit: 1400, riskProfile: 'covered' },
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThan(90);
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('All positions capped'))).toBe(true);
    });
  });

  describe('C Grade - Limited Upside', () => {
    it('should give C for 10-20% capped upside', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 700, riskProfile: 'covered' }, // 10% of current price
          { label: 'Covered Call', maxProfit: 1050, riskProfile: 'covered' }, // 15%
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('Limited upside'))).toBe(true);
      expect(result.weaknesses.some((w) => w.includes('long calls'))).toBe(true);
    });
  });

  describe('D Grade - Very Limited Upside', () => {
    it('should give D for 5-10% capped upside', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 350, riskProfile: 'covered' }, // 5% of current price
          { label: 'Covered Call', maxProfit: 525, riskProfile: 'covered' }, // 7.5%
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(70);
      expect(result.grade).toBe('D');
      expect(result.weaknesses.some((w) => w.includes('Very limited upside'))).toBe(true);
    });
  });

  describe('F Grade - Minimal Upside', () => {
    it('should give F for <5% capped upside', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 100, riskProfile: 'covered' }, // ~1.4% of current price
          { label: 'Covered Call', maxProfit: 150, riskProfile: 'covered' }, // ~2.1%
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
      expect(result.weaknesses.some((w) => w.includes('Minimal upside'))).toBe(true);
      expect(result.feedback).toContain('income, not growth');
    });
  });

  describe('Long Call Analysis', () => {
    it('should note ITM calls with bonus', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.65, strike: 65, expiry: '2025-03-21' }, // ITM
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.strengths.some((s) => s.includes('1 ITM long call'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('immediate upside'))).toBe(true);
    });

    it('should note ATM calls with smaller bonus', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.5, strike: 70, expiry: '2025-03-21' }, // ATM (within 5% of current)
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.strengths.some((s) => s.includes('1 ATM long call'))).toBe(true);
    });

    it('should note OTM calls for A+ grades', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.6, strike: 65, expiry: '2025-03-21' }, // ITM
          { delta: 0.3, strike: 80, expiry: '2025-03-21' }, // OTM
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.strengths.some((s) => s.includes('OTM long call'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('lottery'))).toBe(true);
    });

    it('should note strong delta for A+ grades', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.6, strike: 65, expiry: '2025-03-21' },
          { delta: 0.55, strike: 68, expiry: '2025-03-21' },
        ],
        currentPrice,
      };

      const result = gradeUpside(input);

      // Average delta: (0.6 + 0.55) / 2 = 0.575 (>= 0.5)
      expect(result.strengths.some((s) => s.includes('Strong delta'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('57%'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no strategies (stock-only portfolio)', () => {
      const input: UpsideInput = {
        strategies: [],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.score).toBe(75);
      expect(result.grade).toBe('C');
      expect(result.feedback).toContain('No options strategies');
      expect(result.strengths.some((s) => s.includes('Stock-only portfolio'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('unlimited upside potential'))).toBe(true);
    });

    it('should warn about all-capped portfolio in B-range', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 1500, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 1500, riskProfile: 'covered' },
        ],
        boughtCallPositions: [],
        currentPrice,
      };

      const result = gradeUpside(input);

      expect(result.weaknesses.some((w) => w.includes('No unlimited upside'))).toBe(true);
      expect(result.weaknesses.some((w) => w.includes('all positions capped'))).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('IBIT portfolio: 2 covered calls + 1 long call → A- (good upside)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
        ],
        boughtCallPositions: [
          { delta: 0.30, strike: 74, expiry: '2025-03-21' }, // OTM (>5% away, no bonus)
        ],
        currentPrice: 69.81,
      };

      const result = gradeUpside(input);

      // 33% unlimited + 1 long call: score = 90 + min(0.33*5 + 1*0.5, 2) = 92 → A-
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('1 long call'))).toBe(true);
    });

    it('Income-focused portfolio: 4 covered calls, no long calls → D (limited upside)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
          { label: 'Covered Call', maxProfit: 340, riskProfile: 'covered' },
        ],
        boughtCallPositions: [],
        currentPrice: 69.81,
      };

      const result = gradeUpside(input);

      // Max profit 340 avg: 200 <= 340 < 500 → D territory
      // Score: 60 + ((340-200)/300)*10 = 64.67 → D
      expect(result.grade).toBe('D');
      expect(result.weaknesses.some((w) => w.includes('limited upside'))).toBe(true);
    });

    it('Aggressive growth: 3 long calls + 1 naked put → A+ (excellent upside)', () => {
      const input: UpsideInput = {
        strategies: [
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Long Call', maxProfit: null, riskProfile: 'defined' },
          { label: 'Naked Put', maxProfit: null, riskProfile: 'unlimited' },
        ],
        boughtCallPositions: [
          { delta: 0.55, strike: 68, expiry: '2025-03-21' }, // ITM
          { delta: 0.45, strike: 72, expiry: '2025-03-21' }, // ATM
          { delta: 0.3, strike: 80, expiry: '2025-03-21' }, // OTM
        ],
        currentPrice: 69.81,
      };

      const result = gradeUpside(input);

      expect(result.grade).toBe('A+');
      expect(result.strengths.some((s) => s.includes('4 unlimited upside'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('3 long call'))).toBe(true);
    });
  });
});
