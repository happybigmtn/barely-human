import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import WalletFundingManager from "./fund-accounts.js";
import { BalanceChecker } from "./check-balances.js";
import fs from "fs";
import path from "path";

/**
 * EMERGENCY FUNDING FIX - Solves "sender's balance is: 0" Crisis
 * This script addresses the critical issue where bot accounts cannot send transactions
 * because they have zero ETH for gas fees and no BOT tokens for betting.
 */

interface EmergencyFundingConfig {
    // Emergency funding amounts (higher than normal)
    emergencyEthAmount: bigint;
    emergencyBotAmount: bigint;
    
    // Minimum amounts before we consider it an emergency
    criticalEthThreshold: bigint;
    criticalBotThreshold: bigint;
    
    // Number of retry attempts
    maxRetries: number;
    retryDelayMs: number;
}

const EMERGENCY_CONFIG: EmergencyFundingConfig = {
    // Emergency amounts - fund generously to avoid repeat issues
    emergencyEthAmount: parseEther("0.2"),      // 0.2 ETH per bot (high)
    emergencyBotAmount: parseEther("20000"),    // 20,000 BOT per bot (high)
    
    // Critical thresholds - anything below this is an emergency
    criticalEthThreshold: parseEther("0.005"),  // 0.005 ETH
    criticalBotThreshold: parseEther("100"),    // 100 BOT
    
    maxRetries: 5,
    retryDelayMs: 3000
};

export class EmergencyFundingManager {
    private connection: any;
    private viem: any;
    private publicClient: any;
    private walletClients: any[];
    private deployments: any;
    private config: EmergencyFundingConfig;
    private balanceChecker: BalanceChecker;
    private fundingManager: WalletFundingManager;
    
    constructor(config: Partial<EmergencyFundingConfig> = {}) {
        this.config = { ...EMERGENCY_CONFIG, ...config };
    }
    
    async initialize() {
        console.log("🚨 EMERGENCY FUNDING MANAGER INITIALIZING...\n");
        console.log("   This script will fix the 'sender's balance is: 0' crisis");
        console.log("   by immediately funding all bot accounts with sufficient");
        console.log("   ETH for gas and BOT tokens for betting.\n");
        
        // Initialize network connection
        this.connection = await network.connect();
        this.viem = this.connection.viem;
        this.publicClient = await this.viem.getPublicClient();
        this.walletClients = await this.viem.getWalletClients();
        
        // Load deployments
        this.loadDeployments();
        
        // Initialize helpers
        this.balanceChecker = new BalanceChecker();
        await this.balanceChecker.initialize();
        
        this.fundingManager = new WalletFundingManager({
            botEthAmount: this.config.emergencyEthAmount,
            botTokenAmount: this.config.emergencyBotAmount
        });
        await this.fundingManager.initialize();
        
        console.log("✅ Emergency Funding Manager ready for action!\n");
    }
    
    private loadDeployments() {
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        if (!fs.existsSync(deploymentPath)) {
            throw new Error("❌ No deployment found. Run 'npm run deploy:local' first.");
        }
        this.deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log(`📂 Loaded deployment from ${deploymentPath}`);
    }
    
    async cleanup() {
        if (this.balanceChecker) {
            await this.balanceChecker.cleanup();
        }
        if (this.fundingManager) {
            await this.fundingManager.cleanup();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }
    
    /**
     * Diagnose the current crisis
     */
    async diagnoseCrisis() {
        console.log("🔍 DIAGNOSING THE CURRENT CRISIS...\n");
        
        // Check if we have wallet info
        const walletPath = path.join(process.cwd(), "wallets.json");
        const hasWalletInfo = fs.existsSync(walletPath);
        
        console.log(`📁 Wallet info file exists: ${hasWalletInfo ? "✅ YES" : "❌ NO"}`);
        
        if (!hasWalletInfo) {
            console.log("   This means bot wallets haven't been created yet.");
            console.log("   We'll need to generate them first.\n");
            return { hasWallets: false, criticalAccounts: [] };
        }
        
        // Load and check existing wallets
        const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf8"));
        const botWallets = new Map(walletInfo.botWallets || []);
        const userWallets = new Map(walletInfo.userWallets || []);
        
        console.log(`🤖 Found ${botWallets.size} bot wallets`);
        console.log(`👤 Found ${userWallets.size} user wallets\n`);
        
        // Check balances
        const criticalAccounts = [];
        
        console.log("📊 Checking current balances...\n");
        
        for (const [botId, botWallet] of botWallets) {
            try {
                const ethBalance = await this.publicClient.getBalance({ 
                    address: botWallet.address 
                });
                
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
                    args: [botWallet.address]
                });
                
                const isCritical = ethBalance < this.config.criticalEthThreshold || 
                                 botTokenBalance < this.config.criticalBotThreshold;
                
                const status = isCritical ? "🚨 CRITICAL" : "✅ OK";
                console.log(`   Bot ${botId}: ${status}`);
                console.log(`     Address: ${botWallet.address}`);
                console.log(`     ETH: ${formatEther(ethBalance)}`);
                console.log(`     BOT: ${formatEther(botTokenBalance)}`);
                
                if (isCritical) {
                    criticalAccounts.push({
                        id: botId,
                        address: botWallet.address,
                        type: 'bot',
                        ethBalance,
                        botTokenBalance,
                        ethFormatted: formatEther(ethBalance),
                        botTokenFormatted: formatEther(botTokenBalance)
                    });
                }
                console.log("");
                
            } catch (error) {
                console.error(`   ❌ Failed to check Bot ${botId}: ${error.message}`);
                criticalAccounts.push({
                    id: botId,
                    address: botWallet.address,
                    type: 'bot',
                    error: error.message
                });
            }
        }
        
        return { 
            hasWallets: true, 
            criticalAccounts,
            totalBots: botWallets.size,
            totalUsers: userWallets.size
        };
    }
    
    /**
     * Generate bot wallets if they don't exist
     */
    async generateMissingBotWallets() {
        console.log("🏗️  GENERATING MISSING BOT WALLETS...\n");
        
        // Load existing wallet info if any
        this.fundingManager.loadWalletInfo();
        
        // Generate 10 bot wallets
        const botWallets = this.fundingManager.generateBotWallets(10);
        
        // Associate with vault addresses if available
        if (this.deployments.contracts.BotVaults) {
            console.log("🔗 Associating wallets with vaults...");
            for (let i = 0; i < Math.min(botWallets.length, this.deployments.contracts.BotVaults.length); i++) {
                const botWallet = this.fundingManager.getBotWallet(i);
                if (botWallet) {
                    botWallet.vaultAddress = this.deployments.contracts.BotVaults[i];
                    console.log(`   Bot ${i} → Vault ${this.deployments.contracts.BotVaults[i]}`);
                }
            }
        }
        
        // Save wallet info
        this.fundingManager.saveWalletInfo();
        
        console.log("✅ Bot wallets generated and saved!\n");
        return botWallets;
    }
    
    /**
     * Execute emergency funding with retries
     */
    async executeEmergencyFunding(targetAccounts: any[] = []) {
        console.log("💰 EXECUTING EMERGENCY FUNDING...\n");
        
        const [deployer] = this.walletClients;
        console.log(`💼 Funding from deployer: ${deployer.account.address}\n`);
        
        // Check deployer balance first
        const deployerBalance = await this.publicClient.getBalance({ 
            address: deployer.account.address 
        });
        console.log(`💼 Deployer ETH balance: ${formatEther(deployerBalance)}`);
        
        if (deployerBalance < parseEther("1.0")) {
            console.warn("⚠️  WARNING: Deployer has low ETH balance!");
            console.warn("   Consider funding the deployer account first.\n");
        }
        
        let successCount = 0;
        let failureCount = 0;
        
        // If no specific targets, fund all bots
        if (targetAccounts.length === 0) {
            console.log("🎯 No specific targets - funding ALL bot accounts...\n");
            
            try {
                const result = await this.fundingManager.fundBotAccounts(true); // Force fund all
                successCount = result.successCount;
                failureCount = result.failureCount;
            } catch (error) {
                console.error(`❌ Batch funding failed: ${error.message}`);
                failureCount = 10; // Assume all failed
            }
        } else {
            // Fund specific critical accounts
            console.log(`🎯 Funding ${targetAccounts.length} critical accounts...\n`);
            
            for (const account of targetAccounts) {
                let funded = false;
                
                for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
                    try {
                        console.log(`   Funding ${account.type} ${account.id} (attempt ${attempt}/${this.config.maxRetries})...`);
                        
                        // Fund ETH
                        if (account.ethBalance < this.config.criticalEthThreshold) {
                            console.log(`     Sending ${formatEther(this.config.emergencyEthAmount)} ETH...`);
                            const ethTx = await deployer.sendTransaction({
                                to: account.address,
                                value: this.config.emergencyEthAmount
                            });
                            await this.publicClient.waitForTransactionReceipt({ hash: ethTx });
                            console.log(`     ✅ ETH sent: ${ethTx}`);
                        }
                        
                        // Fund BOT tokens
                        if (account.botTokenBalance < this.config.criticalBotThreshold) {
                            console.log(`     Sending ${formatEther(this.config.emergencyBotAmount)} BOT...`);
                            const botTx = await this.viem.writeContract({
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
                                args: [account.address, this.config.emergencyBotAmount],
                                account: deployer.account
                            });
                            await this.publicClient.waitForTransactionReceipt({ hash: botTx });
                            console.log(`     ✅ BOT sent: ${botTx}`);
                        }
                        
                        funded = true;
                        successCount++;
                        console.log(`   ✅ ${account.type} ${account.id} funded successfully!\n`);
                        break;
                        
                    } catch (error) {
                        console.error(`   ❌ Attempt ${attempt} failed: ${error.message}`);
                        
                        if (attempt < this.config.maxRetries) {
                            console.log(`   ⏳ Retrying in ${this.config.retryDelayMs / 1000} seconds...`);
                            await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
                        }
                    }
                }
                
                if (!funded) {
                    failureCount++;
                    console.error(`   ❌ Failed to fund ${account.type} ${account.id} after ${this.config.maxRetries} attempts\n`);
                }
            }
        }
        
        console.log("📊 EMERGENCY FUNDING SUMMARY:");
        console.log(`   ✅ Successfully funded: ${successCount}`);
        console.log(`   ❌ Failed to fund: ${failureCount}`);
        console.log(`   💰 Total ETH distributed: ${formatEther(this.config.emergencyEthAmount * BigInt(successCount))}`);
        console.log(`   🪙 Total BOT distributed: ${formatEther(this.config.emergencyBotAmount * BigInt(successCount))}\n`);
        
        return { successCount, failureCount };
    }
    
    /**
     * Verify funding was successful
     */
    async verifyFunding() {
        console.log("🔍 VERIFYING EMERGENCY FUNDING RESULTS...\n");
        
        const diagnosis = await this.diagnoseCrisis();
        
        if (diagnosis.criticalAccounts.length === 0) {
            console.log("🎉 SUCCESS! All accounts now have sufficient funding!");
            console.log("   Bots should now be able to send transactions and place bets.\n");
            return true;
        } else {
            console.log(`⚠️  WARNING: ${diagnosis.criticalAccounts.length} accounts still need funding:`);
            for (const account of diagnosis.criticalAccounts) {
                console.log(`   ${account.type} ${account.id}: ETH=${account.ethFormatted}, BOT=${account.botTokenFormatted}`);
            }
            console.log("   Consider running emergency funding again.\n");
            return false;
        }
    }
    
    /**
     * Main emergency funding routine
     */
    async executeEmergencyFix() {
        console.log("🚨 EMERGENCY FUNDING FIX STARTING...\n");
        console.log("=".repeat(60));
        console.log("BARELY HUMAN CASINO - EMERGENCY FUNDING SYSTEM");
        console.log("Fixing: 'sender's balance is: 0' Crisis");
        console.log("=".repeat(60) + "\n");
        
        try {
            // Step 1: Diagnose the current situation
            const diagnosis = await this.diagnoseCrisis();
            
            if (!diagnosis.hasWallets) {
                console.log("🏗️  Bot wallets not found - generating them...");
                await this.generateMissingBotWallets();
            }
            
            // Step 2: Execute emergency funding
            if (diagnosis.criticalAccounts.length > 0) {
                console.log(`🚨 CRISIS CONFIRMED: ${diagnosis.criticalAccounts.length} accounts need immediate funding!`);
                await this.executeEmergencyFunding(diagnosis.criticalAccounts);
            } else {
                console.log("🚨 Funding ALL bot accounts as emergency measure...");
                await this.executeEmergencyFunding();
            }
            
            // Step 3: Verify results
            const success = await this.verifyFunding();
            
            if (success) {
                console.log("🎉 EMERGENCY FUNDING COMPLETE!");
                console.log("   ✅ All bot accounts now have sufficient funding");
                console.log("   ✅ Bots can now send transactions and place bets");
                console.log("   ✅ The casino is ready for gameplay!\n");
                
                console.log("🎮 Next steps:");
                console.log("   • Start the interactive CLI: npm run cli:interactive");
                console.log("   • Watch bots play: npm run bots");
                console.log("   • Monitor balances: npm run balance:check\n");
            } else {
                console.log("⚠️  EMERGENCY FUNDING PARTIALLY COMPLETED");
                console.log("   Some accounts may still need manual funding.");
                console.log("   Run this script again or use 'npm run fund:emergency'\n");
            }
            
            return success;
            
        } catch (error) {
            console.error("❌ EMERGENCY FUNDING FAILED:", error.message);
            console.error("   Please check the error above and try again.");
            console.error("   You may need to:");
            console.error("   • Fund the deployer account");
            console.error("   • Restart the local node: npm run node");
            console.error("   • Redeploy contracts: npm run deploy:local\n");
            throw error;
        }
    }
}

/**
 * CLI function
 */
async function main() {
    const emergencyManager = new EmergencyFundingManager();
    
    try {
        await emergencyManager.initialize();
        const success = await emergencyManager.executeEmergencyFix();
        
        if (success) {
            console.log("✅ Emergency funding completed successfully!");
            process.exit(0);
        } else {
            console.log("⚠️  Emergency funding partially completed");
            process.exit(1);
        }
        
    } catch (error) {
        console.error("❌ Emergency funding failed:", error);
        process.exit(1);
    } finally {
        await emergencyManager.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export default EmergencyFundingManager;
export { EMERGENCY_CONFIG };