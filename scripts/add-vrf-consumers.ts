// Add VRF consumers to our subscription
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// VRF Configuration
const VRF_COORDINATOR = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634";

// Our VRF subscription IDs to try
const SUBSCRIPTION_IDS = [1, 2]; // Try both recent subscriptions

// Contracts that need VRF access
const VRF_CONSUMERS = [
  { name: "BotManager", address: "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486" },
  { name: "GachaMintPass", address: "0x72aeecc947dd61493e0af9d92cb008abc2a3c253" },
  { name: "CrapsGame", address: "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a" }
];

// VRF Coordinator ABI
const VRF_COORDINATOR_ABI = [
  {
    name: "addConsumer",
    type: "function",
    inputs: [
      { name: "subId", type: "uint256" },
      { name: "consumer", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "getSubscription",
    type: "function",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [
      { name: "balance", type: "uint96" },
      { name: "nativeBalance", type: "uint96" },
      { name: "reqCount", type: "uint64" },
      { name: "subOwner", type: "address" },
      { name: "consumers", type: "address[]" }
    ],
    stateMutability: "view"
  },
  {
    name: "fundSubscription",
    type: "function",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable"
  }
];

async function main() {
  console.log("🔗 Adding VRF Consumers to Subscription...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 ETH Balance: ${formatEther(balance)} ETH\n`);

  try {
    let workingSubscriptionId: bigint | null = null;
    let subscription: any = null;

    // Find a working subscription
    console.log("🔍 Finding active VRF subscription...");
    
    for (const subId of SUBSCRIPTION_IDS) {
      try {
        console.log(`   Checking subscription ID: ${subId}`);
        
        const sub = await publicClient.readContract({
          address: VRF_COORDINATOR as `0x${string}`,
          abi: VRF_COORDINATOR_ABI,
          functionName: "getSubscription",
          args: [BigInt(subId)]
        });

        const [balance, nativeBalance, reqCount, subOwner, consumers] = sub as [bigint, bigint, bigint, string, string[]];
        
        console.log(`   ✅ Found subscription ${subId}:`);
        console.log(`      Owner: ${subOwner}`);
        console.log(`      Native Balance: ${formatEther(nativeBalance)} ETH`);
        console.log(`      Consumers: ${consumers.length}`);
        
        if (subOwner.toLowerCase() === account.address.toLowerCase()) {
          workingSubscriptionId = BigInt(subId);
          subscription = sub;
          console.log(`   🎯 Using subscription ${subId} (owned by deployer)`);
          break;
        } else {
          console.log(`   ⚠️ Subscription ${subId} owned by different address`);
        }
        
      } catch (error) {
        console.log(`   ❌ Subscription ${subId} not found or error`);
      }
    }

    if (!workingSubscriptionId || !subscription) {
      console.log("\n❌ No owned VRF subscription found!");
      console.log("💡 Please create a subscription manually:");
      console.log("   1. Go to: https://vrf.chain.link/base-sepolia");
      console.log("   2. Create new subscription");
      console.log("   3. Fund with ETH for native payments");
      console.log("   4. Update this script with the new subscription ID");
      return;
    }

    const [balance, nativeBalance, reqCount, subOwner, existingConsumers] = subscription as [bigint, bigint, bigint, string, string[]];

    console.log(`\n📊 Using Subscription ${workingSubscriptionId}:`);
    console.log(`   Native Balance: ${formatEther(nativeBalance)} ETH`);
    console.log(`   Request Count: ${reqCount.toString()}`);
    console.log(`   Current Consumers: ${existingConsumers.length}`);

    // Fund subscription if needed
    if (nativeBalance < parseEther("0.005")) {
      console.log("\n💰 Funding subscription with ETH...");
      
      try {
        const fundTx = await walletClient.writeContract({
          address: VRF_COORDINATOR as `0x${string}`,
          abi: VRF_COORDINATOR_ABI,
          functionName: "fundSubscription",
          args: [workingSubscriptionId],
          value: parseEther("0.01"), // Add 0.01 ETH
          gas: 100000n
        });
        
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
        console.log(`   ✅ Added 0.01 ETH to subscription`);
        
      } catch (error: any) {
        console.log(`   ❌ Failed to fund subscription: ${error.message?.substring(0, 50)}`);
      }
    } else {
      console.log("   ✅ Subscription adequately funded");
    }

    // Add consumers
    console.log("\n🔗 Adding VRF consumers...");
    
    for (const consumer of VRF_CONSUMERS) {
      const isAlreadyAdded = existingConsumers.some(
        c => c.toLowerCase() === consumer.address.toLowerCase()
      );
      
      if (isAlreadyAdded) {
        console.log(`   ✅ ${consumer.name} already added`);
        continue;
      }
      
      try {
        console.log(`   Adding ${consumer.name}...`);
        
        const addTx = await walletClient.writeContract({
          address: VRF_COORDINATOR as `0x${string}`,
          abi: VRF_COORDINATOR_ABI,
          functionName: "addConsumer",
          args: [workingSubscriptionId, consumer.address as `0x${string}`],
          gas: 100000n
        });
        
        await publicClient.waitForTransactionReceipt({ hash: addTx });
        console.log(`   ✅ ${consumer.name} added successfully!`);
        
      } catch (error: any) {
        console.log(`   ❌ Failed to add ${consumer.name}: ${error.message?.substring(0, 50)}`);
        
        // Try to get more specific error info
        if (error.message?.includes("revert")) {
          console.log(`      This may be due to: contract not VRF compatible, already added, or permission issue`);
        }
      }
    }

    // Verify final state
    console.log("\n🔍 Verifying final subscription state...");
    
    const finalSub = await publicClient.readContract({
      address: VRF_COORDINATOR as `0x${string}`,
      abi: VRF_COORDINATOR_ABI,
      functionName: "getSubscription",
      args: [workingSubscriptionId]
    });
    
    const [, , , , finalConsumers] = finalSub as [bigint, bigint, bigint, string, string[]];
    
    console.log(`   Total consumers: ${finalConsumers.length}`);
    finalConsumers.forEach((consumer, i) => {
      let name = "Unknown";
      const found = VRF_CONSUMERS.find(c => c.address.toLowerCase() === consumer.toLowerCase());
      if (found) name = found.name;
      
      console.log(`   ${i + 1}. ${consumer} (${name})`);
    });

    console.log("\n✅ VRF Consumer Setup Complete!");
    console.log("\n📋 Summary:");
    console.log(`   • Subscription ID: ${workingSubscriptionId}`);
    console.log(`   • Total Consumers: ${finalConsumers.length}`);
    console.log(`   • Ready for VRF requests`);
    
    console.log("\n🎯 Next Steps:");
    console.log("   1. Test VRF randomness request");
    console.log("   2. Run first game series");
    console.log("   3. Verify contracts on BaseScan");
    console.log("   4. Complete end-to-end testing");

  } catch (error: any) {
    console.error("❌ VRF consumer setup failed:", error.message);
    
    console.log("\n🔧 Troubleshooting suggestions:");
    console.log("   • Ensure deployer wallet owns the subscription");
    console.log("   • Check VRF Coordinator address is correct");
    console.log("   • Verify contracts implement VRF interfaces");
    console.log("   • Try manual setup via Chainlink dashboard");
    
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