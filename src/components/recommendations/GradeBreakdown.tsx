/**
 * GradeBreakdown Component
 *
 * Detailed breakdown of each grade category with strengths and weaknesses
 */

import React from 'react';
import type { RecommendationsData } from '../../types/recommendations';

interface GradeBreakdownProps {
  data: RecommendationsData;
}

/**
 * Get color class for grade
 */
function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-600 dark:text-green-400';
  if (grade.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
  if (grade === 'D') return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getGradeBgColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-100 dark:bg-green-900/30';
  if (grade.startsWith('B')) return 'bg-blue-100 dark:bg-blue-900/30';
  if (grade.startsWith('C')) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (grade === 'D') return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

const CATEGORY_LABELS = {
  coverage: {
    title: 'Coverage',
    description: 'How well shares are protected with options',
    icon: '🛡️',
  },
  income: {
    title: 'Income',
    description: 'Premium yield and theta decay efficiency',
    icon: '💰',
  },
  risk: {
    title: 'Risk',
    description: 'Naked positions, unlimited risk, assignment risk',
    icon: '⚠️',
  },
  upside: {
    title: 'Upside',
    description: 'Unlimited profit potential and uncapped gains',
    icon: '📈',
  },
  sophistication: {
    title: 'Sophistication',
    description: 'Strategy complexity (basic → advanced)',
    icon: '🎯',
  },
};

export default function GradeBreakdown({ data }: GradeBreakdownProps) {
  return (
    <div className="space-y-6">
      {Object.entries(data.grades).map(([category, gradeData]) => {
        const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
        const gradeColor = getGradeColor(gradeData.grade);
        const gradeBg = getGradeBgColor(gradeData.grade);

        return (
          <div
            key={category}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4"
            style={{
              borderLeftColor: gradeData.grade.startsWith('A')
                ? '#10b981'
                : gradeData.grade.startsWith('B')
                ? '#3b82f6'
                : gradeData.grade.startsWith('C')
                ? '#f59e0b'
                : gradeData.grade === 'D'
                ? '#f97316'
                : '#ef4444',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{label.icon}</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {label.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {label.description}
                </p>
              </div>
              <div className="flex flex-col items-end ml-4">
                <div className={`px-4 py-2 rounded-lg ${gradeBg}`}>
                  <span className={`text-3xl font-bold ${gradeColor}`}>
                    {gradeData.grade}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {gradeData.score}/100
                </p>
              </div>
            </div>

            {/* Feedback */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded">
              <p className="text-gray-700 dark:text-gray-300">
                {gradeData.feedback}
              </p>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              {gradeData.strengths.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                    <span>✓</span> Strengths
                  </h4>
                  <ul className="space-y-1">
                    {gradeData.strengths.map((strength, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                      >
                        <span className="text-green-500 dark:text-green-400 mt-0.5">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {gradeData.weaknesses.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                    <span>⚠</span> Weaknesses
                  </h4>
                  <ul className="space-y-1">
                    {gradeData.weaknesses.map((weakness, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                      >
                        <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
