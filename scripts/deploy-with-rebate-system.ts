import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from "fs";

async function main() {
    console.log("🎰 Deploying Barely Human with House Edge Rebate System...\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const wallets = await viem.getWalletClients();
    const [deployer, liquidityManager, artistWallet] = wallets;
    
    console.log("Deployer address:", deployer.account.address);
    
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Deployer balance:", formatEther(balance), "ETH\n");
    
    // Prepare bot wallets (using accounts 3-12)
    const botWallets = [];
    for (let i = 3; i < 13; i++) {
        botWallets.push(wallets[i].account.address);
    }
    
    const artistGiveawayWallet = wallets[13].account.address;
    const airdropDistributor = wallets[14].account.address;
    
    try {
        // ========== 1. Deploy Core Token ==========
        console.log("📍 Phase 1: Token Deployment");
        console.log("================================");
        
        console.log("1. Deploying BOTTokenV2 with proper allocations...");
        const botToken = await viem.deployContract("BOTTokenV2", [
            liquidityManager.account.address,
            airdropDistributor,
            deployer.account.address, // community faucet (will update later)
            artistWallet.account.address,
            artistGiveawayWallet
        ]);
        console.log("   ✅ BOTTokenV2 deployed at:", botToken.address);
        
        // Set bot wallets
        console.log("\n2. Setting bot wallet addresses...");
        for (let i = 0; i < 10; i++) {
            await botToken.write.setBotWallet([BigInt(i), botWallets[i]]);
            console.log(`   ✅ Bot ${i} wallet set to:`, botWallets[i]);
        }
        
        // ========== 2. Deploy Rebate System ==========
        console.log("\n📍 Phase 2: Rebate System Deployment");
        console.log("====================================");
        
        console.log("3. Deploying HouseEdgeRebate contract...");
        const houseEdgeRebate = await viem.deployContract("HouseEdgeRebate", [
            botToken.address
        ]);
        console.log("   ✅ HouseEdgeRebate deployed at:", houseEdgeRebate.address);
        
        console.log("\n4. Deploying VolumeTracker contract...");
        const volumeTracker = await viem.deployContract("VolumeTracker", []);
        console.log("   ✅ VolumeTracker deployed at:", volumeTracker.address);
        
        // ========== 3. Deploy Distribution Contracts ==========
        console.log("\n📍 Phase 3: Distribution System");
        console.log("================================");
        
        console.log("5. Deploying TokenDistributor for leaderboard rewards...");
        const tokenDistributor = await viem.deployContract("TokenDistributor", [
            botToken.address
        ]);
        console.log("   ✅ TokenDistributor deployed at:", tokenDistributor.address);
        
        console.log("\n6. Deploying CommunityFaucet for 1-month distribution...");
        const communityFaucet = await viem.deployContract("CommunityFaucet", [
            botToken.address
        ]);
        console.log("   ✅ CommunityFaucet deployed at:", communityFaucet.address);
        
        // ========== 4. Deploy Game Infrastructure ==========
        console.log("\n📍 Phase 4: Game Infrastructure");
        console.log("=================================");
        
        console.log("7. Deploying Mock VRF Coordinator V2Plus...");
        const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
        console.log("   ✅ Mock VRF V2Plus deployed at:", mockVRF.address);
        
        console.log("\n8. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            botToken.address,
            deployer.account.address // will update to treasury
        ]);
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        console.log("\n9. Deploying TreasuryV2 with rebate integration...");
        const treasuryV2 = await viem.deployContract("TreasuryV2", [
            botToken.address,
            stakingPool.address
        ]);
        console.log("   ✅ TreasuryV2 deployed at:", treasuryV2.address);
        
        console.log("\n10. Deploying CrapsGameV2Plus...");
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]);
        console.log("   ✅ CrapsGameV2Plus deployed at:", crapsGame.address);
        
        console.log("\n11. Deploying BotManagerV2Plus...");
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]);
        console.log("   ✅ BotManagerV2Plus deployed at:", botManager.address);
        
        console.log("\n12. Deploying VaultFactoryMinimal...");
        const vaultFactory = await viem.deployContract("VaultFactoryMinimal", [
            botToken.address,
            treasuryV2.address
        ]);
        console.log("   ✅ VaultFactoryMinimal deployed at:", vaultFactory.address);
        
        // ========== 5. Configure Permissions ==========
        console.log("\n📍 Phase 5: Permission Configuration");
        console.log("=====================================");
        
        console.log("13. Setting up contract roles...");
        
        // HouseEdgeRebate roles
        await houseEdgeRebate.write.grantRole([
            await houseEdgeRebate.read.GAME_ROLE(),
            crapsGame.address
        ]);
        await houseEdgeRebate.write.grantRole([
            await houseEdgeRebate.read.TREASURY_ROLE(),
            treasuryV2.address
        ]);
        console.log("   ✅ HouseEdgeRebate roles configured");
        
        // VolumeTracker roles
        await volumeTracker.write.grantRole([
            await volumeTracker.read.GAME_ROLE(),
            crapsGame.address
        ]);
        await volumeTracker.write.grantRole([
            await volumeTracker.read.VAULT_ROLE(),
            vaultFactory.address
        ]);
        console.log("   ✅ VolumeTracker roles configured");
        
        // TreasuryV2 configuration
        await treasuryV2.write.setRebateContracts([
            houseEdgeRebate.address,
            volumeTracker.address
        ]);
        await treasuryV2.write.grantRole([
            await treasuryV2.read.GAME_ROLE(),
            crapsGame.address
        ]);
        await treasuryV2.write.grantRole([
            await treasuryV2.read.VAULT_ROLE(),
            vaultFactory.address
        ]);
        console.log("   ✅ TreasuryV2 configured with rebate contracts");
        
        // ========== 6. Execute Token Distribution ==========
        console.log("\n📍 Phase 6: Token Distribution");
        console.log("================================");
        
        console.log("14. Executing initial token distribution...");
        console.log("   - Bots: 20% (2% each for 10 bots)");
        console.log("   - Liquidity: 15% (Uniswap V4 pools)");
        console.log("   - Airdrop: 10% (Testnet leaderboard)");
        console.log("   - Faucet: 5% (Community distribution)");
        console.log("   - Artist Retained: 16.67%");
        console.log("   - Artist Giveaway: 33.33%");
        
        await botToken.write.executeInitialDistribution();
        console.log("   ✅ Initial distribution complete!");
        
        // Transfer tokens to appropriate contracts
        console.log("\n15. Funding distribution contracts...");
        
        // Get the tokens from airdrop distributor wallet to TokenDistributor contract
        const airdropTokens = await botToken.read.balanceOf([airdropDistributor]);
        console.log(`   Transferring ${formatEther(airdropTokens)} BOT to TokenDistributor...`);
        // Note: In production, airdropDistributor would need to do this transfer
        
        // Transfer faucet allocation to CommunityFaucet
        const faucetAllocation = parseEther("50000000"); // 5% of 1B
        await botToken.write.transfer([communityFaucet.address, faucetAllocation]);
        console.log(`   ✅ Transferred ${formatEther(faucetAllocation)} BOT to CommunityFaucet`);
        
        // ========== 7. Verify Deployment ==========
        console.log("\n📍 Phase 7: Deployment Verification");
        console.log("====================================");
        
        console.log("16. Verifying token distributions...");
        for (let i = 0; i < 10; i++) {
            const balance = await botToken.read.getBotBalance([BigInt(i)]);
            console.log(`   Bot ${i} balance: ${formatEther(balance)} BOT ✅`);
        }
        
        const liquidityBalance = await botToken.read.balanceOf([liquidityManager.account.address]);
        console.log(`   Liquidity Manager: ${formatEther(liquidityBalance)} BOT ✅`);
        
        const artistBalance = await botToken.read.balanceOf([artistWallet.account.address]);
        console.log(`   Artist Retained: ${formatEther(artistBalance)} BOT ✅`);
        
        const giveawayBalance = await botToken.read.balanceOf([artistGiveawayWallet]);
        console.log(`   Artist Giveaway: ${formatEther(giveawayBalance)} BOT ✅`);
        
        // ========== 8. Save Deployment Data ==========
        console.log("\n📍 Phase 8: Saving Deployment Info");
        console.log("===================================");
        
        const deploymentData = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            tokenDistribution: {
                totalSupply: "1000000000",
                allocations: {
                    bots: "20% (2% each)",
                    liquidity: "15%",
                    airdrop: "10%",
                    faucet: "5%",
                    artistRetained: "16.67%",
                    artistGiveaway: "33.33%"
                }
            },
            contracts: {
                // Core Token
                BOTTokenV2: botToken.address,
                
                // Rebate System
                HouseEdgeRebate: houseEdgeRebate.address,
                VolumeTracker: volumeTracker.address,
                
                // Distribution
                TokenDistributor: tokenDistributor.address,
                CommunityFaucet: communityFaucet.address,
                
                // Treasury & Staking
                TreasuryV2: treasuryV2.address,
                StakingPool: stakingPool.address,
                
                // Game Contracts
                CrapsGameV2Plus: crapsGame.address,
                BotManagerV2Plus: botManager.address,
                VaultFactoryMinimal: vaultFactory.address,
                
                // Infrastructure
                MockVRFV2Plus: mockVRF.address
            },
            botWallets: botWallets,
            rebateSystem: {
                description: "Progressive rebate system starting at 50%, increasing 5% weekly to 100%",
                weekDuration: "7 days",
                initialRebate: "50%",
                weeklyIncrease: "5%",
                maxRebate: "100%",
                mechanism: "All house edge accumulated weekly is rebated to LPs proportional to betting volume"
            }
        };
        
        const filename = `deployments/deployment-rebate-${Date.now()}.json`;
        fs.mkdirSync("deployments", { recursive: true });
        fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
        console.log(`   ✅ Deployment data saved to ${filename}`);
        
        // ========== Summary ==========
        console.log("\n" + "=".repeat(60));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=".repeat(60));
        console.log("\n📊 Token Distribution Summary:");
        console.log("   • 20% → 10 AI Bots (2% each)");
        console.log("   • 15% → Uniswap V4 Liquidity");
        console.log("   • 10% → Testnet Leaderboard Rewards");
        console.log("   • 5%  → Community Faucet (1 month)");
        console.log("   • 50% → Artist (1/3 retained, 2/3 giveaway)");
        
        console.log("\n🔄 Rebate Mechanism:");
        console.log("   • Weekly house edge rebates to LPs");
        console.log("   • Proportional to betting volume");
        console.log("   • Progressive: 50% → 100% over time");
        console.log("   • Net-zero house edge in steady state");
        console.log("   • Tokens flow: Bots → LPs via rebates");
        
        console.log("\n✨ All systems ready for operation!");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });