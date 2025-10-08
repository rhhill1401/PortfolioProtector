/**
 * ScenarioChart Component
 *
 * Visualizes P/L at different price levels (bearish to moonshot)
 * Uses Recharts for interactive line chart
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { RecommendationsData } from '../../types/recommendations';

interface ScenarioChartProps {
  data: RecommendationsData;
  currentPrice: number;
}

/**
 * Format currency with optional sign
 */
function formatCurrency(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

/**
 * Get color based on P/L status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'deep_loss':
      return '#ef4444'; // red-500
    case 'loss':
      return '#f97316'; // orange-500
    case 'breakeven':
      return '#6b7280'; // gray-500
    case 'profit':
      return '#10b981'; // green-500
    case 'max_profit':
      return '#059669'; // green-600
    default:
      return '#6b7280';
  }
}

export default function ScenarioChart({ data, currentPrice }: ScenarioChartProps) {
  // Transform scenario data for Recharts
  const chartData = [
    {
      name: 'Bearish',
      label: '-30%',
      price: data.scenarios.bearish.priceLevel,
      pl: data.scenarios.bearish.profitLoss,
      status: data.scenarios.bearish.status,
    },
    {
      name: 'Mod Bear',
      label: '-15%',
      price: data.scenarios.moderateBearish.priceLevel,
      pl: data.scenarios.moderateBearish.profitLoss,
      status: data.scenarios.moderateBearish.status,
    },
    {
      name: 'Flat',
      label: '0%',
      price: data.scenarios.flat.priceLevel,
      pl: data.scenarios.flat.profitLoss,
      status: data.scenarios.flat.status,
    },
    {
      name: 'Mod Bull',
      label: '+15%',
      price: data.scenarios.moderateBullish.priceLevel,
      pl: data.scenarios.moderateBullish.profitLoss,
      status: data.scenarios.moderateBullish.status,
    },
    {
      name: 'Bullish',
      label: '+30%',
      price: data.scenarios.bullish.priceLevel,
      pl: data.scenarios.bullish.profitLoss,
      status: data.scenarios.bullish.status,
    },
    {
      name: 'V Bullish',
      label: '+50%',
      price: data.scenarios.veryBullish.priceLevel,
      pl: data.scenarios.veryBullish.profitLoss,
      status: data.scenarios.veryBullish.status,
    },
    {
      name: 'Moonshot',
      label: '+100%',
      price: data.scenarios.moonshot.priceLevel,
      pl: data.scenarios.moonshot.profitLoss,
      status: data.scenarios.moonshot.status,
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const color = getStatusColor(dataPoint.status);

      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">
            {dataPoint.name} ({dataPoint.label})
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Price: ${dataPoint.price.toFixed(2)}
          </p>
          <p className="font-bold" style={{ color }}>
            P/L: {formatCurrency(dataPoint.pl)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
            {dataPoint.status.replace('_', ' ')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Scenario Analysis
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Portfolio P/L at different price levels (current: ${currentPrice.toFixed(2)})
        </p>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="label"
            className="text-gray-600 dark:text-gray-400"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value, false)}
            className="text-gray-600 dark:text-gray-400"
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={0}
            stroke="#6b7280"
            strokeDasharray="3 3"
            label={{ value: 'Breakeven', position: 'right', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="pl"
            name="Profit/Loss"
            stroke="#8b5cf6"
            strokeWidth={3}
            dot={{ r: 6, fill: '#8b5cf6' }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Scenario Summary Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                Scenario
              </th>
              <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                Price
              </th>
              <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                P/L
              </th>
              <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">
                  {row.name} ({row.label})
                </td>
                <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                  ${row.price.toFixed(2)}
                </td>
                <td
                  className="py-2 px-3 text-right font-semibold"
                  style={{ color: getStatusColor(row.status) }}
                >
                  {formatCurrency(row.pl)}
                </td>
                <td className="py-2 px-3 text-right text-xs text-gray-600 dark:text-gray-400 capitalize">
                  {row.status.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
