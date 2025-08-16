import { test } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import { parseEther } from "viem";

test("BOTToken deployment test", async () => {
  console.log("Compiling contracts...");
  await hre.run("compile");
  
  console.log("Getting clients...");
  const publicClient = await hre.viem.getPublicClient();
  const [deployer, treasury, liquidity, staking, team, community] = 
    await hre.viem.getWalletClients();
  
  console.log("Deploying BOTToken...");
  const botToken = await hre.viem.deployContract("BOTToken", [
    treasury.account.address,
    liquidity.account.address,
    staking.account.address,
    team.account.address,
    community.account.address
  ]);
  
  console.log("BOT Token deployed at:", botToken.address);
  
  // Test basic properties
  assert.strictEqual(await botToken.read.name(), "BOT Token");
  assert.strictEqual(await botToken.read.symbol(), "BOT");
  assert.strictEqual(await botToken.read.decimals(), 18);
  
  // Test supply
  const totalSupply = await botToken.read.totalSupply();
  assert.strictEqual(totalSupply, parseEther("1000000000"));
  
  // Test allocations
  assert.strictEqual(
    await botToken.read.balanceOf([treasury.account.address]),
    parseEther("200000000")
  );
  
  console.log("✅ All tests passed!");
});