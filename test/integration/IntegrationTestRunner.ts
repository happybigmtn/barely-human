import { network } from "hardhat";
import { TestResults } from "../TestUtilities.js";
import { userJourneyIntegrationTest } from "./UserJourney.integration.test.js";
import { vrfIntegrationTest } from "./VRFIntegration.test.js";
import { stakingRewardsIntegrationTest } from "./StakingRewards.integration.test.js";
import { botPersonalityIntegrationTest } from "./BotPersonality.integration.test.js";
import { multiGameSeriesIntegrationTest } from "./MultiGameSeries.integration.test.js";

/**
 * Comprehensive Integration Test Runner
 * 
 * Executes all integration test suites for the Barely Human DeFi Casino
 * and provides detailed reporting on system readiness for production deployment.
 * 
 * Test Suites:
 * 1. User Journey - Complete user experience validation
 * 2. VRF Integration - Chainlink VRF and randomness testing
 * 3. Staking & Rewards - BOT tokenomics and Treasury operations
 * 4. Bot Personalities - AI behavior and strategy validation
 * 5. Multi-Game Series - Extended gameplay and performance testing
 */

interface IntegrationTestSuite {
  name: string;
  description: string;
  testFunction: () => Promise<TestResults>;
  critical: boolean; // Whether failure blocks production deployment
}

interface OverallResults {
  totalTestsPassed: number;
  totalTestsRun: number;
  successRate: number;
  criticalTestsPassed: number;
  criticalTestsRun: number;
  criticalSuccessRate: number;
  allErrors: string[];
  suitesResults: Array<{
    name: string;
    passed: number;
    total: number;
    rate: number;
    critical: boolean;
    errors: string[];
  }>;
  productionReady: boolean;
  gasEfficiency: {
    totalGasUsed: bigint;
    averagePerOperation: bigint;
    withinTargets: boolean;
  };
}

async function main() {
  console.log("🎆 BARELY HUMAN CASINO - COMPREHENSIVE INTEGRATION TEST SUITE");
  console.log("=" * 80);
  console.log("🎯 Target: Production Deployment Readiness Validation");
  console.log("🔍 Coverage: Complete user journey, VRF, staking, bots, multi-game");
  console.log("⏱️  Estimated Runtime: 10-15 minutes\n");
  
  const startTime = Date.now();
  
  // Define test suites
  const testSuites: IntegrationTestSuite[] = [
    {
      name: "User Journey",
      description: "End-to-end user experience from token distribution to rewards",
      testFunction: userJourneyIntegrationTest,
      critical: true
    },
    {
      name: "VRF Integration", 
      description: "Chainlink VRF randomness and dice roll validation",
      testFunction: vrfIntegrationTest,
      critical: true
    },
    {
      name: "Staking & Rewards",
      description: "BOT tokenomics, Treasury operations, and reward distribution",
      testFunction: stakingRewardsIntegrationTest,
      critical: true
    },
    {
      name: "Bot Personalities",
      description: "AI bot behavior validation and strategy differentiation",
      testFunction: botPersonalityIntegrationTest,
      critical: false // Nice to have but not blocking
    },
    {
      name: "Multi-Game Series",
      description: "Extended gameplay performance and statistical validation",
      testFunction: multiGameSeriesIntegrationTest,
      critical: true
    }
  ];
  
  const results: OverallResults = {
    totalTestsPassed: 0,
    totalTestsRun: 0,
    successRate: 0,
    criticalTestsPassed: 0,
    criticalTestsRun: 0,
    criticalSuccessRate: 0,
    allErrors: [],
    suitesResults: [],
    productionReady: false,
    gasEfficiency: {
      totalGasUsed: 0n,
      averagePerOperation: 0n,
      withinTargets: false
    }
  };
  
  // Execute each test suite
  for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    
    console.log(`\n${"🔄".repeat(20)}`);
    console.log(`🏁 SUITE ${i + 1}/${testSuites.length}: ${suite.name.toUpperCase()}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`⚡ Critical: ${suite.critical ? "YES" : "NO"}`);
    console.log(`${"🔄".repeat(20)}\n`);
    
    try {
      const suiteResults = await suite.testFunction();
      
      // Update overall results
      results.totalTestsPassed += suiteResults.testsPassed;
      results.totalTestsRun += suiteResults.totalTests;
      results.allErrors.push(...suiteResults.errors);
      
      if (suite.critical) {
        results.criticalTestsPassed += suiteResults.testsPassed;
        results.criticalTestsRun += suiteResults.totalTests;
      }
      
      // Track gas usage
      const suiteGasUsed = Object.values(suiteResults.gasUsage).reduce((sum, gas) => sum + gas, 0n);
      results.gasEfficiency.totalGasUsed += suiteGasUsed;
      
      // Store suite-specific results
      results.suitesResults.push({
        name: suite.name,
        passed: suiteResults.testsPassed,
        total: suiteResults.totalTests,
        rate: (suiteResults.testsPassed / suiteResults.totalTests) * 100,
        critical: suite.critical,
        errors: suiteResults.errors
      });
      
      const suiteSuccessRate = (suiteResults.testsPassed / suiteResults.totalTests) * 100;
      
      console.log(`\n🏆 SUITE ${i + 1} COMPLETE: ${suite.name}`);
      console.log(`✅ Passed: ${suiteResults.testsPassed}/${suiteResults.totalTests} (${suiteSuccessRate.toFixed(1)}%)`);
      
      if (suiteResults.errors.length > 0) {
        console.log(`❌ Errors: ${suiteResults.errors.length}`);
        suiteResults.errors.forEach((error, idx) => {
          console.log(`    ${idx + 1}. ${error}`);
        });
      }
      
      console.log(`⛽ Gas Used: ${suiteGasUsed.toString()}`);
      
    } catch (error) {
      console.error(`💥 SUITE ${i + 1} FAILED: ${suite.name}`);
      console.error(`Error: ${error}`);
      
      results.allErrors.push(`${suite.name}: Critical failure - ${error}`);
      
      // Count as failed tests
      results.totalTestsRun += 1; // Assume 1 test that failed to run
      if (suite.critical) {
        results.criticalTestsRun += 1;
      }
      
      results.suitesResults.push({
        name: suite.name,
        passed: 0,
        total: 1,
        rate: 0,
        critical: suite.critical,
        errors: [`Suite execution failed: ${error}`]
      });
    }
  }
  
  // Calculate final statistics
  results.successRate = results.totalTestsRun > 0 ? (results.totalTestsPassed / results.totalTestsRun) * 100 : 0;
  results.criticalSuccessRate = results.criticalTestsRun > 0 ? (results.criticalTestsPassed / results.criticalTestsRun) * 100 : 0;
  results.gasEfficiency.averagePerOperation = results.totalTestsRun > 0 ? results.gasEfficiency.totalGasUsed / BigInt(results.totalTestsRun) : 0n;
  results.gasEfficiency.withinTargets = results.gasEfficiency.totalGasUsed < 10000000n; // Under 10M gas total
  
  // Determine production readiness
  results.productionReady = (
    results.criticalSuccessRate >= 95.0 && // 95%+ critical test success
    results.successRate >= 90.0 && // 90%+ overall success
    results.gasEfficiency.withinTargets && // Gas efficiency targets met
    results.allErrors.filter(e => e.includes('Security:')).length === 0 // No security issues
  );
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // ===========================
  // COMPREHENSIVE FINAL REPORT
  // ===========================
  console.log(`\n\n${"🎆".repeat(30)}`);
  console.log(`🏆 BARELY HUMAN CASINO - INTEGRATION TEST REPORT`);
  console.log(`${"🎆".repeat(30)}\n`);
  
  console.log(`⏱️  Test Duration: ${duration.toFixed(1)} seconds\n`);
  
  // Overall Statistics
  console.log(`📊 OVERALL STATISTICS:`);
  console.log(`  Total Tests: ${results.totalTestsPassed}/${results.totalTestsRun} (${results.successRate.toFixed(1)}%)`);
  console.log(`  Critical Tests: ${results.criticalTestsPassed}/${results.criticalTestsRun} (${results.criticalSuccessRate.toFixed(1)}%)`);
  console.log(`  Test Suites: ${testSuites.length}`);
  console.log(`  Total Errors: ${results.allErrors.length}\n`);
  
  // Suite-by-Suite Results
  console.log(`📈 SUITE-BY-SUITE RESULTS:`);
  results.suitesResults.forEach((suite, index) => {
    const status = suite.rate >= 90 ? "✅" : suite.rate >= 75 ? "🟡" : "❌";
    const criticality = suite.critical ? "[CRITICAL]" : "[OPTIONAL]";
    console.log(`  ${status} ${suite.name} ${criticality}: ${suite.passed}/${suite.total} (${suite.rate.toFixed(1)}%)`);
    
    if (suite.errors.length > 0) {
      console.log(`      Errors: ${suite.errors.length}`);
    }
  });
  
  // Gas Efficiency Report
  console.log(`\n⛽ GAS EFFICIENCY ANALYSIS:`);
  console.log(`  Total Gas Used: ${results.gasEfficiency.totalGasUsed.toString()}`);
  console.log(`  Average Per Test: ${results.gasEfficiency.averagePerOperation.toString()}`);
  console.log(`  Within Targets: ${results.gasEfficiency.withinTargets ? "YES" : "NO"}`);
  
  // Error Summary
  if (results.allErrors.length > 0) {
    console.log(`\n❌ ERROR SUMMARY:`);
    const criticalErrors = results.allErrors.filter(e => e.includes('Security:') || e.includes('Critical'));
    const warningErrors = results.allErrors.filter(e => !criticalErrors.includes(e));
    
    if (criticalErrors.length > 0) {
      console.log(`  🚨 CRITICAL (${criticalErrors.length}):`);
      criticalErrors.forEach((error, idx) => {
        console.log(`    ${idx + 1}. ${error}`);
      });
    }
    
    if (warningErrors.length > 0) {
      console.log(`  ⚠️  WARNINGS (${warningErrors.length}):`);
      warningErrors.slice(0, 10).forEach((error, idx) => {
        console.log(`    ${idx + 1}. ${error}`);
      });
      
      if (warningErrors.length > 10) {
        console.log(`    ... and ${warningErrors.length - 10} more`);
      }
    }
  }
  
  // Production Readiness Assessment
  console.log(`\n🎯 PRODUCTION READINESS ASSESSMENT:`);
  console.log(`  Status: ${results.productionReady ? "✅ READY" : "❌ NOT READY"}`);
  
  if (results.productionReady) {
    console.log(`  🎉 All critical systems validated`);
    console.log(`  🚀 Clear for testnet deployment`);
    console.log(`  💪 System demonstrates production-grade reliability`);
  } else {
    console.log(`  🚨 Issues require resolution before deployment:`);
    
    if (results.criticalSuccessRate < 95.0) {
      console.log(`    - Critical test success rate too low: ${results.criticalSuccessRate.toFixed(1)}% (need 95%+)`);
    }
    
    if (results.successRate < 90.0) {
      console.log(`    - Overall test success rate too low: ${results.successRate.toFixed(1)}% (need 90%+)`);
    }
    
    if (!results.gasEfficiency.withinTargets) {
      console.log(`    - Gas usage exceeds targets: ${results.gasEfficiency.totalGasUsed.toString()}`);
    }
    
    const securityIssues = results.allErrors.filter(e => e.includes('Security:'));
    if (securityIssues.length > 0) {
      console.log(`    - Security issues detected: ${securityIssues.length}`);
    }
  }
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS:`);
  
  if (results.productionReady) {
    console.log(`  1. ✅ Deploy to Base Sepolia testnet`);
    console.log(`  2. ✅ Run 24-48 hour stress test`);
    console.log(`  3. ✅ Conduct final security audit`);
    console.log(`  4. ✅ Prepare mainnet deployment scripts`);
  } else {
    console.log(`  1. 🔴 Fix critical test failures first`);
    console.log(`  2. 🟡 Address gas optimization opportunities`);
    console.log(`  3. ⚠️  Review error logs for patterns`);
    console.log(`  4. 🔄 Re-run tests after fixes`);
  }
  
  // Next Steps
  console.log(`\n🚀 NEXT STEPS:`);
  console.log(`  1. Review detailed error logs above`);
  console.log(`  2. Address any critical failures`);
  console.log(`  3. Run individual test suites for debugging if needed`);
  console.log(`  4. Re-run this comprehensive suite before deployment\n`);
  
  console.log(`${"🎆".repeat(30)}`);
  console.log(`🎰 BARELY HUMAN CASINO INTEGRATION TESTING COMPLETE`);
  console.log(`${"🎆".repeat(30)}\n`);
  
  // Return overall success for CI/CD
  if (!results.productionReady) {
    console.log("🚨 INTEGRATION TESTS FAILED - NOT READY FOR PRODUCTION");
    process.exit(1);
  } else {
    console.log("✅ INTEGRATION TESTS PASSED - READY FOR PRODUCTION");
    process.exit(0);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Integration test runner failed:", error);
    process.exit(1);
  });
}

export { main as runAllIntegrationTests };
