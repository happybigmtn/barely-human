import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, parseUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import chalk from "chalk";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

/**
 * Redeploy VRF-dependent contracts with new subscription ID
 * - CrapsGameV2Plus
 * - BotManager  
 * - GachaMintPassV2Plus (if needed)
 */

async function main() {
  console.log(chalk.bold.cyan("\n🔄 Redeploying VRF Contracts with New Subscription\n"));
  
  // Load existing deployment
  const deploymentPath = path.join(__dirname, "../deployments/base-sepolia-deployment.json");
  const existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Setup account and clients
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  // Get balance
  const balance = await publicClient.getBalance({ address: account.address });
  
  console.log(chalk.gray("Deployer address:"), account.address);
  console.log(chalk.gray("Deployer balance:"), formatEther(balance), "ETH");
  console.log(chalk.gray("Network:"), "Base Sepolia (84532)");
  
  console.log(chalk.yellow("\n📊 VRF Configuration:"));
  console.log(chalk.gray("VRF Coordinator:"), process.env.VRF_COORDINATOR_ADDRESS);
  console.log(chalk.gray("NEW Subscription:"), process.env.VRF_SUBSCRIPTION_ID);
  console.log(chalk.gray("Key Hash:"), process.env.VRF_KEY_HASH);
  
  if (balance < parseUnits("0.05", 18)) {
    console.log(chalk.red("⚠️  Low balance warning! You may need more ETH for deployment."));
  }
  
  try {
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    console.log(chalk.yellow("\n🎲 Redeploying CrapsGameV2Plus..."));
    
    // Deploy new CrapsGameV2Plus with correct subscription ID
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),
      process.env.VRF_KEY_HASH as `0x${string}`
    ]);
    
    console.log(chalk.green("✅ CrapsGameV2Plus deployed:"), crapsGame.address);
    
    console.log(chalk.yellow("\n🤖 Redeploying BotManager..."));
    
    // Deploy new BotManager with correct subscription ID
    const botManager = await viem.deployContract("BotManagerV2Plus", [
      process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),
      process.env.VRF_KEY_HASH as `0x${string}`
    ]);
    
    console.log(chalk.green("✅ BotManager deployed:"), botManager.address);
    
    // Update deployment with new addresses
    const updatedDeployment = {
      ...existingDeployment,
      contracts: {
        ...existingDeployment.contracts,
        CrapsGameV2Plus: crapsGame.address,
        BotManager: botManager.address
      },
      vrfConfig: {
        coordinator: process.env.VRF_COORDINATOR_ADDRESS,
        subscriptionId: process.env.VRF_SUBSCRIPTION_ID,
        keyHash: process.env.VRF_KEY_HASH
      },
      redeployment: {
        timestamp: new Date().toISOString(),
        reason: "Updated VRF subscription ID to v2.5",
        newSubscriptionId: process.env.VRF_SUBSCRIPTION_ID,
        previousCrapsGame: existingDeployment.contracts.CrapsGameV2Plus,
        previousBotManager: existingDeployment.contracts.BotManager
      }
    };
    
    // Save updated deployment
    fs.writeFileSync(deploymentPath, JSON.stringify(updatedDeployment, null, 2));
    
    console.log(chalk.bold.green("\n🎯 Redeployment Complete!"));
    console.log(chalk.white("NEW CrapsGameV2Plus:"), crapsGame.address);
    console.log(chalk.white("NEW BotManager:"), botManager.address);
    console.log(chalk.white("VRF Subscription:"), process.env.VRF_SUBSCRIPTION_ID);
    
    console.log(chalk.bold.yellow("\n⚠️  IMPORTANT NEXT STEPS:"));
    console.log(chalk.yellow("1. Add NEW contracts as consumers to VRF subscription:"));
    console.log(chalk.gray(`   - CrapsGameV2Plus: ${crapsGame.address}`));
    console.log(chalk.gray(`   - BotManager: ${botManager.address}`));
    console.log(chalk.yellow("2. Grant OPERATOR_ROLE to deployer if needed"));
    console.log(chalk.yellow("3. Initialize bot personalities in BotManager"));
    console.log(chalk.yellow("4. Test VRF functionality"));
    
    console.log(chalk.bold.cyan("\n🚀 Ready to test:"));
    console.log(chalk.white("   node test-dice-roll.js"));
    console.log(chalk.white("   cd frontend/cli && node demo-ethglobal.js"));
    
    await connection.close();
    
  } catch (error) {
    console.error(chalk.red("\n❌ Deployment failed:"), error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });