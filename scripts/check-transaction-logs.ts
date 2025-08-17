// Check Transaction Logs for deployAllBots call
import { network } from "hardhat";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";

// This is the transaction hash mentioned in the context
// We need to analyze this transaction to see what happened
const DEPLOY_ALL_BOTS_TX = "0x2988887"; // Gas used from context

async function main() {
  console.log("🔍 Analyzing deployAllBots transaction...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();

  try {
    // Get recent transactions from the deployer to find the deployAllBots call
    console.log("📈 Looking for recent deployAllBots transactions...");
    
    // Get the latest block number
    const latestBlock = await publicClient.getBlockNumber();
    console.log(`   Latest block: ${latestBlock}`);
    
    // Search last 1000 blocks for transactions from our account to VaultFactory
    const searchBlocks = 1000n;
    const fromBlock = latestBlock - searchBlocks;
    
    console.log(`   Searching blocks ${fromBlock} to ${latestBlock} for VaultFactory transactions...\n`);
    
    // Get transaction logs for VaultFactory
    const logs = await publicClient.getLogs({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      fromBlock: fromBlock,
      toBlock: latestBlock
    });
    
    console.log(`📋 Found ${logs.length} events from VaultFactory:`);
    
    if (logs.length === 0) {
      console.log("   No events found. This suggests deployAllBots() may have reverted silently.\n");
    } else {
      for (const log of logs) {
        console.log(`   Block: ${log.blockNumber}, Topics: ${log.topics[0]}`);
        
        // Check if this is a VaultDeployed event
        // VaultDeployed event signature: VaultDeployed(uint256 indexed botId, address indexed vault)
        const vaultDeployedSig = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"; // This might not be exact
        
        if (log.topics.length > 1) {
          console.log(`     Topic 1: ${log.topics[1]} (botId)`);
          console.log(`     Topic 2: ${log.topics[2]} (vault address)`);
        }
        console.log(`     Data: ${log.data}`);
        console.log(`     Tx Hash: ${log.transactionHash}\n`);
      }
    }
    
    // Let's also check if BotManager was properly initialized
    console.log("🤖 Checking BotManager initialization...");
    try {
      const botsInitialized = await publicClient.readContract({
        address: "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486" as `0x${string}`,
        abi: [{
          name: "areBotsInitialized",
          type: "function",
          inputs: [],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "view"
        }],
        functionName: "areBotsInitialized"
      }) as boolean;
      
      console.log(`   Bots initialized: ${botsInitialized}`);
      
      if (!botsInitialized) {
        console.log("   ⚠️ FOUND ISSUE: Bots are not initialized in BotManager!");
        console.log("   This would cause vault deployment to fail.\n");
      }
    } catch (error) {
      console.log(`   Failed to check bot initialization: ${error}\n`);
    }

    // Check individual bot personalities  
    console.log("🧮 Checking individual bot configurations...");
    for (let i = 0; i < 3; i++) { // Check first 3 bots
      try {
        const personality = await publicClient.readContract({
          address: "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486" as `0x${string}`,
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
      } catch (error) {
        console.log(`   Bot ${i}: Failed to read personality - ${error}`);
      }
    }

    // Let's try a manual deployment to see the exact error
    console.log("\n🧪 Attempting manual vault deployment...");
    const [walletClient] = await viem.getWalletClients();
    
    try {
      // First, let's just try calling getBotName to see if that works
      const botName = await publicClient.readContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "getBotName",
          type: "function",
          inputs: [{ name: "botId", type: "uint256" }],
          outputs: [{ name: "", type: "string" }],
          stateMutability: "pure"
        }],
        functionName: "getBotName",
        args: [BigInt(0)]
      }) as string;
      
      console.log(`   Bot 0 name from factory: "${botName}"`);
      
    } catch (error) {
      console.log(`   Failed to get bot name: ${error}`);
    }

    // Try to estimate gas for deployment
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
      
      console.log(`   Gas estimate for deployVault(0): ${gasEstimate}`);
      
    } catch (error: any) {
      console.log(`   Gas estimation failed: ${error.message}`);
      
      // The error message might contain the actual revert reason
      if (error.message.includes("execution reverted")) {
        console.log("   🚨 Transaction would revert! This explains why deployAllBots failed.");
      }
    }

  } catch (error) {
    console.error("❌ Analysis failed:", error);
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