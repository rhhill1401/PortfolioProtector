import { describe, it, expect } from 'vitest';
import { gradeSophistication } from '../../../../supabase/functions/integrated-analysis-v3/coach/graders/sophistication.ts';
import type { StrategyInput } from '../../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Sophistication Grader', () => {
  describe('A+ Grade - Highly Sophisticated', () => {
    it('should give A+ for 4+ leg strategies', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
          { label: 'Iron Butterfly', legCount: 4 },
        ],
        positions: [
          { type: 'CALL', contracts: -1, strike: 75 },
          { type: 'CALL', contracts: 1, strike: 80 },
          { type: 'PUT', contracts: 1, strike: 65 },
          { type: 'PUT', contracts: -1, strike: 70 },
        ],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.feedback).toContain('Highly sophisticated');
      expect(result.strengths.some((s) => s.includes('2 advanced 4+ leg strategies'))).toBe(true);
    });

    it('should give A+ for multiple advanced strategies (iron condor, butterfly)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
          { label: 'Butterfly Spread', legCount: 3 },
          { label: 'Calendar Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.strengths.some((s) => s.includes('sophisticated'))).toBe(true);
      expect(result.strengths.some((s) => s.toLowerCase().includes('iron condor'))).toBe(true);
    });

    it('should bonus high diversity (4+ strategy types)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
          { label: 'Butterfly Spread', legCount: 3 },
          { label: 'Bull Call Spread', legCount: 2 },
          { label: 'Bear Put Spread', legCount: 2 },
          { label: 'Covered Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.strengths.some((s) => s.includes('Excellent strategy diversity'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('5 different strategy types'))).toBe(true);
    });
  });

  describe('A Grade - Strong Sophistication', () => {
    it('should give A for 2+ three-leg strategies', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Butterfly Spread', legCount: 3 },
          { label: 'Butterfly Spread', legCount: 3 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.strengths.some((s) => s.includes('2 three-leg strategies'))).toBe(true);
    });

    it('should give A for mix of 1 three-leg + 2+ two-leg strategies', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Butterfly Spread', legCount: 3 },
          { label: 'Bull Call Spread', legCount: 2 },
          { label: 'Bear Put Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.strengths.some((s) => s.includes('1 three-leg strategy'))).toBe(true);
    });
  });

  describe('A- Grade - Good Sophistication', () => {
    it('should give A- for 1 three-leg strategy', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Butterfly Spread', legCount: 3 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('1 three-leg strategy'))).toBe(true);
    });

    it('should give A- for 3+ two-leg spreads', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Bull Call Spread', legCount: 2 },
          { label: 'Bear Put Spread', legCount: 2 },
          { label: 'Credit Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('3 two-leg spreads'))).toBe(true);
    });
  });

  describe('B Grade - Moderate Sophistication', () => {
    it('should give B for 1-2 two-leg spreads', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Bull Call Spread', legCount: 2 },
          { label: 'Bear Put Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThan(90);
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.strengths.some((s) => s.includes('2 two-leg spreads'))).toBe(true);
    });

    it('should warn about limited diversity with only 1 strategy type', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Bull Call Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.weaknesses.some((w) => w.includes('Limited diversity'))).toBe(true);
    });
  });

  describe('C Grade - Basic Sophistication', () => {
    it('should give C for 2+ covered positions (1-leg strategies)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Covered Call', legCount: 1 },
          { label: 'Covered Call', legCount: 1 },
          { label: 'Covered Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.strengths.some((s) => s.includes('3 covered positions'))).toBe(true);
      expect(result.weaknesses.some((w) => w.includes('No multi-leg spreads'))).toBe(true);
    });
  });

  describe('D Grade - Minimal Sophistication', () => {
    it('should give D for single covered position', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Covered Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(70);
      expect(result.grade).toBe('D');
      expect(result.weaknesses.some((w) => w.includes('Very limited strategy sophistication'))).toBe(true);
    });
  });

  describe('F Grade - No Sophistication', () => {
    it('should give F for no strategies, only single positions', () => {
      const input: StrategyInput = {
        strategies: [],
        positions: [
          { type: 'CALL', contracts: -1, strike: 70 },
          { type: 'PUT', contracts: 1, strike: 65 },
        ],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBe(50);
      expect(result.grade).toBe('F');
      expect(result.feedback).toContain('No multi-leg strategies');
      expect(result.weaknesses.some((w) => w.includes('2 single-leg positions'))).toBe(true);
    });

    it('should give F for no positions at all', () => {
      const input: StrategyInput = {
        strategies: [],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.feedback).toContain('No positions or strategies');
      expect(result.weaknesses.some((w) => w.includes('No options positions'))).toBe(true);
    });
  });

  describe('Advanced Strategy Detection', () => {
    it('should detect iron condor by keyword', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.strengths.some((s) => s.toLowerCase().includes('iron condor'))).toBe(true);
    });

    it('should grade 3-leg butterfly as A- (good sophistication)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Long Call Butterfly', legCount: 3 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      // 3-leg butterfly is sophisticated but not "advanced" (which requires 4+ legs)
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('1 three-leg strategy'))).toBe(true);
    });

    it('should grade 2 two-leg ratio spreads as B (basic spreads)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Ratio Call Spread', legCount: 2 },
          { label: 'Ratio Put Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      // 2-leg spreads are B territory, not A+ (advanced requires 4+ legs)
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.strengths.some((s) => s.includes('2 two-leg spreads'))).toBe(true);
    });

    it('should grade calendar/diagonal spreads as B (basic spreads)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Calendar Spread', legCount: 2 },
          { label: 'Diagonal Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      // 2-leg spreads are B territory
      expect(['B+', 'B', 'B-']).toContain(result.grade);
    });
  });

  describe('Average Complexity Analysis', () => {
    it('should note high average complexity for A+ grades', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
          { label: 'Butterfly', legCount: 3 },
          { label: 'Bull Call Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      // Average: (4 + 3 + 2) / 3 = 3.0 legs
      expect(result.strengths.some((s) => s.includes('High average complexity (3.0 legs'))).toBe(true);
    });

    it('should note low complexity for low grades', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Covered Call', legCount: 1 },
          { label: 'Covered Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      // Average: (1 + 1) / 2 = 1.0 legs
      expect(result.weaknesses.some((w) => w.includes('Low complexity (1.0 legs'))).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('IBIT portfolio: 2 covered calls + 1 long call → C (basic)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Covered Call', legCount: 1 },
          { label: 'Covered Call', legCount: 1 },
          { label: 'Long Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.strengths.some((s) => s.includes('3 covered positions'))).toBe(true);
    });

    it('Intermediate trader: 2 spreads + 1 covered call → B (moderate)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Bull Call Spread', legCount: 2 },
          { label: 'Bear Put Spread', legCount: 2 },
          { label: 'Covered Call', legCount: 1 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.strengths.some((s) => s.includes('2 two-leg spreads'))).toBe(true);
    });

    it('Advanced trader: iron condor + butterfly + spreads → A+ (highly sophisticated)', () => {
      const input: StrategyInput = {
        strategies: [
          { label: 'Iron Condor', legCount: 4 },
          { label: 'Iron Butterfly', legCount: 4 },
          { label: 'Long Call Butterfly', legCount: 3 },
          { label: 'Bull Call Spread', legCount: 2 },
        ],
        positions: [],
      };

      const result = gradeSophistication(input);

      expect(result.grade).toBe('A+');
      expect(result.strengths.some((s) => s.includes('2 advanced 4+ leg strategies'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('4 different strategy types'))).toBe(true);
    });
  });
});
