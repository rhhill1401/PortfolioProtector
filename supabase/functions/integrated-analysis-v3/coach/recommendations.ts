/**
 * Recommendations Orchestrator
 *
 * Coordinates all grading functions, scenario analysis, and AI recommendations.
 * This is the main entry point for the recommendations system.
 */

import type { RecommendationsResult } from '../types/recommendations.ts';
import { GRADE_WEIGHTS, scoreToGrade } from '../types/recommendations.ts';
import { gradeCoverage } from './graders/coverage.ts';
import { gradeIncome } from './graders/income.ts';
import { gradeRisk } from './graders/risk.ts';
import { gradeUpside } from './graders/upside.ts';
import { gradeSophistication } from './graders/sophistication.ts';
import { calculateAllScenarios } from './scenario.ts';
import { SYSTEM_PROMPT, buildRecommendationsPrompt } from './prompts/recommendations.ts';
import { callOpenAI } from '../clients/openai.ts';

/**
 * Input data structure for recommendations
 */
export interface RecommendationsInput {
  ticker: string;
  currentPrice: number;
  shareCount: number;
  shareBasis?: number; // Optional - defaults to currentPrice if missing
  portfolioValue: number;
  positions: Array<{
    type: 'CALL' | 'PUT';
    strike: number;
    contracts: number; // Negative = SHORT, Positive = LONG
    premium: number;
    expiry: string;
    delta: number;
    theta: number;
  }>;
  strategies: Array<{
    label: string;
    legCount: number;
    riskProfile: 'covered' | 'defined' | 'unlimited';
    maxProfit: number | null;
    maxLoss: number | null;
    tags?: string[];
  }>;
}

/**
 * Expected structure of AI response from GPT-5
 */
interface RecommendationsAIResponse {
  summary: string;
  upgradesToAPlus: Array<{
    action: string;
    reasoning: string;
    impact: string;
    priority: 'immediate' | 'short_term' | 'long_term';
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  upgradesToA: Array<{
    action: string;
    reasoning: string;
    impact: string;
    priority: 'immediate' | 'short_term' | 'long_term';
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  nextUpgrades: Array<{
    action: string;
    reasoning: string;
    impact: string;
    priority: 'immediate' | 'short_term' | 'long_term';
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  executionPlan: string;
  marketContext: string;
}

/**
 * Validate AI response structure at runtime
 */
function validateAIResponse(data: unknown): data is RecommendationsAIResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.summary !== 'string') return false;
  if (!Array.isArray(obj.upgradesToAPlus)) return false;
  if (!Array.isArray(obj.upgradesToA)) return false;
  if (!Array.isArray(obj.nextUpgrades)) return false;
  if (typeof obj.executionPlan !== 'string') return false;
  if (typeof obj.marketContext !== 'string') return false;

  return true;
}

/**
 * Generate comprehensive recommendations for a portfolio
 *
 * Phase 5 Implementation: Wires all graders, scenario analysis, and AI recommendations
 *
 * @param input - Portfolio data with positions, strategies, and metrics
 * @returns Full recommendations with grades, scenarios, and AI upgrade suggestions
 */
export async function generateRecommendations(input: RecommendationsInput): Promise<RecommendationsResult> {
  // ============================================================================
  // Step 1: Extract and validate data
  // ============================================================================
  const {
    ticker,
    currentPrice,
    shareCount,
    portfolioValue,
    positions,
    strategies,
  } = input;

  // Fallback: If shareBasis is missing, assume current price (conservative)
  const shareBasis = input.shareBasis ?? currentPrice;

  // ============================================================================
  // Step 2: Run all 5 graders (pure deterministic functions)
  // ============================================================================

  // 2.1: Coverage Grader
  const soldCallContracts = positions
    .filter((p) => p.type === 'CALL' && p.contracts < 0)
    .reduce((sum, p) => sum + p.contracts, 0); // Already negative

  const soldPutContracts = positions
    .filter((p) => p.type === 'PUT' && p.contracts < 0)
    .reduce((sum, p) => sum + p.contracts, 0);

  const boughtCallContracts = positions
    .filter((p) => p.type === 'CALL' && p.contracts > 0)
    .reduce((sum, p) => sum + p.contracts, 0);

  const boughtPutContracts = positions
    .filter((p) => p.type === 'PUT' && p.contracts > 0)
    .reduce((sum, p) => sum + p.contracts, 0);

  const coverageGrade = gradeCoverage({
    shareCount,
    currentPrice,
    soldCallContracts,
    soldPutContracts,
    boughtCallContracts,
    boughtPutContracts,
  });

  // 2.2: Income Grader
  const soldPositions = positions
    .filter((p) => p.contracts < 0)
    .map((p) => ({
      type: p.type,
      contracts: Math.abs(p.contracts),
      premium: p.premium,
      theta: p.theta,
    }));

  const totalPremiumCollected = soldPositions.reduce(
    (sum, p) => sum + p.premium * p.contracts * 100,
    0,
  );

  const averageDaysToExpiry =
    positions.length > 0
      ? positions.reduce((sum, p) => {
          const daysToExpiry = Math.max(
            0,
            Math.floor((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          );
          return sum + daysToExpiry;
        }, 0) / positions.length
      : 0;

  const incomeGrade = gradeIncome({
    totalPremiumCollected,
    portfolioValue,
    averageDaysToExpiry,
    soldPositions,
  });

  // 2.3: Risk Grader
  const nakedPositions = positions.filter((p) => {
    if (p.contracts >= 0) return false; // Only short positions can be naked
    // Simple heuristic: sold calls/puts without corresponding shares/coverage
    if (p.type === 'CALL') {
      const soldCallContracts = Math.abs(p.contracts);
      return soldCallContracts * 100 > shareCount;
    }
    return false; // Puts are harder to determine if naked without cash data
  }).length;

  const assignmentRiskPositions = positions
    .filter((p) => p.contracts < 0) // Short positions only
    .map((p) => {
      const daysToExpiry = Math.max(
        0,
        Math.floor((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      return {
        delta: Math.abs(p.delta),
        daysToExpiry,
      };
    });

  const riskGrade = gradeRisk({
    strategies,
    nakedPositions,
    assignmentRiskPositions,
  });

  // 2.4: Upside Grader
  const boughtCallPositions = positions
    .filter((p) => p.type === 'CALL' && p.contracts > 0)
    .map((p) => ({
      delta: p.delta,
      strike: p.strike,
      expiry: p.expiry,
    }));

  const upsideGrade = gradeUpside({
    strategies,
    boughtCallPositions,
    currentPrice,
  });

  // 2.5: Sophistication Grader
  const sophisticationGrade = gradeSophistication({
    strategies,
    positions: positions.map((p) => ({
      type: p.type,
      contracts: p.contracts,
      strike: p.strike,
    })),
  });

  // ============================================================================
  // Step 3: Calculate overall score (weighted average)
  // ============================================================================
  const overallScore =
    coverageGrade.score * GRADE_WEIGHTS.coverage +
    incomeGrade.score * GRADE_WEIGHTS.income +
    riskGrade.score * GRADE_WEIGHTS.risk +
    upsideGrade.score * GRADE_WEIGHTS.upside +
    sophisticationGrade.score * GRADE_WEIGHTS.sophistication;

  const overallGrade = scoreToGrade(overallScore);

  // ============================================================================
  // Step 4: Run scenario analysis
  // ============================================================================
  const scenarios = calculateAllScenarios({
    currentPrice,
    shareCount,
    shareBasis,
    positions,
  });

  // ============================================================================
  // Step 5: Call GPT-5 for AI recommendations
  // ============================================================================
  const grades = {
    coverage: coverageGrade,
    income: incomeGrade,
    risk: riskGrade,
    upside: upsideGrade,
    sophistication: sophisticationGrade,
  };

  const userPrompt = buildRecommendationsPrompt(
    ticker,
    currentPrice,
    grades,
    scenarios,
    overallGrade,
    Math.round(overallScore),
  );

  let aiData: RecommendationsAIResponse;
  let aiResponse: string | undefined;

  // Fallback structure in case AI fails
  const fallbackResponse: RecommendationsAIResponse = {
    summary: `Portfolio graded ${overallGrade} (${Math.round(overallScore)}/100). AI recommendations unavailable.`,
    upgradesToAPlus: [],
    upgradesToA: [],
    nextUpgrades: [],
    executionPlan: 'AI execution plan unavailable. Review grade breakdown for insights.',
    marketContext: 'Market context unavailable.',
  };

  try {
    aiResponse = await callOpenAI(SYSTEM_PROMPT, userPrompt);

    // Strip markdown code fences if present (e.g., ```json ... ```)
    const cleanedResponse = aiResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanedResponse);

    // Validate structure at runtime
    if (!validateAIResponse(parsedData)) {
      console.error('[recommendations] AI response structure invalid:', parsedData);
      aiData = fallbackResponse;
    } else {
      aiData = parsedData;
    }
  } catch (error) {
    console.error('[recommendations] Failed to parse AI response:', error);
    console.error('[recommendations] Raw response:', aiResponse?.substring(0, 500));
    aiData = fallbackResponse;
  }

  // ============================================================================
  // Step 6: Return combined result
  // ============================================================================
  return {
    overallGrade,
    overallScore: Math.round(overallScore),
    summary: aiData.summary,
    grades,
    scenarios,
    upgrades: {
      toAPlus: aiData.upgradesToAPlus,
      toA: aiData.upgradesToA,
      next: aiData.nextUpgrades,
    },
    executionPlan: aiData.executionPlan,
    marketContext: aiData.marketContext,
  };
}
