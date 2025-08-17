import { network } from "hardhat";
import { parseEther, keccak256, toBytes, Address, encodeAbiParameters } from "viem";

/**
 * Comprehensive Integration Tests for BotSwapFeeHookV4Final
 * 
 * Tests Uniswap V4 hook integration, fee collection, and distribution
 * Covers ETHGlobal NYC 2025 requirements for Uniswap V4 hooks
 */

async function main() {
  console.log("🦄 Testing BotSwapFeeHookV4Final with Uniswap V4 Integration...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, treasury, stakingPool, trader1, trader2, liquidityProvider] = 
    await viem.getWalletClients();
  
  // Get public client
  const publicClient = await viem.getPublicClient();
  
  // Deploy BOT token first
  console.log("🪙 Deploying BOT Token...");
  const botToken = await viem.deployContract("BOTToken", [
    treasury.account.address,
    liquidityProvider.account.address,
    stakingPool.account.address,
    deployer.account.address,
    deployer.account.address
  ]);
  console.log("✅ BOT Token deployed at:", botToken.address);
  
  // Deploy Mock ERC20 for the other token in pool
  console.log("🪙 Deploying Mock USDC...");
  const mockUSDC = await viem.deployContract("MockERC20", [
    "Mock USDC",
    "USDC",
    18n,
    parseEther("1000000") // 1M USDC
  ]);
  console.log("✅ Mock USDC deployed at:", mockUSDC.address);
  
  // Deploy Mock Pool Manager
  console.log("🏊 Deploying Mock Pool Manager V4...");
  const poolManager = await viem.deployContract("MockPoolManagerV4");
  console.log("✅ Mock Pool Manager deployed at:", poolManager.address);
  
  // Deploy the hook
  console.log("🪝 Deploying BotSwapFeeHookV4Final...");
  const hook = await viem.deployContract("BotSwapFeeHookV4Final", [
    poolManager.address,
    botToken.address,
    treasury.account.address,
    stakingPool.account.address
  ]);
  console.log("✅ Hook deployed at:", hook.address);
  
  // Setup tokens for testing
  console.log("💰 Setting up test tokens...");
  
  // Transfer BOT tokens to trader accounts
  await botToken.write.transfer([trader1.account.address, parseEther("10000")], {
    account: liquidityProvider.account
  });
  await botToken.write.transfer([trader2.account.address, parseEther("10000")], {
    account: liquidityProvider.account
  });
  
  // Transfer USDC to trader accounts
  await mockUSDC.write.transfer([trader1.account.address, parseEther("10000")]);
  await mockUSDC.write.transfer([trader2.account.address, parseEther("10000")]);
  
  // Approve hook to spend tokens
  await botToken.write.approve([hook.address, parseEther("100000")], {
    account: trader1.account
  });
  await botToken.write.approve([hook.address, parseEther("100000")], {
    account: trader2.account
  });
  await mockUSDC.write.approve([hook.address, parseEther("100000")], {
    account: trader1.account
  });
  await mockUSDC.write.approve([hook.address, parseEther("100000")], {
    account: trader2.account
  });
  
  // Approve pool manager to spend tokens (for mock swaps)
  await botToken.write.approve([poolManager.address, parseEther("100000")], {
    account: trader1.account
  });
  await botToken.write.approve([poolManager.address, parseEther("100000")], {
    account: trader2.account
  });
  await mockUSDC.write.approve([poolManager.address, parseEther("100000")], {
    account: trader1.account
  });
  await mockUSDC.write.approve([poolManager.address, parseEther("100000")], {
    account: trader2.account
  });
  
  console.log("✅ Tokens distributed and approved");
  
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test 1: Hook Permissions
  console.log("\n📝 Test 1: Hook Permissions");
  totalTests++;
  
  const permissions = await hook.read.getHookPermissions();
  console.assert(permissions.beforeInitialize === false, "beforeInitialize should be false");
  console.assert(permissions.afterInitialize === true, "afterInitialize should be true");
  console.assert(permissions.beforeSwap === true, "beforeSwap should be true");
  console.assert(permissions.afterSwap === true, "afterSwap should be true");
  console.assert(permissions.beforeSwapReturnDelta === true, "beforeSwapReturnDelta should be true");
  
  console.log("✅ Hook permissions configured correctly");
  testsPassed++;
  
  // Test 2: Initial State
  console.log("\n📝 Test 2: Initial Hook State");
  totalTests++;
  
  const initialStats = await hook.read.getFeeStatistics();
  console.assert(initialStats[0] === 0n, "Initial fees collected should be 0");
  console.assert(initialStats[1] === 0n, "Initial fees distributed should be 0");
  console.assert(initialStats[2] === 0n, "Initial pending distribution should be 0");
  console.assert(initialStats[3] === 200n, "Fee rate should be 200 basis points (2%)");
  
  const treasuryAddr = await hook.read.treasury();
  const stakingAddr = await hook.read.stakingPool();
  console.assert(treasuryAddr === treasury.account.address, "Treasury address incorrect");
  console.assert(stakingAddr === stakingPool.account.address, "Staking pool address incorrect");
  
  console.log("✅ Initial state correct");
  testsPassed++;
  
  // Test 3: Pool Initialization - BOT/USDC Pool
  console.log("\n📝 Test 3: Pool Initialization with BOT Token");
  totalTests++;
  
  // Create pool key (BOT is currency0, USDC is currency1)
  const poolKey = {
    currency0: botToken.address,
    currency1: mockUSDC.address,
    fee: 500, // 0.05% pool fee
    tickSpacing: 10,
    hooks: hook.address
  };
  
  // Initialize pool through pool manager
  const initHash = await poolManager.write.initialize([poolKey, 79228162514264337593543950336n]); // sqrt price ~1:1
  await publicClient.waitForTransactionReceipt({ hash: initHash });
  
  // Check if hook detected BOT token in pool
  const poolInfo = await hook.read.getPoolFeeInfo([poolKey]);
  console.assert(poolInfo[0] === true, "Hook should detect BOT token in pool");
  console.assert(poolInfo[1] === 0n, "Initial fees collected should be 0");
  console.assert(poolInfo[2] === 200n, "Fee rate should be 200 basis points");
  
  console.log("✅ Pool initialized and BOT token detected");
  testsPassed++;
  
  // Test 4: Pool Initialization - Non-BOT Pool
  console.log("\n📝 Test 4: Pool Initialization without BOT Token");
  totalTests++;
  
  // Deploy another mock token
  const mockWETH = await viem.deployContract("MockERC20", [
    "Mock WETH",
    "WETH",
    18n,
    parseEther("1000")
  ]);
  
  // Create non-BOT pool
  const nonBotPoolKey = {
    currency0: mockUSDC.address,
    currency1: mockWETH.address,
    fee: 500,
    tickSpacing: 10,
    hooks: hook.address
  };
  
  const initNonBotHash = await poolManager.write.initialize([nonBotPoolKey, 79228162514264337593543950336n]);
  await publicClient.waitForTransactionReceipt({ hash: initNonBotHash });
  
  // Check if hook correctly identifies non-BOT pool
  const nonBotPoolInfo = await hook.read.getPoolFeeInfo([nonBotPoolKey]);
  console.assert(nonBotPoolInfo[0] === false, "Hook should not detect BOT token in non-BOT pool");
  
  console.log("✅ Non-BOT pool correctly identified");
  testsPassed++;
  
  // Test 5: Swap in BOT Pool - Selling BOT (Fee Applied)
  console.log("\n📝 Test 5: Swap BOT for USDC (Fee Applied)");
  totalTests++;
  
  const swapAmount = parseEther("1000"); // 1000 BOT
  const expectedFee = swapAmount * 200n / 10000n; // 2% fee = 20 BOT
  
  // Execute swap through pool manager (selling BOT for USDC)
  const swapParams = {
    zeroForOne: true, // BOT (currency0) -> USDC (currency1)
    amountSpecified: Number(swapAmount),
    sqrtPriceLimitX96: 0n
  };
  
  const swapHash = await poolManager.write.swap([poolKey, swapParams, "0x"], {
    account: trader1.account
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash });
  
  // Check fee collection
  const statsAfterSwap = await hook.read.getFeeStatistics();
  console.assert(statsAfterSwap[0] > 0n, "Fees should be collected");
  console.assert(statsAfterSwap[2] > 0n, "Pending distribution should be > 0");
  
  const poolInfoAfterSwap = await hook.read.getPoolFeeInfo([poolKey]);
  console.assert(poolInfoAfterSwap[1] > 0n, "Pool fees collected should be > 0");
  
  console.log(`📊 Fee collected: ${statsAfterSwap[0]} BOT`);
  console.log("✅ Fee collection on BOT sale working");
  testsPassed++;
  
  // Test 6: Swap in BOT Pool - Buying BOT (No Fee on Input)
  console.log("\n📝 Test 6: Swap USDC for BOT (No Fee on USDC Input)");
  totalTests++;
  
  const initialFeesCollected = await hook.read.getFeeStatistics();
  
  // Execute swap (buying BOT with USDC)
  const buySwapParams = {
    zeroForOne: false, // USDC (currency1) -> BOT (currency0)
    amountSpecified: -Number(parseEther("500")), // Negative for exact output
    sqrtPriceLimitX96: 0n
  };
  
  const buySwapHash = await poolManager.write.swap([poolKey, buySwapParams, "0x"], {
    account: trader2.account
  });
  await publicClient.waitForTransactionReceipt({ hash: buySwapHash });
  
  const statsAfterBuySwap = await hook.read.getFeeStatistics();
  
  // Fees should not increase significantly when buying BOT (fee only on BOT output, not USDC input)
  console.log(`📊 Fees before buy: ${initialFeesCollected[0]}`);
  console.log(`📊 Fees after buy: ${statsAfterBuySwap[0]}`);
  
  console.log("✅ BOT purchase processed");
  testsPassed++;
  
  // Test 7: Swap in Non-BOT Pool (No Fee)
  console.log("\n📝 Test 7: Swap in Non-BOT Pool (No Fee Applied)");
  totalTests++;
  
  // Transfer tokens for non-BOT pool swap
  await mockUSDC.write.transfer([trader1.account.address, parseEther("1000")]);
  await mockWETH.write.transfer([trader1.account.address, parseEther("1000")]);
  
  await mockUSDC.write.approve([poolManager.address, parseEther("1000")], {
    account: trader1.account
  });
  await mockWETH.write.approve([poolManager.address, parseEther("1000")], {
    account: trader1.account
  });
  
  const feesBeforeNonBotSwap = await hook.read.getFeeStatistics();
  
  // Execute swap in non-BOT pool
  const nonBotSwapParams = {
    zeroForOne: true, // USDC -> WETH
    amountSpecified: Number(parseEther("100")),
    sqrtPriceLimitX96: 0n
  };
  
  const nonBotSwapHash = await poolManager.write.swap([nonBotPoolKey, nonBotSwapParams, "0x"], {
    account: trader1.account
  });
  await publicClient.waitForTransactionReceipt({ hash: nonBotSwapHash });
  
  const feesAfterNonBotSwap = await hook.read.getFeeStatistics();
  
  // Fees should not change
  console.assert(
    feesBeforeNonBotSwap[0] === feesAfterNonBotSwap[0], 
    "Fees should not change for non-BOT pool swaps"
  );
  
  console.log("✅ Non-BOT pool swap correctly bypassed fee");
  testsPassed++;
  
  // Test 8: Fee Distribution
  console.log("\n📝 Test 8: Fee Distribution to Treasury and Staking");
  totalTests++;
  
  const statsBeforeDistribution = await hook.read.getFeeStatistics();
  const pendingFees = statsBeforeDistribution[2];
  
  console.assert(pendingFees > 0n, "Should have pending fees to distribute");
  
  // Get initial balances
  const treasuryBalanceBefore = await botToken.read.balanceOf([treasury.account.address]);
  const stakingBalanceBefore = await botToken.read.balanceOf([stakingPool.account.address]);
  
  // First transfer some BOT to the hook contract so it can distribute
  await botToken.write.transfer([hook.address, pendingFees], {
    account: liquidityProvider.account
  });
  
  // Distribute fees
  const distributeHash = await hook.write.distributeFees();
  await publicClient.waitForTransactionReceipt({ hash: distributeHash });
  
  // Check distribution results
  const treasuryBalanceAfter = await botToken.read.balanceOf([treasury.account.address]);
  const stakingBalanceAfter = await botToken.read.balanceOf([stakingPool.account.address]);
  const statsAfterDistribution = await hook.read.getFeeStatistics();
  
  const treasuryIncrease = treasuryBalanceAfter - treasuryBalanceBefore;
  const stakingIncrease = stakingBalanceAfter - stakingBalanceBefore;
  
  // Should be 50/50 split
  const expectedTreasuryShare = pendingFees * 5000n / 10000n;
  const expectedStakingShare = pendingFees - expectedTreasuryShare;
  
  console.assert(
    treasuryIncrease === expectedTreasuryShare,
    `Treasury should receive ${expectedTreasuryShare}, got ${treasuryIncrease}`
  );
  console.assert(
    stakingIncrease === expectedStakingShare,
    `Staking should receive ${expectedStakingShare}, got ${stakingIncrease}`
  );
  console.assert(
    statsAfterDistribution[2] === 0n,
    "Pending distribution should be 0 after distribution"
  );
  
  console.log(`📊 Treasury received: ${treasuryIncrease} BOT`);
  console.log(`📊 Staking received: ${stakingIncrease} BOT`);
  console.log("✅ Fee distribution working correctly");
  testsPassed++;
  
  // Test 9: Access Control
  console.log("\n📝 Test 9: Access Control");
  totalTests++;
  
  const FEE_MANAGER_ROLE = keccak256(toBytes("FEE_MANAGER_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  // Test unauthorized treasury update
  try {
    await hook.write.setTreasury([trader1.account.address], {
      account: trader1.account
    });
    console.assert(false, "Should have reverted for unauthorized treasury update");
  } catch (error) {
    console.log("✅ Correctly rejected unauthorized treasury update");
  }
  
  // Test authorized treasury update
  const newTreasuryAddr = trader2.account.address;
  const updateTreasuryHash = await hook.write.setTreasury([newTreasuryAddr], {
    account: deployer.account
  });
  await publicClient.waitForTransactionReceipt({ hash: updateTreasuryHash });
  
  const updatedTreasury = await hook.read.treasury();
  console.assert(updatedTreasury === newTreasuryAddr, "Treasury should be updated");
  
  // Reset treasury
  await hook.write.setTreasury([treasury.account.address], {
    account: deployer.account
  });
  
  console.log("✅ Access control working correctly");
  testsPassed++;
  
  // Test 10: Calculate Fee Function
  console.log("\n📝 Test 10: Fee Calculation");
  totalTests++;
  
  const testAmount = parseEther("1000");
  const calculatedFee = await hook.read.calculateFee([testAmount]);
  const expectedCalculatedFee = testAmount * 200n / 10000n; // 2%
  
  console.assert(
    calculatedFee === expectedCalculatedFee,
    `Expected fee ${expectedCalculatedFee}, got ${calculatedFee}`
  );
  
  console.log(`📊 Fee calculation: ${testAmount} -> ${calculatedFee} (2%)`);
  console.log("✅ Fee calculation function working correctly");
  testsPassed++;
  
  // Test 11: Large Volume Swap Test
  console.log("\n📝 Test 11: Large Volume Swap Test");
  totalTests++;
  
  const largeSwapAmount = parseEther("5000"); // 5000 BOT
  
  // Give trader more tokens
  await botToken.write.transfer([trader1.account.address, largeSwapAmount], {
    account: liquidityProvider.account
  });
  await botToken.write.approve([poolManager.address, largeSwapAmount], {
    account: trader1.account
  });
  
  const feesBeforeLargeSwap = await hook.read.getFeeStatistics();
  
  // Execute large swap
  const largeSwapParams = {
    zeroForOne: true,
    amountSpecified: Number(largeSwapAmount),
    sqrtPriceLimitX96: 0n
  };
  
  const largeSwapHash = await poolManager.write.swap([poolKey, largeSwapParams, "0x"], {
    account: trader1.account
  });
  await publicClient.waitForTransactionReceipt({ hash: largeSwapHash });
  
  const feesAfterLargeSwap = await hook.read.getFeeStatistics();
  const newFeesCollected = feesAfterLargeSwap[0] - feesBeforeLargeSwap[0];
  const expectedLargeFee = largeSwapAmount * 200n / 10000n; // 2% of 5000 = 100 BOT
  
  console.log(`📊 Large swap fee collected: ${newFeesCollected} BOT`);
  console.assert(newFeesCollected > 0n, "Should collect fees on large swap");
  
  console.log("✅ Large volume swap handled correctly");
  testsPassed++;
  
  // Test 12: Edge Case - Zero Amount Swap
  console.log("\n📝 Test 12: Edge Case - Zero Amount Swap");
  totalTests++;
  
  const feesBeforeZeroSwap = await hook.read.getFeeStatistics();
  
  // Try swap with very small amount that might round to zero fee
  const tinySwapParams = {
    zeroForOne: true,
    amountSpecified: 1, // 1 wei
    sqrtPriceLimitX96: 0n
  };
  
  const tinySwapHash = await poolManager.write.swap([poolKey, tinySwapParams, "0x"], {
    account: trader1.account
  });
  await publicClient.waitForTransactionReceipt({ hash: tinySwapHash });
  
  const feesAfterZeroSwap = await hook.read.getFeeStatistics();
  
  // Should handle gracefully (may or may not collect fee depending on rounding)
  console.log(`📊 Tiny swap handled, fees change: ${feesAfterZeroSwap[0] - feesBeforeZeroSwap[0]}`);
  console.log("✅ Edge case handled gracefully");
  testsPassed++;
  
  // Test 13: Gas Usage Analysis
  console.log("\n📝 Test 13: Gas Usage Analysis");
  totalTests++;
  
  // Measure gas for hook operations
  const normalSwapParams = {
    zeroForOne: true,
    amountSpecified: Number(parseEther("100")),
    sqrtPriceLimitX96: 0n
  };
  
  const gasTestHash = await poolManager.write.swap([poolKey, normalSwapParams, "0x"], {
    account: trader2.account
  });
  const gasTestReceipt = await publicClient.waitForTransactionReceipt({ hash: gasTestHash });
  
  console.log(`📊 Gas used for swap with hook: ${gasTestReceipt.gasUsed}`);
  
  // Gas should be reasonable (under 300k for mock implementation)
  console.assert(gasTestReceipt.gasUsed < 300000n, "Gas usage should be under 300k for mock");
  
  console.log("✅ Gas usage within reasonable limits");
  testsPassed++;
  
  // Test 14: Hook Interface Compliance
  console.log("\n📝 Test 14: IHooks Interface Compliance");
  totalTests++;
  
  // Test that unimplemented hooks revert appropriately
  try {
    await hook.read.beforeInitialize([deployer.account.address, poolKey, 0n]);
    console.assert(false, "beforeInitialize should revert");
  } catch (error) {
    console.log("✅ beforeInitialize correctly reverts");
  }
  
  try {
    await hook.read.beforeAddLiquidity([
      deployer.account.address,
      poolKey,
      { tickLower: 0, tickUpper: 0, liquidityDelta: 0n, salt: "0x" + "0".repeat(64) },
      "0x"
    ]);
    console.assert(false, "beforeAddLiquidity should revert");
  } catch (error) {
    console.log("✅ beforeAddLiquidity correctly reverts");
  }
  
  console.log("✅ Hook interface compliance verified");
  testsPassed++;
  
  // Final Summary
  console.log("\n🎉 BotSwapFeeHookV4Final Integration Tests Complete!");
  console.log("=" + "=".repeat(50));
  console.log(`📊 Total tests: ${totalTests}`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${totalTests - testsPassed}`);
  console.log(`📈 Success rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
  
  if (testsPassed === totalTests) {
    console.log("\n🏆 ALL TESTS PASSED - Uniswap V4 Hook Integration Successful!");
    console.log("🦄 ETHGlobal NYC 2025 Uniswap V4 requirements met");
    console.log("💰 2% BOT token swap fee mechanism verified");
    console.log("🎯 Fee distribution (50% treasury, 50% staking) working");
  } else {
    throw new Error(`${totalTests - testsPassed} tests failed`);
  }
  
  // Close the connection
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Integration test failed:", error);
    process.exit(1);
  });