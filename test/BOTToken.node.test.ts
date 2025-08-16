import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import { parseEther, keccak256, toBytes, type WalletClient, type PublicClient } from "viem";

describe("BOTToken", async () => {
  // Roles
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
  const TREASURY_ROLE = keccak256(toBytes("TREASURY_ROLE"));
  const STAKING_ROLE = keccak256(toBytes("STAKING_ROLE"));
  const PAUSER_ROLE = keccak256(toBytes("PAUSER_ROLE"));

  // Allocations
  const INITIAL_SUPPLY = parseEther("1000000000"); // 1B tokens
  const TREASURY_ALLOCATION = parseEther("200000000"); // 200M
  const LIQUIDITY_ALLOCATION = parseEther("300000000"); // 300M
  const STAKING_ALLOCATION = parseEther("250000000"); // 250M
  const TEAM_ALLOCATION = parseEther("150000000"); // 150M
  const COMMUNITY_ALLOCATION = parseEther("100000000"); // 100M

  let botToken: any;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let treasury: WalletClient;
  let liquidity: WalletClient;
  let staking: WalletClient;
  let team: WalletClient;
  let community: WalletClient;
  let user1: WalletClient;
  let user2: WalletClient;

  beforeEach(async () => {
    // Get clients and wallets
    publicClient = await hre.viem.getPublicClient();
    [deployer, treasury, liquidity, staking, team, community, user1, user2] = 
      await hre.viem.getWalletClients();
    
    // Deploy BOTToken
    botToken = await hre.viem.deployContract("BOTToken", [
      treasury.account.address,
      liquidity.account.address,
      staking.account.address,
      team.account.address,
      community.account.address
    ]);
  });

  await describe("Deployment", async () => {
    await it("Should set the correct token details", async () => {
      assert.strictEqual(await botToken.read.name(), "BOT Token");
      assert.strictEqual(await botToken.read.symbol(), "BOT");
      assert.strictEqual(await botToken.read.decimals(), 18);
    });

    await it("Should mint correct total supply", async () => {
      const totalSupply = await botToken.read.totalSupply();
      assert.strictEqual(totalSupply, INITIAL_SUPPLY);
    });

    await it("Should distribute tokens to correct addresses", async () => {
      assert.strictEqual(
        await botToken.read.balanceOf([treasury.account.address]),
        TREASURY_ALLOCATION
      );
      assert.strictEqual(
        await botToken.read.balanceOf([liquidity.account.address]),
        LIQUIDITY_ALLOCATION
      );
      assert.strictEqual(
        await botToken.read.balanceOf([staking.account.address]),
        STAKING_ALLOCATION
      );
      assert.strictEqual(
        await botToken.read.balanceOf([team.account.address]),
        TEAM_ALLOCATION
      );
      assert.strictEqual(
        await botToken.read.balanceOf([community.account.address]),
        COMMUNITY_ALLOCATION
      );
    });

    await it("Should set up roles correctly", async () => {
      // Deployer should have DEFAULT_ADMIN_ROLE
      assert.strictEqual(
        await botToken.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]),
        true
      );
      
      // Treasury should have TREASURY_ROLE
      assert.strictEqual(
        await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]),
        true
      );
      
      // Staking should have STAKING_ROLE
      assert.strictEqual(
        await botToken.read.hasRole([STAKING_ROLE, staking.account.address]),
        true
      );
      
      // Deployer should have PAUSER_ROLE
      assert.strictEqual(
        await botToken.read.hasRole([PAUSER_ROLE, deployer.account.address]),
        true
      );
    });
  });

  await describe("Transfers", async () => {
    await it("Should allow regular transfers", async () => {
      const amount = parseEther("100");
      
      // Transfer from treasury to user1
      const hash = await botToken.write.transfer(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      assert.strictEqual(
        await botToken.read.balanceOf([user1.account.address]),
        amount
      );
    });

    await it("Should allow approve and transferFrom", async () => {
      const amount = parseEther("100");
      
      // Treasury approves user1
      const approveHash = await botToken.write.approve(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      
      // user1 transfers from treasury to user2
      const transferHash = await botToken.write.transferFrom(
        [treasury.account.address, user2.account.address, amount],
        { account: user1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: transferHash });
      
      assert.strictEqual(
        await botToken.read.balanceOf([user2.account.address]),
        amount
      );
    });
  });

  await describe("Pausable", async () => {
    await it("Should allow pauser to pause and unpause", async () => {
      // Initially not paused
      assert.strictEqual(await botToken.read.paused(), false);
      
      // Pause
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      assert.strictEqual(await botToken.read.paused(), true);
      
      // Unpause
      const unpauseHash = await botToken.write.unpause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
      assert.strictEqual(await botToken.read.paused(), false);
    });

    await it("Should prevent transfers when paused", async () => {
      // Pause the contract
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      
      // Try to transfer (should fail)
      await assert.rejects(
        async () => {
          await botToken.write.transfer(
            [user1.account.address, parseEther("100")],
            { account: treasury.account }
          );
        },
        /EnforcedPause/
      );
    });

    await it("Should prevent non-pauser from pausing", async () => {
      await assert.rejects(
        async () => {
          await botToken.write.pause({ account: user1.account });
        },
        /AccessControl/
      );
    });
  });

  await describe("Burn", async () => {
    await it("Should allow token holders to burn their tokens", async () => {
      const burnAmount = parseEther("1000");
      const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
      const initialSupply = await botToken.read.totalSupply();
      
      // Burn tokens
      const burnHash = await botToken.write.burn(
        [burnAmount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      // Check balance decreased
      assert.strictEqual(
        await botToken.read.balanceOf([treasury.account.address]),
        initialBalance - burnAmount
      );
      
      // Check total supply decreased
      assert.strictEqual(
        await botToken.read.totalSupply(),
        initialSupply - burnAmount
      );
    });

    await it("Should allow burnFrom with approval", async () => {
      const burnAmount = parseEther("1000");
      
      // Treasury approves user1 to burn
      const approveHash = await botToken.write.approve(
        [user1.account.address, burnAmount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      
      const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
      const initialSupply = await botToken.read.totalSupply();
      
      // user1 burns treasury's tokens
      const burnHash = await botToken.write.burnFrom(
        [treasury.account.address, burnAmount],
        { account: user1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      // Check balance decreased
      assert.strictEqual(
        await botToken.read.balanceOf([treasury.account.address]),
        initialBalance - burnAmount
      );
      
      // Check total supply decreased
      assert.strictEqual(
        await botToken.read.totalSupply(),
        initialSupply - burnAmount
      );
    });
  });

  await describe("Access Control", async () => {
    await it("Should allow admin to grant roles", async () => {
      // Grant TREASURY_ROLE to user1
      const grantHash = await botToken.write.grantRole(
        [TREASURY_ROLE, user1.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: grantHash });
      
      assert.strictEqual(
        await botToken.read.hasRole([TREASURY_ROLE, user1.account.address]),
        true
      );
    });

    await it("Should allow admin to revoke roles", async () => {
      // Revoke TREASURY_ROLE from treasury
      const revokeHash = await botToken.write.revokeRole(
        [TREASURY_ROLE, treasury.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: revokeHash });
      
      assert.strictEqual(
        await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]),
        false
      );
    });

    await it("Should prevent non-admin from granting roles", async () => {
      await assert.rejects(
        async () => {
          await botToken.write.grantRole(
            [TREASURY_ROLE, user2.account.address],
            { account: user1.account }
          );
        },
        /AccessControl/
      );
    });
  });
});