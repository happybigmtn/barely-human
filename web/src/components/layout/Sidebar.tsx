'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Bot, 
  Vault, 
  Trophy, 
  Image,
  ChevronLeft,
  ChevronRight,
  Dice1,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Overview & Stats',
  },
  {
    id: 'bots',
    label: 'AI Bots',
    icon: Bot,
    description: 'Chat & Performance',
  },
  {
    id: 'vaults',
    label: 'Vaults',
    icon: Vault,
    description: 'LP & Yields',
  },
  {
    id: 'nft',
    label: 'NFT Gallery',
    icon: Image,
    description: 'Mint Passes & Art',
  },
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    icon: Trophy,
    description: 'Top Performers',
  },
] as const;

const quickStats = [
  { label: 'Active Bots', value: '10', icon: Users, color: 'text-neon-green' },
  { label: 'Live Games', value: '3', icon: Dice1, color: 'text-neon-blue' },
  { label: 'Total Bets', value: '1,234', icon: TrendingUp, color: 'text-neon-purple' },
  { label: 'Energy', value: '92%', icon: Zap, color: 'text-neon-yellow' },
];

export function Sidebar() {
  const { selectedView, setSelectedView, sidebarOpen, toggleSidebar } = useGameStore();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-casino-darker/95 backdrop-blur-md border-r border-gray-800 transition-all duration-300 z-50",
      sidebarOpen ? "w-64" : "w-20"
    )}>
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-red to-neon-purple rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">BH</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-sm text-neon">Casino</h2>
                  <p className="text-xs text-gray-400">v1.0.0</p>
                </div>
              </div>
            )}
            
            <button
              onClick={toggleSidebar}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const isActive = selectedView === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => setSelectedView(item.id)}
                className={cn(
                  "w-full flex items-center p-3 rounded-lg transition-all duration-200 group",
                  isActive 
                    ? "bg-neon-red/20 text-neon-red border border-neon-red/30" 
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive && "text-neon-red"
                )} />
                
                {sidebarOpen && (
                  <div className="ml-3 text-left">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs opacity-70">{item.description}</p>
                  </div>
                )}
                
                {!sidebarOpen && (
                  <div className="absolute left-16 bg-casino-dark border border-gray-700 rounded-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-sm font-medium whitespace-nowrap">{item.label}</p>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{item.description}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Stats */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-800">
            <h3 className="text-xs font-display uppercase tracking-wider text-gray-400 mb-3">
              Quick Stats
            </h3>
            <div className="space-y-2">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center space-x-3">
                    <Icon className={cn("w-4 h-4", stat.color)} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className={cn("text-sm font-mono font-bold", stat.color)}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed Quick Stats */}
        {!sidebarOpen && (
          <div className="p-4 border-t border-gray-800 space-y-3">
            {quickStats.slice(0, 2).map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex flex-col items-center group relative">
                  <Icon className={cn("w-4 h-4", stat.color)} />
                  <p className={cn("text-xs font-mono", stat.color)}>{stat.value}</p>
                  
                  <div className="absolute left-16 bg-casino-dark border border-gray-700 rounded-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p className="text-sm font-medium whitespace-nowrap">{stat.label}</p>
                    <p className={cn("text-sm font-mono", stat.color)}>{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}