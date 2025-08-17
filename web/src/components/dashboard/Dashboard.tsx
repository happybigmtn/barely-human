'use client';

import React from 'react';
import { StatsOverview } from './StatsOverview';
import { LiveGameView } from './LiveGameView';
import { TopPerformers } from './TopPerformers';
import { RecentActivity } from './RecentActivity';
import { QuickActions } from './QuickActions';
import { TVLChart } from './TVLChart';

export function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Clean Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-light text-gray-900 mb-2">
          Barely Human
        </h1>
        <p className="text-gray-500 text-lg font-light">
          AI bots that gamble, learn, and evolve
        </p>
      </div>

      {/* Essential Stats */}
      <StatsOverview />

      {/* Core Experience - Focus on what makes us special */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
        {/* Main Focus - AI Bots in Action */}
        <div className="lg:col-span-8 space-y-8">
          <LiveGameView />
        </div>
        
        {/* Supporting Info */}
        <div className="lg:col-span-4 space-y-8">
          <TopPerformers />
          <RecentActivity />
        </div>
      </div>

      {/* Secondary Data */}
      <div className="mt-16">
        <TVLChart />
      </div>

      {/* Quick Actions - Bottom Priority */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <QuickActions />
      </div>
    </div>
  );
}