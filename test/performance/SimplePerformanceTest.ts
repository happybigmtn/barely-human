/**
 * @title Simple Performance Test
 * @notice Quick performance validation test
 * @dev Validates that performance testing infrastructure works
 */

import { network } from "hardhat";
import { parseEther } from "viem";

async function runSimplePerformanceTest() {
  console.log("🚀 Running Simple Performance Test...");
  
  let connection: any;
  
  try {
    connection = await network.connect();
    const { viem } = connection;
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    
    console.log("📦 Deploying test contracts...");
    
    // Deploy BOT Token
    const startTime = Date.now();
    const botToken = await viem.deployContract("BOTToken", [
      walletClients[0].account.address, // treasury
      walletClients[1].account.address, // liquidity
      walletClients[2].account.address, // staking rewards
      walletClients[3].account.address, // team
      walletClients[4].account.address, // community
    ]);
    const deployTime = Date.now() - startTime;
    
    console.log(`✅ BOT Token deployed in ${deployTime}ms`);
    
    // Test token transfer gas
    const transferStartTime = Date.now();
    const hash = await botToken.write.transfer([walletClients[1].account.address, parseEther("1000")]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const transferTime = Date.now() - transferStartTime;
    
    console.log(`✅ Token transfer completed:`);
    console.log(`   Gas used: ${Number(receipt.gasUsed).toLocaleString()}`);
    console.log(`   Time: ${transferTime}ms`);
    
    // Deploy game contract
    const gameStartTime = Date.now();
    const crapsGame = await viem.deployContract("CrapsGame", [
      "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
      1,
    ]);
    const gameDeployTime = Date.now() - gameStartTime;
    
    console.log(`✅ CrapsGame deployed in ${gameDeployTime}ms`);
    
    // Test series start
    const seriesStartTime = Date.now();
    const seriesHash = await crapsGame.write.startNewSeries([1]);
    const seriesReceipt = await publicClient.waitForTransactionReceipt({ hash: seriesHash });
    const seriesTime = Date.now() - seriesStartTime;
    
    console.log(`✅ Game series started:`);
    console.log(`   Gas used: ${Number(seriesReceipt.gasUsed).toLocaleString()}`);
    console.log(`   Time: ${seriesTime}ms`);
    
    // Performance Summary
    console.log("\n📈 PERFORMANCE SUMMARY");
    console.log("=".repeat(50));
    console.log(`BOT Token Deploy: ${deployTime}ms`);
    console.log(`Transfer Gas: ${Number(receipt.gasUsed).toLocaleString()}`);
    console.log(`Game Deploy: ${gameDeployTime}ms`);
    console.log(`Series Start Gas: ${Number(seriesReceipt.gasUsed).toLocaleString()}`);
    
    // Basic validation
    const transferGasOK = receipt.gasUsed <= 100_000n;
    const seriesGasOK = seriesReceipt.gasUsed <= 150_000n;
    const deployTimeOK = deployTime <= 10000;
    
    console.log("\n🎯 VALIDATION RESULTS");
    console.log("=".repeat(50));
    console.log(`Transfer Gas (<100k): ${transferGasOK ? '✅' : '❌'} ${Number(receipt.gasUsed).toLocaleString()}`);
    console.log(`Series Gas (<150k): ${seriesGasOK ? '✅' : '❌'} ${Number(seriesReceipt.gasUsed).toLocaleString()}`);
    console.log(`Deploy Time (<10s): ${deployTimeOK ? '✅' : '❌'} ${deployTime}ms`);
    
    const allOK = transferGasOK && seriesGasOK && deployTimeOK;
    console.log(`\n🏆 Overall Status: ${allOK ? '✅ PASS' : '❌ FAIL'}`);
    
    await connection.close();
    
    if (!allOK) {
      throw new Error("Performance validation failed");
    }
    
    console.log("✅ Simple performance test completed successfully!");
    
  } catch (error) {
    if (connection) await connection.close();
    console.error("❌ Simple performance test failed:", error);
    throw error;
  }
}

// Run the test
runSimplePerformanceTest().catch(console.error);