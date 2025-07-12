/**
 * Wheel Strategy Math Calculations
 * Pure functions for calculating wheel strategy metrics
 */

/**
 * Calculate the credit received for one option contract
 * @param mid - The mid price of the option
 * @returns Credit in dollars per contract
 */
export const cycleCredit = (mid: number): number => mid * 100;

/**
 * Calculate gross annualized yield
 * @param credit - Total credit received in dollars
 * @param shares - Number of shares (for covered calls)
 * @param px - Current stock price
 * @param dte - Days to expiration
 * @returns Annualized yield as a percentage
 */
export const grossYield = (
  credit: number, 
  shares: number, 
  px: number, 
  dte: number
): number => {
  if (shares === 0 || px === 0 || dte === 0) return 0;
  const capitalAtRisk = shares * px;
  const periodReturn = credit / capitalAtRisk;
  const annualizedReturn = (periodReturn * 365 / dte) * 100;
  return annualizedReturn;
};

/**
 * Calculate compounded annual return
 * @param gross - Gross yield per cycle (as percentage)
 * @param cycles - Number of cycles per year (default 9 for ~40 DTE)
 * @returns Compounded annual return as a percentage
 */
export const compounding = (
  gross: number, 
  cycles: number = 9
): number => {
  const perCycleReturn = gross / cycles / 100;
  const compoundedReturn = (Math.pow(1 + perCycleReturn, cycles) - 1) * 100;
  return compoundedReturn;
};

/**
 * Calculate cost to close position (buyback cost)
 * @param currentMid - Current mid price of option
 * @param contracts - Number of contracts (negative for short)
 * @returns Cost to close in dollars (positive = cost, negative = credit)
 */
export const costToClose = (
  currentMid: number, 
  contracts: number
): number => {
  return currentMid * 100 * Math.abs(contracts);
};

/**
 * Calculate unrealized P&L
 * @param premiumCollected - Original premium collected
 * @param currentCostToClose - Current cost to close position
 * @returns Unrealized P&L in dollars
 */
export const unrealizedPL = (
  premiumCollected: number,
  currentCostToClose: number
): number => {
  return premiumCollected - currentCostToClose;
};

/**
 * Calculate risk-adjusted return
 * @param annualizedReturn - Base annualized return percentage
 * @param assignmentProb - Probability of assignment (0-1)
 * @returns Risk-adjusted return as a percentage
 */
export const riskAdjustedReturn = (
  annualizedReturn: number,
  assignmentProb: number
): number => {
  // Simple adjustment: reduce return by assignment probability
  // In practice, this could be more sophisticated
  return annualizedReturn * (1 - assignmentProb * 0.3);
};

/**
 * Estimate assignment probability based on moneyness
 * @param stockPrice - Current stock price
 * @param strikePrice - Option strike price
 * @param dte - Days to expiration
 * @returns Estimated assignment probability (0-1)
 */
export const estimateAssignmentProb = (
  stockPrice: number,
  strikePrice: number,
  dte: number
): number => {
  const moneyness = stockPrice / strikePrice;
  
  // Simple heuristic - in practice would use Black-Scholes with DTE
  // For now, we'll use a simple adjustment based on time
  const timeAdjustment = dte < 7 ? 1.2 : dte < 30 ? 1.0 : 0.8;
  
  if (moneyness > 1.05) return Math.min(0.9 * timeAdjustment, 1); // Deep ITM
  if (moneyness > 1.02) return Math.min(0.7 * timeAdjustment, 1); // ITM
  if (moneyness > 0.98) return Math.min(0.5 * timeAdjustment, 1); // ATM
  if (moneyness > 0.95) return Math.min(0.3 * timeAdjustment, 1); // OTM
  return Math.min(0.1 * timeAdjustment, 1); // Deep OTM
};