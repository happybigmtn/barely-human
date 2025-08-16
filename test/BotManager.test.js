import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import TestHelpers from "./helpers/TestHelpers.js";

describe("BotManager", function () {
    let owner, keeper, strategist, player1, player2;
    let game, bets, settlement, vrfCoordinator, usdc, vaultFactory, botManager;
    let vault1, vault2, vault3;
    
    // Strategy enum values
    const Strategies = {
        CONSERVATIVE: 0,
        AGGRESSIVE: 1,
        MARTINGALE: 2,
        FIBONACCI: 3,
        PAROLI: 4,
        DALEMBERT: 5,
        OSCAR_GRIND: 6,
        RANDOM: 7,
        ADAPTIVE: 8,
        MIXED: 9
    };
    
    // Bot personality profiles
    const BotProfiles = {
        CHAD_ROLLER: { name: "Chad Roller", strategy: Strategies.AGGRESSIVE },
        FIBONACCI_FAN: { name: "Fibonacci Fan", strategy: Strategies.FIBONACCI },
        OSCAR_BOT: { name: "Oscar Bot", strategy: Strategies.OSCAR_GRIND },
        SAFE_SALLY: { name: "Safe Sally", strategy: Strategies.CONSERVATIVE },
        MARTIN_GALE: { name: "Martin Gale", strategy: Strategies.MARTINGALE }
    };
    
    beforeEach(async function () {
        const contracts = await TestHelpers.deployContracts();
        owner = contracts.owner;
        keeper = contracts.keeper;
        strategist = contracts.bot1; // Using bot1 as strategist
        player1 = contracts.player1;
        player2 = contracts.player2;
        game = contracts.game;
        bets = contracts.bets;
        settlement = contracts.settlement;
        vrfCoordinator = contracts.vrfCoordinator;
        usdc = contracts.usdc;
        vaultFactory = contracts.vaultFactory;
        botManager = contracts.botManager;
        
        // Grant roles
        const KEEPER_ROLE = await botManager.KEEPER_ROLE();
        const STRATEGIST_ROLE = await botManager.STRATEGIST_ROLE();
        await botManager.grantRole(KEEPER_ROLE, keeper.address);
        await botManager.grantRole(STRATEGIST_ROLE, strategist.address);
        
        // Create vaults for bots
        vault1 = await TestHelpers.createVault(vaultFactory, 1, "Chad Roller", await botManager.getAddress());
        vault2 = await TestHelpers.createVault(vaultFactory, 2, "Fibonacci Fan", await botManager.getAddress());
        vault3 = await TestHelpers.createVault(vaultFactory, 3, "Safe Sally", await botManager.getAddress());
        
        // Set vaults in game contracts
        await game.setVaultContract(vault1);
        await bets.setVaultContract(vault1);
        
        // Fund vaults
        await TestHelpers.fundAccounts(usdc, [owner], parseEther("30000"));
        await usdc.approve(vault1, parseEther("10000"));
        await usdc.approve(vault2, parseEther("10000"));
        await usdc.approve(vault3, parseEther("10000"));
        
        const Vault1 = await hre.viem.getContractAt("CrapsVault", vault1);
        const Vault2 = await hre.viem.getContractAt("CrapsVault", vault2);
        const Vault3 = await hre.viem.getContractAt("CrapsVault", vault3);
        
        await Vault1.deposit(parseEther("10000"), owner.address);
        await Vault2.deposit(parseEther("10000"), owner.address);
        await Vault3.deposit(parseEther("10000"), owner.address);
        
        // Start a game
        await game.startNewSeries(player1.address);
    });

    describe("Bot Registration", function () {
        it("Should register new bot with vault", async function () {
            await expect(botManager.registerBot(
                1,
                vault1,
                Strategies.AGGRESSIVE,
                parseEther("10"),
                parseEther("100")
            )).to.emit(botManager, "BotRegistered")
                .withArgs(1, vault1, Strategies.AGGRESSIVE);
        });

        it("Should store bot configuration", async function () {
            await botManager.registerBot(
                1,
                vault1,
                Strategies.CONSERVATIVE,
                parseEther("5"),
                parseEther("50")
            );
            
            const bot = await botManager.bots(1);
            expect(bot.vault).to.equal(vault1);
            expect(bot.currentStrategy).to.equal(Strategies.CONSERVATIVE);
            expect(bot.minBet).to.equal(parseEther("5"));
            expect(bot.maxBet).to.equal(parseEther("50"));
        });

        it("Should track active bots", async function () {
            await botManager.registerBot(1, vault1, Strategies.AGGRESSIVE, parseEther("10"), parseEther("100"));
            await botManager.registerBot(2, vault2, Strategies.FIBONACCI, parseEther("5"), parseEther("50"));
            
            expect(await botManager.activeBotCount()).to.equal(2);
            expect(await botManager.isBotActive(1)).to.be.true;
            expect(await botManager.isBotActive(2)).to.be.true;
        });

        it("Should not allow duplicate bot IDs", async function () {
            await botManager.registerBot(1, vault1, Strategies.AGGRESSIVE, parseEther("10"), parseEther("100"));
            
            await expect(botManager.registerBot(
                1,
                vault2,
                Strategies.CONSERVATIVE,
                parseEther("5"),
                parseEther("50")
            )).to.be.revertedWith("Bot already exists");
        });

        it("Should validate bet limits", async function () {
            await expect(botManager.registerBot(
                1,
                vault1,
                Strategies.AGGRESSIVE,
                parseEther("100"), // min > max
                parseEther("50")
            )).to.be.revertedWith("Invalid bet limits");
        });
    });

    describe("Strategy Execution", function () {
        beforeEach(async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            await botManager.registerBot(2, vault2, Strategies.AGGRESSIVE, parseEther("5"), parseEther("500"));
            await botManager.registerBot(3, vault3, Strategies.MARTINGALE, parseEther("1"), parseEther("1000"));
        });

        describe("Conservative Strategy", function () {
            it("Should place small, safe bets", async function () {
                const betAmount = await botManager.calculateBetAmount(1);
                const bot = await botManager.bots(1);
                
                // Conservative bets should be on the lower end
                expect(betAmount).to.be.gte(bot.minBet);
                expect(betAmount).to.be.lte(bot.maxBet / 4n); // Conservative stays in lower 25%
            });

            it("Should prefer pass line and field bets", async function () {
                const betTypes = await botManager.selectBetTypes(1);
                
                // Should include safe bets
                expect(betTypes).to.include(0); // Pass line
                expect(betTypes).to.include(4); // Field
            });

            it("Should reduce bets after losses", async function () {
                const bot = await botManager.bots(1);
                
                // Simulate a loss
                await botManager.updateBotSession(1, false, parseEther("10"));
                
                const newBetAmount = await botManager.calculateBetAmount(1);
                expect(newBetAmount).to.be.lte(parseEther("10"));
            });
        });

        describe("Aggressive Strategy", function () {
            it("Should place larger bets", async function () {
                const betAmount = await botManager.calculateBetAmount(2);
                const bot = await botManager.bots(2);
                
                // Aggressive bets should be on the higher end
                expect(betAmount).to.be.gte(bot.maxBet / 2n); // At least 50% of max
            });

            it("Should include risky bet types", async function () {
                const betTypes = await botManager.selectBetTypes(2);
                
                // Should include hardways and proposition bets
                const hasRiskyBets = betTypes.some(type => 
                    type >= 25 && type <= 28 || // Hardways
                    type >= 43 && type <= 53    // NEXT bets
                );
                expect(hasRiskyBets).to.be.true;
            });

            it("Should increase bets after wins", async function () {
                // Simulate a win
                const initialBet = parseEther("50");
                await botManager.updateBotSession(2, true, initialBet);
                
                const newBetAmount = await botManager.calculateBetAmount(2);
                expect(newBetAmount).to.be.gte(initialBet);
            });
        });

        describe("Martingale Strategy", function () {
            it("Should double bet after loss", async function () {
                const initialBet = parseEther("10");
                
                // Place initial bet and lose
                await botManager.updateBotSession(3, false, initialBet);
                
                const nextBet = await botManager.calculateBetAmount(3);
                expect(nextBet).to.equal(initialBet * 2n);
            });

            it("Should reset to base after win", async function () {
                const bot = await botManager.bots(3);
                
                // Lose twice, doubling each time
                await botManager.updateBotSession(3, false, parseEther("10"));
                await botManager.updateBotSession(3, false, parseEther("20"));
                
                // Win once
                await botManager.updateBotSession(3, true, parseEther("40"));
                
                // Should reset to base bet
                const nextBet = await botManager.calculateBetAmount(3);
                expect(nextBet).to.be.closeTo(bot.minBet, parseEther("5"));
            });

            it("Should cap at max bet", async function () {
                const bot = await botManager.bots(3);
                
                // Lose many times
                for (let i = 0; i < 10; i++) {
                    await botManager.updateBotSession(3, false, parseEther((2 ** i).toString()));
                }
                
                const nextBet = await botManager.calculateBetAmount(3);
                expect(nextBet).to.equal(bot.maxBet);
            });
        });

        describe("Fibonacci Strategy", function () {
            it("Should follow Fibonacci sequence on losses", async function () {
                await botManager.registerBot(
                    4,
                    vault1,
                    Strategies.FIBONACCI,
                    parseEther("1"),
                    parseEther("1000")
                );
                
                // Fibonacci sequence: 1, 1, 2, 3, 5, 8, 13, 21...
                const expectedSequence = [1, 1, 2, 3, 5, 8, 13, 21].map(n => parseEther(n.toString()));
                
                for (let i = 0; i < expectedSequence.length - 1; i++) {
                    const betAmount = await botManager.calculateBetAmount(4);
                    expect(betAmount).to.be.closeTo(expectedSequence[i], parseEther("0.5"));
                    
                    // Lose to progress in sequence
                    await botManager.updateBotSession(4, false, betAmount);
                }
            });

            it("Should step back in sequence on win", async function () {
                await botManager.registerBot(
                    4,
                    vault1,
                    Strategies.FIBONACCI,
                    parseEther("1"),
                    parseEther("1000")
                );
                
                // Progress to 5th position (5 units)
                await botManager.updateBotSession(4, false, parseEther("1"));
                await botManager.updateBotSession(4, false, parseEther("1"));
                await botManager.updateBotSession(4, false, parseEther("2"));
                await botManager.updateBotSession(4, false, parseEther("3"));
                
                // Win should step back
                await botManager.updateBotSession(4, true, parseEther("5"));
                
                const nextBet = await botManager.calculateBetAmount(4);
                expect(nextBet).to.be.closeTo(parseEther("2"), parseEther("0.5"));
            });
        });

        describe("Adaptive Strategy", function () {
            it("Should adjust based on bankroll", async function () {
                await botManager.registerBot(
                    5,
                    vault1,
                    Strategies.ADAPTIVE,
                    parseEther("1"),
                    parseEther("500")
                );
                
                const Vault = await hre.viem.getContractAt("CrapsVault", vault1);
                const initialBankroll = await Vault.totalAssets();
                
                const betAmount1 = await botManager.calculateBetAmount(5);
                
                // Simulate losses to reduce bankroll
                for (let i = 0; i < 5; i++) {
                    await botManager.updateBotSession(5, false, parseEther("100"));
                }
                
                const betAmount2 = await botManager.calculateBetAmount(5);
                
                // Should bet less with smaller bankroll
                expect(betAmount2).to.be.lt(betAmount1);
            });

            it("Should change bet types based on performance", async function () {
                await botManager.registerBot(
                    5,
                    vault1,
                    Strategies.ADAPTIVE,
                    parseEther("1"),
                    parseEther("500")
                );
                
                // Win streak
                for (let i = 0; i < 3; i++) {
                    await botManager.updateBotSession(5, true, parseEther("50"));
                }
                
                const winningBetTypes = await botManager.selectBetTypes(5);
                
                // Loss streak
                for (let i = 0; i < 5; i++) {
                    await botManager.updateBotSession(5, false, parseEther("50"));
                }
                
                const losingBetTypes = await botManager.selectBetTypes(5);
                
                // Should adjust strategy
                expect(winningBetTypes).to.not.deep.equal(losingBetTypes);
            });
        });
    });

    describe("Automated Betting", function () {
        beforeEach(async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            await botManager.registerBot(2, vault2, Strategies.AGGRESSIVE, parseEther("5"), parseEther("500"));
        });

        it("Should execute bets for all active bots", async function () {
            await expect(botManager.connect(keeper).executeBotBets())
                .to.emit(botManager, "BotBetsExecuted");
            
            // Check that bets were placed
            const bot1Bets = await bets.playerBetSummary(await botManager.getAddress());
            expect(bot1Bets.activeBetCount).to.be.greaterThan(0);
        });

        it("Should respect individual bot limits", async function () {
            await botManager.connect(keeper).executeBotBets();
            
            const bot1 = await botManager.bots(1);
            const bot2 = await botManager.bots(2);
            
            const session1 = await botManager.botSessions(1);
            const session2 = await botManager.botSessions(2);
            
            expect(session1.currentBet).to.be.lte(bot1.maxBet);
            expect(session2.currentBet).to.be.lte(bot2.maxBet);
        });

        it("Should skip bots with insufficient funds", async function () {
            // Drain vault2
            const Vault2 = await hre.viem.getContractAt("CrapsVault", vault2);
            await Vault2.withdraw(
                await Vault2.maxWithdraw(owner.address),
                owner.address,
                owner.address
            );
            
            await botManager.connect(keeper).executeBotBets();
            
            // Bot 1 should bet, bot 2 should be skipped
            const session1 = await botManager.botSessions(1);
            const session2 = await botManager.botSessions(2);
            
            expect(session1.totalBets).to.be.greaterThan(0);
            expect(session2.totalBets).to.equal(0);
        });

        it("Should handle VRF callbacks for random decisions", async function () {
            const tx = await botManager.requestRandomness();
            const receipt = await tx.wait();
            
            const requestEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'RandomnessRequested'
            );
            const requestId = requestEvent.args[0];
            
            // Fulfill with random value
            await vrfCoordinator.fulfillRandomWords(
                requestId,
                await botManager.getAddress(),
                [12345]
            );
            
            // Random value should be stored
            const lastRandom = await botManager.lastRandomValue();
            expect(lastRandom).to.be.greaterThan(0);
        });
    });

    describe("Session Management", function () {
        beforeEach(async function () {
            await botManager.registerBot(1, vault1, Strategies.MARTINGALE, parseEther("1"), parseEther("1000"));
        });

        it("Should track session statistics", async function () {
            await botManager.updateBotSession(1, true, parseEther("10"));
            await botManager.updateBotSession(1, false, parseEther("20"));
            await botManager.updateBotSession(1, true, parseEther("40"));
            
            const session = await botManager.botSessions(1);
            expect(session.wins).to.equal(2);
            expect(session.losses).to.equal(1);
            expect(session.totalBets).to.equal(3);
            expect(session.totalWagered).to.equal(parseEther("70"));
        });

        it("Should calculate win rate", async function () {
            for (let i = 0; i < 7; i++) {
                await botManager.updateBotSession(1, true, parseEther("10"));
            }
            for (let i = 0; i < 3; i++) {
                await botManager.updateBotSession(1, false, parseEther("10"));
            }
            
            const session = await botManager.botSessions(1);
            const winRate = (session.wins * 100n) / (session.wins + session.losses);
            expect(winRate).to.equal(70n); // 70% win rate
        });

        it("Should track profit/loss", async function () {
            const session = await botManager.botSessions(1);
            const initialProfit = session.totalProfit;
            
            // Win 100
            await botManager.updateBotSession(1, true, parseEther("50"));
            await botManager.recordPayout(1, parseEther("150")); // Bet + winnings
            
            // Lose 30
            await botManager.updateBotSession(1, false, parseEther("30"));
            
            const finalSession = await botManager.botSessions(1);
            expect(finalSession.totalProfit).to.equal(initialProfit + parseEther("70"));
        });

        it("Should reset session on command", async function () {
            // Build up session
            await botManager.updateBotSession(1, true, parseEther("10"));
            await botManager.updateBotSession(1, false, parseEther("20"));
            
            await botManager.resetBotSession(1);
            
            const session = await botManager.botSessions(1);
            expect(session.wins).to.equal(0);
            expect(session.losses).to.equal(0);
            expect(session.totalBets).to.equal(0);
            expect(session.currentBet).to.equal(0);
        });

        it("Should track consecutive wins/losses", async function () {
            // 3 consecutive wins
            for (let i = 0; i < 3; i++) {
                await botManager.updateBotSession(1, true, parseEther("10"));
            }
            
            let session = await botManager.botSessions(1);
            expect(session.consecutiveWins).to.equal(3);
            expect(session.consecutiveLosses).to.equal(0);
            
            // Loss breaks the streak
            await botManager.updateBotSession(1, false, parseEther("10"));
            
            session = await botManager.botSessions(1);
            expect(session.consecutiveWins).to.equal(0);
            expect(session.consecutiveLosses).to.equal(1);
        });
    });

    describe("Dynamic Strategy Switching", function () {
        beforeEach(async function () {
            await botManager.registerBot(1, vault1, Strategies.MIXED, parseEther("1"), parseEther("1000"));
        });

        it("Should switch strategies based on performance", async function () {
            const initialStrategy = (await botManager.bots(1)).currentStrategy;
            
            // Simulate poor performance
            for (let i = 0; i < 10; i++) {
                await botManager.updateBotSession(1, false, parseEther("50"));
            }
            
            await botManager.evaluateStrategySwitch(1);
            
            const newStrategy = (await botManager.bots(1)).currentStrategy;
            expect(newStrategy).to.not.equal(initialStrategy);
        });

        it("Should switch to conservative after big losses", async function () {
            // Big losses
            for (let i = 0; i < 5; i++) {
                await botManager.updateBotSession(1, false, parseEther("200"));
            }
            
            await botManager.evaluateStrategySwitch(1);
            
            const strategy = (await botManager.bots(1)).currentStrategy;
            expect(strategy).to.equal(Strategies.CONSERVATIVE);
        });

        it("Should switch to aggressive after winning streak", async function () {
            // Winning streak
            for (let i = 0; i < 7; i++) {
                await botManager.updateBotSession(1, true, parseEther("50"));
                await botManager.recordPayout(1, parseEther("100"));
            }
            
            await botManager.evaluateStrategySwitch(1);
            
            const strategy = (await botManager.bots(1)).currentStrategy;
            expect(strategy).to.equal(Strategies.AGGRESSIVE);
        });

        it("Should emit strategy change event", async function () {
            for (let i = 0; i < 10; i++) {
                await botManager.updateBotSession(1, false, parseEther("50"));
            }
            
            await expect(botManager.evaluateStrategySwitch(1))
                .to.emit(botManager, "StrategyChanged");
        });
    });

    describe("Access Control", function () {
        it("Should restrict bot registration to operator", async function () {
            await expect(botManager.connect(player1).registerBot(
                10,
                vault1,
                Strategies.AGGRESSIVE,
                parseEther("1"),
                parseEther("100")
            )).to.be.reverted;
        });

        it("Should restrict bet execution to keeper", async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            
            await expect(botManager.connect(player1).executeBotBets())
                .to.be.reverted;
        });

        it("Should allow strategist to update strategies", async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            
            await expect(botManager.connect(strategist).updateBotStrategy(1, Strategies.AGGRESSIVE))
                .to.not.be.reverted;
        });

        it("Should allow pausing bot operations", async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            
            await botManager.pause();
            
            await expect(botManager.connect(keeper).executeBotBets())
                .to.be.revertedWithCustomError(botManager, "EnforcedPause");
        });
    });

    describe("Bot Deactivation", function () {
        beforeEach(async function () {
            await botManager.registerBot(1, vault1, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            await botManager.registerBot(2, vault2, Strategies.AGGRESSIVE, parseEther("5"), parseEther("500"));
        });

        it("Should deactivate bot", async function () {
            await botManager.deactivateBot(1);
            
            expect(await botManager.isBotActive(1)).to.be.false;
            expect(await botManager.activeBotCount()).to.equal(1);
        });

        it("Should not execute bets for deactivated bots", async function () {
            await botManager.deactivateBot(1);
            await botManager.connect(keeper).executeBotBets();
            
            const session1 = await botManager.botSessions(1);
            const session2 = await botManager.botSessions(2);
            
            expect(session1.totalBets).to.equal(0);
            expect(session2.totalBets).to.be.greaterThan(0);
        });

        it("Should allow reactivation", async function () {
            await botManager.deactivateBot(1);
            await botManager.reactivateBot(1);
            
            expect(await botManager.isBotActive(1)).to.be.true;
        });

        it("Should emit deactivation event", async function () {
            await expect(botManager.deactivateBot(1))
                .to.emit(botManager, "BotDeactivated")
                .withArgs(1);
        });
    });

    describe("Gas Optimization", function () {
        it("Should efficiently execute multiple bot bets", async function () {
            // Register multiple bots
            for (let i = 1; i <= 5; i++) {
                await botManager.registerBot(
                    i,
                    vault1,
                    i % 2 === 0 ? Strategies.AGGRESSIVE : Strategies.CONSERVATIVE,
                    parseEther("1"),
                    parseEther("100")
                );
            }
            
            const tx = await botManager.connect(keeper).executeBotBets();
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            // Gas per bot should be reasonable
            const gasPerBot = gasUsed.gasUsed / 5n;
            expect(gasPerBot).to.be.lessThan(200000n);
        });

        it("Should batch process bot updates efficiently", async function () {
            await botManager.registerBot(1, vault1, Strategies.MARTINGALE, parseEther("1"), parseEther("1000"));
            
            const updates = [];
            for (let i = 0; i < 10; i++) {
                updates.push(
                    botManager.updateBotSession(1, i % 2 === 0, parseEther("10"))
                );
            }
            
            const receipts = await Promise.all(updates);
            const totalGas = receipts.reduce((sum, r) => sum + r.gasUsed, 0n);
            const avgGas = totalGas / 10n;
            
            expect(avgGas).to.be.lessThan(100000n);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle bot with zero balance", async function () {
            const emptyVault = await TestHelpers.createVault(vaultFactory, 10, "Empty Bot", await botManager.getAddress());
            
            await botManager.registerBot(10, emptyVault, Strategies.CONSERVATIVE, parseEther("1"), parseEther("100"));
            
            // Should not crash when trying to bet
            await expect(botManager.connect(keeper).executeBotBets())
                .to.not.be.reverted;
            
            const session = await botManager.botSessions(10);
            expect(session.totalBets).to.equal(0);
        });

        it("Should handle extreme win/loss streaks", async function () {
            await botManager.registerBot(1, vault1, Strategies.MARTINGALE, parseEther("0.001"), parseEther("10000"));
            
            // Extreme loss streak
            for (let i = 0; i < 20; i++) {
                await botManager.updateBotSession(1, false, parseEther((1.5 ** i).toFixed(6)));
            }
            
            const session = await botManager.botSessions(1);
            expect(session.losses).to.equal(20);
            
            // Should still be able to calculate next bet
            const nextBet = await botManager.calculateBetAmount(1);
            expect(nextBet).to.be.lte((await botManager.bots(1)).maxBet);
        });

        it("Should handle rapid strategy switches", async function () {
            await botManager.registerBot(1, vault1, Strategies.MIXED, parseEther("1"), parseEther("1000"));
            
            // Rapidly switch strategies
            const strategies = [
                Strategies.CONSERVATIVE,
                Strategies.AGGRESSIVE,
                Strategies.MARTINGALE,
                Strategies.FIBONACCI,
                Strategies.ADAPTIVE
            ];
            
            for (const strategy of strategies) {
                await botManager.connect(strategist).updateBotStrategy(1, strategy);
                const bot = await botManager.bots(1);
                expect(bot.currentStrategy).to.equal(strategy);
            }
        });

        it("Should handle maximum number of bots", async function () {
            const maxBots = 20;
            const registrations = [];
            
            for (let i = 1; i <= maxBots; i++) {
                registrations.push(
                    botManager.registerBot(
                        i,
                        vault1,
                        Strategies.CONSERVATIVE,
                        parseEther("0.1"),
                        parseEther("10")
                    )
                );
            }
            
            await Promise.all(registrations);
            expect(await botManager.activeBotCount()).to.equal(maxBots);
        });
    });
});