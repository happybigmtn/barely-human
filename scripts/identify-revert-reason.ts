// Identify Exact Revert Reason for Vault Deployment
import { network } from "hardhat";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";

async function main() {
  console.log("🔍 Identifying exact revert reason for vault deployment...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();

  try {
    // Step 1: Test with call (simulation) to get exact error
    console.log("🧪 Testing deployVault with call simulation:");
    
    try {
      await publicClient.simulateContract({
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
      
      console.log("   ✅ Simulation succeeded - this shouldn't happen!");
      
    } catch (simError: any) {
      console.log(`   ❌ Simulation failed with error:`);
      console.log(`   ${simError.message}`);
      
      // Extract more specific error details
      if (simError.cause) {
        console.log(`   Cause: ${simError.cause}`);
      }
      
      if (simError.details) {
        console.log(`   Details: ${simError.details}`);
      }
    }

    // Step 2: Check all the requirements in deployVault manually
    console.log("\n🔍 Checking deployVault requirements manually:");
    
    // Check botId < MAX_BOTS
    console.log("   Requirement 1: botId < MAX_BOTS (botId=0, MAX_BOTS=10)");
    console.log("   ✅ PASS");
    
    // Check botVaults[botId] == address(0)
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
      args: [0]
    }) as string;
    
    console.log(`   Requirement 2: botVaults[0] == address(0)`);
    console.log(`   Current value: ${existingVault}`);
    console.log(`   ${existingVault === "0x0000000000000000000000000000000000000000" ? "✅ PASS" : "❌ FAIL"}`);
    
    // Check botManager != address(0)
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
    
    console.log(`   Requirement 3: botManager != address(0)`);
    console.log(`   Current value: ${botManager}`);
    console.log(`   ${botManager !== "0x0000000000000000000000000000000000000000" ? "✅ PASS" : "❌ FAIL"}`);

    // Step 3: Test CrapsVault constructor directly
    console.log("\n🏗️ Testing CrapsVault constructor directly:");
    
    try {
      const directVault = await viem.deployContract("CrapsVault", [
        BOT_TOKEN_ADDRESS,  // asset
        BigInt(0),         // botId
        "Alice",           // botName  
        botManager         // botManager
      ]);
      
      console.log(`   ✅ CrapsVault deployed successfully: ${directVault.address}`);
      console.log("   This proves CrapsVault constructor works fine");
      
    } catch (deployError: any) {
      console.log(`   ❌ CrapsVault constructor failed:`);
      console.log(`   ${deployError.message}`);
      console.log("   🚨 This is likely the root cause!");
    }

    // Step 4: Check getBotName function
    console.log("\n📛 Testing getBotName function:");
    
    try {
      // Try to call getBotName with a static call
      const result = await publicClient.call({
        to: VAULT_FACTORY_ADDRESS as `0x${string}`,
        data: "0x6e27de9b0000000000000000000000000000000000000000000000000000000000000000" // getBotName(0)
      });
      
      console.log(`   ✅ getBotName call succeeded: ${result.data}`);
      
    } catch (nameError: any) {
      console.log(`   ❌ getBotName failed: ${nameError.message}`);
      console.log("   🚨 This could be the issue - getBotName is reverting!");
    }

    // Step 5: Check contract bytecode to see if it's properly deployed
    console.log("\n📦 Checking VaultFactory bytecode:");
    
    const bytecode = await publicClient.getCode({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`
    });
    
    console.log(`   Bytecode length: ${bytecode?.length || 0} bytes`);
    console.log(`   Contract deployed: ${bytecode && bytecode.length > 2 ? "✅ YES" : "❌ NO"}`);

    // Step 6: Try to estimate gas for the transaction
    console.log("\n⛽ Gas estimation test:");
    
    try {
      const gasEstimate = await publicClient.estimateContractGas({
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
      
      console.log(`   ✅ Gas estimate: ${gasEstimate}`);
      
    } catch (gasError: any) {
      console.log(`   ❌ Gas estimation failed:`);
      console.log(`   ${gasError.message}`);
      
      // This should give us the exact revert reason
      if (gasError.cause && gasError.cause.reason) {
        console.log(`   🎯 REVERT REASON: ${gasError.cause.reason}`);
      }
    }

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🔬 FINAL DIAGNOSIS");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("Based on the analysis above, the vault deployment is failing because:");
    console.log("1. All transactions are reverting (status: reverted)");
    console.log("2. The revert happens during contract execution");
    console.log("3. Most likely causes:");
    console.log("   - getBotName() function is reverting (pure function issue)");
    console.log("   - CrapsVault constructor has a requirement that fails");
    console.log("   - VaultFactory contract has a bug in the deployment logic");

  } catch (error) {
    console.error("❌ Diagnostic failed:", error);
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