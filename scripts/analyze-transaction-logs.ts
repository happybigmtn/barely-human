// Analyze Transaction Logs to Understand What's Happening
import { network } from "hardhat";
import { formatEther, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";

// One of the recent transaction hashes from the last run
const RECENT_TX = "0xd3d00b2dfa4de2567e041450de84147e62c5aeaa326f444bc419b9dd6fc6fd55";

async function main() {
  console.log("🔍 Analyzing transaction logs to understand vault deployment...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();

  try {
    // Get the transaction receipt with logs
    console.log("📜 Transaction Log Analysis:");
    const receipt = await publicClient.getTransactionReceipt({ hash: RECENT_TX as `0x${string}` });
    
    console.log(`   Transaction Hash: ${receipt.transactionHash}`);
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   Logs Count: ${receipt.logs.length}\n`);

    // Analyze each log
    receipt.logs.forEach((log, index) => {
      console.log(`📋 Log ${index}:`);
      console.log(`   Address: ${log.address}`);
      console.log(`   Topics: ${log.topics.length}`);
      log.topics.forEach((topic, topicIndex) => {
        console.log(`     Topic ${topicIndex}: ${topic}`);
      });
      console.log(`   Data: ${log.data}`);
      console.log("");
    });

    // Try to decode the logs if they match known event signatures
    console.log("🔍 Event Signature Analysis:");
    
    // VaultDeployed event signature
    const vaultDeployedSignature = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
    
    // More accurate event signatures for common events
    const eventSignatures = {
      "VaultDeployed(uint256,address)": "0x87e97e825a1d1fa0c54e1d36c7506c1dea8b1826cc07f84c21be6de07d8a8b1e",
      "RoleGranted(bytes32,address,address)": "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d",
      "Transfer(address,address,uint256)": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    };

    receipt.logs.forEach((log, index) => {
      const topic0 = log.topics[0];
      const matchedEvent = Object.entries(eventSignatures).find(([_, sig]) => sig === topic0);
      
      if (matchedEvent) {
        console.log(`   Log ${index}: ${matchedEvent[0]}`);
      } else {
        console.log(`   Log ${index}: Unknown event (${topic0})`);
      }
    });

    // Get transaction details
    console.log("\n📊 Transaction Details:");
    const transaction = await publicClient.getTransaction({ hash: RECENT_TX as `0x${string}` });
    
    console.log(`   From: ${transaction.from}`);
    console.log(`   To: ${transaction.to}`);
    console.log(`   Value: ${formatEther(transaction.value)} ETH`);
    console.log(`   Gas: ${transaction.gas}`);
    console.log(`   Gas Price: ${transaction.gasPrice}`);
    console.log(`   Input Data Length: ${transaction.input.length} bytes`);
    console.log(`   Input Data: ${transaction.input.substring(0, 100)}...`);

    // Try to decode the function call
    if (transaction.input.startsWith("0x6ab44f69")) {
      console.log("\n🔍 Function Call Analysis:");
      console.log("   Function: deployVault(uint256)");
      
      // Extract the botId parameter (next 32 bytes after function selector)
      const botIdHex = transaction.input.substring(10, 74); // Skip "0x" and 4-byte selector
      const botId = BigInt("0x" + botIdHex);
      console.log(`   Bot ID Parameter: ${botId.toString()}`);
    }

    // Check if there are any contract creation events
    console.log("\n🏭 Contract Creation Analysis:");
    
    // Look for contract creation in the logs
    let contractCreated = false;
    receipt.logs.forEach((log, index) => {
      // Contract creation typically has no topics or specific patterns
      if (log.address.toLowerCase() !== VAULT_FACTORY_ADDRESS.toLowerCase()) {
        console.log(`   Possible new contract: ${log.address}`);
        contractCreated = true;
      }
    });
    
    if (!contractCreated) {
      console.log("   ❌ No contract creation detected in logs");
      console.log("   This suggests the deployVault call didn't actually create a new contract");
    }

    // Check recent blocks for any vault-related activity
    console.log("\n🔄 Recent Block Analysis:");
    const latestBlock = await publicClient.getBlockNumber();
    
    // Look for recent logs from VaultFactory
    const recentLogs = await publicClient.getLogs({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      fromBlock: latestBlock - 20n,
      toBlock: latestBlock
    });
    
    console.log(`   Found ${recentLogs.length} recent events from VaultFactory`);
    recentLogs.forEach((log, index) => {
      console.log(`   Event ${index}: Block ${log.blockNumber}, TX ${log.transactionHash}`);
    });

    // Final diagnosis
    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🔬 DIAGNOSIS");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    if (receipt.status === "success" && receipt.gasUsed > 900000n) {
      console.log("✅ Transaction succeeded and used significant gas");
      
      if (!contractCreated) {
        console.log("❌ But no new contracts were created");
        console.log("🔍 Possible issues:");
        console.log("   1. deployVault() function has a bug and exits early");
        console.log("   2. CrapsVault constructor is reverting");
        console.log("   3. The mapping update is not happening correctly");
        console.log("   4. There's a logical error in the VaultFactory contract");
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