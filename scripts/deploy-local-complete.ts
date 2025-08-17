import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import fs from "fs";
import path from "path";

/**
 * Complete local deployment script for Barely Human DeFi Casino
 * Deploys all contracts and sets up the entire system locally
 */
async function main() {
    console.log("🚀 Deploying Barely Human DeFi Casino to Local Network\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        
        // Use multiple accounts for different roles
        const [deployer, treasury, liquidity, staking, team, community, ...players] = walletClients;
        
        console.log("📍 Deployment Configuration:");
        console.log(`  Deployer: ${deployer.account.address}`);
        console.log(`  Network: Local Hardhat Network`);
        console.log(`  Block: ${await publicClient.getBlockNumber()}\n`);
        
        // Track deployment addresses
        const deployments: any = {
            network: "localhost",
            chainId: 31337,
            contracts: {},
            timestamp: new Date().toISOString()
        };
        
        // ============================================
        // Deploy Core Contracts
        // ============================================
        console.log("📦 Deploying Core Contracts...\n");
        
        // 1. Deploy BOT Token
        console.log("  1. Deploying BOT Token...");
        const botToken = await viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            staking.account.address,
            team.account.address,
            community.account.address
        ]);
        deployments.contracts.BOTToken = botToken.address;
        console.log(`     ✅ BOT Token: ${botToken.address}`);
        
        // 2. Deploy Treasury
        console.log("  2. Deploying Treasury...");
        const treasuryContract = await viem.deployContract("Treasury", [
            botToken.address,
            team.account.address,
            deployer.account.address
        ]);
        deployments.contracts.Treasury = treasuryContract.address;
        console.log(`     ✅ Treasury: ${treasuryContract.address}`);
        
        // 3. Deploy StakingPool
        console.log("  3. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            botToken.address,
            treasuryContract.address
        ]);
        deployments.contracts.StakingPool = stakingPool.address;
        console.log(`     ✅ StakingPool: ${stakingPool.address}`);
        
        // 4. Deploy VaultFactory
        console.log("  4. Deploying VaultFactory...");
        const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
            botToken.address,
            treasuryContract.address
        ]);
        deployments.contracts.VaultFactory = vaultFactory.address;
        console.log(`     ✅ VaultFactory: ${vaultFactory.address}`);
        
        // 5. Deploy Mock VRF (for local testing)
        console.log("  5. Deploying Mock VRF Coordinator...");
        const mockVRF = await viem.deployContract("MockVRFCoordinator", []);
        deployments.contracts.MockVRF = mockVRF.address;
        console.log(`     ✅ Mock VRF: ${mockVRF.address}`);
        
        // ============================================
        // Deploy Game Contracts
        // ============================================
        console.log("\n🎲 Deploying Game Contracts...\n");
        
        // 6. Deploy CrapsGame
        console.log("  6. Deploying CrapsGame...");
        const crapsGame = await viem.deployContract("CrapsGame", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
        ]);
        deployments.contracts.CrapsGame = crapsGame.address;
        console.log(`     ✅ CrapsGame: ${crapsGame.address}`);
        
        // 7. Deploy CrapsBets
        console.log("  7. Deploying CrapsBets...");
        const crapsBets = await viem.deployContract("CrapsBets", []);
        deployments.contracts.CrapsBets = crapsBets.address;
        console.log(`     ✅ CrapsBets: ${crapsBets.address}`);
        
        // 8. Deploy CrapsSettlement
        console.log("  8. Deploying CrapsSettlement...");
        const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
        deployments.contracts.CrapsSettlement = crapsSettlement.address;
        console.log(`     ✅ CrapsSettlement: ${crapsSettlement.address}`);
        
        // 9. Deploy BotManager
        console.log("  9. Deploying BotManager...");
        const botManager = await viem.deployContract("BotManager", [
            vaultFactory.address,
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
        ]);
        deployments.contracts.BotManager = botManager.address;
        console.log(`     ✅ BotManager: ${botManager.address}`);
        
        // ============================================
        // Deploy Bot Vaults
        // ============================================
        console.log("\n🤖 Deploying Bot Vaults...\n");
        
        console.log("  10. Deploying all 10 bot vaults...");
        const tx1 = await vaultFactory.write.deployAllBots([]);
        await publicClient.waitForTransactionReceipt({ hash: tx1 });
        
        const vaultAddresses = await vaultFactory.read.getActiveVaults([]);
        console.log(`     ✅ Deployed ${vaultAddresses.length} bot vaults`);
        
        deployments.contracts.BotVaults = vaultAddresses;
        
        // ============================================
        // Configuration
        // ============================================
        console.log("\n⚙️  Configuring Contracts...\n");
        
        // Configure Treasury
        console.log("  11. Configuring Treasury distribution...");
        const tx2 = await treasuryContract.write.setDistribution([
            5000, // 50% to staking
            2000, // 20% to buyback
            1500, // 15% to dev
            1500  // 15% to insurance
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx2 });
        console.log("     ✅ Treasury distribution set");
        
        // Configure game contracts
        console.log("  12. Configuring game contracts...");
        
        // Use first vault as test vault
        const testVault = vaultAddresses[0];
        
        const tx3 = await crapsGame.write.setContracts([
            crapsBets.address,
            crapsSettlement.address,
            testVault
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx3 });
        
        const tx4 = await crapsBets.write.setContracts([
            crapsGame.address,
            crapsSettlement.address,
            testVault
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx4 });
        
        const tx5 = await crapsSettlement.write.setContracts([
            crapsGame.address,
            crapsBets.address,
            testVault
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx5 });
        console.log("     ✅ Game contracts configured");
        
        // Grant roles
        console.log("  13. Setting up roles...");
        const GAME_ROLE = await crapsBets.read.GAME_ROLE([]);
        const tx6 = await crapsBets.write.grantRole([GAME_ROLE, crapsGame.address]);
        await publicClient.waitForTransactionReceipt({ hash: tx6 });
        
        const SETTLEMENT_ROLE = await crapsGame.read.SETTLEMENT_ROLE([]);
        const tx7 = await crapsGame.write.grantRole([SETTLEMENT_ROLE, crapsSettlement.address]);
        await publicClient.waitForTransactionReceipt({ hash: tx7 });
        console.log("     ✅ Roles configured");
        
        // Initialize bot personalities
        console.log("  14. Initializing bot personalities...");
        const tx8 = await botManager.write.initializeBots([]);
        await publicClient.waitForTransactionReceipt({ hash: tx8 });
        console.log("     ✅ Bot personalities initialized");
        
        // ============================================
        // Fund Accounts with Advanced Funding System
        // ============================================
        console.log("\n💰 Setting up Advanced Funding System...\n");
        
        // Import and use the comprehensive funding manager
        console.log("  15. Initializing Wallet Funding Manager...");
        const { WalletFundingManager } = await import('./fund-accounts.ts');
        const fundingManager = new WalletFundingManager({
            // Custom config for deployment
            botEthAmount: parseEther("0.1"),
            botTokenAmount: parseEther("15000"),
            userEthAmount: parseEther("0.05"),
            userTokenAmount: parseEther("5000")
        });
        
        try {
            await fundingManager.initialize();
            
            // Generate bot wallets for all 10 bots
            console.log("  16. Generating bot wallets...");
            const botWallets = fundingManager.generateBotWallets(10);
            
            // Map vault addresses to bot wallets
            for (let i = 0; i < Math.min(botWallets.length, vaultAddresses.length); i++) {
                const botWallet = fundingManager.getBotWallet(i);
                if (botWallet) {
                    botWallet.vaultAddress = vaultAddresses[i];
                }
            }
            
            // Fund all bot accounts with ETH and BOT tokens
            console.log("  17. Funding all bot accounts...");
            await fundingManager.fundBotAccounts(true); // Force fund all
            
            // Fund bot vaults with additional BOT tokens for trading
            console.log("  18. Funding bot vaults for trading...");
            const vaultFundAmount = parseEther("10000"); // 10,000 BOT per vault
            
            for (let i = 0; i < vaultAddresses.length; i++) {
                const vault = vaultAddresses[i];
                const tx = await botToken.write.transfer(
                    [vault, vaultFundAmount],
                    { account: liquidity.account }
                );
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }
            console.log(`     ✅ Funded ${vaultAddresses.length} vaults with additional 10,000 BOT each`);
            
            // Create and fund sample user accounts
            console.log("  19. Creating sample user accounts...");
            const sampleUsers = ['demo-user', 'test-player', 'casino-guest'];
            
            for (const userId of sampleUsers) {
                fundingManager.createUserWallet(userId, userId);
                await fundingManager.fundUserAccount(userId, true);
            }
            
            // Save wallet information for persistence
            console.log("  20. Saving wallet configuration...");
            fundingManager.saveWalletInfo();
            
            await fundingManager.cleanup();
            
            console.log(`     ✅ Advanced funding system deployed successfully`);
            console.log(`     📊 Summary:`);
            console.log(`       • ${botWallets.length} bot wallets created and funded`);
            console.log(`       • ${vaultAddresses.length} vaults funded with trading capital`);
            console.log(`       • ${sampleUsers.length} sample user accounts created`);
            console.log(`       • Wallet info saved to wallets.json`);
            
        } catch (fundingError) {
            console.error(`❌ Advanced funding failed: ${fundingError.message}`);
            console.log(`🔄 Falling back to basic funding...`);
            
            // Fallback to basic funding
            const fundAmount = parseEther("10000");
            for (let i = 0; i < vaultAddresses.length; i++) {
                const vault = vaultAddresses[i];
                const tx = await botToken.write.transfer(
                    [vault, fundAmount],
                    { account: liquidity.account }
                );
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }
            
            const playerFundAmount = parseEther("1000");
            for (let i = 0; i < Math.min(3, players.length); i++) {
                const tx = await botToken.write.transfer(
                    [players[i].account.address, playerFundAmount],
                    { account: liquidity.account }
                );
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }
            
            console.log(`     ✅ Basic funding completed as fallback`);
        }
        
        // ============================================
        // Save Deployment Info
        // ============================================
        console.log("\n💾 Saving Deployment Info...\n");
        
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        const deploymentDir = path.dirname(deploymentPath);
        
        if (!fs.existsSync(deploymentDir)) {
            fs.mkdirSync(deploymentDir, { recursive: true });
        }
        
        fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));
        console.log(`  ✅ Deployment info saved to ${deploymentPath}`);
        
        // ============================================
        // Summary
        // ============================================
        console.log("\n" + "=".repeat(60));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=".repeat(60));
        console.log("\n📊 Deployment Summary:");
        console.log(`  • BOT Token: ${botToken.address}`);
        console.log(`  • Treasury: ${treasuryContract.address}`);
        console.log(`  • Staking Pool: ${stakingPool.address}`);
        console.log(`  • Vault Factory: ${vaultFactory.address}`);
        console.log(`  • Craps Game: ${crapsGame.address}`);
        console.log(`  • Bot Manager: ${botManager.address}`);
        console.log(`  • Bot Vaults: ${vaultAddresses.length} deployed`);
        console.log("\n🎮 Ready to play!");
        console.log("\n💰 Funding Management:");
        console.log("  • Check balances: npm run balance:check");
        console.log("  • Monitor continuously: npm run balance:monitor");
        console.log("  • Emergency funding: npm run fund:emergency");
        console.log("  • Fund specific bots: npm run fund:bots");
        console.log("\n🎯 Game Interfaces:");
        console.log("  • Interactive CLI: npm run cli:interactive");
        console.log("  • Simple CLI: npm run cli:simple");
        console.log("  • Watch bots play: npm run bots");
        console.log("  • Full experience: npm run play");
        
        return deployments;
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

export default main;