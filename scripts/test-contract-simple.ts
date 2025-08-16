import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🔍 Testing contract with compiled ABI...");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        // Load the compiled artifact for BotManager
        const artifactPath = "./artifacts/contracts/game/BotManager.sol/BotManager.json";
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        
        const deployment = JSON.parse(fs.readFileSync("./deployments/localhost.json", "utf8"));
        const botManagerAddress = deployment.contracts.BotManager as `0x${string}`;
        
        console.log(`📍 BotManager at: ${botManagerAddress}`);
        
        const publicClient = await viem.getPublicClient();
        
        // Try to read totalBots or similar simple function
        const simpleFunctions = ["totalBots", "sessionNumber"];
        
        for (const funcName of simpleFunctions) {
            try {
                const result = await publicClient.readContract({
                    address: botManagerAddress,
                    abi: artifact.abi,
                    functionName: funcName
                });
                console.log(`✅ ${funcName}:`, result);
            } catch (error) {
                console.log(`❌ ${funcName} failed:`, error.message.split('\n')[0]);
            }
        }
        
        // Try getPersonality with real ABI
        try {
            const personality = await publicClient.readContract({
                address: botManagerAddress,
                abi: artifact.abi,
                functionName: "getPersonality",
                args: [0]
            });
            console.log("✅ Bot 0 personality:", personality);
        } catch (error) {
            console.log("❌ getPersonality failed:", error.message.split('\n')[0]);
            
            // Maybe it's not initialized - check if we can call initializeBots
            const walletClients = await viem.getWalletClients();
            const deployer = walletClients[0];
            
            try {
                console.log("🔧 Trying to initialize bots...");
                const hash = await deployer.writeContract({
                    address: botManagerAddress,
                    abi: artifact.abi,
                    functionName: "initializeBots"
                });
                
                console.log("⏳ Waiting for transaction:", hash);
                await publicClient.waitForTransactionReceipt({ hash });
                console.log("✅ Bots initialized!");
                
                // Try getPersonality again
                const personalityAfter = await publicClient.readContract({
                    address: botManagerAddress,
                    abi: artifact.abi,
                    functionName: "getPersonality",
                    args: [0]
                });
                console.log("✅ Bot 0 personality after init:", personalityAfter);
                
            } catch (initError) {
                console.log("❌ Initialize failed:", initError.message.split('\n')[0]);
            }
        }
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);