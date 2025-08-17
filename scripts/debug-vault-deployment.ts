// Debug VaultFactory Deployment Issue - Detailed Analysis
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";

async function main() {
  console.log("🔬 Deep debugging vault deployment...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  try {
    // Test 1: Check all factory state
    console.log("📊 Factory State Analysis:");
    
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
    console.log(`   Bot Manager: ${botManager}`);
    
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
    console.log(`   Game Address: ${gameAddress}`);
    
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
    console.log(`   Default Asset: ${defaultAsset}`);
    
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
    console.log(`   Treasury Address: ${treasuryAddress}`);

    // Test 2: Check role permissions
    console.log("\n🔐 Permission Analysis:");
    
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
    console.log(`   Has DEPLOYER_ROLE: ${hasDeployerRole}`);
    
    const adminRoleHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
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
      args: [adminRoleHash, account.address]
    }) as boolean;
    console.log(`   Has ADMIN_ROLE: ${hasAdminRole}`);

    // Test 3: Detailed deployVault simulation
    console.log("\n🧪 Detailed Deployment Simulation:");
    
    try {
      // Try to simulate without actually executing
      const simulationData = await publicClient.simulateContract({
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
        account: account.address
      });
      
      console.log(`   Simulation successful! Would return: ${simulationData.result}`);
      
    } catch (simError: any) {
      console.log(`   Simulation failed: ${simError.message}`);
      
      // Extract more details from the error
      if (simError.message.includes("revert")) {
        console.log("   🚨 Contract would revert! Analyzing revert reason...");
        
        // Common revert reasons in our contract
        if (simError.message.includes("Invalid bot ID")) {
          console.log("      Reason: Bot ID out of range");
        } else if (simError.message.includes("Already deployed")) {
          console.log("      Reason: Vault already exists");
        } else if (simError.message.includes("Bot manager not set")) {
          console.log("      Reason: BotManager address not configured");
        } else if (simError.message.includes("AccessControl")) {
          console.log("      Reason: Insufficient permissions");
        } else {
          console.log(`      Reason: Unknown - ${simError.message.substring(0, 200)}`);
        }
      }
    }

    // Test 4: Try to call getBotName directly
    console.log("\n📛 Testing getBotName function:");
    try {
      // This should work since it's a pure function
      const botName = await publicClient.readContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "getBotName",
          type: "function",
          inputs: [{ name: "botId", type: "uint256" }],
          outputs: [{ name: "", type: "string" }],
          stateMutability: "view"  // Changed from "pure" to "view" in case that's the issue
        }],
        functionName: "getBotName",
        args: [BigInt(0)]
      }) as string;
      
      console.log(`   Bot 0 name: "${botName}"`);
    } catch (error) {
      console.log(`   getBotName failed: ${error}`);
      console.log("   🚨 This indicates the contract may have compilation issues!");
    }

    // Test 5: Check if CrapsVault can be deployed directly
    console.log("\n🏗️ Testing Direct CrapsVault Deployment:");
    try {
      // Get the bytecode size first
      const crapsVaultCode = await publicClient.getCode({
        address: VAULT_FACTORY_ADDRESS
      });
      console.log(`   Factory bytecode size: ${crapsVaultCode?.length || 0} bytes`);
      
      // Try to deploy a CrapsVault directly to see if it works
      console.log("   Attempting direct CrapsVault deployment...");
      const directVault = await viem.deployContract("CrapsVault", [
        BOT_TOKEN_ADDRESS,  // asset
        BigInt(0),         // botId
        "Test Bot",        // botName  
        account.address    // botManager (use deployer for test)
      ]);
      
      console.log(`   ✅ Direct deployment successful: ${directVault.address}`);
      console.log(`   This means CrapsVault contract itself is fine.`);
      
    } catch (deployError: any) {
      console.log(`   ❌ Direct deployment failed: ${deployError.message}`);
      console.log("   This suggests an issue with the CrapsVault contract itself");
    }

    // Test 6: Check the exact transaction that failed
    console.log("\n📜 Check Recent Transaction Logs:");
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const logs = await publicClient.getLogs({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        fromBlock: latestBlock - 100n,
        toBlock: latestBlock
      });
      
      console.log(`   Found ${logs.length} recent events`);
      for (const log of logs) {
        console.log(`   TX: ${log.transactionHash}`);
        console.log(`   Block: ${log.blockNumber}`);
        console.log(`   Topics: ${log.topics.join(', ')}`);
      }
    } catch (error) {
      console.log(`   Failed to read logs: ${error}`);
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🔬 DEBUGGING SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════════");

  } catch (error) {
    console.error("❌ Debug script failed:", error);
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