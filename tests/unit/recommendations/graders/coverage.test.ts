import { describe, it, expect } from 'vitest';
import { gradeCoverage } from '../../../../supabase/functions/integrated-analysis-v3/coach/graders/coverage.ts';
import type { CoverageInput } from '../../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Coverage Grader', () => {
  describe('A+ Grade - Collar Strategy', () => {
    it('should give A+ for 100% covered calls + 100% protective puts', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4, // 4 sold calls = 400 shares covered
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 4, // 4 protective puts = 400 shares protected
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.feedback).toContain('Excellent coverage');
      expect(result.strengths).toContain('Collar strategy (covered calls + protective puts)');
      expect(result.strengths).toContain('Full downside protection');
    });

    it('should give A+ for overcovered position (150% calls + 100% puts)', () => {
      const input: CoverageInput = {
        shareCount: 200,
        currentPrice: 69.81,
        soldCallContracts: -3, // 300 shares worth, but capped at 100%
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 2, // 200 shares worth = 100% protection
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
    });
  });

  describe('A Grade - Full Coverage', () => {
    it('should give A for 100% covered calls + 50% protective puts', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4,
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 2, // 200 shares protected (50%)
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.strengths).toContain('All shares covered with sold calls');
      expect(result.strengths).toContain('Significant downside protection');
    });
  });

  describe('A- Grade - Basic Coverage', () => {
    it('should give A- for 100% covered calls, no protective puts', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4,
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths).toContain('All shares covered with sold calls');
      expect(result.weaknesses).toContain('No downside protection (consider protective puts)');
    });
  });

  describe('B Grade - Most Shares Covered', () => {
    it('should give B for 85% coverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -3.4, // 340 shares = 85% coverage
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThan(90);
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.strengths).toContain('Most shares covered');
      expect(result.weaknesses).toContain('Only 85% of shares covered');
    });
  });

  describe('C Grade - Partial Coverage', () => {
    it('should give C for 60% coverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -2.4, // 240 shares = 60% coverage
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.weaknesses).toContain('Only 60% of shares covered');
      expect(result.weaknesses).toContain('Consider covering more shares with sold calls');
    });
  });

  describe('D Grade - Minimal Coverage', () => {
    it('should give D for 40% coverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -1.6, // 160 shares = 40% coverage
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(70);
      expect(result.grade).toBe('D');
      expect(result.weaknesses).toContain('Only 40% of shares covered');
      expect(result.weaknesses).toContain('Majority of shares unprotected');
    });
  });

  describe('F Grade - No Coverage', () => {
    it('should give F for 0% coverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: 0,
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
      expect(result.weaknesses).toContain('Minimal coverage - high risk exposure');
      expect(result.weaknesses).toContain('Consider selling covered calls for income');
    });

    it('should give F for 15% coverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -0.6, // 60 shares = 15% coverage
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no shares (options-only portfolio)', () => {
      const input: CoverageInput = {
        shareCount: 0,
        currentPrice: 69.81,
        soldCallContracts: -2,
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBe(75);
      expect(result.grade).toBe('C');
      expect(result.feedback).toBe('No stock holdings to grade coverage');
      expect(result.strengths).toContain('Options-only portfolio');
      expect(result.weaknesses).toContain('Coverage grading not applicable without shares');
    });

    it('should count cash-secured puts as future share acquisition', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4,
        soldPutContracts: -2, // CSPs
        boughtCallContracts: 0,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.strengths).toContain('-2 cash-secured puts (future share acquisition)');
    });

    it('should count long calls as upside leverage', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4,
        soldPutContracts: 0,
        boughtCallContracts: 2,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.strengths).toContain('2 long calls (upside leverage)');
    });
  });

  describe('Real-World Scenarios', () => {
    it('IBIT portfolio: 400 shares, 2 sold $70 calls = 50% coverage → C grade', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -2, // 200 shares = 50% coverage
        soldPutContracts: 0,
        boughtCallContracts: 1,
        boughtPutContracts: 0,
      };

      const result = gradeCoverage(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.weaknesses).toContain('Only 50% of shares covered');
    });

    it('Conservative portfolio: 400 shares, 4 sold calls, 4 protective puts = A+', () => {
      const input: CoverageInput = {
        shareCount: 400,
        currentPrice: 69.81,
        soldCallContracts: -4,
        soldPutContracts: 0,
        boughtCallContracts: 0,
        boughtPutContracts: 4,
      };

      const result = gradeCoverage(input);

      expect(result.grade).toBe('A+');
      expect(result.strengths).toContain('Collar strategy (covered calls + protective puts)');
    });
  });
});
