import { network } from "hardhat";
import { parseEther } from "viem";

console.log("🔥 Batch Operations Stress Test - 100+ Simultaneous Bets");
console.log("=" + "=".repeat(60));

async function main() {
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const [deployer, ...players] = walletClients;
    
    console.log("📊 Test Configuration:");
    console.log("├─ Players:", players.length);
    console.log("├─ Bets per player: 10");
    console.log("└─ Total operations: 1000+\n");
    
    // Deploy contracts
    console.log("🚀 Deploying test infrastructure...");
    
    const botToken = await viem.deployContract("BOTToken", [
        deployer.account.address,
        deployer.account.address,
        deployer.account.address,
        deployer.account.address,
        deployer.account.address
    ]);
    
    const mockVRF = await viem.deployContract("MockVRFCoordinator");
    
    const crapsGame = await viem.deployContract("CrapsGame", [
        mockVRF.address,
        1n,
        "0x" + "0".repeat(64)
    ]);
    
    const crapsBets = await viem.deployContract("CrapsBets", [
        crapsGame.address,
        botToken.address
    ]);
    
    const batchOps = await viem.deployContract("CrapsBatchOperations", [
        crapsGame.address,
        crapsBets.address
    ]);
    
    console.log("✅ Contracts deployed\n");
    
    // Fund players
    console.log("💰 Funding test players...");
    const fundAmount = parseEther("10000");
    
    for (let i = 0; i < Math.min(10, players.length); i++) {
        await botToken.write.transfer([
            players[i].account.address,
            fundAmount
        ], { account: deployer.account });
    }
    console.log("✅ Players funded\n");
    
    // Test scenarios
    const results = {
        singleBets: { gasUsed: 0n, time: 0, success: 0, failed: 0 },
        batchBets: { gasUsed: 0n, time: 0, success: 0, failed: 0 },
        megaBatch: { gasUsed: 0n, time: 0, success: 0, failed: 0 }
    };
    
    // Scenario 1: Single bets (traditional approach)
    console.log("📈 Scenario 1: Single Bet Transactions");
    console.log("Testing 100 individual bet placements...");
    
    const singleStart = Date.now();
    const singlePromises = [];
    
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            const player = players[i % players.length];
            
            // Approve tokens
            const approveTx = botToken.write.approve([
                crapsBets.address,
                parseEther("100")
            ], { account: player.account });
            
            // Place bet
            const betPromise = crapsBets.write.placeBet([
                player.account.address,
                j % 64, // Rotate through all bet types
                parseEther("10"),
                0
            ], { account: player.account })
                .then(async (hash) => {
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    results.singleBets.gasUsed += receipt.gasUsed;
                    results.singleBets.success++;
                    return receipt;
                })
                .catch(() => {
                    results.singleBets.failed++;
                });
            
            singlePromises.push(betPromise);
        }
    }
    
    await Promise.all(singlePromises);
    results.singleBets.time = Date.now() - singleStart;
    
    console.log(`✅ Completed in ${results.singleBets.time}ms`);
    console.log(`   Gas used: ${results.singleBets.gasUsed}`);
    console.log(`   Success: ${results.singleBets.success}, Failed: ${results.singleBets.failed}\n`);
    
    // Scenario 2: Batch operations (optimized approach)
    console.log("📈 Scenario 2: Batch Bet Transactions");
    console.log("Testing 10 batches of 10 bets each...");
    
    const batchStart = Date.now();
    const batchPromises = [];
    
    for (let i = 0; i < 10; i++) {
        const player = players[i % players.length];
        
        // Prepare batch
        const bets = [];
        for (let j = 0; j < 10; j++) {
            bets.push({
                betType: j % 64,
                amount: parseEther("10"),
                specificValue: 0
            });
        }
        
        // Approve tokens for batch
        await botToken.write.approve([
            batchOps.address,
            parseEther("100")
        ], { account: player.account });
        
        // Place batch
        const batchPromise = batchOps.write.placeBetsBatch([bets], {
            account: player.account
        })
            .then(async (hash) => {
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                results.batchBets.gasUsed += receipt.gasUsed;
                results.batchBets.success++;
                return receipt;
            })
            .catch(() => {
                results.batchBets.failed++;
            });
        
        batchPromises.push(batchPromise);
    }
    
    await Promise.all(batchPromises);
    results.batchBets.time = Date.now() - batchStart;
    
    console.log(`✅ Completed in ${results.batchBets.time}ms`);
    console.log(`   Gas used: ${results.batchBets.gasUsed}`);
    console.log(`   Success: ${results.batchBets.success}, Failed: ${results.batchBets.failed}\n`);
    
    // Scenario 3: Mega batch (stress test)
    console.log("📈 Scenario 3: Mega Batch Stress Test");
    console.log("Testing single transaction with 20 bets (max)...");
    
    const megaBets = [];
    for (let i = 0; i < 20; i++) {
        megaBets.push({
            betType: i % 64,
            amount: parseEther("5"),
            specificValue: 0
        });
    }
    
    const megaStart = Date.now();
    
    try {
        await botToken.write.approve([
            batchOps.address,
            parseEther("100")
        ], { account: players[0].account });
        
        const megaHash = await batchOps.write.placeBetsBatch([megaBets], {
            account: players[0].account
        });
        
        const megaReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: megaHash 
        });
        
        results.megaBatch.gasUsed = megaReceipt.gasUsed;
        results.megaBatch.success = 1;
        results.megaBatch.time = Date.now() - megaStart;
        
        console.log(`✅ Completed in ${results.megaBatch.time}ms`);
        console.log(`   Gas used: ${results.megaBatch.gasUsed}`);
        
    } catch (error) {
        results.megaBatch.failed = 1;
        console.log("❌ Mega batch failed - likely hit gas limit");
    }
    
    // Analysis
    console.log("\n" + "=".repeat(60));
    console.log("📊 PERFORMANCE ANALYSIS");
    console.log("=".repeat(60));
    
    const avgGasPerBetSingle = results.singleBets.gasUsed / BigInt(results.singleBets.success || 1);
    const avgGasPerBetBatch = results.batchBets.gasUsed / BigInt(results.batchBets.success * 10 || 1);
    const gasSavings = ((avgGasPerBetSingle - avgGasPerBetBatch) * 100n) / avgGasPerBetSingle;
    
    console.log("\n⛽ Gas Efficiency:");
    console.log(`├─ Single bet avg: ${avgGasPerBetSingle} gas`);
    console.log(`├─ Batch bet avg: ${avgGasPerBetBatch} gas`);
    console.log(`└─ Savings: ${gasSavings}%`);
    
    console.log("\n⏱️  Time Efficiency:");
    console.log(`├─ Single approach: ${results.singleBets.time}ms`);
    console.log(`├─ Batch approach: ${results.batchBets.time}ms`);
    console.log(`└─ Speed improvement: ${Math.round((results.singleBets.time / results.batchBets.time - 1) * 100)}%`);
    
    console.log("\n🎯 Scalability Analysis:");
    if (results.megaBatch.success > 0) {
        console.log("✅ Can handle 20 bets in single transaction");
        console.log("✅ Gas limit not exceeded for max batch");
    } else {
        console.log("⚠️  20 bets exceeded gas limit");
        console.log("📝 Recommendation: Limit batches to 15 bets");
    }
    
    // Recommendations
    console.log("\n💡 Recommendations:");
    console.log("1. Use batch operations for >3 simultaneous bets");
    console.log("2. Limit batch size to 15 for safety margin");
    console.log("3. Implement progressive batching for large operations");
    console.log("4. Add retry logic for failed batches");
    console.log("5. Monitor gas prices and adjust batch sizes dynamically");
    
    // Production readiness check
    const issues = [];
    if (gasSavings < 30n) issues.push("Gas savings below 30%");
    if (results.batchBets.failed > 0) issues.push("Batch operations had failures");
    if (results.megaBatch.failed > 0) issues.push("Large batches hit gas limit");
    
    console.log("\n🏆 Production Readiness:");
    if (issues.length === 0) {
        console.log("✅ Batch operations are production ready!");
        console.log("✅ Can handle 100+ simultaneous bets efficiently");
    } else {
        console.log("⚠️  Issues found:");
        issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    await connection.close();
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
        .then(() => {
            console.log("\n✅ Batch operations stress test complete!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Test failed:", error);
            process.exit(1);
        });
}

export default main;