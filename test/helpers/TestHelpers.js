import hre from "hardhat";
import { expect } from "chai";
import { parseEther, pad, toHex } from "viem";

/**
 * Test helper utilities for Craps game testing
 */
class TestHelpers {
    /**
     * Deploy all contracts for testing
     */
    static async deployContracts() {
        // Get wallet clients (signers)
        const [owner, player1, player2, player3, bot1, bot2, keeper] = await hre.viem.getWalletClients();
        
        // Get public client
        const publicClient = await hre.viem.getPublicClient();

        // Deploy mock VRF Coordinator
        const vrfCoordinator = await hre.viem.deployContract("MockVRFCoordinator");

        // Deploy mock USDC token
        const usdc = await hre.viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);

        // Deploy game contracts
        const keyHash = pad(toHex("keyHash"), { size: 32 });
        const game = await hre.viem.deployContract("CrapsGame", [
            vrfCoordinator.address,
            1n, // subscriptionId
            keyHash
        ]);

        const bets = await hre.viem.deployContract("CrapsBets");
        const settlement = await hre.viem.deployContract("CrapsSettlement");

        // Deploy vault factory
        const vaultFactory = await hre.viem.deployContract("VaultFactory", [
            usdc.address,
            game.address,
            bets.address
        ]);

        // Deploy BotManager
        const botManager = await hre.viem.deployContract("BotManager", [
            game.address,
            bets.address,
            vaultFactory.address
        ]);

        // Setup roles and connections
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const GAME_ROLE = pad(toHex("GAME_ROLE"), { size: 32 });
        const VAULT_ROLE = pad(toHex("VAULT_ROLE"), { size: 32 });
        const KEEPER_ROLE = pad(toHex("KEEPER_ROLE"), { size: 32 });

        // Grant roles
        await game.write.grantRole([KEEPER_ROLE, keeper.account.address]);
        await bets.write.initialize([game.address, settlement.address]);
        await settlement.write.initialize([game.address, bets.address]);
        await game.write.setBetsContract([bets.address]);
        await game.write.setSettlementContract([settlement.address]);

        // Mint USDC to players
        const mintAmount = parseEther("10000");
        await usdc.write.mint([player1.account.address, mintAmount]);
        await usdc.write.mint([player2.account.address, mintAmount]);
        await usdc.write.mint([player3.account.address, mintAmount]);
        await usdc.write.mint([bot1.account.address, mintAmount]);
        await usdc.write.mint([bot2.account.address, mintAmount]);

        return {
            publicClient,
            owner,
            player1,
            player2,
            player3,
            bot1,
            bot2,
            keeper,
            game,
            bets,
            settlement,
            vrfCoordinator,
            usdc,
            vaultFactory,
            botManager
        };
    }

    /**
     * Setup a new game series
     */
    static async setupNewSeries(game, vrfCoordinator, keeper) {
        // Start new series
        await game.write.startNewSeries({ account: keeper.account });
        
        // Get request ID
        const requestId = await vrfCoordinator.read.lastRequestId();
        
        // Fulfill randomness
        const randomWords = [BigInt(Math.floor(Math.random() * 1000000))];
        await vrfCoordinator.write.fulfillRandomWords([requestId, randomWords]);
        
        const seriesId = await game.read.currentSeriesId();
        const gamePhase = await game.read.gamePhase();
        
        return { seriesId, gamePhase, requestId };
    }

    /**
     * Roll dice with specific values
     */
    static async rollDice(game, vrfCoordinator, keeper, die1, die2) {
        // Request roll
        await game.write.rollDice({ account: keeper.account });
        
        // Get request ID
        const requestId = await vrfCoordinator.read.lastRequestId();
        
        // Calculate random words to produce desired dice
        const randomWord = BigInt(die1 - 1) + (BigInt(die2 - 1) * 6n);
        await vrfCoordinator.write.fulfillRandomWords([requestId, [randomWord]]);
        
        return { die1, die2, total: die1 + die2 };
    }

    /**
     * Place a bet
     */
    static async placeBet(bets, player, betType, amount, betValue = 0) {
        const usdcAddress = await bets.read.getAssetToken();
        const usdc = await hre.viem.getContractAt("MockERC20", usdcAddress);
        
        // Approve tokens
        await usdc.write.approve([bets.address, amount], { account: player.account });
        
        // Place bet
        await bets.write.placeBet([betType, amount, betValue], { account: player.account });
    }

    /**
     * Advance time
     */
    static async advanceTime(seconds) {
        const testClient = await hre.viem.getTestClient();
        await testClient.increaseTime({ seconds });
        await testClient.mine({ blocks: 1 });
    }

    /**
     * Get current block timestamp
     */
    static async getBlockTimestamp() {
        const publicClient = await hre.viem.getPublicClient();
        const block = await publicClient.getBlock();
        return block.timestamp;
    }

    /**
     * Calculate expected payout
     */
    static calculatePayout(amount, multiplier) {
        return (amount * BigInt(multiplier)) / 100n;
    }

    /**
     * Verify bet state
     */
    static async verifyBet(bets, player, betType, expectedState) {
        const bet = await bets.read.getPlayerBet([player.account.address, betType]);
        
        if (expectedState.amount !== undefined) {
            expect(bet.amount).to.equal(expectedState.amount);
        }
        if (expectedState.isActive !== undefined) {
            expect(bet.isActive).to.equal(expectedState.isActive);
        }
        if (expectedState.betValue !== undefined) {
            expect(bet.betValue).to.equal(expectedState.betValue);
        }
        if (expectedState.seriesId !== undefined) {
            expect(bet.seriesId).to.equal(expectedState.seriesId);
        }
        
        return bet;
    }

    /**
     * Get all active bets for a player
     */
    static async getActiveBets(bets, player) {
        const activeBets = [];
        
        // Check all 64 bet types
        for (let i = 0; i < 64; i++) {
            const bet = await bets.read.getPlayerBet([player.account.address, i]);
            if (bet.isActive) {
                activeBets.push({
                    betType: i,
                    ...bet
                });
            }
        }
        
        return activeBets;
    }

    /**
     * Calculate total bet amounts
     */
    static async calculateTotalBets(bets, players) {
        let total = 0n;
        
        for (const player of players) {
            const activeBets = await this.getActiveBets(bets, player);
            for (const bet of activeBets) {
                total += bet.amount;
            }
        }
        
        return total;
    }
}

export default TestHelpers;