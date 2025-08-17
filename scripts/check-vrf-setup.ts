// Check VRF setup and prepare for adding consumers
import { network } from "hardhat";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// Contract addresses
const VRF_COORDINATOR = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634";
const CRAPS_GAME = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";
const BOT_MANAGER = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";
const GACHA_MINT_PASS = "0x72aeecc947dd61493e0af9d92cb008abc2a3c253";

// VRF Subscription ID (uint256 format)
const VRF_SUBSCRIPTION_ID = "22376417694825733668962562671731634456669048679979758256841549539628619732572";

// VRF Coordinator ABI (minimal)
const VRF_COORDINATOR_ABI = [
  {
    name: "getSubscription",
    type: "function",
    inputs: [{ name: "subId", type: "uint256" }],
    outputs: [
      { name: "balance", type: "uint96" },
      { name: "reqCount", type: "uint64" },
      { name: "owner", type: "address" },
      { name: "consumers", type: "address[]" }
    ],
    stateMutability: "view"
  },
  {
    name: "addConsumer",
    type: "function",
    inputs: [
      { name: "subId", type: "uint256" },
      { name: "consumer", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

async function main() {
  console.log("🔍 Checking VRF setup on Base Sepolia...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  
  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);

  try {
    // Check VRF subscription
    console.log("📊 VRF Subscription Status:");
    console.log(`   Subscription ID: ${VRF_SUBSCRIPTION_ID}`);
    console.log(`   Coordinator: ${VRF_COORDINATOR}\n`);

    // Get subscription details
    const subscription = await publicClient.readContract({
      address: VRF_COORDINATOR as `0x${string}`,
      abi: VRF_COORDINATOR_ABI,
      functionName: "getSubscription",
      args: [BigInt(VRF_SUBSCRIPTION_ID)]
    });

    const [balance, reqCount, owner, consumers] = subscription as [bigint, bigint, string, string[]];
    
    console.log("📈 Subscription Details:");
    console.log(`   Balance: ${formatEther(balance)} LINK`);
    console.log(`   Request Count: ${reqCount.toString()}`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Current Consumers: ${consumers.length}`);
    
    if (consumers.length > 0) {
      console.log("\n🔗 Current Consumers:");
      consumers.forEach((consumer, index) => {
        let name = "Unknown";
        if (consumer.toLowerCase() === CRAPS_GAME.toLowerCase()) name = "CrapsGame ✅";
        else if (consumer.toLowerCase() === BOT_MANAGER.toLowerCase()) name = "BotManager ✅";
        else if (consumer.toLowerCase() === GACHA_MINT_PASS.toLowerCase()) name = "GachaMintPass ✅";
        
        console.log(`   ${index + 1}. ${consumer} (${name})`);
      });
    }

    // Check which consumers need to be added
    console.log("\n📋 Consumer Status:");
    const crapsGameAdded = consumers.some(c => c.toLowerCase() === CRAPS_GAME.toLowerCase());
    const botManagerAdded = consumers.some(c => c.toLowerCase() === BOT_MANAGER.toLowerCase());
    const gachaMintPassAdded = consumers.some(c => c.toLowerCase() === GACHA_MINT_PASS.toLowerCase());

    console.log(`   CrapsGame: ${crapsGameAdded ? '✅ Added' : '❌ Missing'}`);
    console.log(`   BotManager: ${botManagerAdded ? '✅ Added' : '❌ Missing'}`);
    console.log(`   GachaMintPass: ${gachaMintPassAdded ? '✅ Added' : '❌ Missing'}`);

    // Show what needs to be done
    const needsAdding = [];
    if (!botManagerAdded) needsAdding.push({ name: "BotManager", address: BOT_MANAGER });
    if (!gachaMintPassAdded) needsAdding.push({ name: "GachaMintPass", address: GACHA_MINT_PASS });

    if (needsAdding.length > 0) {
      console.log("\n⚠️ ACTION REQUIRED:");
      console.log("   Go to: https://vrf.chain.link/base-sepolia");
      console.log(`   Navigate to subscription: ${VRF_SUBSCRIPTION_ID}`);
      console.log("   Add these consumers:");
      
      needsAdding.forEach(consumer => {
        console.log(`   - ${consumer.name}: ${consumer.address}`);
      });

      // Optionally try to add them programmatically if we're the owner
      if (owner.toLowerCase() === account.address.toLowerCase()) {
        console.log("\n🔧 You are the subscription owner. Attempting to add consumers...");
        
        const [walletClient] = await viem.getWalletClients();
        
        for (const consumer of needsAdding) {
          try {
            console.log(`   Adding ${consumer.name}...`);
            const tx = await walletClient.writeContract({
              address: VRF_COORDINATOR as `0x${string}`,
              abi: VRF_COORDINATOR_ABI,
              functionName: "addConsumer",
              args: [BigInt(VRF_SUBSCRIPTION_ID), consumer.address as `0x${string}`],
              gas: 100000n
            });
            
            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log(`   ✅ ${consumer.name} added successfully!`);
          } catch (error: any) {
            console.log(`   ❌ Failed to add ${consumer.name}: ${error.message?.substring(0, 50)}`);
          }
        }
      } else {
        console.log(`\n   Note: Subscription owner is ${owner}, not your address ${account.address}`);
        console.log("   You'll need to ask the owner to add consumers or transfer ownership.");
      }
    } else {
      console.log("\n✅ All required consumers are already added!");
    }

    // Test VRF contract functionality
    console.log("\n🧪 Testing Contract VRF Integration:");
    
    // Check if CrapsGame can request randomness
    try {
      const gameStatus = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: [{
          name: "currentPhase",
          type: "function",
          inputs: [],
          outputs: [{ name: "", type: "uint8" }],
          stateMutability: "view"
        }],
        functionName: "currentPhase"
      });
      console.log(`   CrapsGame current phase: ${gameStatus}`);
    } catch (error) {
      console.log("   ⚠️ Could not read CrapsGame status");
    }

  } catch (error: any) {
    console.error("❌ Error checking VRF setup:", error.message);
  } finally {
    await connection.close();
  }

  console.log("\n📝 Next Steps:");
  console.log("   1. Ensure all VRF consumers are added");
  console.log("   2. Verify contracts on BaseScan");
  console.log("   3. Fund bot vaults with BOT tokens");
  console.log("   4. Test first game series");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });