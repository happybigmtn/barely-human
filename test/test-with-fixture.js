import hre from "hardhat";
import { expect } from "chai";

// The NetworkHelpers class contains loadFixture as a method
// We need to access it through hre.network.helpers
describe("Test with Fixture", function () {
  async function deployFixture() {
    const [owner, player1] = await hre.viem.getWalletClients();
    
    // Deploy MockERC20
    const usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    
    return { usdc, owner, player1 };
  }

  it("Should use fixture", async function () {
    // Access loadFixture through hre.network.helpers
    const { usdc, owner, player1 } = await hre.network.helpers.loadFixture(deployFixture);
    
    const name = await usdc.read.name();
    expect(name).to.equal("USD Coin");
  });

  it("Should reuse fixture", async function () {
    // This should restore from snapshot, not redeploy
    const { usdc, owner, player1 } = await hre.network.helpers.loadFixture(deployFixture);
    
    const symbol = await usdc.read.symbol();
    expect(symbol).to.equal("USDC");
  });
});