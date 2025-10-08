/**
 * Risk Grader
 *
 * Evaluates the portfolio's risk management.
 * Checks for naked positions, unlimited risk exposure, assignment risk.
 */

import type { RiskInput, GradeResult } from '../../types/recommendations.ts';
import { scoreToGrade } from '../../types/recommendations.ts';

/**
 * Grade the portfolio's risk management (A+ to F)
 *
 * Logic:
 * - A+ (97-100): All covered/defined risk, no naked positions, minimal assignment risk
 * - A (93-96): Mostly covered, 1-2 defined risk, minimal naked exposure
 * - A- (90-92): Mix of covered/defined, some assignment risk, no unlimited
 * - B (80-89): Some unlimited risk, multiple assignment risks
 * - C (70-79): Significant unlimited risk, high assignment risk
 * - D (60-69): Predominantly unlimited risk, many naked positions
 * - F (<60): Extreme risk - mostly unlimited, imminent assignment
 *
 * Risk factors:
 * 1. Risk profile distribution (covered > defined > unlimited)
 * 2. Number of naked positions
 * 3. Assignment risk (high delta + low DTE)
 * 4. Max loss exposure
 *
 * @param input - Risk metrics from portfolio
 * @returns Grade with feedback
 */
export function gradeRisk(input: RiskInput): GradeResult {
  const { strategies, nakedPositions, assignmentRiskPositions } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Edge case: No strategies
  if (strategies.length === 0) {
    // TODO: Revisit this neutral grade in Phase 5 with real data.
    // Pure equity positions aren't inherently risky (not leveraged),
    // so we might nudge this to low B (80-85) if the user is truly cash-and-shares only.
    // For now, C (75) signals "neutral - not enough data to grade options risk."
    return {
      score: 75,
      grade: 'C',
      feedback: 'No options strategies to grade risk',
      strengths: ['Stock-only portfolio'],
      weaknesses: ['Risk grading not applicable without options'],
    };
  }

  // Count risk profile distribution
  const coveredCount = strategies.filter((s) => s.riskProfile === 'covered').length;
  const definedCount = strategies.filter((s) => s.riskProfile === 'defined').length;
  const unlimitedCount = strategies.filter((s) => s.riskProfile === 'unlimited').length;
  const totalStrategies = strategies.length;

  // Calculate percentages
  const coveredPct = coveredCount / totalStrategies;
  const definedPct = definedCount / totalStrategies;
  const unlimitedPct = unlimitedCount / totalStrategies;

  // Base score from risk profile distribution
  let riskScore = 0;

  if (unlimitedPct === 0 && coveredPct >= 0.8) {
    // A+ territory: 80%+ covered, no unlimited risk
    riskScore = 97 + Math.min(coveredPct * 3, 3); // 97-100
    strengths.push(`${coveredCount} covered strategies (low risk)`);
    if (definedCount > 0) {
      strengths.push(`${definedCount} defined-risk spreads`);
    }
  } else if (unlimitedPct === 0 && coveredPct >= 0.5) {
    // A territory: 50%+ covered, no unlimited risk
    riskScore = 93 + ((coveredPct - 0.5) / 0.3) * 3; // 93-96
    strengths.push(`${coveredCount} covered strategies`);
    if (definedCount > 0) {
      strengths.push(`${definedCount} defined-risk spreads`);
    }
  } else if (unlimitedPct === 0) {
    // A- territory: No unlimited risk, but lower coverage
    // Give partial credit for defined risk (defined = half as good as covered)
    const riskCredit = coveredPct + (definedPct * 0.5);
    riskScore = 90 + (riskCredit * 2); // 90-92
    strengths.push('No unlimited risk strategies');
    if (coveredCount > 0) {
      strengths.push(`${coveredCount} covered positions`);
    }
    if (definedCount > 0) {
      strengths.push(`${definedCount} defined-risk positions`);
    }
  } else if (unlimitedPct <= 0.3) {
    // B territory: Up to 30% unlimited risk
    riskScore = 80 + (1 - unlimitedPct) * 14; // 80-90
    if (coveredCount > 0) {
      strengths.push(`${coveredCount} covered strategies reduce risk`);
    }
    weaknesses.push(`${unlimitedCount} unlimited risk strategies`);
  } else if (unlimitedPct <= 0.6) {
    // C territory: 30-60% unlimited risk
    riskScore = 70 + (0.6 - unlimitedPct) * 33; // 70-80
    weaknesses.push(`${unlimitedCount} unlimited risk strategies (${(unlimitedPct * 100).toFixed(0)}%)`);
    weaknesses.push('High exposure to unlimited losses');
  } else if (unlimitedPct <= 0.85) {
    // D territory: 60-85% unlimited risk
    riskScore = 60 + (0.85 - unlimitedPct) * 40; // 60-70
    weaknesses.push(`Predominantly unlimited risk (${(unlimitedPct * 100).toFixed(0)}%)`);
    weaknesses.push('Portfolio exposed to significant losses');
  } else {
    // F territory: >85% unlimited risk
    riskScore = Math.max(60 - unlimitedPct * 60, 0); // 0-60
    weaknesses.push(`Extreme risk: ${unlimitedCount}/${totalStrategies} unlimited strategies`);
    weaknesses.push('Portfolio at risk of catastrophic losses');
  }

  // Penalty for naked positions (light penalty since already counted in unlimited%)
  if (nakedPositions > 0) {
    const penalty = Math.min(nakedPositions * 2, 10); // -2 per naked, max -10
    riskScore = Math.max(riskScore - penalty, 0);
    weaknesses.push(`${nakedPositions} naked position${nakedPositions > 1 ? 's' : ''} (uncovered risk)`);
    if (nakedPositions >= 3) {
      weaknesses.push('High naked exposure - consider covering');
    }
  } else if (riskScore >= 93) {
    strengths.push('No naked positions');
  }

  // Assignment risk analysis
  const highRiskAssignments = assignmentRiskPositions.filter(
    (p) => Math.abs(p.delta) >= 0.4 && p.daysToExpiry <= 14,
  ).length;
  const moderateRiskAssignments = assignmentRiskPositions.filter(
    (p) => Math.abs(p.delta) >= 0.3 && p.daysToExpiry <= 30,
  ).length - highRiskAssignments;

  if (highRiskAssignments > 0) {
    const penalty = Math.min(highRiskAssignments * 5, 10); // -5 per high-risk, max -10
    riskScore = Math.max(riskScore - penalty, 0);
    weaknesses.push(`${highRiskAssignments} position${highRiskAssignments > 1 ? 's' : ''} with high assignment risk`);
    weaknesses.push('Monitor closely for potential assignment');
  } else if (moderateRiskAssignments > 0) {
    weaknesses.push(`${moderateRiskAssignments} position${moderateRiskAssignments > 1 ? 's' : ''} with moderate assignment risk`);
  } else if (assignmentRiskPositions.length === 0 && riskScore >= 90) {
    strengths.push('No immediate assignment risk');
  }

  // Note on max loss
  const unlimitedStrategies = strategies.filter((s) => s.maxLoss === null);
  if (unlimitedStrategies.length > 0 && riskScore < 90) {
    weaknesses.push(`${unlimitedStrategies.length} strategies with unlimited max loss`);
  }

  const grade = scoreToGrade(riskScore);
  const feedback = generateRiskFeedback(riskScore, unlimitedPct, nakedPositions);

  return {
    score: Math.round(riskScore),
    grade,
    feedback,
    strengths,
    weaknesses,
  };
}

/**
 * Generate human-readable feedback based on risk score
 */
function generateRiskFeedback(
  score: number,
  unlimitedPct: number,
  nakedPositions: number,
): string {
  if (score >= 97) {
    return 'Excellent risk management with minimal exposure.';
  }
  if (score >= 93) {
    return 'Strong risk management with mostly covered strategies.';
  }
  if (score >= 90) {
    return 'Good risk management with no unlimited exposure.';
  }
  if (score >= 80) {
    return `Moderate risk with ${(unlimitedPct * 100).toFixed(0)}% unlimited strategies.`;
  }
  if (score >= 70) {
    return `Elevated risk. Consider reducing unlimited exposure.`;
  }
  if (score >= 60) {
    return `High risk portfolio. ${nakedPositions > 0 ? `${nakedPositions} naked positions.` : 'Predominantly unlimited risk.'}`;
  }
  return 'Extreme risk. Portfolio exposed to catastrophic losses.';
}
