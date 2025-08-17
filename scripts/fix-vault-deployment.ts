// Fix VaultFactory Deployment Issue on Base Sepolia
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
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
  console.log("🔧 Fixing VaultFactory deployment issue...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH\n`);

  try {
    // Step 1: Initialize BotManager if not already done
    console.log("🤖 Step 1: Initializing BotManager...");
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
        gas: 1000000n
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: initTx });
      console.log(`   ✅ BotManager initialized! Hash: ${initTx}`);
      console.log(`   Gas used: ${receipt.gasUsed}\n`);
      
      // Wait a bit for state to settle
      await sleep(2000);
      
    } catch (error: any) {
      console.log(`   ⚠️ BotManager initialization failed (may already be done): ${error.message?.substring(0, 100)}\n`);
    }

    // Step 2: Verify BotManager initialization
    console.log("🧮 Step 2: Verifying BotManager initialization...");
    for (let i = 0; i < 3; i++) {
      try {
        const personality = await publicClient.readContract({
          address: BOT_MANAGER_ADDRESS as `0x${string}`,
          abi: [{
            name: "getPersonality",
            type: "function",
            inputs: [{ name: "botId", type: "uint8" }],
            outputs: [
              { name: "name", type: "string" },
              { name: "riskLevel", type: "uint8" },
              { name: "bettingStyle", type: "uint8" },
              { name: "personality", type: "uint8" },
              { name: "isActive", type: "bool" }
            ],
            stateMutability: "view"
          }],
          functionName: "getPersonality",
          args: [i]
        }) as any[];
        
        console.log(`   Bot ${i}: ${personality[0]} (Active: ${personality[4]})`);
        
        if (!personality[4]) {
          console.log(`   ⚠️ Bot ${i} is not active! This will cause vault deployment to fail.`);
        }
      } catch (error) {
        console.log(`   ❌ Bot ${i}: Failed to read personality`);
      }
    }

    // Step 3: Deploy vaults individually
    console.log("\n📦 Step 3: Deploying vaults individually...");
    const deployedVaults: { [key: number]: string } = {};
    
    for (let i = 0; i < 10; i++) {
      try {
        // Check if vault already exists
        const existingVault = await publicClient.readContract({
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
        
        if (existingVault && existingVault !== "0x0000000000000000000000000000000000000000") {
          console.log(`   ✅ Vault ${i} (${BOT_NAMES[i]}) already exists: ${existingVault}`);
          deployedVaults[i] = existingVault;
          continue;
        }
        
        console.log(`   Deploying vault ${i} (${BOT_NAMES[i]})...`);
        
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
          gas: 800000n
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: deployVaultTx });
        
        // Read the vault address again
        await sleep(1000); // Wait for state to update
        const newVaultAddress = await publicClient.readContract({
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
        
        if (newVaultAddress && newVaultAddress !== "0x0000000000000000000000000000000000000000") {
          deployedVaults[i] = newVaultAddress;
          console.log(`   ✅ Vault ${i} deployed: ${newVaultAddress}`);
          console.log(`   Gas used: ${receipt.gasUsed}`);
        } else {
          console.log(`   ❌ Vault ${i} deployment failed - address is zero`);
        }
        
      } catch (error: any) {
        console.log(`   ❌ Vault ${i} failed: ${error.message?.substring(0, 200)}`);
        
        // Try to get more specific error info
        if (error.message.includes("execution reverted")) {
          console.log(`      This suggests a revert condition in the contract`);
        }
      }
      
      // Small delay between deployments
      await sleep(1000);
    }

    // Step 4: Final verification
    console.log("\n📊 Step 4: Final verification...");
    const finalVaultCount = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "getVaultCount",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view"
      }],
      functionName: "getVaultCount"
    }) as bigint;
    
    console.log(`   Total vaults in factory: ${finalVaultCount.toString()}`);
    console.log(`   Vaults deployed this session: ${Object.keys(deployedVaults).length}`);

    // Get all vault addresses
    try {
      const allVaults = await publicClient.readContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "getAllVaults",
          type: "function",
          inputs: [],
          outputs: [{ name: "", type: "address[]" }],
          stateMutability: "view"
        }],
        functionName: "getAllVaults"
      }) as string[];
      
      console.log("\n📋 All deployed vaults:");
      allVaults.forEach((vault, index) => {
        console.log(`   ${index}: ${vault}`);
      });
    } catch (error) {
      console.log("   ❌ Failed to read allVaults array");
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🎉 VAULT DEPLOYMENT FIX COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    const successCount = Object.keys(deployedVaults).length;
    console.log(`📊 Status: ${successCount}/10 vaults deployed`);
    
    if (successCount === 10) {
      console.log("✅ All vaults successfully deployed!");
    } else if (successCount > 0) {
      console.log(`⚠️ Partial success: ${successCount} vaults deployed, ${10 - successCount} failed`);
    } else {
      console.log("❌ No vaults deployed - check BotManager initialization");
    }

    console.log("\n📋 Deployed Vault Addresses:");
    Object.entries(deployedVaults).forEach(([botId, address]) => {
      console.log(`   ${BOT_NAMES[parseInt(botId)]}: ${address}`);
    });

  } catch (error) {
    console.error("❌ Fix script failed:", error);
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