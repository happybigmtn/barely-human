// Continue Base Sepolia Final Deployment
import { network } from "hardhat";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VRF_SUBSCRIPTION_ID = "22376417694825733668962562671731634456669048679979758256841549539628619732572";
const VRF_COORDINATOR_ADDRESS = process.env.VRF_COORDINATOR_ADDRESS!;
const VRF_KEY_HASH = process.env.VRF_KEY_HASH! as `0x${string}`;

// Already deployed  
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const TREASURY_ADDRESS = "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a";
const STAKING_POOL_ADDRESS = "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2";
const CRAPS_GAME_ADDRESS = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";

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
  console.log("🚀 Continuing final deployment...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`✅ BOT Token: ${BOT_TOKEN_ADDRESS}`);
  console.log(`✅ Treasury: ${TREASURY_ADDRESS}`);
  console.log(`✅ StakingPool: ${STAKING_POOL_ADDRESS}`);
  console.log(`✅ CrapsGame: ${CRAPS_GAME_ADDRESS}\n`);

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);

  const deployedContracts: any = {
    BOTToken: BOT_TOKEN_ADDRESS,
    Treasury: TREASURY_ADDRESS,
    StakingPool: STAKING_POOL_ADDRESS,
    CrapsGame: CRAPS_GAME_ADDRESS
  };

  try {
    // Deploy CrapsBets (no constructor args)
    console.log("📦 Deploying CrapsBets...");
    const crapsBets = await viem.deployContract("CrapsBets");
    deployedContracts.CrapsBets = crapsBets.address;
    console.log(`✅ CrapsBets: ${crapsBets.address}\n`);

    // Deploy CrapsSettlement (no constructor args)
    console.log("📦 Deploying CrapsSettlement...");
    const crapsSettlement = await viem.deployContract("CrapsSettlement");
    deployedContracts.CrapsSettlement = crapsSettlement.address;
    console.log(`✅ CrapsSettlement: ${crapsSettlement.address}\n`);

    // Deploy BotManager (no constructor args)
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
      CRAPS_GAME_ADDRESS,
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
    console.log(`✅ All bot vaults deployed\n`);

    // Get vault addresses
    console.log("📋 Bot Vault Addresses:");
    const vaultAddresses = [];
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
      
      vaultAddresses.push(vaultAddress);
      deployedContracts[`BotVault_${i}`] = vaultAddress;
      console.log(`   Bot ${i} (${BOT_NAMES[i]}): ${vaultAddress}`);
    }

    // Deploy NFT contracts with temporary subscription ID
    const TEMP_SUB_ID = 1n; // Will need to be updated
    console.log("\n📦 Deploying GachaMintPass...");
    const gachaMintPass = await viem.deployContract("GachaMintPass", [
      VRF_COORDINATOR_ADDRESS,
      TEMP_SUB_ID,
      VRF_KEY_HASH,
      CRAPS_GAME_ADDRESS
    ]);
    deployedContracts.GachaMintPass = gachaMintPass.address;
    console.log(`✅ GachaMintPass: ${gachaMintPass.address}\n`);

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
    
    // Grant TREASURY_ROLE
    const TREASURY_ROLE = "0x3b4224c08723d5384e8a27b28ba1c2e94c29a37e5e96cbdca693ae3f81db4f06";
    const grantTreasuryRoleTx = await walletClient.writeContract({
      address: STAKING_POOL_ADDRESS as `0x${string}`,
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

    // Grant MINTER_ROLE
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
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID,
      contracts: deployedContracts,
      vaultMapping: BOT_NAMES.reduce((acc, name, i) => {
        acc[name] = vaultAddresses[i];
        return acc;
      }, {} as any)
    };

    const deploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 All Deployed Contracts:");
    console.log("─────────────────────────");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_")) {
        console.log(`${name}: ${address}`);
      }
    });

    console.log("\n⚠️ IMPORTANT NEXT STEPS:");
    console.log("════════════════════════");
    console.log("1. Add these contracts as VRF consumers:");
    console.log(`   - CrapsGame: ${CRAPS_GAME_ADDRESS}`);
    console.log(`   - GachaMintPass: ${gachaMintPass.address}`);
    console.log(`\n   Go to: https://vrf.chain.link/base-sepolia`);
    console.log(`   Subscription ID: ${VRF_SUBSCRIPTION_ID}`);

    console.log("\n2. Note: VRF contracts deployed with temp subscription ID (1)");
    console.log("   May need to update via contract owner functions");

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Total gas used: ${formatEther(balance - finalBalance)} ETH`);
    console.log(`💰 Remaining: ${formatEther(finalBalance)} ETH`);

    console.log("\n📍 View on BaseScan:");
    console.log(`https://sepolia.basescan.org/address/${account.address}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    
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