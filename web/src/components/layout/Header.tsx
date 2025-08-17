'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Menu, Bell, Settings } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useVaultStore } from '@/store/vaultStore';
import { formatEther } from 'viem';

export function Header() {
  const { toggleSidebar, notifications } = useGameStore();
  const { botTokenPrice, totalValueLocked } = useVaultStore();

  const unreadNotifications = notifications.length;

  return (
    <header className="bg-casino-darker/80 backdrop-blur-md border-b border-gray-800 p-4">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-neon-red to-neon-purple rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">BH</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-display font-bold text-neon">
                Barely Human
              </h1>
              <p className="text-xs text-gray-400">DeFi Casino</p>
            </div>
          </div>
        </div>

        {/* Center Section - Market Data */}
        <div className="hidden md:flex items-center space-x-6">
          {/* BOT Token Price */}
          {botTokenPrice && (
            <div className="text-center">
              <p className="text-xs text-gray-400">BOT Price</p>
              <p className="text-sm font-mono text-neon-green">
                ${botTokenPrice.usd.toFixed(4)}
              </p>
              <p className={`text-xs ${
                botTokenPrice.change24h >= 0 ? 'text-neon-green' : 'text-neon-red'
              }`}>
                {botTokenPrice.change24h >= 0 ? '+' : ''}
                {botTokenPrice.change24h.toFixed(2)}%
              </p>
            </div>
          )}

          {/* Total Value Locked */}
          <div className="text-center">
            <p className="text-xs text-gray-400">Total TVL</p>
            <p className="text-sm font-mono text-neon-blue">
              {totalValueLocked > 0 ? `${formatEther(totalValueLocked)} BOT` : '--'}
            </p>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">LIVE</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-neon-red rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              </div>
            )}
          </button>

          {/* Settings */}
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          {/* Wallet Connection */}
          <ConnectButton 
            chainStatus="icon"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>

      {/* Mobile Market Data */}
      <div className="md:hidden mt-4 flex justify-center space-x-6">
        {botTokenPrice && (
          <div className="text-center">
            <p className="text-xs text-gray-400">BOT</p>
            <p className="text-sm font-mono text-neon-green">
              ${botTokenPrice.usd.toFixed(4)}
            </p>
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-gray-400">TVL</p>
          <p className="text-sm font-mono text-neon-blue">
            {totalValueLocked > 0 ? `${formatEther(totalValueLocked)} BOT` : '--'}
          </p>
        </div>
      </div>
    </header>
  );
}