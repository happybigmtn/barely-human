import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";

describe("House Edge Rebate System", () => {
    let connection: any;
    let viem: any;
    let botToken: any;
    let houseEdgeRebate: any;
    let volumeTracker: any;
    let treasuryV2: any;
    let tokenDistributor: any;
    let communityFaucet: any;
    let deployer: any;
    let lp1: any;
    let lp2: any;
    let publicClient: any;

    beforeEach(async () => {
        connection = await network.connect();
        viem = connection.viem;
        publicClient = await viem.getPublicClient();
        
        const wallets = await viem.getWalletClients();
        [deployer, lp1, lp2] = wallets;
        
        // Deploy BOTTokenV2
        botToken = await viem.deployContract("BOTTokenV2", [
            deployer.account.address, // liquidity manager
            deployer.account.address, // airdrop distributor  
            deployer.account.address, // community faucet
            deployer.account.address, // artist wallet
            deployer.account.address  // artist giveaway wallet
        ]);
        
        // Deploy HouseEdgeRebate
        houseEdgeRebate = await viem.deployContract("HouseEdgeRebate", [
            botToken.address
        ]);
        
        // Deploy VolumeTracker
        volumeTracker = await viem.deployContract("VolumeTracker", []);
        
        // Deploy TreasuryV2
        treasuryV2 = await viem.deployContract("TreasuryV2", [
            botToken.address,
            deployer.account.address // staking pool
        ]);
        
        // Deploy TokenDistributor
        tokenDistributor = await viem.deployContract("TokenDistributor", [
            botToken.address
        ]);
        
        // Deploy CommunityFaucet
        communityFaucet = await viem.deployContract("CommunityFaucet", [
            botToken.address
        ]);
        
        // Setup roles
        await houseEdgeRebate.write.grantRole([
            await houseEdgeRebate.read.GAME_ROLE(),
            deployer.account.address
        ]);
        
        await houseEdgeRebate.write.grantRole([
            await houseEdgeRebate.read.TREASURY_ROLE(),
            treasuryV2.address
        ]);
        
        await volumeTracker.write.grantRole([
            await volumeTracker.read.GAME_ROLE(),
            deployer.account.address
        ]);
        
        await treasuryV2.write.setRebateContracts([
            houseEdgeRebate.address,
            volumeTracker.address
        ]);
        
        // Set bot wallets for distribution
        for (let i = 0; i < 10; i++) {
            await botToken.write.setBotWallet([BigInt(i), wallets[i + 3].account.address]);
        }
        
        // Execute initial distribution
        await botToken.write.executeInitialDistribution();
        
        // Transfer some BOT to treasury for rebates
        await botToken.write.transfer([treasuryV2.address, parseEther("1000000")]);
    });

    afterEach(async () => {
        await connection.close();
    });

    describe("Token Distribution", () => {
        it("should correctly distribute initial token allocations", async () => {
            const stats = await botToken.read.getDistributionStats();
            
            // Check allocations match specification
            assert.strictEqual(formatEther(stats[0]), "200000000"); // Bot allocation (20%)
            assert.strictEqual(formatEther(stats[1]), "150000000"); // Liquidity (15%)
            assert.strictEqual(formatEther(stats[2]), "100000000"); // Airdrop (10%)
            assert.strictEqual(formatEther(stats[3]), "50000000");  // Faucet (5%)
            assert.strictEqual(formatEther(stats[4]), "166666667"); // Artist retained (16.67%)
            assert.strictEqual(formatEther(stats[5]), "333333333"); // Artist giveaway (33.33%)
        });

        it("should allocate 2% to each bot", async () => {
            for (let i = 0; i < 10; i++) {
                const balance = await botToken.read.getBotBalance([BigInt(i)]);
                assert.strictEqual(formatEther(balance), "20000000"); // 2% each
            }
        });
    });

    describe("Volume Tracking", () => {
        it("should track LP betting volumes", async () => {
            // Record some betting volumes
            await volumeTracker.write.recordBetVolume([
                lp1.account.address,
                0n, // bot 0
                parseEther("1000"),
                false, // loss
                parseEther("25") // house edge
            ]);
            
            await volumeTracker.write.recordBetVolume([
                lp2.account.address,
                0n, // bot 0
                parseEther("500"),
                true, // win
                0n
            ]);
            
            // Check LP stats
            const lp1Stats = await volumeTracker.read.getLPStats([lp1.account.address]);
            assert.strictEqual(formatEther(lp1Stats[0]), "1000"); // total volume
            assert.strictEqual(formatEther(lp1Stats[1]), "1000"); // weekly volume
            
            const lp2Stats = await volumeTracker.read.getLPStats([lp2.account.address]);
            assert.strictEqual(formatEther(lp2Stats[0]), "500"); // total volume
        });

        it("should track bot volumes and house edge", async () => {
            await volumeTracker.write.recordBetVolume([
                lp1.account.address,
                0n,
                parseEther("1000"),
                false,
                parseEther("25")
            ]);
            
            const botStats = await volumeTracker.read.getBotStats([0n]);
            assert.strictEqual(formatEther(botStats[0]), "1000"); // total volume
            assert.strictEqual(formatEther(botStats[1]), "25");   // house edge paid
        });
    });

    describe("House Edge Rebate", () => {
        it("should accumulate house edge for weekly rebates", async () => {
            // Record volume and house edge
            await houseEdgeRebate.write.recordVolume([
                lp1.account.address,
                0n,
                parseEther("10000")
            ]);
            
            await houseEdgeRebate.write.recordVolume([
                lp2.account.address,
                0n,
                parseEther("5000")
            ]);
            
            await houseEdgeRebate.write.accumulateHouseEdge([
                0n,
                parseEther("375") // 2.5% of 15000
            ]);
            
            // Check weekly rebate info
            const weekInfo = await houseEdgeRebate.read.getWeeklyRebateInfo([0n]);
            assert.strictEqual(formatEther(weekInfo[0]), "375");   // total house edge
            assert.strictEqual(formatEther(weekInfo[1]), "15000"); // total volume
        });

        it("should calculate proportional rebates based on volume", async () => {
            // Setup volumes - LP1 has 2x volume of LP2
            await houseEdgeRebate.write.recordVolume([
                lp1.account.address,
                0n,
                parseEther("10000")
            ]);
            
            await houseEdgeRebate.write.recordVolume([
                lp2.account.address,
                0n,
                parseEther("5000")
            ]);
            
            await houseEdgeRebate.write.accumulateHouseEdge([
                0n,
                parseEther("300") // Total house edge
            ]);
            
            // Simulate week passing
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            // Finalize week
            await houseEdgeRebate.write.finalizeWeek([0n]);
            
            // Check pending rebates
            const lp1Rebate = await houseEdgeRebate.read.calculatePendingRebate([lp1.account.address]);
            const lp2Rebate = await houseEdgeRebate.read.calculatePendingRebate([lp2.account.address]);
            
            // LP1 should get 2/3 of rebate (200 BOT)
            // LP2 should get 1/3 of rebate (100 BOT)
            assert.strictEqual(formatEther(lp1Rebate), "200");
            assert.strictEqual(formatEther(lp2Rebate), "100");
        });
    });

    describe("Progressive Rebate Schedule", () => {
        it("should start with 50% rebate and increase weekly", async () => {
            const initialPercent = await treasuryV2.read.getCurrentRebatePercent();
            assert.strictEqual(initialPercent, 50n);
            
            // Simulate 4 weeks passing
            await network.provider.send("evm_increaseTime", [4 * 7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            const afterFourWeeks = await treasuryV2.read.getCurrentRebatePercent();
            // Should be 50% + (4 * 5%) = 70%
            assert.strictEqual(afterFourWeeks, 70n);
            
            // Simulate 10 more weeks
            await network.provider.send("evm_increaseTime", [10 * 7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            const afterManyWeeks = await treasuryV2.read.getCurrentRebatePercent();
            // Should cap at 100%
            assert.strictEqual(afterManyWeeks, 100n);
        });
    });

    describe("Community Faucet", () => {
        it("should allow daily claims with cooldown", async () => {
            // Fund the faucet
            await botToken.write.transfer([communityFaucet.address, parseEther("50000000")]);
            
            // Verify address for testing
            await communityFaucet.write.verifyAddresses([[lp1.account.address]]);
            
            // First claim
            await communityFaucet.write.claim({ account: lp1.account });
            
            const claimInfo = await communityFaucet.read.getClaimInfo([lp1.account.address]);
            assert.strictEqual(formatEther(claimInfo[3]), "1000"); // Total claimed
            assert.strictEqual(claimInfo[2], 9n); // Claims remaining
            
            // Try to claim again immediately (should fail)
            try {
                await communityFaucet.write.claim({ account: lp1.account });
                assert.fail("Should not allow immediate re-claim");
            } catch (error: any) {
                assert(error.message.includes("ClaimCooldownActive"));
            }
        });

        it("should enforce maximum claims per address", async () => {
            await botToken.write.transfer([communityFaucet.address, parseEther("50000000")]);
            await communityFaucet.write.verifyAddresses([[lp1.account.address]]);
            
            // Simulate 10 claims over time
            for (let i = 0; i < 10; i++) {
                await communityFaucet.write.claim({ account: lp1.account });
                await network.provider.send("evm_increaseTime", [24 * 60 * 60]); // 1 day
                await network.provider.send("evm_mine");
            }
            
            const claimInfo = await communityFaucet.read.getClaimInfo([lp1.account.address]);
            assert.strictEqual(claimInfo[2], 0n); // No claims remaining
            assert.strictEqual(formatEther(claimInfo[3]), "10000"); // Total claimed (10 * 1000)
            
            // Try 11th claim (should fail)
            try {
                await communityFaucet.write.claim({ account: lp1.account });
                assert.fail("Should not allow more than 10 claims");
            } catch (error: any) {
                assert(error.message.includes("MaxClaimsReached"));
            }
        });
    });

    describe("Leaderboard Distribution", () => {
        it("should distribute rewards based on competition scores", async () => {
            // Start competition
            await tokenDistributor.write.startCompetition();
            
            // Update scores
            await tokenDistributor.write.updateScore([lp1.account.address, 1000n]);
            await tokenDistributor.write.updateScore([lp2.account.address, 500n]);
            
            // Finalize with rewards
            await tokenDistributor.write.finalizeCompetition([
                [lp1.account.address, lp2.account.address],
                [parseEther("10000"), parseEther("5000")]
            ]);
            
            // Fund distributor
            await botToken.write.transfer([tokenDistributor.address, parseEther("100000000")]);
            
            // Claim rewards
            await tokenDistributor.write.claimReward([1n], { account: lp1.account });
            await tokenDistributor.write.claimReward([1n], { account: lp2.account });
            
            const lp1Balance = await botToken.read.balanceOf([lp1.account.address]);
            const lp2Balance = await botToken.read.balanceOf([lp2.account.address]);
            
            assert.strictEqual(formatEther(lp1Balance), "10000");
            assert.strictEqual(formatEther(lp2Balance), "5000");
        });
    });

    describe("Bot Depletion Tracking", () => {
        it("should track when bots are depleted", async () => {
            await treasuryV2.write.grantRole([
                await treasuryV2.read.VAULT_ROLE(),
                deployer.account.address
            ]);
            
            await treasuryV2.write.grantRole([
                await treasuryV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            // Set initial bot bankroll
            await treasuryV2.write.updateBotBankroll([0n, parseEther("1000")]);
            
            // Collect house edge that depletes the bot
            await treasuryV2.write.collectHouseEdge([
                0n,
                parseEther("1000"),
                parseEther("40000"),
                lp1.account.address
            ]);
            
            const botStatus = await treasuryV2.read.getBotStatus([0n]);
            assert.strictEqual(botStatus[2], true); // isDepleted
        });
    });

    describe("End-to-End Token Flow", () => {
        it("should demonstrate token flow from bots to LPs via rebates", async () => {
            // Setup roles
            await treasuryV2.write.grantRole([
                await treasuryV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            await treasuryV2.write.grantRole([
                await treasuryV2.read.OPERATOR_ROLE(),
                deployer.account.address
            ]);
            
            // Record betting activity
            await houseEdgeRebate.write.recordVolume([
                lp1.account.address,
                0n,
                parseEther("100000")
            ]);
            
            await houseEdgeRebate.write.accumulateHouseEdge([
                0n,
                parseEther("2500") // 2.5% house edge
            ]);
            
            // Advance time one week
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            // Finalize week and distribute rebates
            await houseEdgeRebate.write.finalizeWeek([0n]);
            await houseEdgeRebate.write.advanceWeek();
            
            // Transfer rebate funds to rebate contract
            await botToken.write.transfer([houseEdgeRebate.address, parseEther("2500")]);
            
            // LP claims rebate
            const initialBalance = await botToken.read.balanceOf([lp1.account.address]);
            await houseEdgeRebate.write.claimRebate({ account: lp1.account });
            const finalBalance = await botToken.read.balanceOf([lp1.account.address]);
            
            // LP should receive the full house edge as rebate (100% of volume)
            const rebateReceived = finalBalance - initialBalance;
            assert.strictEqual(formatEther(rebateReceived), "2500");
            
            // This demonstrates tokens flowing from bot losses to LP rewards
            console.log("✅ Token flow: Bot loses → House edge collected → LP rebate distributed");
        });
    });
});