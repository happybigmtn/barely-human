// Fix Permissions and Deploy Vaults Properly
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const BOT_MANAGER_ADDRESS = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";
const CRAPS_GAME_ADDRESS = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a"; // From context

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
  console.log("🔧 Fixing permissions and deploying vaults...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH\n`);

  try {
    // Step 1: Grant DEPLOYER_ROLE
    console.log("🔐 Step 1: Granting DEPLOYER_ROLE...");
    try {
      const deployerRoleHash = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
      const grantRoleTx = await walletClient.writeContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
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
        args: [deployerRoleHash, account.address],
        gas: 100000n
      });
      
      await publicClient.waitForTransactionReceipt({ hash: grantRoleTx });
      console.log(`   ✅ DEPLOYER_ROLE granted! Hash: ${grantRoleTx}\n`);
      
    } catch (error: any) {
      console.log(`   ⚠️ Role grant failed (may already have role): ${error.message?.substring(0, 100)}\n`);
    }

    // Step 2: Set Game Address
    console.log("🎮 Step 2: Setting Game Address...");
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
      console.log(`   ✅ Game address set! Hash: ${setGameTx}\n`);
      
    } catch (error: any) {
      console.log(`   ⚠️ Set game address failed (may already be set): ${error.message?.substring(0, 100)}\n`);
    }

    // Step 3: Verify permissions
    console.log("🔍 Step 3: Verifying permissions...");
    const deployerRoleHash = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    const hasDeployerRole = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "hasRole",
        type: "function",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" }
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view"
      }],
      functionName: "hasRole",
      args: [deployerRoleHash, account.address]
    }) as boolean;
    
    console.log(`   DEPLOYER_ROLE: ${hasDeployerRole ? '✅' : '❌'}`);
    
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
    
    console.log(`   Game Address: ${gameAddress === CRAPS_GAME_ADDRESS ? '✅' : '❌'} ${gameAddress}\n`);

    if (!hasDeployerRole) {
      console.log("❌ DEPLOYER_ROLE not granted. Cannot proceed with deployment.");
      return;
    }

    // Step 4: Deploy vaults individually
    console.log("📦 Step 4: Deploying vaults individually...");
    const deployedVaults: { [key: number]: string } = {};
    let successCount = 0;
    
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
          successCount++;
          continue;
        }
        
        console.log(`   Deploying vault ${i} (${BOT_NAMES[i]})...`);
        
        // First simulate to make sure it will work
        const simulation = await publicClient.simulateContract({
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
          account: account.address
        });
        
        console.log(`      Simulation result: ${simulation.result}`);
        
        // Now execute the actual transaction
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
        
        // Wait for state to update and read the vault address
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
          args: [i]
        }) as string;
        
        if (newVaultAddress && newVaultAddress !== "0x0000000000000000000000000000000000000000") {
          deployedVaults[i] = newVaultAddress;
          successCount++;
          console.log(`   ✅ Vault ${i} deployed: ${newVaultAddress}`);
          console.log(`      Gas used: ${receipt.gasUsed}`);
        } else {
          console.log(`   ❌ Vault ${i} deployment failed - address still zero`);
          console.log(`      Transaction succeeded but vault not found in mapping`);
        }
        
      } catch (error: any) {
        console.log(`   ❌ Vault ${i} failed: ${error.message?.substring(0, 200)}`);
      }
      
      // Small delay between deployments
      await sleep(1000);
    }

    // Step 5: Final verification
    console.log("\n📊 Step 5: Final verification...");
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

    // Get all vault addresses from the factory
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
      allVaults.forEach((vault, index) => {
        console.log(`      ${index}: ${vault}`);
      });
    } catch (error) {
      console.log("   ❌ Failed to read allVaults array");
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🎉 VAULT DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    console.log(`📊 Final Status: ${successCount}/10 vaults deployed`);
    
    if (successCount === 10) {
      console.log("✅ ALL VAULTS SUCCESSFULLY DEPLOYED!");
    } else if (successCount > 0) {
      console.log(`⚠️ Partial success: ${successCount} vaults deployed`);
    } else {
      console.log("❌ No vaults deployed");
    }

    console.log("\n📋 Final Vault Addresses:");
    Object.entries(deployedVaults).forEach(([botId, address]) => {
      console.log(`   ${BOT_NAMES[parseInt(botId)]}: ${address}`);
    });

    // Show addresses that can be used for next steps
    if (successCount > 0) {
      console.log("\n📝 Vault Addresses for JSON:");
      console.log("{");
      Object.entries(deployedVaults).forEach(([botId, address], index, array) => {
        const comma = index < array.length - 1 ? "," : "";
        console.log(`  "BotVault_${botId}": "${address}"${comma}`);
      });
      console.log("}");
    }

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