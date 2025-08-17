'use client';

import React from 'react';

const QUICK_ACTIONS = [
  { label: 'Chat with Bots', description: 'Talk to AI personalities' },
  { label: 'Manage Vaults', description: 'Deposit & withdraw' },
  { label: 'View NFTs', description: 'Mint passes & art' },
  { label: 'Leaderboard', description: 'Top performers' },
];

function QuickAction({ action }: { action: typeof QUICK_ACTIONS[0] }) {
  return (
    <button className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors text-left w-full">
      <div className="font-medium text-sm text-gray-900">{action.label}</div>
      <div className="text-xs text-gray-500 mt-1">{action.description}</div>
    </button>
  );
}

export function QuickActions() {
  return (
    <div>
      <h3 className="text-lg font-light text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <QuickAction key={action.label} action={action} />
        ))}
      </div>
    </div>
  );
}