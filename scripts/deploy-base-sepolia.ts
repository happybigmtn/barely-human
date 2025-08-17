// Barely Human - Base Sepolia Deployment Script with Viem
// Deploy all 21 contracts to Base Sepolia testnet

import { network } from "hardhat";
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID!);
const VRF_COORDINATOR_ADDRESS = process.env.VRF_COORDINATOR_ADDRESS!;
const VRF_KEY_HASH = process.env.VRF_KEY_HASH!;

// Bot names for vault creation
const BOT_NAMES = [
  "Alice All-In",
  "Bob Calculator",
  "Charlie Lucky",
  "Diana Ice Queen",
  "Eddie Entertainer",
  "Fiona Fearless",
  "Greg Grinder",
  "Helen Hot Streak",
  "Ivan Intimidator",
  "Julia Jinx"
];

async function main() {
  console.log("🚀 Starting Barely Human deployment to Base Sepolia...\n");

  // Connect to network
  const connection = await network.connect();
  const { viem } = connection;

  // Get deployer account
  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer address: ${account.address}`);

  // Create clients
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Deployer balance: ${formatEther(balance)} ETH\n`);

  if (balance < parseEther("0.3")) {
    console.error("❌ Insufficient balance. Need at least 0.3 ETH for deployment");
    await connection.close();
    process.exit(1);
  }

  const deployedContracts: any = {};

  try {
    // ============================================
    // 1. Deploy BOT Token
    // ============================================
    console.log("📦 1/21 Deploying BOT Token...");
    const botToken = await viem.deployContract("BOTToken", [
      account.address, // treasury
      account.address, // liquidity  
      account.address, // staking
      account.address, // team
      account.address  // community
    ]);
    deployedContracts.BOTToken = botToken.address;
    console.log(`✅ BOT Token deployed at: ${botToken.address}\n`);

    // ============================================
    // 2. Deploy Treasury
    // ============================================
    console.log("📦 2/21 Deploying Treasury...");
    const treasury = await viem.deployContract("Treasury", [
      botToken.address,
      account.address, // development wallet
      account.address  // insurance wallet
    ]);
    deployedContracts.Treasury = treasury.address;
    console.log(`✅ Treasury deployed at: ${treasury.address}\n`);

    // ============================================
    // 3. Deploy Staking Pool
    // ============================================
    console.log("📦 3/21 Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      botToken.address,
      treasury.address,
      604800n // 7 days epoch
    ]);
    deployedContracts.StakingPool = stakingPool.address;
    console.log(`✅ StakingPool deployed at: ${stakingPool.address}\n`);

    // ============================================
    // 4. Deploy CrapsGame (with VRF)
    // ============================================
    console.log("📦 4/21 Deploying CrapsGame...");
    const crapsGame = await viem.deployContract("CrapsGame", [
      VRF_COORDINATOR_ADDRESS,
      VRF_KEY_HASH,
      VRF_SUBSCRIPTION_ID
    ]);
    deployedContracts.CrapsGame = crapsGame.address;
    console.log(`✅ CrapsGame deployed at: ${crapsGame.address}`);
    console.log(`   ⚠️  Add this as consumer to VRF subscription: ${VRF_SUBSCRIPTION_ID}\n`);

    // ============================================
    // 5. Deploy CrapsBets
    // ============================================
    console.log("📦 5/21 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets", [crapsGame.address]);
    deployedContracts.CrapsBets = crapsBets.address;
    console.log(`✅ CrapsBets deployed at: ${crapsBets.address}\n`);

    // ============================================
    // 6. Deploy CrapsSettlement Library
    // ============================================
    console.log("📦 6/21 Deploying CrapsSettlement...");
    const crapsSettlement = await viem.deployContract("CrapsSettlement");
    deployedContracts.CrapsSettlement = crapsSettlement.address;
    console.log(`✅ CrapsSettlement deployed at: ${crapsSettlement.address}\n`);

    // ============================================
    // 7. Deploy BotManager
    // ============================================
    console.log("📦 7/21 Deploying BotManager...");
    const botManager = await viem.deployContract("BotManager");
    deployedContracts.BotManager = botManager.address;
    console.log(`✅ BotManager deployed at: ${botManager.address}\n`);

    // Initialize bot personalities
    console.log("🤖 Initializing bot personalities...");
    const initTx = await walletClient.writeContract({
      address: botManager.address as `0x${string}`,
      abi: [
        {
          name: "initializeBots",
          type: "function",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        }
      ],
      functionName: "initializeBots",
      args: []
    });
    await publicClient.waitForTransactionReceipt({ hash: initTx });
    console.log(`✅ Bot personalities initialized\n`);

    // ============================================
    // 8. Deploy VaultFactoryLib
    // ============================================
    console.log("📦 8/21 Deploying VaultFactoryLib...");
    const vaultFactoryLib = await viem.deployContract("VaultFactoryLib");
    deployedContracts.VaultFactoryLib = vaultFactoryLib.address;
    console.log(`✅ VaultFactoryLib deployed at: ${vaultFactoryLib.address}\n`);

    // ============================================
    // 9. Deploy VaultFactoryOptimized (with library)
    // ============================================
    console.log("📦 9/21 Deploying VaultFactoryOptimized...");
    const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
      botToken.address,
      crapsGame.address,
      treasury.address,
      botManager.address
    ], {
      libraries: {
        VaultFactoryLib: vaultFactoryLib.address
      }
    });
    deployedContracts.VaultFactory = vaultFactory.address;
    console.log(`✅ VaultFactory deployed at: ${vaultFactory.address}\n`);

    // ============================================
    // 10. Deploy 10 Bot Vaults
    // ============================================
    console.log("📦 10/21 Deploying 10 Bot Vaults...");
    const deployAllBotsTx = await walletClient.writeContract({
      address: vaultFactory.address as `0x${string}`,
      abi: [
        {
          name: "deployAllBots",
          type: "function",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        }
      ],
      functionName: "deployAllBots",
      args: []
    });
    await publicClient.waitForTransactionReceipt({ hash: deployAllBotsTx });
    console.log(`✅ All 10 bot vaults deployed\n`);

    // Get vault addresses
    const vaultAddresses = [];
    for (let i = 0; i < 10; i++) {
      const [vaultAddress] = await publicClient.readContract({
        address: vaultFactory.address as `0x${string}`,
        abi: [
          {
            name: "getBotVault",
            type: "function",
            inputs: [{ name: "botId", type: "uint8" }],
            outputs: [{ name: "", type: "address" }],
            stateMutability: "view"
          }
        ],
        functionName: "getBotVault",
        args: [i]
      }) as [string];
      
      vaultAddresses.push(vaultAddress);
      deployedContracts[`BotVault_${BOT_NAMES[i]}`] = vaultAddress;
      console.log(`   Bot ${i}: ${BOT_NAMES[i]} - Vault: ${vaultAddress}`);
    }

    // ============================================
    // 11. Deploy GachaMintPass (NFT System)
    // ============================================
    console.log("\n📦 11/21 Deploying GachaMintPass...");
    const gachaMintPass = await viem.deployContract("GachaMintPass", [
      VRF_COORDINATOR_ADDRESS,
      VRF_KEY_HASH,
      VRF_SUBSCRIPTION_ID,
      crapsGame.address
    ]);
    deployedContracts.GachaMintPass = gachaMintPass.address;
    console.log(`✅ GachaMintPass deployed at: ${gachaMintPass.address}`);
    console.log(`   ⚠️  Add this as consumer to VRF subscription: ${VRF_SUBSCRIPTION_ID}\n`);

    // ============================================
    // 12. Deploy BarelyHumanArt
    // ============================================
    console.log("📦 12/21 Deploying BarelyHumanArt...");
    const barelyHumanArt = await viem.deployContract("BarelyHumanArt", [
      "Barely Human Art",
      "BHA",
      "https://api.barelyhuman.xyz/art/"
    ]);
    deployedContracts.BarelyHumanArt = barelyHumanArt.address;
    console.log(`✅ BarelyHumanArt deployed at: ${barelyHumanArt.address}\n`);

    // ============================================
    // 13. Deploy ArtRedemptionService
    // ============================================
    console.log("📦 13/21 Deploying ArtRedemptionService...");
    const artRedemptionService = await viem.deployContract("ArtRedemptionService", [
      gachaMintPass.address,
      barelyHumanArt.address
    ]);
    deployedContracts.ArtRedemptionService = artRedemptionService.address;
    console.log(`✅ ArtRedemptionService deployed at: ${artRedemptionService.address}\n`);

    // ============================================
    // 14. Setup Contract Permissions
    // ============================================
    console.log("🔐 Setting up contract permissions...");
    
    // Grant roles to Treasury
    const grantTreasuryRoleTx = await walletClient.writeContract({
      address: stakingPool.address as `0x${string}`,
      abi: [
        {
          name: "grantRole",
          type: "function",
          inputs: [
            { name: "role", type: "bytes32" },
            { name: "account", type: "address" }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        }
      ],
      functionName: "grantRole",
      args: [
        "0x3b4224c08723d5384e8a27b28ba1c2e94c29a37e5e96cbdca693ae3f81db4f06", // TREASURY_ROLE
        treasury.address as `0x${string}`
      ]
    });
    await publicClient.waitForTransactionReceipt({ hash: grantTreasuryRoleTx });
    console.log("✅ Treasury role granted to Treasury contract");

    // Grant MINTER_ROLE to ArtRedemptionService
    const grantMinterRoleTx = await walletClient.writeContract({
      address: barelyHumanArt.address as `0x${string}`,
      abi: [
        {
          name: "grantRole",
          type: "function",
          inputs: [
            { name: "role", type: "bytes32" },
            { name: "account", type: "address" }
          ],
          outputs: [],
          stateMutability: "nonpayable"
        }
      ],
      functionName: "grantRole",
      args: [
        "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", // MINTER_ROLE
        artRedemptionService.address as `0x${string}`
      ]
    });
    await publicClient.waitForTransactionReceipt({ hash: grantMinterRoleTx });
    console.log("✅ Minter role granted to ArtRedemptionService\n");

    // ============================================
    // Save Deployment Info
    // ============================================
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID.toString(),
      contracts: deployedContracts,
      vaultMapping: BOT_NAMES.reduce((acc, name, i) => {
        acc[name] = vaultAddresses[i];
        return acc;
      }, {} as any)
    };

    const deploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📁 Deployment info saved to: ${deploymentFile}\n`);

    // ============================================
    // Display Summary
    // ============================================
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 Contract Addresses:");
    console.log("───────────────────────");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_")) {
        console.log(`${name}: ${address}`);
      }
    });

    console.log("\n⚠️  IMPORTANT NEXT STEPS:");
    console.log("──────────────────────────");
    console.log("1. Add these contracts as consumers to your VRF subscription:");
    console.log(`   - CrapsGame: ${crapsGame.address}`);
    console.log(`   - GachaMintPass: ${gachaMintPass.address}`);
    console.log(`   Go to: https://vrf.chain.link/base-sepolia/${VRF_SUBSCRIPTION_ID}`);
    
    console.log("\n2. Verify contracts on BaseScan:");
    console.log("   npm run verify:base-sepolia");
    
    console.log("\n3. Fund vaults with initial BOT tokens:");
    console.log("   Each vault needs BOT tokens for betting");
    
    console.log("\n4. Start the metadata server:");
    console.log("   node art/opensea-metadata-server.js");

    console.log("\n📍 View on BaseScan:");
    console.log(`https://sepolia.basescan.org/address/${account.address}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
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