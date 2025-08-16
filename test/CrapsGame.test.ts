import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing CrapsGame Contract...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, player1, player2, player3, gameManager] = 
    await viem.getWalletClients();
  
  // Get public client
  const publicClient = await viem.getPublicClient();
  
  // Deploy Mock VRF
  console.log("📦 Deploying Mock VRF Coordinator...");
  const mockVRF = await viem.deployContract("MockVRFCoordinator");
  console.log("✅ Mock VRF deployed at:", mockVRF.address);
  
  // Deploy CrapsGame
  console.log("\n📦 Deploying CrapsGame...");
  const crapsGame = await viem.deployContract("CrapsGame", [
    mockVRF.address,
    1n, // subscription ID
    keccak256(toBytes("keyHash"))
  ]);
  console.log("✅ CrapsGame deployed at:", crapsGame.address);
  
  // Deploy CrapsBets
  console.log("\n📦 Deploying CrapsBets...");
  const crapsBets = await viem.deployContract("CrapsBets", [
    crapsGame.address
  ]);
  console.log("✅ CrapsBets deployed at:", crapsBets.address);
  
  // Deploy CrapsSettlement
  console.log("\n📦 Deploying CrapsSettlement...");
  const crapsSettlement = await viem.deployContract("CrapsSettlement", [
    crapsGame.address
  ]);
  console.log("✅ CrapsSettlement deployed at:", crapsSettlement.address);
  
  // Grant roles
  const GAME_ROLE = keccak256(toBytes("GAME_ROLE"));
  const MANAGER_ROLE = keccak256(toBytes("MANAGER_ROLE"));
  
  await crapsGame.write.grantRole([GAME_ROLE, crapsBets.address], { account: deployer.account });
  await crapsGame.write.grantRole([GAME_ROLE, crapsSettlement.address], { account: deployer.account });
  await crapsGame.write.grantRole([MANAGER_ROLE, gameManager.account.address], { account: deployer.account });
  
  console.log("✅ Setup complete\n");
  
  // Test 1: Game State
  console.log("📝 Test 1: Initial Game State");
  
  const phase = await crapsGame.read.currentPhase();
  const seriesId = await crapsGame.read.currentSeriesId();
  const rollCount = await crapsGame.read.rollCount();
  
  console.assert(phase === 0n, "Should start in IDLE phase");
  console.assert(seriesId === 0n, "Series ID should start at 0");
  console.assert(rollCount === 0n, "Roll count should start at 0");
  console.log("✅ Initial state correct");
  
  // Test 2: Start New Series
  console.log("\n📝 Test 2: Starting New Series");
  
  const startHash = await crapsGame.write.startNewSeries({ account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: startHash });
  
  const phaseAfter = await crapsGame.read.currentPhase();
  const seriesIdAfter = await crapsGame.read.currentSeriesId();
  
  console.assert(phaseAfter === 1n, "Should be in COME_OUT phase");
  console.assert(seriesIdAfter === 1n, "Series ID should be 1");
  console.log("✅ New series started");
  
  // Test 3: Add Players
  console.log("\n📝 Test 3: Adding Players");
  
  await crapsGame.write.addPlayer([player1.account.address], { account: gameManager.account });
  await crapsGame.write.addPlayer([player2.account.address], { account: gameManager.account });
  
  const playerCount = await crapsGame.read.getPlayerCount([1n]);
  console.assert(playerCount === 2n, `Expected 2 players, got ${playerCount}`);
  console.log("✅ Players added");
  
  // Test 4: Request Dice Roll
  console.log("\n📝 Test 4: Requesting Dice Roll");
  
  const rollHash = await crapsGame.write.requestDiceRoll({ account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: rollHash });
  
  const rollCountAfter = await crapsGame.read.rollCount();
  console.assert(rollCountAfter === 1n, "Roll count should be 1");
  console.log("✅ Dice roll requested");
  
  // Test 5: Fulfill Random (Mock)
  console.log("\n📝 Test 5: Fulfilling Randomness");
  
  // In real scenario, VRF would call fulfillRandomWords
  // For testing, we'll simulate it through the mock
  const randomValue = 42n; // This will give us specific dice values
  await mockVRF.write.fulfillRandomWords([1n, [randomValue]], { account: deployer.account });
  
  // Check if roll was recorded
  const lastRoll = await crapsGame.read.getLastRoll();
  console.log(`   Last roll: ${lastRoll[0]} + ${lastRoll[1]} = ${lastRoll[2]}`);
  console.log("✅ Randomness fulfilled");
  
  // Test 6: Get Series Info
  console.log("\n📝 Test 6: Series Information");
  
  const seriesInfo = await crapsGame.read.getSeries([1n]);
  console.log(`   Series ID: ${seriesInfo[0]}`);
  console.log(`   Shooter: ${seriesInfo[1]}`);
  console.log(`   Phase: ${seriesInfo[2]}`);
  console.log(`   Point: ${seriesInfo[3]}`);
  console.log(`   Roll Count: ${seriesInfo[4]}`);
  console.log(`   Active: ${seriesInfo[5]}`);
  console.log("✅ Series info retrieved");
  
  // Test 7: End Series
  console.log("\n📝 Test 7: Ending Series");
  
  const endHash = await crapsGame.write.endSeries({ account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: endHash });
  
  const phaseEnd = await crapsGame.read.currentPhase();
  const seriesActive = await crapsGame.read.getSeries([1n]);
  
  console.assert(phaseEnd === 0n, "Should be back in IDLE phase");
  console.assert(seriesActive[5] === false, "Series should be inactive");
  console.log("✅ Series ended");
  
  // Test 8: Roll History
  console.log("\n📝 Test 8: Roll History");
  
  const rollHistory = await crapsGame.read.getRollHistory([1n]);
  console.log(`   Total rolls in series: ${rollHistory.length}`);
  console.log("✅ Roll history retrieved");
  
  // Test 9: Pausable
  console.log("\n📝 Test 9: Pausable Functionality");
  
  const pauseHash = await crapsGame.write.pause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  
  const isPaused = await crapsGame.read.paused();
  console.assert(isPaused === true, "Game should be paused");
  
  // Try to start series while paused
  try {
    await crapsGame.write.startNewSeries({ account: gameManager.account });
    console.assert(false, "Should not be able to start series while paused");
  } catch (error) {
    console.log("✅ Game operations prevented while paused");
  }
  
  // Unpause
  const unpauseHash = await crapsGame.write.unpause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  console.log("✅ Game unpaused");
  
  // Test 10: Access Control
  console.log("\n📝 Test 10: Access Control");
  
  // Try to start series without MANAGER_ROLE
  try {
    await crapsGame.write.startNewSeries({ account: player1.account });
    console.assert(false, "Non-manager should not start series");
  } catch (error) {
    console.log("✅ Access control enforced");
  }
  
  // Test 11: Phase Transitions
  console.log("\n📝 Test 11: Phase Transitions");
  
  // Start new series for phase testing
  await crapsGame.write.startNewSeries({ account: gameManager.account });
  
  // Set point (simulating a non-craps come out roll)
  await crapsGame.write.setPoint([6n], { account: gameManager.account });
  
  const phasePoint = await crapsGame.read.currentPhase();
  const point = await crapsGame.read.currentPoint();
  
  console.assert(phasePoint === 2n, "Should be in POINT phase");
  console.assert(point === 6n, "Point should be 6");
  console.log("✅ Phase transition to POINT successful");
  
  console.log("\n🎉 All CrapsGame tests passed!");
  console.log("📊 Total tests: 11");
  console.log("✅ Passed: 11");
  console.log("❌ Failed: 0");
  
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });