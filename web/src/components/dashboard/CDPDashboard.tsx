'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  TrendingUp, 
  Wallet, 
  Activity, 
  DollarSign, 
  BarChart3,
  CreditCard,
  Server,
  Database
} from 'lucide-react';

// Import our CDP components
import { CoinbaseOnramp } from '@/components/onramp/CoinbaseOnramp';
import { CDPEmbeddedWallet } from '@/components/wallet/CDPEmbeddedWallet';

// Import CDP API classes
import { 
  CDPTokenBalanceAPI, 
  CDPEventAPI, 
  CDPSQLApi, 
  CDPWalletHistoryAPI,
  TokenBalance,
  TransactionEvent 
} from '@/lib/cdp-data-api';

import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

interface CDPDashboardProps {
  className?: string;
}

interface DashboardData {
  tokenBalances: TokenBalance[];
  recentEvents: TransactionEvent[];
  gameStats: {
    totalBets: number;
    totalVolume: string;
    uniquePlayers: number;
    winRate: number;
  };
  walletHistory: any[];
  isLoading: boolean;
}

export function CDPDashboard({ className }: CDPDashboardProps) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'overview' | 'onramp' | 'wallet' | 'data' | 'sql'>('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    tokenBalances: [],
    recentEvents: [],
    gameStats: { totalBets: 0, totalVolume: '0', uniquePlayers: 0, winRate: 0 },
    walletHistory: [],
    isLoading: true
  });
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState<any>(null);

  // Load dashboard data
  useEffect(() => {
    if (isConnected && address) {
      loadDashboardData();
    }
  }, [isConnected, address]);

  const loadDashboardData = async () => {
    if (!address) return;

    setDashboardData(prev => ({ ...prev, isLoading: true }));

    try {
      const [tokenBalances, gameStats, walletHistory] = await Promise.all([
        CDPTokenBalanceAPI.getTokenBalances(address),
        CDPSQLApi.getGameStatistics(
          process.env.NEXT_PUBLIC_CRAPS_GAME_ADDRESS || '0x...'
        ),
        CDPWalletHistoryAPI.getRecentTransactions(address)
      ]);

      // Get contract events
      const recentEvents = await CDPEventAPI.getCrapsGameEvents(
        process.env.NEXT_PUBLIC_CRAPS_GAME_ADDRESS || '0x...'
      );

      setDashboardData({
        tokenBalances,
        recentEvents: recentEvents.slice(0, 10),
        gameStats,
        walletHistory,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
      setDashboardData(prev => ({ ...prev, isLoading: false }));
    }
  };

  const executeSQLQuery = async () => {
    if (!sqlQuery.trim()) {
      toast.error('Please enter a SQL query');
      return;
    }

    try {
      const results = await CDPSQLApi.executeQuery(sqlQuery);
      setSqlResults(results);
      toast.success('Query executed successfully');
    } catch (error) {
      console.error('SQL query failed:', error);
      toast.error('Query execution failed');
    }
  };

  const handleOnrampSuccess = (txHash: string) => {
    toast.success('Purchase completed! Refreshing balances...');
    setTimeout(() => {
      loadDashboardData();
    }, 5000);
  };

  // Tab navigation
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'onramp', label: 'Buy Crypto', icon: CreditCard },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'data', label: 'Data APIs', icon: Database },
    { id: 'sql', label: 'SQL Query', icon: Server }
  ];

  if (!isConnected) {
    return (
      <div className={`bg-gray-900 rounded-xl border border-gray-700 p-8 text-center ${className}`}>
        <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-400 mb-6">
          Connect your wallet to access Coinbase Developer Platform features
        </p>
        <CDPEmbeddedWallet />
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Coinbase Developer Platform
            </h2>
            <p className="text-blue-100 mt-1">
              Integrated onramp, wallets, and data APIs
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <CDPEmbeddedWallet showBalance showAvatar />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8 px-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab 
            data={dashboardData} 
            onRefresh={loadDashboardData}
          />
        )}

        {activeTab === 'onramp' && (
          <OnrampTab onSuccess={handleOnrampSuccess} />
        )}

        {activeTab === 'wallet' && (
          <WalletTab 
            address={address}
            balances={dashboardData.tokenBalances}
            history={dashboardData.walletHistory}
          />
        )}

        {activeTab === 'data' && (
          <DataAPITab 
            events={dashboardData.recentEvents}
            gameStats={dashboardData.gameStats}
          />
        )}

        {activeTab === 'sql' && (
          <SQLTab 
            query={sqlQuery}
            setQuery={setSqlQuery}
            results={sqlResults}
            onExecute={executeSQLQuery}
          />
        )}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ 
  data, 
  onRefresh 
}: { 
  data: DashboardData; 
  onRefresh: () => void; 
}) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Token Balance</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {data.tokenBalances.length} Assets
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="text-gray-400 text-sm">Total Bets</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {data.gameStats.totalBets.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400 text-sm">Volume</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {(parseInt(data.gameStats.totalVolume) / 1e18).toFixed(0)} BOT
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400 text-sm">Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {data.gameStats.winRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Events</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentEvents.map((event, index) => (
              <div key={index} className="border-b border-gray-700 pb-2">
                <div className="flex justify-between items-start">
                  <span className="text-blue-400 font-medium">
                    {event.eventName}
                  </span>
                  <span className="text-xs text-gray-500">
                    Block {event.blockNumber}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {event.contractAddress.slice(0, 10)}...
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Token Balances</h3>
          <div className="space-y-3">
            {data.tokenBalances.map((balance, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {balance.symbol[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{balance.symbol}</p>
                    <p className="text-gray-400 text-sm">{balance.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    {(parseInt(balance.balance) / Math.pow(10, balance.decimals)).toFixed(4)}
                  </p>
                  <p className="text-gray-400 text-sm">{balance.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button 
          onClick={onRefresh}
          disabled={data.isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {data.isLoading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>
    </div>
  );
}

// Onramp Tab Component
function OnrampTab({ onSuccess }: { onSuccess: (txHash: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">
          Buy Crypto with Fiat
        </h3>
        <p className="text-gray-400">
          Use Coinbase Onramp to purchase crypto directly to your wallet
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ETH Purchase */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Buy ETH</h4>
          <CoinbaseOnramp
            targetAsset="ETH"
            targetAmount="0.1"
            onSuccess={onSuccess}
            className="w-full"
          />
        </div>

        {/* USDC Purchase */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Buy USDC</h4>
          <CoinbaseOnramp
            targetAsset="USDC"
            targetAmount="100"
            onSuccess={onSuccess}
            className="w-full"
          />
        </div>
      </div>

      {/* Features List */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">
          Onramp Features
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ul className="space-y-2 text-gray-300">
            <li>• Multiple payment methods</li>
            <li>• Instant delivery to wallet</li>
            <li>• Competitive exchange rates</li>
          </ul>
          <ul className="space-y-2 text-gray-300">
            <li>• Bank transfers & cards</li>
            <li>• Apple Pay & Google Pay</li>
            <li>• Global availability</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Wallet Tab Component
function WalletTab({ 
  address, 
  balances, 
  history 
}: { 
  address: string; 
  balances: TokenBalance[]; 
  history: any[]; 
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Wallet Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm">Address</label>
            <p className="text-white font-mono text-sm break-all">{address}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm">Assets</label>
              <p className="text-white text-xl font-bold">{balances.length}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Transactions</label>
              <p className="text-white text-xl font-bold">{history.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Recent Transactions
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {history.slice(0, 10).map((tx, index) => (
            <div key={index} className="border-b border-gray-700 pb-2">
              <div className="flex justify-between items-start">
                <span className="text-blue-400 font-medium">
                  {tx.hash?.slice(0, 10)}...
                </span>
                <span className="text-xs text-gray-500">
                  {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {tx.type || 'Transaction'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Data API Tab Component
function DataAPITab({ 
  events, 
  gameStats 
}: { 
  events: TransactionEvent[]; 
  gameStats: any; 
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Game Statistics (CDP SQL API)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Total Bets</p>
            <p className="text-white text-xl font-bold">{gameStats.totalBets}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Volume</p>
            <p className="text-white text-xl font-bold">
              {(parseInt(gameStats.totalVolume || '0') / 1e18).toFixed(0)} BOT
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Players</p>
            <p className="text-white text-xl font-bold">{gameStats.uniquePlayers}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Win Rate</p>
            <p className="text-white text-xl font-bold">{gameStats.winRate?.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Smart Contract Events (CDP Events API)
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {events.map((event, index) => (
            <div key={index} className="border-b border-gray-700 pb-2">
              <div className="flex justify-between items-start">
                <span className="text-green-400 font-medium">
                  {event.eventName}
                </span>
                <span className="text-xs text-gray-500">
                  Block {event.blockNumber}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-6)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// SQL Tab Component
function SQLTab({ 
  query, 
  setQuery, 
  results, 
  onExecute 
}: { 
  query: string; 
  setQuery: (q: string) => void; 
  results: any; 
  onExecute: () => void; 
}) {
  const exampleQueries = [
    {
      name: 'Daily Transaction Count',
      query: `SELECT DATE(block_timestamp) as date, COUNT(*) as tx_count 
FROM base.transactions 
WHERE block_timestamp > NOW() - INTERVAL '7 days' 
GROUP BY date 
ORDER BY date DESC`
    },
    {
      name: 'Top Contracts by Activity',
      query: `SELECT contract_address, COUNT(*) as event_count 
FROM base.events 
WHERE block_timestamp > NOW() - INTERVAL '24 hours' 
GROUP BY contract_address 
ORDER BY event_count DESC 
LIMIT 10`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          CDP SQL API Query Interface
        </h3>
        
        {/* Example Queries */}
        <div className="mb-4">
          <p className="text-gray-400 text-sm mb-2">Example Queries:</p>
          <div className="flex space-x-2">
            {exampleQueries.map((example, index) => (
              <Button
                key={index}
                onClick={() => setQuery(example.query)}
                variant="outline"
                size="sm"
              >
                {example.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <div className="space-y-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Enter your SQL query here..."
          />
          
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-xs">
              Only SELECT queries allowed. Max 10,000 rows.
            </p>
            <Button onClick={onExecute} disabled={!query.trim()}>
              Execute Query
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Query Results</h4>
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">
              {results.rowCount} rows returned in {results.executionTime}ms
            </p>
            
            {results.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      {results.columns.map((col: string, index: number) => (
                        <th key={index} className="text-left text-gray-400 font-medium py-2 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows.slice(0, 20).map((row: any, rowIndex: number) => (
                      <tr key={rowIndex} className="border-b border-gray-700">
                        {results.columns.map((col: string, colIndex: number) => (
                          <td key={colIndex} className="text-white py-2 px-3 font-mono text-xs">
                            {JSON.stringify(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}