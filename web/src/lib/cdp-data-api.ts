import { Coinbase } from '@coinbase/coinbase-sdk';

// Initialize CDP SDK
const initializeCDP = () => {
  if (!process.env.CDP_API_SECRET || !process.env.CDP_PRIVATE_KEY) {
    console.warn('CDP credentials not configured');
    return null;
  }

  try {
    return new Coinbase({
      apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY!,
      privateKey: process.env.CDP_PRIVATE_KEY!,
    });
  } catch (error) {
    console.error('Failed to initialize CDP SDK:', error);
    return null;
  }
};

const cdp = initializeCDP();

// Types for CDP Data API responses
export interface TokenBalance {
  asset: string;
  balance: string;
  decimals: number;
  name: string;
  symbol: string;
  contractAddress?: string;
}

export interface TransactionEvent {
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  contractAddress: string;
  eventName: string;
  eventSignature: string;
  decodedLog: any;
  timestamp: string;
}

export interface SQLQueryResult {
  rows: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export interface WalletHistory {
  transactions: Array<{
    hash: string;
    blockNumber: number;
    timestamp: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    status: string;
    type: string;
  }>;
  totalCount: number;
}

// CDP Token Balance API
export class CDPTokenBalanceAPI {
  static async getTokenBalances(
    address: string,
    network: 'base' | 'base-sepolia' = 'base'
  ): Promise<TokenBalance[]> {
    try {
      const response = await fetch('/api/coinbase/token-balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, network }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch token balances');
      }

      const data = await response.json();
      return data.balances || [];
    } catch (error) {
      console.error('Token balance fetch error:', error);
      return [];
    }
  }

  static async getBOTTokenBalance(
    address: string,
    contractAddress: string
  ): Promise<TokenBalance | null> {
    try {
      const balances = await this.getTokenBalances(address);
      return balances.find(
        balance => balance.contractAddress?.toLowerCase() === contractAddress.toLowerCase()
      ) || null;
    } catch (error) {
      console.error('BOT token balance fetch error:', error);
      return null;
    }
  }

  static async getMultipleTokenBalances(
    addresses: string[],
    network: 'base' | 'base-sepolia' = 'base'
  ): Promise<Record<string, TokenBalance[]>> {
    try {
      const promises = addresses.map(address => 
        this.getTokenBalances(address, network)
      );
      
      const results = await Promise.all(promises);
      
      return addresses.reduce((acc, address, index) => {
        acc[address] = results[index];
        return acc;
      }, {} as Record<string, TokenBalance[]>);
    } catch (error) {
      console.error('Multiple token balances fetch error:', error);
      return {};
    }
  }
}

// CDP Smart Contract Events API
export class CDPEventAPI {
  static async getContractEvents(
    contractAddress: string,
    eventName: string,
    fromBlock?: number,
    toBlock?: number,
    network: 'base' | 'base-sepolia' = 'base'
  ): Promise<TransactionEvent[]> {
    try {
      const response = await fetch('/api/coinbase/contract-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress,
          eventName,
          fromBlock,
          toBlock,
          network
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contract events');
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Contract events fetch error:', error);
      return [];
    }
  }

  static async getCrapsGameEvents(
    gameAddress: string,
    eventTypes: string[] = ['BetPlaced', 'DiceRolled', 'BetSettled']
  ): Promise<TransactionEvent[]> {
    try {
      const promises = eventTypes.map(eventType => 
        this.getContractEvents(gameAddress, eventType)
      );
      
      const results = await Promise.all(promises);
      return results.flat().sort((a, b) => 
        parseInt(b.blockNumber.toString()) - parseInt(a.blockNumber.toString())
      );
    } catch (error) {
      console.error('Craps game events fetch error:', error);
      return [];
    }
  }

  static async getBotManagerEvents(
    managerAddress: string,
    botId?: number
  ): Promise<TransactionEvent[]> {
    try {
      const events = await this.getContractEvents(
        managerAddress, 
        'BotActionTriggered'
      );
      
      if (botId !== undefined) {
        return events.filter(event => 
          event.decodedLog?.botId === botId
        );
      }
      
      return events;
    } catch (error) {
      console.error('Bot manager events fetch error:', error);
      return [];
    }
  }
}

// CDP SQL API for advanced queries
export class CDPSQLApi {
  static async executeQuery(query: string): Promise<SQLQueryResult> {
    try {
      const response = await fetch('/api/coinbase/sql-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute SQL query');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('SQL query execution error:', error);
      throw error;
    }
  }

  static async getGameStatistics(
    gameAddress: string,
    timeframe: '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    totalBets: number;
    totalVolume: string;
    uniquePlayers: number;
    winRate: number;
  }> {
    const hoursBack = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
    
    const query = `
      SELECT 
        COUNT(*) as total_bets,
        SUM(CAST(topics[3] as NUMERIC)) as total_volume,
        COUNT(DISTINCT topics[1]) as unique_players,
        AVG(CASE WHEN topics[4] = '0x1' THEN 1.0 ELSE 0.0 END) * 100 as win_rate
      FROM base.events 
      WHERE contract_address = LOWER('${gameAddress}')
        AND topics[0] = '0x...' -- BetSettled event signature
        AND block_timestamp > NOW() - INTERVAL '${hoursBack} hours'
    `;

    try {
      const result = await this.executeQuery(query);
      const row = result.rows[0];
      
      return {
        totalBets: parseInt(row?.total_bets || '0'),
        totalVolume: row?.total_volume || '0',
        uniquePlayers: parseInt(row?.unique_players || '0'),
        winRate: parseFloat(row?.win_rate || '0')
      };
    } catch (error) {
      console.error('Game statistics query error:', error);
      return {
        totalBets: 0,
        totalVolume: '0',
        uniquePlayers: 0,
        winRate: 0
      };
    }
  }

  static async getBotPerformanceData(
    vaultFactoryAddress: string,
    timeframe: '24h' | '7d' | '30d' = '7d'
  ): Promise<Array<{
    botId: number;
    totalBets: number;
    winRate: number;
    profitLoss: string;
    volumeTraded: string;
  }>> {
    const hoursBack = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
    
    const query = `
      SELECT 
        CAST(topics[1] as INTEGER) as bot_id,
        COUNT(*) as total_bets,
        AVG(CASE WHEN topics[3] = '0x1' THEN 1.0 ELSE 0.0 END) * 100 as win_rate,
        SUM(CAST(topics[4] as BIGINT)) - SUM(CAST(topics[2] as BIGINT)) as profit_loss,
        SUM(CAST(topics[2] as BIGINT)) as volume_traded
      FROM base.events 
      WHERE contract_address IN (
        SELECT vault_address FROM base.events 
        WHERE contract_address = LOWER('${vaultFactoryAddress}')
          AND topics[0] = '0x...' -- VaultCreated event signature
      )
      AND topics[0] = '0x...' -- BetSettled event signature
      AND block_timestamp > NOW() - INTERVAL '${hoursBack} hours'
      GROUP BY bot_id
      ORDER BY win_rate DESC
    `;

    try {
      const result = await this.executeQuery(query);
      
      return result.rows.map(row => ({
        botId: parseInt(row.bot_id),
        totalBets: parseInt(row.total_bets),
        winRate: parseFloat(row.win_rate),
        profitLoss: row.profit_loss.toString(),
        volumeTraded: row.volume_traded.toString()
      }));
    } catch (error) {
      console.error('Bot performance query error:', error);
      return [];
    }
  }

  static async getVaultTVLHistory(
    vaultAddresses: string[],
    days: number = 30
  ): Promise<Array<{
    date: string;
    totalTVL: string;
    vaultTVLs: Record<string, string>;
  }>> {
    const vaultList = vaultAddresses.map(addr => `'${addr.toLowerCase()}'`).join(',');
    
    const query = `
      SELECT 
        DATE(block_timestamp) as date,
        SUM(CAST(data as BIGINT)) as total_tvl,
        contract_address,
        CAST(data as BIGINT) as vault_tvl
      FROM base.events 
      WHERE contract_address IN (${vaultList})
        AND topics[0] = '0x...' -- TVL update event signature
        AND block_timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY date, contract_address
      ORDER BY date DESC
    `;

    try {
      const result = await this.executeQuery(query);
      
      // Group by date
      const groupedData = result.rows.reduce((acc, row) => {
        const date = row.date;
        if (!acc[date]) {
          acc[date] = {
            date,
            totalTVL: '0',
            vaultTVLs: {}
          };
        }
        
        acc[date].vaultTVLs[row.contract_address] = row.vault_tvl.toString();
        acc[date].totalTVL = (
          BigInt(acc[date].totalTVL) + BigInt(row.vault_tvl)
        ).toString();
        
        return acc;
      }, {} as Record<string, any>);
      
      return Object.values(groupedData);
    } catch (error) {
      console.error('Vault TVL history query error:', error);
      return [];
    }
  }
}

// CDP Wallet History API
export class CDPWalletHistoryAPI {
  static async getWalletHistory(
    address: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletHistory> {
    try {
      const response = await fetch('/api/coinbase/wallet-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, limit, offset }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet history');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Wallet history fetch error:', error);
      return {
        transactions: [],
        totalCount: 0
      };
    }
  }

  static async getRecentTransactions(
    address: string,
    contractAddresses: string[] = []
  ): Promise<WalletHistory['transactions']> {
    try {
      const history = await this.getWalletHistory(address, 20);
      
      if (contractAddresses.length === 0) {
        return history.transactions;
      }
      
      // Filter for specific contract interactions
      return history.transactions.filter(tx => 
        contractAddresses.some(addr => 
          tx.to?.toLowerCase() === addr.toLowerCase()
        )
      );
    } catch (error) {
      console.error('Recent transactions fetch error:', error);
      return [];
    }
  }
}

// Utility functions
export const cdpUtils = {
  formatTokenAmount: (amount: string, decimals: number = 18): string => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const formatted = Number(value) / Number(divisor);
    return formatted.toLocaleString();
  },

  isValidAddress: (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  getNetworkName: (chainId: number): 'base' | 'base-sepolia' | 'unknown' => {
    switch (chainId) {
      case 8453:
        return 'base';
      case 84532:
        return 'base-sepolia';
      default:
        return 'unknown';
    }
  }
};

// Export the initialized CDP instance for direct use if needed
export { cdp };