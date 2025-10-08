/**
 * Upside Grader
 *
 * Evaluates the portfolio's upside potential.
 * Checks for unlimited profit strategies, bought calls, uncapped gains.
 */

import type { UpsideInput, GradeResult } from '../../types/recommendations.ts';
import { scoreToGrade } from '../../types/recommendations.ts';

/**
 * Grade the portfolio's upside potential (A+ to F)
 *
 * Logic:
 * - A+ (97-100): Multiple unlimited upside strategies + long calls with good delta
 * - A (93-96): Unlimited upside with strong long call positions
 * - A- (90-92): Some unlimited upside or multiple long calls
 * - B (80-89): Limited upside strategies or weak long calls
 * - C (70-79): Minimal upside, mostly capped
 * - D (60-69): All capped with very low max profit
 * - F (<60): No upside potential, all positions capped near zero
 *
 * Upside factors:
 * 1. Number of strategies with unlimited profit (maxProfit === null)
 * 2. Bought call positions (quantity and quality)
 * 3. Delta and strike levels relative to current price
 * 4. Percentage of portfolio with uncapped upside
 *
 * @param input - Upside metrics from portfolio
 * @returns Grade with feedback
 */
export function gradeUpside(input: UpsideInput): GradeResult {
  const { strategies, boughtCallPositions, currentPrice } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Edge case: No strategies
  if (strategies.length === 0) {
    // TODO: Revisit in Phase 5. Stock-only portfolios have unlimited upside potential.
    // For now, neutral C indicates "not applicable - no options to grade."
    return {
      score: 75,
      grade: 'C',
      feedback: 'No options strategies to grade upside',
      strengths: ['Stock-only portfolio (unlimited upside potential)'],
      weaknesses: ['Upside grading not applicable without options'],
    };
  }

  // Count unlimited vs capped strategies
  const unlimitedCount = strategies.filter((s) => s.maxProfit === null).length;
  const cappedCount = strategies.filter((s) => s.maxProfit !== null).length;
  const totalStrategies = strategies.length;

  const unlimitedPct = unlimitedCount / totalStrategies;

  // Analyze bought call positions
  const totalBoughtCalls = boughtCallPositions.length;
  const itmCalls = boughtCallPositions.filter((c) => c.strike < currentPrice).length;
  const atmCalls = boughtCallPositions.filter(
    (c) => Math.abs(c.strike - currentPrice) / currentPrice < 0.05,
  ).length;
  const otmCalls = boughtCallPositions.filter((c) => c.strike > currentPrice).length;

  // Calculate average delta of long calls (higher delta = more upside leverage)
  const avgCallDelta =
    totalBoughtCalls > 0
      ? boughtCallPositions.reduce((sum, c) => sum + Math.abs(c.delta), 0) / totalBoughtCalls
      : 0;

  // Base score from unlimited upside percentage
  let upsideScore = 0;

  if (unlimitedPct >= 0.5 && totalBoughtCalls >= 2) {
    // A+ territory: 50%+ unlimited + multiple long calls
    upsideScore = 97 + Math.min(unlimitedPct * 3, 3); // 97-100
    strengths.push(`${unlimitedCount} unlimited upside strategies`);
    strengths.push(`${totalBoughtCalls} long call positions (leverage)`);
    if (avgCallDelta >= 0.5) {
      strengths.push(`Strong delta (${(avgCallDelta * 100).toFixed(0)}% avg)`);
    }
  } else if ((unlimitedPct >= 0.4 && totalBoughtCalls >= 1) || totalBoughtCalls >= 2) {
    // A territory: 40%+ unlimited with calls OR 2+ long calls
    upsideScore = 93 + Math.min((unlimitedPct * 5 + totalBoughtCalls * 0.5), 3); // 93-96
    if (unlimitedCount > 0) {
      strengths.push(`${unlimitedCount} unlimited upside strategies`);
    }
    if (totalBoughtCalls > 0) {
      strengths.push(`${totalBoughtCalls} long call positions`);
    }
  } else if (unlimitedPct > 0 || totalBoughtCalls >= 1) {
    // A- territory: Some unlimited upside OR at least 1 long call
    upsideScore = 90 + Math.min((unlimitedPct * 5 + totalBoughtCalls * 0.5), 2); // 90-92
    if (unlimitedCount > 0) {
      strengths.push(`${unlimitedCount} unlimited upside strategy`);
    }
    if (totalBoughtCalls > 0) {
      strengths.push(`${totalBoughtCalls} long call (upside leverage)`);
    }
  } else {
    // All capped strategies - no unlimited upside
    // For capped portfolios, we grade conservatively since upside is limited
    // Score based on number of strategies (diversification) and existence of upside at all

    // Calculate average max profit per strategy
    const cappedStrategies = strategies.filter((s) => s.maxProfit !== null);
    const avgMaxProfit =
      cappedStrategies.length > 0
        ? cappedStrategies.reduce((sum, s) => sum + (s.maxProfit || 0), 0) / cappedStrategies.length
        : 0;

    // All capped = B-F range (80-59)
    // Base score on absolute max profit levels
    if (avgMaxProfit >= 1000) {
      // B territory: $1000+ avg max profit
      upsideScore = 80 + Math.min((avgMaxProfit - 1000) / 100, 10); // 80-90
      strengths.push(`Average max profit: $${avgMaxProfit.toFixed(0)}`);
      weaknesses.push('All positions capped (no unlimited upside)');
    } else if (avgMaxProfit >= 500) {
      // C territory: $500-$1000 avg max profit
      upsideScore = 70 + ((avgMaxProfit - 500) / 500) * 10; // 70-80
      weaknesses.push(`Limited upside: avg $${avgMaxProfit.toFixed(0)} max profit`);
      weaknesses.push('Consider adding long calls for unlimited upside');
    } else if (avgMaxProfit >= 200) {
      // D territory: $200-$500 avg max profit
      upsideScore = 60 + ((avgMaxProfit - 200) / 300) * 10; // 60-70
      weaknesses.push(`Very limited upside: avg $${avgMaxProfit.toFixed(0)} max profit`);
      weaknesses.push('Portfolio lacks upside potential');
    } else {
      // F territory: <$200 avg max profit
      upsideScore = Math.min((avgMaxProfit / 200) * 60, 60); // 0-60
      weaknesses.push(`Minimal upside: avg $${avgMaxProfit.toFixed(0)} max profit`);
      weaknesses.push('Portfolio has almost no upside potential');
    }
  }

  // Bonus for ITM/ATM long calls (already in-the-money = immediate leverage)
  if (itmCalls > 0) {
    upsideScore = Math.min(upsideScore + 2, 100); // +2 bonus for ITM calls
    strengths.push(`${itmCalls} ITM long call${itmCalls > 1 ? 's' : ''} (immediate upside)`);
  } else if (atmCalls > 0) {
    upsideScore = Math.min(upsideScore + 1, 100); // +1 bonus for ATM calls
    strengths.push(`${atmCalls} ATM long call${atmCalls > 1 ? 's' : ''}`);
  }

  // Note on OTM calls
  if (otmCalls > 0 && upsideScore >= 90) {
    strengths.push(`${otmCalls} OTM long call${otmCalls > 1 ? 's' : ''} (lottery tickets)`);
  }

  // Penalty for all-capped portfolio
  if (unlimitedCount === 0 && totalBoughtCalls === 0 && upsideScore >= 80) {
    weaknesses.push('No unlimited upside strategies (all positions capped)');
  }

  const grade = scoreToGrade(upsideScore);
  const feedback = generateUpsideFeedback(upsideScore, unlimitedCount, totalBoughtCalls);

  return {
    score: Math.round(upsideScore),
    grade,
    feedback,
    strengths,
    weaknesses,
  };
}

/**
 * Generate human-readable feedback based on upside score
 */
function generateUpsideFeedback(
  score: number,
  unlimitedCount: number,
  totalBoughtCalls: number,
): string {
  if (score >= 97) {
    return `Excellent upside potential with ${unlimitedCount} unlimited strategies and ${totalBoughtCalls} long calls.`;
  }
  if (score >= 93) {
    return `Strong upside potential with ${unlimitedCount > 0 ? 'unlimited strategies' : `${totalBoughtCalls} long calls`}.`;
  }
  if (score >= 90) {
    return 'Good upside potential with some unlimited exposure.';
  }
  if (score >= 80) {
    return 'Moderate upside, but all positions capped. Consider long calls.';
  }
  if (score >= 70) {
    return 'Limited upside. Add long calls for unlimited profit potential.';
  }
  if (score >= 60) {
    return 'Very limited upside. Portfolio lacks growth potential.';
  }
  return 'Minimal upside. Portfolio positioned for income, not growth.';
}
