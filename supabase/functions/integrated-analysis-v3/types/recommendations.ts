/**
 * Type definitions for the Recommendations System
 *
 * This module defines all interfaces for the A-F grading system,
 * scenario analysis, and upgrade recommendations.
 */

// ============================================================================
// GRADER INPUT TYPES
// ============================================================================

export interface CoverageInput {
  shareCount: number;
  currentPrice: number;
  soldCallContracts: number;
  soldPutContracts: number;
  boughtCallContracts: number;
  boughtPutContracts: number;
}

export interface IncomeInput {
  totalPremiumCollected: number;
  portfolioValue: number;
  averageDaysToExpiry: number;
  soldPositions: Array<{
    type: 'CALL' | 'PUT';
    contracts: number;
    premium: number;
    theta: number;
  }>;
}

export interface RiskInput {
  strategies: Array<{
    label: string;
    riskProfile: 'covered' | 'defined' | 'unlimited';
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    maxLoss: number | null;
  }>;
  nakedPositions: number;
  assignmentRiskPositions: Array<{
    delta: number;
    daysToExpiry: number;
  }>;
}

export interface UpsideInput {
  strategies: Array<{
    label: string;
    maxProfit: number | null;
    riskProfile: string;
  }>;
  boughtCallPositions: Array<{
    delta: number;
    strike: number;
    expiry: string;
  }>;
  currentPrice: number;
}

export interface StrategyInput {
  strategies: Array<{
    label: string;
    legCount: number;
    tags?: string[];
  }>;
  positions: Array<{
    type: 'CALL' | 'PUT';
    contracts: number;
    strike: number;
  }>;
}

// ============================================================================
// GRADER OUTPUT TYPE
// ============================================================================

export interface GradeResult {
  score: number; // 0-100
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  feedback: string; // Short 1-2 sentence explanation
  strengths: string[]; // What's working well
  weaknesses: string[]; // What needs improvement
}

// ============================================================================
// SCENARIO ANALYSIS TYPES
// ============================================================================

export interface ScenarioInput {
  currentPrice: number;
  positions: Array<{
    type: 'CALL' | 'PUT';
    strike: number;
    contracts: number;
    premium: number;
    expiry: string;
  }>;
  shareCount: number;
  shareBasis: number;
}

export interface ScenarioResult {
  priceLevel: number;
  percentChange: number;
  portfolioValue: number;
  profitLoss: number;
  status: 'deep_loss' | 'loss' | 'breakeven' | 'profit' | 'max_profit';
}

// ============================================================================
// UPGRADE RECOMMENDATION TYPES
// ============================================================================

export interface UpgradeStep {
  action: string; // e.g., "Sell 1 × $75 CALL (2026-01-16)"
  reasoning: string; // Why this helps
  impact: string; // e.g., "Coverage: C → B"
  priority: 'immediate' | 'short_term' | 'long_term';
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// FINAL RECOMMENDATIONS OUTPUT
// ============================================================================

export interface RecommendationsResult {
  overallGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  overallScore: number; // 0-100, weighted average
  summary: string; // 2-3 sentence portfolio assessment

  grades: {
    coverage: GradeResult;
    income: GradeResult;
    risk: GradeResult;
    upside: GradeResult;
    sophistication: GradeResult;
  };

  scenarios: {
    bearish: ScenarioResult; // -30%
    moderateBearish: ScenarioResult; // -15%
    flat: ScenarioResult; // 0%
    moderateBullish: ScenarioResult; // +15%
    bullish: ScenarioResult; // +30%
    veryBullish: ScenarioResult; // +50%
    moonshot: ScenarioResult; // +100%
  };

  upgrades: {
    toAPlus: UpgradeStep[];
    toA: UpgradeStep[];
    next: UpgradeStep[]; // Next grade improvement steps
  };

  executionPlan: string; // Step-by-step action plan from GPT-5
  marketContext: string; // Current market conditions assessment
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type GradeCategory = 'coverage' | 'income' | 'risk' | 'upside' | 'sophistication';

export const GRADE_WEIGHTS: Record<GradeCategory, number> = {
  coverage: 0.25,
  income: 0.20,
  risk: 0.25,
  upside: 0.20,
  sophistication: 0.10,
};

export function scoreToGrade(score: number): GradeResult['grade'] {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}
