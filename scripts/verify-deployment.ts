import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🔍 Verifying contract deployment...");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const deployment = JSON.parse(fs.readFileSync("./deployments/localhost.json", "utf8"));
        const botManagerAddress = deployment.contracts.BotManager as `0x${string}`;
        
        console.log(`📍 BotManager at: ${botManagerAddress}`);
        
        // Get the bytecode at this address
        const bytecode = await publicClient.getBytecode({
            address: botManagerAddress
        });
        
        console.log(`📝 Bytecode exists: ${bytecode ? 'YES' : 'NO'}`);
        console.log(`📏 Bytecode length: ${bytecode ? bytecode.length : 0} characters`);
        
        if (bytecode && bytecode.length > 2) {
            console.log("✅ Contract is deployed!");
            
            // Try to find what functions are actually available by checking selectors
            const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/game/BotManager.sol/BotManager.json", "utf8"));
            
            console.log("\n🔍 Available functions in ABI:");
            const functions = artifact.abi.filter((item: any) => item.type === 'function');
            functions.forEach((func: any) => {
                console.log(`  - ${func.name}(${func.inputs.map((i: any) => i.type).join(', ')})`);
            });
            
            // Try calling a simple function that should always work
            try {
                // Try supportsInterface which should be available due to AccessControl
                const result = await publicClient.readContract({
                    address: botManagerAddress,
                    abi: [
                        {
                            "inputs": [{"name": "interfaceId", "type": "bytes4"}],
                            "name": "supportsInterface",
                            "outputs": [{"name": "", "type": "bool"}],
                            "stateMutability": "view",
                            "type": "function"
                        }
                    ],
                    functionName: "supportsInterface",
                    args: ["0x01ffc9a7"] // ERC165 interface
                });
                console.log(`✅ supportsInterface works: ${result}`);
                
            } catch (error) {
                console.log("❌ supportsInterface failed:", error.message.split('\n')[0]);
            }
            
        } else {
            console.log("❌ No contract deployed at this address!");
        }
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);