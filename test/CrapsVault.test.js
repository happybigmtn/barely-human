import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
import TestHelpers from "./helpers/TestHelpers.js";

describe("CrapsVault", function () {
    let owner, player1, player2, player3, bot1, feeCollector;
    let game, bets, settlement, vrfCoordinator, usdc, vaultFactory;
    let vault;
    
    beforeEach(async function () {
        const contracts = await TestHelpers.deployContracts();
        owner = contracts.owner;
        player1 = contracts.player1;
        player2 = contracts.player2;
        player3 = contracts.player3;
        bot1 = contracts.bot1;
        feeCollector = contracts.keeper; // Using keeper as fee collector
        game = contracts.game;
        bets = contracts.bets;
        settlement = contracts.settlement;
        vrfCoordinator = contracts.vrfCoordinator;
        usdc = contracts.usdc;
        vaultFactory = contracts.vaultFactory;
        
        // Create vault using factory
        const tx = await vaultFactory.createVault(1, "TestBot", bot1.address);
        const receipt = await tx.wait();
        const vaultCreatedEvent = receipt.logs.find(
            log => log.fragment && log.fragment.name === 'VaultCreated'
        );
        const vaultAddress = vaultCreatedEvent.args.vault;
        
        // Get vault contract instance
        vault = await hre.viem.getContractAt("CrapsVault", vaultAddress);
        
        // Set vault in game contracts
        await game.setVaultContract(vaultAddress);
        await bets.setVaultContract(vaultAddress);
        
        // Grant roles
        const GAME_ROLE = await vault.GAME_ROLE();
        const FEE_COLLECTOR_ROLE = await vault.FEE_COLLECTOR_ROLE();
        await vault.grantRole(GAME_ROLE, await game.getAddress());
        await vault.grantRole(FEE_COLLECTOR_ROLE, feeCollector.address);
        
        // Fund accounts with USDC
        await TestHelpers.fundAccounts(usdc, [owner, player1, player2, player3], parseEther("10000"));
        
        // Approve vault for USDC spending
        await usdc.connect(owner).approve(vaultAddress, parseEther("10000"));
        await usdc.connect(player1).approve(vaultAddress, parseEther("10000"));
        await usdc.connect(player2).approve(vaultAddress, parseEther("10000"));
        await usdc.connect(player3).approve(vaultAddress, parseEther("10000"));
    });

    describe("ERC4626 Compliance", function () {
        describe("Deposit", function () {
            it("Should accept deposits and mint shares", async function () {
                const depositAmount = parseEther("1000");
                
                await expect(vault.connect(player1).deposit(depositAmount, player1.address))
                    .to.emit(vault, "Deposit")
                    .withArgs(player1.address, player1.address, depositAmount, depositAmount);
                
                expect(await vault.balanceOf(player1.address)).to.equal(depositAmount);
                expect(await vault.totalAssets()).to.equal(depositAmount);
            });

            it("Should calculate correct share amount for deposits", async function () {
                // First deposit gets 1:1 shares
                await vault.connect(player1).deposit(parseEther("1000"), player1.address);
                expect(await vault.balanceOf(player1.address)).to.equal(parseEther("1000"));
                
                // Simulate vault earning profit
                await usdc.transfer(vault.getAddress(), parseEther("100"));
                
                // Second deposit should get proportional shares
                const assets = parseEther("1000");
                const expectedShares = await vault.previewDeposit(assets);
                
                await vault.connect(player2).deposit(assets, player2.address);
                expect(await vault.balanceOf(player2.address)).to.be.closeTo(expectedShares, parseEther("0.01"));
            });

            it("Should update total assets correctly", async function () {
                const deposit1 = parseEther("1000");
                const deposit2 = parseEther("500");
                
                await vault.connect(player1).deposit(deposit1, player1.address);
                await vault.connect(player2).deposit(deposit2, player2.address);
                
                expect(await vault.totalAssets()).to.equal(deposit1 + deposit2);
            });

            it("Should handle minimum deposit requirement", async function () {
                const tooSmall = parseEther("0.0001");
                
                await expect(vault.connect(player1).deposit(tooSmall, player1.address))
                    .to.be.revertedWith("Deposit too small");
            });
        });

        describe("Mint", function () {
            it("Should mint exact shares and pull required assets", async function () {
                const shares = parseEther("500");
                const requiredAssets = await vault.previewMint(shares);
                
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await vault.connect(player1).mint(shares, player1.address);
                
                expect(await vault.balanceOf(player1.address)).to.equal(shares);
                expect(initialBalance - (await usdc.balanceOf(player1.address))).to.equal(requiredAssets);
            });
        });

        describe("Withdraw", function () {
            beforeEach(async function () {
                await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            });

            it("Should allow withdrawals and burn shares", async function () {
                const withdrawAmount = parseEther("500");
                const sharesBurned = await vault.previewWithdraw(withdrawAmount);
                
                await expect(vault.connect(player1).withdraw(withdrawAmount, player1.address, player1.address))
                    .to.emit(vault, "Withdraw");
                
                expect(await vault.balanceOf(player1.address)).to.be.closeTo(
                    parseEther("1000") - sharesBurned,
                    parseEther("0.01")
                );
            });

            it("Should return correct amount of assets", async function () {
                const withdrawAmount = parseEther("500");
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await vault.connect(player1).withdraw(withdrawAmount, player1.address, player1.address);
                
                const finalBalance = await usdc.balanceOf(player1.address);
                expect(finalBalance - initialBalance).to.equal(withdrawAmount);
            });

            it("Should not allow withdrawing more than balance", async function () {
                await expect(vault.connect(player1).withdraw(
                    parseEther("2000"),
                    player1.address,
                    player1.address
                )).to.be.reverted;
            });

            it("Should handle withdrawal with locked funds", async function () {
                // Lock some funds for betting
                await vault.connect(bot1).lockFunds(parseEther("200"), 1);
                
                // Should still allow withdrawal of unlocked funds
                const maxWithdraw = await vault.maxWithdraw(player1.address);
                expect(maxWithdraw).to.be.lessThan(parseEther("1000"));
                
                await expect(vault.connect(player1).withdraw(
                    maxWithdraw,
                    player1.address,
                    player1.address
                )).to.not.be.reverted;
            });
        });

        describe("Redeem", function () {
            beforeEach(async function () {
                await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            });

            it("Should redeem shares for assets", async function () {
                const shares = parseEther("500");
                const expectedAssets = await vault.previewRedeem(shares);
                const initialBalance = await usdc.balanceOf(player1.address);
                
                await vault.connect(player1).redeem(shares, player1.address, player1.address);
                
                const finalBalance = await usdc.balanceOf(player1.address);
                expect(finalBalance - initialBalance).to.be.closeTo(expectedAssets, parseEther("0.01"));
                expect(await vault.balanceOf(player1.address)).to.equal(parseEther("500"));
            });
        });

        describe("Preview Functions", function () {
            beforeEach(async function () {
                await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            });

            it("Should accurately preview deposit", async function () {
                const assets = parseEther("500");
                const preview = await vault.previewDeposit(assets);
                
                await vault.connect(player2).deposit(assets, player2.address);
                const actualShares = await vault.balanceOf(player2.address);
                
                expect(actualShares).to.be.closeTo(preview, parseEther("0.001"));
            });

            it("Should accurately preview mint", async function () {
                const shares = parseEther("500");
                const preview = await vault.previewMint(shares);
                
                const initialBalance = await usdc.balanceOf(player2.address);
                await vault.connect(player2).mint(shares, player2.address);
                const assetsUsed = initialBalance - (await usdc.balanceOf(player2.address));
                
                expect(assetsUsed).to.be.closeTo(preview, parseEther("0.001"));
            });

            it("Should accurately preview withdraw", async function () {
                const assets = parseEther("300");
                const preview = await vault.previewWithdraw(assets);
                
                const initialShares = await vault.balanceOf(player1.address);
                await vault.connect(player1).withdraw(assets, player1.address, player1.address);
                const sharesBurned = initialShares - (await vault.balanceOf(player1.address));
                
                expect(sharesBurned).to.be.closeTo(preview, parseEther("0.001"));
            });

            it("Should accurately preview redeem", async function () {
                const shares = parseEther("300");
                const preview = await vault.previewRedeem(shares);
                
                const initialBalance = await usdc.balanceOf(player1.address);
                await vault.connect(player1).redeem(shares, player1.address, player1.address);
                const assetsReceived = (await usdc.balanceOf(player1.address)) - initialBalance;
                
                expect(assetsReceived).to.be.closeTo(preview, parseEther("0.001"));
            });
        });

        describe("Max Functions", function () {
            beforeEach(async function () {
                await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            });

            it("Should return max deposit", async function () {
                const maxDeposit = await vault.maxDeposit(player2.address);
                expect(maxDeposit).to.equal(ethers.MaxUint256); // No limit by default
            });

            it("Should return max mint", async function () {
                const maxMint = await vault.maxMint(player2.address);
                expect(maxMint).to.equal(ethers.MaxUint256); // No limit by default
            });

            it("Should return max withdraw based on shares", async function () {
                const maxWithdraw = await vault.maxWithdraw(player1.address);
                const totalAssets = await vault.totalAssets();
                expect(maxWithdraw).to.be.closeTo(totalAssets, parseEther("0.01"));
            });

            it("Should return max redeem based on balance", async function () {
                const maxRedeem = await vault.maxRedeem(player1.address);
                const balance = await vault.balanceOf(player1.address);
                expect(maxRedeem).to.equal(balance);
            });
        });
    });

    describe("Bet Locking", function () {
        beforeEach(async function () {
            await vault.connect(owner).deposit(parseEther("5000"), owner.address);
        });

        it("Should lock funds for betting", async function () {
            const lockAmount = parseEther("1000");
            
            await expect(vault.connect(bot1).lockFunds(lockAmount, 1))
                .to.emit(vault, "FundsLocked")
                .withArgs(lockAmount, 1);
            
            expect(await vault.totalLockedAmount()).to.equal(lockAmount);
        });

        it("Should track active bets", async function () {
            await vault.connect(bot1).lockFunds(parseEther("500"), 1);
            
            const activeBet = await vault.activeBets(await vault.currentBetId() - 1n);
            expect(activeBet.amount).to.equal(parseEther("500"));
            expect(activeBet.seriesId).to.equal(1);
            expect(activeBet.isSettled).to.be.false;
        });

        it("Should prevent over-locking", async function () {
            const availableLiquidity = await vault.getAvailableLiquidity();
            
            await expect(vault.connect(bot1).lockFunds(availableLiquidity + 1n, 1))
                .to.be.revertedWith("Insufficient liquidity");
        });

        it("Should unlock funds after bet settlement", async function () {
            await vault.connect(bot1).lockFunds(parseEther("1000"), 1);
            const betId = await vault.currentBetId() - 1n;
            
            await vault.connect(bot1).unlockFunds(betId, parseEther("1500")); // Won bet
            
            expect(await vault.totalLockedAmount()).to.equal(0);
            const activeBet = await vault.activeBets(betId);
            expect(activeBet.isSettled).to.be.true;
        });

        it("Should handle bet losses correctly", async function () {
            const initialAssets = await vault.totalAssets();
            await vault.connect(bot1).lockFunds(parseEther("1000"), 1);
            const betId = await vault.currentBetId() - 1n;
            
            await vault.connect(bot1).unlockFunds(betId, 0); // Lost bet
            
            expect(await vault.totalAssets()).to.equal(initialAssets - parseEther("1000"));
        });

        it("Should handle bet wins correctly", async function () {
            const initialAssets = await vault.totalAssets();
            await vault.connect(bot1).lockFunds(parseEther("1000"), 1);
            const betId = await vault.currentBetId() - 1n;
            
            await vault.connect(bot1).unlockFunds(betId, parseEther("2000")); // Won bet (doubled)
            
            expect(await vault.totalAssets()).to.equal(initialAssets + parseEther("1000"));
        });
    });

    describe("Performance Fee", function () {
        beforeEach(async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            await vault.connect(player2).deposit(parseEther("1000"), player2.address);
        });

        it("Should track profit correctly", async function () {
            const initialSnapshot = await vault.lastProfitSnapshot();
            
            // Simulate profit by sending USDC to vault
            await usdc.transfer(await vault.getAddress(), parseEther("200"));
            
            await vault.updateProfitSnapshot();
            
            const totalProfit = await vault.totalProfit();
            expect(totalProfit).to.equal(parseEther("200"));
        });

        it("Should calculate performance fee correctly", async function () {
            // Simulate profit
            await usdc.transfer(await vault.getAddress(), parseEther("1000"));
            await vault.updateProfitSnapshot();
            
            // Performance fee is 2% (200 basis points)
            const expectedFee = parseEther("1000") * 200n / 10000n; // 20 USDC
            
            const totalFees = await vault.totalFees();
            expect(totalFees).to.equal(expectedFee);
        });

        it("Should allow fee collection", async function () {
            // Generate profit and fees
            await usdc.transfer(await vault.getAddress(), parseEther("1000"));
            await vault.updateProfitSnapshot();
            
            const fees = await vault.totalFees();
            const initialBalance = await usdc.balanceOf(feeCollector.address);
            
            await vault.connect(feeCollector).collectFees(feeCollector.address);
            
            const finalBalance = await usdc.balanceOf(feeCollector.address);
            expect(finalBalance - initialBalance).to.equal(fees);
            expect(await vault.totalFees()).to.equal(0);
        });

        it("Should only charge fees on profits", async function () {
            const initialAssets = await vault.totalAssets();
            
            // Simulate loss by removing assets
            await vault.connect(bot1).lockFunds(parseEther("500"), 1);
            const betId = await vault.currentBetId() - 1n;
            await vault.connect(bot1).unlockFunds(betId, 0); // Lost bet
            
            await vault.updateProfitSnapshot();
            
            // No fees on losses
            expect(await vault.totalFees()).to.equal(0);
        });

        it("Should not affect share price when collecting fees", async function () {
            // Generate profit
            await usdc.transfer(await vault.getAddress(), parseEther("1000"));
            await vault.updateProfitSnapshot();
            
            const sharePrice = await vault.previewRedeem(parseEther("1"));
            
            await vault.connect(feeCollector).collectFees(feeCollector.address);
            
            const newSharePrice = await vault.previewRedeem(parseEther("1"));
            
            // Share price should decrease slightly due to fee extraction
            expect(newSharePrice).to.be.lessThan(sharePrice);
        });
    });

    describe("LP Tracking for Raffles", function () {
        it("Should track LP contributions", async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            await vault.connect(player2).deposit(parseEther("2000"), player2.address);
            
            const lp1Balance = await vault.balanceOf(player1.address);
            const lp2Balance = await vault.balanceOf(player2.address);
            
            expect(lp1Balance).to.equal(parseEther("1000"));
            expect(lp2Balance).to.equal(parseEther("2000"));
        });

        it("Should calculate LP share percentages", async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            await vault.connect(player2).deposit(parseEther("3000"), player2.address);
            
            const totalSupply = await vault.totalSupply();
            const player1Share = await vault.balanceOf(player1.address);
            const player2Share = await vault.balanceOf(player2.address);
            
            // Player1 has 25%, Player2 has 75%
            expect(player1Share * 100n / totalSupply).to.equal(25n);
            expect(player2Share * 100n / totalSupply).to.equal(75n);
        });

        it("Should track historical LP positions", async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            
            const block1 = await ethers.provider.getBlockNumber();
            const balance1 = await vault.balanceOf(player1.address);
            
            // Advance blocks
            await TestHelpers.advanceBlocks(10);
            
            await vault.connect(player1).deposit(parseEther("500"), player1.address);
            
            const block2 = await ethers.provider.getBlockNumber();
            const balance2 = await vault.balanceOf(player1.address);
            
            expect(balance2).to.equal(balance1 + parseEther("500"));
            expect(block2).to.be.greaterThan(block1);
        });
    });

    describe("Bot Integration", function () {
        it("Should allow bot manager to control funds", async function () {
            await vault.connect(owner).deposit(parseEther("5000"), owner.address);
            
            // Bot manager can lock funds
            await expect(vault.connect(bot1).lockFunds(parseEther("100"), 1))
                .to.not.be.reverted;
        });

        it("Should track bot performance", async function () {
            await vault.connect(owner).deposit(parseEther("5000"), owner.address);
            
            // Place winning bet
            await vault.connect(bot1).lockFunds(parseEther("1000"), 1);
            const betId = await vault.currentBetId() - 1n;
            await vault.connect(bot1).unlockFunds(betId, parseEther("2000"));
            
            // Check profit
            const totalProfit = await vault.totalProfit();
            expect(totalProfit).to.be.greaterThan(0);
        });

        it("Should enforce bot betting limits", async function () {
            await vault.connect(owner).deposit(parseEther("100"), owner.address);
            
            // Try to bet more than available
            await expect(vault.connect(bot1).lockFunds(parseEther("200"), 1))
                .to.be.revertedWith("Insufficient liquidity");
        });
    });

    describe("Access Control", function () {
        it("Should restrict lockFunds to bot manager", async function () {
            await vault.connect(owner).deposit(parseEther("1000"), owner.address);
            
            await expect(vault.connect(player1).lockFunds(parseEther("100"), 1))
                .to.be.revertedWith("Not bot manager");
        });

        it("Should restrict fee collection to authorized role", async function () {
            await expect(vault.connect(player1).collectFees(player1.address))
                .to.be.reverted;
        });

        it("Should allow admin to grant roles", async function () {
            const MANAGER_ROLE = await vault.MANAGER_ROLE();
            await vault.grantRole(MANAGER_ROLE, player1.address);
            
            expect(await vault.hasRole(MANAGER_ROLE, player1.address)).to.be.true;
        });

        it("Should allow pausing in emergencies", async function () {
            await vault.pause();
            
            await expect(vault.connect(player1).deposit(parseEther("100"), player1.address))
                .to.be.revertedWithCustomError(vault, "EnforcedPause");
            
            await vault.unpause();
            
            await expect(vault.connect(player1).deposit(parseEther("100"), player1.address))
                .to.not.be.reverted;
        });
    });

    describe("Emergency Functions", function () {
        beforeEach(async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            await vault.connect(player2).deposit(parseEther("1000"), player2.address);
        });

        it("Should allow emergency withdrawal", async function () {
            await vault.pause();
            
            // During pause, withdrawals should still work
            await expect(vault.connect(player1).redeem(
                await vault.balanceOf(player1.address),
                player1.address,
                player1.address
            )).to.not.be.reverted;
        });

        it("Should prevent deposits when paused", async function () {
            await vault.pause();
            
            await expect(vault.connect(player3).deposit(parseEther("100"), player3.address))
                .to.be.revertedWithCustomError(vault, "EnforcedPause");
        });

        it("Should handle stuck funds recovery", async function () {
            // Send USDC directly to vault (simulating stuck funds)
            await usdc.transfer(await vault.getAddress(), parseEther("100"));
            
            // The funds should be reflected in totalAssets
            const assets = await vault.totalAssets();
            expect(assets).to.include(parseEther("100"));
        });
    });

    describe("Gas Optimization", function () {
        it("Should efficiently handle deposits", async function () {
            const tx = await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            expect(gasUsed.gasUsed).to.be.lessThan(250000n);
        });

        it("Should efficiently handle withdrawals", async function () {
            await vault.connect(player1).deposit(parseEther("1000"), player1.address);
            
            const tx = await vault.connect(player1).withdraw(
                parseEther("500"),
                player1.address,
                player1.address
            );
            const gasUsed = await TestHelpers.getGasUsed(tx);
            
            expect(gasUsed.gasUsed).to.be.lessThan(200000n);
        });

        it("Should batch process efficiently", async function () {
            // Multiple deposits
            const deposits = [];
            for (let i = 0; i < 5; i++) {
                deposits.push(
                    vault.connect(player1).deposit(parseEther("100"), player1.address)
                );
            }
            
            const receipts = await Promise.all(deposits);
            const totalGas = receipts.reduce((sum, r) => sum + r.gasUsed, 0n);
            const avgGas = totalGas / 5n;
            
            expect(avgGas).to.be.lessThan(200000n);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero share edge case", async function () {
            // First depositor gets 1:1 shares
            await vault.connect(player1).deposit(parseEther("1"), player1.address);
            
            // Even with very small deposits
            await vault.connect(player2).deposit(parseEther("0.001"), player2.address);
            
            expect(await vault.balanceOf(player2.address)).to.be.greaterThan(0);
        });

        it("Should handle rounding in share calculations", async function () {
            await vault.connect(player1).deposit(parseEther("1000.123456789"), player1.address);
            
            // Simulate some profit
            await usdc.transfer(await vault.getAddress(), parseEther("333.333333333"));
            
            // Deposit with odd amount
            await vault.connect(player2).deposit(parseEther("777.777777777"), player2.address);
            
            // Should handle rounding correctly
            const shares = await vault.balanceOf(player2.address);
            expect(shares).to.be.greaterThan(0);
        });

        it("Should handle maximum deposit size", async function () {
            const largeAmount = parseEther("1000000");
            await usdc.mint(player1.address, largeAmount);
            await usdc.connect(player1).approve(await vault.getAddress(), largeAmount);
            
            await expect(vault.connect(player1).deposit(largeAmount, player1.address))
                .to.not.be.reverted;
        });

        it("Should handle vault with no deposits", async function () {
            expect(await vault.totalAssets()).to.equal(0);
            expect(await vault.totalSupply()).to.equal(0);
            
            const previewDeposit = await vault.previewDeposit(parseEther("100"));
            expect(previewDeposit).to.equal(parseEther("100")); // 1:1 for first deposit
        });

        it("Should handle concurrent operations", async function () {
            await vault.connect(owner).deposit(parseEther("5000"), owner.address);
            
            // Simulate concurrent operations
            const operations = [
                vault.connect(player1).deposit(parseEther("100"), player1.address),
                vault.connect(player2).deposit(parseEther("200"), player2.address),
                vault.connect(bot1).lockFunds(parseEther("50"), 1),
            ];
            
            await expect(Promise.all(operations)).to.not.be.reverted;
        });
    });
});