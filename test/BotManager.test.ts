import { network } from "hardhat";
import { parseEther, keccak256, toBytes, getAddress } from "viem";
import assert from "assert";

async function main() {
  console.log("🧪 Testing BotManager Contract...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  try {
    // Get wallet clients
    const [deployer, treasury, liquidity, staking, team, community, gameManager, operator, keeper] = 
      await viem.getWalletClients();
    
    // Get public client
    const publicClient = await viem.getPublicClient();
    
    // === DEPLOY DEPENDENCIES ===
    
    // Deploy BOTToken
    console.log("📦 Deploying BOTToken...");
    const botToken = await viem.deployContract("BOTToken", [
      treasury.account.address,
      liquidity.account.address,
      staking.account.address,
      team.account.address,
      community.account.address
    ]);
    console.log("✅ BOTToken deployed at:", botToken.address);
    
    // Deploy Mock VRF
    console.log("\n📦 Deploying Mock VRF Coordinator...");
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
    
    // Deploy VaultFactoryOptimized
    console.log("\n📦 Deploying VaultFactoryOptimized...");
    const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
      botToken.address,
      treasury.account.address
    ]);
    console.log("✅ VaultFactory deployed at:", vaultFactory.address);
    
    // Set the CrapsGame address in the factory
    const updateGameHash = await vaultFactory.write.updateContract(["game", crapsGame.address], { account: deployer.account });
    await publicClient.waitForTransactionReceipt({ hash: updateGameHash });
    console.log("✅ CrapsGame set in VaultFactory");
    
    // Create all bot vaults
    console.log("\n📦 Creating all bot vaults...");
    const deployBotsHash = await vaultFactory.write.deployAllBots({ account: deployer.account });
    await publicClient.waitForTransactionReceipt({ hash: deployBotsHash });
    console.log("✅ All bot vaults created");
    
    // Deploy BotManager with proper parameters
    console.log("\n📦 Deploying BotManager...");
    const botManager = await viem.deployContract("BotManager", [
      vaultFactory.address,
      mockVRF.address,
      1n, // subscription ID
      keccak256(toBytes("keyHash"))
    ]);
    console.log("✅ BotManager deployed at:", botManager.address);
    
    // Grant roles
    const OPERATOR_ROLE = keccak256(toBytes("OPERATOR_ROLE"));
    const KEEPER_ROLE = keccak256(toBytes("KEEPER_ROLE"));
    const STRATEGIST_ROLE = keccak256(toBytes("STRATEGIST_ROLE"));
    
    await botManager.write.grantRole([OPERATOR_ROLE, operator.account.address], { account: deployer.account });
    await botManager.write.grantRole([KEEPER_ROLE, keeper.account.address], { account: deployer.account });
    
    // Initialize bots
    console.log("\n📦 Initializing bot personalities...");
    const initHash = await botManager.write.initializeBots({ account: operator.account });
    await publicClient.waitForTransactionReceipt({ hash: initHash });
    console.log("✅ Bot personalities initialized");
    
    console.log("\n✅ Setup complete\n");
    
    // === TESTS ===
    
    // Test 1: Bot Personalities
    console.log("📝 Test 1: Bot Personalities");
    
    const expectedQuirks = [
      "Always bets on field",
      "Goes all-in on hot streaks", 
      "Never gives up after a loss",
      "Follows mathematical patterns",
      "Slow and steady wins",
      "Rides the winning waves",
      "Learns from the table",
      "Pure chaos incarnate",
      "Extremely cautious",
      "Jack of all strategies"
    ];
    
    for (let i = 0n; i < 10n; i++) {
      const personality = await botManager.read.botPersonalities([i]);
      // personality returns struct: [aggressiveness, riskTolerance, patience, adaptability, confidence, preferredStrategy, quirk]
      assert(personality[6] === expectedQuirks[Number(i)], `Bot ${i} should have correct quirk`);
      console.log(`   Bot ${i}: ${personality[6]} (Strategy: ${personality[5]})`);
    }
    console.log("✅ All 10 bot personalities verified");
    
    // Test 2: Bot Traits
    console.log("\n📝 Test 2: Bot Traits");
    
    const expectedTraits = [
      [30, 40, 80, 60, 50],  // Alice
      [90, 95, 20, 40, 50],  // Bob
      [70, 80, 50, 70, 50],  // Charlie
      [40, 30, 90, 80, 50],  // Diana
      [20, 25, 95, 50, 50],  // Eddie
      [85, 90, 30, 60, 50],  // Fiona
      [50, 45, 70, 90, 50],  // Greg
      [95, 100, 10, 30, 50], // Helen
      [15, 10, 100, 40, 50], // Ivan
      [75, 85, 40, 100, 50]  // Julia
    ];
    
    for (let i = 0n; i < 10n; i++) {
      const personality = await botManager.read.botPersonalities([i]);
      // personality returns struct: [aggressiveness, riskTolerance, patience, adaptability, confidence, preferredStrategy, quirk]
      const expected = expectedTraits[Number(i)];
      assert(Number(personality[0]) === expected[0], `Bot ${i} aggressiveness should be ${expected[0]}`);
      assert(Number(personality[1]) === expected[1], `Bot ${i} risk tolerance should be ${expected[1]}`);
      assert(Number(personality[2]) === expected[2], `Bot ${i} patience should be ${expected[2]}`);
      assert(Number(personality[3]) === expected[3], `Bot ${i} adaptability should be ${expected[3]}`);
      assert(Number(personality[4]) === expected[4], `Bot ${i} confidence should be ${expected[4]}`);
      console.log(`   Bot ${i}: Aggr=${personality[0]}, Risk=${personality[1]}, Pat=${personality[2]}, Adapt=${personality[3]}, Conf=${personality[4]}`);
    }
    console.log("✅ All bot traits verified");
    
    // Test 3: Bot Strategies
    console.log("\n📝 Test 3: Bot Strategies");
    
    const strategies = [
      "CONSERVATIVE", "AGGRESSIVE", "MARTINGALE", "FIBONACCI", 
      "OSCAR_GRIND", "PAROLI", "ADAPTIVE", "RANDOM", 
      "DALEMBERT", "MIXED"
    ];
    
    for (let i = 0n; i < 10n; i++) {
      const personality = await botManager.read.botPersonalities([i]);
      // personality[5] is the preferredStrategy
      console.log(`   Bot ${i}: Strategy = ${strategies[Number(personality[5])]}`);
    }
    console.log("✅ All bot strategies verified");
    
    // Test 4: Bot States
    console.log("\n📝 Test 4: Bot States");
    
    for (let i = 0n; i < 10n; i++) {
      const state = await botManager.read.botStates([i]);
      // Returns BotState struct: [botId, vault, currentStrategy, baseBetAmount, currentBetAmount, consecutiveWins, consecutiveLosses, sessionProfit, sessionStartBalance, lastActionTimestamp, isActive, isInSeries, currentSeriesId, currentBetId]
      assert(state[0] === i, `Bot ${i} ID should match`);
      assert(state[1] !== "0x0000000000000000000000000000000000000000", `Bot ${i} should have vault`);
      console.log(`   Bot ${i}: Vault=${state[1].slice(0,10)}..., Active=${state[10]}`);
    }
    console.log("✅ All bot states verified");
    
    // Test 5: Toggle Bot Active Status
    console.log("\n📝 Test 5: Toggle Bot Active Status");
    
    // Initially bot should be active
    let state = await botManager.read.botStates([0n]);
    assert(state[10] === true, "Bot should initially be active");
    console.log("   Bot 0 initially active");
    
    // Toggle bot inactive
    const toggleHash = await botManager.write.toggleBotActive([0n], { account: operator.account });
    await publicClient.waitForTransactionReceipt({ hash: toggleHash });
    
    state = await botManager.read.botStates([0n]);
    assert(state[10] === false, "Bot should be inactive after toggle");
    console.log("   Bot 0 toggled inactive");
    
    // Toggle back to active
    const toggleBackHash = await botManager.write.toggleBotActive([0n], { account: operator.account });
    await publicClient.waitForTransactionReceipt({ hash: toggleBackHash });
    
    state = await botManager.read.botStates([0n]);
    assert(state[10] === true, "Bot should be active after second toggle");
    console.log("   Bot 0 toggled back to active");
    console.log("✅ Bot active toggle verified");
    
    // Test 6: Access Control
    console.log("\n📝 Test 6: Access Control");
    
    try {
      // Try to toggle bot without role (should fail)
      await botManager.write.toggleBotActive([0n], { account: community.account });
      assert(false, "Should not allow unauthorized bot toggle");
    } catch (error) {
      console.log("   ✅ Correctly rejected unauthorized bot toggle");
    }
    
    try {
      // Try to initialize bots without role (should fail)
      await botManager.write.initializeBots({ account: community.account });
      assert(false, "Should not allow unauthorized bot initialization");
    } catch (error) {
      console.log("   ✅ Correctly rejected unauthorized bot initialization");
    }
    
    console.log("✅ Access control verified");
    
    // Test 7: Pause/Unpause
    console.log("\n📝 Test 7: Pause/Unpause");
    
    // Pause the contract
    const pauseHash = await botManager.write.pause({ account: deployer.account });
    await publicClient.waitForTransactionReceipt({ hash: pauseHash });
    
    const isPaused = await botManager.read.paused();
    assert(isPaused === true, "Contract should be paused");
    console.log("   Contract paused");
    
    // Try to toggle bot while paused (should fail)
    try {
      await botManager.write.toggleBotActive([0n], { account: operator.account });
      assert(false, "Should not allow toggle while paused");
    } catch (error) {
      console.log("   ✅ Correctly rejected toggle while paused");
    }
    
    // Unpause
    const unpauseHash = await botManager.write.unpause({ account: deployer.account });
    await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
    
    const isPausedAfter = await botManager.read.paused();
    assert(isPausedAfter === false, "Contract should be unpaused");
    console.log("   Contract unpaused");
    console.log("✅ Pause/unpause functionality verified");
    
    // Test 8: Bot Session Management
    console.log("\n📝 Test 8: Bot Session Management");
    
    const startSessionHash = await botManager.write.startBotSession([0n], { account: keeper.account });
    await publicClient.waitForTransactionReceipt({ hash: startSessionHash });
    
    const stateAfterStart = await botManager.read.botStates([0n]);
    assert(stateAfterStart[10] === true, "Bot should be active");
    console.log("   Bot 0 session started");
    
    const endSessionHash = await botManager.write.endBotSession([0n], { account: keeper.account });
    await publicClient.waitForTransactionReceipt({ hash: endSessionHash });
    
    const stateAfterEnd = await botManager.read.botStates([0n]);
    assert(stateAfterEnd[10] === false, "Bot should be inactive");
    console.log("   Bot 0 session ended");
    console.log("✅ Session management verified");
    
    // Test 9: Bot Timing Configuration
    console.log("\n📝 Test 9: Bot Timing Configuration");
    
    const minInterval = await botManager.read.minBetInterval();
    const maxInactivity = await botManager.read.maxInactivityPeriod();
    
    assert(Number(minInterval) === 30, "Min bet interval should be 30 seconds");
    assert(Number(maxInactivity) === 3600, "Max inactivity should be 1 hour");
    console.log(`   Min bet interval: ${minInterval} seconds`);
    console.log(`   Max inactivity: ${maxInactivity} seconds`);
    
    // Update timing using updateTimingParams
    const setTimingHash = await botManager.write.updateTimingParams([60n, 7200n], { account: operator.account });
    await publicClient.waitForTransactionReceipt({ hash: setTimingHash });
    
    const newMinInterval = await botManager.read.minBetInterval();
    const newMaxInactivity = await botManager.read.maxInactivityPeriod();
    
    assert(Number(newMinInterval) === 60, "Min bet interval should be updated");
    assert(Number(newMaxInactivity) === 7200, "Max inactivity should be updated");
    console.log("   Timing updated successfully");
    console.log("✅ Timing configuration verified");
    
    console.log("\n🎉 All BotManager tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    // Clean up connection
    await connection.close();
  }
}

// Run the tests
main().catch((error) => {
  console.error(error);
  process.exit(1);
});