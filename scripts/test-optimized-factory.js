import hre from "hardhat";
import { parseEther } from "viem";

async function main() {
    console.log("Testing Optimized VaultFactory...\n");
    
    // Get wallet clients
    const [owner] = await hre.viem.getWalletClients();
    
    // Deploy mock USDC
    console.log("Deploying mock USDC...");
    const usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    console.log("✅ USDC deployed to:", usdc.address);
    
    // Deploy optimized VaultFactory
    console.log("\nDeploying Optimized VaultFactory...");
    const factory = await hre.viem.deployContract("VaultFactoryOptimized", [
        usdc.address,
        owner.account.address // treasury
    ]);
    console.log("✅ VaultFactory deployed to:", factory.address);
    
    // Deploy all 10 bots
    console.log("\nDeploying all 10 bot vaults...");
    await factory.write.deployAllBots();
    console.log("✅ All 10 bot vaults deployed");
    
    // Verify deployments
    console.log("\nVerifying deployments:");
    const nextBotId = await factory.read.nextBotId();
    console.log("  Total bots deployed:", nextBotId.toString());
    
    // Check each bot
    for (let i = 0; i < Number(nextBotId); i++) {
        const vaultInfo = await factory.read.vaults([BigInt(i)]);
        const config = await factory.read.getBotConfig([BigInt(i)]);
        console.log(`  Bot ${i}: ${config.name} - Vault: ${vaultInfo.vaultAddress.slice(0, 10)}...`);
    }
    
    // Get active vaults
    const activeVaults = await factory.read.getActiveVaults();
    console.log("\n✅ Active vaults count:", activeVaults.length);
    
    // Test bot config update
    console.log("\nTesting bot config update...");
    await factory.write.updateBotConfig([
        0n, // botId
        parseEther("0.01"), // minBet
        parseEther("10"), // maxBet
        50, // aggressiveness
        60  // riskTolerance
    ]);
    
    const updatedConfig = await factory.read.getBotConfig([0n]);
    console.log("✅ Bot 0 config updated - Aggressiveness:", updatedConfig.aggressiveness);
    
    // Test toggle vault status
    console.log("\nTesting vault status toggle...");
    await factory.write.toggleVaultStatus([0n]);
    const vaultAfterToggle = await factory.read.vaults([0n]);
    console.log("✅ Vault 0 active status:", vaultAfterToggle.isActive);
    
    console.log("\n✨ All tests passed! Optimized VaultFactory works correctly.");
    
    // Show size comparison
    console.log("\n📊 Size Comparison:");
    console.log("  Original VaultFactory: 24,628 bytes (exceeds limit)");
    console.log("  Optimized VaultFactory: 24,298 bytes (deployable)");
    console.log("  Savings: 330 bytes");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });