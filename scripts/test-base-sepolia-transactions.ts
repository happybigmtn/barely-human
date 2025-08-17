#!/usr/bin/env node

/**
 * Non-interactive test script for Base Sepolia
 * Tests all deployed contract methods with real transactions
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatEther, formatUnits, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Contract ABIs (simplified for testing)
const BOT_TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function approve(address, uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function mint(address, uint256)",
  "function burn(uint256)"
]);

const STAKING_POOL_ABI = parseAbi([
  "function stake(uint256) returns (bool)",
  "function unstake(uint256) returns (bool)",
  "function earned(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getReward() returns (bool)",
  "function totalSupply() view returns (uint256)"
]);

const TREASURY_ABI = parseAbi([
  "function distributeFees() returns (bool)",
  "function updateDistribution(uint256, uint256, uint256)",
  "function stakingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function devPercent() view returns (uint256)"
]);

const VAULT_FACTORY_ABI = parseAbi([
  "function deployAllBots() returns (bool)",
  "function getVault(uint256) view returns (address)",
  "function getVaultCount() view returns (uint256)",
  "function setGameContract(address)",
  "function setBotManager(address)"
]);

const CRAPS_GAME_ABI = parseAbi([
  "function startNewSeries() returns (uint256)",
  "function placeBet(uint8, uint256, uint8) returns (bool)",
  "function requestDiceRoll() returns (uint256)",
  "function currentSeriesId() view returns (uint256)",
  "function gamePhase() view returns (uint8)",
  "function setBetsContract(address)",
  "function setSettlementContract(address)"
]);

const BOT_MANAGER_ABI = parseAbi([
  "function initializeBots() returns (bool)",
  "function getBotInfo(uint256) view returns (tuple(string name, uint8 aggressiveness, uint8 riskTolerance))",
  "function placeBotBet(uint256, uint8, uint256) returns (bool)"
]);

async function main() {
  console.log(chalk.bold.cyan("\n🧪 Testing Barely Human Casino on Base Sepolia\n"));
  
  // Check if deployment exists
  let deployment: any;
  try {
    const deploymentPath = path.join(__dirname, "../deployments/base-sepolia-deployment.json");
    deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log(chalk.green("✅ Found deployment from:"), deployment.timestamp);
  } catch (error) {
    console.log(chalk.red("❌ No deployment found. Run deployment script first."));
    process.exit(1);
  }
  
  // Setup account and clients
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
  
  // Get initial balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(chalk.gray("Test account:"), account.address);
  console.log(chalk.gray("ETH balance:"), formatEther(balance), "ETH\n");
  
  const results: any[] = [];
  let passCount = 0;
  let failCount = 0;
  
  // Helper function to test a transaction
  async function testTransaction(name: string, fn: () => Promise<any>) {
    process.stdout.write(chalk.yellow(`Testing ${name}... `));
    try {
      const result = await fn();
      console.log(chalk.green("✅ PASS"));
      results.push({ test: name, status: "PASS", result });
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
  
  // Helper function to test a view function
  async function testView(name: string, fn: () => Promise<any>) {
    process.stdout.write(chalk.cyan(`Reading ${name}... `));
    try {
      const result = await fn();
      console.log(chalk.green("✅"), chalk.gray(result?.toString()));
      results.push({ test: name, status: "SUCCESS", result: result?.toString() });
      return result;
    } catch (error: any) {
      console.log(chalk.red("❌ FAIL"));
      results.push({ test: name, status: "FAIL", error: error.message });
      return null;
    }
  }
  
  console.log(chalk.bold("\n📋 Testing Contract Methods:\n"));
  
  // ==================== 1. BOT Token Tests ====================
  console.log(chalk.bold.magenta("\n1️⃣  BOT Token Tests\n"));
  
  const tokenAddress = deployment.contracts.BOTToken;
  
  // Test balance query
  const botBalance = await testView("BOT Token Balance", async () => {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "balanceOf",
      args: [account.address]
    });
  });
  
  // Test total supply
  await testView("BOT Total Supply", async () => {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "totalSupply"
    });
  });
  
  // Test transfer (small amount)
  await testTransaction("BOT Transfer", async () => {
    const { request } = await publicClient.simulateContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "transfer",
      args: [deployment.contracts.Treasury, parseUnits("10", 18)],
      account
    });
    return await walletClient.writeContract(request);
  });
  
  // Test approve
  await testTransaction("BOT Approve", async () => {
    const { request } = await publicClient.simulateContract({
      address: tokenAddress,
      abi: BOT_TOKEN_ABI,
      functionName: "approve",
      args: [deployment.contracts.StakingPool, parseUnits("100", 18)],
      account
    });
    return await walletClient.writeContract(request);
  });
  
  // ==================== 2. Staking Pool Tests ====================
  console.log(chalk.bold.blue("\n2️⃣  Staking Pool Tests\n"));
  
  const stakingAddress = deployment.contracts.StakingPool;
  
  // Test total staked
  await testView("Total Staked", async () => {
    return await publicClient.readContract({
      address: stakingAddress,
      abi: STAKING_POOL_ABI,
      functionName: "totalSupply"
    });
  });
  
  // Test stake
  await testTransaction("Stake BOT", async () => {
    const { request } = await publicClient.simulateContract({
      address: stakingAddress,
      abi: STAKING_POOL_ABI,
      functionName: "stake",
      args: [parseUnits("10", 18)],
      account
    });
    return await walletClient.writeContract(request);
  });
  
  // Test earned rewards
  await testView("Earned Rewards", async () => {
    return await publicClient.readContract({
      address: stakingAddress,
      abi: STAKING_POOL_ABI,
      functionName: "earned",
      args: [account.address]
    });
  });
  
  // ==================== 3. Treasury Tests ====================
  console.log(chalk.bold.yellow("\n3️⃣  Treasury Tests\n"));
  
  const treasuryAddress = deployment.contracts.Treasury;
  
  // Test distribution percentages
  await testView("Staking Percent", async () => {
    return await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "stakingPercent"
    });
  });
  
  await testView("Buyback Percent", async () => {
    return await publicClient.readContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "buybackPercent"
    });
  });
  
  // ==================== 4. Game Contract Tests ====================
  console.log(chalk.bold.green("\n4️⃣  Game Contract Tests\n"));
  
  const gameAddress = deployment.contracts.CrapsGameV2Plus;
  
  // Test current series
  await testView("Current Series ID", async () => {
    return await publicClient.readContract({
      address: gameAddress,
      abi: CRAPS_GAME_ABI,
      functionName: "currentSeriesId"
    });
  });
  
  // Test game phase
  await testView("Game Phase", async () => {
    return await publicClient.readContract({
      address: gameAddress,
      abi: CRAPS_GAME_ABI,
      functionName: "gamePhase"
    });
  });
  
  // Test start new series
  await testTransaction("Start New Series", async () => {
    const { request } = await publicClient.simulateContract({
      address: gameAddress,
      abi: CRAPS_GAME_ABI,
      functionName: "startNewSeries",
      account
    });
    return await walletClient.writeContract(request);
  });
  
  // ==================== 5. Bot Manager Tests ====================
  console.log(chalk.bold.red("\n5️⃣  Bot Manager Tests\n"));
  
  const botManagerAddress = deployment.contracts.BotManager;
  
  // Test get bot info
  await testView("Bot 0 Info", async () => {
    return await publicClient.readContract({
      address: botManagerAddress,
      abi: BOT_MANAGER_ABI,
      functionName: "getBotInfo",
      args: [0n]
    });
  });
  
  // ==================== 6. Vault Factory Tests ====================
  console.log(chalk.bold.cyan("\n6️⃣  Vault Factory Tests\n"));
  
  const vaultFactoryAddress = deployment.contracts.VaultFactory;
  
  // Test vault count
  const vaultCount = await testView("Vault Count", async () => {
    return await publicClient.readContract({
      address: vaultFactoryAddress,
      abi: VAULT_FACTORY_ABI,
      functionName: "getVaultCount"
    });
  });
  
  // Test get vault
  if (vaultCount && vaultCount > 0n) {
    await testView("Vault 0 Address", async () => {
      return await publicClient.readContract({
        address: vaultFactoryAddress,
        abi: VAULT_FACTORY_ABI,
        functionName: "getVault",
        args: [0n]
      });
    });
  }
  
  // ==================== Summary ====================
  console.log(chalk.bold("\n📊 Test Summary:\n"));
  
  const table: any[] = [];
  table.push(["Metric", "Value"]);
  table.push(["Total Tests", passCount + failCount]);
  table.push([chalk.green("Passed"), passCount]);
  table.push([chalk.red("Failed"), failCount]);
  table.push(["Success Rate", `${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`]);
  
  console.table(table);
  
  // Save results
  const resultsPath = path.join(__dirname, "../test-results/base-sepolia-test-results.json");
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: "base-sepolia",
    account: account.address,
    deployment: deployment.timestamp,
    summary: {
      total: passCount + failCount,
      passed: passCount,
      failed: failCount,
      successRate: ((passCount / (passCount + failCount)) * 100).toFixed(1) + "%"
    },
    results
  }, null, 2));
  
  console.log(chalk.gray("\nTest results saved to:"), resultsPath);
  
  if (failCount > 0) {
    console.log(chalk.yellow("\n⚠️  Some tests failed. Check the results for details."));
  } else {
    console.log(chalk.green("\n✅ All tests passed!"));
  }
  
  // Check if VRF consumers need to be added
  console.log(chalk.yellow("\n📝 Important Next Steps:"));
  console.log("1. Add CrapsGameV2Plus as VRF consumer at:");
  console.log("   https://vrf.chain.link/base-sepolia/" + process.env.VRF_SUBSCRIPTION_ID);
  console.log("2. Add BotManager as VRF consumer");
  console.log("3. Add GachaMintPassV2Plus as VRF consumer");
  console.log("4. Fund VRF subscription with LINK tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("\n❌ Test script failed:"), error);
    process.exit(1);
  });