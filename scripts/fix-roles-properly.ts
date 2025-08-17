// Fix Roles and Deploy Vaults with Correct Role Hash
import { network } from "hardhat";
import { formatEther, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const CRAPS_GAME_ADDRESS = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";

async function main() {
  console.log("🔧 Fixing roles with correct hash calculation...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`📍 Deployer: ${account.address}`);

  try {
    // Calculate the correct DEPLOYER_ROLE hash
    const deployerRoleString = "DEPLOYER_ROLE";
    const deployerRoleHash = keccak256(toHex(deployerRoleString));
    console.log(`🔑 DEPLOYER_ROLE hash: ${deployerRoleHash}`);
    
    // Also calculate it the way Solidity does it
    const solidityDeployerRoleHash = keccak256(toHex("DEPLOYER_ROLE"));
    console.log(`🔑 Solidity DEPLOYER_ROLE hash: ${solidityDeployerRoleHash}`);

    // Step 1: Check current roles
    console.log("\n🔍 Current Role Status:");
    
    const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const hasAdminRole = await publicClient.readContract({
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
      args: [adminRole, account.address]
    }) as boolean;
    
    console.log(`   Admin Role: ${hasAdminRole ? '✅' : '❌'}`);
    
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
    
    console.log(`   Deployer Role: ${hasDeployerRole ? '✅' : '❌'}`);

    if (!hasAdminRole) {
      console.log("❌ Account doesn't have admin role. Cannot grant deployer role.");
      return;
    }

    // Step 2: Grant DEPLOYER_ROLE with correct hash
    if (!hasDeployerRole) {
      console.log("\n🔐 Granting DEPLOYER_ROLE...");
      try {
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
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: grantRoleTx });
        console.log(`   ✅ DEPLOYER_ROLE granted! Hash: ${grantRoleTx}`);
        console.log(`   Gas used: ${receipt.gasUsed}`);
        
        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        console.log(`   ❌ Role grant failed: ${error.message}`);
        return;
      }
    }

    // Step 3: Set Game Address
    console.log("\n🎮 Setting Game Address...");
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
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: setGameTx });
      console.log(`   ✅ Game address set! Hash: ${setGameTx}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      
    } catch (error: any) {
      console.log(`   ⚠️ Set game address failed: ${error.message?.substring(0, 100)}`);
    }

    // Step 4: Final verification
    console.log("\n🔍 Final Verification:");
    
    const finalHasDeployerRole = await publicClient.readContract({
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
    
    const finalGameAddress = await publicClient.readContract({
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
    
    console.log(`   DEPLOYER_ROLE: ${finalHasDeployerRole ? '✅' : '❌'}`);
    console.log(`   Game Address: ${finalGameAddress === CRAPS_GAME_ADDRESS ? '✅' : '❌'} ${finalGameAddress}`);

    if (!finalHasDeployerRole) {
      console.log("\n❌ Still don't have DEPLOYER_ROLE. There may be an issue with the contract.");
      return;
    }

    // Step 5: Test single vault deployment
    console.log("\n🧪 Testing Single Vault Deployment (Bot 0):");
    try {
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
        gas: 800000n
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployVaultTx });
      console.log(`   ✅ Vault 0 deployed! Hash: ${deployVaultTx}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      
      // Check the vault address
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        args: [0]
      }) as string;
      
      console.log(`   Vault 0 address: ${vaultAddress}`);
      
      if (vaultAddress !== "0x0000000000000000000000000000000000000000") {
        console.log("   ✅ SUCCESS! Vault deployment is working!");
        
        // Now deploy all remaining vaults
        console.log("\n📦 Deploying Remaining Vaults:");
        for (let i = 1; i < 10; i++) {
          try {
            console.log(`   Deploying vault ${i}...`);
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
              args: [BigInt(i)],
              gas: 800000n
            });
            
            await publicClient.waitForTransactionReceipt({ hash: deployTx });
            console.log(`   ✅ Vault ${i} deployed`);
            
          } catch (error: any) {
            console.log(`   ❌ Vault ${i} failed: ${error.message?.substring(0, 100)}`);
          }
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } else {
        console.log("   ❌ Vault deployment transaction succeeded but address is still zero");
      }
      
    } catch (error: any) {
      console.log(`   ❌ Vault deployment failed: ${error.message}`);
    }

    // Final status
    console.log("\n📊 Final Vault Status:");
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
    console.error("❌ Script failed:", error);
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