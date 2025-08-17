/**
 * @title Basic Performance Test
 * @notice Minimal performance validation without complex contracts
 * @dev Tests basic Hardhat + Viem performance infrastructure
 */

import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

async function runBasicPerformanceTest() {
  console.log("🚀 Running Basic Performance Infrastructure Test...");
  console.log("=".repeat(60));
  
  let connection: any;
  
  try {
    const overallStartTime = Date.now();
    
    // Test 1: Network Connection
    console.log("\n🌐 Testing network connection...");
    const connectionStartTime = Date.now();
    
    connection = await network.connect();
    const { viem } = connection;
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    
    const connectionTime = Date.now() - connectionStartTime;
    console.log(`✅ Network connected in ${connectionTime}ms`);
    
    // Test 2: Basic Contract Deployment
    console.log("\n📦 Testing simple contract deployment...");
    const deployStartTime = Date.now();
    
    // Use a simple mock contract for testing
    const mockContract = await viem.deployContract("MockToken", [
      "Test Token",
      "TEST",
      parseEther("1000000"),
    ]);
    
    const deployTime = Date.now() - deployStartTime;
    console.log(`✅ Contract deployed in ${deployTime}ms`);
    console.log(`   Address: ${mockContract.address}`);
    
    // Test 3: Transaction Performance
    console.log("\n🔄 Testing transaction performance...");
    
    const transactions = [];
    const transactionTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const txStartTime = Date.now();
      
      const hash = await mockContract.write.transfer([
        walletClients[1].account.address,
        parseEther("100"),
      ]);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const txTime = Date.now() - txStartTime;
      
      transactions.push({
        hash,
        gasUsed: receipt.gasUsed,
        time: txTime,
      });
      
      transactionTimes.push(txTime);
      console.log(`   TX ${i + 1}: ${txTime}ms, Gas: ${Number(receipt.gasUsed).toLocaleString()}`);
    }
    
    // Test 4: Read Performance
    console.log("\n📚 Testing read performance...");
    const readStartTime = Date.now();
    
    const balance = await mockContract.read.balanceOf([walletClients[0].account.address]);
    const totalSupply = await mockContract.read.totalSupply();
    const name = await mockContract.read.name();
    
    const readTime = Date.now() - readStartTime;
    console.log(`✅ Read operations completed in ${readTime}ms`);
    console.log(`   Balance: ${formatEther(balance)} TEST`);
    console.log(`   Total Supply: ${formatEther(totalSupply)} TEST`);
    console.log(`   Name: ${name}`);
    
    // Test 5: Batch Operations
    console.log("\n📦 Testing batch operations...");
    const batchStartTime = Date.now();
    
    const batchPromises = [];
    for (let i = 0; i < 3; i++) {
      batchPromises.push(
        mockContract.write.transfer([
          walletClients[(i + 2) % walletClients.length].account.address,
          parseEther("50"),
        ])
      );
    }
    
    const batchHashes = await Promise.all(batchPromises);
    const batchReceipts = await Promise.all(
      batchHashes.map(hash => publicClient.waitForTransactionReceipt({ hash }))
    );
    
    const batchTime = Date.now() - batchStartTime;
    const totalBatchGas = batchReceipts.reduce((sum, receipt) => sum + receipt.gasUsed, 0n);
    
    console.log(`✅ Batch operations completed in ${batchTime}ms`);
    console.log(`   Total Gas: ${Number(totalBatchGas).toLocaleString()}`);
    console.log(`   Avg Gas per TX: ${Number(totalBatchGas / BigInt(batchReceipts.length)).toLocaleString()}`);
    
    // Performance Analysis
    const totalTime = Date.now() - overallStartTime;
    const avgTxTime = transactionTimes.reduce((sum, time) => sum + time, 0) / transactionTimes.length;
    const maxTxTime = Math.max(...transactionTimes);
    const minTxTime = Math.min(...transactionTimes);
    
    const avgGasPerTx = transactions.reduce((sum, tx) => sum + tx.gasUsed, 0n) / BigInt(transactions.length);
    
    console.log("\n📈 PERFORMANCE ANALYSIS");
    console.log("=".repeat(60));
    console.log(`Total Test Duration: ${totalTime}ms`);
    console.log(`Connection Time: ${connectionTime}ms`);
    console.log(`Deployment Time: ${deployTime}ms`);
    console.log(`Read Operations: ${readTime}ms`);
    console.log(`Batch Operations: ${batchTime}ms`);
    
    console.log("\n📉 TRANSACTION METRICS");
    console.log("-".repeat(40));
    console.log(`Average TX Time: ${avgTxTime.toFixed(1)}ms`);
    console.log(`Min TX Time: ${minTxTime}ms`);
    console.log(`Max TX Time: ${maxTxTime}ms`);
    console.log(`Average Gas per TX: ${Number(avgGasPerTx).toLocaleString()}`);
    
    // Performance Validation
    console.log("\n🎯 PERFORMANCE VALIDATION");
    console.log("=".repeat(60));
    
    const validations = [
      { test: "Connection Speed", value: connectionTime, limit: 5000, unit: "ms" },
      { test: "Deployment Speed", value: deployTime, limit: 15000, unit: "ms" },
      { test: "Average TX Time", value: avgTxTime, limit: 3000, unit: "ms" },
      { test: "Read Operations", value: readTime, limit: 1000, unit: "ms" },
      { test: "Gas Efficiency", value: Number(avgGasPerTx), limit: 100000, unit: "gas" },
    ];
    
    let allPassed = true;
    
    validations.forEach(({ test, value, limit, unit }) => {
      const passed = value <= limit;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test}: ${typeof value === 'number' ? value.toFixed(1) : value}${unit} (limit: ${limit}${unit})`);
      if (!passed) allPassed = false;
    });
    
    // Throughput calculation
    const totalTransactions = transactions.length + batchReceipts.length;
    const throughput = totalTransactions / (totalTime / 1000);
    
    console.log("\n🚀 THROUGHPUT ANALYSIS");
    console.log("-".repeat(40));
    console.log(`Total Transactions: ${totalTransactions}`);
    console.log(`Test Duration: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`Throughput: ${throughput.toFixed(2)} TPS`);
    
    const throughputOK = throughput >= 2; // Minimum 2 TPS for basic test
    console.log(`${throughputOK ? '✅' : '❌'} Throughput Target (2+ TPS): ${throughput.toFixed(2)} TPS`);
    
    if (!throughputOK) allPassed = false;
    
    // Memory usage (if available)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const heapMB = memUsage.heapUsed / 1024 / 1024;
      
      console.log("\n💾 MEMORY USAGE");
      console.log("-".repeat(40));
      console.log(`Heap Used: ${heapMB.toFixed(1)}MB`);
      console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB`);
      
      const memoryOK = heapMB <= 100; // 100MB limit for basic test
      console.log(`${memoryOK ? '✅' : '❌'} Memory Target (<100MB): ${heapMB.toFixed(1)}MB`);
      
      if (!memoryOK) allPassed = false;
    }
    
    // Final Result
    console.log("\n🏆 FINAL RESULT");
    console.log("=".repeat(60));
    
    if (allPassed) {
      console.log("✅ ALL PERFORMANCE TESTS PASSED!");
      console.log("🚀 System performance is acceptable for testing");
      console.log("🔧 Performance testing infrastructure is working correctly");
    } else {
      console.log("⚠️  SOME PERFORMANCE TESTS FAILED");
      console.log("🔧 Review failed metrics and optimize as needed");
    }
    
    await connection.close();
    
    if (!allPassed) {
      throw new Error("Performance validation failed - see details above");
    }
    
    console.log("\n✅ Basic performance test completed successfully!");
    return {
      connectionTime,
      deployTime,
      avgTxTime,
      throughput,
      totalTime,
    };
    
  } catch (error) {
    if (connection) await connection.close();
    console.error("❌ Basic performance test failed:", error);
    throw error;
  }
}

// Export for use in other tests
export { runBasicPerformanceTest };

// Run the test if executed directly
if (require.main === module) {
  runBasicPerformanceTest().catch(console.error);
}