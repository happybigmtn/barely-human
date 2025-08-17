import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Simple Viem Test", function () {
  async function deployFixture() {
    // Get clients and wallets
    const publicClient = await hre.viem.getPublicClient();
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    
    return { publicClient, owner, otherAccount };
  }

  it("Should work with viem", async function () {
    const { owner } = await loadFixture(deployFixture);
    expect(owner.account.address).to.be.a('string');
  });

  it("Should deploy a contract", async function () {
    const { owner } = await loadFixture(deployFixture);
    
    // Deploy MockERC20
    const mockERC20 = await hre.viem.deployContract("MockERC20", ["Test Token", "TEST", 18]);
    
    const symbol = await mockERC20.read.symbol();
    expect(symbol).to.equal("TEST");
  });
});