// Investigate VaultFactory Deployment Issue on Base Sepolia
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

async function main() {
  console.log("🔍 Investigating VaultFactory deployment issue...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();

  try {
    // Step 1: Check if BotManager is set in VaultFactory
    console.log("🔧 Checking VaultFactory configuration...");
    try {
      const botManagerInFactory = await publicClient.readContract({
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
      
      console.log(`   BotManager in Factory: ${botManagerInFactory}`);
      console.log(`   Expected BotManager: ${BOT_MANAGER_ADDRESS}`);
      console.log(`   ✅ BotManager is ${botManagerInFactory === BOT_MANAGER_ADDRESS ? 'correctly set' : 'NOT SET or WRONG'}\n`);
    } catch (error) {
      console.log(`   ❌ Failed to read BotManager: ${error}\n`);
    }

    // Step 2: Check vault count
    console.log("📊 Checking vault deployment status...");
    try {
      const vaultCount = await publicClient.readContract({
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
      
      console.log(`   Total vaults deployed: ${vaultCount.toString()}`);
    } catch (error) {
      console.log(`   ❌ Failed to read vault count: ${error}`);
    }

    // Step 3: Check individual vault addresses
    console.log("\n📋 Checking individual bot vault addresses:");
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
        
        const isDeployed = vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000";
        
        if (isDeployed) {
          deployedVaults[i] = vaultAddress;
          console.log(`   ✅ ${BOT_NAMES[i]} (${i}): ${vaultAddress}`);
        } else {
          console.log(`   ❌ ${BOT_NAMES[i]} (${i}): Not deployed`);
        }
      } catch (error) {
        console.log(`   ❌ ${BOT_NAMES[i]} (${i}): Error reading - ${error}`);
      }
    }

    // Step 4: Check nextBotId
    console.log("\n🔢 Checking nextBotId:");
    try {
      const nextBotId = await publicClient.readContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "nextBotId",
          type: "function",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view"
        }],
        functionName: "nextBotId"
      }) as bigint;
      
      console.log(`   Next Bot ID: ${nextBotId.toString()}`);
    } catch (error) {
      console.log(`   ❌ Failed to read nextBotId: ${error}`);
    }

    // Step 5: Check all vaults array
    console.log("\n📋 Checking allVaults array:");
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
      
      console.log(`   Total vaults in array: ${allVaults.length}`);
      allVaults.forEach((vault, index) => {
        console.log(`   Vault ${index}: ${vault}`);
      });
    } catch (error) {
      console.log(`   ❌ Failed to read allVaults: ${error}`);
    }

    // Step 6: Test individual deployment (dry run)
    console.log("\n🧪 Testing individual vault deployment (one vault as test):");
    const [walletClient] = await viem.getWalletClients();
    
    // Try to deploy vault 0 if not already deployed
    if (!deployedVaults[0]) {
      try {
        console.log("   Attempting to deploy vault 0...");
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
          args: [BigInt(0)],
          gas: 500000n
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: deployVaultTx });
        console.log(`   ✅ Vault 0 deployed successfully! Hash: ${deployVaultTx}`);
        console.log(`   Gas used: ${receipt.gasUsed}`);
        
        // Read the vault address again
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
          args: [0]
        }) as string;
        
        console.log(`   New vault 0 address: ${newVaultAddress}`);
        
      } catch (error: any) {
        console.log(`   ❌ Failed to deploy vault 0: ${error.message}`);
        
        // Check if it's a permission issue
        if (error.message.includes("AccessControl")) {
          console.log("   🔑 This is likely a permission issue. Checking roles...");
          
          try {
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
              args: [
                "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", // DEPLOYER_ROLE
                account.address
              ]
            }) as boolean;
            
            console.log(`   DEPLOYER_ROLE for ${account.address}: ${hasDeployerRole}`);
            
          } catch (roleError) {
            console.log(`   ❌ Failed to check roles: ${roleError}`);
          }
        }
      }
    } else {
      console.log("   Vault 0 already deployed, skipping test deployment");
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🔍 INVESTIGATION SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    const deployedCount = Object.keys(deployedVaults).length;
    console.log(`📊 Status: ${deployedCount}/10 vaults deployed`);
    
    if (deployedCount === 0) {
      console.log("⚠️ ISSUE: No vaults were deployed");
      console.log("   Possible causes:");
      console.log("   1. BotManager not set in VaultFactory");
      console.log("   2. Permission/role issues");
      console.log("   3. Transaction reverted silently");
      console.log("   4. Gas limit issues");
    } else if (deployedCount < 10) {
      console.log("⚠️ ISSUE: Partial deployment");
      console.log("   Some vaults deployed but not all");
    } else {
      console.log("✅ All vaults successfully deployed");
    }

  } catch (error) {
    console.error("❌ Investigation failed:", error);
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