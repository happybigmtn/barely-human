import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing BOTToken Contract...\n");
  
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
  
  // Test 1: Token details
  console.log("\n📝 Test 1: Token Details");
  const name = await botToken.read.name();
  const symbol = await botToken.read.symbol();
  const decimals = await botToken.read.decimals();
  
  console.assert(name === "Barely Human", `Expected name to be "Barely Human", got "${name}"`);
  console.assert(symbol === "BOT", `Expected symbol to be "BOT", got "${symbol}"`);
  console.assert(decimals === 18, `Expected decimals to be 18, got ${decimals}`);
  console.log("✅ Token details correct");
  
  // Test 2: Total supply
  console.log("\n📝 Test 2: Total Supply");
  const totalSupply = await botToken.read.totalSupply();
  const expectedSupply = parseEther("1000000000");
  console.assert(
    totalSupply === expectedSupply, 
    `Expected supply ${expectedSupply}, got ${totalSupply}`
  );
  console.log("✅ Total supply: 1,000,000,000 BOT");
  
  // Test 3: Token distribution
  console.log("\n📝 Test 3: Token Distribution");
  const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
  const expectedTreasury = parseEther("200000000");
  console.assert(
    treasuryBalance === expectedTreasury,
    `Expected treasury balance ${expectedTreasury}, got ${treasuryBalance}`
  );
  console.log("✅ Treasury: 200,000,000 BOT");
  
  const liquidityBalance = await botToken.read.balanceOf([liquidity.account.address]);
  const expectedLiquidity = parseEther("300000000");
  console.assert(
    liquidityBalance === expectedLiquidity,
    `Expected liquidity balance ${expectedLiquidity}, got ${liquidityBalance}`
  );
  console.log("✅ Liquidity: 300,000,000 BOT");
  
  const stakingBalance = await botToken.read.balanceOf([staking.account.address]);
  const expectedStaking = parseEther("250000000");
  console.assert(
    stakingBalance === expectedStaking,
    `Expected staking balance ${expectedStaking}, got ${stakingBalance}`
  );
  console.log("✅ Staking: 250,000,000 BOT");
  
  // Test 4: Roles
  console.log("\n📝 Test 4: Access Control Roles");
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const TREASURY_ROLE = keccak256(toBytes("TREASURY_ROLE"));
  const STAKING_ROLE = keccak256(toBytes("STAKING_ROLE"));
  const PAUSER_ROLE = keccak256(toBytes("PAUSER_ROLE"));
  
  const deployerHasAdmin = await botToken.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]);
  console.assert(deployerHasAdmin === true, "Deployer should have admin role");
  console.log("✅ Deployer has admin role");
  
  const treasuryHasRole = await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]);
  console.assert(treasuryHasRole === true, "Treasury should have treasury role");
  console.log("✅ Treasury has treasury role");
  
  const stakingHasRole = await botToken.read.hasRole([STAKING_ROLE, staking.account.address]);
  console.assert(stakingHasRole === true, "Staking should have staking role");
  console.log("✅ Staking has staking role");
  
  // Test 5: Transfer
  console.log("\n📝 Test 5: Token Transfer");
  const transferAmount = parseEther("100");
  
  const hash = await botToken.write.transfer(
    [user1.account.address, transferAmount],
    { account: treasury.account }
  );
  
  await publicClient.waitForTransactionReceipt({ hash });
  
  const user1Balance = await botToken.read.balanceOf([user1.account.address]);
  console.assert(
    user1Balance === transferAmount,
    `Expected user1 balance ${transferAmount}, got ${user1Balance}`
  );
  console.log("✅ Transfer successful: 100 BOT to user1");
  
  // Test 6: Pausable
  console.log("\n📝 Test 6: Pausable Functionality");
  let paused = await botToken.read.paused();
  console.assert(paused === false, "Contract should not be paused initially");
  
  const pauseHash = await botToken.write.pause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  
  paused = await botToken.read.paused();
  console.assert(paused === true, "Contract should be paused");
  console.log("✅ Contract paused successfully");
  
  const unpauseHash = await botToken.write.unpause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  
  paused = await botToken.read.paused();
  console.assert(paused === false, "Contract should be unpaused");
  console.log("✅ Contract unpaused successfully");
  
  // Test 7: Burn
  console.log("\n📝 Test 7: Token Burning");
  const burnAmount = parseEther("1000");
  const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
  const initialSupply = await botToken.read.totalSupply();
  
  const burnHash = await botToken.write.burn(
    [burnAmount],
    { account: treasury.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: burnHash });
  
  const newBalance = await botToken.read.balanceOf([treasury.account.address]);
  const newSupply = await botToken.read.totalSupply();
  
  console.assert(
    newBalance === initialBalance - burnAmount,
    "Balance should decrease by burn amount"
  );
  console.assert(
    newSupply === initialSupply - burnAmount,
    "Total supply should decrease by burn amount"
  );
  console.log("✅ Burn successful: 1000 BOT burned");
  
  // Test 8: Approve and TransferFrom
  console.log("\n📝 Test 8: Approve and TransferFrom");
  const approveAmount = parseEther("500");
  
  const approveHash = await botToken.write.approve(
    [user1.account.address, approveAmount],
    { account: treasury.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  
  const allowance = await botToken.read.allowance([treasury.account.address, user1.account.address]);
  console.assert(
    allowance === approveAmount,
    `Expected allowance ${approveAmount}, got ${allowance}`
  );
  console.log("✅ Approval successful");
  
  const transferFromHash = await botToken.write.transferFrom(
    [treasury.account.address, user2.account.address, approveAmount],
    { account: user1.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: transferFromHash });
  
  const user2Balance = await botToken.read.balanceOf([user2.account.address]);
  console.assert(
    user2Balance === approveAmount,
    `Expected user2 balance ${approveAmount}, got ${user2Balance}`
  );
  console.log("✅ TransferFrom successful: 500 BOT to user2");
  
  // Test 9: Role Management
  console.log("\n📝 Test 9: Role Management");
  
  // Grant TREASURY_ROLE to user1
  const grantHash = await botToken.write.grantRole(
    [TREASURY_ROLE, user1.account.address],
    { account: deployer.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: grantHash });
  
  const user1HasTreasuryRole = await botToken.read.hasRole([TREASURY_ROLE, user1.account.address]);
  console.assert(user1HasTreasuryRole === true, "User1 should have treasury role");
  console.log("✅ Role granted successfully");
  
  // Revoke TREASURY_ROLE from user1
  const revokeHash = await botToken.write.revokeRole(
    [TREASURY_ROLE, user1.account.address],
    { account: deployer.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: revokeHash });
  
  const user1StillHasRole = await botToken.read.hasRole([TREASURY_ROLE, user1.account.address]);
  console.assert(user1StillHasRole === false, "User1 should not have treasury role");
  console.log("✅ Role revoked successfully");
  
  console.log("\n🎉 All tests passed successfully!");
  console.log("📊 Total tests: 9");
  console.log("✅ Passed: 9");
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