// Continue Base Sepolia Deployment from StakingPool
import { network } from "hardhat";
import { formatEther } from "viem";
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
const TREASURY_ADDRESS = "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a";

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
  console.log("🚀 Continuing deployment from StakingPool...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`✅ BOT Token: ${BOT_TOKEN_ADDRESS}`);
  console.log(`✅ Treasury: ${TREASURY_ADDRESS}\n`);

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);

  const deployedContracts: any = {
    BOTToken: BOT_TOKEN_ADDRESS,
    Treasury: TREASURY_ADDRESS
  };

  try {
    // Deploy StakingPool
    console.log("📦 Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      BOT_TOKEN_ADDRESS,
      BOT_TOKEN_ADDRESS,
      TREASURY_ADDRESS
    ]);
    deployedContracts.StakingPool = stakingPool.address;
    console.log(`✅ StakingPool: ${stakingPool.address}\n`);

    // Deploy CrapsGame
    console.log("📦 Deploying CrapsGame...");
    const crapsGame = await viem.deployContract("CrapsGame", [
      VRF_COORDINATOR_ADDRESS,
      VRF_KEY_HASH,
      VRF_SUBSCRIPTION_ID
    ]);
    deployedContracts.CrapsGame = crapsGame.address;
    console.log(`✅ CrapsGame: ${crapsGame.address}`);
    console.log(`   ⚠️ Add to VRF subscription!\n`);

    // Deploy CrapsBets
    console.log("📦 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets", [crapsGame.address]);
    deployedContracts.CrapsBets = crapsBets.address;
    console.log(`✅ CrapsBets: ${crapsBets.address}\n`);

    // Deploy CrapsSettlement (too large for mainnet but ok for testnet)
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
    console.log("🤖 Initializing bots...");
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
      TREASURY_ADDRESS,
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
    console.log(`✅ All vaults deployed\n`);

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
      
      deployedContracts[`BotVault_${i}_${BOT_NAMES[i].replace(' ', '_')}`] = vaultAddress;
      console.log(`   Bot ${i}: ${vaultAddress}`);
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
    console.log(`   ⚠️ Add to VRF subscription!\n`);

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

    // Setup permissions
    console.log("🔐 Setting up permissions...");
    
    // Grant TREASURY_ROLE to Treasury on StakingPool
    const TREASURY_ROLE = "0x3b4224c08723d5384e8a27b28ba1c2e94c29a37e5e96cbdca693ae3f81db4f06";
    const grantTreasuryRoleTx = await walletClient.writeContract({
      address: stakingPool.address as `0x${string}`,
      abi: [{
        name: "grantRole",
        type: "function",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" }
        ],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "grantRole",
      args: [TREASURY_ROLE, TREASURY_ADDRESS as `0x${string}`]
    });
    await publicClient.waitForTransactionReceipt({ hash: grantTreasuryRoleTx });
    console.log("✅ Treasury role granted");

    // Grant MINTER_ROLE to ArtRedemptionService
    const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    const grantMinterRoleTx = await walletClient.writeContract({
      address: barelyHumanArt.address as `0x${string}`,
      abi: [{
        name: "grantRole",
        type: "function",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" }
        ],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "grantRole",
      args: [MINTER_ROLE, artRedemptionService.address as `0x${string}`]
    });
    await publicClient.waitForTransactionReceipt({ hash: grantMinterRoleTx });
    console.log("✅ Minter role granted\n");

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
    
    console.log("📋 Main Contracts:");
    console.log("────────────────");
    console.log(`BOTToken: ${BOT_TOKEN_ADDRESS}`);
    console.log(`Treasury: ${TREASURY_ADDRESS}`);
    console.log(`StakingPool: ${stakingPool.address}`);
    console.log(`CrapsGame: ${crapsGame.address}`);
    console.log(`VaultFactory: ${vaultFactory.address}`);
    console.log(`GachaMintPass: ${gachaMintPass.address}`);
    console.log(`BarelyHumanArt: ${barelyHumanArt.address}`);

    console.log("\n⚠️ ADD TO VRF SUBSCRIPTION:");
    console.log(`1. CrapsGame: ${crapsGame.address}`);
    console.log(`2. GachaMintPass: ${gachaMintPass.address}`);
    console.log(`\n📍 https://vrf.chain.link/base-sepolia`);

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Gas used: ${formatEther(balance - finalBalance)} ETH`);
    console.log(`💰 Remaining: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    
    // Save partial deployment
    const partialDeploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-partial.json");
    fs.writeFileSync(partialDeploymentFile, JSON.stringify({
      ...deployedContracts,
      error: String(error),
      timestamp: new Date().toISOString()
    }, null, 2));
    
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