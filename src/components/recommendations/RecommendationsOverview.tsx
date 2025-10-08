/**
 * RecommendationsOverview Component
 *
 * Top-level container for portfolio recommendations (A-F grading system)
 * Displays overall grade, summary, and detailed breakdown tabs
 */

import React from 'react';
import type { RecommendationsData } from '../../types/recommendations';

interface RecommendationsOverviewProps {
  data: RecommendationsData;
  ticker: string;
}

/**
 * Get color class for grade (A-F)
 */
function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-600 dark:text-green-400';
  if (grade.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
  if (grade === 'D') return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400'; // F
}

/**
 * Get background color class for grade badge
 */
function getGradeBgColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-100 dark:bg-green-900/30';
  if (grade.startsWith('B')) return 'bg-blue-100 dark:bg-blue-900/30';
  if (grade.startsWith('C')) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (grade === 'D') return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30'; // F
}

export default function RecommendationsOverview({ data, ticker }: RecommendationsOverviewProps) {
  const gradeColorClass = getGradeColor(data.overallGrade);
  const gradeBgClass = getGradeBgColor(data.overallGrade);

  return (
    <div className="space-y-6">
      {/* Header: Overall Grade */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {ticker} Portfolio Grade
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive A-F grading across 5 categories
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-6 py-3 rounded-lg ${gradeBgClass}`}>
              <span className={`text-5xl font-bold ${gradeColorClass}`}>
                {data.overallGrade}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {data.overallScore}/100
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {data.summary}
          </p>
        </div>
      </div>

      {/* Grade Breakdown Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Grade Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.entries(data.grades).map(([category, gradeData]) => {
            const categoryGradeColor = getGradeColor(gradeData.grade);
            const categoryGradeBg = getGradeBgColor(gradeData.grade);

            return (
              <div
                key={category}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">
                    {category}
                  </h4>
                  <div className={`px-3 py-1 rounded ${categoryGradeBg}`}>
                    <span className={`text-lg font-bold ${categoryGradeColor}`}>
                      {gradeData.grade}
                    </span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {gradeData.score}
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400">/100</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {gradeData.feedback}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Context */}
      {data.marketContext && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Market Context
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {data.marketContext}
          </p>
        </div>
      )}
    </div>
  );
}
