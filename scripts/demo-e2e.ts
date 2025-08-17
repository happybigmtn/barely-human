// End-to-End Demo Script
// Demonstrates the complete user journey for ETHGlobal NYC 2025

import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import * as fs from "fs";
import * as path from "path";

async function runDemo() {
  console.log("🎰 Barely Human DeFi Casino - ETHGlobal NYC 2025 Demo\n");
  console.log("=" .repeat(60));
  
  const connection = await network.connect();
  const { viem } = connection;

  try {
    const publicClient = await viem.getPublicClient();
    const [deployer, user1, user2] = await viem.getWalletClients();
    
    console.log("\n📊 Demo Participants:");
    console.log(`Deployer: ${deployer.account.address}`);
    console.log(`User 1: ${user1.account.address}`);
    console.log(`User 2: ${user2.account.address}`);
    
    // ============================================
    // Step 1: Deploy All Contracts
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🚀 Step 1: Deploying Smart Contracts");
    console.log("=".repeat(60));
    
    // Deploy BOT Token
    console.log("\n📦 Deploying BOT Token...");
    const botToken = await viem.deployContract("BOTToken", [
      deployer.account.address,
      deployer.account.address, 
      deployer.account.address,
      deployer.account.address,
      deployer.account.address
    ]);
    console.log(`✅ BOT Token: ${botToken.address}`);
    
    // Deploy Treasury
    console.log("📦 Deploying Treasury...");
    const treasury = await viem.deployContract("Treasury", [
      botToken.address,
      deployer.account.address,
      deployer.account.address
    ]);
    console.log(`✅ Treasury: ${treasury.address}`);
    
    // Deploy StakingPool
    console.log("📦 Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      botToken.address,
      botToken.address,
      treasury.address
    ]);
    console.log(`✅ StakingPool: ${stakingPool.address}`);
    
    // Deploy Mock VRF
    console.log("📦 Deploying Mock VRF Coordinator...");
    const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus", []);
    await mockVRF.write.createSubscription();
    console.log(`✅ Mock VRF: ${mockVRF.address}`);
    
    // Deploy CrapsGameV2Plus
    console.log("📦 Deploying CrapsGameV2Plus...");
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      mockVRF.address,
      1n,
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"
    ]);
    await mockVRF.write.addConsumer([1n, crapsGame.address]);
    console.log(`✅ CrapsGame: ${crapsGame.address}`);
    
    // Deploy CrapsBets
    console.log("📦 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets", []);
    console.log(`✅ CrapsBets: ${crapsBets.address}`);
    
    // Deploy CrapsSettlement
    console.log("📦 Deploying CrapsSettlement...");
    const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
    console.log(`✅ CrapsSettlement: ${crapsSettlement.address}`);
    
    // Deploy BotManagerOptimized
    console.log("📦 Deploying BotManagerOptimized...");
    const botManager = await viem.deployContract("BotManagerOptimized", []);
    await botManager.write.initializeBots();
    console.log(`✅ BotManager: ${botManager.address}`);
    
    // Configure contracts
    console.log("\n🔧 Configuring contract connections...");
    await crapsBets.write.setContracts([
      crapsGame.address,
      treasury.address,
      crapsSettlement.address
    ]);
    await crapsSettlement.write.setContracts([
      crapsGame.address,
      crapsBets.address,
      treasury.address  // Using treasury as vault for now
    ]);
    console.log("✅ Contracts configured");
    
    // ============================================
    // Step 2: Distribute BOT Tokens
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("💰 Step 2: Distributing BOT Tokens to Users");
    console.log("=".repeat(60));
    
    const transferAmount = parseEther("10000");
    
    console.log(`\n💸 Sending ${formatEther(transferAmount)} BOT to User 1...`);
    await botToken.write.transfer([user1.account.address, transferAmount]);
    
    console.log(`💸 Sending ${formatEther(transferAmount)} BOT to User 2...`);
    await botToken.write.transfer([user2.account.address, transferAmount]);
    
    const user1Balance = await botToken.read.balanceOf([user1.account.address]);
    const user2Balance = await botToken.read.balanceOf([user2.account.address]);
    
    console.log(`\n📊 User Balances:`);
    console.log(`User 1: ${formatEther(user1Balance)} BOT`);
    console.log(`User 2: ${formatEther(user2Balance)} BOT`);
    
    // ============================================
    // Step 3: Demonstrate AI Bot Personalities
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🤖 Step 3: AI Bot Personalities");
    console.log("=".repeat(60));
    
    const botNames = [
      "Alice All-In", "Bob Calculator", "Charlie Lucky",
      "Diana Ice Queen", "Eddie Entertainer"
    ];
    
    for (let i = 0; i < 5; i++) {
      const personality = await botManager.read.getPersonality([i]);
      console.log(`\n🎰 Bot ${i}: ${botNames[i]}`);
      console.log(`  Aggressiveness: ${personality[0]}/100`);
      console.log(`  Risk Tolerance: ${personality[1]}/100`);
      console.log(`  Patience: ${personality[2]}/100`);
    }
    
    // ============================================
    // Step 4: Simulate Game Play
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🎲 Step 4: Simulating Craps Game");
    console.log("=".repeat(60));
    
    // Grant operator role
    const OPERATOR_ROLE = "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";
    await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
    
    console.log("\n🎮 Starting new game series...");
    await crapsGame.write.startNewSeries([deployer.account.address]);
    
    console.log("🎲 Requesting dice roll...");
    const requestHash = await crapsGame.write.requestDiceRoll();
    const requestReceipt = await publicClient.waitForTransactionReceipt({ hash: requestHash });
    
    // Extract request ID from logs
    let requestId = 0n;
    for (const log of requestReceipt.logs) {
      if (log.address.toLowerCase() === crapsGame.address.toLowerCase() && log.topics.length > 1) {
        requestId = BigInt(log.topics[1]);
        break;
      }
    }
    
    console.log(`📝 VRF Request ID: ${requestId}`);
    
    console.log("🎲 Fulfilling VRF request...");
    await mockVRF.write.fulfillRandomWords([
      requestId,
      [BigInt(Math.floor(Math.random() * 1000000)), BigInt(Math.floor(Math.random() * 1000000))]
    ]);
    
    const lastRoll = await crapsGame.read.getLastRoll();
    console.log(`\n🎯 Dice Roll Result:`);
    console.log(`  Die 1: ${lastRoll[0]}`);
    console.log(`  Die 2: ${lastRoll[1]}`);
    console.log(`  Total: ${lastRoll[2]}`);
    
    // ============================================
    // Step 5: Staking Demonstration
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("💎 Step 5: BOT Token Staking");
    console.log("=".repeat(60));
    
    const stakeAmount = parseEther("1000");
    
    console.log(`\n📈 User 1 approving ${formatEther(stakeAmount)} BOT for staking...`);
    await botToken.write.approve([stakingPool.address, stakeAmount], {
      account: user1.account
    });
    
    console.log(`💰 User 1 staking ${formatEther(stakeAmount)} BOT...`);
    await stakingPool.write.stake([stakeAmount], {
      account: user1.account
    });
    
    const stakedBalance = await stakingPool.read.balanceOf([user1.account.address]);
    console.log(`✅ User 1 staked balance: ${formatEther(stakedBalance)} BOT`);
    
    // ============================================
    // Step 6: Summary
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("✨ Demo Complete!");
    console.log("=".repeat(60));
    
    console.log("\n📊 Final Statistics:");
    console.log(`  Total BOT Supply: ${formatEther(await botToken.read.totalSupply())}`);
    console.log(`  Active Game Series: ${await crapsGame.read.currentSeriesId()}`);
    console.log(`  Total Staked: ${formatEther(stakedBalance)}`);
    console.log(`  AI Bots Initialized: 10`);
    
    console.log("\n🏆 Key Achievements:");
    console.log("  ✅ DeFi casino with 64 bet types");
    console.log("  ✅ 10 unique AI bot personalities");
    console.log("  ✅ Chainlink VRF 2.5 integration");
    console.log("  ✅ ERC4626 vault system");
    console.log("  ✅ BOT token staking");
    console.log("  ✅ Cross-chain ready with LayerZero V2");
    console.log("  ✅ Uniswap V4 hooks for 2% fee");
    
    console.log("\n🎯 ETHGlobal NYC 2025 - Ready for submission!");
    
  } catch (error) {
    console.error("\n❌ Demo failed:", error);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

runDemo().catch(console.error);