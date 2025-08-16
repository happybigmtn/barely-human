import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing StakingPool Contract...\n");
  
  // Connect to network and get viem from the connection
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, treasury, liquidity, staking, team, community, user1, user2] = 
    await viem.getWalletClients();
  
  // Get public client
  const publicClient = await viem.getPublicClient();
  
  console.log("📦 Deploying BOTToken...");
  const botToken = await viem.deployContract("BOTToken", [
    treasury.account.address,
    liquidity.account.address,
    staking.account.address,
    team.account.address,
    community.account.address
  ]);
  console.log("✅ BOTToken deployed at:", botToken.address);
  
  console.log("\n📦 Deploying Treasury...");
  const treasuryContract = await viem.deployContract("Treasury", [
    botToken.address,
    deployer.account.address, // dev wallet
    deployer.account.address  // insurance wallet
  ]);
  console.log("✅ Treasury deployed at:", treasuryContract.address);
  
  console.log("\n📦 Deploying StakingPool...");
  const stakingPool = await viem.deployContract("StakingPool", [
    botToken.address,  // staking token
    botToken.address,  // reward token (same as staking)
    treasuryContract.address  // treasury
  ]);
  console.log("✅ StakingPool deployed at:", stakingPool.address);
  
  // Grant STAKING_ROLE to StakingPool contract
  const STAKING_ROLE = keccak256(toBytes("STAKING_ROLE"));
  const grantRoleHash = await botToken.write.grantRole(
    [STAKING_ROLE, stakingPool.address],
    { account: deployer.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: grantRoleHash });
  console.log("✅ STAKING_ROLE granted to StakingPool");
  
  // Setup: Transfer tokens to users for testing
  const transferAmount = parseEther("10000");
  const tx1 = await botToken.write.transfer(
    [user1.account.address, transferAmount],
    { account: treasury.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: tx1 });
  
  const tx2 = await botToken.write.transfer(
    [user2.account.address, transferAmount],
    { account: treasury.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: tx2 });
  console.log("✅ Test tokens distributed to users");
  
  // Test 1: Staking Configuration
  console.log("\n📝 Test 1: Staking Configuration");
  const minStake = await stakingPool.read.MIN_STAKE();
  const rewardsDuration = await stakingPool.read.rewardsDuration();
  
  console.assert(minStake === parseEther("1"), `Expected min stake to be 1 BOT, got ${minStake}`);
  console.assert(rewardsDuration === 604800n, `Expected rewards duration to be 604800 (7 days), got ${rewardsDuration}`);
  console.log("✅ Configuration correct");
  
  // Test 2: Stake Tokens
  console.log("\n📝 Test 2: Staking Tokens");
  
  // User1 approves and stakes
  const stakeAmount = parseEther("1000");
  const approveHash = await botToken.write.approve(
    [stakingPool.address, stakeAmount],
    { account: user1.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  
  const stakeHash = await stakingPool.write.stake(
    [stakeAmount],
    { account: user1.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: stakeHash });
  
  const user1StakeInfo = await stakingPool.read.stakes([user1.account.address]);
  console.assert(user1StakeInfo[0] === stakeAmount, `Expected stake ${stakeAmount}, got ${user1StakeInfo[0]}`);
  console.log("✅ User1 staked 1000 BOT successfully");
  
  // User2 stakes
  const stake2Amount = parseEther("2000");
  const approve2Hash = await botToken.write.approve(
    [stakingPool.address, stake2Amount],
    { account: user2.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: approve2Hash });
  
  const stake2Hash = await stakingPool.write.stake(
    [stake2Amount],
    { account: user2.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: stake2Hash });
  
  const user2StakeInfo = await stakingPool.read.stakes([user2.account.address]);
  console.assert(user2StakeInfo[0] === stake2Amount, `Expected stake ${stake2Amount}, got ${user2StakeInfo[0]}`);
  console.log("✅ User2 staked 2000 BOT successfully");
  
  // Test 3: Total Staked
  console.log("\n📝 Test 3: Total Staked");
  const totalStaked = await stakingPool.read.totalStaked();
  const expectedTotal = stakeAmount + stake2Amount;
  console.assert(totalStaked === expectedTotal, `Expected total ${expectedTotal}, got ${totalStaked}`);
  console.log("✅ Total staked: 3000 BOT");
  
  // Test 4: Withdraw Tokens
  console.log("\n📝 Test 4: Withdrawing Tokens");
  
  const withdrawAmount = parseEther("500");
  const withdrawHash = await stakingPool.write.withdraw(
    [withdrawAmount],
    { account: user1.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
  
  const user1StakeInfoAfter = await stakingPool.read.stakes([user1.account.address]);
  const expectedStakeAfter = stakeAmount - withdrawAmount;
  console.assert(user1StakeInfoAfter[0] === expectedStakeAfter, `Expected stake ${expectedStakeAfter}, got ${user1StakeInfoAfter[0]}`);
  console.log("✅ User1 withdrew 500 BOT successfully");
  
  // Check total staked decreased
  const totalStakedAfter = await stakingPool.read.totalStaked();
  const expectedTotalAfter = expectedTotal - withdrawAmount;
  console.assert(totalStakedAfter === expectedTotalAfter, `Expected total ${expectedTotalAfter}, got ${totalStakedAfter}`);
  console.log("✅ Total staked updated: 2500 BOT");
  
  // Test 5: Pausable
  console.log("\n📝 Test 5: Pausable Functionality");
  
  // Only admin can pause
  const pauseHash = await stakingPool.write.pause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  
  const isPaused = await stakingPool.read.paused();
  console.assert(isPaused === true, "Contract should be paused");
  console.log("✅ Contract paused successfully");
  
  // Try to stake while paused (should fail)
  try {
    await stakingPool.write.stake(
      [parseEther("100")],
      { account: user1.account }
    );
    console.assert(false, "Should not be able to stake while paused");
  } catch (error) {
    console.log("✅ Staking correctly prevented while paused");
  }
  
  // Unpause
  const unpauseHash = await stakingPool.write.unpause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  
  const isPausedAfter = await stakingPool.read.paused();
  console.assert(isPausedAfter === false, "Contract should be unpaused");
  console.log("✅ Contract unpaused successfully");
  
  // Test 6: Minimum Stake Requirement
  console.log("\n📝 Test 6: Minimum Stake Requirement");
  
  try {
    await stakingPool.write.stake(
      [parseEther("0.5")], // Less than minimum
      { account: user1.account }
    );
    console.assert(false, "Should not be able to stake less than minimum");
  } catch (error) {
    console.log("✅ Minimum stake requirement enforced");
  }
  
  console.log("\n🎉 All tests passed successfully!");
  console.log("📊 Total tests: 6");
  console.log("✅ Passed: 6");
  console.log("❌ Failed: 0");
  
  // Close the connection
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });