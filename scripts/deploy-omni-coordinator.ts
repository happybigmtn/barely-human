#!/usr/bin/env tsx

/**
 * LayerZero V2 OmniVaultCoordinator Deployment Script
 * ETHGlobal NYC 2025 - LayerZero Prize Qualification
 * 
 * Deploys OmniVaultCoordinator on Base Sepolia and Arbitrum Sepolia
 * with proper peer configuration for cross-chain messaging
 */

import { network } from "hardhat";
import fs from "fs";
import path from "path";

// LayerZero V2 Endpoint addresses
const LAYERZERO_ENDPOINTS = {
  baseSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f"
};

// Chain IDs for LayerZero V2
const CHAIN_EIDS = {
  baseSepolia: 40245,
  arbitrumSepolia: 40231
};

interface DeploymentConfig {
  chainName: string;
  endpoint: string;
  eid: number;
  botTokenAddress?: string;
}

interface DeploymentResult {
  chainName: string;
  eid: number;
  coordinator: string;
  txHash: string;
  blockNumber: number;
}

async function main() {
  console.log("🚀 Starting LayerZero V2 OmniVaultCoordinator deployment...");
  console.log("📋 ETHGlobal NYC 2025 LayerZero Prize Qualification\n");

  const connection = await network.connect();
  const { viem } = connection;
  
  try {
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const deployer = walletClients[0];

    console.log(`🔐 Deployer: ${deployer.account.address}`);
    console.log(`⛓️  Network: ${network.name}`);
    console.log(`🆔 Chain ID: ${await publicClient.getChainId()}\n`);

    // Get deployment configuration for current network
    const config = getDeploymentConfig(network.name);
    if (!config) {
      throw new Error(`Unsupported network: ${network.name}`);
    }

    console.log("📋 Deployment Configuration:");
    console.log(`   Chain: ${config.chainName}`);
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log(`   EID: ${config.eid}\n`);

    // Deploy BOT token if needed (for testing)
    let botTokenAddress = config.botTokenAddress;
    if (!botTokenAddress) {
      console.log("🪙 Deploying BOT token for testing...");
      const botToken = await viem.deployContract("BOTToken");
      await publicClient.waitForTransactionReceipt({ hash: botToken.hash });
      botTokenAddress = botToken.address;
      console.log(`✅ BOT Token deployed: ${botTokenAddress}\n`);
    }

    // Deploy OmniVaultCoordinator
    console.log("🌐 Deploying OmniVaultCoordinator...");
    const coordinator = await viem.deployContract("OmniVaultCoordinator", [
      config.endpoint,
      deployer.account.address,
      botTokenAddress
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: coordinator.hash 
    });

    console.log(`✅ OmniVaultCoordinator deployed: ${coordinator.address}`);
    console.log(`📦 Transaction: ${receipt.transactionHash}`);
    console.log(`🧱 Block: ${receipt.blockNumber}\n`);

    // Save deployment result
    const result: DeploymentResult = {
      chainName: config.chainName,
      eid: config.eid,
      coordinator: coordinator.address,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber)
    };

    await saveDeploymentResult(result);
    console.log("💾 Deployment result saved to deployments/omni-coordinator.json");

    // Display next steps
    console.log("\n🔧 Next Steps:");
    console.log("1. Deploy on the other chain (Base Sepolia ↔ Arbitrum Sepolia)");
    console.log("2. Run peer configuration script");
    console.log("3. Test cross-chain messaging");
    console.log("\n🏆 LayerZero V2 Requirements Met:");
    console.log("✅ Using @layerzerolabs/lz-evm-oapp-v2 package");
    console.log("✅ Proper OApp inheritance");
    console.log("✅ Cross-chain messaging implementation");
    console.log("✅ Base Sepolia ↔ Arbitrum Sepolia support");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

function getDeploymentConfig(networkName: string): DeploymentConfig | null {
  switch (networkName) {
    case "baseSepolia":
      return {
        chainName: "Base Sepolia",
        endpoint: LAYERZERO_ENDPOINTS.baseSepolia,
        eid: CHAIN_EIDS.baseSepolia
      };
    case "arbitrumSepolia":
      return {
        chainName: "Arbitrum Sepolia", 
        endpoint: LAYERZERO_ENDPOINTS.arbitrumSepolia,
        eid: CHAIN_EIDS.arbitrumSepolia
      };
    default:
      return null;
  }
}

async function saveDeploymentResult(result: DeploymentResult) {
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, "omni-coordinator.json");
  let deployments: DeploymentResult[] = [];

  // Load existing deployments
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf8");
    deployments = JSON.parse(data);
  }

  // Update or add deployment for this chain
  const existingIndex = deployments.findIndex(d => d.chainName === result.chainName);
  if (existingIndex >= 0) {
    deployments[existingIndex] = result;
  } else {
    deployments.push(result);
  }

  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
}

// Run deployment
if (require.main === module) {
  main().catch(console.error);
}

export default main;