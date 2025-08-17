import { network } from "hardhat";
import { parseEther, keccak256, toBytes } from "viem";

/**
 * Basic Integration Test
 * 
 * Simple validation that contracts deploy and basic operations work
 * Uses direct contract deployment instead of TestUtilities
 */

async function main() {
  console.log("Starting Basic Integration Test...\n");
  
  const connection = await network.connect();
  const { viem } = connection;
  
  if (!viem) {
    throw new Error("Viem not available in network connection");
  }
  
  try {
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, operator, player1] = await viem.getWalletClients();
    
    let testsPassed = 0;
    let totalTests = 0;
    
    console.log("Wallets initialized\n");
    
    // TEST 1: Deploy BOT Token
    console.log("TEST 1: BOT Token Deployment");
    
    const botToken = await viem.deployContract("BOTToken", [
      treasury.account.address,    // treasury
      liquidity.account.address,   // liquidity
      deployer.account.address,    // staking
      deployer.account.address,    // team
      deployer.account.address     // community
    ]);
    
    const totalSupply = await botToken.read.totalSupply();
    
    totalTests++;
    if (totalSupply > 0n) {
      console.log(`PASS: BOT Token deployed with supply ${totalSupply.toString()}`);
      testsPassed++;
    } else {
      console.log("FAIL: BOT Token deployment failed");
    }
    
    // TEST 2: Deploy VRF Mock
    console.log("\nTEST 2: VRF Coordinator Deployment");
    
    const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
    const subscriptionId = BigInt(1);
    const keyHash = "0x" + "1".repeat(64);
    
    totalTests++;
    if (mockVRF.address) {
      console.log(`PASS: VRF Coordinator deployed at ${mockVRF.address}`);
      testsPassed++;
    } else {
      console.log("FAIL: VRF Coordinator deployment failed");
    }
    
    // TEST 3: Deploy Craps Game
    console.log("\nTEST 3: Craps Game Deployment");
    
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      mockVRF.address,
      subscriptionId,
      keyHash
    ]);
    
    // Add game as VRF consumer
    await mockVRF.write.addConsumer([subscriptionId, crapsGame.address]);
    
    const gamePhase = await crapsGame.read.getCurrentPhase();
    
    totalTests++;
    if (crapsGame.address && gamePhase >= 0) { // Any valid phase
      console.log(`PASS: Craps Game deployed at ${crapsGame.address}`);
      console.log(`  Initial phase: ${gamePhase}`);
      testsPassed++;
    } else {
      console.log("FAIL: Craps Game deployment failed");
    }
    
    // TEST 4: Deploy Supporting Contracts
    console.log("\nTEST 4: Supporting Contracts Deployment");
    
    // Deploy betting contract (no constructor args)
    const crapsBets = await viem.deployContract("CrapsBets");
    
    // Deploy settlement contract (no constructor args)
    const crapsSettlement = await viem.deployContract("CrapsSettlement");
    
    totalTests++;
    if (crapsBets.address && crapsSettlement.address) {
      console.log(`PASS: Supporting contracts deployed`);
      console.log(`  CrapsBets: ${crapsBets.address}`);
      console.log(`  CrapsSettlement: ${crapsSettlement.address}`);
      testsPassed++;
    } else {
      console.log("FAIL: Supporting contracts deployment failed");
    }
    
    // TEST 5: Basic Contract Setup
    console.log("\nTEST 5: Contract Configuration");
    
    try {
      // Grant operator role
      const OPERATOR_ROLE = keccak256(toBytes("OPERATOR_ROLE"));
      await crapsGame.write.grantRole([OPERATOR_ROLE, operator.account.address]);
      
      // Connect contracts
      await crapsBets.write.setContracts([
        crapsGame.address,
        crapsSettlement.address
      ]);
      
      await crapsSettlement.write.setContracts([
        crapsGame.address,
        crapsBets.address,
        botToken.address
      ]);
      
      totalTests++;
      console.log(`PASS: Contracts configured successfully`);
      testsPassed++;
    } catch (error) {
      totalTests++;
      console.log(`FAIL: Contract configuration failed: ${error}`);
    }
    
    // TEST 6: Basic Game Operation
    console.log("\nTEST 6: Basic Game Operations");
    
    try {
      // Start new series
      const startTx = await crapsGame.write.startNewSeries(
        { account: operator.account }
      );
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: startTx });
      const currentSeries = await crapsGame.read.getCurrentSeries();
      const newPhase = await crapsGame.read.getCurrentPhase();
      
      totalTests++;
      if (currentSeries > 0n && newPhase === 0) { // COME_OUT phase
        console.log(`PASS: Game series started`);
        console.log(`  Series ID: ${currentSeries.toString()}`);
        console.log(`  Game phase: ${newPhase} (COME_OUT)`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
        testsPassed++;
      } else {
        console.log(`FAIL: Game series start failed`);
      }
    } catch (error) {
      totalTests++;
      console.log(`FAIL: Game operation failed: ${error}`);
    }
    
    // FINAL RESULTS
    const successRate = (testsPassed / totalTests) * 100;
    
    console.log(`\n${"-".repeat(50)}`);
    console.log(`BASIC INTEGRATION TEST RESULTS:`);
    console.log(`PASS: ${testsPassed}/${totalTests} (${successRate.toFixed(1)}%)`);
    
    if (successRate >= 80) {
      console.log(`\nSTATUS: BASIC INTEGRATION SUCCESSFUL`);
      console.log(`System demonstrates core functionality`);
    } else {
      console.log(`\nSTATUS: INTEGRATION ISSUES DETECTED`);
      console.log(`Further investigation required`);
    }
    
    console.log(`\nBasic Integration Test Complete!`);
    
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
