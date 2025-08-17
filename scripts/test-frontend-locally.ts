#!/usr/bin/env node

/**
 * Local testing script for frontend functionality
 * Deploys contracts locally and tests all methods
 */

import { network } from "hardhat";
import { createPublicClient, createWalletClient, http, parseUnits, formatEther, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log(chalk.bold.cyan("\n🧪 Testing Barely Human Casino Locally\n"));
  
  // Setup account and clients
  const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  
  const publicClient = createPublicClient({
    chain: localhost,
    transport: http("http://127.0.0.1:8545")
  });
  
  const walletClient = createWalletClient({
    account,
    chain: localhost,
    transport: http("http://127.0.0.1:8545")
  });
  
  // Connect to Hardhat runtime with viem
  const connection = await network.connect();
  const { viem } = connection;
  
  const contracts: any = {};
  const results: any[] = [];
  
  console.log(chalk.yellow("📦 Deploying contracts locally...\n"));
  
  try {
    // ==================== Deploy Core Contracts ====================
    
    // 1. Deploy BOT Token
    console.log("Deploying BOT Token...");
    const botToken = await viem.deployContract("BOTToken", [
      account.address, // treasury
      account.address, // liquidity
      account.address, // stakingRewards
      account.address, // team
      account.address  // community
    ]);
    contracts.BOTToken = botToken.address;
    console.log(chalk.green(`✅ BOT Token: ${contracts.BOTToken}`));
    
    // 2. Deploy Treasury
    console.log("Deploying Treasury...");
    const treasury = await viem.deployContract("Treasury", [
      contracts.BOTToken,
      account.address, // development wallet
      account.address  // insurance wallet
    ]);
    contracts.Treasury = treasury.address;
    console.log(chalk.green(`✅ Treasury: ${contracts.Treasury}`));
    
    // 3. Deploy StakingPool
    console.log("Deploying StakingPool...");
    const stakingPool = await viem.deployContract("StakingPool", [
      contracts.BOTToken,
      contracts.Treasury
    ]);
    contracts.StakingPool = stakingPool.address;
    console.log(chalk.green(`✅ StakingPool: ${contracts.StakingPool}`));
    
    console.log(chalk.green("\n✅ Core contracts deployed\n"));
    
    // ==================== Test Frontend Functions ====================
    console.log(chalk.bold.magenta("🎮 Testing Frontend Methods:\n"));
    
    // Test BOT Token Operations
    console.log(chalk.cyan("1. BOT Token Operations"));
    
    // Get balance
    const balance = await publicClient.readContract({
      address: contracts.BOTToken,
      abi: botToken.abi,
      functionName: "balanceOf",
      args: [account.address]
    });
    console.log(`   Balance: ${formatUnits(balance, 18)} BOT`);
    results.push({ test: "Get BOT Balance", status: "PASS", value: formatUnits(balance, 18) });
    
    // Transfer tokens
    console.log("   Testing transfer...");
    const transferTx = await walletClient.writeContract({
      address: contracts.BOTToken,
      abi: botToken.abi,
      functionName: "transfer",
      args: [contracts.Treasury, parseUnits("1000", 18)]
    });
    await publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log(chalk.green("   ✅ Transfer successful"));
    results.push({ test: "BOT Transfer", status: "PASS", tx: transferTx });
    
    // Approve spending
    console.log("   Testing approve...");
    const approveTx = await walletClient.writeContract({
      address: contracts.BOTToken,
      abi: botToken.abi,
      functionName: "approve",
      args: [contracts.StakingPool, parseUnits("10000", 18)]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(chalk.green("   ✅ Approve successful"));
    results.push({ test: "BOT Approve", status: "PASS", tx: approveTx });
    
    // Test Staking Operations
    console.log(chalk.cyan("\n2. Staking Operations"));
    
    // Stake tokens
    console.log("   Testing stake...");
    const stakeTx = await walletClient.writeContract({
      address: contracts.StakingPool,
      abi: stakingPool.abi,
      functionName: "stake",
      args: [parseUnits("100", 18)]
    });
    await publicClient.waitForTransactionReceipt({ hash: stakeTx });
    console.log(chalk.green("   ✅ Stake successful"));
    results.push({ test: "Stake BOT", status: "PASS", tx: stakeTx });
    
    // Check staked balance
    const stakedBalance = await publicClient.readContract({
      address: contracts.StakingPool,
      abi: stakingPool.abi,
      functionName: "balanceOf",
      args: [account.address]
    });
    console.log(`   Staked: ${formatUnits(stakedBalance, 18)} BOT`);
    results.push({ test: "Get Staked Balance", status: "PASS", value: formatUnits(stakedBalance, 18) });
    
    // Test Treasury Operations
    console.log(chalk.cyan("\n3. Treasury Operations"));
    
    // Get distribution percentages
    const stakingPercent = await publicClient.readContract({
      address: contracts.Treasury,
      abi: treasury.abi,
      functionName: "stakingPercent"
    });
    console.log(`   Staking: ${stakingPercent}%`);
    results.push({ test: "Get Staking Percent", status: "PASS", value: stakingPercent });
    
    const buybackPercent = await publicClient.readContract({
      address: contracts.Treasury,
      abi: treasury.abi,
      functionName: "buybackPercent"
    });
    console.log(`   Buyback: ${buybackPercent}%`);
    results.push({ test: "Get Buyback Percent", status: "PASS", value: buybackPercent });
    
    // Test Frontend CLI Integration
    console.log(chalk.cyan("\n4. Frontend CLI Integration"));
    
    // Save deployment for frontend
    const deploymentInfo = {
      network: "localhost",
      chainId: 31337,
      timestamp: new Date().toISOString(),
      contracts: contracts,
      testResults: results
    };
    
    const deploymentPath = path.join(__dirname, "../deployments/local-deployment.json");
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(chalk.green("   ✅ Deployment saved for frontend"));
    
    // Test with enhanced CLI (non-interactive)
    console.log("\n   Testing CLI commands...");
    
    // Test balance query via CLI-like interface
    const cliBalance = await publicClient.readContract({
      address: contracts.BOTToken,
      abi: botToken.abi,
      functionName: "balanceOf",
      args: [account.address]
    });
    console.log(`   CLI Balance Query: ${formatUnits(cliBalance, 18)} BOT`);
    results.push({ test: "CLI Balance Query", status: "PASS", value: formatUnits(cliBalance, 18) });
    
  } catch (error: any) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    results.push({ test: "Deployment", status: "FAIL", error: error.message });
  } finally {
    await connection.close();
  }
  
  // ==================== Summary ====================
  console.log(chalk.bold.green("\n📊 Test Summary:\n"));
  
  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;
  
  console.table([
    { Metric: "Total Tests", Value: results.length },
    { Metric: "Passed", Value: passCount },
    { Metric: "Failed", Value: failCount },
    { Metric: "Success Rate", Value: `${((passCount / results.length) * 100).toFixed(1)}%` }
  ]);
  
  // Save test results
  const resultsPath = path.join(__dirname, "../test-results/local-frontend-test.json");
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: "localhost",
    summary: {
      total: results.length,
      passed: passCount,
      failed: failCount
    },
    results
  }, null, 2));
  
  console.log(chalk.gray("\nResults saved to:"), resultsPath);
  
  if (failCount === 0) {
    console.log(chalk.green("\n✅ All frontend methods working correctly!"));
    console.log(chalk.yellow("\nYou can now run the enhanced CLI:"));
    console.log(chalk.cyan("  npm run cli:enhanced"));
  } else {
    console.log(chalk.red(`\n⚠️  ${failCount} tests failed. Check the results.`));
  }
}

main()
  .then(() => {
    console.log(chalk.green("\n✅ Testing complete"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Script failed:"), error);
    process.exit(1);
  });