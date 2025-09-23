import React from 'react';

export interface PositionData {
  contracts: number;
  expiry: string;
  daysToExpiry?: number;
  term?: 'SHORT_DATED' | 'LONG_DATED';
  strike?: number;
  premium?: number;
  premiumCollected?: number;
  type?: 'CALL' | 'PUT';
  optionType?: 'CALL' | 'PUT';
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

  const counts: Record<'sold' | 'bought', Record<'CALL' | 'PUT', Record<'SHORT_DATED' | 'LONG_DATED', number>>> = {
    sold: {
      CALL: { SHORT_DATED: 0, LONG_DATED: 0 },
      PUT: { SHORT_DATED: 0, LONG_DATED: 0 },
    },
    bought: {
      CALL: { SHORT_DATED: 0, LONG_DATED: 0 },
      PUT: { SHORT_DATED: 0, LONG_DATED: 0 },
    },
  };

  positionsWithTerm.forEach((pos) => {
    const type = (pos.optionType || pos.type || 'CALL').toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
    const term = pos.term === 'LONG_DATED' ? 'LONG_DATED' : 'SHORT_DATED';
    const bucket = pos.contracts < 0 ? 'sold' : 'bought';
    counts[bucket][type][term] += Math.abs(pos.contracts);
  });

  const describe = (direction: 'sold' | 'bought', type: 'CALL' | 'PUT') => {
    const data = counts[direction][type];
    const total = data.SHORT_DATED + data.LONG_DATED;
    if (total === 0) return '';
    const parts = [] as string[];
    if (data.SHORT_DATED > 0) parts.push(`${data.SHORT_DATED} short-dated`);
    if (data.LONG_DATED > 0) parts.push(`${data.LONG_DATED} long-dated`);
    const label = `${direction === 'sold' ? 'Sold' : 'Bought'} ${type === 'CALL' ? 'calls' : 'puts'}`;
    return `${label}: ${total}${parts.length ? ` (${parts.join(', ')})` : ''}`;
  };

  const summarySegments = [
    describe('sold', 'CALL'),
    describe('sold', 'PUT'),
    describe('bought', 'CALL'),
    describe('bought', 'PUT'),
  ].filter(Boolean);

  const positionSummary = summarySegments.join(' • ');

  const totalPremiumCollectedRaw = positions.reduce((total, pos) => {
    const premiumValue = Number(pos.premium ?? pos.premiumCollected ?? 0);
    const sign = pos.contracts < 0 ? 1 : -1;
    return total + premiumValue * sign;
  }, 0);
  const totalPremiumTone = totalPremiumCollectedRaw > 0
    ? 'text-green-600'
    : totalPremiumCollectedRaw < 0
      ? 'text-red-600'
      : 'text-gray-900';
  const totalPremiumCollected = Math.ceil(Math.abs(totalPremiumCollectedRaw));
  const formattedPremium = totalPremiumCollectedRaw === 0
    ? '$0'
    : `${totalPremiumCollectedRaw > 0 ? '+' : '-'}$${totalPremiumCollected.toLocaleString()}`;

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
            {shareCount.toLocaleString()} shares
          </p>
          {positionSummary && (
            <p className='text-sm text-gray-600 mt-1'>
              {positionSummary}
            </p>
          )}
          <div className='mt-3 pt-3 border-t border-blue-200'>
            <p className='text-xs text-gray-600'>Net Premium Collected</p>
            <p className={`text-xl font-bold ${totalPremiumTone}`}>
              {formattedPremium}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
