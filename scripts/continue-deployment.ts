// Continue Base Sepolia Deployment from Treasury
import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID!);
const VRF_COORDINATOR_ADDRESS = process.env.VRF_COORDINATOR_ADDRESS!;
const VRF_KEY_HASH = process.env.VRF_KEY_HASH!;

// Already deployed
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";

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
  console.log("🚀 Continuing Barely Human deployment to Base Sepolia...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer address: ${account.address}`);
  console.log(`✅ Using existing BOT Token: ${BOT_TOKEN_ADDRESS}\n`);

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Current balance: ${formatEther(balance)} ETH\n`);

  const deployedContracts: any = {
    BOTToken: BOT_TOKEN_ADDRESS
  };

  try {
    // Deploy Treasury
    console.log("📦 Deploying Treasury...");
    const treasury = await viem.deployContract("Treasury", [
      BOT_TOKEN_ADDRESS,
      account.address,
      account.address
    ]);
    deployedContracts.Treasury = treasury.address;
    console.log(`✅ Treasury: ${treasury.address}\n`);

    // Deploy StakingPool
    console.log("📦 Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      BOT_TOKEN_ADDRESS,  // staking token
      BOT_TOKEN_ADDRESS,  // reward token (same as staking)
      treasury.address    // treasury
    ]);
    deployedContracts.StakingPool = stakingPool.address;
    console.log(`✅ StakingPool: ${stakingPool.address}\n`);

    // Deploy CrapsGame
    console.log("📦 Deploying CrapsGame (VRF)...");
    const crapsGame = await viem.deployContract("CrapsGame", [
      VRF_COORDINATOR_ADDRESS,
      VRF_KEY_HASH,
      VRF_SUBSCRIPTION_ID
    ]);
    deployedContracts.CrapsGame = crapsGame.address;
    console.log(`✅ CrapsGame: ${crapsGame.address}`);
    console.log(`   ⚠️ Add as VRF consumer!\n`);

    // Deploy CrapsBets
    console.log("📦 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets", [crapsGame.address]);
    deployedContracts.CrapsBets = crapsBets.address;
    console.log(`✅ CrapsBets: ${crapsBets.address}\n`);

    // Deploy CrapsSettlement
    console.log("📦 Deploying CrapsSettlement...");
    const crapsSettlement = await viem.deployContract("CrapsSettlement");
    deployedContracts.CrapsSettlement = crapsSettlement.address;
    console.log(`✅ CrapsSettlement: ${crapsSettlement.address}\n`);

    // Deploy BotManager
    console.log("📦 Deploying BotManager...");
    const botManager = await viem.deployContract("BotManager");
    deployedContracts.BotManager = botManager.address;
    console.log(`✅ BotManager: ${botManager.address}\n`);

    // Initialize bots
    console.log("🤖 Initializing bot personalities...");
    const initTx = await walletClient.writeContract({
      address: botManager.address as `0x${string}`,
      abi: [{
        name: "initializeBots",
        type: "function",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "initializeBots",
      args: []
    });
    await publicClient.waitForTransactionReceipt({ hash: initTx });
    console.log(`✅ Bots initialized\n`);

    // Deploy VaultFactoryLib
    console.log("📦 Deploying VaultFactoryLib...");
    const vaultFactoryLib = await viem.deployContract("VaultFactoryLib");
    deployedContracts.VaultFactoryLib = vaultFactoryLib.address;
    console.log(`✅ VaultFactoryLib: ${vaultFactoryLib.address}\n`);

    // Deploy VaultFactoryOptimized
    console.log("📦 Deploying VaultFactoryOptimized...");
    const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
      BOT_TOKEN_ADDRESS,
      crapsGame.address,
      treasury.address,
      botManager.address
    ], {
      libraries: {
        VaultFactoryLib: vaultFactoryLib.address
      }
    });
    deployedContracts.VaultFactory = vaultFactory.address;
    console.log(`✅ VaultFactory: ${vaultFactory.address}\n`);

    // Deploy all bot vaults
    console.log("📦 Deploying 10 Bot Vaults...");
    const deployAllBotsTx = await walletClient.writeContract({
      address: vaultFactory.address as `0x${string}`,
      abi: [{
        name: "deployAllBots",
        type: "function",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "deployAllBots",
      args: []
    });
    await publicClient.waitForTransactionReceipt({ hash: deployAllBotsTx });
    console.log(`✅ All bot vaults deployed\n`);

    // Get vault addresses
    for (let i = 0; i < 10; i++) {
      const [vaultAddress] = await publicClient.readContract({
        address: vaultFactory.address as `0x${string}`,
        abi: [{
          name: "getBotVault",
          type: "function",
          inputs: [{ name: "botId", type: "uint8" }],
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view"
        }],
        functionName: "getBotVault",
        args: [i]
      }) as [string];
      
      deployedContracts[`BotVault_${i}`] = vaultAddress;
      console.log(`   Bot ${i}: ${BOT_NAMES[i]} - ${vaultAddress}`);
    }

    // Deploy NFT contracts
    console.log("\n📦 Deploying GachaMintPass...");
    const gachaMintPass = await viem.deployContract("GachaMintPass", [
      VRF_COORDINATOR_ADDRESS,
      VRF_KEY_HASH,
      VRF_SUBSCRIPTION_ID,
      crapsGame.address
    ]);
    deployedContracts.GachaMintPass = gachaMintPass.address;
    console.log(`✅ GachaMintPass: ${gachaMintPass.address}`);
    console.log(`   ⚠️ Add as VRF consumer!\n`);

    console.log("📦 Deploying BarelyHumanArt...");
    const barelyHumanArt = await viem.deployContract("BarelyHumanArt", [
      "Barely Human Art",
      "BHA",
      "https://api.barelyhuman.xyz/art/"
    ]);
    deployedContracts.BarelyHumanArt = barelyHumanArt.address;
    console.log(`✅ BarelyHumanArt: ${barelyHumanArt.address}\n`);

    console.log("📦 Deploying ArtRedemptionService...");
    const artRedemptionService = await viem.deployContract("ArtRedemptionService", [
      gachaMintPass.address,
      barelyHumanArt.address
    ]);
    deployedContracts.ArtRedemptionService = artRedemptionService.address;
    console.log(`✅ ArtRedemptionService: ${artRedemptionService.address}\n`);

    // Save deployment info
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID.toString(),
      contracts: deployedContracts
    };

    const deploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 Deployed Contracts:");
    console.log("───────────────────────");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_")) {
        console.log(`${name}: ${address}`);
      }
    });

    console.log("\n⚠️ IMPORTANT: Add these to VRF subscription:");
    console.log(`- CrapsGame: ${crapsGame.address}`);
    console.log(`- GachaMintPass: ${gachaMintPass.address}`);
    console.log(`\nVRF Dashboard: https://vrf.chain.link/base-sepolia`);

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Gas used: ${formatEther(balance - finalBalance)} ETH`);
    console.log(`💰 Remaining: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
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