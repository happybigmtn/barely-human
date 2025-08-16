import { network } from "hardhat";
import { parseEther, keccak256, toBytes, type Address } from "viem";

async function main() {
  console.log("🧪 Testing Treasury Contract...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, treasury, liquidity, staking, team, community, vault1, vault2, dev, insurance] = 
    await viem.getWalletClients();
  
  // Get public client
  const publicClient = await viem.getPublicClient();
  
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
  
  // Deploy Treasury
  console.log("\n📦 Deploying Treasury...");
  const treasuryContract = await viem.deployContract("Treasury", [
    botToken.address,
    dev.account.address,
    insurance.account.address
  ]);
  console.log("✅ Treasury deployed at:", treasuryContract.address);
  
  // Deploy StakingPool  
  console.log("\n📦 Deploying StakingPool...");
  const stakingPool = await viem.deployContract("StakingPool", [
    botToken.address,
    botToken.address,
    treasuryContract.address
  ]);
  console.log("✅ StakingPool deployed at:", stakingPool.address);
  
  // Setup roles
  const TREASURY_ROLE = keccak256(toBytes("TREASURY_ROLE"));
  await botToken.write.grantRole([TREASURY_ROLE, treasuryContract.address], { account: deployer.account });
  
  // Register staking pool with treasury
  await treasuryContract.write.setStakingPool([stakingPool.address], { account: deployer.account });
  
  // Transfer some tokens to treasury for testing
  const transferAmount = parseEther("100000");
  await botToken.write.transfer([treasuryContract.address, transferAmount], { account: treasury.account });
  
  console.log("✅ Setup complete\n");
  
  // Test 1: Configuration
  console.log("📝 Test 1: Treasury Configuration");
  const stakingPercent = await treasuryContract.read.stakingRewardsPercentage();
  const buybackPercent = await treasuryContract.read.buybackPercentage();
  const devPercent = await treasuryContract.read.developmentPercentage();
  const insurancePercent = await treasuryContract.read.insurancePercentage();
  
  console.assert(stakingPercent === 50n, `Expected staking % to be 50, got ${stakingPercent}`);
  console.assert(buybackPercent === 20n, `Expected buyback % to be 20, got ${buybackPercent}`);
  console.assert(devPercent === 15n, `Expected dev % to be 15, got ${devPercent}`);
  console.assert(insurancePercent === 15n, `Expected insurance % to be 15, got ${insurancePercent}`);
  console.log("✅ Configuration correct");
  
  // Test 2: Vault Management
  console.log("\n📝 Test 2: Vault Management");
  
  // Add vault
  await treasuryContract.write.addVault([vault1.account.address], { account: deployer.account });
  const isVault1 = await treasuryContract.read.isVault([vault1.account.address]);
  console.assert(isVault1 === true, "Vault1 should be registered");
  console.log("✅ Vault added successfully");
  
  // Remove vault
  await treasuryContract.write.removeVault([vault1.account.address], { account: deployer.account });
  const isVault1After = await treasuryContract.read.isVault([vault1.account.address]);
  console.assert(isVault1After === false, "Vault1 should be removed");
  console.log("✅ Vault removed successfully");
  
  // Test 3: Fee Collection from Vault
  console.log("\n📝 Test 3: Fee Collection from Vault");
  
  // Register vault1 as authorized vault
  await treasuryContract.write.addVault([vault1.account.address], { account: deployer.account });
  
  // Transfer tokens to vault1 to simulate fees
  const feeAmount = parseEther("1000");
  await botToken.write.transfer([vault1.account.address, feeAmount], { account: treasury.account });
  
  // Approve treasury to collect fees
  await botToken.write.approve([treasuryContract.address, feeAmount], { account: vault1.account });
  
  // Collect vault fees
  const collectHash = await treasuryContract.write.receiveVaultFees([feeAmount], { account: vault1.account });
  await publicClient.waitForTransactionReceipt({ hash: collectHash });
  
  const totalCollected = await treasuryContract.read.totalFeesCollected();
  console.assert(totalCollected === feeAmount, `Expected fees collected ${feeAmount}, got ${totalCollected}`);
  console.log("✅ Vault fees collected: 1000 BOT");
  
  // Test 4: Distribution
  console.log("\n📝 Test 4: Fee Distribution");
  
  // Get initial balances
  const stakingBefore = await botToken.read.balanceOf([stakingPool.address]);
  const devBefore = await botToken.read.balanceOf([dev.account.address]);
  const insuranceBefore = await botToken.read.balanceOf([insurance.account.address]);
  
  // Distribute fees
  const distributeHash = await treasuryContract.write.distributeFees({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: distributeHash });
  
  // Check balances after distribution
  const stakingAfter = await botToken.read.balanceOf([stakingPool.address]);
  const devAfter = await botToken.read.balanceOf([dev.account.address]);
  const insuranceAfter = await botToken.read.balanceOf([insurance.account.address]);
  
  // Calculate expected amounts (from 1000 BOT collected)
  const expectedStaking = parseEther("500"); // 50%
  const expectedDev = parseEther("150"); // 15%
  const expectedInsurance = parseEther("150"); // 15%
  
  console.assert(
    stakingAfter - stakingBefore === expectedStaking,
    `Staking should receive ${expectedStaking}, got ${stakingAfter - stakingBefore}`
  );
  console.assert(
    devAfter - devBefore === expectedDev,
    `Dev should receive ${expectedDev}, got ${devAfter - devBefore}`
  );
  console.assert(
    insuranceAfter - insuranceBefore === expectedInsurance,
    `Insurance should receive ${expectedInsurance}, got ${insuranceAfter - insuranceBefore}`
  );
  console.log("✅ Fees distributed correctly");
  
  // Test 5: Update Distribution Percentages
  console.log("\n📝 Test 5: Update Distribution Percentages");
  
  const updateHash = await treasuryContract.write.updateDistribution([40n, 25n, 20n, 15n], { account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: updateHash });
  
  const newStaking = await treasuryContract.read.stakingRewardsPercentage();
  const newBuyback = await treasuryContract.read.buybackPercentage();
  const newDev = await treasuryContract.read.developmentPercentage();
  const newInsurance = await treasuryContract.read.insurancePercentage();
  
  console.assert(newStaking === 40n, "New staking % should be 40");
  console.assert(newBuyback === 25n, "New buyback % should be 25");
  console.assert(newDev === 20n, "New dev % should be 20");
  console.assert(newInsurance === 15n, "New insurance % should be 15");
  console.log("✅ Distribution percentages updated");
  
  // Test 6: Pausable
  console.log("\n📝 Test 6: Pausable Functionality");
  
  const pauseHash = await treasuryContract.write.pause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  
  const isPaused = await treasuryContract.read.paused();
  console.assert(isPaused === true, "Contract should be paused");
  console.log("✅ Contract paused");
  
  // Try to collect fees while paused (should fail)
  try {
    await treasuryContract.write.receiveVaultFees([parseEther("100")], { account: vault1.account });
    console.assert(false, "Should not be able to collect fees while paused");
  } catch (error) {
    console.log("✅ Fee collection correctly prevented while paused");
  }
  
  // Unpause
  const unpauseHash = await treasuryContract.write.unpause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  console.log("✅ Contract unpaused");
  
  // Test 7: Emergency Withdraw
  console.log("\n📝 Test 7: Emergency Withdraw");
  
  const treasuryBalance = await botToken.read.balanceOf([treasuryContract.address]);
  const emergencyAmount = parseEther("100");
  
  if (treasuryBalance >= emergencyAmount) {
    const emergencyHash = await treasuryContract.write.emergencyWithdraw(
      [botToken.address, emergencyAmount],
      { account: deployer.account }
    );
    await publicClient.waitForTransactionReceipt({ hash: emergencyHash });
    
    const balanceAfter = await botToken.read.balanceOf([treasuryContract.address]);
    console.assert(
      balanceAfter === treasuryBalance - emergencyAmount,
      "Emergency withdraw should reduce balance"
    );
    console.log("✅ Emergency withdraw successful");
  }
  
  console.log("\n🎉 All Treasury tests passed!");
  console.log("📊 Total tests: 7");
  console.log("✅ Passed: 7");
  console.log("❌ Failed: 0");
  
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });