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
const formatPremium = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A';
  // Check if the value has way too many decimal places (like the screenshot)
  const strValue = value.toString();
  if (strValue.includes('.') && strValue.split('.')[1].length > 10) {
    return `$${value.toFixed(18)}`; // Show the long decimal like in screenshot
  }
  return `$${value}`;
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
  // Calculate moneyness for risk assessment
  const moneyness = position.type === 'CALL'
    ? ((currentPrice - position.strike) / position.strike) * 100
    : ((position.strike - currentPrice) / position.strike) * 100;

  // Determine risk level based on moneyness
  const getRiskLevel = (): { label: string; colorClasses: string } => {
    if (moneyness >= 0) return { label: 'HIGH RISK', colorClasses: 'bg-red-100 text-red-700' };
    if (moneyness >= -3) return { label: 'MODERATE RISK', colorClasses: 'bg-yellow-100 text-yellow-700' };
    return { label: 'LOW RISK', colorClasses: 'bg-green-100 text-green-700' };
  };

  const riskLevel = getRiskLevel();

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

  // Get premium value (check both fields)
  const premiumValue = position.premium || position.premiumCollected;

  // Get P&L values
  const wheelPnl = position.wheelPnl || position.wheelNet || 0;
  const markPnl = position.markPnl || position.optionMTM || 0;

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
    <div className={`border rounded-lg p-4 bg-gray-50 mb-4 ${className}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
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
      </div>

      <div className="text-sm text-gray-600 mb-2">
        {daysToExpiry} days to expiry • {termDisplay}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Premium: </span>
          <span className="font-semibold">{formatPremium(premiumValue)}</span>
        </div>
        <div className="text-right">
          <span className="text-gray-600">Current: </span>
          <span className="font-semibold">${position.currentValue || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-600">Wheel P&L: </span>
          <span className="font-bold text-lg text-green-600">
            ${Math.round(wheelPnl).toLocaleString()}
          </span>
          <br />
          <span className={`text-xs ${markPnl < 0 ? 'text-red-500' : 'text-gray-400'}`}>
            Buy-to-close: ${Math.round(markPnl).toLocaleString()}
          </span>
        </div>
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
      {position.delta !== null && position.delta !== undefined && (
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