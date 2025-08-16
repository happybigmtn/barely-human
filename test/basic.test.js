import { expect } from "chai";
import hre from "hardhat";

describe("Basic Test", function () {
  it("Should have viem available", async function () {
    expect(hre.viem).to.not.be.undefined;
  });

  it("Should deploy a simple contract", async function () {
    const mockERC20 = await hre.viem.deployContract("MockERC20", ["Test", "TEST", 18]);
    const symbol = await mockERC20.read.symbol();
    expect(symbol).to.equal("TEST");
  });
});