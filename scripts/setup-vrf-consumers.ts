// Setup VRF Consumers Script
// Registers all contracts that need VRF access as consumers

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function setupVRFConsumers() {
  console.log("🎲 Setting up VRF consumers...\n");

  const connection = await network.connect();
  const { viem } = connection;

  try {
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();
    
    // Load deployment info
    const deploymentPath = path.join(__dirname, "../deployment/base-sepolia-deployment.json");
    if (!fs.existsSync(deploymentPath)) {
      console.log("⚠️ No deployment found. Run deployment script first.");
      process.exit(1);
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const { CrapsGame, GachaMintPass, BotManager } = deployment.contracts;
    
    // For local testing, we'll use a mock VRF coordinator
    console.log("📦 Deploying Mock VRF Coordinator...");
    const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus", []);
    console.log(`✅ Mock VRF deployed at: ${mockVRF.address}\n`);
    
    // Create subscription
    console.log("📝 Creating VRF subscription...");
    const createSubHash = await mockVRF.write.createSubscription();
    await publicClient.waitForTransactionReceipt({ hash: createSubHash });
    console.log("✅ Subscription created with ID: 1\n");
    
    // Add consumers
    console.log("🔧 Adding VRF consumers...");
    
    if (CrapsGame) {
      console.log(`Adding CrapsGame: ${CrapsGame}`);
      const addCrapsHash = await mockVRF.write.addConsumer([1n, CrapsGame]);
      await publicClient.waitForTransactionReceipt({ hash: addCrapsHash });
      console.log("✅ CrapsGame added as consumer");
    }
    
    if (GachaMintPass) {
      console.log(`Adding GachaMintPass: ${GachaMintPass}`);
      const addGachaHash = await mockVRF.write.addConsumer([1n, GachaMintPass]);
      await publicClient.waitForTransactionReceipt({ hash: addGachaHash });
      console.log("✅ GachaMintPass added as consumer");
    }
    
    if (BotManager) {
      console.log(`Adding BotManager: ${BotManager}`);
      const addBotHash = await mockVRF.write.addConsumer([1n, BotManager]);
      await publicClient.waitForTransactionReceipt({ hash: addBotHash });
      console.log("✅ BotManager added as consumer");
    }
    
    // Save VRF info
    const vrfInfo = {
      coordinator: mockVRF.address,
      subscriptionId: "1",
      consumers: [CrapsGame, GachaMintPass, BotManager].filter(Boolean),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployment/vrf-setup.json"),
      JSON.stringify(vrfInfo, null, 2)
    );
    
    console.log("\n✅ VRF setup complete!");
    console.log("📄 VRF info saved to deployment/vrf-setup.json");
    
  } catch (error) {
    console.error("❌ VRF setup failed:", error);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

setupVRFConsumers().catch(console.error);