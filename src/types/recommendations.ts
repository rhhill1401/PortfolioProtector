/**
 * Type definitions for Recommendations UI components
 * Matches the response from integrated-analysis-v3 edge function
 */

export interface GradeResult {
  score: number; // 0-100
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ScenarioResult {
  priceLevel: number;
  percentChange: number;
  portfolioValue: number;
  profitLoss: number;
  status: 'deep_loss' | 'loss' | 'breakeven' | 'profit' | 'max_profit';
}

export interface UpgradeStep {
  action: string;
  reasoning: string;
  impact: string;
  priority: 'immediate' | 'short_term' | 'long_term';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RecommendationsData {
  overallGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  overallScore: number;
  summary: string;

  grades: {
    coverage: GradeResult;
    income: GradeResult;
    risk: GradeResult;
    upside: GradeResult;
    sophistication: GradeResult;
  };

  scenarios: {
    bearish: ScenarioResult;
    moderateBearish: ScenarioResult;
    flat: ScenarioResult;
    moderateBullish: ScenarioResult;
    bullish: ScenarioResult;
    veryBullish: ScenarioResult;
    moonshot: ScenarioResult;
  };

  upgrades: {
    toAPlus: UpgradeStep[];
    toA: UpgradeStep[];
    next: UpgradeStep[];
  };

  executionPlan: string;
  marketContext: string;
}
