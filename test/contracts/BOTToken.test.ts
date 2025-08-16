import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseEther, keccak256, toBytes, type Address } from 'viem';
import hre, { network } from 'hardhat';

describe('BOTToken Contract Tests', () => {
  // Contract instance and clients
  let botToken: any;
  let viem: any;
  let publicClient: any;
  let walletClients: any[];
  let deployer: any;
  let treasury: any;
  let liquidity: any;
  let staking: any;
  let team: any;
  let community: any;
  let user1: any;
  let user2: any;

  // Role constants
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
  const TREASURY_ROLE = keccak256(toBytes('TREASURY_ROLE'));
  const STAKING_ROLE = keccak256(toBytes('STAKING_ROLE'));
  const PAUSER_ROLE = keccak256(toBytes('PAUSER_ROLE'));

  // Token allocations
  const INITIAL_SUPPLY = parseEther('1000000000'); // 1B tokens
  const TREASURY_ALLOCATION = parseEther('200000000'); // 200M
  const LIQUIDITY_ALLOCATION = parseEther('300000000'); // 300M
  const STAKING_ALLOCATION = parseEther('250000000'); // 250M
  const TEAM_ALLOCATION = parseEther('150000000'); // 150M
  const COMMUNITY_ALLOCATION = parseEther('100000000'); // 100M

  beforeEach(async () => {
    // Connect to the network and get viem instance
    const networkConnection = await network.connect();
    viem = networkConnection.viem;
    
    // Get public client for reading blockchain state
    publicClient = await viem.getPublicClient();
    
    // Get wallet clients for testing
    walletClients = await viem.getWalletClients();
    [deployer, treasury, liquidity, staking, team, community, user1, user2] = walletClients;
    
    // Deploy BOTToken contract
    botToken = await viem.deployContract('BOTToken', [
      treasury.account.address,
      liquidity.account.address,
      staking.account.address,
      team.account.address,
      community.account.address
    ]);
  });

  describe('Deployment', () => {
    it('should set correct token name and symbol', async () => {
      const name = await botToken.read.name();
      const symbol = await botToken.read.symbol();
      const decimals = await botToken.read.decimals();
      
      assert.equal(name, 'BOT Token');
      assert.equal(symbol, 'BOT');
      assert.equal(decimals, 18);
    });

    it('should mint correct total supply', async () => {
      const totalSupply = await botToken.read.totalSupply();
      assert.equal(totalSupply.toString(), INITIAL_SUPPLY.toString());
    });

    it('should distribute tokens correctly', async () => {
      const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
      const liquidityBalance = await botToken.read.balanceOf([liquidity.account.address]);
      const stakingBalance = await botToken.read.balanceOf([staking.account.address]);
      const teamBalance = await botToken.read.balanceOf([team.account.address]);
      const communityBalance = await botToken.read.balanceOf([community.account.address]);
      
      assert.equal(treasuryBalance.toString(), TREASURY_ALLOCATION.toString());
      assert.equal(liquidityBalance.toString(), LIQUIDITY_ALLOCATION.toString());
      assert.equal(stakingBalance.toString(), STAKING_ALLOCATION.toString());
      assert.equal(teamBalance.toString(), TEAM_ALLOCATION.toString());
      assert.equal(communityBalance.toString(), COMMUNITY_ALLOCATION.toString());
    });

    it('should assign roles correctly', async () => {
      const deployerHasAdmin = await botToken.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]);
      const treasuryHasRole = await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]);
      const stakingHasRole = await botToken.read.hasRole([STAKING_ROLE, staking.account.address]);
      const deployerHasPauser = await botToken.read.hasRole([PAUSER_ROLE, deployer.account.address]);
      
      assert.equal(deployerHasAdmin, true);
      assert.equal(treasuryHasRole, true);
      assert.equal(stakingHasRole, true);
      assert.equal(deployerHasPauser, true);
    });
  });

  describe('Transfers', () => {
    it('should allow basic transfers', async () => {
      const amount = parseEther('100');
      
      // Transfer from treasury to user1
      const hash = await botToken.write.transfer(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      
      // Wait for transaction
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check balance
      const user1Balance = await botToken.read.balanceOf([user1.account.address]);
      assert.equal(user1Balance.toString(), amount.toString());
    });

    it('should support approve and transferFrom', async () => {
      const amount = parseEther('100');
      
      // Treasury approves user1
      const approveHash = await botToken.write.approve(
        [user1.account.address, amount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      
      // user1 transfers from treasury to user2
      const transferHash = await botToken.write.transferFrom(
        [treasury.account.address, user2.account.address, amount],
        { account: user1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: transferHash });
      
      // Check balance
      const user2Balance = await botToken.read.balanceOf([user2.account.address]);
      assert.equal(user2Balance.toString(), amount.toString());
    });
  });

  describe('Pausable', () => {
    it('should allow pauser to pause and unpause', async () => {
      // Check initial state
      let paused = await botToken.read.paused();
      assert.equal(paused, false);
      
      // Pause
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      
      paused = await botToken.read.paused();
      assert.equal(paused, true);
      
      // Unpause
      const unpauseHash = await botToken.write.unpause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
      
      paused = await botToken.read.paused();
      assert.equal(paused, false);
    });

    it('should prevent transfers when paused', async () => {
      // Pause the contract
      const pauseHash = await botToken.write.pause({ account: deployer.account });
      await publicClient.waitForTransactionReceipt({ hash: pauseHash });
      
      // Try to transfer (should fail)
      await assert.rejects(
        async () => {
          await botToken.write.transfer(
            [user1.account.address, parseEther('100')],
            { account: treasury.account }
          );
        },
        (error: any) => {
          return error.message.includes('EnforcedPause') || 
                 error.message.includes('paused');
        }
      );
    });

    it('should prevent non-pauser from pausing', async () => {
      await assert.rejects(
        async () => {
          await botToken.write.pause({ account: user1.account });
        },
        (error: any) => {
          return error.message.includes('AccessControl') || 
                 error.message.includes('unauthorized');
        }
      );
    });
  });

  describe('Burn', () => {
    it('should allow token holders to burn tokens', async () => {
      const burnAmount = parseEther('1000');
      
      // Get initial balances
      const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
      const initialSupply = await botToken.read.totalSupply();
      
      // Burn tokens
      const burnHash = await botToken.write.burn(
        [burnAmount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      // Check new balances
      const newBalance = await botToken.read.balanceOf([treasury.account.address]);
      const newSupply = await botToken.read.totalSupply();
      
      assert.equal(
        newBalance.toString(),
        (initialBalance - burnAmount).toString()
      );
      assert.equal(
        newSupply.toString(),
        (initialSupply - burnAmount).toString()
      );
    });

    it('should allow burnFrom with approval', async () => {
      const burnAmount = parseEther('1000');
      
      // Treasury approves user1
      const approveHash = await botToken.write.approve(
        [user1.account.address, burnAmount],
        { account: treasury.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      
      // Get initial balances
      const initialBalance = await botToken.read.balanceOf([treasury.account.address]);
      const initialSupply = await botToken.read.totalSupply();
      
      // user1 burns treasury's tokens
      const burnHash = await botToken.write.burnFrom(
        [treasury.account.address, burnAmount],
        { account: user1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      // Check new balances
      const newBalance = await botToken.read.balanceOf([treasury.account.address]);
      const newSupply = await botToken.read.totalSupply();
      
      assert.equal(
        newBalance.toString(),
        (initialBalance - burnAmount).toString()
      );
      assert.equal(
        newSupply.toString(),
        (initialSupply - burnAmount).toString()
      );
    });
  });

  describe('Access Control', () => {
    it('should allow admin to grant roles', async () => {
      // Grant TREASURY_ROLE to user1
      const grantHash = await botToken.write.grantRole(
        [TREASURY_ROLE, user1.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: grantHash });
      
      // Check role
      const hasRole = await botToken.read.hasRole([TREASURY_ROLE, user1.account.address]);
      assert.equal(hasRole, true);
    });

    it('should allow admin to revoke roles', async () => {
      // Revoke TREASURY_ROLE from treasury
      const revokeHash = await botToken.write.revokeRole(
        [TREASURY_ROLE, treasury.account.address],
        { account: deployer.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: revokeHash });
      
      // Check role
      const hasRole = await botToken.read.hasRole([TREASURY_ROLE, treasury.account.address]);
      assert.equal(hasRole, false);
    });

    it('should prevent non-admin from granting roles', async () => {
      await assert.rejects(
        async () => {
          await botToken.write.grantRole(
            [TREASURY_ROLE, user2.account.address],
            { account: user1.account }
          );
        },
        (error: any) => {
          return error.message.includes('AccessControl') || 
                 error.message.includes('unauthorized');
        }
      );
    });
  });
});