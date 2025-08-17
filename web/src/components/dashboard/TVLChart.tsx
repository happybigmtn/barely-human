'use client';

import React from 'react';

// Simple data visualization without heavy chart libraries
const DATA_POINTS = [
  { time: '00:00', value: 120 },
  { time: '04:00', value: 125 },
  { time: '08:00', value: 132 },
  { time: '12:00', value: 145 },
  { time: '16:00', value: 138 },
  { time: '20:00', value: 142 },
  { time: 'Now', value: 148 },
];

function SimpleChart() {
  const maxValue = Math.max(...DATA_POINTS.map(d => d.value));
  const minValue = Math.min(...DATA_POINTS.map(d => d.value));
  const range = maxValue - minValue;

  return (
    <div className="h-32 flex items-end space-x-2">
      {DATA_POINTS.map((point, index) => {
        const height = ((point.value - minValue) / range) * 100;
        return (
          <div key={point.time} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-blue-200 rounded-t-sm transition-all duration-500"
              style={{ height: `${height}%` }}
            />
            <div className="text-xs text-gray-500 mt-2">{point.time}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TVLChart() {
  return (
    <div className="card-minimal">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-light text-gray-900">Total Value Locked</h3>
          <div className="text-2xl font-light text-gray-900 mt-1">148,429 BOT</div>
          <div className="text-sm text-green-600">+12.5% (24h)</div>
        </div>
      </div>
      
      <SimpleChart />
      
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="text-sm text-gray-500">24h High</div>
          <div className="font-medium">152,891</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">24h Low</div>
          <div className="font-medium">119,445</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">Volume</div>
          <div className="font-medium">2.4M BOT</div>
        </div>
      </div>
    </div>
  );
}