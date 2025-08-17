// Configure VaultFactory and Deploy Remaining Contracts
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VRF_SUBSCRIPTION_ID = "22376417694825733668962562671731634456669048679979758256841549539628619732572";
const VRF_COORDINATOR_ADDRESS = process.env.VRF_COORDINATOR_ADDRESS!;
const VRF_KEY_HASH = process.env.VRF_KEY_HASH! as `0x${string}`;

// Already deployed contracts
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const TREASURY_ADDRESS = "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a";
const CRAPS_GAME_ADDRESS = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const BOT_MANAGER_ADDRESS = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🔧 Configuring VaultFactory and deploying remaining contracts...\n");

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
    CrapsGame: CRAPS_GAME_ADDRESS,
    VaultFactory: VAULT_FACTORY_ADDRESS,
    BotManager: BOT_MANAGER_ADDRESS
  };

  try {
    // Step 1: Configure VaultFactory - Set BotManager
    console.log("🔧 Setting BotManager in VaultFactory...");
    try {
      const setBotManagerTx = await walletClient.writeContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "setBotManager",
          type: "function",
          inputs: [{ name: "_botManager", type: "address" }],
          outputs: [],
          stateMutability: "nonpayable"
        }],
        functionName: "setBotManager",
        args: [BOT_MANAGER_ADDRESS],
        gas: 100000n
      });
      await publicClient.waitForTransactionReceipt({ hash: setBotManagerTx });
      console.log(`✅ BotManager set\n`);
    } catch (error: any) {
      console.log(`⚠️ Failed to set BotManager: ${error.message?.substring(0, 100)}\n`);
      console.log("Retrying with delay...\n");
      await sleep(3000);
      
      // Retry once
      try {
        const setBotManagerTx = await walletClient.writeContract({
          address: VAULT_FACTORY_ADDRESS as `0x${string}`,
          abi: [{
            name: "setBotManager",
            type: "function",
            inputs: [{ name: "_botManager", type: "address" }],
            outputs: [],
            stateMutability: "nonpayable"
          }],
          functionName: "setBotManager",
          args: [BOT_MANAGER_ADDRESS],
          gas: 150000n,
          maxFeePerGas: parseEther("0.000000002"),
          maxPriorityFeePerGas: parseEther("0.000000001")
        });
        await publicClient.waitForTransactionReceipt({ hash: setBotManagerTx });
        console.log(`✅ BotManager set (retry successful)\n`);
      } catch (retryError) {
        console.log(`❌ Could not set BotManager. May already be set or need manual configuration.\n`);
      }
    }

    // Step 2: Set Game Address
    console.log("🔧 Setting Game Address in VaultFactory...");
    try {
      const setGameTx = await walletClient.writeContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "setGameAddress",
          type: "function",
          inputs: [{ name: "_gameAddress", type: "address" }],
          outputs: [],
          stateMutability: "nonpayable"
        }],
        functionName: "setGameAddress",
        args: [CRAPS_GAME_ADDRESS],
        gas: 100000n
      });
      await publicClient.waitForTransactionReceipt({ hash: setGameTx });
      console.log(`✅ Game address set\n`);
    } catch (error: any) {
      console.log(`⚠️ Failed to set Game Address: ${error.message?.substring(0, 100)}\n`);
    }

    // Step 3: Initialize Bots in BotManager
    console.log("🤖 Initializing bots in BotManager...");
    try {
      const initTx = await walletClient.writeContract({
        address: BOT_MANAGER_ADDRESS as `0x${string}`,
        abi: [{
          name: "initializeBots",
          type: "function",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        }],
        functionName: "initializeBots",
        args: [],
        gas: 500000n
      });
      await publicClient.waitForTransactionReceipt({ hash: initTx });
      console.log(`✅ Bots initialized\n`);
    } catch (error: any) {
      console.log(`⚠️ Bots may already be initialized: ${error.message?.substring(0, 100)}\n`);
    }

    // Step 4: Deploy all bot vaults
    console.log("📦 Deploying 10 Bot Vaults...");
    try {
      const deployAllBotsTx = await walletClient.writeContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "deployAllBots",
          type: "function",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        }],
        functionName: "deployAllBots",
        args: [],
        gas: 3000000n
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployAllBotsTx });
      console.log(`✅ All vaults deployed (Gas used: ${receipt.gasUsed})\n`);
    } catch (error: any) {
      console.log(`⚠️ Could not deploy all vaults at once. Trying individual deployment...\n`);
      
      // Try deploying individually
      for (let i = 0; i < 10; i++) {
        try {
          console.log(`  Deploying vault ${i}...`);
          const deployVaultTx = await walletClient.writeContract({
            address: VAULT_FACTORY_ADDRESS as `0x${string}`,
            abi: [{
              name: "deployVault",
              type: "function",
              inputs: [{ name: "botId", type: "uint256" }],
              outputs: [{ name: "", type: "address" }],
              stateMutability: "nonpayable"
            }],
            functionName: "deployVault",
            args: [BigInt(i)],
            gas: 500000n
          });
          await publicClient.waitForTransactionReceipt({ hash: deployVaultTx });
          console.log(`  ✅ Vault ${i} deployed`);
        } catch (vaultError: any) {
          console.log(`  ⚠️ Vault ${i} failed: ${vaultError.message?.substring(0, 50)}`);
        }
      }
    }

    // Step 5: Get vault addresses
    console.log("\n📋 Reading Bot Vault Addresses:");
    for (let i = 0; i < 10; i++) {
      try {
        const vaultAddress = await publicClient.readContract({
          address: VAULT_FACTORY_ADDRESS as `0x${string}`,
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
        
        if (vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
          deployedContracts[`BotVault_${i}`] = vaultAddress;
          console.log(`   ${BOT_NAMES[i]}: ${vaultAddress}`);
        } else {
          console.log(`   ${BOT_NAMES[i]}: Not deployed`);
        }
      } catch (error) {
        console.log(`   ${BOT_NAMES[i]}: Error reading address`);
      }
    }

    // Step 6: Deploy NFT contracts
    const TEMP_SUB_ID = 1n;
    console.log("\n📦 Deploying NFT Contracts...");
    
    try {
      console.log("  Deploying GachaMintPass...");
      const gachaMintPass = await viem.deployContract("GachaMintPass", [
        VRF_COORDINATOR_ADDRESS,
        TEMP_SUB_ID,
        VRF_KEY_HASH,
        CRAPS_GAME_ADDRESS
      ]);
      deployedContracts.GachaMintPass = gachaMintPass.address;
      console.log(`  ✅ GachaMintPass: ${gachaMintPass.address}`);
    } catch (error: any) {
      console.log(`  ❌ GachaMintPass failed: ${error.message?.substring(0, 100)}`);
    }

    try {
      console.log("  Deploying BarelyHumanArt...");
      const barelyHumanArt = await viem.deployContract("BarelyHumanArt", [
        "Barely Human Art",
        "BHA",
        "https://api.barelyhuman.xyz/art/"
      ]);
      deployedContracts.BarelyHumanArt = barelyHumanArt.address;
      console.log(`  ✅ BarelyHumanArt: ${barelyHumanArt.address}`);
    } catch (error: any) {
      console.log(`  ❌ BarelyHumanArt failed: ${error.message?.substring(0, 100)}`);
    }

    // Deploy ArtRedemptionService only if both NFT contracts exist
    if (deployedContracts.GachaMintPass && deployedContracts.BarelyHumanArt) {
      try {
        console.log("  Deploying ArtRedemptionService...");
        const artRedemptionService = await viem.deployContract("ArtRedemptionService", [
          deployedContracts.GachaMintPass,
          deployedContracts.BarelyHumanArt
        ]);
        deployedContracts.ArtRedemptionService = artRedemptionService.address;
        console.log(`  ✅ ArtRedemptionService: ${artRedemptionService.address}`);
      } catch (error: any) {
        console.log(`  ❌ ArtRedemptionService failed: ${error.message?.substring(0, 100)}`);
      }
    }

    // Step 7: Deploy BotBettingEscrow
    try {
      console.log("\n📦 Deploying BotBettingEscrow...");
      const botBettingEscrow = await viem.deployContract("BotBettingEscrow", [
        BOT_TOKEN_ADDRESS,
        VAULT_FACTORY_ADDRESS
      ]);
      deployedContracts.BotBettingEscrow = botBettingEscrow.address;
      console.log(`✅ BotBettingEscrow: ${botBettingEscrow.address}\n`);
    } catch (error: any) {
      console.log(`❌ BotBettingEscrow failed: ${error.message?.substring(0, 100)}\n`);
    }

    // Save deployment info
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID,
      status: "FINAL",
      contracts: deployedContracts,
      notes: {
        vrfConsumersToAdd: [
          deployedContracts.BotManager,
          deployedContracts.GachaMintPass
        ].filter(Boolean),
        nextSteps: [
          "Add BotManager and GachaMintPass as VRF consumers",
          "Verify contracts on BaseScan",
          "Fund bot vaults with BOT tokens",
          "Initialize game permissions"
        ]
      }
    };

    const deploymentDir = path.join(process.cwd(), "deployment");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentDir, "base-sepolia-final.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    // Count deployed contracts
    const deployedCount = Object.keys(deployedContracts).filter(k => !k.startsWith("BotVault_")).length;
    const vaultCount = Object.keys(deployedContracts).filter(k => k.startsWith("BotVault_")).length;
    
    console.log(`📊 Deployment Statistics:`);
    console.log(`   Core Contracts: ${deployedCount}`);
    console.log(`   Bot Vaults: ${vaultCount}/10`);
    console.log(`   Total: ${deployedCount + vaultCount}\n`);
    
    console.log("📋 Deployed Contracts:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      if (!name.startsWith("BotVault_") && address) {
        console.log(`   ${name}: ${address}`);
      }
    });

    if (deployedContracts.GachaMintPass || deployedContracts.BotManager) {
      console.log("\n⚠️ ADD TO VRF SUBSCRIPTION:");
      if (deployedContracts.BotManager) {
        console.log(`   - BotManager: ${deployedContracts.BotManager}`);
      }
      if (deployedContracts.GachaMintPass) {
        console.log(`   - GachaMintPass: ${deployedContracts.GachaMintPass}`);
      }
      console.log(`\n📝 VRF Subscription: https://vrf.chain.link/base-sepolia`);
    }

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Remaining Balance: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Unexpected error:", error);
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