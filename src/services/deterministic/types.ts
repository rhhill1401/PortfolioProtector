/**
 * Type definitions for deterministic analysis system
 * These types support the incremental, crash-proof architecture
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type OptionType = 'CALL' | 'PUT';
export type TermType = 'SHORT_DATED' | 'LONG_DATED';

/**
 * Core position type with all necessary fields for display
 */
export interface PositionDet {
  // Core fields
  symbol: string;
  type: OptionType;
  strike: number;
  expiry: string;       // YYYY-MM-DD format
  contracts: number;    // negative = SOLD, positive = BOUGHT

  // Premium data
  premium?: number;           // Amount collected/paid per contract
  premiumCollected?: number;  // Total premium collected (legacy field)
  currentValue?: number | null;

  // Greeks (null until fetched)
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;

  // Derived fields
  daysToExpiry: number;
  term: TermType;
  assignmentProb: number | null;  // 0 to 1
  risk: RiskLevel;

  // P&L calculations
  wheelPnl?: number;
  markPnl?: number;
}

/**
 * Strategy summary for display cards
 */
export interface StrategySummary {
  id: string;
  label: string;              // "Covered Call", "Bull Call Spread", etc.
  legCount: number;
  netPremium: number;
  maxProfit?: number;
  maxLoss?: number;
  riskProfile?: 'defined' | 'covered' | 'undefined';
  components: string[];       // ["LONG 1 × $34 CALL (2025-12-19)", ...]
}

/**
 * Main result type from deterministic analysis
 */
export interface DeterministicResult {
  ticker: string;
  currentPrice: number | null;
  shareCount: number;
  totalPremiumCollected: number;
  strategies: StrategySummary[];
  positions: PositionDet[];
  countsByLabel: Record<string, number>;  // {"SOLD CALL": 2, "BOUGHT PUT": 1, ...}

  // Wheel strategy specific
  wheelPhase?: 'COVERED_CALL' | 'CASH_SECURED_PUT';
  cashBalance?: number;
}

/**
 * Portfolio data structure (input)
 */
export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  purchasePrice?: number;
  currentPrice?: number;
  marketValue?: number;
  percentChange?: string;
  gainLoss?: number;
}

export interface OptionPositionRaw {
  symbol?: string;
  strike?: number;
  type?: string;
  optionType?: string;  // Alternative field name
  expiry?: string;
  contracts?: number;
  premium?: number;
  premiumCollected?: number;
  currentValue?: number;
  position?: 'SHORT' | 'LONG';
  daysToExpiry?: number;
}

export interface PortfolioMetadata {
  optionPositions?: OptionPositionRaw[];
  [key: string]: any;
}

export interface PortfolioData {
  positions?: PortfolioPosition[];
  totalValue?: number;
  cashBalance?: number;
  metadata?: PortfolioMetadata;
  portfolioDetected?: boolean;
  brokerageType?: string;
  extractionConfidence?: string;
  extractionNotes?: string;
}

/**
 * Price context for calculations
 */
export interface PriceContext {
  current?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  date?: string | null;
  timeframe?: string;
}

/**
 * Greek data from external API
 */
export interface GreekData {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

/**
 * Event payload for progressive updates
 */
export interface DeterministicPayload {
  wheelDeterministic: DeterministicResult;
  warning?: string;
}

/**
 * Analysis input parameters
 */
export interface AnalysisInput {
  ticker: string;
  currentPrice?: number;
  portfolioData: PortfolioData;
  priceContext?: PriceContext;
}