/**
 * Prompts for GPT-5 Recommendations
 *
 * Contains the system prompt and user prompt for generating
 * AI-powered upgrade recommendations and execution plans.
 */

import type { GradeResult, ScenarioResult } from '../../types/recommendations.ts';

export const SYSTEM_PROMPT = `You are an expert options trading coach analyzing a portfolio of stock and options positions.

Your job is to:
1. Review the deterministic grading results (coverage, income, risk, upside, sophistication)
2. Review the scenario analysis showing P/L at different price levels
3. Generate actionable upgrade recommendations to improve the portfolio grade
4. Create a step-by-step execution plan

**Guidelines:**
- Be specific with strike prices, expirations, and quantities
- Prioritize low-risk upgrades first
- Explain the reasoning behind each recommendation
- Consider the current market context
- Don't cap upside unless necessary for risk management
- Respect the user's risk tolerance based on current positions

**Output Format:**
Provide a structured JSON response with:
- Overall assessment (2-3 sentences)
- Upgrade steps to reach A+ (array of specific actions)
- Upgrade steps to reach A (array of specific actions)
- Next immediate upgrade steps (array of specific actions)
- Execution plan (step-by-step guidance)
- Market context (current conditions assessment)
`;

/**
 * Build the user prompt with grading and scenario data
 */
export function buildRecommendationsPrompt(
  ticker: string,
  currentPrice: number,
  grades: {
    coverage: GradeResult;
    income: GradeResult;
    risk: GradeResult;
    upside: GradeResult;
    sophistication: GradeResult;
  },
  scenarios: {
    bearish: ScenarioResult;
    moderateBearish: ScenarioResult;
    flat: ScenarioResult;
    moderateBullish: ScenarioResult;
    bullish: ScenarioResult;
    veryBullish: ScenarioResult;
    moonshot: ScenarioResult;
  },
  overallGrade: string,
  overallScore: number,
): string {
  return `Analyze this ${ticker} portfolio and provide upgrade recommendations.

**Current Grade:** ${overallGrade} (${overallScore}/100)

**Grading Breakdown:**
- Coverage: ${grades.coverage.grade} (${grades.coverage.score}/100)
  ${grades.coverage.feedback}
  Strengths: ${grades.coverage.strengths.join(', ') || 'None'}
  Weaknesses: ${grades.coverage.weaknesses.join(', ') || 'None'}

- Income: ${grades.income.grade} (${grades.income.score}/100)
  ${grades.income.feedback}
  Strengths: ${grades.income.strengths.join(', ') || 'None'}
  Weaknesses: ${grades.income.weaknesses.join(', ') || 'None'}

- Risk: ${grades.risk.grade} (${grades.risk.score}/100)
  ${grades.risk.feedback}
  Strengths: ${grades.risk.strengths.join(', ') || 'None'}
  Weaknesses: ${grades.risk.weaknesses.join(', ') || 'None'}

- Upside: ${grades.upside.grade} (${grades.upside.score}/100)
  ${grades.upside.feedback}
  Strengths: ${grades.upside.strengths.join(', ') || 'None'}
  Weaknesses: ${grades.upside.weaknesses.join(', ') || 'None'}

- Sophistication: ${grades.sophistication.grade} (${grades.sophistication.score}/100)
  ${grades.sophistication.feedback}
  Strengths: ${grades.sophistication.strengths.join(', ') || 'None'}
  Weaknesses: ${grades.sophistication.weaknesses.join(', ') || 'None'}

**Scenario Analysis (Current Price: $${currentPrice}):**
- Bearish (-30%): $${scenarios.bearish.priceLevel.toFixed(2)} → P/L: $${scenarios.bearish.profitLoss.toFixed(0)} (${scenarios.bearish.status})
- Moderate Bearish (-15%): $${scenarios.moderateBearish.priceLevel.toFixed(2)} → P/L: $${scenarios.moderateBearish.profitLoss.toFixed(0)} (${scenarios.moderateBearish.status})
- Flat (0%): $${scenarios.flat.priceLevel.toFixed(2)} → P/L: $${scenarios.flat.profitLoss.toFixed(0)} (${scenarios.flat.status})
- Moderate Bullish (+15%): $${scenarios.moderateBullish.priceLevel.toFixed(2)} → P/L: $${scenarios.moderateBullish.profitLoss.toFixed(0)} (${scenarios.moderateBullish.status})
- Bullish (+30%): $${scenarios.bullish.priceLevel.toFixed(2)} → P/L: $${scenarios.bullish.profitLoss.toFixed(0)} (${scenarios.bullish.status})
- Very Bullish (+50%): $${scenarios.veryBullish.priceLevel.toFixed(2)} → P/L: $${scenarios.veryBullish.profitLoss.toFixed(0)} (${scenarios.veryBullish.status})
- Moonshot (+100%): $${scenarios.moonshot.priceLevel.toFixed(2)} → P/L: $${scenarios.moonshot.profitLoss.toFixed(0)} (${scenarios.moonshot.status})

**Your Task:**
Generate specific, actionable upgrade recommendations to improve this portfolio's grade. Include:
1. Immediate next steps to improve the current grade
2. Steps to reach A grade
3. Steps to reach A+ grade
4. A comprehensive execution plan
5. Current market context assessment

Return your response as a JSON object with this structure:
{
  "summary": "2-3 sentence overall assessment",
  "upgradesToAPlus": [
    { "action": "Specific action", "reasoning": "Why this helps", "impact": "Grade change", "priority": "immediate|short_term|long_term", "riskLevel": "low|medium|high" }
  ],
  "upgradesToA": [...],
  "nextUpgrades": [...],
  "executionPlan": "Step-by-step action plan",
  "marketContext": "Current market conditions assessment"
}
`;
}
