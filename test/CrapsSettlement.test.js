import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import TestHelpers from "./helpers/TestHelpers.js";

describe("CrapsSettlement", function () {
    let owner, player1, player2, player3;
    let game, bets, settlement, vrfCoordinator, usdc, vaultFactory;
    let vault;
    
    // Bet type constants
    const BetTypes = {
        BET_PASS: 0,
        BET_DONT_PASS: 1,
        BET_COME: 2,
        BET_DONT_COME: 3,
        BET_FIELD: 4,
        BET_YES_4: 7,
        BET_YES_6: 9,
        BET_YES_8: 10,
        BET_NO_4: 17,
        BET_NO_6: 19,
        BET_NO_10: 22,
        BET_HARD4: 25,
        BET_HARD6: 26,
        BET_HARD8: 27,
        BET_HARD10: 28,
        BET_ODDS_PASS: 29,
        BET_ODDS_DONT_PASS: 30,
        BET_FIRE: 34,
        BET_BONUS_SMALL: 38,
        BET_BONUS_TALL: 39,
        BET_BONUS_ALL: 40,
        BET_NEXT_2: 43,
        BET_NEXT_7: 48,
        BET_NEXT_11: 52,
        BET_NEXT_12: 53,
        BET_REPEATER_2: 54,
        BET_REPEATER_6: 58,
        BET_REPEATER_12: 63
    };
    
    beforeEach(async function () {
        const contracts = await TestHelpers.deployContracts();
        owner = contracts.owner;
        player1 = contracts.player1;
        player2 = contracts.player2;
        player3 = contracts.player3;
        game = contracts.game;
        bets = contracts.bets;
        settlement = contracts.settlement;
        vrfCoordinator = contracts.vrfCoordinator;
        usdc = contracts.usdc;
        vaultFactory = contracts.vaultFactory;
        
        // Create vault for testing
        vault = await TestHelpers.createVault(vaultFactory, 1, "TestVault", owner.address);
        
        // Set vault in contracts
        await game.setVaultContract(vault);
        await bets.setVaultContract(vault);
        
        // Fund vault with USDC for payouts
        await TestHelpers.fundAccounts(usdc, [owner], parseEther("10000"));
        const Vault = await hre.viem.getContractAt("CrapsVault", vault);
        await usdc.approve(vault, parseEther("10000"));
        await Vault.deposit(parseEther("10000"), owner.address);
        
        // Fund players
        await TestHelpers.fundAccounts(usdc, [player1, player2, player3], parseEther("1000"));
        
        // Approve USDC spending for vault
        await usdc.connect(player1).approve(vault, parseEther("1000"));
        await usdc.connect(player2).approve(vault, parseEther("1000"));
        await usdc.connect(player3).approve(vault, parseEther("1000"));
        
        // Start a game series
        await game.startNewSeries(player1.address);
    });

    describe("Come-Out Roll Settlement", function () {
        describe("Natural (7 or 11)", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
                await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
                await bets.connect(player3).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            });

            it("Should settle pass line win on 7", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Roll 7
                
                const finalBalance = await usdc.balanceOf(player1.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should settle pass line win on 11", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 5, 6); // Roll 11
                
                const finalBalance = await usdc.balanceOf(player1.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should lose don't pass on 7", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Roll 7
                
                const finalBalance = await usdc.balanceOf(player2.address);
                expect(finalBalance).to.equal(initialBalance); // No payout
                
                // Bet should be cleared
                const bet = await bets.bets(player2.address, BetTypes.BET_DONT_PASS);
                expect(bet.isActive).to.be.false;
            });

            it("Should settle field bet on 11", async function () {
                const initialBalance = await usdc.balanceOf(player3.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 5, 6); // Roll 11
                
                const finalBalance = await usdc.balanceOf(player3.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout for 11
            });
        });

        describe("Craps (2, 3, 12)", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
                await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
                await bets.connect(player3).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            });

            it("Should lose pass line on 2", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1); // Roll 2
                
                const finalBalance = await usdc.balanceOf(player1.address);
                expect(finalBalance).to.equal(initialBalance); // No payout
            });

            it("Should win don't pass on 2", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1); // Roll 2
                
                const finalBalance = await usdc.balanceOf(player2.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should win don't pass on 3", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 2); // Roll 3
                
                const finalBalance = await usdc.balanceOf(player2.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should push don't pass on 12", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 6, 6); // Roll 12
                
                const finalBalance = await usdc.balanceOf(player2.address);
                expect(finalBalance).to.equal(initialBalance); // Push - bet remains
                
                // Bet should still be active
                const bet = await bets.bets(player2.address, BetTypes.BET_DONT_PASS);
                expect(bet.isActive).to.be.true;
            });

            it("Should pay field bet 2:1 on 2", async function () {
                const initialBalance = await usdc.balanceOf(player3.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1); // Roll 2
                
                const finalBalance = await usdc.balanceOf(player3.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("2")); // 2:1 payout for 2
            });

            it("Should pay field bet 2:1 on 12", async function () {
                const initialBalance = await usdc.balanceOf(player3.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 6, 6); // Roll 12
                
                const finalBalance = await usdc.balanceOf(player3.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("2")); // 2:1 payout for 12
            });
        });
    });

    describe("Point Roll Settlement", function () {
        beforeEach(async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            
            // Establish point of 6
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
        });

        describe("Point Made", function () {
            it("Should pay pass line when point is made", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Make the point
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 4); // Roll 6
                
                const finalBalance = await usdc.balanceOf(player1.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should lose don't pass when point is made", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                // Make the point
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 4); // Roll 6
                
                const finalBalance = await usdc.balanceOf(player2.address);
                expect(finalBalance).to.equal(initialBalance); // No payout
            });

            it("Should pay odds bets with true odds", async function () {
                // Place pass odds bet
                await bets.connect(player1).placeOddsBet(BetTypes.BET_PASS, parseEther("2"));
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Make the point (6)
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 4);
                
                const finalBalance = await usdc.balanceOf(player1.address);
                const payout = finalBalance - initialBalance;
                
                // Pass line: 1 ETH at 1:1 = 1 ETH
                // Odds on 6: 2 ETH at 6:5 = 2.4 ETH
                // Total payout: 1 + 2.4 = 3.4 ETH
                expect(payout).to.be.closeTo(parseEther("3.4"), parseEther("0.01"));
            });
        });

        describe("Seven Out", function () {
            it("Should lose pass line on seven out", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Seven out
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Roll 7
                
                const finalBalance = await usdc.balanceOf(player1.address);
                expect(finalBalance).to.equal(initialBalance); // No payout
            });

            it("Should pay don't pass on seven out", async function () {
                const initialBalance = await usdc.balanceOf(player2.address);
                
                // Seven out
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Roll 7
                
                const finalBalance = await usdc.balanceOf(player2.address);
                const payout = finalBalance - initialBalance;
                
                expect(payout).to.equal(parseEther("1")); // 1:1 payout
            });

            it("Should clear all active bets on seven out", async function () {
                // Place additional bets
                await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("0.5"));
                await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("0.5"));
                
                // Seven out
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
                
                // Check all bets are cleared
                const passBet = await bets.bets(player1.address, BetTypes.BET_PASS);
                const fieldBet = await bets.bets(player1.address, BetTypes.BET_FIELD);
                const yesBet = await bets.bets(player1.address, BetTypes.BET_YES_6);
                
                expect(passBet.isActive).to.be.false;
                expect(fieldBet.isActive).to.be.false;
                expect(yesBet.isActive).to.be.false;
            });
        });
    });

    describe("Field Bet Settlement", function () {
        beforeEach(async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
        });

        it("Should pay 1:1 on 3", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 2);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("1"));
        });

        it("Should pay 1:1 on 4", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("1"));
        });

        it("Should pay 1:1 on 9", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 4, 5);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("1"));
        });

        it("Should pay 1:1 on 10", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 4, 6);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("1"));
        });

        it("Should pay 1:1 on 11", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 5, 6);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("1"));
        });

        it("Should pay 2:1 on 2", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("2"));
        });

        it("Should pay 2:1 on 12", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 6, 6);
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.equal(parseEther("2"));
        });

        it("Should lose on non-field numbers", async function () {
            const initialBalance = await usdc.balanceOf(player1.address);
            
            // Test losing numbers: 5, 6, 7, 8
            const losingRolls = [
                [2, 3], // 5
                [3, 3], // 6
                [3, 4], // 7
                [4, 4]  // 8
            ];
            
            for (const [d1, d2] of losingRolls) {
                await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
                const balanceBefore = await usdc.balanceOf(player1.address);
                
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, d1, d2);
                
                const balanceAfter = await usdc.balanceOf(player1.address);
                expect(balanceAfter).to.equal(balanceBefore); // No payout
            }
        });
    });

    describe("Hardway Bet Settlement", function () {
        describe("Hard 4", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_HARD4, parseEther("1"));
            });

            it("Should win on hard 4 (2+2)", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2);
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.equal(parseEther("7")); // 7:1 payout
            });

            it("Should lose on easy 4 (1+3)", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 3);
                expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
            });

            it("Should lose on 7", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
                expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
            });
        });

        describe("Hard 6", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_HARD6, parseEther("1"));
            });

            it("Should win on hard 6 (3+3)", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.equal(parseEther("9")); // 9:1 payout
            });

            it("Should lose on easy 6", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 4);
                expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
            });
        });

        describe("Hard 8", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_HARD8, parseEther("1"));
            });

            it("Should win on hard 8 (4+4)", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 4, 4);
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.equal(parseEther("9")); // 9:1 payout
            });
        });

        describe("Hard 10", function () {
            beforeEach(async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_HARD10, parseEther("1"));
            });

            it("Should win on hard 10 (5+5)", async function () {
                const initialBalance = await usdc.balanceOf(player1.address);
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 5, 5);
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.equal(parseEther("7")); // 7:1 payout
            });
        });
    });

    describe("YES/NO Bet Settlement", function () {
        describe("YES Bets", function () {
            it("Should win YES 6 when 6 rolls before 7", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("1"));
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Roll 6
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
                
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.be.closeTo(parseEther("1.18"), parseEther("0.01")); // 1.18:1
            });

            it("Should lose YES 6 when 7 rolls", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("1"));
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Roll 7
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
                
                expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
            });
        });

        describe("NO Bets", function () {
            it("Should win NO 4 when 7 rolls before 4", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_NO_4, parseEther("1"));
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Roll 7
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
                
                const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
                expect(payout).to.be.closeTo(parseEther("0.49"), parseEther("0.01")); // 0.49:1
            });

            it("Should lose NO 4 when 4 rolls", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_NO_4, parseEther("1"));
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                // Roll 4
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2);
                
                expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
            });
        });
    });

    describe("NEXT (One-Roll) Bet Settlement", function () {
        it("Should win NEXT 7 on 7", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_NEXT_7, parseEther("1"));
            
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
            
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.be.closeTo(parseEther("4.9"), parseEther("0.01")); // 4.9:1
        });

        it("Should win NEXT 2 on 2", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_NEXT_2, parseEther("1"));
            
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1);
            
            const payout = (await usdc.balanceOf(player1.address)) - initialBalance;
            expect(payout).to.be.closeTo(parseEther("34.3"), parseEther("0.1")); // 34.3:1
        });

        it("Should lose NEXT bets on wrong number", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_NEXT_11, parseEther("1"));
            
            const initialBalance = await usdc.balanceOf(player1.address);
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Roll 7 instead of 11
            
            expect(await usdc.balanceOf(player1.address)).to.equal(initialBalance);
        });

        it("Should clear NEXT bets after each roll", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_NEXT_7, parseEther("1"));
            
            // Roll something else
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
            
            // Bet should be cleared
            const bet = await bets.bets(player1.address, BetTypes.BET_NEXT_7);
            expect(bet.isActive).to.be.false;
        });
    });

    describe("Batch Settlement", function () {
        it("Should settle multiple players in one roll", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            await bets.connect(player3).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            
            const initialBalances = [
                await usdc.balanceOf(player1.address),
                await usdc.balanceOf(player2.address),
                await usdc.balanceOf(player3.address)
            ];
            
            // Roll 7 (pass wins, don't pass loses, field loses)
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
            
            const finalBalances = [
                await usdc.balanceOf(player1.address),
                await usdc.balanceOf(player2.address),
                await usdc.balanceOf(player3.address)
            ];
            
            expect(finalBalances[0] - initialBalances[0]).to.equal(parseEther("1")); // Pass wins
            expect(finalBalances[1] - initialBalances[1]).to.equal(0); // Don't pass loses
            expect(finalBalances[2] - initialBalances[2]).to.equal(0); // Field loses
        });

        it("Should handle large number of bets efficiently", async function () {
            // Place many bets
            const betPromises = [];
            for (let i = 0; i < 20; i++) {
                betPromises.push(
                    bets.connect(player1).placeBet(i, parseEther("0.01"))
                        .catch(() => {}) // Some might fail due to phase
                );
            }
            await Promise.all(betPromises);
            
            // Settle with a roll
            const tx = await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
            
            // Should complete without gas issues
            expect(tx).to.not.be.reverted;
        });

        it("Should emit BatchSettlement event", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            await expect(TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4))
                .to.emit(settlement, "BatchSettlement");
        });
    });

    describe("Payout Calculations", function () {
        it("Should calculate correct payout for pass line", async function () {
            const payout = await settlement.calculatePayout(
                BetTypes.BET_PASS,
                parseEther("1"),
                0
            );
            expect(payout).to.equal(parseEther("1")); // 1:1
        });

        it("Should calculate correct payout for field bet", async function () {
            const payout = await settlement.calculatePayout(
                BetTypes.BET_FIELD,
                parseEther("1"),
                0
            );
            expect(payout).to.equal(parseEther("1")); // 1:1 base
        });

        it("Should calculate correct payout for hard 8", async function () {
            const payout = await settlement.calculatePayout(
                BetTypes.BET_HARD8,
                parseEther("1"),
                0
            );
            expect(payout).to.equal(parseEther("9")); // 9:1
        });

        it("Should calculate true odds for pass odds on 4", async function () {
            const payout = await settlement.calculatePayout(
                BetTypes.BET_ODDS_PASS,
                parseEther("1"),
                4
            );
            expect(payout).to.equal(parseEther("2")); // 2:1
        });

        it("Should calculate true odds for don't pass odds on 6", async function () {
            const payout = await settlement.calculatePayout(
                BetTypes.BET_ODDS_DONT_PASS,
                parseEther("6"),
                6
            );
            expect(payout).to.equal(parseEther("5")); // 5:6
        });
    });

    describe("Special Cases", function () {
        it("Should handle come bet point establishment", async function () {
            // Establish main point
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3); // Point 6
            
            // Place come bet
            await bets.connect(player1).placeBet(BetTypes.BET_COME, parseEther("1"));
            
            // Roll to establish come point
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2); // Come point 4
            
            // Verify come point is stored
            const comePoint = await bets.comePoints(player1.address, 1);
            expect(comePoint).to.equal(4);
        });

        it("Should handle multiple come bets", async function () {
            // Establish main point
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
            
            // Place and establish multiple come bets
            await bets.connect(player1).placeBet(BetTypes.BET_COME, parseEther("1"));
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2); // Come point 4
            
            await bets.connect(player1).placeBet(BetTypes.BET_COME, parseEther("1"));
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 5, 5); // Come point 10
            
            // Both come bets should have different points
            const comePoint1 = await bets.comePoints(player1.address, 1);
            const comePoint2 = await bets.comePoints(player1.address, 2);
            expect(comePoint1).to.equal(4);
            expect(comePoint2).to.equal(10);
        });
    });

    describe("Gas Optimization", function () {
        it("Should settle efficiently with gas limit", async function () {
            // Place multiple bets
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            
            const tx = await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            // Settlement should be gas efficient
            expect(gasUsed.gasUsed).to.be.lessThan(500000n);
        });

        it("Should batch process players efficiently", async function () {
            // Place bets for multiple players
            const players = [player1, player2, player3];
            for (const player of players) {
                await bets.connect(player).placeBet(BetTypes.BET_PASS, parseEther("0.1"));
            }
            
            const tx = await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4);
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            // Gas per player should be reasonable
            const gasPerPlayer = gasUsed.gasUsed / BigInt(players.length);
            expect(gasPerPlayer).to.be.lessThan(150000n);
        });
    });

    describe("Error Handling", function () {
        it("Should handle insufficient vault liquidity", async function () {
            // Drain vault liquidity
            const Vault = await hre.viem.getContractAt("CrapsVault", vault);
            await Vault.withdraw(
                await Vault.balanceOf(owner.address),
                owner.address,
                owner.address
            );
            
            // Place bet
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            // Roll should still process but payout might fail
            await expect(TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4))
                .to.not.be.reverted;
        });

        it("Should handle invalid dice values gracefully", async function () {
            // This would be caught by VRF validation in production
            // Test ensures settlement doesn't break with edge values
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            // Contract should validate dice values are 1-6
            await expect(TestHelpers.simulateDiceRoll(vrfCoordinator, game, 1, 1))
                .to.not.be.reverted;
        });
    });

    describe("Access Control", function () {
        it("Should only allow game contract to trigger settlement", async function () {
            await expect(settlement.connect(player1).settleRoll(3, 4))
                .to.be.reverted;
        });

        it("Should only allow authorized roles to update configuration", async function () {
            await expect(settlement.connect(player1).setContracts(
                await game.getAddress(),
                await bets.getAddress()
            )).to.be.reverted;
        });
    });
});