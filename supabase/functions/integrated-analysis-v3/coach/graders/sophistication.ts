/**
 * Sophistication Grader
 *
 * Evaluates the complexity and sophistication of the options strategies.
 * Checks for advanced strategies like ratio spreads, butterflies, calendars.
 */

import type { StrategyInput, GradeResult } from '../../types/recommendations.ts';
import { scoreToGrade } from '../../types/recommendations.ts';

/**
 * Grade the portfolio's strategy sophistication (A+ to F)
 *
 * Logic:
 * - A+ (97-100): Advanced 4+ leg strategies (iron condors, butterflies, complex spreads)
 * - A (93-96): Multiple 3-leg strategies or diverse 2-leg strategies
 * - A- (90-92): Mix of 2-3 leg strategies
 * - B (80-89): Basic 2-leg spreads
 * - C (70-79): Simple covered strategies (1-2 legs, basic)
 * - D (60-69): Minimal strategy sophistication
 * - F (<60): No defined strategies, just single positions
 *
 * Sophistication factors:
 * 1. Leg count (4+ legs = most sophisticated)
 * 2. Strategy diversity (number of different strategy types)
 * 3. Advanced strategy detection (iron condor, butterfly, ratio, calendar)
 * 4. Total number of strategies
 *
 * @param input - Strategy metrics from portfolio
 * @returns Grade with feedback
 */
export function gradeSophistication(input: StrategyInput): GradeResult {
  const { strategies, positions } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Edge case: No defined strategies
  if (strategies.length === 0) {
    // Check if there are any positions at all
    if (positions.length === 0) {
      return {
        score: 0,
        grade: 'F',
        feedback: 'No positions or strategies',
        strengths: [],
        weaknesses: ['No options positions'],
      };
    }

    // Has positions but no strategies = single-leg positions only
    return {
      score: 50,
      grade: 'F',
      feedback: 'No multi-leg strategies - single positions only',
      strengths: [],
      weaknesses: [
        `${positions.length} single-leg positions (no spreads or complex strategies)`,
        'Consider implementing spreads or covered strategies',
      ],
    };
  }

  // Analyze strategy complexity
  const maxLegCount = Math.max(...strategies.map((s) => s.legCount));
  const avgLegCount = strategies.reduce((sum, s) => sum + s.legCount, 0) / strategies.length;
  const uniqueStrategyLabels = new Set(strategies.map((s) => s.label)).size;

  // Count strategies by leg count
  const fourPlusLeg = strategies.filter((s) => s.legCount >= 4).length;
  const threeLeg = strategies.filter((s) => s.legCount === 3).length;
  const twoLeg = strategies.filter((s) => s.legCount === 2).length;
  const oneLeg = strategies.filter((s) => s.legCount === 1).length;

  // Detect advanced strategy patterns by label keywords (4+ legs only)
  // Advanced strategies are defined as 4+ leg complex strategies
  const advancedKeywords = [
    'iron condor',
    'iron butterfly',
    'condor',
    'jade lizard',
    'box spread',
  ];
  const advancedCount = strategies.filter((s) => {
    const label = s.label.toLowerCase();
    return s.legCount >= 4 && advancedKeywords.some((keyword) => label.includes(keyword));
  }).length;

  // Base score from max leg count and diversity
  let sophisticationScore = 0;

  if (fourPlusLeg > 0 || advancedCount >= 2) {
    // A+ territory: 4+ leg strategies OR multiple advanced strategies
    sophisticationScore = 97 + Math.min(fourPlusLeg + advancedCount, 3); // 97-100
    if (fourPlusLeg > 0) {
      strengths.push(`${fourPlusLeg} advanced 4+ leg strateg${fourPlusLeg > 1 ? 'ies' : 'y'}`);
    }
    if (advancedCount > 0) {
      strengths.push(`${advancedCount} sophisticated strateg${advancedCount > 1 ? 'ies' : 'y'} (iron condor, butterfly, etc.)`);
    }
    if (uniqueStrategyLabels >= 3) {
      strengths.push(`${uniqueStrategyLabels} different strategy types (well diversified)`);
    }
  } else if (threeLeg >= 2 || (threeLeg >= 1 && twoLeg >= 2)) {
    // A territory: Multiple 3-leg strategies OR mix of 3-leg and 2-leg
    sophisticationScore = 93 + Math.min(threeLeg, 3); // 93-96
    strengths.push(`${threeLeg} three-leg strateg${threeLeg > 1 ? 'ies' : 'y'}`);
    if (uniqueStrategyLabels >= 2) {
      strengths.push(`${uniqueStrategyLabels} different strategy types`);
    }
  } else if (threeLeg >= 1 || twoLeg >= 3) {
    // A- territory: At least 1 three-leg OR multiple 2-leg spreads
    sophisticationScore = 90 + Math.min(threeLeg * 2 + twoLeg * 0.5, 2); // 90-92
    if (threeLeg > 0) {
      strengths.push(`${threeLeg} three-leg strategy`);
    }
    if (twoLeg >= 2) {
      strengths.push(`${twoLeg} two-leg spreads`);
    }
  } else if (twoLeg >= 1) {
    // B territory: Basic 2-leg spreads
    sophisticationScore = 80 + Math.min(twoLeg * 2 + uniqueStrategyLabels, 10); // 80-90
    strengths.push(`${twoLeg} two-leg spread${twoLeg > 1 ? 's' : ''} (basic sophistication)`);
    if (uniqueStrategyLabels === 1 && twoLeg === 1) {
      weaknesses.push('Limited diversity - consider adding more strategy types');
    }
  } else if (oneLeg >= 2) {
    // C territory: Simple covered strategies
    sophisticationScore = 70 + Math.min(oneLeg, 10); // 70-80
    strengths.push(`${oneLeg} covered positions (basic income strategies)`);
    weaknesses.push('No multi-leg spreads - consider credit/debit spreads');
  } else {
    // D-F territory: Minimal sophistication
    sophisticationScore = 60 + (oneLeg * 5); // 60-65
    weaknesses.push('Very limited strategy sophistication');
    weaknesses.push('Portfolio lacks complex strategies');
  }

  // Bonus for strategy diversity (3+ different types)
  if (uniqueStrategyLabels >= 4 && sophisticationScore >= 90) {
    sophisticationScore = Math.min(sophisticationScore + 2, 100); // +2 bonus for high diversity
    strengths.push('Excellent strategy diversity');
  }

  // Note on average leg count for context
  if (avgLegCount >= 3 && sophisticationScore >= 93) {
    strengths.push(`High average complexity (${avgLegCount.toFixed(1)} legs per strategy)`);
  } else if (avgLegCount < 1.5 && sophisticationScore < 80) {
    weaknesses.push(`Low complexity (${avgLegCount.toFixed(1)} legs avg) - mostly single positions`);
  }

  const grade = scoreToGrade(sophisticationScore);
  const feedback = generateSophisticationFeedback(sophisticationScore, maxLegCount, uniqueStrategyLabels);

  return {
    score: Math.round(sophisticationScore),
    grade,
    feedback,
    strengths,
    weaknesses,
  };
}

/**
 * Generate human-readable feedback based on sophistication score
 */
function generateSophisticationFeedback(
  score: number,
  maxLegCount: number,
  uniqueStrategyLabels: number,
): string {
  if (score >= 97) {
    return `Highly sophisticated portfolio with ${maxLegCount}-leg strategies and advanced techniques.`;
  }
  if (score >= 93) {
    return `Strong sophistication with ${uniqueStrategyLabels} strategy types and multi-leg positions.`;
  }
  if (score >= 90) {
    return 'Good strategy sophistication with mix of spreads.';
  }
  if (score >= 80) {
    return 'Moderate sophistication with basic spreads. Consider 3+ leg strategies.';
  }
  if (score >= 70) {
    return 'Basic strategies (covered positions). Add spreads for more sophistication.';
  }
  if (score >= 60) {
    return 'Limited sophistication. Implement multi-leg spreads.';
  }
  return 'Minimal strategy sophistication. Portfolio uses only simple positions.';
}
