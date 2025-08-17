import { expect } from "chai";
import hre from "hardhat";

describe("Simple Test", function () {
  it("Should pass a simple test", async function () {
    expect(1 + 1).to.equal(2);
  });

  it("Should have access to ethers", async function () {
    const { ethers } = hre;
    expect(ethers).to.not.be.undefined;
  });
});