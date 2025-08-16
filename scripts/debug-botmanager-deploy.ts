import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🔍 Debug BotManager deployment...");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const deployer = walletClients[0];
        
        console.log(`📍 Deployer: ${deployer.account.address}`);
        
        // Load existing deployment to get addresses
        const deployment = JSON.parse(fs.readFileSync("./deployments/localhost.json", "utf8"));
        const vaultFactoryAddress = deployment.contracts.VaultFactory;
        const mockVRFAddress = deployment.contracts.MockVRF;
        
        console.log(`📍 VaultFactory: ${vaultFactoryAddress}`);
        console.log(`📍 MockVRF: ${mockVRFAddress}`);
        
        // Check if these contracts exist
        const vfBytecode = await publicClient.getBytecode({ address: vaultFactoryAddress as `0x${string}` });
        const vrfBytecode = await publicClient.getBytecode({ address: mockVRFAddress as `0x${string}` });
        
        console.log(`✅ VaultFactory exists: ${vfBytecode ? 'YES' : 'NO'}`);
        console.log(`✅ MockVRF exists: ${vrfBytecode ? 'YES' : 'NO'}`);
        
        if (!vfBytecode || !vrfBytecode) {
            console.log("❌ Required contracts missing!");
            return;
        }
        
        // Try to deploy BotManager
        console.log("\n🚀 Deploying BotManager...");
        try {
            const botManager = await viem.deployContract("BotManager", [
                vaultFactoryAddress as `0x${string}`,
                mockVRFAddress as `0x${string}`,
                1n,
                "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
            ]);
            
            console.log(`✅ BotManager deployed: ${botManager.address}`);
            
            // Check if it actually exists
            const bytecode = await publicClient.getBytecode({ address: botManager.address });
            console.log(`✅ Contract exists: ${bytecode ? 'YES' : 'NO'}`);
            
            if (bytecode) {
                // Try to call initializeBots
                console.log("\n🔧 Initializing bots...");
                const hash = await botManager.write.initializeBots([]);
                await publicClient.waitForTransactionReceipt({ hash });
                console.log("✅ Bots initialized!");
                
                // Test getPersonality
                const personality = await botManager.read.getPersonality([0]);
                console.log("✅ Bot 0 personality:", personality);
            }
            
        } catch (deployError) {
            console.log("❌ BotManager deployment failed:", deployError.message);
            console.log("Full error:", deployError);
        }
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);