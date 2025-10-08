/**
 * Income Grader
 *
 * Evaluates the portfolio's income generation efficiency.
 * Checks premium collection, theta decay, and income yield.
 */

import type { IncomeInput, GradeResult } from '../../types/recommendations.ts';
import { scoreToGrade } from '../../types/recommendations.ts';

/**
 * Grade the portfolio's income generation (A+ to F)
 *
 * Logic:
 * - A+ (97-100): >8% annualized yield, strong theta (>$50/day per $100k)
 * - A (93-96): 5-8% annualized yield
 * - A- (90-92): 4-5% annualized yield
 * - B (80-89): 3-4% annualized yield
 * - C (70-79): 1.5-3% annualized yield
 * - D (60-69): 0.5-1.5% annualized yield
 * - F (<60): <0.5% annualized yield
 *
 * Income quality factors:
 * 1. Premium yield (% of portfolio value)
 * 2. Theta decay (daily income per $100k portfolio)
 * 3. Time horizon (avg days to expiry - longer = more consistent income)
 * 4. Position count (diversification of income sources)
 *
 * @param input - Income metrics from portfolio
 * @returns Grade with feedback
 */
export function gradeIncome(input: IncomeInput): GradeResult {
  const {
    totalPremiumCollected,
    portfolioValue,
    averageDaysToExpiry,
    soldPositions,
  } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Edge case: No portfolio value
  if (portfolioValue === 0) {
    return {
      score: 0,
      grade: 'F',
      feedback: 'Cannot calculate income yield - portfolio value is zero',
      strengths: [],
      weaknesses: ['No portfolio value to generate income from'],
    };
  }

  // Edge case: No sold positions
  if (soldPositions.length === 0) {
    return {
      score: 0,
      grade: 'F',
      feedback: 'No income-generating positions (no sold options)',
      strengths: [],
      weaknesses: [
        'No sold options (covered calls, CSPs, credit spreads)',
        'Consider selling covered calls for income',
      ],
    };
  }

  // Calculate premium yield (as % of portfolio)
  const premiumYield = (totalPremiumCollected / portfolioValue) * 100;

  // Calculate total theta (daily income)
  const totalTheta = soldPositions.reduce((sum, pos) => sum + Math.abs(pos.theta || 0), 0);

  // Normalize theta to per $100k portfolio (for easier comparison)
  const thetaPer100k = (totalTheta / portfolioValue) * 100000;

  // Annualize the yield based on average DTE
  // Formula: (premium / portfolio) * (365 / avgDTE) * 100
  // Clamp to 5-365 days to prevent division issues with noisy data
  const avgDTE = averageDaysToExpiry > 0
    ? Math.min(Math.max(averageDaysToExpiry, 5), 365)
    : 45; // Default 45 days if missing/zero
  const annualizedYield = (premiumYield * 365) / avgDTE;

  // Base score from annualized yield
  let incomeScore = 0;

  if (annualizedYield >= 8.0) {
    // A+ territory: >8% annualized
    incomeScore = 97 + Math.min((annualizedYield - 8.0) * 1.5, 3); // 97-100
    strengths.push(`Excellent yield: ${annualizedYield.toFixed(1)}% annualized`);
  } else if (annualizedYield >= 5.0) {
    // A territory: 5-8% annualized
    incomeScore = 93 + ((annualizedYield - 5.0) / 3.0) * 3; // 93-96
    strengths.push(`Strong yield: ${annualizedYield.toFixed(1)}% annualized`);
  } else if (annualizedYield >= 4.0) {
    // A- territory: 4-5% annualized
    incomeScore = 90 + ((annualizedYield - 4.0) / 1.0) * 2; // 90-92
    strengths.push(`Good yield: ${annualizedYield.toFixed(1)}% annualized`);
  } else if (annualizedYield >= 3.0) {
    // B territory: 3-4% annualized
    incomeScore = 80 + ((annualizedYield - 3.0) / 1.0) * 10; // 80-90
    strengths.push(`Moderate yield: ${annualizedYield.toFixed(1)}% annualized`);
  } else if (annualizedYield >= 1.5) {
    // C territory: 1.5-3% annualized
    incomeScore = 70 + ((annualizedYield - 1.5) / 1.5) * 10; // 70-80
    weaknesses.push(`Low yield: ${annualizedYield.toFixed(1)}% annualized`);
    weaknesses.push('Consider selling more premium or shorter DTEs');
  } else if (annualizedYield >= 0.5) {
    // D territory: 0.5-1.5% annualized
    incomeScore = 60 + ((annualizedYield - 0.5) / 1.0) * 10; // 60-70
    weaknesses.push(`Very low yield: ${annualizedYield.toFixed(1)}% annualized`);
    weaknesses.push('Insufficient premium collection');
  } else {
    // F territory: <0.5% annualized
    incomeScore = Math.min(annualizedYield * 120, 60); // 0-60
    weaknesses.push(`Minimal yield: ${annualizedYield.toFixed(1)}% annualized`);
    weaknesses.push('Portfolio not generating meaningful income');
  }

  // Bonus/penalty for theta efficiency
  if (thetaPer100k >= 50) {
    incomeScore = Math.min(incomeScore + 2, 100); // +2 bonus for strong theta
    strengths.push(`Strong theta: $${thetaPer100k.toFixed(0)}/day per $100k`);
  } else if (thetaPer100k < 20 && incomeScore >= 70 && incomeScore < 80) {
    // Only penalize weak theta in C-range (don't penalize higher grades)
    incomeScore = Math.max(incomeScore - 2, 70); // -2 penalty for weak theta
    weaknesses.push(`Weak theta: $${thetaPer100k.toFixed(0)}/day per $100k`);
  }

  // Bonus for diversification (4+ income positions)
  if (soldPositions.length >= 4) {
    strengths.push(`${soldPositions.length} income positions (well diversified)`);
  } else if (soldPositions.length === 1) {
    weaknesses.push('Only 1 income position (concentration risk)');
  }

  // Note on time horizon
  if (avgDTE > 60) {
    strengths.push(`Longer-term positions (${avgDTE.toFixed(0)} days avg) - more stable income`);
  } else if (avgDTE < 30) {
    strengths.push(`Short-term positions (${avgDTE.toFixed(0)} days avg) - frequent renewal`);
  }

  const grade = scoreToGrade(incomeScore);
  const feedback = generateIncomeFeedback(annualizedYield, thetaPer100k, grade);

  return {
    score: Math.round(incomeScore),
    grade,
    feedback,
    strengths,
    weaknesses,
  };
}

/**
 * Generate human-readable feedback based on income metrics
 */
function generateIncomeFeedback(
  annualizedYield: number,
  thetaPer100k: number,
  grade: string,
): string {
  if (annualizedYield >= 8.0) {
    return `Excellent income generation at ${annualizedYield.toFixed(1)}% annualized.`;
  }
  if (annualizedYield >= 5.0) {
    return `Strong income yield at ${annualizedYield.toFixed(1)}% annualized.`;
  }
  if (annualizedYield >= 4.0) {
    return `Good yield at ${annualizedYield.toFixed(1)}% annualized.`;
  }
  if (annualizedYield >= 3.0) {
    return `Moderate income yield at ${annualizedYield.toFixed(1)}% annualized. Consider increasing premium collection.`;
  }
  if (annualizedYield >= 1.5) {
    return `Low income yield at ${annualizedYield.toFixed(1)}% annualized. Sell more premium or reduce DTE.`;
  }
  if (annualizedYield >= 0.5) {
    return `Very low income yield at ${annualizedYield.toFixed(1)}% annualized. Portfolio is underutilized.`;
  }
  return `Minimal income generation. Portfolio not optimized for income.`;
}
