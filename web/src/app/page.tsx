'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { CDPDashboard } from '@/components/dashboard/CDPDashboard';
import { useGameStore } from '@/store/gameStore';

export default function HomePage() {
  const selectedView = useGameStore((state) => state.selectedView);

  const renderView = () => {
    switch (selectedView) {
      case 'dashboard':
        return <Dashboard />;
      case 'cdp':
        return <CDPDashboard className="mt-6" />;
      case 'bots':
        return <div>Bots View - Coming Soon</div>;
      case 'vaults':
        return <div>Vaults View - Coming Soon</div>;
      case 'nft':
        return <div>NFT View - Coming Soon</div>;
      case 'leaderboard':
        return <div>Leaderboard View - Coming Soon</div>;
      default:
        return (
          <div className="space-y-6">
            <Dashboard />
            <CDPDashboard />
          </div>
        );
    }
  };

  return (
    <MainLayout>
      {renderView()}
    </MainLayout>
  );
}