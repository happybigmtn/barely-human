'use client';

import React, { useState, useEffect } from 'react';
import { 
  Avatar,
  Name,
  Identity,
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownBasename,
  WalletDropdownFundLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/identity';
import { 
  Address,
  EthBalance 
} from '@coinbase/onchainkit/identity';
import { useAccount, useDisconnect } from 'wagmi';
import { base, baseSepolia } from 'viem/chains';
import { toast } from 'react-hot-toast';

interface CDPEmbeddedWalletProps {
  onConnectionChange?: (isConnected: boolean) => void;
  showBalance?: boolean;
  showAvatar?: boolean;
  className?: string;
}

export function CDPEmbeddedWallet({
  onConnectionChange,
  showBalance = true,
  showAvatar = true,
  className
}: CDPEmbeddedWalletProps) {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const [isClient, setIsClient] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle connection changes
  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  // Handle wallet events
  const handleWalletConnect = () => {
    toast.success('Wallet connected successfully!');
  };

  const handleWalletDisconnect = () => {
    toast.success('Wallet disconnected');
    disconnect();
  };

  const handleFundingComplete = (txHash: string) => {
    toast.success('Funding completed!');
    console.log('Funding transaction:', txHash);
  };

  // Don't render until hydrated
  if (!isClient) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-32 h-10 bg-gray-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Determine current chain for OnchainKit
  const currentChain = chain?.id === 8453 ? base : baseSepolia;

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {isConnected && address ? (
        // Connected state - show wallet info and dropdown
        <Wallet>
          <ConnectWallet 
            onSuccess={handleWalletConnect}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-600"
          >
            <Avatar className="h-8 w-8" />
            <Name className="text-white font-medium" />
          </ConnectWallet>
          
          <WalletDropdown className="bg-gray-900 border border-gray-700">
            <Identity 
              className="px-4 py-3 border-b border-gray-700"
              hasCopyAddressOnClick
            >
              {showAvatar && <Avatar className="h-12 w-12" />}
              <Name className="text-white font-semibold" />
              <Address className="text-gray-400 font-mono text-sm" />
              {showBalance && (
                <EthBalance className="text-neon-green font-medium" />
              )}
            </Identity>
            
            <WalletDropdownBasename className="hover:bg-gray-800" />
            
            <WalletDropdownFundLink 
              className="hover:bg-gray-800 text-blue-400"
              onSuccess={handleFundingComplete}
            />
            
            <WalletDropdownLink
              icon="⚙️"
              href="/settings"
              className="hover:bg-gray-800"
            >
              Settings
            </WalletDropdownLink>
            
            <WalletDropdownLink
              icon="📊"
              href="/dashboard"
              className="hover:bg-gray-800"
            >
              Dashboard
            </WalletDropdownLink>
            
            <WalletDropdownDisconnect 
              className="hover:bg-gray-800 text-red-400"
              onDisconnect={handleWalletDisconnect}
            />
          </WalletDropdown>
        </Wallet>
      ) : (
        // Disconnected state - show connect button
        <ConnectWallet
          onSuccess={handleWalletConnect}
          className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <span>Connect Wallet</span>
        </ConnectWallet>
      )}

      {/* Chain indicator */}
      {isConnected && (
        <div className="flex items-center space-x-1 text-xs">
          <div 
            className={`w-2 h-2 rounded-full ${
              chain?.id === 8453 
                ? 'bg-blue-500' 
                : chain?.id === 84532 
                ? 'bg-yellow-500' 
                : 'bg-gray-500'
            }`}
          />
          <span className="text-gray-400">
            {chain?.name || 'Unknown'}
          </span>
        </div>
      )}

      {/* Connection status for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500">
          {isConnected ? '🟢' : '🔴'}
        </div>
      )}
    </div>
  );
}

// Individual components for more granular control
export function CDPWalletAddress({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  
  if (!isConnected || !address) return null;
  
  return (
    <Address 
      address={address}
      className={`font-mono text-sm text-gray-400 ${className}`}
    />
  );
}

export function CDPWalletBalance({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  
  if (!isConnected || !address) return null;
  
  return (
    <EthBalance 
      address={address}
      className={`text-neon-green font-medium ${className}`}
    />
  );
}

export function CDPWalletAvatar({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  
  if (!isConnected || !address) return null;
  
  return (
    <Avatar 
      address={address}
      className={`h-8 w-8 ${className}`}
    />
  );
}

// Export types
export type { CDPEmbeddedWalletProps };