import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from "fs";

async function main() {
    console.log("🎰 Deploying Barely Human with Refined Net Settlement Rebate System...\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const wallets = await viem.getWalletClients();
    const [deployer, liquidityManager, artistWallet] = wallets;
    
    console.log("Deployer address:", deployer.account.address);
    
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Deployer balance:", formatEther(balance), "ETH\n");
    
    // Prepare bot wallets
    const botWallets = [];
    for (let i = 3; i < 13; i++) {
        botWallets.push(wallets[i].account.address);
    }
    
    const artistGiveawayWallet = wallets[13].account.address;
    const airdropDistributor = wallets[14].account.address;
    
    try {
        console.log("=" .repeat(60));
        console.log("📍 REFINED REBATE SYSTEM DEPLOYMENT");
        console.log("=" .repeat(60));
        console.log("\nKey Features:");
        console.log("  ✓ Net settlement tracking (collections vs issuances)");
        console.log("  ✓ Virtual debt mechanism");
        console.log("  ✓ 1-week rebate expiration");
        console.log("  ✓ Progressive token transfer from bots to LPs");
        console.log("=" .repeat(60) + "\n");
        
        // ========== Phase 1: Core Token ==========
        console.log("📍 Phase 1: Token Deployment");
        console.log("-".repeat(40));
        
        console.log("1. Deploying BOTTokenV2...");
        const botToken = await viem.deployContract("BOTTokenV2", [
            liquidityManager.account.address,
            airdropDistributor,
            deployer.account.address, // community faucet
            artistWallet.account.address,
            artistGiveawayWallet
        ]);
        console.log("   ✅ BOTTokenV2 deployed at:", botToken.address);
        
        console.log("\n2. Setting bot wallet addresses...");
        for (let i = 0; i < 10; i++) {
            await botToken.write.setBotWallet([BigInt(i), botWallets[i]]);
            console.log(`   ✅ Bot ${i}: ${botWallets[i].slice(0, 10)}...`);
        }
        
        // ========== Phase 2: Refined Rebate System ==========
        console.log("\n📍 Phase 2: Net Settlement Rebate System");
        console.log("-".repeat(40));
        
        console.log("3. Deploying HouseEdgeRebateV2 (with virtual debt)...");
        const houseEdgeRebateV2 = await viem.deployContract("HouseEdgeRebateV2", [
            botToken.address
        ]);
        console.log("   ✅ HouseEdgeRebateV2 deployed at:", houseEdgeRebateV2.address);
        console.log("   Features:");
        console.log("     • Weekly net position calculation");
        console.log("     • Virtual debt tracking");
        console.log("     • 1-week claim expiration");
        console.log("     • Expired rebates retained by treasury");
        
        // ========== Phase 3: Treasury with Net Settlement ==========
        console.log("\n📍 Phase 3: Treasury V3");
        console.log("-".repeat(40));
        
        console.log("4. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            botToken.address,
            deployer.account.address
        ]);
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        console.log("\n5. Deploying TreasuryV3 (net settlement)...");
        const treasuryV3 = await viem.deployContract("TreasuryV3", [
            botToken.address,
            stakingPool.address
        ]);
        console.log("   ✅ TreasuryV3 deployed at:", treasuryV3.address);
        console.log("   Features:");
        console.log("     • Tracks BOT collections vs issuances");
        console.log("     • Bot position management");
        console.log("     • Weekly settlement processing");
        
        // ========== Phase 4: Distribution Contracts ==========
        console.log("\n📍 Phase 4: Distribution System");
        console.log("-".repeat(40));
        
        console.log("6. Deploying TokenDistributor...");
        const tokenDistributor = await viem.deployContract("TokenDistributor", [
            botToken.address
        ]);
        console.log("   ✅ TokenDistributor deployed at:", tokenDistributor.address);
        
        console.log("\n7. Deploying CommunityFaucet...");
        const communityFaucet = await viem.deployContract("CommunityFaucet", [
            botToken.address
        ]);
        console.log("   ✅ CommunityFaucet deployed at:", communityFaucet.address);
        
        // ========== Phase 5: Game Infrastructure ==========
        console.log("\n📍 Phase 5: Game Infrastructure");
        console.log("-".repeat(40));
        
        console.log("8. Deploying Mock VRF Coordinator...");
        const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
        console.log("   ✅ Mock VRF deployed at:", mockVRF.address);
        
        console.log("\n9. Deploying CrapsGameV2Plus...");
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]);
        console.log("   ✅ CrapsGame deployed at:", crapsGame.address);
        
        console.log("\n10. Deploying BotManagerV2Plus...");
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ]);
        console.log("   ✅ BotManager deployed at:", botManager.address);
        
        // ========== Phase 6: Permission Configuration ==========
        console.log("\n📍 Phase 6: Permission Configuration");
        console.log("-".repeat(40));
        
        console.log("11. Configuring contract roles...");
        
        // HouseEdgeRebateV2 roles
        await houseEdgeRebateV2.write.grantRole([
            await houseEdgeRebateV2.read.GAME_ROLE(),
            treasuryV3.address
        ]);
        await houseEdgeRebateV2.write.grantRole([
            await houseEdgeRebateV2.read.TREASURY_ROLE(),
            treasuryV3.address
        ]);
        console.log("   ✅ HouseEdgeRebateV2 roles configured");
        
        // TreasuryV3 roles
        await treasuryV3.write.grantRole([
            await treasuryV3.read.GAME_ROLE(),
            crapsGame.address
        ]);
        await treasuryV3.write.grantRole([
            await treasuryV3.read.OPERATOR_ROLE(),
            deployer.account.address
        ]);
        await treasuryV3.write.setRebateContract([houseEdgeRebateV2.address]);
        console.log("   ✅ TreasuryV3 configured");
        
        // ========== Phase 7: Token Distribution ==========
        console.log("\n📍 Phase 7: Token Distribution");
        console.log("-".repeat(40));
        
        console.log("12. Executing initial token distribution...");
        console.log("\n   Distribution Breakdown:");
        console.log("   ├─ Bots: 20% (2% each × 10 bots = 20M each)");
        console.log("   ├─ Liquidity: 15% (150M for Uniswap V4)");
        console.log("   ├─ Airdrop: 10% (100M for leaderboard)");
        console.log("   ├─ Faucet: 5% (50M for community)");
        console.log("   ├─ Artist Retained: 16.67% (166.67M)");
        console.log("   └─ Artist Giveaway: 33.33% (333.33M)");
        
        await botToken.write.executeInitialDistribution();
        console.log("\n   ✅ Distribution complete!");
        
        // Initialize bot positions in treasury
        console.log("\n13. Initializing bot positions in treasury...");
        for (let i = 0; i < 10; i++) {
            await treasuryV3.write.initializeBotPosition([
                BigInt(i),
                parseEther("20000000") // 20M tokens each
            ]);
        }
        console.log("   ✅ All bot positions initialized");
        
        // Fund contracts
        console.log("\n14. Funding distribution contracts...");
        await botToken.write.transfer([communityFaucet.address, parseEther("50000000")]);
        console.log("   ✅ CommunityFaucet funded with 50M BOT");
        
        await botToken.write.transfer([houseEdgeRebateV2.address, parseEther("10000000")]);
        console.log("   ✅ Rebate contract funded with 10M BOT (initial reserve)");
        
        // ========== Phase 8: Verification ==========
        console.log("\n📍 Phase 8: Deployment Verification");
        console.log("-".repeat(40));
        
        console.log("15. Verifying token distributions...");
        for (let i = 0; i < 3; i++) {
            const balance = await botToken.read.getBotBalance([BigInt(i)]);
            console.log(`   Bot ${i}: ${formatEther(balance)} BOT ✅`);
        }
        console.log("   ... (7 more bots initialized)");
        
        const liquidityBalance = await botToken.read.balanceOf([liquidityManager.account.address]);
        console.log(`   Liquidity: ${formatEther(liquidityBalance)} BOT ✅`);
        
        // ========== Save Deployment Data ==========
        console.log("\n📍 Saving Deployment Information");
        console.log("-".repeat(40));
        
        const deploymentData = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            rebateSystem: {
                type: "Net Settlement with Virtual Debt",
                features: {
                    netSettlement: "Tracks collections vs issuances weekly",
                    virtualDebt: "Debt must be paid before rebates resume",
                    expiration: "Unclaimed rebates expire after 1 week",
                    retention: "Expired rebates retained by treasury"
                },
                tokenFlow: {
                    initial: "Bots start with 20% (2% each)",
                    mechanism: "House edge transfers tokens from bots to LPs",
                    steadyState: "Eventually bots depleted, rely on LP capital",
                    netZero: "100% of net collections rebated to LPs"
                }
            },
            tokenDistribution: {
                totalSupply: "1,000,000,000 BOT",
                allocations: {
                    bots: "200,000,000 (20%)",
                    liquidity: "150,000,000 (15%)",
                    airdrop: "100,000,000 (10%)",
                    faucet: "50,000,000 (5%)",
                    artistRetained: "166,666,667 (16.67%)",
                    artistGiveaway: "333,333,333 (33.33%)"
                }
            },
            contracts: {
                // Core
                BOTTokenV2: botToken.address,
                
                // Rebate System
                HouseEdgeRebateV2: houseEdgeRebateV2.address,
                TreasuryV3: treasuryV3.address,
                
                // Distribution
                TokenDistributor: tokenDistributor.address,
                CommunityFaucet: communityFaucet.address,
                StakingPool: stakingPool.address,
                
                // Game
                CrapsGameV2Plus: crapsGame.address,
                BotManagerV2Plus: botManager.address,
                MockVRF: mockVRF.address
            },
            botWallets: botWallets
        };
        
        const filename = `deployments/refined-rebate-${Date.now()}.json`;
        fs.mkdirSync("deployments", { recursive: true });
        fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
        console.log(`   ✅ Deployment saved to ${filename}`);
        
        // ========== Summary ==========
        console.log("\n" + "=".repeat(60));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=".repeat(60));
        
        console.log("\n📊 Refined Rebate System Summary:");
        console.log("┌─────────────────────────────────────────────────┐");
        console.log("│ WEEKLY NET SETTLEMENT                          │");
        console.log("├─────────────────────────────────────────────────┤");
        console.log("│ • House calculates net position weekly         │");
        console.log("│ • Collections - Issuances = Net Position       │");
        console.log("│ • Positive net → Rebates to LPs                │");
        console.log("│ • Negative net → Virtual debt accumulates      │");
        console.log("└─────────────────────────────────────────────────┘");
        
        console.log("\n┌─────────────────────────────────────────────────┐");
        console.log("│ VIRTUAL DEBT MECHANISM                         │");
        console.log("├─────────────────────────────────────────────────┤");
        console.log("│ • Debt must be paid before rebates resume      │");
        console.log("│ • Future profits first pay off debt            │");
        console.log("│ • Only surplus after debt → LP rebates         │");
        console.log("└─────────────────────────────────────────────────┘");
        
        console.log("\n┌─────────────────────────────────────────────────┐");
        console.log("│ REBATE EXPIRATION                              │");
        console.log("├─────────────────────────────────────────────────┤");
        console.log("│ • Players have 1 week to claim rebates         │");
        console.log("│ • Unclaimed rebates expire                     │");
        console.log("│ • Expired amounts retained by treasury         │");
        console.log("└─────────────────────────────────────────────────┘");
        
        console.log("\n┌─────────────────────────────────────────────────┐");
        console.log("│ TOKEN FLOW: BOTS → HUMANS                      │");
        console.log("├─────────────────────────────────────────────────┤");
        console.log("│ START:  Bots have 20% of supply                │");
        console.log("│ PLAY:   Bots lose → Tokens to LPs via rebates  │");
        console.log("│ END:    Bots depleted, rely on LP capital      │");
        console.log("│ STEADY: Net-zero house edge achieved           │");
        console.log("└─────────────────────────────────────────────────┘");
        
        console.log("\n✨ System ready for operation!");
        
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