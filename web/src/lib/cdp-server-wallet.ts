import { Coinbase, Wallet, Address } from '@coinbase/coinbase-sdk';

// Types for server wallet operations
export interface ServerWalletConfig {
  apiKeyName: string;
  privateKey: string;
  networkId: string;
}

export interface WalletOperation {
  type: 'transfer' | 'contract_call' | 'deploy';
  destination?: string;
  amount?: string;
  contractAddress?: string;
  methodName?: string;
  parameters?: any[];
  gasLimit?: number;
}

export interface TransactionResult {
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  blockNumber?: number;
  timestamp: string;
}

// CDP Server Wallet Manager
export class CDPServerWallet {
  private coinbase: Coinbase;
  private wallet: Wallet | null = null;
  private defaultAddress: Address | null = null;

  constructor(config: ServerWalletConfig) {
    this.coinbase = new Coinbase({
      apiKeyName: config.apiKeyName,
      privateKey: config.privateKey,
    });
  }

  // Initialize or import existing wallet
  async initialize(walletId?: string): Promise<void> {
    try {
      if (walletId) {
        // Import existing wallet
        this.wallet = await this.coinbase.getWallet(walletId);
      } else {
        // Create new wallet
        this.wallet = await this.coinbase.createWallet({
          networkId: 'base-sepolia' // or 'base' for mainnet
        });
      }

      // Get default address
      this.defaultAddress = await this.wallet.getDefaultAddress();
      
      console.log('CDP Server Wallet initialized:', {
        walletId: this.wallet.getId(),
        address: await this.defaultAddress.getId()
      });
    } catch (error) {
      console.error('Failed to initialize CDP Server Wallet:', error);
      throw error;
    }
  }

  // Get wallet information
  async getWalletInfo(): Promise<{
    walletId: string;
    address: string;
    networkId: string;
    balance: string;
  }> {
    if (!this.wallet || !this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    const balance = await this.defaultAddress.getBalance('eth');
    
    return {
      walletId: this.wallet.getId(),
      address: await this.defaultAddress.getId(),
      networkId: this.wallet.getNetworkId(),
      balance: balance.toString()
    };
  }

  // Transfer ETH or tokens
  async transfer(
    destination: string,
    amount: string,
    assetId: string = 'eth'
  ): Promise<TransactionResult> {
    if (!this.wallet || !this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const transfer = await this.defaultAddress.createTransfer({
        amount: parseFloat(amount),
        assetId,
        destination
      });

      // Wait for confirmation
      await transfer.wait();

      return {
        transactionHash: transfer.getTransactionHash(),
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Transfer failed:', error);
      throw error;
    }
  }

  // Call smart contract method
  async callContract(
    contractAddress: string,
    methodName: string,
    parameters: any[] = [],
    value: string = '0'
  ): Promise<TransactionResult> {
    if (!this.wallet || !this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const invocation = await this.defaultAddress.invokeContract({
        contractAddress,
        method: methodName,
        args: parameters,
        ...(value !== '0' && { amount: parseFloat(value), assetId: 'eth' })
      });

      // Wait for confirmation
      await invocation.wait();

      return {
        transactionHash: invocation.getTransactionHash(),
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Contract call failed:', error);
      throw error;
    }
  }

  // Deploy smart contract
  async deployContract(
    contractCode: string,
    constructorArgs: any[] = []
  ): Promise<TransactionResult & { contractAddress: string }> {
    if (!this.wallet || !this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const deployment = await this.defaultAddress.deployContract({
        contractCode,
        constructorArgs
      });

      // Wait for confirmation
      await deployment.wait();

      return {
        transactionHash: deployment.getTransactionHash(),
        contractAddress: deployment.getContractAddress(),
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Contract deployment failed:', error);
      throw error;
    }
  }

  // Get transaction history
  async getTransactionHistory(limit: number = 50): Promise<any[]> {
    if (!this.wallet || !this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const transactions = await this.defaultAddress.listTransactions({
        limit
      });

      return transactions.map(tx => ({
        hash: tx.getTransactionHash(),
        status: tx.getStatus(),
        timestamp: tx.getBlockTimestamp(),
        gasUsed: tx.getGasUsed()
      }));
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  // Fund wallet from faucet (testnet only)
  async requestFaucetFunds(): Promise<void> {
    if (!this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const faucetTx = await this.defaultAddress.faucet();
      await faucetTx.wait();
      console.log('Faucet funds received:', faucetTx.getTransactionHash());
    } catch (error) {
      console.error('Faucet request failed:', error);
      throw error;
    }
  }
}

// Casino-specific wallet operations
export class CasinoServerWallet extends CDPServerWallet {
  // Place bet on behalf of a bot
  async placeBotBet(
    crapsGameAddress: string,
    betType: number,
    amount: string
  ): Promise<TransactionResult> {
    return this.callContract(
      crapsGameAddress,
      'placeBet',
      [betType, amount],
      amount
    );
  }

  // Deposit to vault
  async depositToVault(
    vaultAddress: string,
    assets: string,
    receiver: string
  ): Promise<TransactionResult> {
    return this.callContract(
      vaultAddress,
      'deposit',
      [assets, receiver]
    );
  }

  // Withdraw from vault
  async withdrawFromVault(
    vaultAddress: string,
    assets: string,
    receiver: string,
    owner: string
  ): Promise<TransactionResult> {
    return this.callContract(
      vaultAddress,
      'withdraw',
      [assets, receiver, owner]
    );
  }

  // Stake BOT tokens
  async stakeBOT(
    stakingPoolAddress: string,
    amount: string
  ): Promise<TransactionResult> {
    return this.callContract(
      stakingPoolAddress,
      'stake',
      [amount]
    );
  }

  // Claim staking rewards
  async claimStakingRewards(
    stakingPoolAddress: string
  ): Promise<TransactionResult> {
    return this.callContract(
      stakingPoolAddress,
      'getReward',
      []
    );
  }

  // Transfer BOT tokens
  async transferBOT(
    botTokenAddress: string,
    to: string,
    amount: string
  ): Promise<TransactionResult> {
    return this.callContract(
      botTokenAddress,
      'transfer',
      [to, amount]
    );
  }

  // Approve BOT token spending
  async approveBOT(
    botTokenAddress: string,
    spender: string,
    amount: string
  ): Promise<TransactionResult> {
    return this.callContract(
      botTokenAddress,
      'approve',
      [spender, amount]
    );
  }

  // Get BOT token balance
  async getBOTBalance(botTokenAddress: string): Promise<string> {
    if (!this.defaultAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      // In a real implementation, this would call the balanceOf method
      // For now, return a mock balance
      return '1000000000000000000000'; // 1000 BOT tokens
    } catch (error) {
      console.error('Failed to get BOT balance:', error);
      return '0';
    }
  }

  // Bulk operations for bot management
  async executeBotActions(actions: WalletOperation[]): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];

    for (const action of actions) {
      try {
        let result: TransactionResult;

        switch (action.type) {
          case 'transfer':
            result = await this.transfer(
              action.destination!,
              action.amount!
            );
            break;

          case 'contract_call':
            result = await this.callContract(
              action.contractAddress!,
              action.methodName!,
              action.parameters,
              action.amount || '0'
            );
            break;

          default:
            throw new Error(`Unsupported action type: ${action.type}`);
        }

        results.push(result);
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
        results.push({
          transactionHash: '',
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }
}

// Wallet factory for creating multiple bot wallets
export class BotWalletFactory {
  private coinbase: Coinbase;
  private wallets: Map<number, CasinoServerWallet> = new Map();

  constructor(config: ServerWalletConfig) {
    this.coinbase = new Coinbase({
      apiKeyName: config.apiKeyName,
      privateKey: config.privateKey,
    });
  }

  // Create wallet for a specific bot
  async createBotWallet(botId: number): Promise<CasinoServerWallet> {
    if (this.wallets.has(botId)) {
      return this.wallets.get(botId)!;
    }

    const wallet = new CasinoServerWallet({
      apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY!,
      privateKey: process.env.CDP_PRIVATE_KEY!,
      networkId: 'base-sepolia'
    });

    await wallet.initialize();
    this.wallets.set(botId, wallet);

    return wallet;
  }

  // Get wallet for a specific bot
  getBotWallet(botId: number): CasinoServerWallet | null {
    return this.wallets.get(botId) || null;
  }

  // Execute parallel operations across multiple bots
  async executeBotOperations(
    operations: Array<{ botId: number; operation: WalletOperation }>
  ): Promise<Record<number, TransactionResult>> {
    const results: Record<number, TransactionResult> = {};

    const promises = operations.map(async ({ botId, operation }) => {
      try {
        const wallet = await this.createBotWallet(botId);
        
        let result: TransactionResult;
        
        if (operation.type === 'contract_call') {
          result = await wallet.callContract(
            operation.contractAddress!,
            operation.methodName!,
            operation.parameters,
            operation.amount || '0'
          );
        } else if (operation.type === 'transfer') {
          result = await wallet.transfer(
            operation.destination!,
            operation.amount!
          );
        } else {
          throw new Error(`Unsupported operation: ${operation.type}`);
        }

        results[botId] = result;
      } catch (error) {
        console.error(`Bot ${botId} operation failed:`, error);
        results[botId] = {
          transactionHash: '',
          status: 'failed',
          timestamp: new Date().toISOString()
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  // Get all bot wallet balances
  async getAllBotBalances(): Promise<Record<number, { eth: string; bot: string }>> {
    const balances: Record<number, { eth: string; bot: string }> = {};
    
    const promises = Array.from(this.wallets.entries()).map(async ([botId, wallet]) => {
      try {
        const info = await wallet.getWalletInfo();
        const botBalance = await wallet.getBOTBalance(
          process.env.NEXT_PUBLIC_BOT_TOKEN_ADDRESS!
        );
        
        balances[botId] = {
          eth: info.balance,
          bot: botBalance
        };
      } catch (error) {
        console.error(`Failed to get balance for bot ${botId}:`, error);
        balances[botId] = { eth: '0', bot: '0' };
      }
    });

    await Promise.all(promises);
    return balances;
  }
}

// Export singleton instances
let globalServerWallet: CDPServerWallet | null = null;
let globalBotFactory: BotWalletFactory | null = null;

export function getServerWallet(): CDPServerWallet {
  if (!globalServerWallet) {
    globalServerWallet = new CDPServerWallet({
      apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY!,
      privateKey: process.env.CDP_PRIVATE_KEY!,
      networkId: 'base-sepolia'
    });
  }
  return globalServerWallet;
}

export function getBotWalletFactory(): BotWalletFactory {
  if (!globalBotFactory) {
    globalBotFactory = new BotWalletFactory({
      apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY!,
      privateKey: process.env.CDP_PRIVATE_KEY!,
      networkId: 'base-sepolia'
    });
  }
  return globalBotFactory;
}