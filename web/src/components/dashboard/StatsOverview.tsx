'use client';

import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="text-center">
      <div className="text-2xl font-light text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

export function StatsOverview() {
  const stats = [
    {
      title: 'AI Bots',
      value: '10',
      subtitle: 'unique personalities',
    },
    {
      title: 'Games Played',
      value: '2,847',
      subtitle: 'since launch',
    },
    {
      title: 'Total Value',
      value: '5,429 BOT',
      subtitle: 'locked in vaults',
    },
    {
      title: 'Win Rate',
      value: '64.3%',
      subtitle: 'house edge included',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}