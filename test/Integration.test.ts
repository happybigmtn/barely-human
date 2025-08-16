import { network } from "hardhat";
import assert from "assert";

/**
 * Integration test suite for the complete Craps game system
 * Tests contract deployment, configuration, and basic game operations
 */
async function main() {
    console.log("🎲 Running Integration Tests\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, alice, bob, charlie] = walletClients;
        
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
        // Deploy Core Contracts
        // ============================================
        console.log("📦 Deploying Core Contracts...\n");
        
        // Deploy BOT token
        const botToken = await viem.deployContract("BOTToken", [
            alice.account.address,    // treasury
            bob.account.address,       // liquidity
            charlie.account.address,   // stakingRewards
            deployer.account.address,  // team
            deployer.account.address   // community
        ]);
        
        await runTest("BOT Token deployed with correct supply", async () => {
            assert(botToken.address);
            const totalSupply = await botToken.read.totalSupply([]);
            assert.strictEqual(totalSupply, 10n ** 9n * 10n ** 18n);
        });
        
        // Deploy Treasury
        const treasury = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address,  // developmentWallet
            alice.account.address       // insuranceWallet
        ]);
        
        await runTest("Treasury deployed", async () => {
            assert(treasury.address);
        });
        
        // Deploy StakingPool
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,  // stakingToken
            botToken.address,  // rewardToken (same as staking)
            treasury.address   // treasury
        ]);
        
        await runTest("StakingPool deployed", async () => {
            assert(stakingPool.address);
        });
        
        // Deploy VaultFactory
        const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
            botToken.address,
            treasury.address
        ]);
        
        await runTest("VaultFactory deployed", async () => {
            assert(vaultFactory.address);
        });
        
        // Deploy mock VRF for testing
        const mockVRF = await viem.deployContract("MockVRFCoordinator", []);
        
        await runTest("Mock VRF deployed", async () => {
            assert(mockVRF.address);
        });
        
        // Deploy game contracts
        const crapsGame = await viem.deployContract("CrapsGame", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}` // keyHash
        ]);
        
        await runTest("CrapsGame deployed", async () => {
            assert(crapsGame.address);
        });
        
        const crapsBets = await viem.deployContract("CrapsBets", []);
        
        await runTest("CrapsBets deployed", async () => {
            assert(crapsBets.address);
        });
        
        const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
        
        await runTest("CrapsSettlement deployed", async () => {
            assert(crapsSettlement.address);
        });
        
        // Create a test vault to use
        await runTest("Deploy test vault", async () => {
            const tx = await vaultFactory.write.deployVault([
                "Test Vault",
                deployer.account.address,
                botToken.address,
                [
                    "Test Vault",              // name
                    deployer.account.address,  // manager
                    100n,                      // minBet (uint256)
                    10000n,                    // maxBet (uint256)
                    50,                        // aggressiveness (uint8)
                    50,                        // riskTolerance (uint8)
                    "Conservative"             // personality (string)
                ]
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
        });
        
        // Get the deployed vault address
        const vaults = await vaultFactory.read.getActiveVaults([]);
        const vaultAddress = vaults[0];
        
        // ============================================
        // Configure Contracts
        // ============================================
        console.log("\n⚙️ Configuring Contracts...\n");
        
        await runTest("Configure Treasury distribution", async () => {
            // Treasury uses basis points (10000 = 100%)
            const tx = await treasury.write.setDistribution([
                5000, // staking 50%
                2000, // buyback 20%
                1500, // dev 15%
                1500  // insurance 15%
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            // Public variables need empty array in Viem
            const stakingPct = await treasury.read.stakingRewardsPct([]);
            assert.strictEqual(Number(stakingPct), 5000);
        });
        
        await runTest("Configure CrapsGame contracts", async () => {
            const tx = await crapsGame.write.setContracts([
                crapsBets.address,
                crapsSettlement.address,
                vaultAddress
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
        });
        
        await runTest("Configure CrapsSettlement contracts", async () => {
            const tx = await crapsSettlement.write.setContracts([
                crapsGame.address,
                crapsBets.address,
                vaultAddress
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
        });
        
        await runTest("Configure CrapsBets contracts", async () => {
            const tx = await crapsBets.write.setContracts([
                crapsGame.address,
                crapsSettlement.address,
                vaultAddress
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
        });
        
        await runTest("Grant GAME_ROLE to CrapsGame", async () => {
            const GAME_ROLE = await crapsBets.read.GAME_ROLE([]);
            const tx = await crapsBets.write.grantRole([GAME_ROLE, crapsGame.address]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const hasRole = await crapsBets.read.hasRole([GAME_ROLE, crapsGame.address]);
            assert(hasRole);
        });
        
        await runTest("Grant SETTLEMENT_ROLE to CrapsSettlement", async () => {
            const SETTLEMENT_ROLE = await crapsGame.read.SETTLEMENT_ROLE([]);
            const tx = await crapsGame.write.grantRole([SETTLEMENT_ROLE, crapsSettlement.address]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
        });
        
        // ============================================
        // Test Game Operations
        // ============================================
        console.log("\n🎮 Testing Game Operations...\n");
        
        await runTest("Start new game series", async () => {
            const tx = await crapsGame.write.startNewSeries([deployer.account.address]);
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const phase = await crapsGame.read.getCurrentPhase([]);
            assert.strictEqual(Number(phase), 1); // COME_OUT
        });
        
        await runTest("Game is active", async () => {
            const isActive = await crapsGame.read.isGameActive([]);
            assert(isActive);
        });
        
        // ============================================
        // Test Bet Validation
        // ============================================
        console.log("\n🎰 Testing Bet Validation...\n");
        
        await runTest("Validate Pass Line bet (type 0)", async () => {
            const isValid = await crapsGame.read.isBetTypeValid([0]);
            assert(isValid);
        });
        
        await runTest("Validate Field bet (type 4)", async () => {
            const isValid = await crapsGame.read.isBetTypeValid([4]);
            assert(isValid);
        });
        
        await runTest("Validate all 64 bet types", async () => {
            let validCount = 0;
            for (let i = 0; i < 64; i++) {
                const isValid = await crapsGame.read.isBetTypeValid([i]);
                if (isValid) validCount++;
            }
            assert.strictEqual(validCount, 64);
        });
        
        await runTest("Can place Pass Line in come-out phase", async () => {
            const canPlace = await crapsGame.read.canPlaceBet([0]);
            assert(canPlace);
        });
        
        await runTest("Cannot place Come bet in come-out phase", async () => {
            const canPlace = await crapsGame.read.canPlaceBet([2]);
            assert(!canPlace);
        });
        
        // ============================================
        // Test Payout Calculations
        // ============================================
        console.log("\n💰 Testing Payout Calculations...\n");
        
        await runTest("Field bet payout for 2 (2:1)", async () => {
            const payout = await crapsSettlement.read.getFieldPayout([2]);
            assert.strictEqual(Number(payout), 200);
        });
        
        await runTest("Field bet payout for 12 (3:1)", async () => {
            const payout = await crapsSettlement.read.getFieldPayout([12]);
            assert.strictEqual(Number(payout), 300);
        });
        
        await runTest("Field bet payout for 7 (loss)", async () => {
            const payout = await crapsSettlement.read.getFieldPayout([7]);
            assert.strictEqual(Number(payout), 0);
        });
        
        await runTest("Hardway detection for 2+2=4", async () => {
            const isHard = await crapsSettlement.read.isHardway([2, 2, 4]);
            assert(isHard);
        });
        
        await runTest("Hardway detection for 1+3=4 (not hard)", async () => {
            const isHard = await crapsSettlement.read.isHardway([1, 3, 4]);
            assert(!isHard);
        });
        
        await runTest("Pass Line payout calculation (1:1)", async () => {
            const payout = await crapsSettlement.read.calculatePayout([0, 1000n, 0]);
            assert.strictEqual(payout, 2000n);
        });
        
        await runTest("Pass Odds payout for point 4 (2:1)", async () => {
            const payout = await crapsSettlement.read.calculatePayout([29, 1000n, 4]);
            assert.strictEqual(payout, 3000n);
        });
        
        await runTest("Pass Odds payout for point 6 (6:5)", async () => {
            const payout = await crapsSettlement.read.calculatePayout([29, 1000n, 6]);
            assert.strictEqual(payout, 2200n);
        });
        
        // ============================================
        // Test Token Operations
        // ============================================
        console.log("\n🪙 Testing Token Operations...\n");
        
        await runTest("Treasury has correct BOT allocation", async () => {
            const balance = await botToken.read.balanceOf([alice.account.address]);
            assert.strictEqual(balance, 200_000_000n * 10n ** 18n);
        });
        
        await runTest("Transfer BOT tokens", async () => {
            const amount = 1000n * 10n ** 18n;
            const tx = await botToken.write.transfer(
                [deployer.account.address, amount],
                { account: alice.account }
            );
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const balance = await botToken.read.balanceOf([deployer.account.address]);
            assert(balance >= amount);
        });
        
        await runTest("Approve and stake tokens", async () => {
            const stakeAmount = 100n * 10n ** 18n;
            
            // Approve staking pool
            const tx1 = await botToken.write.approve(
                [stakingPool.address, stakeAmount],
                { account: deployer.account }
            );
            await publicClient.waitForTransactionReceipt({ hash: tx1 });
            
            // Stake
            const tx2 = await stakingPool.write.stake(
                [stakeAmount],
                { account: deployer.account }
            );
            await publicClient.waitForTransactionReceipt({ hash: tx2 });
            
            const staked = await stakingPool.read.balanceOf([deployer.account.address]);
            assert.strictEqual(staked, stakeAmount);
        });
        
        // ============================================
        // Summary
        // ============================================
        console.log("\n" + "=".repeat(60));
        console.log("📊 INTEGRATION TEST SUMMARY");
        console.log("=".repeat(60));
        
        const total = testsPassed + testsFailed;
        const coverage = (testsPassed / total * 100).toFixed(1);
        
        console.log(`\n✅ Tests Passed: ${testsPassed}/${total}`);
        console.log(`❌ Tests Failed: ${testsFailed}/${total}`);
        console.log(`📈 Coverage: ${coverage}%`);
        
        if (testsFailed === 0) {
            console.log("\n🎉 ALL INTEGRATION TESTS PASSED! 🎉");
            console.log("\nThe complete Craps game system is working correctly:");
            console.log("  ✅ All contracts deploy successfully");
            console.log("  ✅ Contract configuration works");
            console.log("  ✅ Role-based access control configured");
            console.log("  ✅ Game operations functional");
            console.log("  ✅ All 64 bet types validated");
            console.log("  ✅ Payout calculations correct");
            console.log("  ✅ Token operations working");
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