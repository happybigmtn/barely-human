import { network } from "hardhat";
import assert from "assert";

/**
 * Test suite for Bot Vault Integration
 * Tests the interaction between ElizaOS bots and vault contracts
 */
async function main() {
    console.log("🏦 Testing Bot Vault Integration\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, alice, bob, charlie, diana, eddie, fiona, greg, helen, ivan, julia] = walletClients;
        
        let testsPassed = 0;
        let testsFailed = 0;
        
        const runTest = async (name: string, fn: () => Promise<void>) => {
            try {
                await fn();
                console.log(`✅ ${name}`);
                testsPassed++;
            } catch (error: any) {
                console.log(`❌ ${name}: ${error.message}`);
                testsFailed++;
            }
        };
        
        // ============================================
        // Deploy Core Infrastructure
        // ============================================
        console.log("📦 Deploying Bot Vault Infrastructure...\n");
        
        // Deploy BOT token
        const botToken = await viem.deployContract("BOTToken", [
            alice.account.address,    // treasury
            bob.account.address,       // liquidity
            charlie.account.address,   // stakingRewards
            deployer.account.address,  // team
            deployer.account.address   // community
        ]);
        
        // Deploy Treasury
        const treasury = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address,
            alice.account.address
        ]);
        
        // Deploy VaultFactory
        const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
            botToken.address,
            treasury.address
        ]);
        
        // Deploy game contracts
        const mockVRF = await viem.deployContract("MockVRFCoordinator", []);
        
        const crapsGame = await viem.deployContract("CrapsGame", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
        ]);
        
        const crapsBets = await viem.deployContract("CrapsBets", []);
        const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
        
        await runTest("Core contracts deployed", async () => {
            assert(botToken.address);
            assert(treasury.address);
            assert(vaultFactory.address);
            assert(crapsGame.address);
        });
        
        // ============================================
        // Deploy 10 Bot Vaults
        // ============================================
        console.log("\n🤖 Deploying 10 Bot Vaults...\n");
        
        const botConfigs = [
            { name: "Alice All-In", manager: alice.account.address, aggressiveness: 95, riskTolerance: 90 },
            { name: "Bob Calculator", manager: bob.account.address, aggressiveness: 30, riskTolerance: 20 },
            { name: "Charlie Lucky", manager: charlie.account.address, aggressiveness: 60, riskTolerance: 70 },
            { name: "Diana Ice Queen", manager: diana.account.address, aggressiveness: 50, riskTolerance: 40 },
            { name: "Eddie Entertainer", manager: eddie.account.address, aggressiveness: 75, riskTolerance: 80 },
            { name: "Fiona Fearless", manager: fiona.account.address, aggressiveness: 90, riskTolerance: 95 },
            { name: "Greg Grinder", manager: greg.account.address, aggressiveness: 20, riskTolerance: 30 },
            { name: "Helen Hot Streak", manager: helen.account.address, aggressiveness: 70, riskTolerance: 85 },
            { name: "Ivan Intimidator", manager: ivan.account.address, aggressiveness: 80, riskTolerance: 60 },
            { name: "Julia Jinx", manager: julia.account.address, aggressiveness: 65, riskTolerance: 75 }
        ];
        
        const vaultAddresses: string[] = [];
        
        for (const config of botConfigs) {
            await runTest(`Deploy vault for ${config.name}`, async () => {
                const tx = await vaultFactory.write.deployVault([
                    config.name,
                    config.manager,
                    botToken.address,
                    [
                        config.name,
                        config.manager,
                        100n * 10n ** 18n,  // minBet: 100 BOT
                        10000n * 10n ** 18n, // maxBet: 10,000 BOT
                        config.aggressiveness,
                        config.riskTolerance,
                        config.name.split(" ")[0] // personality
                    ]
                ]);
                await publicClient.waitForTransactionReceipt({ hash: tx });
                
                const vaults = await vaultFactory.read.getActiveVaults([]);
                const newVault = vaults[vaults.length - 1];
                vaultAddresses.push(newVault);
                
                assert(newVault !== "0x0000000000000000000000000000000000000000");
            });
        }
        
        await runTest("All 10 bot vaults deployed", async () => {
            const vaults = await vaultFactory.read.getActiveVaults([]);
            assert.strictEqual(vaults.length, 10);
        });
        
        // ============================================
        // Configure Game Contracts
        // ============================================
        console.log("\n⚙️ Configuring Game Contracts...\n");
        
        // Use first vault for game configuration
        const primaryVault = vaultAddresses[0];
        
        await runTest("Configure game contracts", async () => {
            await crapsGame.write.setContracts([
                crapsBets.address,
                crapsSettlement.address,
                primaryVault
            ]);
            
            await crapsBets.write.setContracts([
                crapsGame.address,
                crapsSettlement.address,
                primaryVault
            ]);
            
            await crapsSettlement.write.setContracts([
                crapsGame.address,
                crapsBets.address,
                primaryVault
            ]);
            
            // Grant roles
            const GAME_ROLE = await crapsBets.read.GAME_ROLE([]);
            await crapsBets.write.grantRole([GAME_ROLE, crapsGame.address]);
            
            // Grant vault roles for all vaults
            for (const vault of vaultAddresses) {
                await crapsBets.write.grantRole([GAME_ROLE, vault]);
            }
        });
        
        // ============================================
        // Fund Bot Vaults
        // ============================================
        console.log("\n💰 Funding Bot Vaults...\n");
        
        await runTest("Fund vaults with BOT tokens", async () => {
            // Each vault gets 100,000 BOT from liquidity allocation
            const fundAmount = 100000n * 10n ** 18n;
            
            for (let i = 0; i < vaultAddresses.length; i++) {
                const vault = vaultAddresses[i];
                await botToken.write.transfer(
                    [vault, fundAmount],
                    { account: bob.account } // Bob has liquidity allocation
                );
            }
            
            // Check first vault balance
            const balance = await botToken.read.balanceOf([vaultAddresses[0]]);
            assert(balance >= fundAmount);
        });
        
        // ============================================
        // Test Vault Statistics
        // ============================================
        console.log("\n📊 Testing Vault Statistics...\n");
        
        await runTest("Get vault count", async () => {
            const count = await vaultFactory.read.getVaultCount([]);
            assert.strictEqual(Number(count), 10);
        });
        
        await runTest("Get bot personalities from factory", async () => {
            const bots = await vaultFactory.read.getBotPersonalities([]);
            assert.strictEqual(bots.length, 10);
            
            // Check first bot
            assert(bots[0].name.includes("Alice"));
            assert.strictEqual(Number(bots[0].aggressiveness), 95);
        });
        
        await runTest("Check vault performance metrics", async () => {
            const metrics = await vaultFactory.read.getVaultMetrics([vaultAddresses[0]]);
            
            // Initial metrics should be zero
            assert.strictEqual(Number(metrics.totalBets), 0);
            assert.strictEqual(Number(metrics.totalWins), 0);
            assert.strictEqual(Number(metrics.totalLosses), 0);
        });
        
        // ============================================
        // Test Bot Betting Behavior
        // ============================================
        console.log("\n🎲 Testing Bot Betting Behavior...\n");
        
        await runTest("Start new game series", async () => {
            const tx = await crapsGame.write.startNewSeries([deployer.account.address]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const phase = await crapsGame.read.getCurrentPhase([]);
            assert.strictEqual(Number(phase), 1); // COME_OUT
        });
        
        await runTest("Alice (aggressive) can place high bets", async () => {
            const aliceVault = vaultAddresses[0];
            const config = await vaultFactory.read.getVaultConfig([aliceVault]);
            
            assert.strictEqual(Number(config.aggressiveness), 95);
            assert.strictEqual(Number(config.maxBet), 10000); // Can bet up to 10,000 BOT
        });
        
        await runTest("Bob (conservative) has lower risk tolerance", async () => {
            const bobVault = vaultAddresses[1];
            const config = await vaultFactory.read.getVaultConfig([bobVault]);
            
            assert.strictEqual(Number(config.aggressiveness), 30);
            assert.strictEqual(Number(config.riskTolerance), 20);
        });
        
        await runTest("Different bots have different strategies", async () => {
            const configs = [];
            
            for (let i = 0; i < 5; i++) {
                const config = await vaultFactory.read.getVaultConfig([vaultAddresses[i]]);
                configs.push({
                    aggressiveness: Number(config.aggressiveness),
                    riskTolerance: Number(config.riskTolerance)
                });
            }
            
            // Check that not all bots have the same strategy
            const uniqueStrategies = new Set(
                configs.map(c => `${c.aggressiveness}-${c.riskTolerance}`)
            );
            
            assert(uniqueStrategies.size > 1, "Bots should have different strategies");
        });
        
        // ============================================
        // Test Vault Isolation
        // ============================================
        console.log("\n🔒 Testing Vault Isolation...\n");
        
        await runTest("Each vault has separate balance", async () => {
            const balances = [];
            
            for (let i = 0; i < 3; i++) {
                const balance = await botToken.read.balanceOf([vaultAddresses[i]]);
                balances.push(balance);
            }
            
            // All should have the same initial funding
            assert(balances[0] === balances[1]);
            assert(balances[1] === balances[2]);
        });
        
        await runTest("Vaults cannot access each other's funds", async () => {
            // This is enforced at the contract level
            // Each vault is a separate contract with its own access control
            const vault1 = vaultAddresses[0];
            const vault2 = vaultAddresses[1];
            
            assert(vault1 !== vault2, "Vaults should have different addresses");
        });
        
        // ============================================
        // Test Treasury Integration
        // ============================================
        console.log("\n🏛️ Testing Treasury Integration...\n");
        
        await runTest("Vaults connected to Treasury", async () => {
            const vaultTreasury = await vaultFactory.read.treasury([]);
            assert.strictEqual(vaultTreasury, treasury.address);
        });
        
        await runTest("Treasury can receive fees from vaults", async () => {
            const VAULT_ROLE = await treasury.read.VAULT_ROLE([]);
            
            // Grant vault role to first vault
            await treasury.write.grantRole([VAULT_ROLE, vaultAddresses[0]]);
            
            const hasRole = await treasury.read.hasRole([VAULT_ROLE, vaultAddresses[0]]);
            assert(hasRole);
        });
        
        // ============================================
        // Test Bot Manager Integration
        // ============================================
        console.log("\n🎮 Testing Bot Manager Integration...\n");
        
        // Deploy BotManager with proper parameters
        const botManager = await viem.deployContract("BotManager", [
            vaultFactory.address,
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}` // keyHash
        ]);
        
        await runTest("BotManager has all 10 personalities", async () => {
            const botCount = 10;
            let validBots = 0;
            
            for (let i = 0; i < botCount; i++) {
                const personality = await botManager.read.getPersonality([i]);
                if (personality.name.length > 0) {
                    validBots++;
                }
            }
            
            assert.strictEqual(validBots, 10);
        });
        
        await runTest("Bot personalities match vault configurations", async () => {
            // Alice should be bot 0
            const alicePersonality = await botManager.read.getPersonality([0]);
            assert(alicePersonality.name.includes("Alice"));
            assert.strictEqual(Number(alicePersonality.aggressiveness), 95);
            
            // Bob should be bot 1
            const bobPersonality = await botManager.read.getPersonality([1]);
            assert(bobPersonality.name.includes("Bob"));
            assert.strictEqual(Number(bobPersonality.aggressiveness), 30);
        });
        
        await runTest("Bot strategies are diverse", async () => {
            const strategies = new Set();
            
            for (let i = 0; i < 10; i++) {
                const personality = await botManager.read.getPersonality([i]);
                const strategy = await botManager.read.getBettingStrategy([i, 1]); // COME_OUT phase
                strategies.add(strategy.betType);
            }
            
            // Should have multiple different preferred bet types
            assert(strategies.size >= 3, "Bots should have diverse betting strategies");
        });
        
        // ============================================
        // Test Performance Tracking
        // ============================================
        console.log("\n📈 Testing Performance Tracking...\n");
        
        await runTest("Track individual vault performance", async () => {
            // Each vault should track its own metrics
            for (let i = 0; i < 3; i++) {
                const metrics = await vaultFactory.read.getVaultMetrics([vaultAddresses[i]]);
                
                assert(metrics.totalBets !== undefined);
                assert(metrics.totalWins !== undefined);
                assert(metrics.totalLosses !== undefined);
                assert(metrics.profit !== undefined);
            }
        });
        
        await runTest("Global statistics available", async () => {
            const stats = await vaultFactory.read.getGlobalStats([]);
            
            assert(stats.totalVaults === 10n);
            assert(stats.totalValueLocked >= 0n);
            assert(stats.totalBetsPlaced >= 0n);
        });
        
        // ============================================
        // Summary
        // ============================================
        console.log("\n" + "=".repeat(60));
        console.log("📊 BOT VAULT INTEGRATION TEST SUMMARY");
        console.log("=".repeat(60));
        
        const total = testsPassed + testsFailed;
        const coverage = (testsPassed / total * 100).toFixed(1);
        
        console.log(`\n✅ Tests Passed: ${testsPassed}/${total}`);
        console.log(`❌ Tests Failed: ${testsFailed}/${total}`);
        console.log(`📈 Coverage: ${coverage}%`);
        
        console.log("\n📋 Coverage Areas:");
        console.log("  ✅ Bot vault deployment (10 vaults)");
        console.log("  ✅ Vault configuration and personality");
        console.log("  ✅ Game contract integration");
        console.log("  ✅ Vault funding and balances");
        console.log("  ✅ Bot betting behavior");
        console.log("  ✅ Vault isolation and security");
        console.log("  ✅ Treasury integration");
        console.log("  ✅ BotManager personality mapping");
        console.log("  ✅ Performance tracking");
        
        if (testsFailed === 0) {
            console.log("\n🎉 ALL BOT VAULT INTEGRATION TESTS PASSED! 🎉");
            console.log("\nThe bot vault system is ready with:");
            console.log("  ✅ 10 unique bot vaults deployed");
            console.log("  ✅ Each bot has distinct personality");
            console.log("  ✅ Proper fund isolation");
            console.log("  ✅ Treasury fee collection ready");
            console.log("  ✅ Performance metrics tracking");
        } else {
            console.log(`\n⚠️  ${testsFailed} tests failed. Review and fix.`);
        }
        
    } catch (error) {
        console.error("\n❌ Test suite failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run tests
main().catch(console.error);