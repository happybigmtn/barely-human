import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import { parseEther, keccak256, toBytes, maxUint256 } from "viem";

describe("StakingPool", () => {
    let stakingPool;
    let botToken;
    let stakingPoolAddress;
    let botTokenAddress;
    let owner;
    let user1;
    let user2;
    let treasuryAddr;
    let publicClient;
    
    const STAKE_AMOUNT = parseEther("1000");
    const REWARD_AMOUNT = parseEther("10000");
    const REWARD_DURATION = 7n * 24n * 60n * 60n; // 7 days in seconds
    const MIN_STAKE = parseEther("1");
    
    beforeEach(async () => {
        const network = await hre.network.provider.request({ method: "eth_chainId" });
        publicClient = await hre.viem.getPublicClient();
        
        [owner, user1, user2, treasuryAddr] = await hre.viem.getWalletClients();
        
        // Deploy BOT token
        const botTokenFactory = await hre.viem.deployContract("BOTToken", [
            owner.account.address,
            owner.account.address,
            owner.account.address
        ]);
        botTokenAddress = botTokenFactory.address;
        botToken = await hre.viem.getContractAt("BOTToken", botTokenAddress);
        
        // Deploy StakingPool
        const stakingPoolFactory = await hre.viem.deployContract("StakingPool", [
            botTokenAddress,
            botTokenAddress, // BOT is both staking and reward token
            treasuryAddr.account.address
        ]);
        stakingPoolAddress = stakingPoolFactory.address;
        stakingPool = await hre.viem.getContractAt("StakingPool", stakingPoolAddress);
        
        // Grant treasury role
        const TREASURY_ROLE = keccak256(toBytes("TREASURY_ROLE"));
        await stakingPool.write.grantRole([TREASURY_ROLE, treasuryAddr.account.address], {
            account: owner.account
        });
        
        // Transfer tokens to users
        await botToken.write.transfer([user1.account.address, parseEther("100000")], {
            account: owner.account
        });
        await botToken.write.transfer([user2.account.address, parseEther("100000")], {
            account: owner.account
        });
        
        // Approve staking pool
        await botToken.write.approve([stakingPoolAddress, maxUint256], {
            account: user1.account
        });
        await botToken.write.approve([stakingPoolAddress, maxUint256], {
            account: user2.account
        });
    });
    
    describe("Staking", () => {
        test("Should allow users to stake tokens", async () => {
            // Stake tokens
            const tx = await stakingPool.write.stake([STAKE_AMOUNT], {
                account: user1.account
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            // Check balances
            const userBalance = await stakingPool.read.balanceOf([user1.account.address]);
            const totalStaked = await stakingPool.read.totalStaked();
            
            assert.strictEqual(userBalance, STAKE_AMOUNT);
            assert.strictEqual(totalStaked, STAKE_AMOUNT);
        });
        
        test("Should reject stakes below minimum", async () => {
            try {
                await stakingPool.write.stake([MIN_STAKE - 1n], {
                    account: user1.account
                });
                assert.fail("Should have reverted");
            } catch (error) {
                assert.ok(error.message.includes("InsufficientStake"));
            }
        });
        
        test("Should reject zero stakes", async () => {
            try {
                await stakingPool.write.stake([0n], {
                    account: user1.account
                });
                assert.fail("Should have reverted");
            } catch (error) {
                assert.ok(error.message.includes("ZeroAmount"));
            }
        });
    });
    
    describe("Withdrawing", () => {
        beforeEach(async () => {
            // Stake tokens first
            await stakingPool.write.stake([STAKE_AMOUNT], {
                account: user1.account
            });
        });
        
        test("Should allow users to withdraw staked tokens", async () => {
            const balanceBefore = await botToken.read.balanceOf([user1.account.address]);
            
            // Withdraw
            const tx = await stakingPool.write.withdraw([STAKE_AMOUNT], {
                account: user1.account
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const balanceAfter = await botToken.read.balanceOf([user1.account.address]);
            const stakedBalance = await stakingPool.read.balanceOf([user1.account.address]);
            const totalStaked = await stakingPool.read.totalStaked();
            
            assert.strictEqual(balanceAfter - balanceBefore, STAKE_AMOUNT);
            assert.strictEqual(stakedBalance, 0n);
            assert.strictEqual(totalStaked, 0n);
        });
        
        test("Should reject withdrawals exceeding balance", async () => {
            try {
                await stakingPool.write.withdraw([STAKE_AMOUNT + 1n], {
                    account: user1.account
                });
                assert.fail("Should have reverted");
            } catch (error) {
                assert.ok(error.message.includes("NoStakedBalance"));
            }
        });
    });
    
    describe("Rewards", () => {
        beforeEach(async () => {
            // Stake tokens
            await stakingPool.write.stake([STAKE_AMOUNT], {
                account: user1.account
            });
            await stakingPool.write.stake([STAKE_AMOUNT], {
                account: user2.account
            });
            
            // Fund rewards
            await botToken.write.transfer([stakingPoolAddress, REWARD_AMOUNT], {
                account: owner.account
            });
            await stakingPool.write.notifyRewardAmount([REWARD_AMOUNT], {
                account: treasuryAddr.account
            });
        });
        
        test("Should distribute rewards proportionally", async () => {
            // Fast forward half the duration
            await hre.network.provider.send("evm_increaseTime", [Number(REWARD_DURATION / 2n)]);
            await hre.network.provider.send("evm_mine");
            
            const earned1 = await stakingPool.read.earned([user1.account.address]);
            const earned2 = await stakingPool.read.earned([user2.account.address]);
            
            // Both users staked equal amounts, should earn equal rewards
            const difference = earned1 > earned2 ? earned1 - earned2 : earned2 - earned1;
            assert.ok(difference < parseEther("1"), "Rewards should be approximately equal");
            
            // Should earn approximately half the rewards
            const expectedReward = REWARD_AMOUNT / 2n / 2n; // Half duration, split between 2 users
            const actualDiff = earned1 > expectedReward ? earned1 - expectedReward : expectedReward - earned1;
            assert.ok(actualDiff < parseEther("10"), "Should earn approximately half rewards");
        });
        
        test("Should allow claiming rewards", async () => {
            // Fast forward full duration
            await hre.network.provider.send("evm_increaseTime", [Number(REWARD_DURATION)]);
            await hre.network.provider.send("evm_mine");
            
            const balanceBefore = await botToken.read.balanceOf([user1.account.address]);
            
            // Claim rewards
            const tx = await stakingPool.write.getReward([], {
                account: user1.account
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const balanceAfter = await botToken.read.balanceOf([user1.account.address]);
            const rewardClaimed = balanceAfter - balanceBefore;
            
            assert.ok(rewardClaimed > 0n, "Should have claimed rewards");
            
            // Check rewards reset
            const remainingRewards = await stakingPool.read.earned([user1.account.address]);
            assert.strictEqual(remainingRewards, 0n);
        });
        
        test("Should handle exit (withdraw + claim)", async () => {
            // Fast forward full duration
            await hre.network.provider.send("evm_increaseTime", [Number(REWARD_DURATION)]);
            await hre.network.provider.send("evm_mine");
            
            const balanceBefore = await botToken.read.balanceOf([user1.account.address]);
            
            // Exit (withdraw all + claim rewards)
            const tx = await stakingPool.write.exit([], {
                account: user1.account
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            
            const balanceAfter = await botToken.read.balanceOf([user1.account.address]);
            const totalReceived = balanceAfter - balanceBefore;
            
            assert.ok(totalReceived > STAKE_AMOUNT, "Should receive stake + rewards");
            
            const stakedBalance = await stakingPool.read.balanceOf([user1.account.address]);
            assert.strictEqual(stakedBalance, 0n);
        });
    });
    
    describe("Admin Functions", () => {
        test("Should allow treasury to notify reward amount", async () => {
            await botToken.write.transfer([stakingPoolAddress, REWARD_AMOUNT], {
                account: owner.account
            });
            
            const tx = await stakingPool.write.notifyRewardAmount([REWARD_AMOUNT], {
                account: treasuryAddr.account
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
            assert.ok(receipt.status === "success");
        });
        
        test("Should reject reward notification from non-treasury", async () => {
            try {
                await stakingPool.write.notifyRewardAmount([REWARD_AMOUNT], {
                    account: user1.account
                });
                assert.fail("Should have reverted");
            } catch (error) {
                assert.ok(error.message.includes("AccessControl"));
            }
        });
        
        test("Should allow pausing and unpausing", async () => {
            // Pause
            await stakingPool.write.pause([], {
                account: owner.account
            });
            
            // Try to stake while paused
            try {
                await stakingPool.write.stake([STAKE_AMOUNT], {
                    account: user1.account
                });
                assert.fail("Should have reverted");
            } catch (error) {
                assert.ok(error.message.includes("EnforcedPause"));
            }
            
            // Unpause
            await stakingPool.write.unpause([], {
                account: owner.account
            });
            
            // Should work now
            const tx = await stakingPool.write.stake([STAKE_AMOUNT], {
                account: user1.account
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
            assert.ok(receipt.status === "success");
        });
    });
});