import { describe, it, expect } from 'vitest';
import {
  calculateScenario,
  calculateAllScenarios,
} from '../../../supabase/functions/integrated-analysis-v3/coach/scenario.ts';
import type { ScenarioInput } from '../../../supabase/functions/integrated-analysis-v3/types/recommendations.ts';

describe('Scenario Calculator', () => {
  describe('Covered Call Scenario', () => {
    it('should calculate P/L for covered call below strike (profit)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40, // Bought shares at $40
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: -5, // Sold 5 calls
            premium: 2, // Collected $2 per share = $1000 total
            expiry: '2025-03-21',
          },
        ],
      };

      // At $52: shares up $12/share, calls OTM (keep premium)
      const result = calculateScenario(input, 52);

      expect(result.priceLevel).toBe(52);
      expect(result.percentChange).toBe(4); // (52-50)/50 * 100
      expect(result.portfolioValue).toBe(26000); // 500 × $52
      expect(result.profitLoss).toBe(7000); // Share P/L: 500×(52-40)=$6000 + Premium: $1000
      expect(result.status).toBe('profit');
    });

    it('should calculate P/L for covered call above strike (max profit)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: -5,
            premium: 2,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $60: shares up $20/share, but calls ITM (lose $5/share on calls)
      const result = calculateScenario(input, 60);

      expect(result.priceLevel).toBe(60);
      expect(result.percentChange).toBe(20); // (60-50)/50 * 100
      expect(result.portfolioValue).toBe(27500); // 500×60 - 5×100×5 (owe intrinsic)
      expect(result.profitLoss).toBe(8500); // Share P/L: 500×20=$10k - Call loss: 5×100×3=$1.5k + premium $1k
      expect(result.status).toBe('max_profit'); // All sold calls ITM
    });

    it('should calculate P/L for covered call deep below strike (loss)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: -5,
            premium: 2,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $35: shares down $5/share, calls OTM (keep premium helps offset)
      const result = calculateScenario(input, 35);

      expect(result.priceLevel).toBe(35);
      expect(result.percentChange).toBe(-30); // (35-50)/50 * 100
      expect(result.portfolioValue).toBe(17500); // 500 × $35
      expect(result.profitLoss).toBe(-1500); // Share P/L: 500×(35-40)=-$2500 + Premium: $1000
      expect(result.status).toBe('deep_loss');
    });
  });

  describe('Protective Put Scenario', () => {
    it('should calculate P/L for protective put above strike (profit)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          {
            type: 'PUT',
            strike: 45,
            contracts: 5, // Bought 5 puts for protection
            premium: 1.5, // Paid $1.50 per share = $750 total
            expiry: '2025-03-21',
          },
        ],
      };

      // At $55: shares up $15/share, puts expire worthless
      const result = calculateScenario(input, 55);

      expect(result.priceLevel).toBe(55);
      expect(result.percentChange).toBe(10);
      expect(result.portfolioValue).toBe(27500); // 500 × $55
      expect(result.profitLoss).toBe(6750); // Share P/L: 500×15=$7500 - Premium paid: $750
      expect(result.status).toBe('profit');
    });

    it('should calculate P/L for protective put below strike (protected loss)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          {
            type: 'PUT',
            strike: 45,
            contracts: 5,
            premium: 1.5,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $35: shares down $5/share, but puts ITM gain $10/share
      const result = calculateScenario(input, 35);

      expect(result.priceLevel).toBe(35);
      expect(result.percentChange).toBe(-30);
      expect(result.portfolioValue).toBe(22500); // 500×35 + 5×100×10 (put intrinsic)
      expect(result.profitLoss).toBe(1750); // Share P/L: -$2500 + Put P/L: ($5000 intrinsic - $750 premium) = $4250, total: -$2500 + $4250 = $1750
      expect(result.status).toBe('profit'); // Protected by puts
    });
  });

  describe('Long Call Scenario', () => {
    it('should calculate P/L for long call ITM (profit)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: 10, // Bought 10 calls
            premium: 3, // Paid $3 per share = $3000 total
            expiry: '2025-03-21',
          },
        ],
      };

      // At $65: calls ITM by $10/share
      const result = calculateScenario(input, 65);

      expect(result.priceLevel).toBe(65);
      expect(result.percentChange).toBe(30);
      expect(result.portfolioValue).toBe(10000); // 10 × 100 × 10 (intrinsic)
      expect(result.profitLoss).toBe(7000); // Intrinsic: $10k - Premium paid: $3k
      expect(result.status).toBe('profit');
    });

    it('should calculate P/L for long call OTM (loss)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: 10,
            premium: 3,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $52: calls OTM, expire worthless
      const result = calculateScenario(input, 52);

      expect(result.priceLevel).toBe(52);
      expect(result.percentChange).toBe(4);
      expect(result.portfolioValue).toBe(0); // Calls expire worthless
      expect(result.profitLoss).toBe(-3000); // Lost all premium paid
      expect(result.status).toBe('deep_loss');
    });
  });

  describe('Bull Call Spread Scenario', () => {
    it('should calculate P/L for bull call spread at max profit', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: 10, // Buy 10 calls
            premium: 3,
            expiry: '2025-03-21',
          },
          {
            type: 'CALL',
            strike: 60,
            contracts: -10, // Sell 10 calls
            premium: 1,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $62: both calls ITM, max profit reached
      const result = calculateScenario(input, 62);

      expect(result.priceLevel).toBe(62);
      // Long call intrinsic: 10×100×7=$7000, cost: $3000, P/L: $4000
      // Short call intrinsic: 10×100×2=$2000, collected: $1000, P/L: -$1000
      // Net P/L: $3000
      expect(result.profitLoss).toBe(3000);
      expect(result.status).toBe('max_profit'); // Both calls ITM
    });

    it('should calculate P/L for bull call spread below strikes (max loss)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          {
            type: 'CALL',
            strike: 55,
            contracts: 10,
            premium: 3,
            expiry: '2025-03-21',
          },
          {
            type: 'CALL',
            strike: 60,
            contracts: -10,
            premium: 1,
            expiry: '2025-03-21',
          },
        ],
      };

      // At $52: both calls OTM
      const result = calculateScenario(input, 52);

      expect(result.priceLevel).toBe(52);
      // Long call: paid $3000, intrinsic $0, P/L: -$3000
      // Short call: collected $1000, intrinsic $0, P/L: +$1000
      // Net P/L: -$2000 (max loss = net debit)
      expect(result.profitLoss).toBe(-2000);
      expect(result.status).toBe('deep_loss');
    });
  });

  describe('Status Determination', () => {
    const baseInput: ScenarioInput = {
      currentPrice: 50,
      shareCount: 100,
      shareBasis: 50,
      positions: [],
    };

    it('should assign "deep_loss" for P/L ≤ -$1000', () => {
      const result = calculateScenario({ ...baseInput, shareBasis: 60 }, 40); // 100×(40-60)=-2000
      expect(result.profitLoss).toBe(-2000);
      expect(result.status).toBe('deep_loss');
    });

    it('should assign "loss" for -$1000 < P/L < -$50', () => {
      const result = calculateScenario({ ...baseInput, shareBasis: 51 }, 50); // 100×(50-51)=-100
      expect(result.profitLoss).toBe(-100);
      expect(result.status).toBe('loss');
    });

    it('should assign "breakeven" for -$50 ≤ P/L ≤ $50', () => {
      const result = calculateScenario(baseInput, 50.2); // 100×0.2=20
      expect(result.profitLoss).toBe(20);
      expect(result.status).toBe('breakeven');
    });

    it('should assign "profit" for P/L > $50 without short options', () => {
      const result = calculateScenario({ ...baseInput, shareBasis: 40 }, 52); // 100×12=1200
      expect(result.profitLoss).toBe(1200);
      expect(result.status).toBe('profit'); // No short options, so just profit
    });

    it('should assign "max_profit" when all short calls are ITM', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 100,
        shareBasis: 40,
        positions: [
          { type: 'CALL', strike: 55, contracts: -1, premium: 2, expiry: '2025-03-21' },
        ],
      };

      const result = calculateScenario(input, 60); // Price > strike, call ITM
      expect(result.profitLoss).toBeGreaterThan(50);
      expect(result.status).toBe('max_profit');
    });

    it('should assign "profit" when short calls are OTM', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 100,
        shareBasis: 40,
        positions: [
          { type: 'CALL', strike: 55, contracts: -1, premium: 2, expiry: '2025-03-21' },
        ],
      };

      const result = calculateScenario(input, 52); // Price < strike, call OTM
      expect(result.profitLoss).toBeGreaterThan(50);
      expect(result.status).toBe('profit'); // Not max_profit because call still OTM
    });
  });

  describe('Edge Cases', () => {
    it('should handle portfolio with no shares', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          { type: 'CALL', strike: 55, contracts: 5, premium: 2, expiry: '2025-03-21' },
        ],
      };

      const result = calculateScenario(input, 60);

      expect(result.portfolioValue).toBe(2500); // 5×100×5 (intrinsic)
      expect(result.profitLoss).toBe(1500); // Intrinsic $2500 - premium $1000
      expect(result.status).toBe('profit');
    });

    it('should handle portfolio with no options', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [],
      };

      const result = calculateScenario(input, 55);

      expect(result.portfolioValue).toBe(27500); // 500 × $55
      expect(result.profitLoss).toBe(7500); // 500 × (55-40)
      expect(result.status).toBe('profit');
    });

    it('should handle empty portfolio', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [],
      };

      const result = calculateScenario(input, 55);

      expect(result.portfolioValue).toBe(0);
      expect(result.profitLoss).toBe(0);
      expect(result.status).toBe('breakeven');
    });

    it('should round values to 2 decimal places', () => {
      const input: ScenarioInput = {
        currentPrice: 50.123,
        shareCount: 333,
        shareBasis: 40.456,
        positions: [],
      };

      const result = calculateScenario(input, 55.789);

      expect(result.priceLevel).toBe(55.79);
      expect(result.percentChange).toBeCloseTo(11.31, 1);
      expect(result.portfolioValue).toBe(18577.74); // 333 × 55.789 rounded
      expect(result.profitLoss).toBe(5105.89); // 333 × (55.789-40.456) = 333 × 15.333 = 5105.89
    });
  });

  describe('calculateAllScenarios', () => {
    it('should calculate all 7 scenario levels correctly', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          { type: 'CALL', strike: 55, contracts: -5, premium: 2, expiry: '2025-03-21' },
        ],
      };

      const scenarios = calculateAllScenarios(input);

      // Verify all 7 scenarios exist
      expect(scenarios.bearish.priceLevel).toBe(35); // -30%
      expect(scenarios.moderateBearish.priceLevel).toBe(42.5); // -15%
      expect(scenarios.flat.priceLevel).toBe(50); // 0%
      expect(scenarios.moderateBullish.priceLevel).toBe(57.5); // +15%
      expect(scenarios.bullish.priceLevel).toBe(65); // +30%
      expect(scenarios.veryBullish.priceLevel).toBe(75); // +50%
      expect(scenarios.moonshot.priceLevel).toBe(100); // +100%

      // Verify percent changes
      expect(scenarios.bearish.percentChange).toBe(-30);
      expect(scenarios.moderateBearish.percentChange).toBe(-15);
      expect(scenarios.flat.percentChange).toBe(0);
      expect(scenarios.moderateBullish.percentChange).toBe(15);
      expect(scenarios.bullish.percentChange).toBe(30);
      expect(scenarios.veryBullish.percentChange).toBe(50);
      expect(scenarios.moonshot.percentChange).toBe(100);

      // Verify P/L progression (should increase as price goes up, then cap at max profit)
      expect(scenarios.bearish.profitLoss).toBeLessThan(scenarios.moderateBearish.profitLoss);
      expect(scenarios.moderateBearish.profitLoss).toBeLessThan(scenarios.flat.profitLoss);
      expect(scenarios.flat.profitLoss).toBeLessThan(scenarios.moderateBullish.profitLoss);
      // Max profit caps above strike
      expect(scenarios.bullish.profitLoss).toBe(scenarios.veryBullish.profitLoss);
      expect(scenarios.veryBullish.profitLoss).toBe(scenarios.moonshot.profitLoss);
    });

    it('should show progression for unlimited upside portfolio (long calls)', () => {
      const input: ScenarioInput = {
        currentPrice: 50,
        shareCount: 0,
        shareBasis: 0,
        positions: [
          { type: 'CALL', strike: 55, contracts: 10, premium: 3, expiry: '2025-03-21' },
        ],
      };

      const scenarios = calculateAllScenarios(input);

      // Below strike: max loss (premium paid)
      expect(scenarios.bearish.profitLoss).toBe(-3000);
      expect(scenarios.moderateBearish.profitLoss).toBe(-3000);
      expect(scenarios.flat.profitLoss).toBe(-3000);

      // Above strike: unlimited upside
      expect(scenarios.moderateBullish.profitLoss).toBe(-500); // 10×100×(57.5-55) - 3000 = 2500 - 3000 = -500
      expect(scenarios.bullish.profitLoss).toBe(7000); // 10×100×(65-55) - 3000 = 10000 - 3000 = 7000
      expect(scenarios.veryBullish.profitLoss).toBe(17000); // 10×100×(75-55) - 3000 = 20000 - 3000 = 17000
      expect(scenarios.moonshot.profitLoss).toBe(42000); // 10×100×(100-55) - 3000 = 45000 - 3000 = 42000

      // Verify unlimited upside keeps increasing
      expect(scenarios.bullish.profitLoss).toBeLessThan(scenarios.veryBullish.profitLoss);
      expect(scenarios.veryBullish.profitLoss).toBeLessThan(scenarios.moonshot.profitLoss);
    });
  });

  describe('Real-World IBIT Portfolio Scenario', () => {
    it('should calculate realistic covered call portfolio P/L', () => {
      // Realistic IBIT portfolio: 500 shares at $40, 5 sold calls at $45
      const input: ScenarioInput = {
        currentPrice: 42.5,
        shareCount: 500,
        shareBasis: 40,
        positions: [
          { type: 'CALL', strike: 45, contracts: -5, premium: 1.85, expiry: '2025-03-21' },
        ],
      };

      const scenarios = calculateAllScenarios(input);

      // Bearish: -30% = $29.75
      expect(scenarios.bearish.profitLoss).toBeCloseTo(-4200, 0); // Shares: -$5125, Premium: +$925
      expect(scenarios.bearish.status).toBe('deep_loss');

      // Moderate Bearish: -15% = $36.125
      expect(scenarios.moderateBearish.profitLoss).toBeCloseTo(-1012.5, 0);
      expect(scenarios.moderateBearish.status).toBe('deep_loss');

      // Flat: 0% = $42.50
      expect(scenarios.flat.profitLoss).toBeCloseTo(2175, 0); // Shares: +$1250, Premium: +$925
      expect(scenarios.flat.status).toBe('profit');

      // Bullish: +30% = $55.25 (above strike, max profit)
      expect(scenarios.bullish.profitLoss).toBeCloseTo(3425, 0); // Share P/L: $7625 - Call loss: $4200 = $3425
      expect(scenarios.bullish.status).toBe('max_profit');

      // Moonshot: +100% = $85 (profit capped at same level)
      // At higher prices, share gains are perfectly offset by call losses
      // Covered call max profit = (strike - basis) × shares + premium
      expect(scenarios.moonshot.profitLoss).toBe(scenarios.bullish.profitLoss); // Capped at $3425
      expect(scenarios.moonshot.status).toBe('max_profit');
    });
  });
});
