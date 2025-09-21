import React from 'react';

export interface AssignmentRiskCardProps {
  assignmentProb?: string | number | null;
  className?: string;
}

export function AssignmentRiskCard({ assignmentProb, className = '' }: AssignmentRiskCardProps) {
  // Convert to number for comparison
  const probability = typeof assignmentProb === 'string'
    ? parseFloat(assignmentProb)
    : (assignmentProb || 0);

  const probabilityDisplay = typeof assignmentProb === 'string'
    ? assignmentProb
    : assignmentProb
      ? `${assignmentProb}%`
      : '0%';

  const getRiskStatus = (): { message: string; colorClass: string } => {
    if (probability > 50) {
      return {
        message: 'Monitor closely',
        colorClass: 'bg-yellow-100 text-yellow-600'
      };
    }
    return {
      message: 'Within normal range',
      colorClass: 'bg-purple-100 text-purple-600'
    };
  };

  const { message, colorClass } = getRiskStatus();

  return (
    <div className={`bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200 ${className}`}>
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-sm font-medium text-gray-600'>Assignment Risk</p>
          <p className='text-2xl font-bold text-purple-700 mt-1'>
            {probabilityDisplay}
          </p>
          <p className='text-xs text-gray-500 mt-1'>
            {message}
          </p>
        </div>
        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${colorClass}`}>
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
              d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        </span>
      </div>
    </div>
  );
}