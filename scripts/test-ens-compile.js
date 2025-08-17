// Test ENS contract compilation
import hre from "hardhat";

async function testENSCompilation() {
    console.log("🔨 Testing ENS Contract Compilation...");
    
    try {
        // Try to get contract factory for ENS Network Config
        console.log("📚 Testing ENSNetworkConfig compilation...");
        const ENSNetworkConfig = await hre.ethers.getContractFactory("ENSNetworkConfig");
        console.log("✅ ENSNetworkConfig compiles successfully");
        
        // Try to get contract factory for Bot ENS Integration
        console.log("🤖 Testing BotENSIntegration compilation...");
        const BotENSIntegration = await hre.ethers.getContractFactory("BotENSIntegration", {
            libraries: {
                ENSNetworkConfig: "0x1234567890123456789012345678901234567890" // Dummy address for compilation test
            }
        });
        console.log("✅ BotENSIntegration compiles successfully");
        
        console.log("\n🎉 All ENS contracts compile without errors!");
        console.log("\n📋 Contract Summary:");
        console.log("- ENSNetworkConfig: Library for multi-chain ENS addresses");
        console.log("- BotENSIntegration: Main contract for bot ENS names and L2 primary names");
        
        return true;
        
    } catch (error) {
        console.error("❌ Compilation failed:", error.message);
        return false;
    }
}

testENSCompilation()
    .then((success) => {
        if (success) {
            console.log("\n✅ ENS compilation test completed successfully");
            process.exit(0);
        } else {
            console.log("\n❌ ENS compilation test failed");
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error("❌ Test script failed:", error);
        process.exit(1);
    });