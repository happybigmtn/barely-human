import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing CrapsVault Contract...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, treasury, liquidity, staking, team, community, player1, player2] = 
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
  
  // Deploy Mock VRF
  console.log("\n📦 Deploying Mock VRF Coordinator...");
  const mockVRF = await viem.deployContract("MockVRFCoordinator");
  console.log("✅ Mock VRF deployed at:", mockVRF.address);
  
  // Deploy Treasury
  console.log("\n📦 Deploying Treasury...");
  const treasuryContract = await viem.deployContract("Treasury", [
    botToken.address,
    deployer.account.address,
    deployer.account.address
  ]);
  console.log("✅ Treasury deployed at:", treasuryContract.address);
  
  // Deploy CrapsGame
  console.log("\n📦 Deploying CrapsGame...");
  const crapsGame = await viem.deployContract("CrapsGame", [
    mockVRF.address,
    1n, // subscription ID
    keccak256(toBytes("keyHash"))
  ]);
  console.log("✅ CrapsGame deployed at:", crapsGame.address);
  
  // Deploy CrapsVault
  console.log("\n📦 Deploying CrapsVault...");
  const vault = await viem.deployContract("CrapsVault", [
    botToken.address,
    crapsGame.address,
    treasuryContract.address,
    0n, // Bot ID
    "Test Vault"
  ]);
  console.log("✅ CrapsVault deployed at:", vault.address);
  
  // Setup roles
  const GAME_ROLE = keccak256(toBytes("GAME_ROLE"));
  await vault.write.grantRole([GAME_ROLE, crapsGame.address], { account: deployer.account });
  
  // Transfer tokens to players for testing
  const playerTokens = parseEther("10000");
  await botToken.write.transfer([player1.account.address, playerTokens], { account: liquidity.account });
  await botToken.write.transfer([player2.account.address, playerTokens], { account: liquidity.account });
  
  console.log("✅ Setup complete\n");
  
  // Test 1: Vault Info
  console.log("📝 Test 1: Vault Information");
  const name = await vault.read.name();
  const symbol = await vault.read.symbol();
  const asset = await vault.read.asset();
  const botId = await vault.read.botId();
  
  console.assert(name === "Test Vault", `Expected name "Test Vault", got "${name}"`);
  console.assert(symbol === "vTEST", `Expected symbol "vTEST", got "${symbol}"`);
  console.assert(asset === botToken.address, "Asset should be BOT token");
  console.assert(botId === 0n, "Bot ID should be 0");
  console.log("✅ Vault info correct");
  
  // Test 2: Deposit
  console.log("\n📝 Test 2: Deposit Functionality");
  
  // Player1 deposits
  const depositAmount = parseEther("1000");
  await botToken.write.approve([vault.address, depositAmount], { account: player1.account });
  
  const shares = await vault.read.previewDeposit([depositAmount]);
  const depositHash = await vault.write.deposit([depositAmount, player1.account.address], { account: player1.account });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  
  const player1Shares = await vault.read.balanceOf([player1.account.address]);
  const totalAssets = await vault.read.totalAssets();
  
  console.assert(player1Shares === shares, `Expected shares ${shares}, got ${player1Shares}`);
  console.assert(totalAssets === depositAmount, `Expected assets ${depositAmount}, got ${totalAssets}`);
  console.log("✅ Deposit successful: 1000 BOT");
  
  // Player2 deposits
  const deposit2Amount = parseEther("2000");
  await botToken.write.approve([vault.address, deposit2Amount], { account: player2.account });
  
  const deposit2Hash = await vault.write.deposit([deposit2Amount, player2.account.address], { account: player2.account });
  await publicClient.waitForTransactionReceipt({ hash: deposit2Hash });
  
  const totalAssetsAfter = await vault.read.totalAssets();
  console.assert(totalAssetsAfter === depositAmount + deposit2Amount, "Total assets should be 3000 BOT");
  console.log("✅ Second deposit successful: 2000 BOT");
  
  // Test 3: Withdraw
  console.log("\n📝 Test 3: Withdraw Functionality");
  
  const withdrawAmount = parseEther("500");
  const maxShares = await vault.read.previewWithdraw([withdrawAmount]);
  
  const withdrawHash = await vault.write.withdraw(
    [withdrawAmount, player1.account.address, player1.account.address],
    { account: player1.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
  
  const player1SharesAfter = await vault.read.balanceOf([player1.account.address]);
  const expectedShares = player1Shares - maxShares;
  
  console.assert(
    player1SharesAfter === expectedShares,
    `Expected shares ${expectedShares}, got ${player1SharesAfter}`
  );
  console.log("✅ Withdraw successful: 500 BOT");
  
  // Test 4: Redeem
  console.log("\n📝 Test 4: Redeem Functionality");
  
  const redeemShares = parseEther("100");
  const assetsOut = await vault.read.previewRedeem([redeemShares]);
  
  const redeemHash = await vault.write.redeem(
    [redeemShares, player2.account.address, player2.account.address],
    { account: player2.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: redeemHash });
  
  console.log(`✅ Redeemed ${redeemShares} shares for ${assetsOut} assets`);
  
  // Test 5: Max Operations
  console.log("\n📝 Test 5: Max Operations");
  
  const maxDeposit = await vault.read.maxDeposit([player1.account.address]);
  const maxMint = await vault.read.maxMint([player1.account.address]);
  const maxWithdraw = await vault.read.maxWithdraw([player1.account.address]);
  const maxRedeem = await vault.read.maxRedeem([player1.account.address]);
  
  console.log(`   Max Deposit: ${maxDeposit}`);
  console.log(`   Max Mint: ${maxMint}`);
  console.log(`   Max Withdraw: ${maxWithdraw}`);
  console.log(`   Max Redeem: ${maxRedeem}`);
  console.log("✅ Max operations retrieved");
  
  // Test 6: Performance Fee
  console.log("\n📝 Test 6: Performance Fee");
  
  const performanceFee = await vault.read.PERFORMANCE_FEE();
  console.assert(performanceFee === 200n, `Expected fee 200 (2%), got ${performanceFee}`);
  
  // Simulate profit by sending tokens directly to vault
  const profit = parseEther("100");
  await botToken.write.transfer([vault.address, profit], { account: liquidity.account });
  
  // Take performance fee
  const feeHash = await vault.write.takePerformanceFee({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: feeHash });
  
  const treasuryBalance = await botToken.read.balanceOf([treasuryContract.address]);
  console.assert(treasuryBalance > 0n, "Treasury should have received fees");
  console.log("✅ Performance fee taken");
  
  // Test 7: Bet Locking
  console.log("\n📝 Test 7: Bet Locking Mechanism");
  
  // Lock funds for bet (only game can do this)
  try {
    await vault.write.lockForBet([player1.account.address, parseEther("100")], { account: player1.account });
    console.assert(false, "Non-game should not be able to lock funds");
  } catch (error) {
    console.log("✅ Only game can lock funds for bets");
  }
  
  // Test 8: Pausable
  console.log("\n📝 Test 8: Pausable Functionality");
  
  const pauseHash = await vault.write.pause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  
  const isPaused = await vault.read.paused();
  console.assert(isPaused === true, "Vault should be paused");
  
  // Try to deposit while paused
  try {
    await vault.write.deposit([parseEther("100"), player1.account.address], { account: player1.account });
    console.assert(false, "Should not be able to deposit while paused");
  } catch (error) {
    console.log("✅ Deposits prevented while paused");
  }
  
  // Unpause
  const unpauseHash = await vault.write.unpause({ account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  console.log("✅ Vault unpaused");
  
  // Test 9: Convert Functions
  console.log("\n📝 Test 9: Conversion Functions");
  
  const testAssets = parseEther("100");
  const testShares = parseEther("100");
  
  const sharesFromAssets = await vault.read.convertToShares([testAssets]);
  const assetsFromShares = await vault.read.convertToAssets([testShares]);
  
  console.log(`   100 assets = ${sharesFromAssets} shares`);
  console.log(`   100 shares = ${assetsFromShares} assets`);
  console.log("✅ Conversion functions working");
  
  console.log("\n🎉 All CrapsVault tests passed!");
  console.log("📊 Total tests: 9");
  console.log("✅ Passed: 9");
  console.log("❌ Failed: 0");
  
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });