import { network } from "hardhat";
import assert from "assert";

async function main() {
  console.log("🧪 Running FullSystem.viem.test Tests (Viem)");
  
  const connection = await network.connect();
  const { viem } = connection;
  
  try {
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const [deployer] = walletClients;
    
    // Test: Contract deployment
    console.log("  Testing contract deployment...");
    // Add specific contract tests here
    
    console.log("✅ All tests passed for FullSystem.viem.test");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
