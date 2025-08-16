import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🔍 Debugging BotManager contract...");
    
    // Load deployment info
    const deploymentPath = "/home/r/Coding/Hackathon/deployments/localhost.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const botManagerAddress = deployment.contracts.BotManager as `0x${string}`;
        
        console.log(`📍 BotManager at: ${botManagerAddress}`);
        
        // Test getPersonality for bot 0
        try {
            const personality = await publicClient.readContract({
                address: botManagerAddress,
                abi: [
                    {
                        name: "getPersonality",
                        type: "function",
                        stateMutability: "view",
                        inputs: [{ name: "botId", type: "uint8" }],
                        outputs: [
                            { name: "aggressiveness", type: "uint8" },
                            { name: "riskTolerance", type: "uint8" },
                            { name: "patience", type: "uint8" },
                            { name: "adaptability", type: "uint8" },
                            { name: "confidence", type: "uint8" },
                            { name: "strategy", type: "uint8" },
                            { name: "description", type: "string" }
                        ]
                    }
                ],
                functionName: "getPersonality",
                args: [0]
            });
            
            console.log("✅ Bot 0 personality:", personality);
        } catch (error) {
            console.log("❌ Failed to read bot 0 personality:", error.message);
            
            // Check if bots are initialized
            try {
                const isInitialized = await publicClient.readContract({
                    address: botManagerAddress,
                    abi: [
                        {
                            name: "botsInitialized",
                            type: "function",
                            stateMutability: "view",
                            inputs: [],
                            outputs: [{ name: "", type: "bool" }]
                        }
                    ],
                    functionName: "botsInitialized"
                });
                
                console.log("🤖 Bots initialized:", isInitialized);
                
                if (!isInitialized) {
                    console.log("🔧 Need to initialize bots!");
                    
                    const walletClients = await viem.getWalletClients();
                    const deployer = walletClients[0];
                    
                    console.log("📝 Calling initializeBots()...");
                    const hash = await deployer.writeContract({
                        address: botManagerAddress,
                        abi: [
                            {
                                name: "initializeBots",
                                type: "function",
                                stateMutability: "nonpayable",
                                inputs: []
                            }
                        ],
                        functionName: "initializeBots"
                    });
                    
                    console.log("⏳ Waiting for transaction:", hash);
                    await publicClient.waitForTransactionReceipt({ hash });
                    console.log("✅ Bots initialized successfully!");
                    
                    // Test again
                    const personalityAfter = await publicClient.readContract({
                        address: botManagerAddress,
                        abi: [
                            {
                                name: "getPersonality",
                                type: "function",
                                stateMutability: "view",
                                inputs: [{ name: "botId", type: "uint8" }],
                                outputs: [
                                    { name: "aggressiveness", type: "uint8" },
                                    { name: "riskTolerance", type: "uint8" },
                                    { name: "patience", type: "uint8" },
                                    { name: "adaptability", type: "uint8" },
                                    { name: "confidence", type: "uint8" },
                                    { name: "strategy", type: "uint8" },
                                    { name: "description", type: "string" }
                                ]
                            }
                        ],
                        functionName: "getPersonality",
                        args: [0]
                    });
                    
                    console.log("✅ Bot 0 personality after init:", personalityAfter);
                }
                
            } catch (initError) {
                console.log("❌ Failed to check initialization:", initError.message);
            }
        }
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);