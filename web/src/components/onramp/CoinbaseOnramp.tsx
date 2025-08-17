'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  OnchainKitProvider,
  FundButton,
  Fund
} from '@coinbase/onchainkit';
import { base, baseSepolia } from 'viem/chains';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

interface CoinbaseOnrampProps {
  targetAsset?: 'ETH' | 'USDC' | 'BOT';
  targetAmount?: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function CoinbaseOnramp({
  targetAsset = 'ETH',
  targetAmount,
  onSuccess,
  onError,
  className
}: CoinbaseOnrampProps) {
  const { address, isConnected, chain } = useAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onrampURL, setOnrampURL] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Determine the current chain
  const currentChain = chain?.id === 8453 ? base : baseSepolia;

  const generateOnrampURL = async () => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      // Generate Coinbase Onramp URL
      const response = await fetch('/api/coinbase/onramp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationWallet: address,
          asset: targetAsset,
          amount: targetAmount,
          chain: currentChain.name.toLowerCase(),
          blockchain: currentChain.name.toLowerCase() === 'base' ? 'base' : 'base-sepolia'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate onramp URL');
      }

      const data = await response.json();
      setOnrampURL(data.url);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Onramp URL generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate onramp URL';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnrampComplete = (txHash: string) => {
    toast.success('Purchase completed successfully!');
    setIsModalOpen(false);
    onSuccess?.(txHash);
  };

  if (!isConnected) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <p className="text-gray-400 mb-2">Connect your wallet to buy crypto</p>
        <p className="text-sm text-gray-500">Fund your account with fiat currency</p>
      </div>
    );
  }

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY!}
      chain={currentChain}
      config={{
        appearance: {
          mode: 'dark',
          theme: 'cyberpunk'
        }
      }}
    >
      <div className={className}>
        {/* Primary Fund Button using OnchainKit */}
        <Fund>
          <FundButton 
            text={`Buy ${targetAsset} with Card`}
            hideIcon={false}
            disabled={isLoading}
          />
        </Fund>

        {/* Custom Onramp Button */}
        <div className="mt-2">
          <Button
            onClick={generateOnrampURL}
            disabled={isLoading || !address}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Generating Link...' : `Buy ${targetAsset} (Custom)`}
          </Button>
        </div>

        {/* Onramp Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          title="Buy Crypto with Coinbase"
        >
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-300 mb-4">
                Complete your purchase on Coinbase
              </p>
              {onrampURL && (
                <div className="space-y-3">
                  <a
                    href={onrampURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full"
                  >
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      Open Coinbase Onramp
                    </Button>
                  </a>
                  <p className="text-xs text-gray-500">
                    Opens in a new window. Return here when complete.
                  </p>
                </div>
              )}
            </div>

            {/* Purchase Status */}
            <div className="border-t border-gray-700 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Asset:</span>
                  <span className="text-white">{targetAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-white">{currentChain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Destination:</span>
                  <span className="text-white font-mono text-xs">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                {targetAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">{targetAmount} {targetAsset}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="outline"
              >
                Close
              </Button>
              <Button
                onClick={() => handleOnrampComplete('simulated-tx-hash')}
                className="bg-green-600 hover:bg-green-700"
              >
                Mark Complete
              </Button>
            </div>
          </div>
        </Modal>

        {/* Info Section */}
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-2">
            Buy Crypto with Fiat
          </h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Credit/Debit Card supported</li>
            <li>• Bank Transfer available</li>
            <li>• Apple Pay & Google Pay</li>
            <li>• Instant delivery to your wallet</li>
          </ul>
        </div>
      </div>
    </OnchainKitProvider>
  );
}

// Export types for external use
export type { CoinbaseOnrampProps };