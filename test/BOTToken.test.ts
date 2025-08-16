import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther, keccak256, toBytes } from "viem";

describe("BOTToken", function () {
  // Roles
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
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

  async function deployBOTTokenFixture() {
    // Get clients and wallets
    const publicClient = await hre.viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community, user1, user2] = 
      await hre.viem.getWalletClients();
    
    // Deploy BOTToken
    const botToken = await hre.viem.deployContract("BOTToken", [
      treasury.account.address,
      liquidity.account.address,
      staking.account.address,
      team.account.address,
      community.account.address
    ]);
    
    return { 
      botToken, 
      publicClient, 
      deployer, 
      treasury, 
      liquidity, 
      staking, 
      team, 
      community,
      user1,
      user2
    };
  }

  describe("Deployment", function () {
    it("Should set the correct token details", async function () {
      const { botToken } = await loadFixture(deployBOTTokenFixture);
      
      expect(await botToken.read.name()).to.equal("BOT Token");
      expect(await botToken.read.symbol()).to.equal("BOT");
      expect(await botToken.read.decimals()).to.equal(18);
    });

    it("Should mint correct total supply", async function () {
      const { botToken } = await loadFixture(deployBOTTokenFixture);
      
      const totalSupply = await botToken.read.totalSupply();
      expect(totalSupply).to.equal(INITIAL_SUPPLY);
    });

    it("Should distribute tokens to correct addresses", async function () {
      const { botToken, treasury, liquidity, staking, team, community } = 
        await loadFixture(deployBOTTokenFixture);
      
      expect(await botToken.read.balanceOf([treasury.account.address]))
        .to.equal(TREASURY_ALLOCATION);
      expect(await botToken.read.balanceOf([liquidity.account.address]))
        .to.equal(LIQUIDITY_ALLOCATION);
      expect(await botToken.read.balanceOf([staking.account.address]))
        .to.equal(STAKING_ALLOCATION);
      expect(await botToken.read.balanceOf([team.account.address]))
        .to.equal(TEAM_ALLOCATION);
      expect(await botToken.read.balanceOf([community.account.address]))
        .to.equal(COMMUNITY_ALLOCATION);
    });

    it("Should set up roles correctly", async function () {
      const { botToken, deployer, treasury, staking } = 
        await loadFixture(deployBOTTokenFixture);
      
      // Deployer should have DEFAULT_ADMIN_ROLE
      expect(await botToken.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]))
        .to.be.true;
      
      // Treasury should have TREASURY_ROLE
      expect(await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]))
        .to.be.true;
      
      // Staking should have STAKING_ROLE
      expect(await botToken.read.hasRole([STAKING_ROLE, staking.account.address]))
        .to.be.true;
      
      // Deployer should have PAUSER_ROLE
      expect(await botToken.read.hasRole([PAUSER_ROLE, deployer.account.address]))
        .to.be.true;
    });
  });

  describe("Transfers", function () {
    it("Should allow regular transfers", async function () {
      const { botToken, treasury, user1 } = await loadFixture(deployBOTTokenFixture);
      
      const amount = parseEther("100");
      
      // Transfer from treasury to user1
      const hash = await botToken.write.transfer(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      expect(await botToken.read.balanceOf([user1.account.address]))
        .to.equal(amount);
    });

    it("Should allow approve and transferFrom", async function () {
      const { botToken, treasury, user1, user2, publicClient } = await loadFixture(deployBOTTokenFixture);
      
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
      
      expect(await botToken.read.balanceOf([user2.account.address]))
        .to.equal(amount);
    });
  });

  describe("Pausable", function () {
    it("Should allow pauser to pause and unpause", async function () {
      const { botToken, deployer, publicClient } = await loadFixture(deployBOTTokenFixture);
      
      // Initially not paused
      expect(await botToken.read.paused()).to.be.false;
      
      // Pause
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      expect(await botToken.read.paused()).to.be.true;
      
      // Unpause
      const unpauseHash = await botToken.write.unpause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
      expect(await botToken.read.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      const { botToken, deployer, treasury, user1, publicClient } = await loadFixture(deployBOTTokenFixture);
      
      // Pause the contract
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      
      // Try to transfer (should fail)
      await expect(
        botToken.write.transfer(
          [user1.account.address, parseEther("100")],
          { account: treasury.account }
        )
      ).to.be.rejectedWith("EnforcedPause");
    });

    it("Should prevent non-pauser from pausing", async function () {
      const { botToken, user1 } = await loadFixture(deployBOTTokenFixture);
      
      await expect(
        botToken.write.pause({ account: user1.account })
      ).to.be.rejectedWith(/AccessControl/);
    });
  });

  describe("Burn", function () {
    it("Should allow token holders to burn their tokens", async function () {
      const { botToken, treasury, publicClient } = await loadFixture(deployBOTTokenFixture);
      
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
      expect(await botToken.read.balanceOf([treasury.account.address]))
        .to.equal(initialBalance - burnAmount);
      
      // Check total supply decreased
      expect(await botToken.read.totalSupply())
        .to.equal(initialSupply - burnAmount);
    });

    it("Should allow burnFrom with approval", async function () {
      const { botToken, treasury, user1, publicClient } = await loadFixture(deployBOTTokenFixture);
      
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
      expect(await botToken.read.balanceOf([treasury.account.address]))
        .to.equal(initialBalance - burnAmount);
      
      // Check total supply decreased
      expect(await botToken.read.totalSupply())
        .to.equal(initialSupply - burnAmount);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant roles", async function () {
      const { botToken, deployer, user1, publicClient } = await loadFixture(deployBOTTokenFixture);
      
      // Grant TREASURY_ROLE to user1
      const grantHash = await botToken.write.grantRole(
        [TREASURY_ROLE, user1.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: grantHash });
      
      expect(await botToken.read.hasRole([TREASURY_ROLE, user1.account.address]))
        .to.be.true;
    });

    it("Should allow admin to revoke roles", async function () {
      const { botToken, deployer, treasury, publicClient } = await loadFixture(deployBOTTokenFixture);
      
      // Revoke TREASURY_ROLE from treasury
      const revokeHash = await botToken.write.revokeRole(
        [TREASURY_ROLE, treasury.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: revokeHash });
      
      expect(await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]))
        .to.be.false;
    });

    it("Should prevent non-admin from granting roles", async function () {
      const { botToken, user1, user2 } = await loadFixture(deployBOTTokenFixture);
      
      await expect(
        botToken.write.grantRole(
          [TREASURY_ROLE, user2.account.address],
          { account: user1.account }
        )
      ).to.be.rejectedWith(/AccessControl/);
    });
  });
});