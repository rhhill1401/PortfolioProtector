import React from 'react';

// Type definitions for the position data
export interface OptionPosition {
  symbol?: string;
  strike: number;
  type: 'CALL' | 'PUT';
  contracts: number;
  expiry: string;
  premium?: number;
  premiumCollected?: number;
  currentValue?: number | null;
  daysToExpiry?: number;
  term?: 'SHORT_DATED' | 'LONG_DATED';
  wheelPnl?: number;
  wheelNet?: number;
  markPnl?: number;
  optionMTM?: number;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  iv?: number | null;
  assignmentProb?: string;
}

export interface OptionPositionCardProps {
  position: OptionPosition;
  currentPrice: number;
  className?: string;
}

// Helper functions for formatting
// Always show whole dollars scaled to per-contract value (×100) with rounding up
const formatWholeContractDollars = (
  value: number | undefined | null,
  {
    showSign = false,
  }: {
    showSign?: boolean;
  } = {},
): string => {
  if (value === undefined || value === null || isNaN(Number(value))) return 'N/A';
  let v = Number(value);
  // Heuristic: if it looks like a per-share option price (e.g., 5.10), scale to per-contract
  if (Math.abs(v) < 50) v = v * 100;
  const rounded = Math.ceil(Math.abs(v));
  let prefix = '';
  if (showSign) {
    prefix = v > 0 ? '+' : v < 0 ? '-' : '';
  } else if (v < 0) {
    prefix = '-';
  }
  return `${prefix}$${rounded.toLocaleString()}`;
};

const formatGreekValue = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return 'N/A';
  // Format without leading zero for small decimals
  const formatted = Math.abs(value) < 1 && value !== 0
    ? value.toFixed(decimals).replace('0.', '.')
    : value.toFixed(decimals);
  return formatted;
};

const formatTheta = (theta: number | null | undefined): string => {
  if (theta === null || theta === undefined) return 'N/A';
  // Theta is typically negative for long positions, format without leading zero
  const formatted = Math.abs(theta) < 1 && theta !== 0
    ? Math.abs(theta).toFixed(2).replace('0.', '.')
    : Math.abs(theta).toFixed(2);
  return formatted;
};

const formatIV = (iv: number | null | undefined): string => {
  if (iv === null || iv === undefined) return 'N/A';
  // IV should be displayed as percentage
  const percentage = iv > 1 ? iv : iv * 100;
  return `${percentage.toFixed(2)}%`;
};

export function OptionPositionCard({ position, currentPrice, className = '' }: OptionPositionCardProps) {
  // Calculate moneyness for fallback risk assessment
  const moneyness = position.type === 'CALL'
    ? ((currentPrice - position.strike) / position.strike) * 100
    : ((position.strike - currentPrice) / position.strike) * 100;

  const fromRiskString = (riskValue: string | undefined | null) => {
    const upper = (riskValue || '').toUpperCase();
    if (upper.includes('HIGH')) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
    if (upper.includes('MEDIUM') || upper.includes('MODERATE')) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
    if (upper.includes('LOW')) return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
    return null;
  };

  // Determine risk level prioritising delta if available
  const getRiskLevel = (): { label: string; colorClasses: string } => {
    const isSold = position.contracts < 0;

    if (typeof position.delta === 'number' && !Number.isNaN(position.delta)) {
      const absDelta = Math.abs(position.delta);

      // SOLD positions: High delta = high assignment risk
      if (isSold) {
        if (absDelta >= 0.75) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
        if (absDelta >= 0.35) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
        return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
      }

      // BOUGHT positions: High delta = winning trade (low risk of total loss)
      else {
        if (absDelta >= 0.75) return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' }; // Deep ITM, winning
        if (absDelta >= 0.35) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' }; // Near money
        return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' }; // OTM, likely to lose premium
      }
    }

    const riskFromData = fromRiskString((position as any).risk);
    if (riskFromData) return riskFromData;

    if (moneyness >= 0) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
    if (moneyness >= -3) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
    return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
  };

  const riskLevel = getRiskLevel();

  const cardToneClasses = (() => {
    switch (riskLevel.label) {
      case 'HIGH RISK':
        return 'bg-red-50 border-red-200';
      case 'MODERATE RISK':
        return 'bg-amber-50 border-amber-200';
      case 'LOW RISK':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  })();

  // Determine position direction for display
  const displayDirection = position.contracts < 0 ? 'SOLD' : 'BOUGHT';

  // Calculate days to expiry if not provided
  const calculateDaysToExpiry = (): number => {
    if (position.daysToExpiry !== undefined) return position.daysToExpiry;

    const today = new Date();
    const expiryDate = new Date(position.expiry);
    return Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const daysToExpiry = calculateDaysToExpiry();
  const term = position.term || (daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED');
  const termDisplay = term === 'LONG_DATED' ? 'Long-dated' : 'Short-dated';

  // Get P&L values
  const totalPremium = Number(position.premium ?? position.premiumCollected ?? 0);
  const currentTotal = Number(position.currentValue ?? 0);
  const profitLoss = position.profitLoss;
  const markBased = position.markPnl ?? position.optionMTM;
  const derivedPnL = profitLoss !== undefined && profitLoss !== null
    ? Number(profitLoss)
    : markBased !== undefined && markBased !== null
      ? Number(markBased)
      : position.contracts < 0
        ? totalPremium - currentTotal
        : currentTotal - totalPremium;
  const pnlTone = derivedPnL >= 0 ? 'text-green-600' : 'text-red-600';
  const hasPnL = Number.isFinite(derivedPnL);

  // Format assignment probability
  const getAssignmentProbability = (): string => {
    if (position.assignmentProb) return position.assignmentProb;
    if (position.delta !== null && position.delta !== undefined) {
      return `${(Math.abs(position.delta) * 100).toFixed(1)}%`;
    }
    return '0%';
  };

  const assignmentProb = getAssignmentProbability();
  const assignmentProbValue = parseFloat(assignmentProb);

  return (
    <div className={`border rounded-lg p-4 mb-4 transition-colors ${cardToneClasses} ${className}`}>
      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="flex-1">
          <div className="font-semibold text-lg">
            ${position.strike} {position.type} {position.expiry} ({Math.abs(position.contracts)} contract{Math.abs(position.contracts) > 1 ? 's' : ''})
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 rounded text-xs font-medium ${riskLevel.colorClasses}`}>
              {riskLevel.label}
            </span>
            <span className="text-xs text-gray-500">
              {displayDirection} {position.type}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <span className="text-gray-600">Current:&nbsp;</span>
          <span className="font-semibold text-lg">
            {formatWholeContractDollars(position.currentValue)}
          </span>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-2">{daysToExpiry} days to expiry • {termDisplay}</div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {position.contracts < 0 && (
          <div className="space-y-1">
            <div>
              <span className="text-gray-600">Premium: </span>
              <span className="font-bold text-lg text-green-600">
                {formatWholeContractDollars(totalPremium)}
              </span>
            </div>
            <div className={`text-xs ${(position.markPnl ?? position.optionMTM ?? 0) < 0 ? 'text-red-500' : 'text-gray-500'}`}>
              Buy-to-close: ${Math.round((position.markPnl ?? position.optionMTM ?? 0)).toLocaleString()}
            </div>
          </div>
        )}
        {position.contracts >= 0 && hasPnL && (
          <div>
            <span className="text-gray-600">P&L: </span>
            <span className={`font-semibold ${pnlTone}`}>
              {formatWholeContractDollars(derivedPnL, { showSign: true })}
            </span>
          </div>
        )}
      </div>

      {/* Greeks Display */}
      <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t">
        <div>
          <span className="text-gray-600">Delta: </span>
          <span className="font-semibold">
            {position.delta !== null && position.delta !== undefined
              ? position.delta.toFixed(2)
              : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Theta: </span>
          <span className="font-semibold">
            {formatTheta(position.theta)}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Gamma: </span>
          <span className="font-semibold">
            {formatGreekValue(position.gamma, 2)}
          </span>
        </div>
        <div>
          <span className="text-gray-600">IV: </span>
          <span className="font-semibold">
            {formatIV(position.iv)}
          </span>
        </div>
      </div>

      {/* Assignment Probability based on Delta */}
      {position.contracts < 0 && position.delta !== null && position.delta !== undefined && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-gray-600">Assignment Probability: </span>
          <span className={`font-bold ${
            assignmentProbValue > 70 ? 'text-red-600' :
            assignmentProbValue > 30 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {assignmentProb}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            (based on delta)
          </span>
        </div>
      )}
    </div>
  );
}
