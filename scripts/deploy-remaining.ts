// Deploy Remaining Contracts to Base Sepolia
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
const CRAPS_SETTLEMENT_ADDRESS = "0xe156b261025e74a19b298c9d94260c744ae85d7f";

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
  console.log("🚀 Deploying remaining contracts to Base Sepolia...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await viem.getPublicClient().then(c => c.getBalance({ address: account.address })))} ETH\n`);

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const deployedContracts: any = {
    BOTToken: BOT_TOKEN_ADDRESS,
    Treasury: TREASURY_ADDRESS,
    StakingPool: STAKING_POOL_ADDRESS,
    CrapsGame: CRAPS_GAME_ADDRESS,
    CrapsBets: CRAPS_BETS_ADDRESS,
    CrapsSettlement: CRAPS_SETTLEMENT_ADDRESS
  };

  try {
    // Deploy VaultFactoryMinimal
    console.log("📦 Deploying VaultFactoryMinimal...");
    const vaultFactory = await viem.deployContract("VaultFactoryMinimal", [
      BOT_TOKEN_ADDRESS,
      TREASURY_ADDRESS
    ]);
    deployedContracts.VaultFactory = vaultFactory.address;
    console.log(`✅ VaultFactory: ${vaultFactory.address}\n`);

    // Deploy BotManager
    console.log("📦 Deploying BotManager...");
    const tempSubId = 1n; // Temporary subscription ID
    const botManager = await viem.deployContract("BotManager", [
      vaultFactory.address,
      VRF_COORDINATOR_ADDRESS,
      tempSubId,
      VRF_KEY_HASH
    ]);
    deployedContracts.BotManager = botManager.address;
    console.log(`✅ BotManager: ${botManager.address}\n`);

    // Set BotManager in VaultFactory
    console.log("🔧 Setting BotManager in VaultFactory...");
    const setBotManagerTx = await walletClient.writeContract({
      address: vaultFactory.address as `0x${string}`,
      abi: [{
        name: "setBotManager",
        type: "function",
        inputs: [{ name: "_botManager", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "setBotManager",
      args: [botManager.address]
    });
    await publicClient.waitForTransactionReceipt({ hash: setBotManagerTx });
    console.log(`✅ BotManager set\n`);

    // Set Game Address in VaultFactory
    console.log("🔧 Setting Game Address in VaultFactory...");
    const setGameTx = await walletClient.writeContract({
      address: vaultFactory.address as `0x${string}`,
      abi: [{
        name: "setGameAddress",
        type: "function",
        inputs: [{ name: "_gameAddress", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable"
      }],
      functionName: "setGameAddress",
      args: [CRAPS_GAME_ADDRESS]
    });
    await publicClient.waitForTransactionReceipt({ hash: setGameTx });
    console.log(`✅ Game address set\n`);

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
      const vaultAddress = await publicClient.readContract({
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
      }) as string;
      
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

    // Deploy Escrow
    console.log("📦 Deploying BotBettingEscrow...");
    const botBettingEscrow = await viem.deployContract("BotBettingEscrow", [
      BOT_TOKEN_ADDRESS,
      vaultFactory.address
    ]);
    deployedContracts.BotBettingEscrow = botBettingEscrow.address;
    console.log(`✅ BotBettingEscrow: ${botBettingEscrow.address}\n`);

    // Save deployment info
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID,
      status: "COMPLETE",
      contracts: deployedContracts
    };

    const deploymentDir = path.join(process.cwd(), "deployment");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentDir, "base-sepolia-complete.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 All Contracts Deployed:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_")) {
        console.log(`${name}: ${address}`);
      }
    });

    console.log("\n⚠️ IMPORTANT - ADD TO VRF SUBSCRIPTION:");
    console.log(`✅ CrapsGame: ${CRAPS_GAME_ADDRESS} (Already added)`);
    console.log(`- GachaMintPass: ${gachaMintPass.address}`);
    console.log(`- BotManager: ${botManager.address}`);
    console.log(`\n📝 VRF Subscription ID: ${VRF_SUBSCRIPTION_ID}`);
    console.log(`🔗 Go to: https://vrf.chain.link/base-sepolia`);

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Remaining Balance: ${formatEther(finalBalance)} ETH`);

    console.log("\n✅ Next Steps:");
    console.log("1. Add GachaMintPass and BotManager as VRF consumers");
    console.log("2. Verify contracts on BaseScan");
    console.log("3. Fund bot vaults with BOT tokens");
    console.log("4. Set up contract roles and permissions");
    console.log("5. Initialize game and start playing!");

  } catch (error) {
    console.error("❌ Error:", error);
    
    const partialFile = path.join(process.cwd(), "deployment", "base-sepolia-partial-2.json");
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