/**
 * Coverage Grader
 *
 * Evaluates how well the portfolio is covered with options strategies.
 * Checks if shares are protected with sold calls/puts, spreads, etc.
 */

import type { CoverageInput, GradeResult } from '../../types/recommendations.ts';
import { scoreToGrade } from '../../types/recommendations.ts';

/**
 * Grade the portfolio's coverage (A+ to F)
 *
 * Logic:
 * - A+ (97-100): All shares fully covered + protective puts/spreads
 * - A (93-96): All shares covered with sold calls
 * - A- (90-92): All shares covered, minimal protection
 * - B (80-89): Most shares covered (80%+)
 * - C (70-79): Some coverage (50-80%)
 * - D (60-69): Minimal coverage (30-50%)
 * - F (<60): Little to no coverage (<30%)
 *
 * Coverage types (in order of quality):
 * 1. Protective puts (highest quality - downside protection)
 * 2. Covered calls (good - income generation)
 * 3. Collar strategies (covered call + protective put)
 *
 * @param input - Coverage metrics from portfolio
 * @returns Grade with feedback
 */
export function gradeCoverage(input: CoverageInput): GradeResult {
  const {
    shareCount,
    soldCallContracts,
    soldPutContracts,
    boughtCallContracts,
    boughtPutContracts,
  } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // No shares = N/A (return neutral grade)
  if (shareCount === 0) {
    return {
      score: 75,
      grade: 'C',
      feedback: 'No stock holdings to grade coverage',
      strengths: ['Options-only portfolio'],
      weaknesses: ['Coverage grading not applicable without shares'],
    };
  }

  // Calculate coverage percentages
  const soldCallsCoverage = Math.min((Math.abs(soldCallContracts) * 100) / shareCount, 1.0);
  // NOTE: Net protective coverage - accounts for protective puts minus any short puts in spreads
  // For now we use raw bought puts; in future, subtract short puts from protective count
  const protectivePutsCoverage = Math.min((Math.abs(boughtPutContracts) * 100) / shareCount, 1.0);
  const soldPutsCoverage = Math.abs(soldPutContracts) * 100; // CSPs = future share acquisition

  // Base coverage from sold calls
  let coverageScore = soldCallsCoverage * 100;

  // Bonus for protective strategies
  const hasProtectivePuts = protectivePutsCoverage > 0;
  // Allow tolerance for rounding (≥98% coverage counts as "fully covered")
  const hasCoveredCalls = soldCallsCoverage >= 0.98; // ~100% coverage
  const hasCollar = hasCoveredCalls && hasProtectivePuts;

  // Scoring logic
  if (hasCollar && protectivePutsCoverage >= 0.88) {
    // A+ territory: Covered calls + ~90%+ protective puts (full collar)
    // Tolerance allows for contract lot rounding (e.g., 99% coverage due to odd lots)
    coverageScore = 97 + Math.min((protectivePutsCoverage - 0.88) * 25, 3); // 97-100
    strengths.push('Collar strategy (covered calls + protective puts)');
    strengths.push('Full downside protection');
  } else if (hasCoveredCalls && protectivePutsCoverage >= 0.5) {
    // A: Fully covered + significant protection (50%+)
    coverageScore = 93 + Math.min((protectivePutsCoverage - 0.5) * 7.5, 3); // 93-96
    strengths.push('All shares covered with sold calls');
    strengths.push('Significant downside protection');
  } else if (hasCoveredCalls) {
    // A-: Fully covered, minimal protection
    coverageScore = 90 + Math.min(soldCallsCoverage * 2, 2); // 90-92
    strengths.push('All shares covered with sold calls');
    if (!hasProtectivePuts) {
      weaknesses.push('No downside protection (consider protective puts)');
    }
  } else if (soldCallsCoverage >= 0.8) {
    // B: Most shares covered
    coverageScore = 80 + (soldCallsCoverage - 0.8) * 50; // 80-90
    strengths.push('Most shares covered');
    weaknesses.push(`Only ${(soldCallsCoverage * 100).toFixed(0)}% of shares covered`);
  } else if (soldCallsCoverage >= 0.5) {
    // C: Some coverage
    coverageScore = 70 + (soldCallsCoverage - 0.5) * 33; // 70-80
    weaknesses.push(`Only ${(soldCallsCoverage * 100).toFixed(0)}% of shares covered`);
    weaknesses.push('Consider covering more shares with sold calls');
  } else if (soldCallsCoverage >= 0.3) {
    // D: Minimal coverage
    coverageScore = 60 + (soldCallsCoverage - 0.3) * 50; // 60-70
    weaknesses.push(`Only ${(soldCallsCoverage * 100).toFixed(0)}% of shares covered`);
    weaknesses.push('Majority of shares unprotected');
  } else {
    // F: Little to no coverage
    coverageScore = soldCallsCoverage * 200; // 0-60
    weaknesses.push('Minimal coverage - high risk exposure');
    weaknesses.push('Consider selling covered calls for income');
  }

  // Additional insights (these don't protect existing shares, so they don't affect coverage score)
  if (soldPutsCoverage > 0) {
    strengths.push(`${soldPutContracts} cash-secured puts (future share acquisition)`);
  }
  if (boughtCallContracts > 0) {
    strengths.push(`${boughtCallContracts} long calls (upside leverage)`);
  }

  const grade = scoreToGrade(coverageScore);
  const feedback = generateCoverageFeedback(coverageScore, soldCallsCoverage, hasProtectivePuts);

  return {
    score: Math.round(coverageScore),
    grade,
    feedback,
    strengths,
    weaknesses,
  };
}

/**
 * Generate human-readable feedback based on coverage score
 */
function generateCoverageFeedback(
  score: number,
  soldCallsCoverage: number,
  hasProtectivePuts: boolean,
): string {
  if (score >= 97) {
    return 'Excellent coverage with full downside protection.';
  }
  if (score >= 90) {
    return hasProtectivePuts
      ? 'Strong coverage with good downside protection.'
      : 'All shares covered, but consider adding protective puts.';
  }
  if (score >= 80) {
    return `Most shares covered (${(soldCallsCoverage * 100).toFixed(0)}%). Consider covering remaining shares.`;
  }
  if (score >= 70) {
    return 'Partial coverage. Increase covered call positions for better income.';
  }
  if (score >= 60) {
    return 'Minimal coverage. Majority of shares are unprotected.';
  }
  return 'Very low coverage. Implement covered call strategy for downside protection.';
}
