import hre from "hardhat";
import { expect } from "chai";
import { parseEther, zeroAddress } from "viem";
import TestHelpers from "./helpers/TestHelpers.js";

describe("CrapsBets", function () {
    let owner, player1, player2, player3;
    let game, bets, settlement, vrfCoordinator, usdc, vaultFactory;
    let vault1, vault2;
    
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
        BET_NO_10: 22,
        BET_HARD4: 25,
        BET_HARD6: 26,
        BET_HARD8: 27,
        BET_HARD10: 28,
        BET_ODDS_PASS: 29,
        BET_ODDS_DONT_PASS: 30,
        BET_ODDS_COME: 31,
        BET_ODDS_DONT_COME: 32,
        BET_FIRE: 34,
        BET_BONUS_SMALL: 38,
        BET_BONUS_TALL: 39,
        BET_BONUS_ALL: 40,
        BET_NEXT_7: 48,
        BET_NEXT_11: 52,
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
        
        // Create vaults for testing
        vault1 = await TestHelpers.createVault(vaultFactory, 1, "Bot1", owner.address);
        vault2 = await TestHelpers.createVault(vaultFactory, 2, "Bot2", owner.address);
        
        // Set vault in contracts
        await game.setVaultContract(vault1);
        await bets.setVaultContract(vault1);
        
        // Fund players
        await TestHelpers.fundAccounts(usdc, [player1, player2, player3], parseEther("1000"));
        
        // Start a game series
        await game.startNewSeries(player1.address);
    });

    describe("Deployment and Configuration", function () {
        it("Should set correct initial parameters", async function () {
            expect(await bets.minBetAmount()).to.equal(parseEther("0.001"));
            expect(await bets.maxBetAmount()).to.equal(parseEther("10"));
            expect(await bets.maxOddsMultiple()).to.equal(5);
        });

        it("Should have connected contracts set", async function () {
            expect(await bets.gameContract()).to.equal(await game.getAddress());
            expect(await bets.settlementContract()).to.equal(await settlement.getAddress());
            expect(await bets.vaultContract()).to.equal(vault1);
        });

        it("Should grant appropriate roles", async function () {
            const GAME_ROLE = await bets.GAME_ROLE();
            const SETTLEMENT_ROLE = await bets.SETTLEMENT_ROLE();
            
            expect(await bets.hasRole(GAME_ROLE, await game.getAddress())).to.be.true;
            expect(await bets.hasRole(SETTLEMENT_ROLE, await settlement.getAddress())).to.be.true;
        });
    });

    describe("Pass/Don't Pass Line Bets", function () {
        describe("Pass Line Bet", function () {
            it("Should place pass line bet", async function () {
                const betAmount = parseEther("1");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_PASS, betAmount);
            });

            it("Should update player bet summary", async function () {
                const betAmount = parseEther("1");
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, betAmount);
                
                const summary = await bets.playerBetSummary(player1.address);
                expect(summary.totalAtRisk).to.equal(betAmount);
                expect(summary.activeBetCount).to.equal(1);
                expect(summary.activeBetsBitmap & (1n << BigInt(BetTypes.BET_PASS))).to.be.greaterThan(0);
            });

            it("Should store bet details", async function () {
                const betAmount = parseEther("1");
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, betAmount);
                
                const bet = await bets.bets(player1.address, BetTypes.BET_PASS);
                expect(bet.amount).to.equal(betAmount);
                expect(bet.betType).to.equal(BetTypes.BET_PASS);
                expect(bet.isActive).to.be.true;
            });

            it("Should not allow duplicate pass line bet", async function () {
                const betAmount = parseEther("1");
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, betAmount);
                
                await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, betAmount))
                    .to.be.revertedWith("Bet already exists");
            });

            it("Should validate bet amount", async function () {
                const tooSmall = parseEther("0.0001");
                const tooLarge = parseEther("100");
                
                await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, tooSmall))
                    .to.be.revertedWith("Invalid bet amount");
                
                await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, tooLarge))
                    .to.be.revertedWith("Invalid bet amount");
            });
        });

        describe("Don't Pass Bet", function () {
            it("Should place don't pass bet", async function () {
                const betAmount = parseEther("2");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_DONT_PASS, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_DONT_PASS, betAmount);
            });

            it("Should allow both pass and don't pass bets", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
                await bets.connect(player1).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
                
                const summary = await bets.playerBetSummary(player1.address);
                expect(summary.activeBetCount).to.equal(2);
            });
        });
    });

    describe("Come/Don't Come Bets", function () {
        beforeEach(async function () {
            // Establish a point first
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3); // Point 6
        });

        describe("Come Bet", function () {
            it("Should place come bet during point phase", async function () {
                const betAmount = parseEther("1");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_COME, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_COME, betAmount);
            });

            it("Should not allow come bet during come-out", async function () {
                // Make point to return to come-out
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 4); // Make point 6
                
                await expect(bets.connect(player1).placeBet(BetTypes.BET_COME, parseEther("1")))
                    .to.be.revertedWith("Invalid phase for this bet");
            });

            it("Should track come point when established", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_COME, parseEther("1"));
                
                // Roll to establish come point
                await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2); // Come point 4
                
                const comePoint = await bets.comePoints(player1.address, 1); // Come bet number 1
                expect(comePoint).to.equal(4);
            });
        });

        describe("Don't Come Bet", function () {
            it("Should place don't come bet during point phase", async function () {
                const betAmount = parseEther("1");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_DONT_COME, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_DONT_COME, betAmount);
            });
        });
    });

    describe("Field Bet", function () {
        it("Should place field bet", async function () {
            const betAmount = parseEther("0.5");
            await expect(bets.connect(player1).placeBet(BetTypes.BET_FIELD, betAmount))
                .to.emit(bets, "BetPlaced")
                .withArgs(player1.address, 1, BetTypes.BET_FIELD, betAmount);
        });

        it("Should allow field bet in any phase", async function () {
            // Come-out phase
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("0.5"));
            
            // Move to point phase
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3);
            
            // Should still allow field bet
            await bets.connect(player2).placeBet(BetTypes.BET_FIELD, parseEther("0.5"));
            
            expect(await bets.hasActiveBet(player1.address, BetTypes.BET_FIELD)).to.be.true;
            expect(await bets.hasActiveBet(player2.address, BetTypes.BET_FIELD)).to.be.true;
        });
    });

    describe("YES/NO (Place/Lay) Bets", function () {
        describe("YES Bets", function () {
            it("Should place YES bet on 4", async function () {
                const betAmount = parseEther("1");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_YES_4, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_YES_4, betAmount);
            });

            it("Should place multiple YES bets on different numbers", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_YES_4, parseEther("1"));
                await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("1"));
                await bets.connect(player1).placeBet(BetTypes.BET_YES_8, parseEther("1"));
                
                const summary = await bets.playerBetSummary(player1.address);
                expect(summary.activeBetCount).to.equal(3);
            });
        });

        describe("NO Bets", function () {
            it("Should place NO bet on 10", async function () {
                const betAmount = parseEther("2");
                await expect(bets.connect(player1).placeBet(BetTypes.BET_NO_10, betAmount))
                    .to.emit(bets, "BetPlaced")
                    .withArgs(player1.address, 1, BetTypes.BET_NO_10, betAmount);
            });

            it("Should allow YES and NO on same number", async function () {
                await bets.connect(player1).placeBet(BetTypes.BET_YES_4, parseEther("1"));
                await bets.connect(player1).placeBet(BetTypes.BET_NO_4, parseEther("1"));
                
                const summary = await bets.playerBetSummary(player1.address);
                expect(summary.activeBetCount).to.equal(2);
            });
        });
    });

    describe("Hardway Bets", function () {
        it("Should place hard 4 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_HARD4, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place hard 6 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_HARD6, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place hard 8 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_HARD8, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place hard 10 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_HARD10, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place all hardway bets simultaneously", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_HARD4, parseEther("0.25"));
            await bets.connect(player1).placeBet(BetTypes.BET_HARD6, parseEther("0.25"));
            await bets.connect(player1).placeBet(BetTypes.BET_HARD8, parseEther("0.25"));
            await bets.connect(player1).placeBet(BetTypes.BET_HARD10, parseEther("0.25"));
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.equal(4);
            expect(summary.totalAtRisk).to.equal(parseEther("1"));
        });
    });

    describe("Odds Bets", function () {
        beforeEach(async function () {
            // Place pass line bet first
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            // Establish point
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 2, 2); // Point 4
        });

        it("Should place pass odds bet after point established", async function () {
            const oddsAmount = parseEther("3"); // 3x odds
            await expect(bets.connect(player1).placeOddsBet(BetTypes.BET_PASS, oddsAmount))
                .to.emit(bets, "OddsBetPlaced")
                .withArgs(player1.address, BetTypes.BET_PASS, oddsAmount, 4);
        });

        it("Should enforce maximum odds multiple", async function () {
            const tooMuchOdds = parseEther("10"); // 10x odds (max is 5x)
            await expect(bets.connect(player1).placeOddsBet(BetTypes.BET_PASS, tooMuchOdds))
                .to.be.revertedWith("Exceeds max odds multiple");
        });

        it("Should require base bet for odds", async function () {
            await expect(bets.connect(player2).placeOddsBet(BetTypes.BET_PASS, parseEther("1")))
                .to.be.revertedWith("No base bet exists");
        });

        it("Should allow don't pass odds", async function () {
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            await bets.connect(player2).placeOddsBet(BetTypes.BET_DONT_PASS, parseEther("2"));
            
            const bet = await bets.bets(player2.address, BetTypes.BET_ODDS_DONT_PASS);
            expect(bet.amount).to.equal(parseEther("2"));
            expect(bet.point).to.equal(4);
        });
    });

    describe("Special/Bonus Bets", function () {
        it("Should place Fire bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_FIRE, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place Small bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_BONUS_SMALL, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place Tall bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_BONUS_TALL, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place All bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_BONUS_ALL, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place all three (Small/Tall/All) simultaneously", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_BONUS_SMALL, parseEther("0.1"));
            await bets.connect(player1).placeBet(BetTypes.BET_BONUS_TALL, parseEther("0.1"));
            await bets.connect(player1).placeBet(BetTypes.BET_BONUS_ALL, parseEther("0.1"));
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.equal(3);
        });
    });

    describe("NEXT (One-Roll Proposition) Bets", function () {
        it("Should place NEXT 7 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_NEXT_7, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place NEXT 11 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_NEXT_11, parseEther("0.5")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place multiple NEXT bets", async function () {
            const nextBets = [43, 44, 45, 48, 52, 53]; // Various NEXT bets
            
            for (const betType of nextBets) {
                await bets.connect(player1).placeBet(betType, parseEther("0.1"));
            }
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.equal(nextBets.length);
        });
    });

    describe("Repeater Bets", function () {
        it("Should place repeater 2 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_REPEATER_2, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place repeater 6 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_REPEATER_6, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place repeater 12 bet", async function () {
            await expect(bets.connect(player1).placeBet(BetTypes.BET_REPEATER_12, parseEther("0.1")))
                .to.emit(bets, "BetPlaced");
        });

        it("Should place multiple repeater bets", async function () {
            const repeaterBets = [54, 55, 56, 57, 58, 59, 60, 61, 62, 63]; // All repeater bets
            
            for (const betType of repeaterBets) {
                await bets.connect(player1).placeBet(betType, parseEther("0.05"));
            }
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.equal(repeaterBets.length);
            expect(summary.totalAtRisk).to.equal(parseEther("0.5"));
        });
    });

    describe("Bet Removal", function () {
        beforeEach(async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("1"));
        });

        it("Should remove bet and return funds", async function () {
            await expect(bets.connect(player1).removeBet(BetTypes.BET_FIELD))
                .to.emit(bets, "BetRemoved")
                .withArgs(player1.address, BetTypes.BET_FIELD, parseEther("1"));
        });

        it("Should update player summary after removal", async function () {
            await bets.connect(player1).removeBet(BetTypes.BET_FIELD);
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.equal(1);
            expect(summary.totalAtRisk).to.equal(parseEther("1"));
        });

        it("Should clear bet from storage", async function () {
            await bets.connect(player1).removeBet(BetTypes.BET_FIELD);
            
            const bet = await bets.bets(player1.address, BetTypes.BET_FIELD);
            expect(bet.isActive).to.be.false;
            expect(bet.amount).to.equal(0);
        });

        it("Should not allow removing pass line bet during point", async function () {
            await bets.connect(player2).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3); // Establish point
            
            await expect(bets.connect(player2).removeBet(BetTypes.BET_PASS))
                .to.be.revertedWith("Cannot remove this bet type");
        });

        it("Should not remove non-existent bet", async function () {
            await expect(bets.connect(player1).removeBet(BetTypes.BET_PASS))
                .to.be.revertedWith("No active bet");
        });
    });

    describe("Active Players Tracking", function () {
        it("Should add player to active list on first bet", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            expect(await bets.isActivePlayer(player1.address)).to.be.true;
            expect(await bets.activePlayers(0)).to.equal(player1.address);
        });

        it("Should not duplicate active players", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            
            // Should still only be in the list once
            const activeCount = await bets.getActivePlayerCount();
            expect(activeCount).to.equal(1);
        });

        it("Should track multiple active players", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            await bets.connect(player3).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            
            const activeCount = await bets.getActivePlayerCount();
            expect(activeCount).to.equal(3);
        });

        it("Should remove player from active list when all bets removed", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            expect(await bets.isActivePlayer(player1.address)).to.be.true;
            
            await bets.connect(player1).removeBet(BetTypes.BET_FIELD);
            expect(await bets.isActivePlayer(player1.address)).to.be.false;
        });
    });

    describe("Series Tracking", function () {
        it("Should track total bets per series", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("1"));
            
            const seriesId = await game.currentSeriesId();
            expect(await bets.seriesTotalBets(seriesId)).to.equal(2);
        });

        it("Should track total volume per series", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player2).placeBet(BetTypes.BET_DONT_PASS, parseEther("2"));
            
            const seriesId = await game.currentSeriesId();
            expect(await bets.seriesTotalVolume(seriesId)).to.equal(parseEther("3"));
        });

        it("Should reset tracking for new series", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            // End current series
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 3); // Establish point
            await TestHelpers.simulateDiceRoll(vrfCoordinator, game, 3, 4); // Seven out
            
            // Start new series
            await game.startNewSeries(player2.address);
            const newSeriesId = await game.currentSeriesId();
            
            expect(await bets.seriesTotalBets(newSeriesId)).to.equal(0);
            expect(await bets.seriesTotalVolume(newSeriesId)).to.equal(0);
        });
    });

    describe("Batch Operations", function () {
        it("Should handle batch bet placement", async function () {
            const players = [player1, player2, player3];
            const betTypes = [BetTypes.BET_PASS, BetTypes.BET_DONT_PASS, BetTypes.BET_FIELD];
            const amounts = [
                parseEther("1"),
                parseEther("2"),
                parseEther("0.5")
            ];
            
            await TestHelpers.placeBets(bets, players, betTypes, amounts);
            
            for (let i = 0; i < players.length; i++) {
                const bet = await bets.bets(players[i].address, betTypes[i]);
                expect(bet.amount).to.equal(amounts[i]);
            }
        });

        it("Should retrieve all active bets for batch processing", async function () {
            // Place various bets
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("0.5"));
            await bets.connect(player1).placeBet(BetTypes.BET_YES_6, parseEther("2"));
            
            const activeBets = await TestHelpers.getPlayerActiveBets(bets, player1.address);
            expect(activeBets.length).to.equal(3);
        });
    });

    describe("Access Control", function () {
        it("Should only allow game contract to update series", async function () {
            await expect(bets.connect(player1).updateSeriesId(2))
                .to.be.reverted;
        });

        it("Should only allow settlement contract to resolve bets", async function () {
            await expect(bets.connect(player1).resolveBet(
                player1.address,
                BetTypes.BET_PASS,
                parseEther("1"),
                true
            )).to.be.reverted;
        });

        it("Should allow operator to update limits", async function () {
            await bets.setBetLimits(
                parseEther("0.01"),
                parseEther("100")
            );
            
            expect(await bets.minBetAmount()).to.equal(parseEther("0.01"));
            expect(await bets.maxBetAmount()).to.equal(parseEther("100"));
        });

        it("Should allow pausing bet placement", async function () {
            await bets.pause();
            
            await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1")))
                .to.be.revertedWithCustomError(bets, "EnforcedPause");
            
            await bets.unpause();
            
            await expect(bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1")))
                .to.not.be.reverted;
        });
    });

    describe("Gas Optimization", function () {
        it("Should efficiently handle bitmap operations", async function () {
            const tx = await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            // First bet should be relatively gas efficient
            expect(gasUsed.gasUsed).to.be.lessThan(200000n);
        });

        it("Should efficiently add subsequent bets", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_PASS, parseEther("1"));
            
            const tx = await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            // Subsequent bets should also be efficient
            expect(gasUsed.gasUsed).to.be.lessThan(150000n);
        });

        it("Should efficiently check active bets using bitmap", async function () {
            // Place multiple bets
            for (let i = 0; i < 10; i++) {
                await bets.connect(player1).placeBet(i, parseEther("0.1"));
            }
            
            // Check active status should be O(1)
            const hasActive = await bets.hasActiveBet(player1.address, 5);
            expect(hasActive).to.be.true;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum number of simultaneous bets", async function () {
            // Try to place all 64 bet types
            const promises = [];
            for (let i = 0; i < 64; i++) {
                if (i !== 29 && i !== 30 && i !== 31 && i !== 32) { // Skip odds bets
                    promises.push(
                        bets.connect(player1).placeBet(i, parseEther("0.01"))
                            .catch(() => {}) // Some might fail due to phase requirements
                    );
                }
            }
            
            await Promise.all(promises);
            
            const summary = await bets.playerBetSummary(player1.address);
            expect(summary.activeBetCount).to.be.greaterThan(0);
            expect(summary.activeBetCount).to.be.lessThanOrEqual(64);
        });

        it("Should handle bet removal during settlement", async function () {
            await bets.connect(player1).placeBet(BetTypes.BET_FIELD, parseEther("1"));
            
            // Simulate settlement starting
            // In real scenario, settlement contract would handle this
            
            // Should still allow removal of removable bets
            await expect(bets.connect(player1).removeBet(BetTypes.BET_FIELD))
                .to.not.be.reverted;
        });

        it("Should validate bet type range", async function () {
            await expect(bets.connect(player1).placeBet(64, parseEther("1")))
                .to.be.revertedWith("Invalid bet type");
            
            await expect(bets.connect(player1).placeBet(255, parseEther("1")))
                .to.be.revertedWith("Invalid bet type");
        });

        it("Should handle zero address checks", async function () {
            await expect(bets.setContracts(
                zeroAddress,
                vault1,
                await settlement.getAddress()
            )).to.be.revertedWith("Invalid game contract");
        });
    });
});