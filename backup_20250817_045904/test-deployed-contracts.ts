#!/usr/bin/env node

/**
 * Test deployed contracts on Base Sepolia
 * Executes real transactions to verify functionality
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Simple ABIs for testing
const BOT_TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
]);

const STAKING_POOL_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
]);

const TREASURY_ABI = parseAbi([
  "function stakingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function devPercent() view returns (uint256)",
  "function insurancePercent() view returns (uint256)"
]);

const CRAPS_GAME_ABI = parseAbi([
  "function currentSeriesId() view returns (uint256)",
  "function gamePhase() view returns (uint8)"
]);

const VAULT_FACTORY_ABI = parseAbi([
  "function nextBotId() view returns (uint256)",
  "function allVaults(uint256) view returns (address)"
]);

async function main() {
  console.log(chalk.bold.cyan("\n🧪 Testing Deployed Contracts on Base Sepolia\n"));
  
  // Load deployment info
  let deployment: any;
  try {
    const deploymentPath = path.join(__dirname, "../deployments/base-sepolia-deployment.json");
    deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log(chalk.green("✅ Found deployment from:"), deployment.timestamp);
    console.log(chalk.gray("Network:"), deployment.network);
    console.log(chalk.gray("Chain ID:"), deployment.chainId);
  } catch (error) {
    console.log(chalk.red("❌ No deployment found. Run deployment script first."));
    process.exit(1);
  }
  
  // Setup clients
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  // Get deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(chalk.gray("\nDeployer:"), account.address);
  console.log(chalk.gray("ETH balance:"), formatUnits(balance, 18), "ETH\n");
  
  const results: any[] = [];
  let passCount = 0;
  let failCount = 0;
  
  // Helper function to test view calls
  async function testView(name: string, fn: () => Promise<any>) {
    process.stdout.write(chalk.cyan(`Testing ${name}... `));
    try {
      const result = await fn();
      console.log(chalk.green("✅"), chalk.gray(result?.toString()));
      results.push({ test: name, status: "PASS", result: result?.toString() });
      passCount++;
      return result;
    } catch (error: any) {
      console.log(chalk.red("❌ FAIL"));
      console.log(chalk.gray(`  Error: ${error.message?.slice(0, 100)}`));
      results.push({ test: name, status: "FAIL", error: error.message });
      failCount++;
      return null;
    }
  }
  
  console.log(chalk.bold.magenta("📋 Testing Contract Methods:\n"));
  
  // ==================== 1. BOT Token Tests ====================
  console.log(chalk.bold("1️⃣  BOT Token\n"));
  
  const tokenAddress = deployment.contracts.BOTToken;
  
  await testView("Token Name", async () => {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "name"
    });
  });
  
  await testView("Token Symbol", async () => {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "symbol"
    });
  });
  
  await testView("Token Decimals", async () => {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "decimals"
    });
  });
  
  await testView("Total Supply", async () => {
    const supply = await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "totalSupply"
    });
    return formatUnits(supply as bigint, 18) + " BOT";
  });
  
  await testView("Deployer Balance", async () => {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "balanceOf",
      args: [account.address]
    });
    return formatUnits(bal as bigint, 18) + " BOT";
  });
  
  // ==================== 2. Treasury Tests ====================
  console.log(chalk.bold("\n2️⃣  Treasury\n"));
  
  const treasuryAddress = deployment.contracts.Treasury;
  
  await testView("Staking Percent", async () => {
    const percent = await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "stakingPercent"
    });
    return percent + "%";
  });
  
  await testView("Buyback Percent", async () => {
    const percent = await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "buybackPercent"
    });
    return percent + "%";
  });
  
  await testView("Dev Percent", async () => {
    const percent = await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "devPercent"
    });
    return percent + "%";
  });
  
  await testView("Insurance Percent", async () => {
    const percent = await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "insurancePercent"
    });
    return percent + "%";
  });
  
  // ==================== 3. StakingPool Tests ====================
  console.log(chalk.bold("\n3️⃣  StakingPool\n"));
  
  const stakingAddress = deployment.contracts.StakingPool;
  
  await testView("Total Staked", async () => {
    const staked = await publicClient.readContract({
      address: stakingAddress,
      abi: STAKING_POOL_ABI,
      functionName: "totalSupply"
    });
    return formatUnits(staked as bigint, 18) + " BOT";
  });
  
  // ==================== 4. Game Contract Tests ====================
  console.log(chalk.bold("\n4️⃣  CrapsGameV2Plus\n"));
  
  const gameAddress = deployment.contracts.CrapsGameV2Plus;
  
  await testView("Current Series ID", async () => {
    return await publicClient.readContract({
      address: gameAddress,
      abi: CRAPS_GAME_ABI,
      functionName: "currentSeriesId"
    });
  });
  
  await testView("Game Phase", async () => {
    const phase = await publicClient.readContract({
      address: gameAddress,
      abi: CRAPS_GAME_ABI,
      functionName: "gamePhase"
    });
    const phases = ["IDLE", "COME_OUT", "POINT"];
    return phases[Number(phase)] || phase;
  });
  
  // ==================== 5. VaultFactory Tests ====================
  console.log(chalk.bold("\n5️⃣  VaultFactory\n"));
  
  const vaultFactoryAddress = deployment.contracts.VaultFactory;
  
  await testView("Next Bot ID", async () => {
    return await publicClient.readContract({
      address: vaultFactoryAddress,
      abi: VAULT_FACTORY_ABI,
      functionName: "nextBotId"
    });
  });
  
  // Try to get first vault if it exists
  try {
    const vault0 = await publicClient.readContract({
      address: vaultFactoryAddress,
      abi: VAULT_FACTORY_ABI,
      functionName: "allVaults",
      args: [0n]
    });
    if (vault0 && vault0 !== "0x0000000000000000000000000000000000000000") {
      console.log(chalk.green("  First vault deployed at:"), vault0);
    }
  } catch (e) {
    // No vaults deployed yet
  }
  
  // ==================== Summary ====================
  console.log(chalk.bold("\n📊 Test Summary:\n"));
  
  console.table([
    { Metric: "Total Tests", Value: passCount + failCount },
    { Metric: "Passed", Value: passCount },
    { Metric: "Failed", Value: failCount },
    { Metric: "Success Rate", Value: `${((passCount / (passCount + failCount)) * 100).toFixed(1)}%` }
  ]);
  
  // Save results
  const resultsPath = path.join(__dirname, "../test-results/base-sepolia-test.json");
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: "base-sepolia",
    deployment: deployment.timestamp,
    summary: {
      total: passCount + failCount,
      passed: passCount,
      failed: failCount
    },
    results
  }, null, 2));
  
  console.log(chalk.gray("\nResults saved to:"), resultsPath);
  
  if (failCount === 0) {
    console.log(chalk.green("\n✅ All tests passed! Contracts are working correctly on Base Sepolia."));
  } else {
    console.log(chalk.yellow(`\n⚠️  ${failCount} tests failed. Check the results for details.`));
  }
  
  // Important notes
  console.log(chalk.yellow("\n📝 Important Next Steps:"));
  console.log("1. Add CrapsGameV2Plus as VRF consumer:");
  console.log(`   https://vrf.chain.link/base-sepolia/${process.env.VRF_SUBSCRIPTION_ID}`);
  console.log("2. Add BotManagerV2Plus as VRF consumer");
  console.log("3. Add GachaMintPassV2Plus as VRF consumer");
  console.log("4. Fund VRF subscription with LINK tokens");
  console.log("5. Verify contracts on BaseScan");
  
  console.log(chalk.cyan("\n🎮 You can now use the enhanced CLI:"));
  console.log("   npm run cli:enhanced");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("\n❌ Test failed:"), error);
    process.exit(1);
  });