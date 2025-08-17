// Simplified Base Sepolia Deployment Script
// Deploys core contracts with ultra-optimized VaultFactory

import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Base Sepolia VRF Configuration
const VRF_COORDINATOR_BASE_SEPOLIA = "0xd5159bc79784a65e343c68effa0a7f9116bb0898"; // VRF 2.5 on Base Sepolia
const VRF_KEY_HASH_BASE_SEPOLIA = "0x719ed7d7664815b0a9b98a76192fea0ff41a68957b4a201e5aec40d982448fab";
const VRF_SUBSCRIPTION_ID = 1n; // You'll need to create this

async function main() {
  console.log("🚀 Starting Barely Human deployment to Base Sepolia...\n");

  // Connect to network
  const connection = await network.connect();
  const { viem } = connection;

  try {
    // Get deployer account
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();
    
    console.log(`📍 Deployer address: ${deployer.account.address}`);

    // Check balance
    const balance = await publicClient.getBalance({ 
      address: deployer.account.address 
    });
    console.log(`💰 Deployer balance: ${formatEther(balance)} ETH\n`);

    if (balance < parseEther("0.1")) {
      console.error("❌ Insufficient balance. Need at least 0.1 ETH for deployment");
      await connection.close();
      process.exit(1);
    }

    const deployedContracts: any = {};

    // ============================================
    // 1. Deploy BOT Token
    // ============================================
    console.log("📦 1/10 Deploying BOT Token...");
    const botToken = await viem.deployContract("BOTToken", [
      deployer.account.address, // treasury
      deployer.account.address, // liquidity  
      deployer.account.address, // staking
      deployer.account.address, // team
      deployer.account.address  // community
    ]);
    deployedContracts.BOTToken = botToken.address;
    console.log(`✅ BOT Token deployed at: ${botToken.address}\n`);

    // ============================================
    // 2. Deploy Treasury
    // ============================================
    console.log("📦 2/10 Deploying Treasury...");
    const treasury = await viem.deployContract("Treasury", [
      botToken.address,
      deployer.account.address, // development wallet
      deployer.account.address  // insurance wallet
    ]);
    deployedContracts.Treasury = treasury.address;
    console.log(`✅ Treasury deployed at: ${treasury.address}\n`);

    // ============================================
    // 3. Deploy Staking Pool
    // ============================================
    console.log("📦 3/10 Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      botToken.address,  // staking token
      botToken.address,  // reward token (same as staking)
      treasury.address   // treasury
    ]);
    deployedContracts.StakingPool = stakingPool.address;
    console.log(`✅ StakingPool deployed at: ${stakingPool.address}\n`);

    // ============================================
    // 4. Deploy Libraries
    // ============================================
    console.log("📦 4/10 Deploying VaultFactoryLib...");
    const vaultFactoryLib = await viem.deployContract("VaultFactoryLib", []);
    deployedContracts.VaultFactoryLib = vaultFactoryLib.address;
    console.log(`✅ VaultFactoryLib deployed at: ${vaultFactoryLib.address}\n`);

    console.log("📦 5/10 Deploying VaultDeploymentLib...");
    const vaultDeploymentLib = await viem.deployContract("VaultDeploymentLib", []);
    deployedContracts.VaultDeploymentLib = vaultDeploymentLib.address;
    console.log(`✅ VaultDeploymentLib deployed at: ${vaultDeploymentLib.address}\n`);

    // ============================================
    // 5. Deploy VaultFactoryUltraOptimized
    // ============================================
    console.log("📦 6/10 Deploying VaultFactoryUltraOptimized...");
    const vaultFactory = await viem.deployContract("VaultFactoryUltraOptimized", [
      botToken.address,
      treasury.address
    ], {
      libraries: {
        VaultDeploymentLib: vaultDeploymentLib.address
      }
    });
    deployedContracts.VaultFactory = vaultFactory.address;
    console.log(`✅ VaultFactory deployed at: ${vaultFactory.address}\n`);

    // ============================================
    // 6. Deploy CrapsGameV2Plus (VRF 2.5)
    // ============================================
    console.log("📦 7/10 Deploying CrapsGameV2Plus...");
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      VRF_COORDINATOR_BASE_SEPOLIA,
      VRF_SUBSCRIPTION_ID,
      VRF_KEY_HASH_BASE_SEPOLIA
    ]);
    deployedContracts.CrapsGame = crapsGame.address;
    console.log(`✅ CrapsGame deployed at: ${crapsGame.address}\n`);

    // ============================================
    // 7. Deploy CrapsBets
    // ============================================
    console.log("📦 8/10 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets", []);
    deployedContracts.CrapsBets = crapsBets.address;
    console.log(`✅ CrapsBets deployed at: ${crapsBets.address}\n`);

    // ============================================
    // 8. Deploy CrapsSettlement
    // ============================================
    console.log("📦 9/10 Deploying CrapsSettlement...");
    const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
    deployedContracts.CrapsSettlement = crapsSettlement.address;
    console.log(`✅ CrapsSettlement deployed at: ${crapsSettlement.address}\n`);

    // ============================================
    // 9. Deploy BotManagerOptimized
    // ============================================
    console.log("📦 10/10 Deploying BotManagerOptimized...");
    const botManager = await viem.deployContract("BotManagerOptimized", []);
    deployedContracts.BotManager = botManager.address;
    console.log(`✅ BotManager deployed at: ${botManager.address}\n`);

    // ============================================
    // Configure Contract Connections
    // ============================================
    console.log("🔧 Configuring contract connections...");
    
    // Set contracts in CrapsBets
    const setBetsContractsHash = await crapsBets.write.setContracts([
      crapsGame.address,
      treasury.address, // Using treasury as vault for now
      crapsSettlement.address
    ]);
    await publicClient.waitForTransactionReceipt({ hash: setBetsContractsHash });
    console.log("✅ CrapsBets contracts configured");
    
    // Set contracts in CrapsSettlement
    const setSettlementContractsHash = await crapsSettlement.write.setContracts([
      crapsGame.address,
      crapsBets.address,
      treasury.address  // Using treasury as vault for now
    ]);
    await publicClient.waitForTransactionReceipt({ hash: setSettlementContractsHash });
    console.log("✅ CrapsSettlement contracts configured");
    
    // Initialize BotManager bots
    const initBotsHash = await botManager.write.initializeBots();
    await publicClient.waitForTransactionReceipt({ hash: initBotsHash });
    console.log("✅ BotManager personalities initialized\n");

    // ============================================
    // Save deployment info
    // ============================================
    const deploymentInfo = {
      network: "base-sepolia",
      chainId: 84532,
      deployer: deployer.account.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      vrfConfig: {
        coordinator: VRF_COORDINATOR_BASE_SEPOLIA,
        keyHash: VRF_KEY_HASH_BASE_SEPOLIA,
        subscriptionId: VRF_SUBSCRIPTION_ID.toString()
      }
    };

    const deploymentPath = path.join(__dirname, "../deployment");
    if (!fs.existsSync(deploymentPath)) {
      fs.mkdirSync(deploymentPath);
    }

    fs.writeFileSync(
      path.join(deploymentPath, "base-sepolia-deployment.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n✅ Deployment complete!");
    console.log("📄 Deployment info saved to deployment/base-sepolia-deployment.json");
    
    // Print summary
    console.log("\n📊 Deployment Summary:");
    console.log("=======================");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });
    
    console.log("\n⚠️  Next Steps:");
    console.log("1. Create VRF subscription at https://vrf.chain.link/base-sepolia");
    console.log(`2. Add ${crapsGame.address} as a consumer to your VRF subscription`);
    console.log("3. Fund your VRF subscription with LINK tokens");
    console.log("4. Grant roles and configure contracts");
    console.log("5. Deploy bot vaults using VaultFactory.deployAllBots()");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});