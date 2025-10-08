/**
 * Scenario Analysis Calculator
 *
 * Calculates P/L at different price levels (bearish to bullish).
 * Pure deterministic function - no AI calls.
 */

import type { ScenarioInput, ScenarioResult } from '../types/recommendations.ts';

/**
 * Calculate portfolio value at a specific price level
 *
 * Assumptions:
 * - All options are evaluated at expiry (intrinsic value only)
 * - Premium was already paid/collected upfront
 * - Negative contracts = SHORT positions, positive = LONG positions
 *
 * @param input - Current positions and share data
 * @param priceLevel - Target price to evaluate
 * @returns P/L and status at that price
 */
export function calculateScenario(
  input: ScenarioInput,
  priceLevel: number,
): ScenarioResult {
  const { currentPrice, positions, shareCount, shareBasis } = input;

  const percentChange = ((priceLevel - currentPrice) / currentPrice) * 100;

  // Calculate share value and P/L
  const shareValue = shareCount * priceLevel;
  const sharePL = shareCount * (priceLevel - shareBasis);

  // Calculate option values and P/L
  let optionValue = 0;
  let optionPL = 0;

  for (const position of positions) {
    const { type, strike, contracts, premium } = position;

    // Calculate intrinsic value per contract at expiry
    let intrinsicPerContract = 0;
    if (type === 'CALL') {
      intrinsicPerContract = Math.max(0, priceLevel - strike);
    } else {
      // PUT
      intrinsicPerContract = Math.max(0, strike - priceLevel);
    }

    // Total intrinsic value (positive for longs, negative for shorts if ITM)
    // For long positions (contracts > 0): we own the option, intrinsic is our value
    // For short positions (contracts < 0): we owe the intrinsic value
    const isLong = contracts > 0;
    const absContracts = Math.abs(contracts);
    const intrinsicValue = intrinsicPerContract * absContracts * 100;

    // Calculate P/L for this position
    let positionPL = 0;
    if (isLong) {
      // Long: we paid premium, we gain intrinsic value
      // P/L = intrinsic value - premium paid
      const premiumPaid = premium * absContracts * 100;
      positionPL = intrinsicValue - premiumPaid;
      optionValue += intrinsicValue;
    } else {
      // Short: we collected premium, we owe intrinsic value
      // P/L = premium collected - intrinsic value owed
      const premiumCollected = premium * absContracts * 100;
      positionPL = premiumCollected - intrinsicValue;
      optionValue -= intrinsicValue; // Negative because we owe it
    }

    optionPL += positionPL;
  }

  // Total portfolio value and P/L
  const portfolioValue = shareValue + optionValue;
  const profitLoss = sharePL + optionPL;

  // Determine status based on P/L thresholds
  let status: ScenarioResult['status'];
  if (profitLoss <= -1000) {
    status = 'deep_loss';
  } else if (profitLoss < -50) {
    status = 'loss';
  } else if (profitLoss >= -50 && profitLoss <= 50) {
    status = 'breakeven';
  } else if (profitLoss > 50) {
    // Check if we've hit max profit (all sold options fully ITM)
    // For now, use simple heuristic: if all short positions are ITM, it's max_profit
    const allShortOptionsITM = positions
      .filter((p) => p.contracts < 0)
      .every((p) => {
        if (p.type === 'CALL') {
          return priceLevel >= p.strike;
        } else {
          return priceLevel <= p.strike;
        }
      });

    // Also check if we have short options (otherwise can't have max profit)
    const hasShortOptions = positions.some((p) => p.contracts < 0);

    status = hasShortOptions && allShortOptionsITM ? 'max_profit' : 'profit';
  } else {
    status = 'breakeven';
  }

  return {
    priceLevel: Math.round(priceLevel * 100) / 100,
    percentChange: Math.round(percentChange * 100) / 100,
    portfolioValue: Math.round(portfolioValue * 100) / 100,
    profitLoss: Math.round(profitLoss * 100) / 100,
    status,
  };
}

/**
 * Calculate all 7 scenarios (bearish to moonshot)
 *
 * Levels match the approved spec: -30%, -15%, 0%, +15%, +30%, +50%, +100%
 *
 * @param input - Current positions and share data
 * @returns All scenario results
 */
export function calculateAllScenarios(input: ScenarioInput): {
  bearish: ScenarioResult;
  moderateBearish: ScenarioResult;
  flat: ScenarioResult;
  moderateBullish: ScenarioResult;
  bullish: ScenarioResult;
  veryBullish: ScenarioResult;
  moonshot: ScenarioResult;
} {
  const currentPrice = input.currentPrice;

  return {
    bearish: calculateScenario(input, currentPrice * 0.70), // -30%
    moderateBearish: calculateScenario(input, currentPrice * 0.85), // -15%
    flat: calculateScenario(input, currentPrice), // 0%
    moderateBullish: calculateScenario(input, currentPrice * 1.15), // +15%
    bullish: calculateScenario(input, currentPrice * 1.30), // +30%
    veryBullish: calculateScenario(input, currentPrice * 1.50), // +50%
    moonshot: calculateScenario(input, currentPrice * 2.00), // +100%
  };
}
