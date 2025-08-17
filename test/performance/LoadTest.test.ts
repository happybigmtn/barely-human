/**
 * @title Load Test Suite
 * @notice High-volume transaction testing for production readiness
 * @dev Tests system behavior under heavy concurrent load
 */

import { network } from "hardhat";
import assert from "assert";
import { formatEther, parseEther } from "viem";

// Load testing parameters
const LOAD_CONFIGS = {
  LIGHT_LOAD: {
    users: 10,
    betsPerUser: 10,
    duration: 30, // seconds
  },
  MEDIUM_LOAD: {
    users: 50,
    betsPerUser: 20,
    duration: 60,
  },
  HEAVY_LOAD: {
    users: 100,
    betsPerUser: 50,
    duration: 120,
  },
  STRESS_TEST: {
    users: 200,
    betsPerUser: 100,
    duration: 300,
  },
};

// Performance requirements
const PERFORMANCE_TARGETS = {
  MIN_TPS: 10, // transactions per second
  MAX_RESPONSE_TIME: 5000, // milliseconds
  MAX_MEMORY_USAGE: 512 * 1024 * 1024, // 512MB
  MIN_SUCCESS_RATE: 0.95, // 95%
  MAX_GAS_PER_TX: 500_000n,
};

interface LoadTestResult {
  config: any;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalDuration: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  tps: number;
  successRate: number;
  totalGasUsed: bigint;
  avgGasPerTx: bigint;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  errors: string[];
}

class LoadTestReporter {
  private results: LoadTestResult[] = [];
  
  addResult(result: LoadTestResult) {
    this.results.push(result);
  }
  
  generateReport(): string {
    const report = [
      "\n" + "=".repeat(80),
      "🚀 BARELY HUMAN CASINO - LOAD TEST REPORT",
      "=".repeat(80),
    ];
    
    for (const result of this.results) {
      const configName = Object.keys(LOAD_CONFIGS).find(
        key => LOAD_CONFIGS[key as keyof typeof LOAD_CONFIGS] === result.config
      ) || "CUSTOM";
      
      report.push(`\n🎯 ${configName} LOAD TEST`);
      report.push("-".repeat(50));
      
      // Performance metrics
      report.push(`📊 Throughput: ${result.tps.toFixed(2)} TPS`);
      report.push(`✅ Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
      report.push(`⏱️  Avg Response: ${result.avgResponseTime.toFixed(0)}ms`);
      report.push(`⚡ Max Response: ${result.maxResponseTime.toFixed(0)}ms`);
      report.push(`⛽ Gas/TX: ${Number(result.avgGasPerTx).toLocaleString()}`);
      
      // Memory usage
      const memoryMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
      report.push(`💾 Memory: ${memoryMB(result.memoryUsage.initial)}MB → ${memoryMB(result.memoryUsage.peak)}MB → ${memoryMB(result.memoryUsage.final)}MB`);
      
      // Status checks
      const tpsPass = result.tps >= PERFORMANCE_TARGETS.MIN_TPS;
      const successPass = result.successRate >= PERFORMANCE_TARGETS.MIN_SUCCESS_RATE;
      const responsePass = result.maxResponseTime <= PERFORMANCE_TARGETS.MAX_RESPONSE_TIME;
      const gasPass = result.avgGasPerTx <= PERFORMANCE_TARGETS.MAX_GAS_PER_TX;
      
      report.push(`\n🏆 Performance Status:`);
      report.push(`  TPS Target (${PERFORMANCE_TARGETS.MIN_TPS}+): ${tpsPass ? '✅' : '❌'} ${result.tps.toFixed(2)}`);
      report.push(`  Success Rate (${PERFORMANCE_TARGETS.MIN_SUCCESS_RATE * 100}%+): ${successPass ? '✅' : '❌'} ${(result.successRate * 100).toFixed(1)}%`);
      report.push(`  Response Time (<${PERFORMANCE_TARGETS.MAX_RESPONSE_TIME}ms): ${responsePass ? '✅' : '❌'} ${result.maxResponseTime.toFixed(0)}ms`);
      report.push(`  Gas Efficiency (<${Number(PERFORMANCE_TARGETS.MAX_GAS_PER_TX).toLocaleString()}): ${gasPass ? '✅' : '❌'} ${Number(result.avgGasPerTx).toLocaleString()}`);
      
      if (result.errors.length > 0) {
        report.push(`\n⚠️  Errors (${result.errors.length}):`);
        const errorCounts = result.errors.reduce((acc, err) => {
          acc[err] = (acc[err] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(errorCounts).forEach(([error, count]) => {
          report.push(`  • ${error}: ${count}x`);
        });
      }
    }
    
    // Summary analysis
    report.push("\n📈 LOAD TEST ANALYSIS");
    report.push("-".repeat(50));
    
    const maxTps = Math.max(...this.results.map(r => r.tps));
    const avgSuccessRate = this.results.reduce((sum, r) => sum + r.successRate, 0) / this.results.length;
    
    report.push(`• Peak Throughput: ${maxTps.toFixed(2)} TPS`);
    report.push(`• Average Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
    report.push(`• System Stability: ${avgSuccessRate >= 0.95 ? 'Excellent' : avgSuccessRate >= 0.90 ? 'Good' : 'Needs Improvement'}`);
    
    // Recommendations
    report.push("\n💡 RECOMMENDATIONS");
    report.push("-".repeat(50));
    
    if (maxTps < PERFORMANCE_TARGETS.MIN_TPS) {
      report.push("• Consider optimizing contract gas usage to improve throughput");
    }
    if (avgSuccessRate < PERFORMANCE_TARGETS.MIN_SUCCESS_RATE) {
      report.push("• Investigate transaction failures and implement retry mechanisms");
    }
    if (this.results.some(r => r.maxResponseTime > PERFORMANCE_TARGETS.MAX_RESPONSE_TIME)) {
      report.push("• Response times indicate potential network or gas limit issues");
    }
    
    report.push("\n" + "=".repeat(80));
    return report.join("\n");
  }
}

class PerformanceMonitor {
  private startTime = 0;
  private responseTimes: number[] = [];
  private gasUsages: bigint[] = [];
  private errors: string[] = [];
  
  start() {
    this.startTime = Date.now();
    this.responseTimes = [];
    this.gasUsages = [];
    this.errors = [];
  }
  
  recordTransaction(responseTime: number, gasUsed: bigint, error?: string) {
    this.responseTimes.push(responseTime);
    this.gasUsages.push(gasUsed);
    if (error) this.errors.push(error);
  }
  
  getMetrics() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.responseTimes.length - this.errors.length;
    
    return {
      totalTransactions: this.responseTimes.length,
      successfulTransactions: successful,
      failedTransactions: this.errors.length,
      totalDuration,
      avgResponseTime: this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length,
      maxResponseTime: Math.max(...this.responseTimes),
      minResponseTime: Math.min(...this.responseTimes),
      tps: this.responseTimes.length / (totalDuration / 1000),
      successRate: successful / this.responseTimes.length,
      totalGasUsed: this.gasUsages.reduce((a, b) => a + b, 0n),
      avgGasPerTx: this.gasUsages.reduce((a, b) => a + b, 0n) / BigInt(this.gasUsages.length),
      errors: this.errors,
    };
  }
}

function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

describe("🚀 Load Test Suite", function() {
  this.timeout(600000); // 10 minutes for load tests
  
  let connection: any;
  let viem: any;
  let publicClient: any;
  let walletClients: any;
  let reporter: LoadTestReporter;
  
  // Contract instances
  let botToken: any;
  let crapsGame: any;
  let crapsBets: any;
  let crapsSettlement: any;
  let crapsVault: any;
  let botManager: any;

  before(async function() {
    console.log("🚀 Initializing Load Test Suite...");
    
    connection = await network.connect();
    viem = connection.viem;
    publicClient = await viem.getPublicClient();
    walletClients = await viem.getWalletClients();
    reporter = new LoadTestReporter();

    // Deploy contracts
    console.log("📦 Deploying contracts for load testing...");
    
    botToken = await viem.deployContract("BOTToken", [
      "Barely Human Token",
      "BOT",
      parseEther("1000000000"), // 1B supply
      walletClients[0].account.address,
    ]);

    crapsGame = await viem.deployContract("CrapsGame", [
      "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
      1,
    ]);

    crapsBets = await viem.deployContract("CrapsBets", [crapsGame.address]);
    crapsSettlement = await viem.deployContract("CrapsSettlement", [crapsGame.address]);
    botManager = await viem.deployContract("BotManager", [crapsGame.address]);
    
    // Fund accounts with BOT tokens
    for (let i = 0; i < 10; i++) {
      await botToken.write.transfer([walletClients[i % walletClients.length].account.address, parseEther("100000")]);
    }
    
    console.log("✅ Setup complete");
  });

  after(async function() {
    console.log(reporter.generateReport());
    await connection.close();
  });

  async function runLoadTest(config: any, testName: string): Promise<LoadTestResult> {
    console.log(`\n🚀 Starting ${testName}...`);
    console.log(`Users: ${config.users}, Bets/User: ${config.betsPerUser}, Duration: ${config.duration}s`);
    
    const monitor = new PerformanceMonitor();
    monitor.start();
    
    const initialMemory = getMemoryUsage();
    let peakMemory = initialMemory;
    
    // Start new series
    await crapsGame.write.startNewSeries([1]);
    
    const promises: Promise<void>[] = [];
    
    // Create concurrent user sessions
    for (let userId = 0; userId < config.users; userId++) {
      const userPromise = async () => {
        const walletIndex = userId % walletClients.length;
        const userWallet = walletClients[walletIndex];
        
        // Each user places multiple bets
        for (let betIndex = 0; betIndex < config.betsPerUser; betIndex++) {
          try {
            const startTime = Date.now();
            
            // Vary bet types and amounts for realistic load
            const betType = Math.floor(Math.random() * 10); // First 10 bet types
            const amount = parseEther((Math.random() * 1000 + 100).toString()); // 100-1100 BOT
            
            const hash = await crapsBets.write.placeBet([
              betType,
              amount,
              userWallet.account.address,
            ]);
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            const responseTime = Date.now() - startTime;
            
            monitor.recordTransaction(responseTime, receipt.gasUsed);
            
            // Update peak memory
            const currentMemory = getMemoryUsage();
            if (currentMemory > peakMemory) {
              peakMemory = currentMemory;
            }
            
            // Random delay between bets (0-1000ms)
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            
          } catch (error: any) {
            monitor.recordTransaction(5000, 0n, error.message || "Unknown error");
          }
        }
      };
      
      promises.push(userPromise());
    }
    
    // Wait for all users to complete or timeout
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error("Load test timeout")), config.duration * 1000)
    );
    
    try {
      await Promise.race([
        Promise.all(promises),
        timeoutPromise,
      ]);
    } catch (error) {
      console.log(`⚠️  ${testName} timed out or had errors`);
    }
    
    const metrics = monitor.getMetrics();
    const finalMemory = getMemoryUsage();
    
    const result: LoadTestResult = {
      config,
      ...metrics,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory,
      },
    };
    
    console.log(`✅ ${testName} completed:`);
    console.log(`  📊 TPS: ${result.tps.toFixed(2)}`);
    console.log(`  ✅ Success: ${(result.successRate * 100).toFixed(1)}%`);
    console.log(`  ⏱️  Avg Response: ${result.avgResponseTime.toFixed(0)}ms`);
    
    reporter.addResult(result);
    return result;
  }

  describe("💪 Load Testing Scenarios", function() {
    it("should handle light load (10 users, 10 bets each)", async function() {
      const result = await runLoadTest(LOAD_CONFIGS.LIGHT_LOAD, "Light Load Test");
      
      // Assertions for light load
      assert(result.successRate >= 0.95, "Success rate should be at least 95% for light load");
      assert(result.tps >= 5, "Should achieve at least 5 TPS for light load");
      assert(result.maxResponseTime <= 10000, "Max response time should be under 10s for light load");
    });

    it("should handle medium load (50 users, 20 bets each)", async function() {
      const result = await runLoadTest(LOAD_CONFIGS.MEDIUM_LOAD, "Medium Load Test");
      
      // Assertions for medium load
      assert(result.successRate >= 0.90, "Success rate should be at least 90% for medium load");
      assert(result.tps >= 8, "Should achieve at least 8 TPS for medium load");
      assert(result.maxResponseTime <= 15000, "Max response time should be under 15s for medium load");
    });

    it("should handle heavy load (100 users, 50 bets each)", async function() {
      const result = await runLoadTest(LOAD_CONFIGS.HEAVY_LOAD, "Heavy Load Test");
      
      // Assertions for heavy load
      assert(result.successRate >= 0.85, "Success rate should be at least 85% for heavy load");
      assert(result.tps >= 10, "Should achieve at least 10 TPS for heavy load");
      assert(result.maxResponseTime <= 20000, "Max response time should be under 20s for heavy load");
    });

    it("should survive stress test (200 users, 100 bets each)", async function() {
      console.log("⚠️  Running stress test - expect some failures");
      const result = await runLoadTest(LOAD_CONFIGS.STRESS_TEST, "Stress Test");
      
      // More lenient assertions for stress test
      assert(result.successRate >= 0.70, "Success rate should be at least 70% under stress");
      assert(result.tps >= 5, "Should maintain at least 5 TPS under stress");
      
      console.log(`🔥 Stress test results: ${(result.successRate * 100).toFixed(1)}% success rate`);
    });
  });

  describe("🎯 Targeted Performance Tests", function() {
    it("should measure settlement performance under load", async function() {
      console.log("🎲 Testing settlement performance...");
      
      // Place many bets first
      const betPromises = [];
      for (let i = 0; i < 100; i++) {
        betPromises.push(
          crapsBets.write.placeBet([0, parseEther("100"), walletClients[0].account.address])
        );
      }
      
      await Promise.all(betPromises);
      
      // Measure settlement time
      const startTime = Date.now();
      const hash = await crapsSettlement.write.settleSeries([1, [4, 5]]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const settlementTime = Date.now() - startTime;
      
      console.log(`⚡ Settlement of 100 bets took ${settlementTime}ms and ${Number(receipt.gasUsed).toLocaleString()} gas`);
      
      assert(settlementTime <= 30000, "Settlement should complete within 30 seconds");
      assert(receipt.gasUsed <= 2_000_000n, "Settlement gas should be under 2M");
    });

    it("should handle rapid consecutive settlements", async function() {
      const settlementTimes = [];
      
      for (let series = 2; series <= 6; series++) {
        // Start new series and place bets
        await crapsGame.write.startNewSeries([series]);
        
        for (let i = 0; i < 20; i++) {
          await crapsBets.write.placeBet([0, parseEther("100"), walletClients[0].account.address]);
        }
        
        // Measure settlement
        const startTime = Date.now();
        await crapsSettlement.write.settleSeries([series, [3, 4]]);
        settlementTimes.push(Date.now() - startTime);
      }
      
      const avgSettlementTime = settlementTimes.reduce((a, b) => a + b, 0) / settlementTimes.length;
      console.log(`📊 Average settlement time over 5 series: ${avgSettlementTime.toFixed(0)}ms`);
      
      assert(avgSettlementTime <= 10000, "Average settlement time should be under 10 seconds");
    });

    it("should maintain performance with bot automation", async function() {
      console.log("🤖 Testing with automated bots...");
      
      await botManager.write.initializeBots();
      
      // Start series for bots
      await crapsGame.write.startNewSeries([10]);
      
      // Measure bot betting performance
      const startTime = Date.now();
      
      const botPromises = [];
      for (let i = 0; i < 10; i++) {
        botPromises.push(botManager.write.makeBotBet([i, 10]));
      }
      
      await Promise.all(botPromises);
      const botBettingTime = Date.now() - startTime;
      
      console.log(`🤖 10 bots placed bets in ${botBettingTime}ms`);
      
      assert(botBettingTime <= 15000, "Bot betting should complete within 15 seconds");
    });
  });

  describe("📈 Performance Analytics", function() {
    it("should analyze gas efficiency trends", async function() {
      const betCounts = [1, 10, 50, 100];
      const efficiencyData = [];
      
      for (const count of betCounts) {
        await crapsGame.write.startNewSeries([count + 20]);
        
        // Place bets
        const gasUsages = [];
        for (let i = 0; i < count; i++) {
          const hash = await crapsBets.write.placeBet([0, parseEther("100"), walletClients[0].account.address]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          gasUsages.push(Number(receipt.gasUsed));
        }
        
        const avgGas = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
        efficiencyData.push({ count, avgGas });
      }
      
      console.log("\n📈 Gas Efficiency Analysis:");
      efficiencyData.forEach(({ count, avgGas }) => {
        console.log(`  ${count.toString().padStart(3)} bets: ${avgGas.toFixed(0).padStart(6)} gas/bet`);
      });
      
      // Check for efficiency degradation
      const gasIncrease = (efficiencyData[3].avgGas - efficiencyData[0].avgGas) / efficiencyData[0].avgGas;
      console.log(`\n📉 Gas usage increase: ${(gasIncrease * 100).toFixed(1)}%`);
      
      assert(gasIncrease <= 0.1, "Gas usage should not increase by more than 10% with scale");
    });

    it("should measure memory efficiency", async function() {
      const initialMemory = getMemoryUsage();
      console.log(`💾 Initial memory: ${(initialMemory / 1024 / 1024).toFixed(1)}MB`);
      
      // Create memory pressure with many transactions
      for (let i = 0; i < 500; i++) {
        await crapsBets.write.placeBet([0, parseEther("10"), walletClients[0].account.address]);
        
        if (i % 100 === 0) {
          const currentMemory = getMemoryUsage();
          console.log(`💾 After ${i} transactions: ${(currentMemory / 1024 / 1024).toFixed(1)}MB`);
        }
      }
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`💾 Final memory: ${(finalMemory / 1024 / 1024).toFixed(1)}MB`);
      console.log(`📈 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
      
      assert(memoryIncrease <= PERFORMANCE_TARGETS.MAX_MEMORY_USAGE, "Memory usage should not exceed 512MB");
    });
  });
});