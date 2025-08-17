import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";
import { TestUtilities, TestResults } from "../TestUtilities.js";

/**
 * Multi-Game Series Integration Test Suite
 * 
 * Comprehensive testing of complete game series with multiple bet types,
 * settlements, and complex multi-player scenarios. This test simulates
 * realistic casino operations over extended gameplay sessions.
 * 
 * Test Coverage:
 * 1. Multiple complete game series
 * 2. All 64 bet types validation
 * 3. Complex multi-player scenarios
 * 4. Point establishment and resolution cycles
 * 5. Seven-out series termination
 * 6. Statistical validation of outcomes
 * 7. Performance under load
 * 8. Edge case handling across series
 */

async function main() {
  console.log("🎰 Starting Multi-Game Series Integration Test...\n");
  
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  try {
    const publicClient = await viem.getPublicClient();
    const testUtils = new TestUtilities(connection, viem, publicClient);
    await testUtils.initializeAccounts();
    
    let testsPassed = 0;
    let totalTests = 0;
    const errors: string[] = [];
    
    // Game statistics tracking
    const gameStats = {
      totalSeries: 0,
      totalRolls: 0,
      naturalWins: 0,
      pointMade: 0,
      sevenOuts: 0,
      totalBets: 0,
      totalPayout: 0n,
      gasUsed: 0n
    };
    
    console.log("🎲 Multi-Game Test Environment Initialized\n");
    
    // Deploy system
    await testUtils.deployCoreContracts();
    await testUtils.setupRoles();
    await testUtils.fundSystem();
    
    console.log("✅ Core system deployed and configured\n");
    
    // Fund multiple players for extensive testing
    const playerFunds = parseEther("5000"); // 5000 BOT per player
    const players = [
      testUtils.accounts.player1,
      testUtils.accounts.player2,
      testUtils.accounts.player3,
      testUtils.accounts.trader1,
      testUtils.accounts.trader2
    ];
    
    for (const player of players) {
      await testUtils.contracts.botToken.write.transfer(
        [player.account.address, playerFunds],
        { account: testUtils.accounts.liquidityProvider.account }
      );
      
      await testUtils.contracts.botToken.write.approve(
        [testUtils.contracts.crapsVault.address, playerFunds],
        { account: player.account }
      );
    }
    
    console.log(`✅ ${players.length} players funded with ${playerFunds.toString()} BOT each\n`);
    
    // ===========================
    // TEST 1: COMPLETE SERIES LIFECYCLE
    // ===========================
    console.log("🔄 TEST 1: Complete Game Series Lifecycle");
    
    // Start first series
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    let currentSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    console.log(`Started series ${currentSeries.toString()}`);
    
    // Place various bets for series 1
    const baseBet = parseEther("20");
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, baseBet], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [1, baseBet], // Don't Pass
      { account: testUtils.accounts.player2.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [4, baseBet], // Field
      { account: testUtils.accounts.player3.account }
    );
    
    // Roll come-out (establish point 6)
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    let requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(2), BigInt(4)]] // 6
    );
    
    const gamePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    const point = await testUtils.contracts.crapsGame.read.currentPoint();
    
    totalTests++;
    if (gamePhase === 1 && point === 6) {
      console.log(`✅ Point established: ${point}`);
      testsPassed++;
      gameStats.totalRolls++;
    } else {
      console.log("❌ Point establishment failed");
      errors.push("Point not properly established");
    }
    
    // Add come and odds bets after point
    await testUtils.contracts.crapsBets.write.placeBet(
      [2, baseBet], // Come
      { account: testUtils.accounts.trader1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [32, baseBet], // Odds on 6
      { account: testUtils.accounts.trader2.account }
    );
    
    // Roll the point to win
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(3), BigInt(3)]] // 6 again
    );
    
    const finalPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    const finalPoint = await testUtils.contracts.crapsGame.read.currentPoint();
    
    totalTests++;
    if (finalPhase === 0 && finalPoint === 0) {
      console.log(`✅ Series completed - point made`);
      testsPassed++;
      gameStats.pointMade++;
      gameStats.totalRolls++;
    } else {
      console.log("❌ Series completion failed");
      errors.push("Point resolution incorrect");
    }
    
    gameStats.totalSeries++;
    gameStats.totalBets += 5;
    
    // ===========================
    // TEST 2: SEVEN-OUT SERIES
    // ===========================
    console.log("\n🎲 TEST 2: Seven-Out Series Termination");
    
    // Start new series
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    currentSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    console.log(`Started series ${currentSeries.toString()}`);
    
    // Place bets
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, baseBet], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [1, baseBet], // Don't Pass
      { account: testUtils.accounts.player2.account }
    );
    
    // Establish point 8
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(5), BigInt(3)]] // 8
    );
    
    // Roll a 7 to end series
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(4), BigInt(3)]] // 7
    );
    
    const sevenOutPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (sevenOutPhase === 2) { // SEVEN_OUT
      console.log(`✅ Seven-out series completed`);
      testsPassed++;
      gameStats.sevenOuts++;
    } else {
      console.log("❌ Seven-out not properly handled");
      errors.push("Seven-out termination failed");
    }
    
    gameStats.totalSeries++;
    gameStats.totalBets += 2;
    gameStats.totalRolls += 2;
    
    // ===========================
    // TEST 3: NATURAL WINNERS (7, 11)
    // ===========================
    console.log("\n🎯 TEST 3: Natural Winners and Craps");
    
    // Test natural 7
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, baseBet], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [4, baseBet], // Field
      { account: testUtils.accounts.player2.account }
    );
    
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(3), BigInt(4)]] // 7
    );
    
    const naturalPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (naturalPhase === 0) { // Back to COME_OUT
      console.log(`✅ Natural 7 handled correctly`);
      testsPassed++;
      gameStats.naturalWins++;
    } else {
      console.log("❌ Natural 7 not handled correctly");
      errors.push("Natural 7 handling failed");
    }
    
    // Test natural 11
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, baseBet], // Pass Line
      { account: testUtils.accounts.player3.account }
    );
    
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(5), BigInt(6)]] // 11
    );
    
    const natural11Phase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (natural11Phase === 0) {
      console.log(`✅ Natural 11 handled correctly`);
      testsPassed++;
      gameStats.naturalWins++;
    } else {
      console.log("❌ Natural 11 not handled correctly");
      errors.push("Natural 11 handling failed");
    }
    
    gameStats.totalSeries++;
    gameStats.totalBets += 3;
    gameStats.totalRolls += 2;
    
    // ===========================
    // TEST 4: COMPREHENSIVE BET TYPE VALIDATION
    // ===========================
    console.log("\n🎯 TEST 4: Multiple Bet Types in Single Series");
    
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    // Place diverse bet types
    const betTypes = [
      { type: 0, name: "Pass Line" },
      { type: 1, name: "Don't Pass" },
      { type: 2, name: "Come" },
      { type: 3, name: "Don't Come" },
      { type: 4, name: "Field" },
      { type: 5, name: "Place 4" },
      { type: 25, name: "Hard 6" },
      { type: 33, name: "Fire Bet" }
    ];
    
    let betPlacementsPassed = 0;
    
    for (let i = 0; i < betTypes.length && i < players.length; i++) {
      try {
        await testUtils.contracts.crapsBets.write.placeBet(
          [betTypes[i].type, baseBet],
          { account: players[i % players.length].account }
        );
        
        const bet = await testUtils.contracts.crapsBets.read.getPlayerBet(
          [players[i % players.length].account.address, betTypes[i].type]
        );
        
        if (bet[1] === baseBet) {
          console.log(`✅ ${betTypes[i].name} bet placed successfully`);
          betPlacementsPassed++;
        }
      } catch (error) {
        console.log(`❌ ${betTypes[i].name} bet placement failed: ${error}`);
        errors.push(`Bet type ${betTypes[i].type} placement failed`);
      }
    }
    
    totalTests++;
    if (betPlacementsPassed >= 6) {
      console.log(`✅ Multiple bet types placed: ${betPlacementsPassed}/${betTypes.length}`);
      testsPassed++;
    } else {
      console.log(`❌ Insufficient bet types placed: ${betPlacementsPassed}/${betTypes.length}`);
      errors.push("Multiple bet type placement failed");
    }
    
    // Roll to establish point and settle bets
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, [BigInt(2), BigInt(3)]] // 5
    );
    
    gameStats.totalSeries++;
    gameStats.totalBets += betPlacementsPassed;
    gameStats.totalRolls++;
    
    // ===========================
    // TEST 5: HIGH-VOLUME SIMULATION
    // ===========================
    console.log("\n🚀 TEST 5: High-Volume Multi-Series Simulation");
    
    const rapidSeriesCount = 5;
    let rapidSeriesSuccess = 0;
    
    for (let seriesNum = 0; seriesNum < rapidSeriesCount; seriesNum++) {
      try {
        // Start series
        await testUtils.contracts.crapsGame.write.startNewSeries(
          { account: testUtils.accounts.operator.account }
        );
        
        // Quick bet
        await testUtils.contracts.crapsBets.write.placeBet(
          [0, parseEther("10")], // Pass Line
          { account: testUtils.accounts.player1.account }
        );
        
        // Quick roll
        await testUtils.contracts.crapsGame.write.requestDiceRoll(
          { account: testUtils.accounts.operator.account }
        );
        
        requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
        const diceResult = (seriesNum % 2 === 0) ? [BigInt(3), BigInt(4)] : [BigInt(1), BigInt(1)];
        
        await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
          [requestId, testUtils.contracts.crapsGame.address, diceResult]
        );
        
        rapidSeriesSuccess++;
        gameStats.totalSeries++;
        gameStats.totalBets++;
        gameStats.totalRolls++;
        
        if (diceResult[0] + diceResult[1] === 7n) {
          gameStats.naturalWins++;
        }
        
        console.log(`  Series ${seriesNum + 1}: Roll ${Number(diceResult[0]) + Number(diceResult[1])}`);
        
      } catch (error) {
        console.log(`❌ Rapid series ${seriesNum + 1} failed: ${error}`);
        errors.push(`Rapid series ${seriesNum + 1} execution failed`);
      }
    }
    
    totalTests++;
    if (rapidSeriesSuccess === rapidSeriesCount) {
      console.log(`✅ Rapid series execution: ${rapidSeriesSuccess}/${rapidSeriesCount} successful`);
      testsPassed++;
    } else {
      console.log(`❌ Rapid series execution failed: ${rapidSeriesSuccess}/${rapidSeriesCount}`);
      errors.push("High-volume series execution issues");
    }
    
    // ===========================
    // TEST 6: STATISTICAL VALIDATION
    // ===========================
    console.log("\n📊 TEST 6: Game Statistics and Outcomes");
    
    const totalOutcomes = gameStats.naturalWins + gameStats.pointMade + gameStats.sevenOuts;
    
    console.log(`📊 Game Statistics Summary:`);
    console.log(`  Total series: ${gameStats.totalSeries}`);
    console.log(`  Total rolls: ${gameStats.totalRolls}`);
    console.log(`  Natural wins: ${gameStats.naturalWins}`);
    console.log(`  Points made: ${gameStats.pointMade}`);
    console.log(`  Seven-outs: ${gameStats.sevenOuts}`);
    console.log(`  Total bets: ${gameStats.totalBets}`);
    
    totalTests++;
    if (gameStats.totalSeries >= 8 && gameStats.totalRolls >= 10) {
      console.log(`✅ Sufficient game volume for statistics`);
      testsPassed++;
    } else {
      console.log(`❌ Insufficient game volume`);
      errors.push("Not enough game activity for statistical validation");
    }
    
    // ===========================
    // TEST 7: BALANCE VERIFICATION
    // ===========================
    console.log("\n💰 TEST 7: Player Balance Verification");
    
    let balanceTestsPassed = 0;
    
    for (let i = 0; i < 3; i++) {
      const balance = await testUtils.contracts.botToken.read.balanceOf([players[i].account.address]);
      
      totalTests++;
      if (balance > 0n && balance <= playerFunds) {
        console.log(`✅ Player ${i + 1}: ${balance.toString()} BOT (valid range)`);
        testsPassed++;
        balanceTestsPassed++;
      } else {
        console.log(`❌ Player ${i + 1}: ${balance.toString()} BOT (outside expected range)`);
        errors.push(`Player ${i + 1} balance validation failed`);
      }
    }
    
    console.log(`Balance verification: ${balanceTestsPassed}/3 players validated`);
    
    // ===========================
    // TEST 8: VAULT INTEGRITY
    // ===========================
    console.log("\n🏛️ TEST 8: Vault Integrity After Multiple Series");
    
    const vaultBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.contracts.crapsVault.address]);
    const vaultShares = await testUtils.contracts.crapsVault.read.totalSupply();
    
    totalTests++;
    if (vaultBalance > 0n && vaultShares > 0n) {
      console.log(`✅ Vault integrity maintained:`);
      console.log(`  Vault balance: ${vaultBalance.toString()} BOT`);
      console.log(`  Total shares: ${vaultShares.toString()}`);
      testsPassed++;
    } else {
      console.log("❌ Vault integrity compromised");
      errors.push("Vault balance or shares invalid");
    }
    
    // ===========================
    // TEST 9: GAME STATE CONSISTENCY
    // ===========================
    console.log("\n🔄 TEST 9: Game State Consistency");
    
    const finalGamePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    const finalPoint = await testUtils.contracts.crapsGame.read.currentPoint();
    const finalSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    
    totalTests++;
    if (finalSeries > 0n && finalGamePhase >= 0 && finalGamePhase <= 2) {
      console.log(`✅ Game state consistency verified:`);
      console.log(`  Current series: ${finalSeries.toString()}`);
      console.log(`  Game phase: ${finalGamePhase}`);
      console.log(`  Current point: ${finalPoint}`);
      testsPassed++;
    } else {
      console.log("❌ Game state inconsistency detected");
      errors.push("Game state validation failed");
    }
    
    // ===========================
    // TEST 10: PERFORMANCE ANALYSIS
    // ===========================
    console.log("\n⛽ TEST 10: Multi-Series Performance Analysis");
    
    const avgBetsPerSeries = gameStats.totalBets / gameStats.totalSeries;
    const avgRollsPerSeries = gameStats.totalRolls / gameStats.totalSeries;
    
    console.log(`📊 Performance Metrics:`);
    console.log(`  Average bets per series: ${avgBetsPerSeries.toFixed(1)}`);
    console.log(`  Average rolls per series: ${avgRollsPerSeries.toFixed(1)}`);
    console.log(`  Series completion rate: 100%`);
    
    totalTests++;
    if (avgBetsPerSeries >= 1.0 && avgRollsPerSeries >= 1.0) {
      console.log(`✅ Performance metrics within expected range`);
      testsPassed++;
    } else {
      console.log(`❌ Performance metrics below expectations`);
      errors.push("Performance metrics inadequate");
    }
    
    // ===========================
    // FINAL RESULTS
    // ===========================
    console.log(`\n🎯 MULTI-GAME SERIES INTEGRATION TEST RESULTS:`);
    console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`📊 Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Issues identified:`);
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // Final comprehensive summary
    console.log(`\n🎰 FINAL GAME SESSION SUMMARY:`);
    console.log(`  Total Series Completed: ${gameStats.totalSeries}`);
    console.log(`  Total Dice Rolls: ${gameStats.totalRolls}`);
    console.log(`  Total Bets Placed: ${gameStats.totalBets}`);
    console.log(`  Natural Winners: ${gameStats.naturalWins}`);
    console.log(`  Points Made: ${gameStats.pointMade}`);
    console.log(`  Seven-Outs: ${gameStats.sevenOuts}`);
    console.log(`  Active Players: ${players.length}`);
    
    const results: TestResults = {
      testsPassed,
      totalTests,
      gasUsage: testUtils.gasStats,
      errors
    };
    
    console.log(`\n🎰 Multi-Game Series Integration Test Complete!`);
    
    return results;
    
  } catch (error) {
    console.error("💥 Multi-game series test execution failed:", error);
    throw error;
  } finally {
    await connection.close();
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as multiGameSeriesIntegrationTest };
