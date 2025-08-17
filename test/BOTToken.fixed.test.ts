import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing BOTToken Contract (Fixed Version)...\n");
  
  // Connect to network and get viem from the connection
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  try {
    // Roles
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const TREASURY_ROLE = keccak256(toBytes("TREASURY_ROLE"));
    const STAKING_ROLE = keccak256(toBytes("STAKING_ROLE"));
    const PAUSER_ROLE = keccak256(toBytes("PAUSER_ROLE"));

    // Allocations
    const INITIAL_SUPPLY = parseEther("1000000000"); // 1B tokens
    const TREASURY_ALLOCATION = parseEther("200000000"); // 200M
    const LIQUIDITY_ALLOCATION = parseEther("300000000"); // 300M
    const STAKING_ALLOCATION = parseEther("250000000"); // 250M
    const TEAM_ALLOCATION = parseEther("150000000"); // 150M
    const COMMUNITY_ALLOCATION = parseEther("100000000"); // 100M

    // Get clients and wallets
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community, user1, user2] = 
      await viem.getWalletClients();
    
    // Deploy BOTToken
    console.log("📦 Deploying BOTToken...");
    const botToken = await viem.deployContract("BOTToken", [
      treasury.account.address,
      liquidity.account.address,
      staking.account.address,
      team.account.address,
      community.account.address
    ]);
    
    console.log(`✅ BOTToken deployed at: ${botToken.address}\n`);

    let testsRun = 0;
    let testsPassed = 0;

    // Test 1: Token Details
    try {
      console.log("🔍 Test 1: Token Details");
      const name = await botToken.read.name();
      const symbol = await botToken.read.symbol();
      const decimals = await botToken.read.decimals();
      
      console.log(`  Name: ${name}`);
      console.log(`  Symbol: ${symbol}`);
      console.log(`  Decimals: ${decimals}`);
      
      if (name === "Barely Human" && symbol === "BOT" && decimals === 18) {
        console.log("  ✅ Token details correct");
        testsPassed++;
      } else {
        console.log("  ❌ Token details incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Token details test failed: ${error}`);
      testsRun++;
    }

    // Test 2: Total Supply
    try {
      console.log("\n🔍 Test 2: Total Supply");
      const totalSupply = await botToken.read.totalSupply();
      console.log(`  Total Supply: ${totalSupply.toString()}`);
      console.log(`  Expected: ${INITIAL_SUPPLY.toString()}`);
      
      if (totalSupply === INITIAL_SUPPLY) {
        console.log("  ✅ Total supply correct");
        testsPassed++;
      } else {
        console.log("  ❌ Total supply incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Total supply test failed: ${error}`);
      testsRun++;
    }

    // Test 3: Token Distribution
    try {
      console.log("\n🔍 Test 3: Token Distribution");
      
      const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
      const liquidityBalance = await botToken.read.balanceOf([liquidity.account.address]);
      const stakingBalance = await botToken.read.balanceOf([staking.account.address]);
      const teamBalance = await botToken.read.balanceOf([team.account.address]);
      const communityBalance = await botToken.read.balanceOf([community.account.address]);
      
      console.log(`  Treasury: ${treasuryBalance.toString()} (expected: ${TREASURY_ALLOCATION.toString()})`);
      console.log(`  Liquidity: ${liquidityBalance.toString()} (expected: ${LIQUIDITY_ALLOCATION.toString()})`);
      console.log(`  Staking: ${stakingBalance.toString()} (expected: ${STAKING_ALLOCATION.toString()})`);
      console.log(`  Team: ${teamBalance.toString()} (expected: ${TEAM_ALLOCATION.toString()})`);
      console.log(`  Community: ${communityBalance.toString()} (expected: ${COMMUNITY_ALLOCATION.toString()})`);
      
      if (treasuryBalance === TREASURY_ALLOCATION &&
          liquidityBalance === LIQUIDITY_ALLOCATION &&
          stakingBalance === STAKING_ALLOCATION &&
          teamBalance === TEAM_ALLOCATION &&
          communityBalance === COMMUNITY_ALLOCATION) {
        console.log("  ✅ Token distribution correct");
        testsPassed++;
      } else {
        console.log("  ❌ Token distribution incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Token distribution test failed: ${error}`);
      testsRun++;
    }

    // Test 4: Role Setup
    try {
      console.log("\n🔍 Test 4: Role Setup");
      
      const deployerAdmin = await botToken.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]);
      const treasuryRole = await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]);
      const stakingRole = await botToken.read.hasRole([STAKING_ROLE, staking.account.address]);
      const deployerPauser = await botToken.read.hasRole([PAUSER_ROLE, deployer.account.address]);
      
      console.log(`  Deployer has admin role: ${deployerAdmin}`);
      console.log(`  Treasury has treasury role: ${treasuryRole}`);
      console.log(`  Staking has staking role: ${stakingRole}`);
      console.log(`  Deployer has pauser role: ${deployerPauser}`);
      
      if (deployerAdmin && treasuryRole && stakingRole && deployerPauser) {
        console.log("  ✅ Role setup correct");
        testsPassed++;
      } else {
        console.log("  ❌ Role setup incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Role setup test failed: ${error}`);
      testsRun++;
    }

    // Test 5: Transfer Functionality
    try {
      console.log("\n🔍 Test 5: Transfer Functionality");
      
      const amount = parseEther("100");
      const initialBalance = await botToken.read.balanceOf([user1.account.address]);
      
      // Transfer from treasury to user1
      const hash = await botToken.write.transfer(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      const finalBalance = await botToken.read.balanceOf([user1.account.address]);
      console.log(`  Initial balance: ${initialBalance.toString()}`);
      console.log(`  Final balance: ${finalBalance.toString()}`);
      console.log(`  Expected difference: ${amount.toString()}`);
      
      if (finalBalance === initialBalance + amount) {
        console.log("  ✅ Transfer functionality correct");
        testsPassed++;
      } else {
        console.log("  ❌ Transfer functionality incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Transfer functionality test failed: ${error}`);
      testsRun++;
    }

    // Test 6: Pausable Functionality
    try {
      console.log("\n🔍 Test 6: Pausable Functionality");
      
      // Initially not paused
      const initialPaused = await botToken.read.paused();
      console.log(`  Initially paused: ${initialPaused}`);
      
      // Pause
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      
      const pausedState = await botToken.read.paused();
      console.log(`  After pause: ${pausedState}`);
      
      // Unpause
      const unpauseHash = await botToken.write.unpause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
      
      const unpausedState = await botToken.read.paused();
      console.log(`  After unpause: ${unpausedState}`);
      
      if (!initialPaused && pausedState && !unpausedState) {
        console.log("  ✅ Pausable functionality correct");
        testsPassed++;
      } else {
        console.log("  ❌ Pausable functionality incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Pausable functionality test failed: ${error}`);
      testsRun++;
    }

    // Test 7: Burn Functionality
    try {
      console.log("\n🔍 Test 7: Burn Functionality");
      
      const burnAmount = parseEther("1000");
      const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
      const initialSupply = await botToken.read.totalSupply();
      
      // Burn tokens
      const burnHash = await botToken.write.burn(
        [burnAmount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      const finalBalance = await botToken.read.balanceOf([treasury.account.address]);
      const finalSupply = await botToken.read.totalSupply();
      
      console.log(`  Initial balance: ${initialBalance.toString()}`);
      console.log(`  Final balance: ${finalBalance.toString()}`);
      console.log(`  Initial supply: ${initialSupply.toString()}`);
      console.log(`  Final supply: ${finalSupply.toString()}`);
      
      if (finalBalance === initialBalance - burnAmount && 
          finalSupply === initialSupply - burnAmount) {
        console.log("  ✅ Burn functionality correct");
        testsPassed++;
      } else {
        console.log("  ❌ Burn functionality incorrect");
      }
      testsRun++;
    } catch (error) {
      console.log(`  ❌ Burn functionality test failed: ${error}`);
      testsRun++;
    }

    // Summary
    console.log(`\n📊 Test Summary:`);
    console.log(`  Tests Run: ${testsRun}`);
    console.log(`  Tests Passed: ${testsPassed}`);
    console.log(`  Tests Failed: ${testsRun - testsPassed}`);
    console.log(`  Pass Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
    
    if (testsPassed === testsRun) {
      console.log(`\n🎉 All tests passed! BOTToken is working correctly.`);
    } else {
      console.log(`\n⚠️  Some tests failed. Review the implementation.`);
    }

  } catch (error) {
    console.error("❌ Test execution failed:", error);
  } finally {
    // Close the connection
    await connection.close();
  }
}

// Run the tests
main().catch(console.error);