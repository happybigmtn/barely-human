import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";
import { TestUtilities, TestResults } from "../TestUtilities.js";

/**
 * Simple Integration Test
 * 
 * Basic validation that the integration test framework works correctly
 * without Unicode characters that may cause esbuild issues.
 */

async function main() {
  console.log("Starting Simple Integration Test...\n");
  
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
    
    console.log("Test accounts initialized\n");
    
    // Deploy system
    await testUtils.deployCoreContracts();
    await testUtils.setupRoles();
    await testUtils.fundSystem();
    
    console.log("Core system deployed and configured\n");
    
    // TEST 1: Token balance verification
    console.log("TEST 1: Token Balance Verification");
    
    const treasuryBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.treasury.account.address]);
    const liquidityBalance = await testUtils.contracts.botToken.read.balanceOf([testUtils.accounts.liquidityProvider.account.address]);
    
    totalTests++;
    if (treasuryBalance > 0n && liquidityBalance > 0n) {
      console.log(`PASS: Token distribution validated`);
      console.log(`  Treasury: ${treasuryBalance.toString()} BOT`);
      console.log(`  Liquidity: ${liquidityBalance.toString()} BOT`);
      testsPassed++;
    } else {
      console.log("FAIL: Token distribution failed");
      errors.push("Initial token distribution incorrect");
    }
    
    // TEST 2: Game series creation
    console.log("\nTEST 2: Game Series Creation");
    
    const startTx = await testUtils.contracts.crapsGame.write.startNewSeries(
      { account: testUtils.accounts.operator.account }
    );
    
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startTx });
    const currentSeries = await testUtils.contracts.crapsGame.read.getCurrentSeries();
    
    totalTests++;
    if (currentSeries > 0n) {
      console.log(`PASS: Game series ${currentSeries.toString()} started`);
      console.log(`  Gas used: ${startReceipt.gasUsed.toString()}`);
      testsPassed++;
    } else {
      console.log("FAIL: Game series creation failed");
      errors.push("Game series not properly created");
    }
    
    // TEST 3: Basic betting
    console.log("\nTEST 3: Basic Betting");
    
    const betAmount = parseEther("10");
    
    // Transfer tokens to player
    await testUtils.contracts.botToken.write.transfer(
      [testUtils.accounts.player1.account.address, betAmount],
      { account: testUtils.accounts.liquidityProvider.account }
    );
    
    await testUtils.contracts.botToken.write.approve(
      [testUtils.contracts.crapsVault.address, betAmount],
      { account: testUtils.accounts.player1.account }
    );
    
    // Place bet
    const betTx = await testUtils.contracts.crapsBets.write.placeBet(
      [0, betAmount], // Pass Line
      { account: testUtils.accounts.player1.account }
    );
    
    const betReceipt = await publicClient.waitForTransactionReceipt({ hash: betTx });
    const playerBet = await testUtils.contracts.crapsBets.read.getPlayerBet(
      [testUtils.accounts.player1.account.address, 0]
    );
    
    totalTests++;
    if (playerBet[1] === betAmount) {
      console.log(`PASS: Player bet placed successfully`);
      console.log(`  Bet amount: ${betAmount.toString()} BOT`);
      console.log(`  Gas used: ${betReceipt.gasUsed.toString()}`);
      testsPassed++;
    } else {
      console.log("FAIL: Player betting failed");
      errors.push("Player bet not properly recorded");
    }
    
    // FINAL RESULTS
    console.log(`\nSIMPLE INTEGRATION TEST RESULTS:`);
    console.log(`PASS: ${testsPassed}/${totalTests}`);
    console.log(`Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log(`\nErrors encountered:`);
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
    
    console.log(`\nSimple Integration Test Complete!`);
    
    return results;
    
  } catch (error) {
    console.error("Test execution failed:", error);
    throw error;
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
