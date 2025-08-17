'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NotificationContainer } from '../ui/NotificationContainer';
import { useGameStore } from '@/store/gameStore';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const sidebarOpen = useGameStore((state) => state.sidebarOpen);

  return (
    <div className="min-h-screen bg-casino-dark">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 25%, #ff073a 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, #00bfff 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, #39ff14 0%, transparent 70%)
            `,
            backgroundSize: '400px 400px, 600px 600px, 800px 800px',
            animation: 'pulse 8s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Layout Container */}
      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}>
          {/* Header */}
          <Header />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => useGameStore.getState().toggleSidebar()}
          />
        )}
      </div>

      {/* Notifications */}
      <NotificationContainer />
    </div>
  );
}