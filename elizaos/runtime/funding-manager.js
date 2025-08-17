import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhatChain, contractCallWithRetry, logContractError } from '../../config/chains.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Bot Funding Automation for ElizaOS Runtime
 * Automatically manages funding for AI bot accounts during gameplay
 */

export class BotFundingManager {
    constructor(config = {}) {
        this.config = {
            // Minimum balances before refilling
            minEthBalance: parseEther("0.005"),    // 0.005 ETH minimum
            minBotBalance: parseEther("500"),      // 500 BOT minimum
            
            // Refill amounts
            refillEthAmount: parseEther("0.05"),   // Refill to 0.05 ETH
            refillBotAmount: parseEther("5000"),   // Refill to 5000 BOT
            
            // Monitoring settings
            checkIntervalMs: 30000,                // Check every 30 seconds
            retryAttempts: 3,                      // Retry failed funding 3 times
            retryDelayMs: 5000,                    // Wait 5 seconds between retries
            
            ...config
        };
        
        this.deployments = this.loadDeployments();
        this.publicClient = null;
        this.fundingWallet = null;
        this.botWallets = new Map();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.fundingStats = {
            totalFundings: 0,
            totalEthDistributed: 0n,
            totalBotDistributed: 0n,
            lastFunding: null,
            failures: 0
        };
    }
    
    loadDeployments() {
        const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run deployment script first.');
        }
        return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    }
    
    async initialize(fundingPrivateKey) {
        console.log('🤖💰 Initializing Bot Funding Manager...\n');
        
        // Create public client
        this.publicClient = createPublicClient({
            chain: hardhatChain,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Set up funding wallet (usually deployer or treasury)
        if (fundingPrivateKey) {
            const fundingAccount = privateKeyToAccount(fundingPrivateKey);
            this.fundingWallet = createWalletClient({
                account: fundingAccount,
                chain: hardhatChain,
                transport: http('http://127.0.0.1:8545')
            });
            
            console.log(`💼 Funding wallet: ${fundingAccount.address}`);
        }
        
        // Load bot wallets
        await this.loadBotWallets();
        
        console.log('✅ Bot Funding Manager initialized');
        console.log(`   Monitoring ${this.botWallets.size} bot wallets`);
        console.log(`   Check interval: ${this.config.checkIntervalMs / 1000}s\n`);
    }
    
    /**
     * Load bot wallets from saved data or generate them
     */
    async loadBotWallets() {
        const walletPath = path.join(__dirname, '../../wallets.json');
        
        if (fs.existsSync(walletPath)) {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            
            if (walletInfo.botWallets) {
                for (const [botId, botWallet] of walletInfo.botWallets) {
                    const account = privateKeyToAccount(botWallet.privateKey);
                    const walletClient = createWalletClient({
                        account,
                        chain: hardhatChain,
                        transport: http('http://127.0.0.1:8545')
                    });
                    
                    this.botWallets.set(parseInt(botId), {
                        id: parseInt(botId),
                        address: botWallet.address,
                        account,
                        walletClient,
                        vaultAddress: botWallet.vaultAddress,
                        privateKey: botWallet.privateKey
                    });
                }
                
                console.log(`📂 Loaded ${this.botWallets.size} bot wallets from file`);
            }
        } else {
            console.log('⚠️  No bot wallets found. Generate them with fund-accounts script first.');
        }
    }
    
    /**
     * Check balance for a bot wallet
     */
    async checkBotBalance(botId) {
        const bot = this.botWallets.get(botId);
        if (!bot) return null;
        
        try {
            const ethBalance = await contractCallWithRetry(async () => {
                return await this.publicClient.getBalance({ address: bot.address });
            });
            
            const botTokenBalance = await contractCallWithRetry(async () => {
                return await this.publicClient.readContract({
                    address: this.deployments.contracts.BOTToken,
                    abi: [
                        {
                            name: "balanceOf",
                            type: "function",
                            stateMutability: "view",
                            inputs: [{ name: "account", type: "address" }],
                            outputs: [{ name: "", type: "uint256" }]
                        }
                    ],
                    functionName: "balanceOf",
                    args: [bot.address]
                });
            });
            
            return {
                botId,
                address: bot.address,
                ethBalance,
                botTokenBalance,
                ethFormatted: formatEther(ethBalance),
                botTokenFormatted: formatEther(botTokenBalance),
                needsEthRefill: ethBalance < this.config.minEthBalance,
                needsBotRefill: botTokenBalance < this.config.minBotBalance
            };
            
        } catch (error) {
            logContractError('BotFundingManager', 'checkBotBalance', error);
            return null;
        }
    }
    
    /**
     * Fund a specific bot if needed
     */
    async fundBot(botId, force = false) {
        const bot = this.botWallets.get(botId);
        if (!bot) {
            throw new Error(`Bot ${botId} not found`);
        }
        
        if (!this.fundingWallet) {
            throw new Error('No funding wallet configured');
        }
        
        const balance = await this.checkBotBalance(botId);
        if (!balance) {
            throw new Error(`Cannot check balance for bot ${botId}`);
        }
        
        let funded = false;
        
        try {
            // Fund ETH if needed
            if (force || balance.needsEthRefill) {
                console.log(`💰 Funding Bot ${botId} with ETH...`);
                console.log(`   Current: ${balance.ethFormatted} ETH`);
                console.log(`   Refilling to: ${formatEther(this.config.refillEthAmount)} ETH`);
                
                const ethTx = await this.fundingWallet.sendTransaction({
                    to: bot.address,
                    value: this.config.refillEthAmount
                });
                
                await this.publicClient.waitForTransactionReceipt({ hash: ethTx });
                
                this.fundingStats.totalEthDistributed += this.config.refillEthAmount;
                funded = true;
                
                console.log(`   ✅ ETH funding complete: ${ethTx}`);
            }
            
            // Fund BOT tokens if needed
            if (force || balance.needsBotRefill) {
                console.log(`🪙 Funding Bot ${botId} with BOT tokens...`);
                console.log(`   Current: ${balance.botTokenFormatted} BOT`);
                console.log(`   Refilling to: ${formatEther(this.config.refillBotAmount)} BOT`);
                
                const botTx = await this.fundingWallet.writeContract({
                    address: this.deployments.contracts.BOTToken,
                    abi: [
                        {
                            name: "transfer",
                            type: "function",
                            stateMutability: "nonpayable",
                            inputs: [
                                { name: "to", type: "address" },
                                { name: "amount", type: "uint256" }
                            ],
                            outputs: [{ name: "", type: "bool" }]
                        }
                    ],
                    functionName: "transfer",
                    args: [bot.address, this.config.refillBotAmount]
                });
                
                await this.publicClient.waitForTransactionReceipt({ hash: botTx });
                
                this.fundingStats.totalBotDistributed += this.config.refillBotAmount;
                funded = true;
                
                console.log(`   ✅ BOT funding complete: ${botTx}`);
            }
            
            if (funded) {
                this.fundingStats.totalFundings++;
                this.fundingStats.lastFunding = new Date().toISOString();
                
                // Verify funding was successful
                const newBalance = await this.checkBotBalance(botId);
                console.log(`   📊 New balances: ${newBalance.ethFormatted} ETH, ${newBalance.botTokenFormatted} BOT\n`);
            }
            
            return funded;
            
        } catch (error) {
            this.fundingStats.failures++;
            console.error(`❌ Failed to fund Bot ${botId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Fund all bots that need funding
     */
    async fundAllBots(force = false) {
        console.log('🤖💰 Checking all bot funding needs...\n');
        
        let fundedCount = 0;
        let failedCount = 0;
        
        for (const [botId] of this.botWallets) {
            try {
                const wasFunded = await this.fundBot(botId, force);
                if (wasFunded) {
                    fundedCount++;
                }
            } catch (error) {
                console.error(`Failed to fund Bot ${botId}:`, error.message);
                failedCount++;
            }
        }
        
        console.log(`📊 Bot Funding Summary:`);
        console.log(`   Bots funded: ${fundedCount}`);
        console.log(`   Failures: ${failedCount}`);
        console.log(`   Total bots: ${this.botWallets.size}\n`);
        
        return { fundedCount, failedCount };
    }
    
    /**
     * Emergency funding - fund all bots immediately
     */
    async emergencyFunding() {
        console.log('🚨 EMERGENCY BOT FUNDING IN PROGRESS...\n');
        
        const results = await this.fundAllBots(true);
        
        console.log('🚨 Emergency funding complete!');
        console.log(`   ${results.fundedCount} bots funded`);
        console.log(`   ${results.failedCount} failures\n`);
        
        return results;
    }
    
    /**
     * Start automatic monitoring and funding
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️  Monitoring already active');
            return;
        }
        
        console.log('🔄 Starting automatic bot funding monitoring...');
        console.log(`   Check interval: ${this.config.checkIntervalMs / 1000} seconds`);
        console.log(`   Minimum ETH: ${formatEther(this.config.minEthBalance)}`);
        console.log(`   Minimum BOT: ${formatEther(this.config.minBotBalance)}\n`);
        
        this.isMonitoring = true;
        
        const monitor = async () => {
            if (!this.isMonitoring) return;
            
            try {
                console.log(`🔍 [${new Date().toLocaleTimeString()}] Checking bot balances...`);
                
                let needsFunding = [];
                
                for (const [botId] of this.botWallets) {
                    const balance = await this.checkBotBalance(botId);
                    if (balance && (balance.needsEthRefill || balance.needsBotRefill)) {
                        needsFunding.push({
                            botId,
                            needsEth: balance.needsEthRefill,
                            needsBot: balance.needsBotRefill,
                            ethBalance: balance.ethFormatted,
                            botBalance: balance.botTokenFormatted
                        });
                    }
                }
                
                if (needsFunding.length > 0) {
                    console.log(`⚠️  ${needsFunding.length} bots need funding:`);
                    for (const bot of needsFunding) {
                        console.log(`   Bot ${bot.botId}: ETH=${bot.ethBalance}, BOT=${bot.botBalance}`);
                    }
                    
                    // Fund bots that need it
                    await this.fundAllBots(false);
                } else {
                    console.log(`✅ All ${this.botWallets.size} bots have sufficient funds`);
                }
                
            } catch (error) {
                console.error('❌ Error during monitoring:', error.message);
                this.fundingStats.failures++;
            }
        };
        
        // Run initial check
        await monitor();
        
        // Set up interval
        this.monitoringInterval = setInterval(monitor, this.config.checkIntervalMs);
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('⚠️  Monitoring not active');
            return;
        }
        
        console.log('🛑 Stopping bot funding monitoring...');
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        console.log('✅ Monitoring stopped');
    }
    
    /**
     * Get funding statistics
     */
    getFundingStats() {
        return {
            ...this.fundingStats,
            totalEthDistributedFormatted: formatEther(this.fundingStats.totalEthDistributed),
            totalBotDistributedFormatted: formatEther(this.fundingStats.totalBotDistributed),
            isMonitoring: this.isMonitoring,
            botCount: this.botWallets.size
        };
    }
    
    /**
     * Get low balance bots
     */
    async getLowBalanceBots() {
        const lowBalanceBots = [];
        
        for (const [botId] of this.botWallets) {
            const balance = await this.checkBotBalance(botId);
            if (balance && (balance.needsEthRefill || balance.needsBotRefill)) {
                lowBalanceBots.push(balance);
            }
        }
        
        return lowBalanceBots;
    }
    
    /**
     * Fund bot before transaction (integration helper)
     */
    async ensureBotFunded(botId) {
        const balance = await this.checkBotBalance(botId);
        
        if (balance && (balance.needsEthRefill || balance.needsBotRefill)) {
            console.log(`💰 Auto-funding Bot ${botId} before transaction...`);
            await this.fundBot(botId, false);
            return true;
        }
        
        return false;
    }
    
    /**
     * Batch funding with retry logic
     */
    async fundWithRetry(botId, maxRetries = null) {
        const retries = maxRetries || this.config.retryAttempts;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.fundBot(botId, false);
                return true;
            } catch (error) {
                console.error(`Funding attempt ${attempt}/${retries} failed for Bot ${botId}: ${error.message}`);
                
                if (attempt < retries) {
                    console.log(`Retrying in ${this.config.retryDelayMs / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
                } else {
                    throw error;
                }
            }
        }
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stopMonitoring();
        console.log('🧹 Bot Funding Manager cleaned up');
    }
}

export default BotFundingManager;