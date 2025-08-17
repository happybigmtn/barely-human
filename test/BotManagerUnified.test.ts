import { network } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "viem";

/**
 * Test suite for BotManagerUnified
 * Properly structured for Hardhat 3.0 with connection management
 */
describe("BotManagerUnified", function() {
  let connection: any;
  let viem: any;
  let botManager: any;
  let deployer: any;

  beforeEach(async function() {
    // Proper Hardhat 3 connection pattern
    connection = await network.connect();
    viem = connection.viem;
    
    const walletClients = await viem.getWalletClients();
    deployer = walletClients[0];

    // Deploy VRF mock for testing
    const vrfCoordinator = await viem.deployContract("MockVRFCoordinator");
    
    // Deploy BotManagerUnified
    botManager = await viem.deployContract("BotManagerUnified", [
      vrfCoordinator.address,
      1n, // subscription ID
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // key hash
    ]);

    // Initialize
    await botManager.write.initialize([deployer.account.address]);
  });

  afterEach(async function() {
    // Critical: Always close connection
    if (connection) {
      await connection.close();
    }
  });

  describe("Initialization", function() {
    it("should initialize with correct admin", async function() {
      const hasRole = await botManager.read.hasRole([
        await botManager.read.DEFAULT_ADMIN_ROLE(),
        deployer.account.address
      ]);
      expect(hasRole).to.be.true;
    });

    it("should initialize 10 bots", async function() {
      const totalBots = await botManager.read.totalBots();
      expect(totalBots).to.equal(10n);
    });

    it("should start with VRF disabled", async function() {
      const vrfEnabled = await botManager.read.vrfEnabled();
      expect(vrfEnabled).to.be.false;
    });
  });

  describe("Bot Decisions", function() {
    it("should make pseudo-random decision when VRF disabled", async function() {
      const tx = await botManager.write.makeBotDecision([0n, 12345n], {
        account: deployer.account
      });
      
      const receipt = await viem.publicClient.waitForTransactionReceipt({
        hash: tx
      });
      
      expect(receipt.status).to.equal("success");
    });

    it("should revert for invalid bot ID", async function() {
      await expect(
        botManager.write.makeBotDecision([99n, 12345n], {
          account: deployer.account
        })
      ).to.be.revertedWith("Invalid bot");
    });
  });

  describe("Feature Flags", function() {
    it("should toggle VRF mode", async function() {
      await botManager.write.setFeatureFlags([true, false, false], {
        account: deployer.account
      });
      
      const vrfEnabled = await botManager.read.vrfEnabled();
      expect(vrfEnabled).to.be.true;
    });

    it("should only allow admin to change flags", async function() {
      const [_, otherAccount] = await viem.getWalletClients();
      
      await expect(
        botManager.write.setFeatureFlags([true, false, false], {
          account: otherAccount.account
        })
      ).to.be.reverted;
    });
  });

  describe("Gas Optimization", function() {
    it("should use less than 50k gas for pseudo-random decision", async function() {
      const gasEstimate = await botManager.estimateGas.makeBotDecision([0n, 12345n], {
        account: deployer.account
      });
      
      expect(gasEstimate).to.be.lessThan(50000n);
    });
  });

  describe("Bot Information", function() {
    it("should return correct bot personality", async function() {
      const bot = await botManager.read.getBotInfo([0n]);
      
      expect(bot.aggressiveness).to.be.greaterThan(0);
      expect(bot.riskTolerance).to.be.greaterThan(0);
      expect(bot.minBet).to.be.greaterThan(0n);
      expect(bot.maxBet).to.be.greaterThan(bot.minBet);
    });
  });
});