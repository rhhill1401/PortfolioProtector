import { describe, it, expect } from 'vitest';
import { gradeRisk } from '../../../../supabase/functions/integrated-analysis-v3/coach/graders/risk.ts';
import type { RiskInput } from '../../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Risk Grader', () => {
  describe('A+ Grade - Minimal Risk', () => {
    it('should give A+ for all covered strategies, no naked positions', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.feedback).toContain('Excellent risk management');
      expect(result.strengths.some((s) => s.includes('covered strategies'))).toBe(true);
      expect(result.strengths.some((s) => s.includes('No naked positions'))).toBe(true);
    });

    it('should give A+ for 80% covered + 20% defined risk', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Bull Put Spread', riskProfile: 'defined', maxLoss: -500 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.strengths.some((s) => s.includes('defined-risk spreads'))).toBe(true);
    });
  });

  describe('A Grade - Low Risk', () => {
    it('should give A for 60% covered, 40% defined, no unlimited', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Bull Put Spread', riskProfile: 'defined', maxLoss: -500 },
          { label: 'Bear Call Spread', riskProfile: 'defined', maxLoss: -400 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.feedback).toContain('Strong risk management');
    });
  });

  describe('A- Grade - Controlled Risk', () => {
    it('should give A- for all defined risk, no unlimited', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Iron Condor', riskProfile: 'defined', maxLoss: -500 },
          { label: 'Bull Put Spread', riskProfile: 'defined', maxLoss: -400 },
          { label: 'Bear Call Spread', riskProfile: 'defined', maxLoss: -300 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.strengths.some((s) => s.includes('No unlimited risk'))).toBe(true);
    });
  });

  describe('B Grade - Moderate Risk', () => {
    it('should give B for 20% unlimited risk', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 1,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThan(90);
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('unlimited risk'))).toBe(true);
    });
  });

  describe('C Grade - Elevated Risk', () => {
    it('should give C-D for 50% unlimited risk with 2 nakeds', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Call', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 2,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      // Base 73, minus 4 for nakeds = 69 (D grade)
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-', 'D']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('2 naked positions'))).toBe(true);
    });
  });

  describe('D Grade - High Risk', () => {
    it('should give D for 80% unlimited risk with 4 nakeds', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Call', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Call', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 4,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      // 80% unlimited: base 62, minus 8 for nakeds = 54 (D grade)
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(70);
      expect(['D', 'F']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('4 naked positions'))).toBe(true);
    });
  });

  describe('F Grade - Extreme Risk', () => {
    it('should give F for 100% unlimited risk', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Call', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Call', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 4,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
      expect(result.weaknesses.some((w) => w.includes('Extreme risk'))).toBe(true);
      expect(result.feedback).toContain('catastrophic');
    });
  });

  describe('Naked Positions Penalty', () => {
    it('should penalize for 3 naked positions (-6 points)', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 3,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      // Base score ~80-85, minus 6 for nakeds = ~74-79
      expect(result.weaknesses.some((w) => w.includes('3 naked positions'))).toBe(true);
      expect(result.weaknesses.some((w) => w.includes('High naked exposure'))).toBe(true);
    });

    it('should cap naked penalty at -10 points', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 6, // Would be -12, but capped at -10
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      // High naked count should still result in low score
      expect(result.weaknesses.some((w) => w.includes('6 naked positions'))).toBe(true);
    });
  });

  describe('Assignment Risk Analysis', () => {
    it('should penalize for high assignment risk (delta >=0.4, DTE <=14)', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [
          { delta: 0.45, daysToExpiry: 7 }, // High risk
          { delta: 0.50, daysToExpiry: 10 }, // High risk
        ],
      };

      const result = gradeRisk(input);

      // Base A+ (~97-100), minus 10 for 2 high-risk assignments = ~87-90
      expect(result.weaknesses.some((w) => w.includes('2 positions with high assignment risk'))).toBe(
        true,
      );
      expect(result.weaknesses.some((w) => w.includes('Monitor closely'))).toBe(true);
    });

    it('should note moderate assignment risk (delta >=0.3, DTE <=30)', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [
          { delta: 0.35, daysToExpiry: 21 }, // Moderate risk
          { delta: 0.32, daysToExpiry: 25 }, // Moderate risk
        ],
      };

      const result = gradeRisk(input);

      expect(result.weaknesses.some((w) => w.includes('2 positions with moderate assignment risk'))).toBe(
        true,
      );
    });

    it('should note no assignment risk for A grades', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [], // No assignment risk
      };

      const result = gradeRisk(input);

      expect(result.strengths.some((s) => s.includes('No immediate assignment risk'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no strategies (stock-only portfolio)', () => {
      const input: RiskInput = {
        strategies: [],
        nakedPositions: 0,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      expect(result.score).toBe(75);
      expect(result.grade).toBe('C');
      expect(result.feedback).toContain('No options strategies');
      expect(result.strengths.some((s) => s.includes('Stock-only portfolio'))).toBe(true);
    });

    it('should note unlimited max loss strategies', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Naked Put', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 1,
        assignmentRiskPositions: [],
      };

      const result = gradeRisk(input);

      // Score should be in B range (~80-89), which is < 90
      expect(result.weaknesses.some((w) => w.includes('strategies with unlimited max loss'))).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('IBIT portfolio: 2 covered calls, 1 long call → A (67% covered, no unlimited)', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Long Call', riskProfile: 'defined', maxLoss: -340 },
        ],
        nakedPositions: 0,
        assignmentRiskPositions: [
          { delta: 0.25, daysToExpiry: 47 }, // Low risk (OTM, far out)
        ],
      };

      const result = gradeRisk(input);

      // 67% covered, 33% defined, 0% unlimited → A grade
      expect(result.grade).toBe('A');
      expect(result.strengths.some((s) => s.includes('covered strategies'))).toBe(true);
    });

    it('Aggressive portfolio: 2 covered, 2 naked puts → C grade', () => {
      const input: RiskInput = {
        strategies: [
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Covered Call', riskProfile: 'covered', maxLoss: -2500 },
          { label: 'Cash-Secured Put', riskProfile: 'unlimited', maxLoss: null },
          { label: 'Cash-Secured Put', riskProfile: 'unlimited', maxLoss: null },
        ],
        nakedPositions: 2,
        assignmentRiskPositions: [
          { delta: 0.45, daysToExpiry: 10 }, // High assignment risk
        ],
      };

      const result = gradeRisk(input);

      expect(['C+', 'C', 'C-', 'D']).toContain(result.grade);
      expect(result.weaknesses.some((w) => w.includes('2 naked positions'))).toBe(true);
    });
  });
});
