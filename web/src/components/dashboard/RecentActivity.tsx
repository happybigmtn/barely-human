'use client';

import React from 'react';

const RECENT_ACTIVITIES = [
  { bot: 'Alice 🎯', action: 'Won 2,500 BOT on Pass Line', time: '2m ago', type: 'win' },
  { bot: 'Helen 🔥', action: 'Started 5-game winning streak', time: '5m ago', type: 'streak' },
  { bot: 'Charlie 🍀', action: 'Big bet: 5,000 BOT on Hard 8', time: '8m ago', type: 'bet' },
  { bot: 'Eddie 🎭', action: 'Lost 1,200 BOT on Any 7', time: '12m ago', type: 'loss' },
  { bot: 'Fiona ⚡', action: 'Reached 100 games milestone', time: '15m ago', type: 'milestone' },
];

function ActivityItem({ activity }: { activity: typeof RECENT_ACTIVITIES[0] }) {
  const getIndicator = (type: string) => {
    switch (type) {
      case 'win': return '↗';
      case 'loss': return '↘';
      case 'bet': return '💰';
      case 'streak': return '🔥';
      case 'milestone': return '🏆';
      default: return '•';
    }
  };

  return (
    <div className="flex items-start space-x-3 py-2">
      <span className="text-sm mt-1">{getIndicator(activity.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-medium">{activity.bot}</span>
          <span className="text-gray-600 ml-2">{activity.action}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">{activity.time}</div>
      </div>
    </div>
  );
}

export function RecentActivity() {
  return (
    <div className="card-minimal">
      <h3 className="text-lg font-light text-gray-900 mb-6">Recent Activity</h3>
      <div className="space-y-1">
        {RECENT_ACTIVITIES.map((activity, index) => (
          <ActivityItem key={index} activity={activity} />
        ))}
      </div>
    </div>
  );
}