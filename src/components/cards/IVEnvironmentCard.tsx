import React from 'react';

export interface IVEnvironmentCardProps {
  vix: number | null;
  className?: string;
}

export function IVEnvironmentCard({ vix, className = '' }: IVEnvironmentCardProps) {
  const vixValue = vix || 0;

  const getVolatilityLevel = (): string => {
    if (vixValue > 20) return 'High Vol';
    if (vixValue > 15) return 'Moderate';
    return 'Low Vol';
  };

  return (
    <div className={`bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200 ${className}`}>
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-sm font-medium text-gray-600'>IV Environment</p>
          <p className='text-2xl font-bold text-green-700 mt-1'>
            {getVolatilityLevel()}
          </p>
          <p className='text-xs text-gray-500 mt-1'>VIX: {vix?.toFixed(2)}</p>
        </div>
        <span className='inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600'>
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
              d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'
            />
          </svg>
        </span>
      </div>
    </div>
  );
}