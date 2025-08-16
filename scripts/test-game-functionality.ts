import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🎲 Testing Game Functionality...");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const deployer = walletClients[0];
        
        // Load deployment
        const deployment = JSON.parse(fs.readFileSync("./deployments/localhost.json", "utf8"));
        const crapsGameAddress = deployment.contracts.CrapsGame as `0x${string}`;
        
        console.log(`📍 CrapsGame: ${crapsGameAddress}`);
        console.log(`📍 Testing with player: ${deployer.account.address}`);
        
        // Load the compiled artifact
        const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/game/CrapsGame.sol/CrapsGame.json", "utf8"));
        
        // Test 1: Check current game state
        console.log("\n1. Checking game state...");
        const currentPhase = await publicClient.readContract({
            address: crapsGameAddress,
            abi: artifact.abi,
            functionName: "currentPhase"
        });
        console.log(`   Current phase: ${currentPhase} (0=IDLE, 1=COME_OUT, 2=POINT)`);
        
        // Test 2: Try to start a new series
        console.log("\n2. Starting new game series...");
        try {
            const hash = await deployer.writeContract({
                address: crapsGameAddress,
                abi: artifact.abi,
                functionName: "startNewSeries",
                args: [deployer.account.address]
            });
            
            console.log(`   Transaction hash: ${hash}`);
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ Series started successfully! Block: ${receipt.blockNumber}`);
            
            // Check new state
            const newPhase = await publicClient.readContract({
                address: crapsGameAddress,
                abi: artifact.abi,
                functionName: "currentPhase"
            });
            console.log(`   New phase: ${newPhase}`);
            
            const seriesId = await publicClient.readContract({
                address: crapsGameAddress,
                abi: artifact.abi,
                functionName: "currentSeriesId"
            });
            console.log(`   Series ID: ${seriesId}`);
            
        } catch (error) {
            console.log(`   ❌ Failed to start series: ${error.message}`);
            console.log("\n🔍 Debugging - let's check what's missing...");
            
            // Check if contracts are properly configured
            try {
                const betsContract = await publicClient.readContract({
                    address: crapsGameAddress,
                    abi: artifact.abi,
                    functionName: "betsContract"
                });
                console.log(`   Bets contract: ${betsContract}`);
                
                const settlementContract = await publicClient.readContract({
                    address: crapsGameAddress,
                    abi: artifact.abi,
                    functionName: "settlementContract"
                });
                console.log(`   Settlement contract: ${settlementContract}`);
                
            } catch (configError) {
                console.log(`   ❌ Config check failed: ${configError.message}`);
            }
        }
        
        console.log("\n🎮 Game functionality test complete!");
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);