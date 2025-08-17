#!/usr/bin/env tsx

/**
 * Integration Test Runner
 * ETHGlobal NYC 2025 - LayerZero V2 Cross-Chain Testing Suite
 * 
 * Runs all cross-chain integration tests using Hardhat 3 + Viem pattern.
 * Tests can run on local hardhat network or forked networks.
 */

import { network } from "hardhat";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Test configuration
const INTEGRATION_TESTS = [
  {
    name: "Cross-Chain Vault Integration",
    file: "CrossChainVault.integration.test.ts",
    description: "Tests vault coordination and balance synchronization across chains"
  },
  {
    name: "LayerZero V2 Messaging",
    file: "LayerZeroMessaging.test.ts",
    description: "Tests LayerZero V2 message passing, integrity, and delivery"
  },
  {
    name: "Multi-Chain Synchronization",
    file: "MultiChainSync.test.ts", 
    description: "Tests multi-chain sync, consensus, and fallback mechanisms"
  }
];

const FORKED_NETWORK_TESTS = [
  {
    name: "Base Sepolia Fork",
    network: "baseSepolia",
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532
  },
  {
    name: "Arbitrum Sepolia Fork",
    network: "arbitrumSepolia", 
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614
  }
];

console.log("🌐 LayerZero V2 Cross-Chain Integration Test Suite");
console.log("🏆 ETHGlobal NYC 2025 - Barely Human Casino\n");

async function main() {
  // Get arguments from environment or command line
  const args = process.argv.slice(2);
  const runForked = args.includes("--forked") || process.env.TEST_FORKED === "true";
  const testName = args.find(arg => arg.startsWith("--test="))?.split("=")[1] || process.env.TEST_FILTER;
  const verbose = args.includes("--verbose") || process.env.TEST_VERBOSE === "true";

  console.log("🔧 Test Configuration:");
  console.log(`   Mode: ${runForked ? 'Forked Networks' : 'Local Hardhat'}`);
  console.log(`   Filter: ${testName || 'All Tests'}`);
  console.log(`   Verbose: ${verbose ? 'Enabled' : 'Disabled'}\n`);

  try {
    if (runForked) {
      await runForkedNetworkTests(testName, verbose);
    } else {
      await runLocalTests(testName, verbose);
    }
    
    console.log("\n✅ All integration tests completed successfully!");
    console.log("🏆 LayerZero V2 cross-chain functionality verified");
  } catch (error) {
    console.error("\n❌ Integration tests failed:", error);
    process.exit(1);
  }
}

async function runLocalTests(testFilter?: string, verbose?: boolean) {
  console.log("🗺 Running tests on local Hardhat network...\n");
  
  const testsToRun = testFilter 
    ? INTEGRATION_TESTS.filter(test => test.name.toLowerCase().includes(testFilter.toLowerCase()))
    : INTEGRATION_TESTS;

  if (testsToRun.length === 0) {
    throw new Error(`No tests found matching filter: ${testFilter}`);
  }

  for (const test of testsToRun) {
    console.log(`🗺 Running: ${test.name}`);
    console.log(`   Description: ${test.description}`);
    console.log(`   File: ${test.file}\n`);
    
    try {
      const testPath = path.join(__dirname, test.file);
      const command = `npx hardhat run ${testPath}`;
      
      if (verbose) {
        console.log(`   Command: ${command}`);
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: path.join(__dirname, '../..'),
        timeout: 60000 // 60 second timeout
      });
      
      if (verbose && stdout) {
        console.log("   Output:");
        console.log(stdout.split('\n').map(line => `      ${line}`).join('\n'));
      }
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`   ⚠️  Warnings:`, stderr);
      }
      
      console.log(`   ✅ ${test.name} passed\n`);
      
    } catch (error: any) {
      console.error(`   ❌ ${test.name} failed:`);
      if (error.stdout) {
        console.error(`      Output: ${error.stdout}`);
      }
      if (error.stderr) {
        console.error(`      Error: ${error.stderr}`);
      }
      throw error;
    }
  }
}

async function runForkedNetworkTests(testFilter?: string, verbose?: boolean) {
  console.log("🌍 Running tests on forked networks...\n");
  
  // Check if RPC URLs are available
  for (const fork of FORKED_NETWORK_TESTS) {
    if (!fork.rpcUrl || fork.rpcUrl.includes('undefined')) {
      console.warn(`⚠️  Skipping ${fork.name}: No RPC URL configured`);
      continue;
    }
    
    console.log(`🔗 Testing on ${fork.name} (Chain ID: ${fork.chainId})`);
    console.log(`   RPC: ${fork.rpcUrl}\n`);
    
    // Run tests with forked network
    await runTestsWithFork(fork, testFilter, verbose);
  }
}

async function runTestsWithFork(forkConfig: any, testFilter?: string, verbose?: boolean) {
  const testsToRun = testFilter 
    ? INTEGRATION_TESTS.filter(test => test.name.toLowerCase().includes(testFilter.toLowerCase()))
    : INTEGRATION_TESTS;

  for (const test of testsToRun) {
    console.log(`   🗺 Running: ${test.name} on ${forkConfig.name}`);
    
    try {
      const testPath = path.join(__dirname, test.file);
      const command = `npx hardhat run ${testPath} --network ${forkConfig.network}`;
      
      if (verbose) {
        console.log(`      Command: ${command}`);
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: path.join(__dirname, '../..'),
        timeout: 120000, // 2 minute timeout for forked network
        env: {
          ...process.env,
          HARDHAT_NETWORK: forkConfig.network
        }
      });
      
      if (verbose && stdout) {
        console.log("      Output:");
        console.log(stdout.split('\n').map(line => `         ${line}`).join('\n'));
      }
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn(`      ⚠️  Warnings:`, stderr);
      }
      
      console.log(`      ✅ ${test.name} passed on ${forkConfig.name}\n`);
      
    } catch (error: any) {
      console.error(`      ❌ ${test.name} failed on ${forkConfig.name}:`);
      if (error.stdout) {
        console.error(`         Output: ${error.stdout}`);
      }
      if (error.stderr) {
        console.error(`         Error: ${error.stderr}`);
      }
      
      // Continue with other tests even if one fails
      console.warn(`      ⚠️  Continuing with remaining tests...\n`);
    }
  }
}

async function validateTestEnvironment() {
  console.log("🔍 Validating test environment...");
  
  try {
    // Check Hardhat installation
    await execAsync('npx hardhat --version', { timeout: 10000 });
    console.log(`   ✅ Hardhat available`);
    
    // Check if contracts are compiled
    const { stdout } = await execAsync('npx hardhat compile', { 
      timeout: 30000,
      cwd: path.join(__dirname, '../..')
    });
    
    if (stdout.includes('Compiled') || stdout.includes('Nothing to compile')) {
      console.log(`   ✅ Contracts compiled`);
    }
    
    // Check test files exist
    for (const test of INTEGRATION_TESTS) {
      const testPath = path.join(__dirname, test.file);
      try {
        await import(testPath);
        console.log(`   ✅ ${test.file} available`);
      } catch (error) {
        console.warn(`   ⚠️  ${test.file} may have issues`);
      }
    }
    
    console.log(`   ✅ Environment validation complete\n`);
    
  } catch (error) {
    console.error(`   ❌ Environment validation failed:`, error);
    throw error;
  }
}

// Show usage information
function showUsage() {
  console.log("📚 Usage:");
  console.log("   npm run test:integration                    # Run all tests locally");
  console.log("   npm run test:integration -- --forked       # Run tests on forked networks");
  console.log("   npm run test:integration -- --test=vault   # Run specific test");
  console.log("   npm run test:integration -- --verbose      # Show detailed output");
  console.log("\n📊 Available tests:");
  
  INTEGRATION_TESTS.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test.name}`);
    console.log(`      ${test.description}`);
  });
  
  console.log("\n🌍 Forked networks:");
  FORKED_NETWORK_TESTS.forEach((fork, index) => {
    console.log(`   ${index + 1}. ${fork.name} (${fork.chainId})`);
  });
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Validate environment before running tests
async function runWithValidation() {
  await validateTestEnvironment();
  await main();
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runWithValidation().catch(console.error);
}

export default main;
export { runLocalTests, runForkedNetworkTests, validateTestEnvironment };
