// Final Base Sepolia Deployment - Continue from CrapsBets
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
const CRAPS_BETS_ADDRESS = "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb";

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
  console.log("🚀 Final deployment continuation...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await viem.getPublicClient().then(c => c.getBalance({ address: account.address })))} ETH\n`);

  console.log("✅ Already deployed:");
  console.log(`   BOT Token: ${BOT_TOKEN_ADDRESS}`);
  console.log(`   Treasury: ${TREASURY_ADDRESS}`);
  console.log(`   StakingPool: ${STAKING_POOL_ADDRESS}`);
  console.log(`   CrapsGame: ${CRAPS_GAME_ADDRESS}`);
  console.log(`   CrapsBets: ${CRAPS_BETS_ADDRESS}\n`);

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const deployedContracts: any = {
    BOTToken: BOT_TOKEN_ADDRESS,
    Treasury: TREASURY_ADDRESS,
    StakingPool: STAKING_POOL_ADDRESS,
    CrapsGame: CRAPS_GAME_ADDRESS,
    CrapsBets: CRAPS_BETS_ADDRESS
  };

  try {
    // Deploy CrapsSettlementSimple instead of full version
    console.log("📦 Deploying CrapsSettlementSimple (minimal version)...");
    const crapsSettlement = await viem.deployContract("CrapsSettlementSimple");
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
    console.log(`✅ All vaults deployed\n`);

    // Get vault addresses
    console.log("📋 Bot Vaults:");
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
      console.log(`   ${BOT_NAMES[i]}: ${vaultAddress}`);
    }

    // Deploy NFT contracts
    const TEMP_SUB_ID = 1n;
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

    // Save deployment info
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID,
      contracts: deployedContracts
    };

    const deploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 All Contracts:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_")) {
        console.log(`${name}: ${address}`);
      }
    });

    console.log("\n⚠️ ADD TO VRF SUBSCRIPTION:");
    console.log(`- CrapsGame: ${CRAPS_GAME_ADDRESS}`);
    console.log(`- GachaMintPass: ${gachaMintPass.address}`);
    console.log(`\nGo to: https://vrf.chain.link/base-sepolia`);

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Remaining: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Error:", error);
    
    const partialFile = path.join(process.cwd(), "deployment", "base-sepolia-partial.json");
    fs.writeFileSync(partialFile, JSON.stringify({
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