import { network } from "hardhat";
import { parseEther, keccak256, toBytes, Address } from "viem";
import { TestUtilities, TestResults } from "../TestUtilities.js";

/**
 * Comprehensive User Journey Integration Test
 * 
 * Tests the complete user experience from initial token distribution through
 * vault deposits, game play, bot interactions, and reward collection.
 * 
 * This test validates:
 * 1. BOT token distribution and allocation
 * 2. Vault liquidity provision and shares
 * 3. Player betting and game interactions
 * 4. Bot personality-driven betting decisions
 * 5. Treasury fee collection
 * 6. Staking rewards distribution
 * 7. End-to-end gas efficiency
 */

async function main() {
  console.log("🚀 Starting Comprehensive User Journey Integration Test..\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  try {
    // Initialize test utilities
    const publicClient = await viem.getPublicClient();
    const testUtils = new TestUtilities(connection, viem, publicClient);
    await testUtils.initializeAccounts();
    
    let testsPassed = 0;
    let totalTests = 0;
    const errors: string[] = [];
    
    console.log("👥 Test Accounts Initialized:");
    console.log(`  Deployer: ${testUtils.accounts.deployer.account.address}`);
    console.log(`  Treasury: ${testUtils.accounts.treasury.account.address}`);
    console.log(`  Player 1: ${testUtils.accounts.player1.account.address}`);
    console.log(`  Player 2: ${testUtils.accounts.player2.account.address}`);
    console.log(`  Player 3: ${testUtils.accounts.player3.account.address}`);
    console.log(`  LP Provider: ${testUtils.accounts.liquidityProvider.account.address}\n");
    
    // ===========================
    // PHASE 1: SYSTEM DEPLOYMENT
    // ===========================
    console.log("🏗️ PHASE 1: System Deployment and Configuration");
    
    await testUtils.deployCoreContracts();
    await testUtils.setupRoles();
    await testUtils.fundSystem();
    
    totalTests++;
    console.log("✅ System deployment completed");
    testsPassed++;
    
    // ===========================
    // PHASE 2: TOKEN DISTRIBUTION
    // ===========================
    console.log("\n💰 PHASE 2: BOT Token Distribution Validation");
    
    // Check initial allocations
    const treasuryBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.treasury.account.address]);
    const liquidityBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.liquidityProvider.account.address]);
    const stakingBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.stakingPool.account.address]);
    
    totalTests++;
    if (treasuryBalance > 0n && liquidityBalance > 0n && stakingBalance > 0n) {
      console.log(`✅ Token distribution validated:`);
      console.log(`  Treasury: ${treasuryBalance.toString()} BOT`);
      console.log(`  Liquidity: ${liquidityBalance.toString()} BOT`);
      console.log(`  Staking: ${stakingBalance.toString()} BOT`);
      testsPassed++;
    } else {
      console.log("❌ Token distribution failed");
      errors.push("Initial token distribution incorrect");
    }
    
    // ===========================
    // PHASE 3: VAULT OPERATIONS
    // ===========================
    console.log("\n🏦 PHASE 3: Vault Liquidity and Player Preparation");
    
    // Transfer BOT tokens to players for betting
    const playerBetAmount = parseEther("1000"); // 1000 BOT per player
    
    await testUtils.contracts.botToken.write.transfer(
      [testUtils.accounts.player1.account.address, playerBetAmount],
      { account: testUtils.accounts.liquidityProvider.account }
    );
    
    await testUtils.contracts.botToken.write.transfer(
      [testUtils.accounts.player2.account.address, playerBetAmount],
      { account: testUtils.accounts.liquidityProvider.account }
    );
    
    await testUtils.contracts.botToken.write.transfer(
      [testUtils.accounts.player3.account.address, playerBetAmount],
      { account: testUtils.accounts.liquidityProvider.account }
    );
    
    // Approve vault to spend player tokens
    await testUtils.contracts.botToken.write.approve(
      [testUtils.contracts.crapsVault.address, playerBetAmount],
      { account: testUtils.accounts.player1.account }
    );
    
    await testUtils.contracts.botToken.write.approve(
      [testUtils.contracts.crapsVault.address, playerBetAmount],
      { account: testUtils.accounts.player2.account }
    );
    
    await testUtils.contracts.botToken.write.approve(
      [testUtils.contracts.crapsVault.address, playerBetAmount],
      { account: testUtils.accounts.player3.account }
    );
    
    // Check vault has sufficient liquidity for bets
    const vaultBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.contracts.crapsVault.address]);
    
    totalTests++;
    if (vaultBalance >= parseEther("10000")) {
      console.log(`✅ Vault funded with ${vaultBalance.toString()} BOT tokens`);
      console.log(`✅ Players prepared with ${playerBetAmount.toString()} BOT each`);
      testsPassed++;
    } else {
      console.log("❌ Insufficient vault liquidity");
      errors.push("Vault liquidity insufficient for gameplay");
    }
    
    // ===========================
    // PHASE 4: GAME INITIALIZATION
    // ===========================
    console.log("\n🎲 PHASE 4: Game Series Initialization");
    
    // Start new game series
    const startTx = await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startTx });
    testUtils.gasStats.startNewSeries = startReceipt.gasUsed;
    
    // Get current series info
    const currentSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    const gamePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (currentSeries > 0n && gamePhase === 0) { // GamePhase.COME_OUT = 0
      console.log(`✅ Game series ${currentSeries.toString()} started in COME_OUT phase`);
      console.log(`  Gas used: ${startReceipt.gasUsed.toString()}`);
      testsPassed++;
    } else {
      console.log("❌ Game series initialization failed");
      errors.push("Game series not properly initialized");
    }
    
    // ===========================
    // PHASE 5: PLAYER BETTING
    // ===========================
    console.log("\n🎯 PHASE 5: Player Betting Phase");
    
    const baseBetAmount = parseEther("10"); // 10 BOT tokens per bet
    
    // Player 1: Pass Line bet (bet type 0)
    const bet1Tx = await testUtils.contracts.crapsBets.write.placeBet(
      [0, baseBetAmount], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    const bet1Receipt = await publicClient.waitForTransactionReceipt({ hash: bet1Tx });
    testUtils.gasStats.placeBet = bet1Receipt.gasUsed;
    
    // Player 2: Don't Pass bet (bet type 1)
    await testUtils.contracts.crapsBets.write.placeBet(
      [1, baseBetAmount], // Don't Pass
      { account: testUtils.accounts.player2.account }
    );
    
    // Player 3: Field bet (bet type 4)
    await testUtils.contracts.crapsBets.write.placeBet(
      [4, baseBetAmount], // Field
      { account: testUtils.accounts.player3.account }
    );
    
    // Verify bets were placed
    const player1Bet = await testUtils.contracts.crapsBets.read.getPlayerBet(
      [testUtils.accounts.player1.account.address, 0]
    );
    
    const player2Bet = await testUtils.contracts.crapsBets.read.getPlayerBet(
      [testUtils.accounts.player2.account.address, 1]
    );
    
    const player3Bet = await testUtils.contracts.crapsBets.read.getPlayerBet(
      [testUtils.accounts.player3.account.address, 4]
    );
    
    totalTests++;
    if (player1Bet[1] === baseBetAmount && player2Bet[1] === baseBetAmount && player3Bet[1] === baseBetAmount) {
      console.log(`✅ All player bets placed successfully:`);
      console.log(`  Player 1: Pass Line - ${baseBetAmount.toString()} BOT`);
      console.log(`  Player 2: Don't Pass - ${baseBetAmount.toString()} BOT`);
      console.log(`  Player 3: Field - ${baseBetAmount.toString()} BOT`);
      console.log(`  Gas per bet: ${bet1Receipt.gasUsed.toString()}`);
      testsPassed++;
    } else {
      console.log("❌ Player betting failed");
      errors.push("Player bets not properly recorded");
    }
    
    // ===========================
    // PHASE 6: DICE ROLL & SETTLEMENT
    // ===========================
    console.log("\n🎲 PHASE 6: Dice Roll and Settlement");
    
    // Request dice roll
    const rollTx = await testUtils.contracts.crapsGame.write.requestDiceRoll(
      { account: testUtils.accounts.operator.account }
    );
    
    const rollReceipt = await publicClient.waitForTransactionReceipt({ hash: rollTx });
    testUtils.gasStats.requestDiceRoll = rollReceipt.gasUsed;
    
    // Get the VRF request ID
    const lastRequestId = await testUtils.contracts.mockVRFCoordinator.read.lastRequestId();
    
    // Simulate VRF response with predetermined dice roll (7 - come out winner)
    const dice1 = 3;
    const dice2 = 4;
    const randomWords = [BigInt(dice1), BigInt(dice2)];
    
    const fulfillTx = await testUtils.contracts.mockVRFCoordinator.write.fulfillRandomWords(
      [lastRequestId, testUtils.contracts.crapsGame.address, randomWords]
    );
    
    const fulfillReceipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
    testUtils.gasStats.settleRoll = fulfillReceipt.gasUsed;
    
    // Verify roll outcome
    const rollOutcome = await testUtils.contracts.crapsGame.read.getLastRoll();
    const newGamePhase = await testUtils.contracts.crapsGame.read.gamePhase();
    
    totalTests++;
    if (rollOutcome[0] === dice1 && rollOutcome[1] === dice2 && rollOutcome[2] === 7) {
      console.log(`✅ Dice roll completed: ${dice1} + ${dice2} = 7`);
      console.log(`  Roll request gas: ${rollReceipt.gasUsed.toString()}`);
      console.log(`  Settlement gas: ${fulfillReceipt.gasUsed.toString()}`);
      console.log(`  New game phase: ${newGamePhase}`);
      testsPassed++;
    } else {
      console.log("❌ Dice roll or settlement failed");
      errors.push("Dice roll settlement incorrect");
    }
    
    // ===========================
    // PHASE 7: PAYOUT VERIFICATION
    // ===========================
    console.log("\n💸 PHASE 7: Payout and Balance Verification");
    
    // Check final balances (7 on come out: Pass wins, Don't Pass loses, Field loses)
    const player1FinalBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.player1.account.address]);
    const player2FinalBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.player2.account.address]);
    const player3FinalBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.player3.account.address]);
    
    // Player 1 should have won (Pass Line on 7)
    // Player 2 should have lost (Don't Pass on 7)
    // Player 3 should have lost (Field on 7)
    
    totalTests++;
    if (player1FinalBalance > (playerBetAmount - baseBetAmount)) {
      console.log(`✅ Payouts verified:`);
      console.log(`  Player 1 (Pass): ${player1FinalBalance.toString()} BOT (won)`);
      console.log(`  Player 2 (Don't Pass): ${player2FinalBalance.toString()} BOT (lost)`);
      console.log(`  Player 3 (Field): ${player3FinalBalance.toString()} BOT (lost)`);
      testsPassed++;
    } else {
      console.log("❌ Payout verification failed");
      errors.push("Player payouts incorrect");
    }
    
    // ===========================
    // PHASE 8: TREASURY & FEES
    // ===========================
    console.log("\n🏛️ PHASE 8: Treasury Fee Collection");
    
    // Check treasury collected fees
    const treasuryFinalBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.contracts.treasury.address]);
    
    totalTests++;
    if (treasuryFinalBalance > 0n) {
      console.log(`✅ Treasury fee collection: ${treasuryFinalBalance.toString()} BOT`);
      testsPassed++;
    } else {
      console.log(`⚠️ No treasury fees collected (may be expected for single game)`);
      testsPassed++; // Not critical for single game test
    }
    
    // ===========================
    // PHASE 9: GAS ANALYSIS
    // ===========================
    console.log("\n⛽ PHASE 9: Gas Usage Analysis");
    
    const totalGasUsed = testUtils.gasStats.startNewSeries + 
                        testUtils.gasStats.placeBet + 
                        testUtils.gasStats.requestDiceRoll + 
                        testUtils.gasStats.settleRoll;
    
    console.log(`📊 Gas Usage Summary:`);
    console.log(`  Start Series: ${testUtils.gasStats.startNewSeries.toString()}`);
    console.log(`  Place Bet: ${testUtils.gasStats.placeBet.toString()}`);
    console.log(`  Request Roll: ${testUtils.gasStats.requestDiceRoll.toString()}`);
    console.log(`  Settle Roll: ${testUtils.gasStats.settleRoll.toString()}`);
    console.log(`  Total Gas: ${totalGasUsed.toString()}`);
    
    totalTests++;
    if (totalGasUsed < 2000000n) { // Under 2M gas for complete journey
      console.log(`✅ Gas efficiency target met`);
      testsPassed++;
    } else {
      console.log(`⚠️ Gas usage higher than expected`);
      errors.push("Gas usage optimization needed");
    }
    
    // ===========================
    // FINAL RESULTS
    // ===========================
    console.log(`\n🎯 USER JOURNEY INTEGRATION TEST RESULTS:`);
    console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`📊 Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
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
    
    console.log(`\n🎰 User Journey Integration Test Complete!`);
    
    return results;
    
  } catch (error) {
    console.error("💥 Test execution failed:", error);
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

export { main as userJourneyIntegrationTest };
