/**
 * UpgradeSteps Component
 *
 * Displays actionable upgrade recommendations to improve portfolio grade
 */

import React, { useState } from 'react';
import type { RecommendationsData, UpgradeStep } from '../../types/recommendations';

interface UpgradeStepsProps {
  data: RecommendationsData;
}

/**
 * Get priority badge color
 */
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'immediate':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'short_term':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'long_term':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

/**
 * Get risk level badge color
 */
function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

/**
 * Render upgrade step card
 */
function UpgradeStepCard({ step, index }: { step: UpgradeStep; index: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border-l-4 border-purple-500">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <span className="text-purple-700 dark:text-purple-300 font-bold text-sm">
              {index + 1}
            </span>
          </div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            {step.action}
          </h4>
        </div>
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(step.priority)}`}>
            {step.priority.replace('_', ' ')}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(step.riskLevel)}`}>
            {step.riskLevel} risk
          </span>
        </div>
      </div>

      <div className="ml-11 space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-white">Why:</span> {step.reasoning}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-white">Impact:</span> {step.impact}
        </p>
      </div>
    </div>
  );
}

export default function UpgradeSteps({ data }: UpgradeStepsProps) {
  const [activeTab, setActiveTab] = useState<'next' | 'toA' | 'toAPlus'>('next');

  const tabs = [
    { key: 'next', label: 'Next Steps', count: data.upgrades.next.length },
    { key: 'toA', label: 'To A Grade', count: data.upgrades.toA.length },
    { key: 'toAPlus', label: 'To A+ Grade', count: data.upgrades.toAPlus.length },
  ] as const;

  const currentSteps = data.upgrades[activeTab];

  return (
    <div className="space-y-6">
      {/* Execution Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Execution Plan
        </h3>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {data.executionPlan}
          </p>
        </div>
      </div>

      {/* Upgrade Steps */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Upgrade Recommendations
        </h3>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Steps List */}
        {currentSteps.length > 0 ? (
          <div className="space-y-4">
            {currentSteps.map((step, index) => (
              <UpgradeStepCard key={index} step={step} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No specific recommendations for this category.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {activeTab === 'next' && 'Your portfolio is already well-optimized!'}
              {activeTab === 'toA' && 'Complete "Next Steps" to unlock A-grade recommendations.'}
              {activeTab === 'toAPlus' && 'Complete lower-tier upgrades first.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
