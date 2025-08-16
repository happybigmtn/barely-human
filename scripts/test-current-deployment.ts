import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🔍 Testing current deployment addresses...");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        
        // Load current deployment
        const deployment = JSON.parse(fs.readFileSync("./deployments/localhost.json", "utf8"));
        console.log("📍 Current BotManager address:", deployment.contracts.BotManager);
        
        // Test the current BotManager
        const botManagerAddress = deployment.contracts.BotManager as `0x${string}`;
        
        // Check if contract exists
        const bytecode = await publicClient.getBytecode({ address: botManagerAddress });
        console.log(`✅ Contract exists: ${bytecode ? 'YES' : 'NO'}`);
        
        if (bytecode) {
            // Load the compiled artifact
            const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/game/BotManager.sol/BotManager.json", "utf8"));
            
            // Test getPersonality
            const personality = await publicClient.readContract({
                address: botManagerAddress,
                abi: artifact.abi,
                functionName: "getPersonality",
                args: [0]
            });
            
            console.log("✅ Bot 0 personality:", personality);
            console.log("✅ BotManager is working correctly!");
            
            // Test a few more bots
            for (let i = 1; i < 3; i++) {
                const p = await publicClient.readContract({
                    address: botManagerAddress,
                    abi: artifact.abi,
                    functionName: "getPersonality",
                    args: [i]
                });
                console.log(`✅ Bot ${i} personality:`, p);
            }
            
        } else {
            console.log("❌ BotManager contract not found at this address!");
        }
        
        // Also test the old address that CLI is trying to use
        console.log("\n🔍 Testing old address that CLI is using...");
        const oldAddress = "0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6" as `0x${string}`;
        const oldBytecode = await publicClient.getBytecode({ address: oldAddress });
        console.log(`📍 Old address ${oldAddress} exists: ${oldBytecode ? 'YES' : 'NO'}`);
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);