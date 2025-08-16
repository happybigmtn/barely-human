import hre from "hardhat";
import { expect } from "chai";
import { parseEther } from "viem";

describe("Minimal Working Test", function () {
  let usdc;
  let owner;
  let player1;

  beforeEach(async function () {
    // Get wallet clients (signers)
    const walletClients = await hre.viem.getWalletClients();
    owner = walletClients[0];
    player1 = walletClients[1];
    
    // Deploy MockERC20
    usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  });

  describe("MockERC20", function () {
    it("Should have correct name and symbol", async function () {
      const name = await usdc.read.name();
      const symbol = await usdc.read.symbol();
      const decimals = await usdc.read.decimals();
      
      expect(name).to.equal("USD Coin");
      expect(symbol).to.equal("USDC");
      expect(decimals).to.equal(6);
    });

    it("Should mint tokens correctly", async function () {
      const mintAmount = 1000000n; // 1 USDC with 6 decimals
      
      // Mint tokens to player1
      await usdc.write.mint([player1.account.address, mintAmount]);
      
      // Check balance
      const balance = await usdc.read.balanceOf([player1.account.address]);
      expect(balance).to.equal(mintAmount);
    });

    it("Should transfer tokens", async function () {
      const mintAmount = 1000000n; // 1 USDC
      const transferAmount = 500000n; // 0.5 USDC
      
      // Mint to player1
      await usdc.write.mint([player1.account.address, mintAmount]);
      
      // Get player2
      const walletClients = await hre.viem.getWalletClients();
      const player2 = walletClients[2];
      
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
});