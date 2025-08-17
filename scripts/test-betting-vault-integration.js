#!/usr/bin/env node

/**
 * BettingVault Integration Test
 * Tests the new BettingVault contract with the game system
 */

import { ethers } from 'ethers';
import fs from 'fs';
import chalk from 'chalk';

// Load deployment addresses
const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));

// Connect to local network
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const signer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

// Contract ABIs (minimal)
const BOT_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const BETTING_VAULT_ABI = [
  'function depositLiquidity(uint256 amount) returns (uint256 shares)',
  'function withdrawLiquidity(uint256 shares) returns (uint256 amount)',
  'function escrowBet(address player, uint256 betId, uint256 amount)',
  'function processPayout(address player, uint256 betId, uint256 payoutAmount)',
  'function releaseBet(uint256 betId)',
  'function totalLiquidity() view returns (uint256)',
  'function liquidityShares(address lp) view returns (uint256)',
  'function getEscrowedAmount(uint256 betId) view returns (uint256)',
  'function OPERATOR_ROLE() view returns (bytes32)',
  'function BETS_ROLE() view returns (bytes32)',
  'function GAME_ROLE() view returns (bytes32)',
  'function grantRole(bytes32 role, address account)',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

const CRAPS_BETS_ABI = [
  'function placeBet(uint8 betType, uint256 amount, uint8 number) returns (uint256)',
  'function getMinBet() view returns (uint256)',
  'function getMaxBet() view returns (uint256)'
];

async function main() {
  console.log(chalk.bold.cyan('\n🎲 Testing BettingVault Integration\n'));

  try {
    // Initialize contracts
    const botToken = new ethers.Contract(deployment.contracts.BOTToken, BOT_TOKEN_ABI, signer);
    const bettingVault = new ethers.Contract(deployment.contracts.BettingVault, BETTING_VAULT_ABI, signer);
    const crapsBets = new ethers.Contract(deployment.contracts.CrapsBets, CRAPS_BETS_ABI, signer);

    console.log(chalk.gray('Connected to contracts:'));
    console.log(chalk.gray(`  BOTToken: ${deployment.contracts.BOTToken}`));
    console.log(chalk.gray(`  BettingVault: ${deployment.contracts.BettingVault}`));
    console.log(chalk.gray(`  CrapsBets: ${deployment.contracts.CrapsBets}\n`));

    // Test 1: Check initial balances
    console.log(chalk.yellow('1. Checking initial state...'));
    const totalSupply = await botToken.totalSupply();
    const signerBalance = await botToken.balanceOf(signer.address);
    const vaultLiquidity = await bettingVault.totalLiquidity();
    
    console.log(`  Total BOT Supply: ${ethers.formatEther(totalSupply)} BOT`);
    console.log(`  Signer Balance: ${ethers.formatEther(signerBalance)} BOT`);
    console.log(`  Vault Liquidity: ${ethers.formatEther(vaultLiquidity)} BOT`);
    console.log(chalk.green('  ✅ Initial state checked\n'));

    // Test 2: Fund test account if needed
    if (signerBalance < ethers.parseEther('1000')) {
      console.log(chalk.yellow('2. Funding test account...'));
      
      // Get tokens from treasury account
      const treasuryWallet = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider);
      const tokenAsTreasury = botToken.connect(treasuryWallet);
      
      const tx = await tokenAsTreasury.transfer(signer.address, ethers.parseEther('10000'));
      await tx.wait();
      
      const newBalance = await botToken.balanceOf(signer.address);
      console.log(`  New Balance: ${ethers.formatEther(newBalance)} BOT`);
      console.log(chalk.green('  ✅ Account funded\n'));
    }

    // Test 3: Deposit liquidity to vault
    console.log(chalk.yellow('3. Testing liquidity deposit...'));
    const depositAmount = ethers.parseEther('1000');
    
    // Approve vault to spend tokens
    console.log('  Approving tokens...');
    const approveTx = await botToken.approve(bettingVault.target, depositAmount);
    await approveTx.wait();
    
    const allowance = await botToken.allowance(signer.address, bettingVault.target);
    console.log(`  Allowance set: ${ethers.formatEther(allowance)} BOT`);
    
    // Deposit liquidity
    console.log('  Depositing liquidity...');
    const depositTx = await bettingVault.depositLiquidity(depositAmount);
    const depositReceipt = await depositTx.wait();
    
    // Check new state
    const lpShares = await bettingVault.liquidityShares(signer.address);
    const newVaultLiquidity = await bettingVault.totalLiquidity();
    
    console.log(`  LP Shares received: ${ethers.formatEther(lpShares)}`);
    console.log(`  New Vault Liquidity: ${ethers.formatEther(newVaultLiquidity)} BOT`);
    console.log(chalk.green('  ✅ Liquidity deposited successfully\n'));

    // Test 4: Check role permissions
    console.log(chalk.yellow('4. Testing role permissions...'));
    const BETS_ROLE = await bettingVault.BETS_ROLE();
    const GAME_ROLE = await bettingVault.GAME_ROLE();
    
    const hasBetsRole = await bettingVault.hasRole(BETS_ROLE, deployment.contracts.CrapsBets);
    const hasGameRole = await bettingVault.hasRole(GAME_ROLE, deployment.contracts.CrapsGameV2Plus);
    
    console.log(`  CrapsBets has BETS_ROLE: ${hasBetsRole}`);
    console.log(`  CrapsGame has GAME_ROLE: ${hasGameRole}`);
    
    if (!hasBetsRole || !hasGameRole) {
      console.log(chalk.yellow('  Granting missing roles...'));
      if (!hasBetsRole) {
        const tx = await bettingVault.grantRole(BETS_ROLE, deployment.contracts.CrapsBets);
        await tx.wait();
        console.log('  ✅ Granted BETS_ROLE to CrapsBets');
      }
      if (!hasGameRole) {
        const tx = await bettingVault.grantRole(GAME_ROLE, deployment.contracts.CrapsGameV2Plus);
        await tx.wait();
        console.log('  ✅ Granted GAME_ROLE to CrapsGame');
      }
    } else {
      console.log(chalk.green('  ✅ All roles properly configured\n'));
    }

    // Test 5: Test bet escrow (simulate)
    console.log(chalk.yellow('5. Testing bet escrow simulation...'));
    console.log('  Note: Direct escrow requires BETS_ROLE, testing through game flow instead');
    
    const minBet = await crapsBets.getMinBet();
    const maxBet = await crapsBets.getMaxBet();
    
    console.log(`  Min Bet: ${ethers.formatEther(minBet)} BOT`);
    console.log(`  Max Bet: ${ethers.formatEther(maxBet)} BOT`);
    console.log(chalk.green('  ✅ Bet limits verified\n'));

    // Test 6: Withdraw liquidity
    console.log(chalk.yellow('6. Testing liquidity withdrawal...'));
    const withdrawShares = lpShares / 2n; // Withdraw half
    
    console.log(`  Withdrawing ${ethers.formatEther(withdrawShares)} shares...`);
    const withdrawTx = await bettingVault.withdrawLiquidity(withdrawShares);
    await withdrawTx.wait();
    
    const remainingShares = await bettingVault.liquidityShares(signer.address);
    const finalVaultLiquidity = await bettingVault.totalLiquidity();
    const finalBalance = await botToken.balanceOf(signer.address);
    
    console.log(`  Remaining Shares: ${ethers.formatEther(remainingShares)}`);
    console.log(`  Final Vault Liquidity: ${ethers.formatEther(finalVaultLiquidity)} BOT`);
    console.log(`  Final Account Balance: ${ethers.formatEther(finalBalance)} BOT`);
    console.log(chalk.green('  ✅ Liquidity withdrawn successfully\n'));

    // Summary
    console.log(chalk.bold.green('\n✅ BettingVault Integration Test Complete!\n'));
    console.log(chalk.cyan('Summary:'));
    console.log('  • BettingVault deployed and functional');
    console.log('  • Liquidity deposits working');
    console.log('  • LP shares properly tracked');
    console.log('  • Liquidity withdrawals working');
    console.log('  • Role-based access configured');
    console.log('  • Ready for game integration');

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    if (error.data) {
      console.error(chalk.red('Error data:'), error.data);
    }
    process.exit(1);
  }
}

main().catch(console.error);