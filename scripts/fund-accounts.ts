import { network } from "hardhat";
import { formatEther, parseEther, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

/**
 * Comprehensive wallet funding system for Barely Human DeFi Casino
 * Addresses critical funding issues for bots and users
 */

interface FundingConfig {
    // Bot funding amounts
    botEthAmount: bigint;
    botTokenAmount: bigint;
    
    // User funding amounts
    userEthAmount: bigint;
    userTokenAmount: bigint;
    
    // Treasury limits
    minTreasuryBalance: bigint;
    minDeployerBalance: bigint;
}

interface BotWallet {
    id: number;
    privateKey: `0x${string}`;
    address: `0x${string}`;
    vaultAddress?: `0x${string}`;
}

interface UserWallet {
    id: string;
    privateKey: `0x${string}`;
    address: `0x${string}`;
    name?: string;
}

const DEFAULT_CONFIG: FundingConfig = {
    // Bots need significant funding for continuous gameplay
    botEthAmount: parseEther("0.1"),      // 0.1 ETH for gas
    botTokenAmount: parseEther("10000"),   // 10,000 BOT tokens
    
    // Users need moderate funding for interaction
    userEthAmount: parseEther("0.05"),     // 0.05 ETH for gas
    userTokenAmount: parseEther("5000"),   // 5,000 BOT tokens
    
    // Safety thresholds
    minTreasuryBalance: parseEther("500000"), // 500K BOT minimum in treasury
    minDeployerBalance: parseEther("1.0")     // 1 ETH minimum in deployer
};

export class WalletFundingManager {
    private connection: any;
    private viem: any;
    private publicClient: any;
    private walletClients: any[];
    private deployments: any;
    private config: FundingConfig;
    
    // Bot wallet management
    private botWallets: Map<number, BotWallet> = new Map();
    private userWallets: Map<string, UserWallet> = new Map();
    
    constructor(config: Partial<FundingConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.loadDeployments();
    }
    
    private loadDeployments() {
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        if (!fs.existsSync(deploymentPath)) {
            throw new Error("No deployment found. Run deployment script first.");
        }
        this.deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    }
    
    async initialize() {
        console.log("💰 Initializing Wallet Funding Manager...\n");
        
        this.connection = await network.connect();
        this.viem = this.connection.viem;
        this.publicClient = await this.viem.getPublicClient();
        this.walletClients = await this.viem.getWalletClients();
        
        console.log("✅ Funding Manager initialized");
    }
    
    async cleanup() {
        if (this.connection) {
            await this.connection.close();
        }
    }
    
    /**
     * Generate bot wallets with unique private keys
     */
    generateBotWallets(count: number = 10): BotWallet[] {
        console.log(`🤖 Generating ${count} bot wallets...\n`);
        
        const wallets: BotWallet[] = [];
        
        for (let i = 0; i < count; i++) {
            // Generate deterministic but unique private keys for bots
            const seed = `bot-${i}-barely-human-casino-${Date.now()}`;
            const hash = require('crypto').createHash('sha256').update(seed).digest('hex');
            const privateKey = `0x${hash}` as `0x${string}`;
            
            const account = privateKeyToAccount(privateKey);
            
            const botWallet: BotWallet = {
                id: i,
                privateKey,
                address: account.address
            };
            
            // Add vault address if available
            if (this.deployments.contracts.BotVaults && this.deployments.contracts.BotVaults[i]) {
                botWallet.vaultAddress = this.deployments.contracts.BotVaults[i];
            }
            
            this.botWallets.set(i, botWallet);
            wallets.push(botWallet);
            
            console.log(`  Bot ${i}: ${account.address}`);
        }
        
        console.log(`✅ Generated ${count} bot wallets\n`);
        return wallets;
    }
    
    /**
     * Create or import user wallet
     */
    createUserWallet(userId: string, name?: string, existingPrivateKey?: `0x${string}`): UserWallet {
        console.log(`👤 Creating user wallet for ${userId}...`);
        
        let privateKey: `0x${string}`;
        
        if (existingPrivateKey) {
            privateKey = existingPrivateKey;
        } else {
            // Generate new private key for user
            const seed = `user-${userId}-${Date.now()}-${Math.random()}`;
            const hash = require('crypto').createHash('sha256').update(seed).digest('hex');
            privateKey = `0x${hash}` as `0x${string}`;
        }
        
        const account = privateKeyToAccount(privateKey);
        
        const userWallet: UserWallet = {
            id: userId,
            privateKey,
            address: account.address,
            name
        };
        
        this.userWallets.set(userId, userWallet);
        
        console.log(`✅ User wallet created: ${account.address}\n`);
        return userWallet;
    }
    
    /**
     * Check current balances for an address
     */
    async checkBalances(address: `0x${string}`) {
        const ethBalance = await this.publicClient.getBalance({ address });
        
        const botTokenBalance = await this.publicClient.readContract({
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
            args: [address]
        });
        
        return {
            eth: ethBalance,
            botToken: botTokenBalance,
            ethFormatted: formatEther(ethBalance),
            botTokenFormatted: formatEther(botTokenBalance)
        };
    }
    
    /**
     * Fund bot accounts with ETH and BOT tokens
     */
    async fundBotAccounts(force: boolean = false) {
        console.log("🤖 Funding bot accounts...\n");
        
        if (this.botWallets.size === 0) {
            this.generateBotWallets(10);
        }
        
        const [deployer] = this.walletClients;
        let successCount = 0;
        let failureCount = 0;
        
        for (const [botId, botWallet] of this.botWallets) {
            try {
                console.log(`  Funding Bot ${botId} (${botWallet.address})...`);
                
                // Check current balances
                const balances = await this.checkBalances(botWallet.address);
                
                // Fund ETH if needed
                if (force || balances.eth < this.config.botEthAmount / 2n) {
                    console.log(`    ETH: ${balances.ethFormatted} → ${formatEther(this.config.botEthAmount)}`);
                    
                    const ethTx = await deployer.sendTransaction({
                        to: botWallet.address,
                        value: this.config.botEthAmount
                    });
                    await this.publicClient.waitForTransactionReceipt({ hash: ethTx });
                } else {
                    console.log(`    ETH: ${balances.ethFormatted} (sufficient)`);
                }
                
                // Fund BOT tokens if needed
                if (force || balances.botToken < this.config.botTokenAmount / 2n) {
                    console.log(`    BOT: ${balances.botTokenFormatted} → ${formatEther(this.config.botTokenAmount)}`);
                    
                    const tokenTx = await this.viem.writeContract({
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
                        args: [botWallet.address, this.config.botTokenAmount],
                        account: deployer.account
                    });
                    await this.publicClient.waitForTransactionReceipt({ hash: tokenTx });
                } else {
                    console.log(`    BOT: ${balances.botTokenFormatted} (sufficient)`);
                }
                
                console.log(`    ✅ Bot ${botId} funded successfully`);
                successCount++;
                
            } catch (error) {
                console.error(`    ❌ Failed to fund Bot ${botId}: ${error.message}`);
                failureCount++;
            }
        }
        
        console.log(`\n📊 Bot Funding Summary:`);
        console.log(`  ✅ Success: ${successCount}`);
        console.log(`  ❌ Failed: ${failureCount}`);
        console.log(`  💰 Total ETH distributed: ${formatEther(this.config.botEthAmount * BigInt(successCount))}`);
        console.log(`  🪙 Total BOT distributed: ${formatEther(this.config.botTokenAmount * BigInt(successCount))}\n`);
        
        return { successCount, failureCount };
    }
    
    /**
     * Fund user accounts with ETH and BOT tokens
     */
    async fundUserAccount(userId: string, force: boolean = false) {
        console.log(`👤 Funding user account ${userId}...\n`);
        
        const userWallet = this.userWallets.get(userId);
        if (!userWallet) {
            throw new Error(`User wallet ${userId} not found. Create it first.`);
        }
        
        const [deployer] = this.walletClients;
        
        try {
            // Check current balances
            const balances = await this.checkBalances(userWallet.address);
            
            console.log(`  User: ${userWallet.name || userWallet.id} (${userWallet.address})`);
            
            // Fund ETH if needed
            if (force || balances.eth < this.config.userEthAmount / 2n) {
                console.log(`    ETH: ${balances.ethFormatted} → ${formatEther(this.config.userEthAmount)}`);
                
                const ethTx = await deployer.sendTransaction({
                    to: userWallet.address,
                    value: this.config.userEthAmount
                });
                await this.publicClient.waitForTransactionReceipt({ hash: ethTx });
            } else {
                console.log(`    ETH: ${balances.ethFormatted} (sufficient)`);
            }
            
            // Fund BOT tokens if needed
            if (force || balances.botToken < this.config.userTokenAmount / 2n) {
                console.log(`    BOT: ${balances.botTokenFormatted} → ${formatEther(this.config.userTokenAmount)}`);
                
                const tokenTx = await this.viem.writeContract({
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
                    args: [userWallet.address, this.config.userTokenAmount],
                    account: deployer.account
                });
                await this.publicClient.waitForTransactionReceipt({ hash: tokenTx });
            } else {
                console.log(`    BOT: ${balances.botTokenFormatted} (sufficient)`);
            }
            
            console.log(`    ✅ User ${userId} funded successfully\n`);
            return true;
            
        } catch (error) {
            console.error(`    ❌ Failed to fund user ${userId}: ${error.message}\n`);
            return false;
        }
    }
    
    /**
     * Monitor and refill accounts if balances get low
     */
    async monitorAndRefill() {
        console.log("🔍 Monitoring account balances...\n");
        
        let refillCount = 0;
        
        // Check bot accounts
        for (const [botId, botWallet] of this.botWallets) {
            const balances = await this.checkBalances(botWallet.address);
            
            const needsEth = balances.eth < this.config.botEthAmount / 4n; // Refill at 25%
            const needsTokens = balances.botToken < this.config.botTokenAmount / 4n;
            
            if (needsEth || needsTokens) {
                console.log(`⚠️  Bot ${botId} needs refill:`, {
                    eth: `${balances.ethFormatted} ETH`,
                    bot: `${balances.botTokenFormatted} BOT`,
                    needsEth,
                    needsTokens
                });
                
                // Refill this bot
                try {
                    await this.fundBotAccounts(false); // Only fund what's needed
                    refillCount++;
                } catch (error) {
                    console.error(`Failed to refill Bot ${botId}:`, error.message);
                }
            }
        }
        
        // Check user accounts
        for (const [userId, userWallet] of this.userWallets) {
            const balances = await this.checkBalances(userWallet.address);
            
            const needsEth = balances.eth < this.config.userEthAmount / 4n;
            const needsTokens = balances.botToken < this.config.userTokenAmount / 4n;
            
            if (needsEth || needsTokens) {
                console.log(`⚠️  User ${userId} needs refill:`, {
                    eth: `${balances.ethFormatted} ETH`,
                    bot: `${balances.botTokenFormatted} BOT`,
                    needsEth,
                    needsTokens
                });
                
                try {
                    await this.fundUserAccount(userId, false);
                    refillCount++;
                } catch (error) {
                    console.error(`Failed to refill User ${userId}:`, error.message);
                }
            }
        }
        
        if (refillCount === 0) {
            console.log("✅ All accounts have sufficient balances\n");
        } else {
            console.log(`💰 Refilled ${refillCount} accounts\n`);
        }
        
        return refillCount;
    }
    
    /**
     * Emergency funding function - fund everything
     */
    async emergencyFundAll() {
        console.log("🚨 EMERGENCY FUNDING - Funding all accounts...\n");
        
        // Generate bot wallets if not exists
        if (this.botWallets.size === 0) {
            this.generateBotWallets(10);
        }
        
        // Fund all bots (force = true)
        await this.fundBotAccounts(true);
        
        // Fund all users (force = true)
        for (const userId of this.userWallets.keys()) {
            await this.fundUserAccount(userId, true);
        }
        
        console.log("🎉 Emergency funding complete!\n");
    }
    
    /**
     * Save wallet information to file for persistence
     */
    saveWalletInfo() {
        const walletInfo = {
            botWallets: Array.from(this.botWallets.entries()),
            userWallets: Array.from(this.userWallets.entries()),
            timestamp: new Date().toISOString()
        };
        
        const walletPath = path.join(process.cwd(), "wallets.json");
        fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
        
        console.log(`💾 Wallet info saved to ${walletPath}`);
    }
    
    /**
     * Load wallet information from file
     */
    loadWalletInfo() {
        const walletPath = path.join(process.cwd(), "wallets.json");
        
        if (fs.existsSync(walletPath)) {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf8"));
            
            this.botWallets = new Map(walletInfo.botWallets);
            this.userWallets = new Map(walletInfo.userWallets);
            
            console.log(`📂 Loaded ${this.botWallets.size} bot wallets and ${this.userWallets.size} user wallets`);
        }
    }
    
    /**
     * Get all wallet information
     */
    getWalletInfo() {
        return {
            bots: Array.from(this.botWallets.values()),
            users: Array.from(this.userWallets.values()),
            config: this.config
        };
    }
    
    /**
     * Get bot wallet by ID
     */
    getBotWallet(botId: number): BotWallet | undefined {
        return this.botWallets.get(botId);
    }
    
    /**
     * Get user wallet by ID
     */
    getUserWallet(userId: string): UserWallet | undefined {
        return this.userWallets.get(userId);
    }
}

/**
 * CLI function to run funding operations
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "fund-bots";
    
    const fundingManager = new WalletFundingManager();
    
    try {
        await fundingManager.initialize();
        fundingManager.loadWalletInfo();
        
        switch (command) {
            case "fund-bots":
                console.log("🤖 Funding bot accounts...");
                await fundingManager.fundBotAccounts(false);
                break;
                
            case "fund-bots-force":
                console.log("🤖 Force funding bot accounts...");
                await fundingManager.fundBotAccounts(true);
                break;
                
            case "create-user":
                const userId = args[1] || "user1";
                const userName = args[2];
                console.log(`👤 Creating user wallet for ${userId}...`);
                fundingManager.createUserWallet(userId, userName);
                await fundingManager.fundUserAccount(userId);
                break;
                
            case "fund-user":
                const targetUserId = args[1];
                if (!targetUserId) {
                    console.error("Please provide user ID: npm run fund-accounts fund-user <userId>");
                    process.exit(1);
                }
                await fundingManager.fundUserAccount(targetUserId, false);
                break;
                
            case "monitor":
                console.log("🔍 Monitoring and refilling accounts...");
                await fundingManager.monitorAndRefill();
                break;
                
            case "emergency":
                console.log("🚨 Emergency funding all accounts...");
                await fundingManager.emergencyFundAll();
                break;
                
            case "status":
                console.log("📊 Wallet Status:");
                const info = fundingManager.getWalletInfo();
                console.log(`  Bots: ${info.bots.length}`);
                console.log(`  Users: ${info.users.length}`);
                for (const bot of info.bots) {
                    const balances = await fundingManager.checkBalances(bot.address);
                    console.log(`    Bot ${bot.id}: ${balances.ethFormatted} ETH, ${balances.botTokenFormatted} BOT`);
                }
                break;
                
            default:
                console.log("Available commands:");
                console.log("  fund-bots         - Fund bot accounts if low");
                console.log("  fund-bots-force   - Force fund all bot accounts");
                console.log("  create-user <id>  - Create and fund new user");
                console.log("  fund-user <id>    - Fund existing user");
                console.log("  monitor           - Check and refill low accounts");
                console.log("  emergency         - Emergency fund everything");
                console.log("  status            - Show wallet status");
        }
        
        fundingManager.saveWalletInfo();
        
    } catch (error) {
        console.error("❌ Funding failed:", error);
    } finally {
        await fundingManager.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export default WalletFundingManager;
export { DEFAULT_CONFIG };
export type { FundingConfig, BotWallet, UserWallet };