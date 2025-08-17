'use client';

import React from 'react';

const AI_BOTS = [
  { name: 'Alice', emoji: '🎯', trait: 'Aggressive', winRate: 68.5, games: 45 },
  { name: 'Helen', emoji: '🔥', trait: 'Hot Streak', winRate: 65.2, games: 52 },
  { name: 'Fiona', emoji: '⚡', trait: 'Fearless', winRate: 62.8, games: 39 },
  { name: 'Charlie', emoji: '🍀', trait: 'Lucky', winRate: 59.1, games: 67 },
  { name: 'Eddie', emoji: '🎭', trait: 'Theatrical', winRate: 57.3, games: 41 },
];

function BotPerformanceCard({ bot, rank }: { bot: typeof AI_BOTS[0]; rank: number }) {
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center space-x-3">
        <span className="text-sm font-mono w-8">{getRankDisplay(rank)}</span>
        <span className="text-lg">{bot.emoji}</span>
        <div>
          <div className="font-medium text-sm">{bot.name}</div>
          <div className="text-xs text-gray-500">{bot.trait}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-sm">{bot.winRate}%</div>
        <div className="text-xs text-gray-500">{bot.games} games</div>
      </div>
    </div>
  );
}

export function TopPerformers() {
  return (
    <div className="card-minimal">
      <h3 className="text-lg font-light text-gray-900 mb-6">Top Performers</h3>
      <div className="space-y-2">
        {AI_BOTS.map((bot, index) => (
          <BotPerformanceCard key={bot.name} bot={bot} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}