// Comprehensive Fix for Vault Deployment Issues
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🔧 Comprehensive vault deployment fix...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH\n`);

  try {
    // Step 1: Check all factory configuration
    console.log("🔍 Step 1: Complete Factory Analysis...");
    
    const botManager = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "botManager",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view"
      }],
      functionName: "botManager"
    }) as string;
    
    const gameAddress = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "gameAddress",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view"
      }],
      functionName: "gameAddress"
    }) as string;
    
    const defaultAsset = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "defaultAsset",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view"
      }],
      functionName: "defaultAsset"
    }) as string;
    
    const treasuryAddress = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "treasuryAddress",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view"
      }],
      functionName: "treasuryAddress"
    }) as string;
    
    console.log(`   Bot Manager: ${botManager} ${botManager !== "0x0000000000000000000000000000000000000000" ? '✅' : '❌'}`);
    console.log(`   Game Address: ${gameAddress} ${gameAddress !== "0x0000000000000000000000000000000000000000" ? '✅' : '❌'}`);
    console.log(`   Default Asset: ${defaultAsset} ${defaultAsset !== "0x0000000000000000000000000000000000000000" ? '✅' : '❌'}`);
    console.log(`   Treasury Address: ${treasuryAddress} ${treasuryAddress !== "0x0000000000000000000000000000000000000000" ? '✅' : '❌'}`);

    // Step 2: Set game address if needed (try multiple times)
    if (gameAddress === "0x0000000000000000000000000000000000000000") {
      console.log("\n🎮 Step 2: Setting Game Address (multiple attempts)...");
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/3...`);
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
            gas: 150000n
          });
          
          const receipt = await publicClient.waitForTransactionReceipt({ hash: setGameTx });
          console.log(`   ✅ Game address set! Hash: ${setGameTx}`);
          
          // Wait and verify
          await sleep(3000);
          const newGameAddress = await publicClient.readContract({
            address: VAULT_FACTORY_ADDRESS as `0x${string}`,
            abi: [{
              name: "gameAddress",
              type: "function",
              inputs: [],
              outputs: [{ name: "", type: "address" }],
              stateMutability: "view"
            }],
            functionName: "gameAddress"
          }) as string;
          
          console.log(`   Verification: ${newGameAddress}`);
          if (newGameAddress === CRAPS_GAME_ADDRESS) {
            console.log("   ✅ Game address properly set!");
            break;
          } else {
            console.log(`   ❌ Game address not set correctly (attempt ${attempt})`);
          }
          
        } catch (error: any) {
          console.log(`   ❌ Attempt ${attempt} failed: ${error.message?.substring(0, 100)}`);
        }
        
        if (attempt < 3) await sleep(2000);
      }
    } else {
      console.log("\n✅ Game address already set correctly");
    }

    // Step 3: Alternative deployment approach - use deployAllBots
    console.log("\n📦 Step 3: Using deployAllBots approach...");
    try {
      console.log("   Attempting deployAllBots...");
      const deployAllTx = await walletClient.writeContract({
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
        gas: 8000000n  // Increased gas limit
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployAllTx });
      console.log(`   ✅ deployAllBots completed! Hash: ${deployAllTx}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      
      // Wait for state to update
      await sleep(5000);
      
    } catch (error: any) {
      console.log(`   ❌ deployAllBots failed: ${error.message?.substring(0, 200)}`);
      console.log("   Trying individual deployments...");
    }

    // Step 4: Check vault status
    console.log("\n📊 Step 4: Checking Vault Status...");
    const deployedVaults: { [key: number]: string } = {};
    
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
          deployedVaults[i] = vaultAddress;
          console.log(`   ✅ Vault ${i} (${BOT_NAMES[i]}): ${vaultAddress}`);
        } else {
          console.log(`   ❌ Vault ${i} (${BOT_NAMES[i]}): Not deployed`);
        }
      } catch (error) {
        console.log(`   ❌ Vault ${i} (${BOT_NAMES[i]}): Error reading`);
      }
    }

    // Step 5: Deploy missing vaults individually
    const missingVaults = [];
    for (let i = 0; i < 10; i++) {
      if (!deployedVaults[i]) {
        missingVaults.push(i);
      }
    }

    if (missingVaults.length > 0) {
      console.log(`\n🔧 Step 5: Deploying ${missingVaults.length} missing vaults individually...`);
      
      for (const vaultId of missingVaults) {
        try {
          console.log(`   Deploying vault ${vaultId} (${BOT_NAMES[vaultId]})...`);
          
          // Use higher gas and longer timeout
          const deployTx = await walletClient.writeContract({
            address: VAULT_FACTORY_ADDRESS as `0x${string}`,
            abi: [{
              name: "deployVault",
              type: "function",
              inputs: [{ name: "botId", type: "uint256" }],
              outputs: [{ name: "", type: "address" }],
              stateMutability: "nonpayable"
            }],
            functionName: "deployVault",
            args: [BigInt(vaultId)],
            gas: 1000000n
          });
          
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: deployTx,
            timeout: 60_000  // 60 second timeout
          });
          
          console.log(`   ✅ Vault ${vaultId} deployed! Hash: ${deployTx}`);
          console.log(`   Gas used: ${receipt.gasUsed}`);
          
          // Verify the vault address
          await sleep(2000);
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
            args: [vaultId]
          }) as string;
          
          if (newVaultAddress && newVaultAddress !== "0x0000000000000000000000000000000000000000") {
            deployedVaults[vaultId] = newVaultAddress;
            console.log(`   Verified: ${newVaultAddress}`);
          } else {
            console.log(`   ⚠️ Vault ${vaultId} deployed but address still zero`);
          }
          
        } catch (error: any) {
          console.log(`   ❌ Vault ${vaultId} failed: ${error.message?.substring(0, 150)}`);
        }
        
        // Delay between deployments to avoid rate limits
        await sleep(3000);
      }
    }

    // Final verification
    console.log("\n📊 Final Vault Count Check:");
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
      
      console.log(`   Vaults in allVaults array: ${allVaults.length}`);
    } catch (error) {
      console.log("   ❌ Failed to read allVaults array");
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🎉 COMPREHENSIVE VAULT FIX COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    const successCount = Object.keys(deployedVaults).length;
    console.log(`📊 Status: ${successCount}/10 vaults deployed`);
    
    if (successCount === 10) {
      console.log("✅ ALL VAULTS SUCCESSFULLY DEPLOYED!");
    } else if (successCount > 0) {
      console.log(`⚠️ Partial success: ${successCount} vaults deployed`);
    } else {
      console.log("❌ No vaults deployed - check logs for issues");
    }

    if (successCount > 0) {
      console.log("\n📋 Deployed Vault Addresses:");
      Object.entries(deployedVaults).forEach(([botId, address]) => {
        console.log(`   ${BOT_NAMES[parseInt(botId)]}: ${address}`);
      });
    }

  } catch (error) {
    console.error("❌ Comprehensive fix failed:", error);
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