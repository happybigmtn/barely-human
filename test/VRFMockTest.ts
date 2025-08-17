import { network } from "hardhat";
import assert from "assert";

async function testVRFMock() {
  console.log("🧪 Testing VRF Mock Setup...");
  
  const connection = await network.connect();
  const { viem } = connection;
  
  try {
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();
    
    // Deploy mock VRF coordinator
    console.log("📦 Deploying Mock VRF Coordinator V2+...");
    const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus", []);
    console.log(`✅ Mock VRF deployed at: ${mockVRF.address}`);
    
    // Create subscription
    const createSubHash = await mockVRF.write.createSubscription();
    const subReceipt = await publicClient.waitForTransactionReceipt({ hash: createSubHash });
    console.log(`✅ Subscription created, tx: ${subReceipt.transactionHash}`);
    
    // Deploy test CrapsGameV2Plus
    console.log("📦 Deploying CrapsGameV2Plus...");
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      mockVRF.address,
      1n, // subscription ID
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // key hash
    ]);
    console.log(`✅ CrapsGame deployed at: ${crapsGame.address}`);
    
    // Add consumer
    const addConsumerHash = await mockVRF.write.addConsumer([
      1n, // subscription ID
      crapsGame.address
    ]);
    await publicClient.waitForTransactionReceipt({ hash: addConsumerHash });
    console.log("✅ Consumer added to subscription");
    
    // Grant operator role
    const OPERATOR_ROLE = "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";
    const grantRoleHash = await crapsGame.write.grantRole([
      OPERATOR_ROLE,
      deployer.account.address
    ]);
    await publicClient.waitForTransactionReceipt({ hash: grantRoleHash });
    console.log("✅ Operator role granted");
    
    // Start a series
    const startSeriesHash = await crapsGame.write.startNewSeries([
      deployer.account.address
    ]);
    await publicClient.waitForTransactionReceipt({ hash: startSeriesHash });
    console.log("✅ Series started");
    
    // Request dice roll
    console.log("🎲 Requesting dice roll...");
    const requestHash = await crapsGame.write.requestDiceRoll();
    const requestReceipt = await publicClient.waitForTransactionReceipt({ hash: requestHash });
    
    console.log(`Transaction hash: ${requestReceipt.transactionHash}`);
    console.log(`Logs count: ${requestReceipt.logs.length}`);
    
    // Parse logs manually
    for (const log of requestReceipt.logs) {
      console.log(`Log topic: ${log.topics[0]}`);
      if (log.address.toLowerCase() === crapsGame.address.toLowerCase()) {
        console.log("Found log from CrapsGame contract");
        // The first topic is the event signature, second is indexed requestId
        if (log.topics.length > 1) {
          const requestId = BigInt(log.topics[1]);
          console.log(`✅ Found request ID from event: ${requestId}`);
          
          // Try to fulfill
          console.log("🎲 Fulfilling VRF request...");
          const fulfillHash = await mockVRF.write.fulfillRandomWords([
            requestId,
            [BigInt(123456), BigInt(654321)] // Random values
          ]);
          await publicClient.waitForTransactionReceipt({ hash: fulfillHash });
          console.log("✅ VRF request fulfilled");
          
          // Check game state
          const lastRoll = await crapsGame.read.getLastRoll();
          console.log(`Last roll: die1=${lastRoll[0]}, die2=${lastRoll[1]}, total=${lastRoll[2]}`);
          
          assert(lastRoll[2] > 0, "Dice should have been rolled");
          console.log("✅ VRF Mock test passed!");
          break;
        }
      }
    }
    
  } finally {
    await connection.close();
  }
}

testVRFMock().catch(console.error);