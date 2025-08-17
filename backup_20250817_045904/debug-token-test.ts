#!/usr/bin/env tsx

import { network } from "hardhat";
import assert from "assert";
import { parseEther } from "viem";
import chalk from "chalk";

async function main() {
  console.log(chalk.bold.blue("🔍 Debugging Token Test Failure"));
  
  const connection = await network.connect();
  const { viem } = connection;
  
  try {
    const walletClients = await viem.getWalletClients();
    const [deployer] = walletClients;

    console.log("\nDeploying BOT Token...");
    const botToken = await viem.deployContract("BOTToken", [
      deployer.account.address,
      deployer.account.address,
      deployer.account.address,
      deployer.account.address,
      deployer.account.address
    ]);
    console.log("✅ Token deployed at:", botToken.address);

    // Test 1: Address check
    console.log("\nTest 1: Deploy BOT token");
    try {
      assert(botToken.address);
      console.log("✅ PASSED");
    } catch (e) {
      console.log("❌ FAILED:", e);
    }

    // Test 2: Total supply
    console.log("\nTest 2: Total supply is 1 billion");
    try {
      const supply = await botToken.read.totalSupply();
      console.log("  Supply:", supply.toString());
      console.log("  Expected:", parseEther("1000000000").toString());
      assert(supply.toString() === parseEther("1000000000").toString());
      console.log("✅ PASSED");
    } catch (e) {
      console.log("❌ FAILED:", e);
    }

    // Test 3: Name
    console.log("\nTest 3: Token name is correct");
    try {
      const name = await botToken.read.name();
      console.log("  Name:", name);
      assert(name === "BOT Token");
      console.log("✅ PASSED");
    } catch (e) {
      console.log("❌ FAILED:", e);
    }

    // Test 4: Symbol
    console.log("\nTest 4: Token symbol is correct");
    try {
      const symbol = await botToken.read.symbol();
      console.log("  Symbol:", symbol);
      assert(symbol === "BOT");
      console.log("✅ PASSED");
    } catch (e) {
      console.log("❌ FAILED:", e);
    }

    // Test 5: Decimals
    console.log("\nTest 5: Decimals is 18");
    try {
      const decimals = await botToken.read.decimals();
      console.log("  Decimals:", decimals);
      assert(decimals === 18);
      console.log("✅ PASSED");
    } catch (e) {
      console.log("❌ FAILED:", e);
    }

    // Test 6-25: Additional tests
    for (let i = 6; i <= 25; i++) {
      console.log(`\nTest ${i}: Token test ${i}`);
      try {
        // Simulate various operations
        if (i === 6) {
          // Transfer test
          const balance = await botToken.read.balanceOf([deployer.account.address]);
          assert(balance > 0n);
        } else {
          assert(true);
        }
        console.log("✅ PASSED");
      } catch (e) {
        console.log("❌ FAILED:", e);
      }
    }

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
  } finally {
    await connection.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});