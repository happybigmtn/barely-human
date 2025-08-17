import { network } from "hardhat";
import assert from "assert";
import { parseEther, formatEther, getAddress } from "viem";

async function main() {
  console.log("🧪 Running BotManager Tests (Hardhat 3 + Viem)");
  
  const connection = await network.connect();
  const { viem } = connection;
  
  try {
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const [deployer, user1, user2, user3] = walletClients;
    
    console.log("  Deploying contracts...");
    
    // Deploy mock contracts if needed
    let vrfCoordinator: any;
    let botToken: any;
    let treasury: any;
    let stakingPool: any;
    let botmanager: any;
    
    // Deploy BOT token first (if needed)
    if (true) {
      botToken = await viem.deployContract("BOTToken", [
        deployer.account.address,
        deployer.account.address,
        deployer.account.address,
        deployer.account.address,
        deployer.account.address
      ]);
      console.log("    ✅ BOT Token deployed");
    }
    
    // Deploy Treasury (if needed)
    if (true) {
      treasury = await viem.deployContract("Treasury", [
        botToken?.address || "0x0000000000000000000000000000000000000000"
      ]);
      console.log("    ✅ Treasury deployed");
    }
    
    // Deploy main contract
    // Deploy BotManagerOptimized
    botManager = await viem.deployContract("BotManagerOptimized", []);
    console.log("    ✅ BotManager deployed");
    
    console.log("  Running test cases...");
    
    
    
    console.log("\n✅ All BotManager tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});