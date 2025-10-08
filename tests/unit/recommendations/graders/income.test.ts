import { describe, it, expect } from 'vitest';
import { gradeIncome } from '../../../../supabase/functions/integrated-analysis-v3/coach/graders/income.ts';
import type { IncomeInput } from '../../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Income Grader', () => {
  describe('A+ Grade - Excellent Income', () => {
    it('should give A+ for >8% annualized yield with strong theta', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 2500, // $2500 premium
        portfolioValue: 100000, // $100k portfolio
        averageDaysToExpiry: 45, // 45-day avg
        soldPositions: [
          { type: 'CALL', contracts: -4, premium: 1250, theta: -30 },
          { type: 'PUT', contracts: -2, premium: 1250, theta: -25 },
        ],
      };

      // Annualized yield: (2500/100000) * (365/45) * 100 = 20.3%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(97);
      expect(result.grade).toBe('A+');
      expect(result.feedback).toContain('Excellent income');
      expect(result.strengths.some(s => s.includes('20.'))).toBe(true);
      expect(result.strengths.some(s => s.toLowerCase().includes('theta'))).toBe(true);
    });
  });

  describe('A Grade - Strong Income', () => {
    it('should give A for 6% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 750, // $750 premium
        portfolioValue: 100000, // $100k portfolio
        averageDaysToExpiry: 45, // 45-day avg
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 500, theta: -8 },
          { type: 'PUT', contracts: -1, premium: 250, theta: -4 },
        ],
      };

      // Annualized yield: (750/100000) * (365/45) * 100 = 6.1%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(result.score).toBeLessThan(97);
      expect(result.grade).toBe('A');
      expect(result.feedback).toContain('Strong income');
    });
  });

  describe('A- Grade - Good Income', () => {
    it('should give A- for 4.5% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 550, // $550 premium
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 400, theta: -6 },
          { type: 'PUT', contracts: -1, premium: 150, theta: -3 },
        ],
      };

      // Annualized yield: (550/100000) * (365/45) * 100 = 4.5%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThan(93);
      expect(result.grade).toBe('A-');
      expect(result.feedback).toContain('Good yield');
    });
  });

  describe('B Grade - Moderate Income', () => {
    it('should give B for 3.5% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 430, // $430 premium
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 300, theta: -5 },
          { type: 'PUT', contracts: -1, premium: 130, theta: -2 },
        ],
      };

      // Annualized yield: (430/100000) * (365/45) * 100 = 3.5%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThan(90);
      expect(['B+', 'B', 'B-']).toContain(result.grade);
      expect(result.feedback).toContain('Moderate income');
    });
  });

  describe('C Grade - Low Income', () => {
    it('should give C for 2% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 250, // $250 premium
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 150, theta: -3 },
          { type: 'PUT', contracts: -1, premium: 100, theta: -2 },
        ],
      };

      // Annualized yield: (250/100000) * (365/45) * 100 = 2.0%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(80);
      expect(['C+', 'C', 'C-']).toContain(result.grade);
      expect(result.weaknesses.some(w => w.includes('Low yield'))).toBe(true);
    });
  });

  describe('D Grade - Very Low Income', () => {
    it('should give D for 1% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 120, // $120 premium
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 120, theta: -2 },
        ],
      };

      // Annualized yield: (120/100000) * (365/45) * 100 = 1.0%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(70);
      expect(result.grade).toBe('D');
      expect(result.weaknesses.some(w => w.includes('Very low yield'))).toBe(true);
    });
  });

  describe('F Grade - Minimal/No Income', () => {
    it('should give F for <0.5% annualized yield', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 50, // $50 premium
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 50, theta: -0.5 },
        ],
      };

      // Annualized yield: (50/100000) * (365/45) * 100 = 0.4%
      const result = gradeIncome(input);

      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
      expect(result.weaknesses.some(w => w.includes('Minimal yield'))).toBe(true);
    });

    it('should give F for no sold positions', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 0,
        portfolioValue: 100000,
        averageDaysToExpiry: 0,
        soldPositions: [],
      };

      const result = gradeIncome(input);

      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.feedback).toContain('No income-generating positions');
      expect(result.weaknesses.some(w => w.includes('No sold options'))).toBe(true);
    });
  });

  describe('Theta Efficiency Bonus/Penalty', () => {
    it('should give +2 bonus for strong theta (>$50/day per $100k)', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 500,
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 300, theta: -35 },
          { type: 'PUT', contracts: -2, premium: 200, theta: -20 },
        ],
      };

      // Total theta: 55/day, per $100k: $55
      const result = gradeIncome(input);

      // Should have theta bonus
      expect(result.strengths.some(s => s.includes('Strong theta'))).toBe(true);
      expect(result.strengths.some(s => s.includes('$55'))).toBe(true);
    });

    it('should give -2 penalty for weak theta (<$20/day per $100k) in C-range', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 250,
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 150, theta: -10 },
          { type: 'PUT', contracts: -1, premium: 100, theta: -5 },
        ],
      };

      // Total theta: 15/day, per $100k: $15 (weak)
      const result = gradeIncome(input);

      // Should have weak theta noted
      expect(result.weaknesses.some(w => w.includes('Weak theta'))).toBe(true);
    });
  });

  describe('Position Diversification', () => {
    it('should note well-diversified income with 4+ positions', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 800,
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 200, theta: -4 },
          { type: 'CALL', contracts: -1, premium: 200, theta: -4 },
          { type: 'PUT', contracts: -1, premium: 200, theta: -4 },
          { type: 'PUT', contracts: -1, premium: 200, theta: -4 },
        ],
      };

      const result = gradeIncome(input);

      expect(result.strengths).toContain('4 income positions (well diversified)');
    });

    it('should warn about concentration risk with only 1 position', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 800,
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -1, premium: 800, theta: -15 },
        ],
      };

      const result = gradeIncome(input);

      expect(result.weaknesses).toContain('Only 1 income position (concentration risk)');
    });
  });

  describe('Time Horizon Insights', () => {
    it('should note longer-term positions (>60 DTE)', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 800,
        portfolioValue: 100000,
        averageDaysToExpiry: 90,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 500, theta: -8 },
          { type: 'PUT', contracts: -1, premium: 300, theta: -5 },
        ],
      };

      const result = gradeIncome(input);

      expect(result.strengths.some(s => s.includes('Longer-term positions (90 days'))).toBe(true);
      expect(result.strengths.some(s => s.includes('more stable income'))).toBe(true);
    });

    it('should note short-term positions (<30 DTE)', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 400,
        portfolioValue: 100000,
        averageDaysToExpiry: 21,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 250, theta: -10 },
          { type: 'PUT', contracts: -1, premium: 150, theta: -7 },
        ],
      };

      const result = gradeIncome(input);

      expect(result.strengths.some(s => s.includes('Short-term positions (21 days'))).toBe(true);
      expect(result.strengths.some(s => s.includes('frequent renewal'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero portfolio value', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 500,
        portfolioValue: 0,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 500, theta: -10 },
        ],
      };

      const result = gradeIncome(input);

      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.feedback).toContain('portfolio value is zero');
    });

    it('should use default 45 DTE when averageDaysToExpiry is 0', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 750,
        portfolioValue: 100000,
        averageDaysToExpiry: 0, // Missing/invalid
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 750, theta: -12 },
        ],
      };

      const result = gradeIncome(input);

      // Should calculate using default 45 days
      // (750/100000) * (365/45) * 100 = 6.1%
      expect(result.score).toBeGreaterThanOrEqual(93); // A territory
      expect(result.grade).toBe('A');
    });

    it('should handle missing theta values gracefully', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 500,
        portfolioValue: 100000,
        averageDaysToExpiry: 45,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 300, theta: 0 }, // No theta
          { type: 'PUT', contracts: -1, premium: 200, theta: 0 }, // No theta
        ],
      };

      const result = gradeIncome(input);

      // Should still grade based on premium yield
      // (500/100000) * (365/45) * 100 = 4.1%
      expect(result.score).toBeGreaterThanOrEqual(90); // A- territory
    });
  });

  describe('Real-World Scenarios', () => {
    it('IBIT portfolio: $680 premium on $91k portfolio (47 DTE) → ~5.5% annualized = A', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 680.66,
        portfolioValue: 91877,
        averageDaysToExpiry: 47,
        soldPositions: [
          { type: 'CALL', contracts: -2, premium: 340.33, theta: -3 },
        ],
      };

      // Annualized yield: (680.66/91877) * (365/47) * 100 = 5.8%
      const result = gradeIncome(input);

      expect(result.score).toBeGreaterThanOrEqual(93);
      expect(['A', 'A-']).toContain(result.grade);
      expect(result.feedback).toContain('yield');
    });

    it('Aggressive wheel: $3000 premium on $100k (30 DTE) → ~36% annualized = A+', () => {
      const input: IncomeInput = {
        totalPremiumCollected: 3000,
        portfolioValue: 100000,
        averageDaysToExpiry: 30,
        soldPositions: [
          { type: 'CALL', contracts: -4, premium: 1500, theta: -20 },
          { type: 'PUT', contracts: -2, premium: 1500, theta: -15 },
        ],
      };

      // Annualized yield: (3000/100000) * (365/30) * 100 = 36.5%
      const result = gradeIncome(input);

      expect(result.grade).toBe('A+');
      expect(result.strengths.some(s => s.includes('36.'))).toBe(true);
    });
  });
});
