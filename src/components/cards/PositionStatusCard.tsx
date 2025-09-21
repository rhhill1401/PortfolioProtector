import React from 'react';

export interface PositionData {
  contracts: number;
  expiry: string;
  daysToExpiry?: number;
  term?: 'SHORT_DATED' | 'LONG_DATED';
  strike?: number;
  premium?: number;
  premiumCollected?: number;
}

export interface PositionStatusCardProps {
  shareCount: number;
  positions: PositionData[];
  className?: string;
}

export function PositionStatusCard({ shareCount, positions, className = '' }: PositionStatusCardProps) {
  // Add term field if missing (fallback for undeployed edge function)
  const positionsWithTerm = positions.map(pos => {
    // Calculate days to expiry if missing
    let daysToExpiry = pos.daysToExpiry;
    if (!daysToExpiry && pos.expiry) {
      const today = new Date();
      const expiryDate = new Date(pos.expiry);
      daysToExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return {
      ...pos,
      daysToExpiry,
      term: pos.term || (daysToExpiry && daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED')
    };
  });

  // Categorize positions by direction (SHORT/LONG) and term
  const soldPositions = positionsWithTerm.filter(pos => pos.contracts < 0);
  const boughtPositions = positionsWithTerm.filter(pos => pos.contracts > 0);

  // Count sold positions by term
  const soldShortDated = soldPositions.filter(pos => pos.term === 'SHORT_DATED')
    .reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
  const soldLongDated = soldPositions.filter(pos => pos.term === 'LONG_DATED')
    .reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);

  // Count bought positions by term
  const boughtShortDated = boughtPositions.filter(pos => pos.term === 'SHORT_DATED')
    .reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
  const boughtLongDated = boughtPositions.filter(pos => pos.term === 'LONG_DATED')
    .reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);

  const totalSold = soldShortDated + soldLongDated;
  const totalBought = boughtShortDated + boughtLongDated;

  // Build position summary text
  const getPositionSummary = () => {
    const parts = [];

    // Display sold calls with term breakdown
    if (totalSold > 0) {
      let soldText = ` + ${totalSold} sold call${totalSold > 1 ? 's' : ''}`;
      if (soldShortDated > 0 && soldLongDated > 0) {
        soldText += ` (${soldShortDated} short-dated, ${soldLongDated} long-dated)`;
      } else if (soldShortDated > 0) {
        soldText += ' (short-dated)';
      } else if (soldLongDated > 0) {
        soldText += ' (long-dated)';
      }
      parts.push(soldText);
    }

    // Display bought calls with term breakdown
    if (totalBought > 0) {
      let boughtText = ` + ${totalBought} bought call${totalBought > 1 ? 's' : ''}`;
      if (boughtShortDated > 0 && boughtLongDated > 0) {
        boughtText += ` (${boughtShortDated} short-dated, ${boughtLongDated} long-dated)`;
      } else if (boughtShortDated > 0) {
        boughtText += ' (short-dated)';
      } else if (boughtLongDated > 0) {
        boughtText += ' (long-dated)';
      }
      parts.push(boughtText);
    }

    return parts.join('');
  };

  // Calculate total premium collected
  const totalPremiumCollected = Math.round(positions.reduce((total, pos) => {
    const premiumValue = pos.premium || pos.premiumCollected || 0;
    return total + premiumValue;
  }, 0));

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200 ${className}`}>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center gap-2 mb-2'>
            <svg className='w-5 h-5 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
                d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
              />
            </svg>
            <p className='text-sm font-medium text-gray-600'>Position Status</p>
          </div>
          <p className='text-lg font-bold text-gray-900'>
            {shareCount.toLocaleString()} shares{getPositionSummary()}
          </p>
          <p className='text-sm text-blue-600 mt-1'>
            Net positive carry
          </p>
          <div className='mt-3 pt-3 border-t border-blue-200'>
            <p className='text-xs text-gray-600'>Total Premium Collected</p>
            <p className='text-xl font-bold text-gray-900'>
              ${totalPremiumCollected || '0'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}