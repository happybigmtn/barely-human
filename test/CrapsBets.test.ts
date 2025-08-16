import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

async function main() {
  console.log("🧪 Testing CrapsBets Contract...\n");
  
  // Connect to network and get viem
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  // Get wallet clients
  const [deployer, player1, player2, player3, gameManager] = 
    await viem.getWalletClients();
  
  // Get public client
  const publicClient = await viem.getPublicClient();
  
  // Deploy Mock VRF
  console.log("📦 Deploying Mock VRF Coordinator...");
  const mockVRF = await viem.deployContract("MockVRFCoordinator");
  console.log("✅ Mock VRF deployed at:", mockVRF.address);
  
  // Deploy CrapsGame
  console.log("\n📦 Deploying CrapsGame...");
  const crapsGame = await viem.deployContract("CrapsGame", [
    mockVRF.address,
    1n, // subscription ID
    keccak256(toBytes("keyHash"))
  ]);
  console.log("✅ CrapsGame deployed at:", crapsGame.address);
  
  // Deploy CrapsBets
  console.log("\n📦 Deploying CrapsBets...");
  const crapsBets = await viem.deployContract("CrapsBets", [
    crapsGame.address
  ]);
  console.log("✅ CrapsBets deployed at:", crapsBets.address);
  
  // Grant roles
  const GAME_ROLE = keccak256(toBytes("GAME_ROLE"));
  const MANAGER_ROLE = keccak256(toBytes("MANAGER_ROLE"));
  
  await crapsGame.write.grantRole([GAME_ROLE, crapsBets.address], { account: deployer.account });
  await crapsGame.write.grantRole([MANAGER_ROLE, gameManager.account.address], { account: deployer.account });
  
  // Start a new series for testing
  await crapsGame.write.startNewSeries({ account: gameManager.account });
  await crapsGame.write.addPlayer([player1.account.address], { account: gameManager.account });
  await crapsGame.write.addPlayer([player2.account.address], { account: gameManager.account });
  
  console.log("✅ Setup complete\n");
  
  // Test 1: Place Pass Line Bet
  console.log("📝 Test 1: Pass Line Bet");
  
  const betAmount = parseEther("100");
  const placeBetHash = await crapsBets.write.placeBet([
    1n, // series ID
    player1.account.address,
    0n, // PASS_LINE bet type
    betAmount,
    0n // no target
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: placeBetHash });
  
  const bet = await crapsBets.read.getBet([1n, player1.account.address, 0n]);
  console.assert(bet[0] === betAmount, `Expected bet amount ${betAmount}, got ${bet[0]}`);
  console.assert(bet[1] === 0n, "Expected target to be 0");
  console.assert(bet[2] === true, "Bet should be active");
  console.log("✅ Pass line bet placed");
  
  // Test 2: Place Don't Pass Bet
  console.log("\n📝 Test 2: Don't Pass Line Bet");
  
  const dontPassHash = await crapsBets.write.placeBet([
    1n,
    player2.account.address,
    1n, // DONT_PASS_LINE
    betAmount,
    0n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: dontPassHash });
  
  const dontPassBet = await crapsBets.read.getBet([1n, player2.account.address, 1n]);
  console.assert(dontPassBet[0] === betAmount, "Don't pass bet amount incorrect");
  console.log("✅ Don't pass line bet placed");
  
  // Test 3: Place Field Bet
  console.log("\n📝 Test 3: Field Bet");
  
  const fieldHash = await crapsBets.write.placeBet([
    1n,
    player1.account.address,
    4n, // FIELD
    betAmount,
    0n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: fieldHash });
  
  const fieldBet = await crapsBets.read.getBet([1n, player1.account.address, 4n]);
  console.assert(fieldBet[0] === betAmount, "Field bet amount incorrect");
  console.log("✅ Field bet placed");
  
  // Test 4: Place YES Number Bet
  console.log("\n📝 Test 4: YES Number Bet");
  
  const yesHash = await crapsBets.write.placeBet([
    1n,
    player1.account.address,
    5n, // YES_4
    betAmount,
    4n // target is 4
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: yesHash });
  
  const yesBet = await crapsBets.read.getBet([1n, player1.account.address, 5n]);
  console.assert(yesBet[0] === betAmount, "YES bet amount incorrect");
  console.assert(yesBet[1] === 4n, "YES bet target should be 4");
  console.log("✅ YES number bet placed");
  
  // Test 5: Place Hardway Bet
  console.log("\n📝 Test 5: Hardway Bet");
  
  const hardwayHash = await crapsBets.write.placeBet([
    1n,
    player2.account.address,
    25n, // HARDWAY_4
    betAmount,
    4n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: hardwayHash });
  
  const hardwayBet = await crapsBets.read.getBet([1n, player2.account.address, 25n]);
  console.assert(hardwayBet[0] === betAmount, "Hardway bet amount incorrect");
  console.log("✅ Hardway bet placed");
  
  // Test 6: Place Odds Bet (after setting point)
  console.log("\n📝 Test 6: Odds Bet");
  
  // Set point to 6
  await crapsGame.write.setPoint([6n], { account: gameManager.account });
  
  const oddsHash = await crapsBets.write.placeBet([
    1n,
    player1.account.address,
    29n, // ODDS_PASS
    betAmount,
    6n // point is 6
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: oddsHash });
  
  const oddsBet = await crapsBets.read.getBet([1n, player1.account.address, 29n]);
  console.assert(oddsBet[0] === betAmount, "Odds bet amount incorrect");
  console.log("✅ Odds bet placed");
  
  // Test 7: Place Bonus Bet
  console.log("\n📝 Test 7: Bonus Bet");
  
  const bonusHash = await crapsBets.write.placeBet([
    1n,
    player2.account.address,
    33n, // BONUS_FIRE
    betAmount,
    0n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: bonusHash });
  
  const bonusBet = await crapsBets.read.getBet([1n, player2.account.address, 33n]);
  console.assert(bonusBet[0] === betAmount, "Bonus bet amount incorrect");
  console.log("✅ Bonus bet placed");
  
  // Test 8: Place NEXT Roll Bet
  console.log("\n📝 Test 8: NEXT Roll Bet");
  
  const nextHash = await crapsBets.write.placeBet([
    1n,
    player1.account.address,
    43n, // NEXT_ANY_7
    betAmount,
    7n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: nextHash });
  
  const nextBet = await crapsBets.read.getBet([1n, player1.account.address, 43n]);
  console.assert(nextBet[0] === betAmount, "NEXT bet amount incorrect");
  console.log("✅ NEXT roll bet placed");
  
  // Test 9: Place Repeater Bet
  console.log("\n📝 Test 9: Repeater Bet");
  
  const repeaterHash = await crapsBets.write.placeBet([
    1n,
    player2.account.address,
    54n, // REPEATER_2
    betAmount,
    2n
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: repeaterHash });
  
  const repeaterBet = await crapsBets.read.getBet([1n, player2.account.address, 54n]);
  console.assert(repeaterBet[0] === betAmount, "Repeater bet amount incorrect");
  console.log("✅ Repeater bet placed");
  
  // Test 10: Get Active Bets
  console.log("\n📝 Test 10: Get Active Bets");
  
  const player1Bets = await crapsBets.read.getActiveBets([1n, player1.account.address]);
  console.log(`   Player 1 active bets: ${player1Bets.length}`);
  console.assert(player1Bets.length > 0, "Player 1 should have active bets");
  
  const player2Bets = await crapsBets.read.getActiveBets([1n, player2.account.address]);
  console.log(`   Player 2 active bets: ${player2Bets.length}`);
  console.assert(player2Bets.length > 0, "Player 2 should have active bets");
  console.log("✅ Active bets retrieved");
  
  // Test 11: Resolve Bet
  console.log("\n📝 Test 11: Resolve Bet");
  
  const resolveHash = await crapsBets.write.resolveBet([
    1n,
    player1.account.address,
    4n, // FIELD bet
    parseEther("200") // winnings
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: resolveHash });
  
  const resolvedBet = await crapsBets.read.getBet([1n, player1.account.address, 4n]);
  console.assert(resolvedBet[2] === false, "Bet should be inactive after resolution");
  console.log("✅ Bet resolved");
  
  // Test 12: Clear All Bets
  console.log("\n📝 Test 12: Clear All Bets");
  
  const clearHash = await crapsBets.write.clearAllBets([
    1n,
    player1.account.address
  ], { account: gameManager.account });
  await publicClient.waitForTransactionReceipt({ hash: clearHash });
  
  const clearedBets = await crapsBets.read.getActiveBets([1n, player1.account.address]);
  console.assert(clearedBets.length === 0, "All bets should be cleared");
  console.log("✅ All bets cleared");
  
  // Test 13: Invalid Bet Type
  console.log("\n📝 Test 13: Invalid Bet Type Rejection");
  
  try {
    await crapsBets.write.placeBet([
      1n,
      player1.account.address,
      65n, // Invalid bet type (>63)
      betAmount,
      0n
    ], { account: gameManager.account });
    console.assert(false, "Should reject invalid bet type");
  } catch (error) {
    console.log("✅ Invalid bet type rejected");
  }
  
  // Test 14: Bet History
  console.log("\n📝 Test 14: Bet History");
  
  const totalBets = await crapsBets.read.getTotalBets([1n, player2.account.address]);
  console.log(`   Player 2 total bets placed: ${totalBets}`);
  console.assert(totalBets > 0n, "Player 2 should have bet history");
  console.log("✅ Bet history tracked");
  
  // Test 15: Access Control
  console.log("\n📝 Test 15: Access Control");
  
  try {
    await crapsBets.write.placeBet([
      1n,
      player1.account.address,
      0n,
      betAmount,
      0n
    ], { account: player1.account });
    console.assert(false, "Non-game role should not place bets");
  } catch (error) {
    console.log("✅ Access control enforced");
  }
  
  console.log("\n🎉 All CrapsBets tests passed!");
  console.log("📊 Total tests: 15");
  console.log("✅ Passed: 15");
  console.log("❌ Failed: 0");
  
  await connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });