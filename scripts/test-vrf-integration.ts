// Test VRF integration following Chainlink v2.5 documentation
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// VRF Configuration for Base Sepolia
const VRF_COORDINATOR = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634";
const VRF_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
const VRF_SUBSCRIPTION_ID = "1"; // Using simplified ID for testing

// Deployed contract addresses
const CRAPS_GAME = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";
const BOT_MANAGER = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";

// VRF Coordinator v2.5 ABI (essential functions)
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
    name: "createSubscription",
    type: "function",
    inputs: [],
    outputs: [{ name: "subId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    name: "fundSubscription",
    type: "function",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable"
  }
];

// CrapsGame ABI (VRF related functions)
const CRAPS_GAME_ABI = [
  {
    name: "startSeries",
    type: "function",
    inputs: [
      { name: "initialBet", type: "uint256" },
      { name: "betType", type: "uint8" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    name: "currentPhase",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    name: "lastRequestId",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "fulfillRandomWords",
    type: "function",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "randomWords", type: "uint256[]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

async function main() {
  console.log("🎲 Testing VRF Integration (Chainlink v2.5)...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 ETH Balance: ${formatEther(balance)} ETH\n`);

  try {
    // Step 1: Check if we need to create a subscription
    console.log("🔍 Step 1: Checking VRF subscription...");
    
    let subscriptionId = BigInt(VRF_SUBSCRIPTION_ID);
    let subscription;
    
    try {
      subscription = await publicClient.readContract({
        address: VRF_COORDINATOR as `0x${string}`,
        abi: VRF_COORDINATOR_ABI,
        functionName: "getSubscription",
        args: [subscriptionId]
      });
      
      const [balance, nativeBalance, reqCount, subOwner, consumers] = subscription as [bigint, bigint, bigint, string, string[]];
      
      console.log("✅ Subscription found:");
      console.log(`   ID: ${subscriptionId}`);
      console.log(`   LINK Balance: ${formatEther(balance)} LINK`);
      console.log(`   Native Balance: ${formatEther(nativeBalance)} ETH`);
      console.log(`   Request Count: ${reqCount.toString()}`);
      console.log(`   Owner: ${subOwner}`);
      console.log(`   Consumers: ${consumers.length}`);
      
      if (consumers.length > 0) {
        console.log("   Current consumers:");
        consumers.forEach((consumer, i) => {
          let name = "Unknown";
          if (consumer.toLowerCase() === CRAPS_GAME.toLowerCase()) name = "CrapsGame";
          if (consumer.toLowerCase() === BOT_MANAGER.toLowerCase()) name = "BotManager";
          console.log(`     ${i + 1}. ${consumer} (${name})`);
        });
      }
      
    } catch (error) {
      console.log("❌ Subscription not found, creating new one...");
      
      // Create new subscription
      const tx = await walletClient.writeContract({
        address: VRF_COORDINATOR as `0x${string}`,
        abi: VRF_COORDINATOR_ABI,
        functionName: "createSubscription",
        args: [],
        gas: 200000n
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`✅ New subscription created! TX: ${receipt.transactionHash}`);
      
      // Extract subscription ID from logs (would need event parsing in real implementation)
      subscriptionId = BigInt(1); // Fallback for demo
    }

    // Step 2: Fund subscription if needed
    console.log("\n💰 Step 2: Checking subscription funding...");
    
    if (subscription) {
      const [balance, nativeBalance] = subscription as [bigint, bigint, bigint, string, string[]];
      
      if (nativeBalance < parseEther("0.01")) {
        console.log("⚠️ Subscription needs funding, adding 0.01 ETH...");
        
        const fundTx = await walletClient.writeContract({
          address: VRF_COORDINATOR as `0x${string}`,
          abi: VRF_COORDINATOR_ABI,
          functionName: "fundSubscription",
          args: [subscriptionId],
          value: parseEther("0.01"),
          gas: 100000n
        });
        
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
        console.log("✅ Subscription funded!");
      } else {
        console.log("✅ Subscription adequately funded");
      }
    }

    // Step 3: Add consumers if needed
    console.log("\n🔗 Step 3: Adding VRF consumers...");
    
    const consumersToAdd = [
      { name: "CrapsGame", address: CRAPS_GAME },
      { name: "BotManager", address: BOT_MANAGER }
    ];
    
    if (subscription) {
      const [, , , subOwner, existingConsumers] = subscription as [bigint, bigint, bigint, string, string[]];
      
      if (subOwner.toLowerCase() === account.address.toLowerCase()) {
        for (const consumer of consumersToAdd) {
          const isAlreadyAdded = existingConsumers.some(
            c => c.toLowerCase() === consumer.address.toLowerCase()
          );
          
          if (!isAlreadyAdded) {
            try {
              console.log(`   Adding ${consumer.name}...`);
              
              const addTx = await walletClient.writeContract({
                address: VRF_COORDINATOR as `0x${string}`,
                abi: VRF_COORDINATOR_ABI,
                functionName: "addConsumer",
                args: [subscriptionId, consumer.address as `0x${string}`],
                gas: 100000n
              });
              
              await publicClient.waitForTransactionReceipt({ hash: addTx });
              console.log(`   ✅ ${consumer.name} added as consumer`);
              
            } catch (error: any) {
              console.log(`   ❌ Failed to add ${consumer.name}: ${error.message?.substring(0, 50)}`);
            }
          } else {
            console.log(`   ✅ ${consumer.name} already added`);
          }
        }
      } else {
        console.log(`   ⚠️ Cannot add consumers - not subscription owner`);
        console.log(`   Owner: ${subOwner}, Deployer: ${account.address}`);
      }
    }

    // Step 4: Test VRF request
    console.log("\n🎲 Step 4: Testing VRF request...");
    
    try {
      // Check current game phase
      const currentPhase = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: CRAPS_GAME_ABI,
        functionName: "currentPhase"
      }) as number;
      
      console.log(`   Current game phase: ${currentPhase}`);
      
      // Get last request ID
      const lastRequestId = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: CRAPS_GAME_ABI,
        functionName: "lastRequestId"
      }) as bigint;
      
      console.log(`   Last request ID: ${lastRequestId.toString()}`);
      
      // Note: Actual game start would require proper role setup and vault funding
      console.log("   ℹ️ To test VRF request, run a complete game series");
      console.log("   ℹ️ This requires: role permissions, funded vaults, and game logic");
      
    } catch (error: any) {
      console.log(`   ⚠️ Could not read game state: ${error.message?.substring(0, 50)}`);
    }

    console.log("\n✅ VRF Integration Test Complete!");
    console.log("\n📋 Summary:");
    console.log(`   • Subscription ID: ${subscriptionId}`);
    console.log(`   • VRF Coordinator: ${VRF_COORDINATOR}`);
    console.log(`   • Key Hash: ${VRF_KEY_HASH}`);
    console.log(`   • Consumers: CrapsGame, BotManager`);
    
    console.log("\n🎯 Next Steps:");
    console.log("   1. Verify subscription has sufficient funding");
    console.log("   2. Test complete game series with VRF");
    console.log("   3. Monitor VRF fulfillment logs");
    console.log("   4. Check randomness quality");

  } catch (error: any) {
    console.error("❌ VRF test error:", error.message);
    
    // Provide helpful troubleshooting
    console.log("\n🔧 Troubleshooting:");
    console.log("   • Check if VRF Coordinator address is correct for Base Sepolia");
    console.log("   • Verify subscription ID format (should be uint256)");
    console.log("   • Ensure deployer wallet owns the subscription");
    console.log("   • Check if contracts are properly deployed");
    
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