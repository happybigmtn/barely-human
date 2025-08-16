import { expect } from "chai";
import hre from "hardhat";
import { parseEther, getAddress } from "viem";

describe("BOTToken", function () {
    // Constants matching contract
    const INITIAL_SUPPLY = parseEther("1000000000"); // 1 billion tokens
    const TREASURY_ALLOCATION = 20n; // 20%
    const LIQUIDITY_ALLOCATION = 30n; // 30%
    const STAKING_REWARDS_ALLOCATION = 25n; // 25%
    const TEAM_ALLOCATION = 15n; // 15%
    const COMMUNITY_ALLOCATION = 10n; // 10%
    
    let owner, treasury, liquidity, stakingRewards, team, community, user1, user2;
    let token;
    
    beforeEach(async function () {
        // Get signers
        [owner, treasury, liquidity, stakingRewards, team, community, user1, user2] = 
            await hre.viem.getWalletClients();
        
        // Deploy BOT Token
        token = await hre.viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            stakingRewards.account.address,
            team.account.address,
            community.account.address
        ]);
    });
    
    describe("Deployment", function () {
        it("Should set the correct token name and symbol", async function () {
            expect(await token.read.name()).to.equal("Barely Human");
            expect(await token.read.symbol()).to.equal("BOT");
        });
        
        it("Should have 18 decimals", async function () {
            expect(await token.read.decimals()).to.equal(18);
        });
        
        it("Should mint correct initial supply", async function () {
            expect(await token.read.totalSupply()).to.equal(INITIAL_SUPPLY);
        });
        
        it("Should allocate tokens correctly to all recipients", async function () {
            const treasuryBalance = INITIAL_SUPPLY * TREASURY_ALLOCATION / 100n;
            const liquidityBalance = INITIAL_SUPPLY * LIQUIDITY_ALLOCATION / 100n;
            const stakingBalance = INITIAL_SUPPLY * STAKING_REWARDS_ALLOCATION / 100n;
            const teamBalance = INITIAL_SUPPLY * TEAM_ALLOCATION / 100n;
            const communityBalance = INITIAL_SUPPLY * COMMUNITY_ALLOCATION / 100n;
            
            expect(await token.read.balanceOf([treasury.account.address])).to.equal(treasuryBalance);
            expect(await token.read.balanceOf([liquidity.account.address])).to.equal(liquidityBalance);
            expect(await token.read.balanceOf([stakingRewards.account.address])).to.equal(stakingBalance);
            expect(await token.read.balanceOf([team.account.address])).to.equal(teamBalance);
            expect(await token.read.balanceOf([community.account.address])).to.equal(communityBalance);
        });
    });
    
    describe("Roles", function () {
        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await token.read.DEFAULT_ADMIN_ROLE();
            expect(await token.read.hasRole([DEFAULT_ADMIN_ROLE, owner.account.address])).to.be.true;
        });
        
        it("Should grant TREASURY_ROLE to treasury address", async function () {
            const TREASURY_ROLE = await token.read.TREASURY_ROLE();
            expect(await token.read.hasRole([TREASURY_ROLE, treasury.account.address])).to.be.true;
        });
        
        it("Should grant STAKING_ROLE to staking rewards address", async function () {
            const STAKING_ROLE = await token.read.STAKING_ROLE();
            expect(await token.read.hasRole([STAKING_ROLE, stakingRewards.account.address])).to.be.true;
        });
        
        it("Should grant PAUSER_ROLE to deployer", async function () {
            const PAUSER_ROLE = await token.read.PAUSER_ROLE();
            expect(await token.read.hasRole([PAUSER_ROLE, owner.account.address])).to.be.true;
        });
        
        it("Should correctly identify treasury and staking addresses", async function () {
            expect(await token.read.isTreasury([treasury.account.address])).to.be.true;
            expect(await token.read.isTreasury([user1.account.address])).to.be.false;
            
            expect(await token.read.isStaking([stakingRewards.account.address])).to.be.true;
            expect(await token.read.isStaking([user1.account.address])).to.be.false;
        });
        
        it("Should allow admin to grant roles", async function () {
            const TREASURY_ROLE = await token.read.TREASURY_ROLE();
            
            await token.write.grantRole([TREASURY_ROLE, user1.account.address], {
                account: owner.account
            });
            expect(await token.read.hasRole([TREASURY_ROLE, user1.account.address])).to.be.true;
        });
        
        it("Should allow admin to revoke roles", async function () {
            const TREASURY_ROLE = await token.read.TREASURY_ROLE();
            
            await token.write.revokeRole([TREASURY_ROLE, treasury.account.address], {
                account: owner.account
            });
            expect(await token.read.hasRole([TREASURY_ROLE, treasury.account.address])).to.be.false;
        });
    });
    
    describe("Transfers", function () {
        it("Should allow normal transfers between accounts", async function () {
            const amount = parseEther("100");
            
            await token.write.transfer([user1.account.address, amount], {
                account: treasury.account
            });
            expect(await token.read.balanceOf([user1.account.address])).to.equal(amount);
        });
        
        it("Should handle transferFrom with approval", async function () {
            const amount = parseEther("100");
            
            await token.write.approve([user1.account.address, amount], {
                account: treasury.account
            });
            await token.write.transferFrom([treasury.account.address, user2.account.address, amount], {
                account: user1.account
            });
            
            expect(await token.read.balanceOf([user2.account.address])).to.equal(amount);
        });
        
        it("Should revert transferFrom without approval", async function () {
            const amount = parseEther("100");
            
            await expect(
                token.write.transferFrom([treasury.account.address, user2.account.address, amount], {
                    account: user1.account
                })
            ).to.be.rejected;
        });
    });
    
    describe("Pausable", function () {
        it("Should allow pauser to pause transfers", async function () {
            await token.write.pause({ account: owner.account });
            expect(await token.read.paused()).to.be.true;
        });
        
        it("Should allow pauser to unpause transfers", async function () {
            await token.write.pause({ account: owner.account });
            await token.write.unpause({ account: owner.account });
            expect(await token.read.paused()).to.be.false;
        });
        
        it("Should prevent transfers when paused", async function () {
            const amount = parseEther("100");
            
            await token.write.pause({ account: owner.account });
            
            await expect(
                token.write.transfer([user1.account.address, amount], {
                    account: treasury.account
                })
            ).to.be.rejected;
        });
        
        it("Should not allow non-pauser to pause", async function () {
            await expect(
                token.write.pause({ account: user1.account })
            ).to.be.rejected;
        });
    });
    
    describe("Burn", function () {
        it("Should allow users to burn their own tokens", async function () {
            const burnAmount = parseEther("100");
            const initialBalance = await token.read.balanceOf([treasury.account.address]);
            
            await token.write.burn([burnAmount], {
                account: treasury.account
            });
            
            expect(await token.read.balanceOf([treasury.account.address])).to.equal(initialBalance - burnAmount);
            expect(await token.read.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
        });
        
        it("Should allow burning tokens from another account with approval", async function () {
            const burnAmount = parseEther("100");
            const initialBalance = await token.read.balanceOf([treasury.account.address]);
            
            await token.write.approve([user1.account.address, burnAmount], {
                account: treasury.account
            });
            await token.write.burnFrom([treasury.account.address, burnAmount], {
                account: user1.account
            });
            
            expect(await token.read.balanceOf([treasury.account.address])).to.equal(initialBalance - burnAmount);
            expect(await token.read.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
        });
        
        it("Should revert burnFrom without approval", async function () {
            const burnAmount = parseEther("100");
            
            await expect(
                token.write.burnFrom([treasury.account.address, burnAmount], {
                    account: user1.account
                })
            ).to.be.rejected;
        });
    });
    
    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for transfers", async function () {
            const amount = parseEther("100");
            
            // Get public client for gas estimation
            const publicClient = await hre.viem.getPublicClient();
            
            const gas = await publicClient.estimateContractGas({
                address: token.address,
                abi: token.abi,
                functionName: 'transfer',
                args: [user1.account.address, amount],
                account: treasury.account.address
            });
            
            console.log(`      Transfer gas estimate: ${gas.toString()}`);
            expect(gas).to.be.lessThan(100000n); // Should be well under 100k gas
        });
        
        it("Should have reasonable gas costs for approve", async function () {
            const amount = parseEther("100");
            
            const publicClient = await hre.viem.getPublicClient();
            
            const gas = await publicClient.estimateContractGas({
                address: token.address,
                abi: token.abi,
                functionName: 'approve',
                args: [user1.account.address, amount],
                account: treasury.account.address
            });
            
            console.log(`      Approve gas estimate: ${gas.toString()}`);
            expect(gas).to.be.lessThan(50000n); // Should be under 50k gas
        });
    });
});