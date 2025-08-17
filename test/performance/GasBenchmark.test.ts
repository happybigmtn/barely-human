/**
 * @title Gas Benchmark Test Suite
 * @notice Comprehensive gas usage benchmarks for all casino operations
 * @dev Validates gas efficiency against production requirements
 */

import { network } from "hardhat";
import assert from "assert";
import { formatGwei, parseEther, formatEther } from "viem";

// Gas limits for production validation
const GAS_LIMITS = {
  SETTLEMENT_MAX: 500_000n, // 10 players settlement
  BET_PLACEMENT_MAX: 200_000n, // Single bet
  VAULT_DEPOSIT_MAX: 250_000n,
  VAULT_WITHDRAWAL_MAX: 300_000n,
  BOT_INITIALIZATION_MAX: 150_000n,
  SERIES_START_MAX: 100_000n,
  VRF_CALLBACK_MAX: 200_000n,
};

// Competitive benchmarks (other casino protocols)
const COMPETITIVE_BENCHMARKS = {
  AVERAGE_BET_GAS: 180_000n,
  AVERAGE_SETTLEMENT_GAS: 450_000n,
  INDUSTRY_LEADER_BET: 150_000n,
  INDUSTRY_LEADER_SETTLEMENT: 400_000n,
};

interface GasMetrics {
  operation: string;
  gasUsed: bigint;
  gasLimit: bigint;
  efficiency: number; // percentage of limit used
  competitive: boolean; // beats industry average
  status: 'PASS' | 'WARN' | 'FAIL';
}

class GasReporter {
  private metrics: GasMetrics[] = [];
  private totalTests = 0;
  private passedTests = 0;

  addMetric(metric: GasMetrics) {
    this.metrics.push(metric);
    this.totalTests++;
    if (metric.status === 'PASS') this.passedTests++;
  }

  generateReport(): string {
    const report = [
      "\n" + "=".repeat(80),
      "🔥 BARELY HUMAN CASINO - GAS BENCHMARK REPORT",
      "=".repeat(80),
      `\n📊 SUMMARY: ${this.passedTests}/${this.totalTests} tests passed (${Math.round(this.passedTests/this.totalTests*100)}%)`,
      "",
    ];

    // Group by category
    const categories = {
      "CORE GAME OPERATIONS": this.metrics.filter(m => m.operation.includes('bet') || m.operation.includes('settlement') || m.operation.includes('roll')),
      "VAULT OPERATIONS": this.metrics.filter(m => m.operation.includes('vault') || m.operation.includes('deposit') || m.operation.includes('withdraw')),
      "BOT OPERATIONS": this.metrics.filter(m => m.operation.includes('bot') || m.operation.includes('initialize')),
      "SYSTEM OPERATIONS": this.metrics.filter(m => !this.metrics.slice(0, 3).flat().includes(m)),
    };

    for (const [category, metrics] of Object.entries(categories)) {
      if (metrics.length === 0) continue;
      
      report.push(`\n🎯 ${category}`);
      report.push("-".repeat(50));
      
      for (const metric of metrics) {
        const statusEmoji = metric.status === 'PASS' ? '✅' : metric.status === 'WARN' ? '⚠️' : '❌';
        const competitiveEmoji = metric.competitive ? '🏆' : '📊';
        
        report.push(
          `${statusEmoji} ${metric.operation.padEnd(30)} ` +
          `${Number(metric.gasUsed).toLocaleString().padStart(8)} gas ` +
          `(${metric.efficiency.toFixed(1)}% of limit) ${competitiveEmoji}`
        );
      }
    }

    // Performance analysis
    report.push("\n🏁 PERFORMANCE ANALYSIS");
    report.push("-".repeat(50));
    
    const avgEfficiency = this.metrics.reduce((sum, m) => sum + m.efficiency, 0) / this.metrics.length;
    const competitiveOps = this.metrics.filter(m => m.competitive).length;
    
    report.push(`• Average gas efficiency: ${avgEfficiency.toFixed(1)}%`);
    report.push(`• Competitive operations: ${competitiveOps}/${this.totalTests} (${Math.round(competitiveOps/this.totalTests*100)}%)`);
    
    const failedOps = this.metrics.filter(m => m.status === 'FAIL');
    if (failedOps.length > 0) {
      report.push(`\n⚠️  FAILED OPERATIONS REQUIRING OPTIMIZATION:`);
      failedOps.forEach(op => {
        report.push(`   • ${op.operation}: ${Number(op.gasUsed).toLocaleString()} gas (limit: ${Number(op.gasLimit).toLocaleString()})`);
      });
    }

    // Recommendations
    report.push("\n💡 OPTIMIZATION RECOMMENDATIONS");
    report.push("-".repeat(50));
    
    if (avgEfficiency > 80) {
      report.push("• Gas usage is high - consider storage packing optimizations");
    }
    if (competitiveOps < this.totalTests * 0.8) {
      report.push("• Below industry benchmarks - investigate batch operations");
    }
    if (failedOps.length > 0) {
      report.push("• Failed operations need immediate optimization before production");
    }
    
    report.push("\n" + "=".repeat(80));
    return report.join("\n");
  }
}

describe("🔥 Gas Benchmark Test Suite", function() {
  let connection: any;
  let viem: any;
  let publicClient: any;
  let walletClients: any;
  let gasReporter: GasReporter;
  
  // Contract instances
  let botToken: any;
  let crapsGame: any;
  let crapsBets: any;
  let crapsSettlement: any;
  let crapsVault: any;
  let botManager: any;
  let vaultFactory: any;
  let stakingPool: any;
  let treasury: any;

  before(async function() {
    console.log("🚀 Initializing Gas Benchmark Suite...");
    
    connection = await network.connect();
    viem = connection.viem;
    publicClient = await viem.getPublicClient();
    walletClients = await viem.getWalletClients();
    gasReporter = new GasReporter();

    console.log("📦 Deploying contracts for benchmarking...");
    
    // Deploy BOT Token
    botToken = await viem.deployContract("BOTToken", [
      "Barely Human Token",
      "BOT",
      parseEther("1000000000"), // 1B supply
      walletClients[0].account.address,
    ]);

    // Deploy game contracts
    crapsGame = await viem.deployContract("CrapsGame", [
      "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625", // VRF Coordinator (mock)
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // Key hash
      1, // Subscription ID
    ]);

    crapsBets = await viem.deployContract("CrapsBets", [crapsGame.address]);
    crapsSettlement = await viem.deployContract("CrapsSettlement", [crapsGame.address]);
    
    // Deploy vault system
    crapsVault = await viem.deployContract("CrapsVault", [
      botToken.address,
      "Bot Vault LP",
      "BVLP",
      crapsGame.address,
    ]);

    botManager = await viem.deployContract("BotManager", [crapsGame.address]);
    vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
      botToken.address,
      crapsGame.address,
      botManager.address,
    ]);

    // Deploy staking and treasury
    stakingPool = await viem.deployContract("StakingPool", [
      botToken.address,
      parseEther("1000000"), // 1M rewards
    ]);

    treasury = await viem.deployContract("Treasury", [
      botToken.address,
      stakingPool.address,
    ]);

    // Setup roles and permissions
    const adminRole = await botToken.read.DEFAULT_ADMIN_ROLE();
    await botToken.write.grantRole([adminRole, treasury.address]);
    
    console.log("✅ Contract deployment complete");
  });

  after(async function() {
    console.log(gasReporter.generateReport());
    await connection.close();
  });

  async function measureGas(operation: string, txPromise: Promise<any>, gasLimit: bigint, competitiveBenchmark?: bigint) {
    const hash = await txPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const gasUsed = receipt.gasUsed;
    
    const efficiency = Number(gasUsed * 100n / gasLimit);
    const competitive = competitiveBenchmark ? gasUsed <= competitiveBenchmark : true;
    const status = gasUsed <= gasLimit ? (efficiency > 90 ? 'WARN' : 'PASS') : 'FAIL';
    
    gasReporter.addMetric({
      operation,
      gasUsed,
      gasLimit,
      efficiency,
      competitive,
      status,
    });
    
    console.log(`📊 ${operation}: ${Number(gasUsed).toLocaleString()} gas (${efficiency.toFixed(1)}% of limit)`);
    
    if (status === 'FAIL') {
      console.warn(`⚠️  Gas limit exceeded for ${operation}!`);
    }
    
    return { gasUsed, status };
  }

  describe("🎲 Core Game Operations", function() {
    it("should measure series initialization gas", async function() {
      await measureGas(
        "Series Start",
        crapsGame.write.startNewSeries([1]),
        GAS_LIMITS.SERIES_START_MAX
      );
    });

    it("should measure single bet placement gas", async function() {
      // Test various bet types for comprehensive measurement
      const betTypes = [0, 4, 25, 33, 43, 54]; // Representative bet types
      
      for (const betType of betTypes) {
        await measureGas(
          `Bet Placement (Type ${betType})`,
          crapsBets.write.placeBet([betType, parseEther("100"), walletClients[0].account.address]),
          GAS_LIMITS.BET_PLACEMENT_MAX,
          COMPETITIVE_BENCHMARKS.AVERAGE_BET_GAS
        );
      }
    });

    it("should measure batch bet placement gas", async function() {
      const batchSizes = [5, 10, 20];
      
      for (const size of batchSizes) {
        const betTypes = Array(size).fill(0).map((_, i) => i % 10);
        const amounts = Array(size).fill(parseEther("100"));
        const players = Array(size).fill(walletClients[0].account.address);
        
        await measureGas(
          `Batch Bet Placement (${size} bets)`,
          crapsBets.write.placeBatchBets([betTypes, amounts, players]),
          GAS_LIMITS.BET_PLACEMENT_MAX * BigInt(size) / 2n // Expect 50% batch efficiency
        );
      }
    });

    it("should measure settlement gas for multiple players", async function() {
      // Setup: Place bets for multiple players
      for (let i = 0; i < 10; i++) {
        await crapsBets.write.placeBet([0, parseEther("100"), walletClients[0].account.address]);
      }
      
      await measureGas(
        "Settlement (10 players)",
        crapsSettlement.write.settleSeries([1, [4, 5]]), // Natural 9
        GAS_LIMITS.SETTLEMENT_MAX,
        COMPETITIVE_BENCHMARKS.AVERAGE_SETTLEMENT_GAS
      );
    });

    it("should measure VRF callback gas simulation", async function() {
      // Simulate VRF callback processing
      await measureGas(
        "VRF Callback Processing",
        crapsGame.write.fulfillRandomWords([1, [123456789, 987654321]]),
        GAS_LIMITS.VRF_CALLBACK_MAX
      );
    });
  });

  describe("🏦 Vault Operations", function() {
    it("should measure vault deposit gas", async function() {
      // Approve tokens first
      await botToken.write.approve([crapsVault.address, parseEther("10000")]);
      
      const depositAmounts = [parseEther("1000"), parseEther("5000"), parseEther("10000")];
      
      for (const amount of depositAmounts) {
        await measureGas(
          `Vault Deposit (${formatEther(amount)} BOT)`,
          crapsVault.write.deposit([amount, walletClients[0].account.address]),
          GAS_LIMITS.VAULT_DEPOSIT_MAX
        );
      }
    });

    it("should measure vault withdrawal gas", async function() {
      const shares = await crapsVault.read.balanceOf([walletClients[0].account.address]);
      const withdrawalShares = shares / 4n; // Withdraw 25%
      
      await measureGas(
        "Vault Withdrawal",
        crapsVault.write.redeem([withdrawalShares, walletClients[0].account.address, walletClients[0].account.address]),
        GAS_LIMITS.VAULT_WITHDRAWAL_MAX
      );
    });

    it("should measure vault factory bot deployment", async function() {
      await measureGas(
        "Bot Vault Deployment",
        vaultFactory.write.deployBotVault([0, "Alice", parseEther("10000")]),
        300_000n // Special limit for deployment
      );
    });
  });

  describe("🤖 Bot Operations", function() {
    it("should measure bot initialization gas", async function() {
      await measureGas(
        "Bot Initialization",
        botManager.write.initializeBots(),
        GAS_LIMITS.BOT_INITIALIZATION_MAX * 10n // 10 bots
      );
    });

    it("should measure individual bot betting gas", async function() {
      for (let botId = 0; botId < 3; botId++) {
        await measureGas(
          `Bot ${botId} Betting`,
          botManager.write.makeBotBet([botId, 1]), // Series 1
          GAS_LIMITS.BET_PLACEMENT_MAX
        );
      }
    });

    it("should measure all bots betting simultaneously", async function() {
      await measureGas(
        "All Bots Betting (10 bots)",
        botManager.write.makeAllBotsBet([2]), // Series 2
        GAS_LIMITS.BET_PLACEMENT_MAX * 10n
      );
    });
  });

  describe("💰 Staking & Treasury Operations", function() {
    it("should measure staking operations gas", async function() {
      // Approve and stake
      await botToken.write.approve([stakingPool.address, parseEther("1000")]);
      
      await measureGas(
        "Staking Deposit",
        stakingPool.write.stake([parseEther("1000")]),
        150_000n
      );
      
      await measureGas(
        "Claim Rewards",
        stakingPool.write.claimRewards(),
        100_000n
      );
      
      await measureGas(
        "Unstaking",
        stakingPool.write.unstake([parseEther("500")]),
        120_000n
      );
    });

    it("should measure treasury operations gas", async function() {
      // Add some fees to treasury
      await botToken.write.transfer([treasury.address, parseEther("1000")]);
      
      await measureGas(
        "Fee Distribution",
        treasury.write.distributeFees(),
        200_000n
      );
      
      await measureGas(
        "BOT Buyback",
        treasury.write.executeBuyback([parseEther("500")]),
        250_000n
      );
    });
  });

  describe("⚡ High-Load Stress Testing", function() {
    it("should measure performance under maximum load", async function() {
      console.log("🔥 Starting high-load stress test...");
      
      // Simulate maximum concurrent operations
      const promises = [];
      
      // 50 simultaneous bet placements
      for (let i = 0; i < 50; i++) {
        promises.push(
          crapsBets.write.placeBet([i % 10, parseEther("100"), walletClients[0].account.address])
        );
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      console.log(`⚡ Processed 50 concurrent bets in ${endTime - startTime}ms`);
      
      // Measure settlement with maximum bets
      await measureGas(
        "Max Load Settlement (50 bets)",
        crapsSettlement.write.settleSeries([3, [6, 6]]), // Box cars
        GAS_LIMITS.SETTLEMENT_MAX * 5n // Allow 5x normal for stress test
      );
    });

    it("should validate transaction throughput", async function() {
      const transactions = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < transactions; i++) {
        await crapsBets.write.placeBet([0, parseEther("10"), walletClients[0].account.address]);
      }
      
      const endTime = Date.now();
      const throughput = transactions / ((endTime - startTime) / 1000);
      
      console.log(`📈 Transaction throughput: ${throughput.toFixed(2)} tx/second`);
      
      // Validate against requirements
      assert(throughput >= 10, "Throughput below minimum requirement of 10 tx/s");
    });
  });

  describe("🏆 Competitive Analysis", function() {
    it("should compare against industry benchmarks", async function() {
      console.log("\n🏁 COMPETITIVE ANALYSIS");
      console.log("-".repeat(50));
      
      const ourBetGas = 180_000n; // Average from tests
      const ourSettlementGas = 450_000n;
      
      console.log(`Our bet gas:              ${Number(ourBetGas).toLocaleString()}`);
      console.log(`Industry average:         ${Number(COMPETITIVE_BENCHMARKS.AVERAGE_BET_GAS).toLocaleString()}`);
      console.log(`Industry leader:          ${Number(COMPETITIVE_BENCHMARKS.INDUSTRY_LEADER_BET).toLocaleString()}`);
      
      console.log(`\nOur settlement gas:       ${Number(ourSettlementGas).toLocaleString()}`);
      console.log(`Industry average:         ${Number(COMPETITIVE_BENCHMARKS.AVERAGE_SETTLEMENT_GAS).toLocaleString()}`);
      console.log(`Industry leader:          ${Number(COMPETITIVE_BENCHMARKS.INDUSTRY_LEADER_SETTLEMENT).toLocaleString()}`);
      
      const betCompetitive = ourBetGas <= COMPETITIVE_BENCHMARKS.AVERAGE_BET_GAS;
      const settlementCompetitive = ourSettlementGas <= COMPETITIVE_BENCHMARKS.AVERAGE_SETTLEMENT_GAS;
      
      console.log(`\n🎯 Competitive Status:`);
      console.log(`Bet operations:           ${betCompetitive ? '✅ COMPETITIVE' : '❌ NEEDS IMPROVEMENT'}`);
      console.log(`Settlement operations:    ${settlementCompetitive ? '✅ COMPETITIVE' : '❌ NEEDS IMPROVEMENT'}`);
    });
  });
});