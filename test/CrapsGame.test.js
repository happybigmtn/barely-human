import hre from "hardhat";
import { expect } from "chai";
import { parseEther } from "viem";
import TestHelpers from "./helpers/TestHelpers.js";

describe("CrapsGame", function () {
    async function deployFixture() {
        return await TestHelpers.deployContracts();
    }
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { game, owner } = await hre.network.helpers.loadFixture(deployFixture);
            const DEFAULT_ADMIN_ROLE = await game.read.DEFAULT_ADMIN_ROLE();
            expect(await game.read.hasRole([DEFAULT_ADMIN_ROLE, owner.account.address])).to.be.true;
        });

        it("Should initialize with IDLE phase", async function () {
            const { game } = await hre.network.helpers.loadFixture(deployFixture);
            expect(await game.read.currentPhase()).to.equal(0); // Phase.IDLE
        });

        it("Should have correct VRF configuration", async function () {
            const { game } = await hre.network.helpers.loadFixture(deployFixture);
            expect(await game.read.s_subscriptionId()).to.equal(1n);
        });
    });

    describe("Series Management", function () {
        it("Should start a new series", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            await expect(game.write.startNewSeries({ account: keeper.account }))
                .to.emit(game, "SeriesStarted");
            
            expect(await game.read.currentSeriesId()).to.equal(1n);
            expect(await game.read.currentPhase()).to.equal(1); // Phase.COME_OUT
        });

        it("Should not allow non-keeper to start series", async function () {
            const { game, player1 } = await hre.network.helpers.loadFixture(deployFixture);
            
            await expect(game.write.startNewSeries({ account: player1.account }))
                .to.be.rejectedWith("AccessControl");
        });

        it("Should handle come out roll win", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series
            await game.write.startNewSeries({ account: keeper.account });
            
            // Roll a 7 (instant win)
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 4);
            
            const lastRoll = await game.read.getCurrentRoll();
            expect(lastRoll.die1 + lastRoll.die2).to.equal(7);
            expect(await game.read.currentPhase()).to.equal(0); // Back to IDLE
        });

        it("Should establish point on come out roll", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series
            await game.write.startNewSeries({ account: keeper.account });
            
            // Roll a 6 (establish point)
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 3);
            
            expect(await game.read.currentPoint()).to.equal(6);
            expect(await game.read.currentPhase()).to.equal(2); // Phase.POINT
        });

        it("Should handle point phase win", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series and establish point
            await game.write.startNewSeries({ account: keeper.account });
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 3); // Point = 6
            
            // Roll the point again (win)
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 2, 4);
            
            expect(await game.read.currentPhase()).to.equal(0); // Back to IDLE
        });

        it("Should handle point phase loss", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series and establish point
            await game.write.startNewSeries({ account: keeper.account });
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 3); // Point = 6
            
            // Roll a 7 (lose)
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 4);
            
            expect(await game.read.currentPhase()).to.equal(0); // Back to IDLE
        });
    });

    describe("Roll History", function () {
        it("Should track roll history", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series and make multiple rolls
            await game.write.startNewSeries({ account: keeper.account });
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 3);
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 2, 4);
            
            const history = await game.read.getRollHistory([1n]);
            expect(history.length).to.equal(2);
            expect(history[0].total).to.equal(6);
            expect(history[1].total).to.equal(6);
        });

        it("Should limit roll history to 100 rolls", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Start series
            await game.write.startNewSeries({ account: keeper.account });
            
            // Make many rolls
            for (let i = 0; i < 10; i++) {
                await TestHelpers.rollDice(game, vrfCoordinator, keeper, 2, 3);
            }
            
            const history = await game.read.getRollHistory([1n]);
            expect(history.length).to.be.lessThanOrEqual(100);
        });
    });

    describe("Access Control", function () {
        it("Should only allow keeper to roll dice", async function () {
            const { game, vrfCoordinator, keeper, player1 } = await hre.network.helpers.loadFixture(deployFixture);
            
            await game.write.startNewSeries({ account: keeper.account });
            
            await expect(game.write.rollDice({ account: player1.account }))
                .to.be.rejectedWith("AccessControl");
        });

        it("Should allow admin to grant roles", async function () {
            const { game, owner, player1 } = await hre.network.helpers.loadFixture(deployFixture);
            
            const KEEPER_ROLE = await game.read.KEEPER_ROLE();
            await game.write.grantRole([KEEPER_ROLE, player1.account.address], { account: owner.account });
            
            expect(await game.read.hasRole([KEEPER_ROLE, player1.account.address])).to.be.true;
        });

        it("Should allow admin to revoke roles", async function () {
            const { game, owner, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            const KEEPER_ROLE = await game.read.KEEPER_ROLE();
            await game.write.revokeRole([KEEPER_ROLE, keeper.account.address], { account: owner.account });
            
            expect(await game.read.hasRole([KEEPER_ROLE, keeper.account.address])).to.be.false;
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause", async function () {
            const { game, owner } = await hre.network.helpers.loadFixture(deployFixture);
            
            await game.write.pause({ account: owner.account });
            expect(await game.read.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { game, owner, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            await game.write.pause({ account: owner.account });
            
            await expect(game.write.startNewSeries({ account: keeper.account }))
                .to.be.rejectedWith("Pausable");
        });

        it("Should allow admin to unpause", async function () {
            const { game, owner, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            await game.write.pause({ account: owner.account });
            await game.write.unpause({ account: owner.account });
            
            expect(await game.read.paused()).to.be.false;
            
            // Should work again
            await expect(game.write.startNewSeries({ account: keeper.account }))
                .to.not.be.rejected;
        });
    });

    describe("Edge Cases", function () {
        it("Should not allow rolling without active series", async function () {
            const { game, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            await expect(game.write.rollDice({ account: keeper.account }))
                .to.be.rejectedWith("No active series");
        });

        it("Should handle series completion correctly", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Complete a series
            await game.write.startNewSeries({ account: keeper.account });
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 4); // Win on come out
            
            // Try to roll again
            await expect(game.write.rollDice({ account: keeper.account }))
                .to.be.rejectedWith("No active series");
        });

        it("Should track series statistics", async function () {
            const { game, vrfCoordinator, keeper } = await hre.network.helpers.loadFixture(deployFixture);
            
            // Play a series
            await game.write.startNewSeries({ account: keeper.account });
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 3, 3); // Establish point
            await TestHelpers.rollDice(game, vrfCoordinator, keeper, 2, 4); // Hit point
            
            const seriesData = await game.read.getSeriesData([1n]);
            expect(seriesData.rollCount).to.equal(2n);
            expect(seriesData.isComplete).to.be.true;
        });
    });
});