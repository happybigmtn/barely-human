import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther, getAddress } from "viem";

describe("Working Test Example", function () {
  // Deployment fixture
  async function deployContractsFixture() {
    // Get wallet clients (signers)
    const [owner, player1, player2] = await hre.viem.getWalletClients();
    
    // Get public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Deploy MockERC20
    const usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    
    // Deploy MockVRFCoordinator
    const vrfCoordinator = await hre.viem.deployContract("MockVRFCoordinator");
    
    return {
      usdc,
      vrfCoordinator,
      owner,
      player1,
      player2,
      publicClient
    };
  }

  describe("MockERC20 Deployment", function () {
    it("Should have correct name and symbol", async function () {
      const { usdc } = await loadFixture(deployContractsFixture);
      
      const name = await usdc.read.name();
      const symbol = await usdc.read.symbol();
      const decimals = await usdc.read.decimals();
      
      expect(name).to.equal("USD Coin");
      expect(symbol).to.equal("USDC");
      expect(decimals).to.equal(6);
    });

    it("Should mint tokens correctly", async function () {
      const { usdc, player1 } = await loadFixture(deployContractsFixture);
      
      const mintAmount = 1000000n; // 1 USDC with 6 decimals
      
      // Mint tokens to player1
      await usdc.write.mint([player1.account.address, mintAmount]);
      
      // Check balance
      const balance = await usdc.read.balanceOf([player1.account.address]);
      expect(balance).to.equal(mintAmount);
    });

    it("Should transfer tokens", async function () {
      const { usdc, player1, player2 } = await loadFixture(deployContractsFixture);
      
      const mintAmount = 1000000n; // 1 USDC
      const transferAmount = 500000n; // 0.5 USDC
      
      // Mint to player1
      await usdc.write.mint([player1.account.address, mintAmount]);
      
      // Transfer from player1 to player2
      await usdc.write.transfer(
        [player2.account.address, transferAmount],
        { account: player1.account }
      );
      
      // Check balances
      const balance1 = await usdc.read.balanceOf([player1.account.address]);
      const balance2 = await usdc.read.balanceOf([player2.account.address]);
      
      expect(balance1).to.equal(mintAmount - transferAmount);
      expect(balance2).to.equal(transferAmount);
    });
  });

  describe("MockVRFCoordinator", function () {
    it("Should handle randomness requests", async function () {
      const { vrfCoordinator } = await loadFixture(deployContractsFixture);
      
      // Request randomness
      const tx = await vrfCoordinator.write.requestRandomWords([
        "0x0000000000000000000000000000000000000000000000000000000000000001", // keyHash
        1n, // subId
        3, // confirmations
        100000n, // callbackGasLimit
        1 // numWords
      ]);
      
      // Check last request ID
      const lastRequestId = await vrfCoordinator.read.lastRequestId();
      expect(lastRequestId).to.be.greaterThan(0n);
    });
  });
});