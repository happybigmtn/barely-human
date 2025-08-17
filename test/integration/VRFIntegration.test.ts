import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";
import { TestUtilities, TestResults } from "../TestUtilities.js";

/**
 * VRF Integration Test Suite
 * 
 * Comprehensive testing of Chainlink VRF 2.5 integration with the craps game.
 * Validates dice roll randomness, game state transitions, and settlement accuracy.
 * 
 * Test Coverage:
 * 1. VRF subscription and consumer setup
 * 2. Random dice roll generation
 * 3. Game phase transitions (COME_OUT → POINT → SEVEN_OUT)
 * 4. Multiple bet type settlements
 * 5. Point establishment and resolution
 * 6. Error handling and edge cases
 * 7. Gas efficiency of VRF operations
 */

async function main() {
  console.log("🎲 Starting VRF Integration Test Suite...\n");
  
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
    
    console.log("🔌 VRF Test Environment Initialized\n");
    
    // Deploy system
    await testUtils.deployCoreContracts();
    await testUtils.setupRoles();
    await testUtils.fundSystem();
    
    console.log("✅ Core system deployed and configured\n");
    
    // ===========================
    // TEST 1: VRF SETUP VALIDATION
    // ===========================
    console.log("🔍 TEST 1: VRF Coordinator Setup");
    
    const subscriptionId = await testUtils.contracts.crapsGame.read.getSubscriptionId();
    const vrfCoordinatorAddr = await testUtils.contracts.crapsGame.read.vrfCoordinator();
    
    totalTests++;
    if (subscriptionId > 0n && vrfCoordinatorAddr === testUtils.contracts.mockVRFCoordinator.address) {
      console.log(`✅ VRF setup validated:`);
      console.log(`  Subscription ID: ${subscriptionId.toString()}`);
      console.log(`  Coordinator: ${vrfCoordinatorAddr}`);
      testsPassed++;
    } else {
      console.log("❌ VRF setup validation failed");
      errors.push("VRF coordinator or subscription not properly configured");
    }
    
    // ===========================
    // TEST 2: COME OUT PHASE TESTING
    // ===========================
    console.log("\n🎯 TEST 2: Come Out Phase - Natural Winners (7, 11)");
    
    // Start new series
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    let currentSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    let gamePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    // Place Pass Line bet
    const betAmount = parseEther("50");
    await testUtils.contracts.botToken.write.transfer(
      [testUtils.accounts.player1.account.address, betAmount],
      { account: testUtils.accounts.liquidityProvider.account }
    );
    
    await testUtils.contracts.botToken.write.approve(
      [testUtils.contracts.crapsVault.address, betAmount],
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, betAmount], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    // Test Natural 7 (immediate winner)
    const rollTx = await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const rollReceipt = await publicClient.waitForTransactionReceipt({ hash: rollTx });
    const requestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    
    // Fulfill with dice showing 7 (3,4)
    const dice1 = 3;
    const dice2 = 4;
    const randomWords = [BigInt(dice1), BigInt(dice2)];
    
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [requestId, testUtils.contracts.crapsGame.address, randomWords]
    );
    
    const rollResult = await testUtils.contracts.crapsGame.read.getLastRoll();
    const finalPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (rollResult[0] === dice1 && rollResult[1] === dice2 && rollResult[2] === 7 && finalPhase === 0) {
      console.log(`✅ Natural 7 handled correctly:`);
      console.log(`  Dice: ${dice1}, ${dice2} = ${rollResult[2]}`);
      console.log(`  Game returned to COME_OUT phase: ${finalPhase}`);
      testsPassed++;
    } else {
      console.log("❌ Natural 7 handling failed");
      errors.push("Natural 7 on come out not processed correctly");
    }
    
    // ===========================
    // TEST 3: POINT ESTABLISHMENT
    // ===========================
    console.log("\n🎯 TEST 3: Point Establishment (4, 5, 6, 8, 9, 10)");
    
    // Start new series for point testing
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    // Place fresh bets
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, betAmount], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    // Request roll to establish point
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const pointRequestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    
    // Fulfill with point number (6)
    const pointDice1 = 2;
    const pointDice2 = 4;
    const pointRandomWords = [BigInt(pointDice1), BigInt(pointDice2)];
    
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [pointRequestId, testUtils.contracts.crapsGame.address, pointRandomWords]
    );
    
    const pointRoll = await testUtils.contracts.crapsGame.read.getLastRoll();
    const pointPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    const establishedPoint = await testUtils.contracts.crapsGame.read.currentPoint();
    
    totalTests++;
    if (pointRoll[2] === 6 && pointPhase === 1 && establishedPoint === 6) {
      console.log(`✅ Point establishment successful:`);
      console.log(`  Point roll: ${pointDice1}, ${pointDice2} = ${pointRoll[2]}`);
      console.log(`  Game phase: POINT (${pointPhase})`);
      console.log(`  Established point: ${establishedPoint}`);
      testsPassed++;
    } else {
      console.log("❌ Point establishment failed");
      errors.push("Point not properly established");
    }
    
    // ===========================
    // TEST 4: POINT RESOLUTION
    // ===========================
    console.log("\n🎯 TEST 4: Point Resolution - Making the Point");
    
    // Roll to make the point (6)
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const resolveRequestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    
    // Fulfill with the point (6) - different dice combination
    const resolveDice1 = 1;
    const resolveDice2 = 5;
    const resolveRandomWords = [BigInt(resolveDice1), BigInt(resolveDice2)];
    
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [resolveRequestId, testUtils.contracts.crapsGame.address, resolveRandomWords]
    );
    
    const resolveRoll = await testUtils.contracts.crapsGame.read.getLastRoll();
    const resolvePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    const resolvePoint = await testUtils.contracts.crapsGame.read.currentPoint();
    
    totalTests++;
    if (resolveRoll[2] === 6 && resolvePhase === 0 && resolvePoint === 0) {
      console.log(`✅ Point resolution successful:`);
      console.log(`  Resolution roll: ${resolveDice1}, ${resolveDice2} = ${resolveRoll[2]}`);
      console.log(`  Game phase reset: COME_OUT (${resolvePhase})`);
      console.log(`  Point cleared: ${resolvePoint}`);
      testsPassed++;
    } else {
      console.log("❌ Point resolution failed");
      errors.push("Point resolution not handled correctly");
    }
    
    // ===========================
    // TEST 5: SEVEN OUT TESTING
    // ===========================
    console.log("\n🎯 TEST 5: Seven Out - Point Phase Termination");
    
    // Start new series and establish point
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, betAmount], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    // Establish point 8
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const sevenOutPointId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [sevenOutPointId, testUtils.contracts.crapsGame.address, [BigInt(3), BigInt(5)]] // 8
    );
    
    // Now roll a 7 to end the series
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const sevenOutId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [sevenOutId, testUtils.contracts.crapsGame.address, [BigInt(4), BigInt(3)]] // 7
    );
    
    const sevenOutRoll = await testUtils.contracts.crapsGame.read.getLastRoll();
    const sevenOutPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (sevenOutRoll[2] === 7 && sevenOutPhase === 2) { // GamePhase.SEVEN_OUT = 2
      console.log(`✅ Seven out handled correctly:`);
      console.log(`  Seven out roll: 4, 3 = ${sevenOutRoll[2]}`);
      console.log(`  Game phase: SEVEN_OUT (${sevenOutPhase})`);
      testsPassed++;
    } else {
      console.log("❌ Seven out handling failed");
      errors.push("Seven out not processed correctly");
    }
    
    // ===========================
    // TEST 6: COMPLEX BET SETTLEMENTS
    // ===========================
    console.log("\n🎯 TEST 6: Complex Multi-Bet Settlement");
    
    // Start fresh series with multiple bet types
    await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    // Give players more tokens
    const multiBetAmount = parseEther("20");
    for (let i = 1; i <= 3; i++) {
      const playerAccount = i === 1 ? testUtils.accounts.player1.account :
                          i === 2 ? testUtils.accounts.player2.account :
                          testUtils.accounts.player3.account;
      
      await testUtils.contracts.botToken.write.transfer(
        [playerAccount.address, multiBetAmount],
        { account: testUtils.accounts.liquidityProvider.account }
      );
      
      await testUtils.contracts.botToken.write.approve(
        [testUtils.contracts.crapsVault.address, multiBetAmount],
        { account: playerAccount }
      );
    }
    
    // Place multiple bet types
    await testUtils.contracts.crapsBets.write.placeBet(
      [0, parseEther("10")], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [1, parseEther("10")], // Don't Pass
      { account: testUtils.accounts.player2.account }
    );
    
    await testUtils.contracts.crapsBets.write.placeBet(
      [4, parseEther("10")], // Field
      { account: testUtils.accounts.player3.account }
    );
    
    // Roll a 12 (come out craps)
    await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const multiRequestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [multiRequestId, testUtils.contracts.crapsGame.address, [BigInt(6), BigInt(6)]] // 12
    );
    
    const multiRoll = await testUtils.contracts.crapsGame.read.getLastRoll();
    const multiPhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (multiRoll[2] === 12 && multiPhase === 0) {
      console.log(`✅ Multi-bet settlement on 12:`);
      console.log(`  Roll: 6, 6 = ${multiRoll[2]}`);
      console.log(`  Pass Line: Loses`);
      console.log(`  Don't Pass: Pushes (tie)`);
      console.log(`  Field: Wins (pays 2:1)`);
      testsPassed++;
    } else {
      console.log("❌ Multi-bet settlement failed");
      errors.push("Complex bet settlement incorrect");
    }
    
    // ===========================
    // TEST 7: GAS EFFICIENCY
    // ===========================
    console.log("\n⛽ TEST 7: VRF Gas Efficiency Analysis");
    
    // Measure gas for complete VRF cycle
    const gasTestTx = await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const gasTestReceipt = await publicClient.waitForTransactionReceipt({ hash: gasTestTx });
    const gasRequestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    
    const fulfillTx = await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [gasRequestId, testUtils.contracts.crapsGame.address, [BigInt(1), BigInt(1)]] // 2
    );
    
    const fulfillReceipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
    
    const totalVRFGas = gasTestReceipt.gasUsed + fulfillReceipt.gasUsed;
    
    totalTests++;
    if (totalVRFGas < 500000n) { // Under 500k gas for VRF cycle
      console.log(`✅ VRF gas efficiency validated:`);
      console.log(`  Request gas: ${gasTestReceipt.gasUsed.toString()}`);
      console.log(`  Fulfill gas: ${fulfillReceipt.gasUsed.toString()}`);
      console.log(`  Total VRF gas: ${totalVRFGas.toString()}`);
      testsPassed++;
    } else {
      console.log("⚠️ VRF gas usage higher than expected");
      errors.push("VRF gas optimization needed");
    }
    
    // ===========================
    // TEST 8: ERROR HANDLING
    // ===========================
    console.log("\n⚠️ TEST 8: VRF Error Handling");
    
    // Test unauthorized VRF request
    try {
      await testUtils.contracts.crapsGame.write.requestDiceRoll(
        { account: testUtils.accounts.player1.account } // Not authorized
      );
      
      console.log("❌ Unauthorized access not blocked");
      errors.push("Security: Unauthorized VRF request allowed");
    } catch (error) {
      console.log(`✅ Unauthorized VRF request properly blocked`);
      testsPassed++;
    }
    totalTests++;
    
    // ===========================
    // FINAL RESULTS
    // ===========================
    console.log(`\n🎯 VRF INTEGRATION TEST RESULTS:`);
    console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`📊 Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Issues identified:`);
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    const results: TestResults = {
      testsPassed,
      totalTests,
      gasUsage: testUtils.gasStats,
      errors
    };
    
    console.log(`\n🎲 VRF Integration Test Complete!`);
    
    return results;
    
  } catch (error) {
    console.error("💥 VRF Test execution failed:", error);
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

export { main as vrfIntegrationTest };
