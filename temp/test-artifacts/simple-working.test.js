// Simple test without loadFixture or network helpers
import hre from "hardhat";
import { expect } from "chai";

describe("Simple Working Test", function () {
  it("Should deploy MockERC20", async function () {
    // Deploy MockERC20
    const usdc = await hre.viem.deployContract("MockERC20", ["Test Token", "TEST", 18]);
    
    // Check basic properties
    const name = await usdc.read.name();
    const symbol = await usdc.read.symbol();
    
    expect(name).to.equal("Test Token");
    expect(symbol).to.equal("TEST");
  });

  it("Should get wallet clients", async function () {
    const walletClients = await hre.viem.getWalletClients();
    
    expect(walletClients).to.have.lengthOf.at.least(1);
    expect(walletClients[0].account.address).to.be.a("string");
  });
});