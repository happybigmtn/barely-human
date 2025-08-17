import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";

describe("House Edge Rebate System V2 - Net Settlement", () => {
    let connection: any;
    let viem: any;
    let botToken: any;
    let houseEdgeRebateV2: any;
    let treasuryV3: any;
    let deployer: any;
    let player1: any;
    let player2: any;
    let publicClient: any;

    beforeEach(async () => {
        connection = await network.connect();
        viem = connection.viem;
        publicClient = await viem.getPublicClient();
        
        const wallets = await viem.getWalletClients();
        [deployer, player1, player2] = wallets;
        
        // Deploy BOTToken
        botToken = await viem.deployContract("BOTToken", [
            deployer.account.address, // treasury
            deployer.account.address, // liquidity
            deployer.account.address, // staking
            deployer.account.address, // team
            deployer.account.address  // community
        ]);
        
        // Deploy HouseEdgeRebateV2
        houseEdgeRebateV2 = await viem.deployContract("HouseEdgeRebateV2", [
            botToken.address
        ]);
        
        // Deploy TreasuryV3
        treasuryV3 = await viem.deployContract("TreasuryV3", [
            botToken.address,
            deployer.account.address // staking pool
        ]);
        
        // Setup roles
        await houseEdgeRebateV2.write.grantRole([
            await houseEdgeRebateV2.read.GAME_ROLE(),
            treasuryV3.address
        ]);
        
        await houseEdgeRebateV2.write.grantRole([
            await houseEdgeRebateV2.read.TREASURY_ROLE(),
            treasuryV3.address
        ]);
        
        await treasuryV3.write.grantRole([
            await treasuryV3.read.GAME_ROLE(),
            deployer.account.address
        ]);
        
        await treasuryV3.write.grantRole([
            await treasuryV3.read.OPERATOR_ROLE(),
            deployer.account.address
        ]);
        
        await treasuryV3.write.setRebateContract([houseEdgeRebateV2.address]);
        
        // Initialize bot positions
        for (let i = 0; i < 10; i++) {
            await treasuryV3.write.initializeBotPosition([
                BigInt(i),
                parseEther("20000000") // 2% of 1B
            ]);
        }
        
        // Fund rebate contract for testing
        await botToken.write.transfer([houseEdgeRebateV2.address, parseEther("10000000")]);
    });

    afterEach(async () => {
        await connection.close();
    });

    describe("Net Settlement Mechanics", () => {
        it("should track collections and issuances separately", async () => {
            // Record some collections (house wins)
            await treasuryV3.write.recordCollection([
                0n, // bot 0
                player1.account.address,
                parseEther("1000"),
                parseEther("40000") // volume
            ]);
            
            // Record some issuances (house loses)
            await treasuryV3.write.recordIssuance([
                0n, // bot 0
                player2.account.address,
                parseEther("500"),
                parseEther("20000") // volume
            ]);
            
            // Check weekly position
            const position = await treasuryV3.read.getWeeklyPosition([0n]);
            assert.strictEqual(formatEther(position[0]), "1000"); // collected
            assert.strictEqual(formatEther(position[1]), "500");  // issued
            assert.strictEqual(position[2], 500n); // net position (positive)
        });

        it("should calculate net position correctly", async () => {
            // Week with net collection (house wins overall)
            await treasuryV3.write.recordCollection([
                0n,
                player1.account.address,
                parseEther("2000"),
                parseEther("80000")
            ]);
            
            await treasuryV3.write.recordIssuance([
                0n,
                player2.account.address,
                parseEther("1500"),
                parseEther("60000")
            ]);
            
            // Advance time and settle
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await treasuryV3.write.advanceWeek();
            await treasuryV3.write.settleWeekly();
            
            // Check settlement
            const settlement = await houseEdgeRebateV2.read.getWeeklySettlement([0n]);
            assert.strictEqual(formatEther(settlement[0]), "2000"); // collected
            assert.strictEqual(formatEther(settlement[1]), "1500"); // issued
            assert.strictEqual(settlement[2], 500n); // net position (positive 500)
        });
    });

    describe("Virtual Debt Tracking", () => {
        it("should accumulate virtual debt when house issues more than collects", async () => {
            // Week where house loses (issues more than collects)
            await treasuryV3.write.recordCollection([
                0n,
                player1.account.address,
                parseEther("1000"),
                parseEther("40000")
            ]);
            
            await treasuryV3.write.recordIssuance([
                0n,
                player2.account.address,
                parseEther("3000"),
                parseEther("120000")
            ]);
            
            // Settle week
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await treasuryV3.write.advanceWeek();
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            // Check virtual debt
            const stats = await houseEdgeRebateV2.read.getHouseStats();
            assert.strictEqual(stats[3], 2000n); // virtual debt = 2000
        });

        it("should pay off debt before distributing rebates", async () => {
            // Week 1: House loses (creates debt)
            await treasuryV3.write.recordIssuance([
                0n,
                player1.account.address,
                parseEther("2000"),
                parseEther("80000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            // Check debt created
            let stats = await houseEdgeRebateV2.read.getHouseStats();
            assert.strictEqual(stats[3], 2000n); // virtual debt
            
            // Week 2: House wins but not enough to cover debt
            await houseEdgeRebateV2.write.recordCollection([
                player2.account.address,
                parseEther("1500"),
                parseEther("60000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([1n]);
            
            // Check debt partially paid
            stats = await houseEdgeRebateV2.read.getHouseStats();
            assert.strictEqual(stats[3], 500n); // remaining debt
            assert.strictEqual(formatEther(stats[4]), "1500"); // debt paid off
            
            // No rebates should be available for week 2
            const settlement = await houseEdgeRebateV2.read.getWeeklySettlement([1n]);
            assert.strictEqual(settlement[4], 0n); // rebatePerVolume = 0
        });

        it("should distribute rebates only after debt is fully paid", async () => {
            // Create initial debt
            await treasuryV3.write.recordIssuance([
                0n,
                player1.account.address,
                parseEther("1000"),
                parseEther("40000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            // Week 2: Collect enough to pay debt AND have surplus
            await houseEdgeRebateV2.write.recordCollection([
                player2.account.address,
                parseEther("2000"),
                parseEther("80000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([1n]);
            
            // Check debt fully paid and surplus distributed
            const stats = await houseEdgeRebateV2.read.getHouseStats();
            assert.strictEqual(stats[3], 0n); // no remaining debt
            assert.strictEqual(formatEther(stats[4]), "1000"); // debt paid
            
            // Check rebates available (1000 surplus)
            const rebate = await houseEdgeRebateV2.read.calculateRebateForWeek([
                player2.account.address,
                1n
            ]);
            assert.strictEqual(formatEther(rebate), "1000"); // Full surplus as rebate
        });
    });

    describe("Rebate Expiration", () => {
        it("should expire unclaimed rebates after 1 week", async () => {
            // Create a week with positive net position
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.recordCollection([
                player1.account.address,
                parseEther("1000"),
                parseEther("40000")
            ]);
            
            // Finalize week
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            // Check rebate is claimable
            const claimable = await houseEdgeRebateV2.read.isWeekClaimable([
                player1.account.address,
                0n
            ]);
            assert.strictEqual(claimable, true);
            
            // Advance another week (expiration period)
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            // Try to claim expired rebate
            try {
                await houseEdgeRebateV2.write.claimRebate([0n], { 
                    account: player1.account 
                });
                assert.fail("Should not allow claiming expired rebate");
            } catch (error: any) {
                assert(error.message.includes("RebateHasExpired"));
            }
        });

        it("should retain expired rebates in treasury", async () => {
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.recordCollection([
                player1.account.address,
                parseEther("1000"),
                parseEther("40000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            const initialBalance = await botToken.read.balanceOf([houseEdgeRebateV2.address]);
            
            // Wait for expiration
            await network.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            // Process expired rebates
            await houseEdgeRebateV2.write.processExpiredRebates([0n]);
            
            // Check balance unchanged (retained in treasury)
            const finalBalance = await botToken.read.balanceOf([houseEdgeRebateV2.address]);
            assert.strictEqual(finalBalance, initialBalance);
            
            // Check expired amount tracked
            const stats = await houseEdgeRebateV2.read.getHouseStats();
            assert(stats[6] > 0n); // expired rebates tracked
        });
    });

    describe("Bot Depletion", () => {
        it("should track when bots run out of funds", async () => {
            // Bot 0 starts with 20M tokens
            // Make it lose more than it has
            await treasuryV3.write.recordIssuance([
                0n,
                player1.account.address,
                parseEther("25000000"), // More than starting balance
                parseEther("1000000")
            ]);
            
            // Check bot is depleted
            const botStats = await treasuryV3.read.getBotStats([0n]);
            assert.strictEqual(botStats[5], true); // isDepleted
            assert.strictEqual(botStats[1], 0n); // current balance = 0
        });

        it("should allow bot replenishment", async () => {
            // Deplete bot first
            await treasuryV3.write.recordIssuance([
                0n,
                player1.account.address,
                parseEther("20000000"),
                parseEther("800000")
            ]);
            
            let botStats = await treasuryV3.read.getBotStats([0n]);
            assert.strictEqual(botStats[5], true); // isDepleted
            
            // Replenish bot
            await treasuryV3.write.replenishBot([0n, parseEther("5000000")]);
            
            botStats = await treasuryV3.read.getBotStats([0n]);
            assert.strictEqual(botStats[5], false); // no longer depleted
            assert.strictEqual(formatEther(botStats[1]), "5000000"); // new balance
        });
    });

    describe("Claim All Rebates", () => {
        it("should allow claiming all available rebates at once", async () => {
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            // Create multiple weeks with rebates
            for (let week = 0; week < 3; week++) {
                await houseEdgeRebateV2.write.recordCollection([
                    player1.account.address,
                    parseEther("1000"),
                    parseEther("40000")
                ]);
                
                await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
                await network.provider.send("evm_mine");
                
                await houseEdgeRebateV2.write.advanceWeek();
                await houseEdgeRebateV2.write.finalizeWeeklySettlement([BigInt(week)]);
            }
            
            // Get all claimable rebates
            const claimable = await houseEdgeRebateV2.read.getClaimableRebates([
                player1.account.address
            ]);
            
            assert.strictEqual(claimable[1].length, 3n); // 3 weeks claimable
            assert.strictEqual(formatEther(claimable[0]), "3000"); // Total claimable
            
            // Claim all at once
            const initialBalance = await botToken.read.balanceOf([player1.account.address]);
            await houseEdgeRebateV2.write.claimAllRebates({ account: player1.account });
            const finalBalance = await botToken.read.balanceOf([player1.account.address]);
            
            assert.strictEqual(formatEther(finalBalance - initialBalance), "3000");
        });
    });

    describe("Integration Test", () => {
        it("should demonstrate complete flow: debt → payoff → rebates → expiration", async () => {
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.GAME_ROLE(),
                deployer.account.address
            ]);
            
            await houseEdgeRebateV2.write.grantRole([
                await houseEdgeRebateV2.read.TREASURY_ROLE(),
                deployer.account.address
            ]);
            
            // Week 0: House loses, creates debt
            await houseEdgeRebateV2.write.recordIssuance([
                player1.account.address,
                parseEther("2000"),
                parseEther("80000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([0n]);
            
            // Week 1: House wins, pays off debt and has surplus
            await houseEdgeRebateV2.write.recordCollection([
                player2.account.address,
                parseEther("3000"),
                parseEther("120000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([1n]);
            
            // Player 2 claims rebate
            await houseEdgeRebateV2.write.claimRebate([1n], { account: player2.account });
            
            // Week 2: Another profitable week
            await houseEdgeRebateV2.write.recordCollection([
                player1.account.address,
                parseEther("1000"),
                parseEther("40000")
            ]);
            
            await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            await houseEdgeRebateV2.write.advanceWeek();
            await houseEdgeRebateV2.write.finalizeWeeklySettlement([2n]);
            
            // Player 1 doesn't claim, wait for expiration
            await network.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            // Process expired rebates
            await houseEdgeRebateV2.write.processExpiredRebates([2n]);
            
            // Check final state
            const stats = await houseEdgeRebateV2.read.getHouseStats();
            console.log("Final Stats:");
            console.log("  Total Collected:", formatEther(stats[0]));
            console.log("  Total Issued:", formatEther(stats[1]));
            console.log("  Net Position:", stats[2]);
            console.log("  Virtual Debt:", stats[3]);
            console.log("  Debt Paid Off:", formatEther(stats[4]));
            console.log("  Rebates Distributed:", formatEther(stats[5]));
            console.log("  Expired Rebates:", formatEther(stats[6]));
            
            assert.strictEqual(stats[3], 0n); // No remaining debt
            assert(stats[5] > 0n); // Some rebates distributed
            assert(stats[6] > 0n); // Some rebates expired
        });
    });
});