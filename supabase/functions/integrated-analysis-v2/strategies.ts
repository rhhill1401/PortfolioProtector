export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  purchasePrice?: number;
  currentValue?: number;
  percentOfPortfolio?: number;
}

export interface PortfolioMetadata {
  optionPositions?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface PortfolioData {
  positions?: PortfolioPosition[];
  totalValue?: number;
  cashBalance?: number;
  metadata?: PortfolioMetadata;
  [key: string]: unknown;
}

export interface KeyLevel {
  price: number;
  type: "Support" | "Resistance";
  strength: string;
}

export interface ChartMetric {
  timeframe: string;
  keyLevels?: KeyLevel[];
  trend?: string;
  rsi?: string;
  macd?: string;
}

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

export interface OptionQuote {
  ticker: string;
  strike: number;
  expiry: string;
  type: string;
  dte: number;
  mid: number;
  bid: number | null;
  ask: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  openInterest: number | null;
  dayVolume: number | null;
  lastUpdated: number;
}

export interface CalculatedOption {
  symbol: string;
  strike: number;
  optionType: string;
  contracts: number;
  premiumCollected: number;
  currentValue: number;
  expiry: string;
  position: string;
  daysToExpiry?: number;
  profitLoss: number;
  cycleReturn: number;
  intrinsic: number;
  extrinsic: number;
  optionMTM: number;
  wheelNet: number;
  assignmentProfit: number;
  markPnl: number;
  wheelPnl: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  [key: string]: unknown;
}

export interface StrategyInput {
  ticker: string;
  portfolio?: PortfolioData;
  chartMetrics?: ChartMetric[];
  priceContext?: PriceContext | null;
  optionGreeks?: Record<string, OptionQuote> | null;
}

export interface WheelStrategyResult {
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  hasPosition: boolean;
  currentShares: number;
  costBasis: number;
  cashBalance: number;
  stockValue: number;
  totalValue: number;
  optionPositions: CalculatedOption[];
  currentOptionPositions: CalculatedOption[];
  supports: KeyLevel[];
  resistances: KeyLevel[];
  totalPremiumCollected: number;
  totalContracts: number;
  stockUnreal: number;
  totalMarkPnl: number;
  totalWheelPnl: number;
  wheelPhase: "COVERED_CALL" | "CASH_SECURED_PUT";
  optimalStrike: number;
  callStrikeZone: number[];
  putStrikeZone: number[];
  volatilityEstimate: number;
  ivRank: number;
  rsi: string;
  macd: string;
  trend: string;
}

function normalizeTickerSymbol(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function matchesTicker(symbol: string, tickerUpper: string): boolean {
  return symbol === tickerUpper || symbol.startsWith(`${tickerUpper} `);
}

function calcOptionMetrics(
  opt: Record<string, unknown>,
  spotPrice: number,
  costBasis: number,
  greeks?: OptionQuote,
): CalculatedOption {
  const symbol = String(opt.symbol ?? "").toUpperCase();
  const signedContracts = Number(opt.contracts) || 0;
  const contractsAbs = Math.abs(signedContracts) || 1;

  let premium = Number(opt.premiumCollected) || 0;
  if (premium > 0 && premium < 100) {
    premium = premium * 100 * contractsAbs;
  }

  const currentValue = Number(opt.currentValue) || 0;
  const strike = Number(opt.strike) || 0;
  const optionType = String(opt.optionType || opt.type || "CALL").toUpperCase();
  const isCall = optionType === "CALL";
  const expiry = String(opt.expiry ?? "");
  const position = typeof opt.position === "string"
    ? opt.position
    : signedContracts < 0
      ? "SHORT"
      : "LONG";
  const daysToExpiry = typeof opt.daysToExpiry === "number" ? opt.daysToExpiry : undefined;

  const assignmentProfit = isCall ? (strike - costBasis) * 100 * contractsAbs : 0;
  const totalWheelProfit = premium + assignmentProfit;
  const markToMarket = premium - currentValue;

  const capitalAtRisk = costBasis * 100 * contractsAbs;
  const cycleReturn = capitalAtRisk > 0 ? (totalWheelProfit / capitalAtRisk) * 100 : 0;

  const intrinsic = isCall
    ? Math.max(0, spotPrice - strike) * 100 * contractsAbs
    : Math.max(0, strike - spotPrice) * 100 * contractsAbs;
  const extrinsic = Math.max(0, currentValue - intrinsic);

  const markPnl = Math.round(markToMarket * (signedContracts < 0 ? 1 : -1));
  const wheelPnl = Math.round(totalWheelProfit);

  const delta = greeks?.delta ?? null;
  const gamma = greeks?.gamma ?? null;
  const theta = greeks?.theta ?? null;
  const vega = greeks?.vega ?? null;
  const iv = greeks?.iv ?? null;

  const calculated: CalculatedOption = {
    symbol,
    strike,
    optionType,
    contracts: signedContracts,
    premiumCollected: premium,
    currentValue,
    expiry,
    position,
    daysToExpiry,
    profitLoss: Math.round(premium),
    cycleReturn: Number(cycleReturn.toFixed(2)),
    intrinsic: Math.round(intrinsic),
    extrinsic: Math.round(extrinsic),
    optionMTM: Math.round(markToMarket),
    wheelNet: Math.round(totalWheelProfit),
    assignmentProfit: Math.round(assignmentProfit),
    markPnl,
    wheelPnl,
    delta,
    gamma,
    theta,
    vega,
    iv,
  };

  return calculated;
}

export function analyzeWheelStrategy({
  ticker,
  portfolio,
  chartMetrics = [],
  priceContext,
  optionGreeks,
}: StrategyInput): WheelStrategyResult {
  const tickerUpper = ticker.toUpperCase();
  const price = priceContext?.current ?? 0;
  const high = priceContext?.high ?? 0;
  const low = priceContext?.low ?? 0;

  const keyLevels = chartMetrics.flatMap((metric) => metric.keyLevels ?? []);
  const supports = keyLevels
    .filter((l) => l.type === "Support")
    .sort((a, b) => b.price - a.price);
  const resistances = keyLevels
    .filter((l) => l.type === "Resistance")
    .sort((a, b) => a.price - b.price);

  const portfolioPositions = (portfolio?.positions ?? []).filter((pos) =>
    normalizeTickerSymbol(pos.symbol) === tickerUpper
  );
  const hasPosition = portfolioPositions.length > 0;
  const currentShares = portfolioPositions.reduce((sum, pos) => sum + (pos.quantity || 0), 0);

  const basePurchasePrice = portfolioPositions[0]?.purchasePrice;
  const costBasis = typeof basePurchasePrice === "number" && Number.isFinite(basePurchasePrice)
    ? basePurchasePrice
    : price;

  const cashBalance = Number(portfolio?.cashBalance ?? 0);
  const stockValue = currentShares * price;
  const totalValue = portfolio?.totalValue ?? (cashBalance + stockValue);

  const allOptionPositions = (portfolio?.metadata?.optionPositions ?? [])
    .filter((opt) => matchesTicker(normalizeTickerSymbol(opt?.symbol), tickerUpper))
    .map((opt) => {
      const symbol = normalizeTickerSymbol(opt?.symbol);
      const strike = Number(opt?.strike) || 0;
      const expiry = String(opt?.expiry ?? "");
      const optionType = String(opt?.optionType || opt?.type || "CALL").toUpperCase();
      const key = `${symbol}-${strike}-${expiry}-${optionType}`;
      const greeks = optionGreeks?.[key];
      return calcOptionMetrics(opt, price, costBasis, greeks);
    });

  const currentOptionPositions = allOptionPositions.filter((opt) =>
    matchesTicker(normalizeTickerSymbol(opt.symbol), tickerUpper)
  );

  const totalPremiumCollected = currentOptionPositions.reduce((sum, opt) => {
    let premium = Number(opt.premiumCollected) || 0;
    const contracts = Math.abs(Number(opt.contracts) || 1);
    if (premium > 0 && premium < 100) premium = premium * 100 * contracts;
    return sum + premium;
  }, 0);

  const totalContracts = currentOptionPositions.reduce((sum, opt) => sum + Math.abs(Number(opt.contracts) || 0), 0);
  const stockUnreal = (price - costBasis) * currentShares;
  const totalMarkPnl = currentOptionPositions.reduce((sum, opt) => sum + (opt.markPnl || 0), 0);
  const totalWheelPnl = currentOptionPositions.reduce((sum, opt) => sum + (opt.wheelPnl || 0), 0);

  const wheelPhase: "COVERED_CALL" | "CASH_SECURED_PUT" = hasPosition ? "COVERED_CALL" : "CASH_SECURED_PUT";
  const callStrikeZone = resistances.filter((r) => r.price > price * 1.02).map((r) => r.price);
  const putStrikeZone = supports.filter((s) => s.price < price * 0.98).map((s) => s.price);
  const optimalStrike = hasPosition
    ? (callStrikeZone[0] ?? price * 1.05)
    : (putStrikeZone[putStrikeZone.length - 1] ?? price * 0.95);

  const priceRange = high - low;
  const avgPrice = (high + low) / 2;
  const volatilityEstimate = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 20;
  const ivRank = Math.min(Math.max(volatilityEstimate * 2, 20), 80);

  const primaryMetric = chartMetrics[0];
  const rsi = primaryMetric?.rsi ?? "Unknown";
  const macd = primaryMetric?.macd ?? "Unknown";
  const trend = primaryMetric?.trend ?? "Unknown";

  console.log('🎯 [STRATEGY] Wheel analysis computed', {
    ticker,
    hasPosition,
    currentShares,
    totalOptionPositions: allOptionPositions.length,
    currentOptionPositions: currentOptionPositions.length,
    totalPremiumCollected,
    totalContracts,
    optimalStrike,
    wheelPhase,
  });

  return {
    currentPrice: price,
    highPrice: high,
    lowPrice: low,
    hasPosition,
    currentShares,
    costBasis,
    cashBalance,
    stockValue,
    totalValue,
    optionPositions: allOptionPositions,
    currentOptionPositions,
    supports,
    resistances,
    totalPremiumCollected,
    totalContracts,
    stockUnreal,
    totalMarkPnl,
    totalWheelPnl,
    wheelPhase,
    optimalStrike,
    callStrikeZone,
    putStrikeZone,
    volatilityEstimate,
    ivRank,
    rsi,
    macd,
    trend,
  };
}

export { calcOptionMetrics };
