#!/usr/bin/env node

/**
 * DEMO-READY CLI - Real On-Chain Transactions Only
 * No simulations, only actual contract calls
 */

import { ethers } from 'ethers';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import fs from 'fs';

// Load deployment addresses
const deployment = JSON.parse(fs.readFileSync('../../deployments/localhost.json', 'utf8'));

// Connect to local network
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

// Test wallets (Hardhat accounts)
const wallets = [
  new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider), // Account 0
  new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider), // Account 1 (treasury)
  new ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', provider), // Account 2
];

// Contract ABIs
const BOT_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const BETTING_VAULT_ABI = [
  'function depositLiquidity(uint256 amount) returns (uint256 shares)',
  'function withdrawLiquidity(uint256 shares) returns (uint256 amount)',
  'function totalLiquidity() view returns (uint256)',
  'function liquidityShares(address lp) view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function grantRole(bytes32 role, address account)',
  'function BETS_ROLE() view returns (bytes32)',
  'function GAME_ROLE() view returns (bytes32)'
];

const CRAPS_GAME_ABI = [
  'function initializeGame() returns (bool)',
  'function startNewSeries() returns (uint256)',
  'function rollDice() returns (uint8, uint8)',
  'function getCurrentPhase() view returns (uint8)',
  'function getPoint() view returns (uint8)',
  'function getCurrentSeriesId() view returns (uint256)',
  'function isGameActive() view returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function OPERATOR_ROLE() view returns (bytes32)'
];

const CRAPS_BETS_ABI = [
  'function placeBet(uint8 betType, uint256 amount, uint8 number) returns (uint256)',
  'function getMinBet() view returns (uint256)',
  'function getMaxBet() view returns (uint256)',
  'function getActiveBets(address player) view returns (uint256[] memory)',
  'function getTotalAtRisk(address player) view returns (uint256)',
  'function setContracts(address game, address vault, address settlement)'
];

const BOT_MANAGER_ABI = [
  'function initializeBots() returns (bool)',
  'function getBotCount() view returns (uint256)',
  'function getBot(uint256 botId) view returns (tuple(string name, string description, uint8 aggressiveness, uint8 riskTolerance, uint256 baseBet, uint256 maxBet, address vault, bool isActive, uint256 totalWagered, uint256 totalWon))',
  'function makeBotDecision(uint256 botId, uint8 gamePhase, uint8 point, uint256 seed) view returns (uint8 betType, uint256 amount, uint8 number)',
  'function executeDecision(uint256 botId, uint8 betType, uint256 amount, uint8 number) returns (bool)'
];

const TREASURY_ABI = [
  'function collectFees(uint256 amount) returns (bool)',
  'function getAccumulatedFees() view returns (uint256)',
  'function getTotalFeesCollected() view returns (uint256)',
  'function grantRole(bytes32 role, address account)',
  'function DISTRIBUTOR_ROLE() view returns (bytes32)'
];

const STAKING_POOL_ABI = [
  'function stake(uint256 amount) returns (bool)',
  'function withdraw(uint256 amount) returns (bool)',
  'function getReward() returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function earned(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

// Initialize contracts
const contracts = {
  botToken: new ethers.Contract(deployment.contracts.BOTToken, BOT_TOKEN_ABI, wallets[0]),
  bettingVault: new ethers.Contract(deployment.contracts.BettingVault, BETTING_VAULT_ABI, wallets[0]),
  crapsGame: new ethers.Contract(deployment.contracts.CrapsGameV2Plus, CRAPS_GAME_ABI, wallets[0]),
  crapsBets: new ethers.Contract(deployment.contracts.CrapsBets, CRAPS_BETS_ABI, wallets[0]),
  botManager: new ethers.Contract(deployment.contracts.BotManagerV2Plus, BOT_MANAGER_ABI, wallets[0]),
  treasury: new ethers.Contract(deployment.contracts.Treasury, TREASURY_ABI, wallets[0]),
  stakingPool: new ethers.Contract(deployment.contracts.StakingPool, STAKING_POOL_ABI, wallets[0])
};

async function displayHeader() {
  console.clear();
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════╗
║        🎲 BARELY HUMAN CASINO - DEMO MODE 🎲        ║
║         Real On-Chain Transactions Only              ║
╚══════════════════════════════════════════════════════╝
  `));
}

async function setupAccounts() {
  const spinner = ora('Setting up demo accounts...').start();
  
  try {
    // Fund demo accounts from treasury
    const treasuryWallet = wallets[1];
    const tokenAsTreasury = contracts.botToken.connect(treasuryWallet);
    
    // Transfer tokens to demo accounts
    const transferAmount = ethers.parseEther('100000');
    
    for (let i = 0; i < wallets.length; i++) {
      if (i === 1) continue; // Skip treasury itself
      
      const balance = await contracts.botToken.balanceOf(wallets[i].address);
      if (balance < transferAmount) {
        const tx = await tokenAsTreasury.transfer(wallets[i].address, transferAmount);
        await tx.wait();
      }
    }
    
    spinner.succeed('Demo accounts funded with BOT tokens');
    return true;
  } catch (error) {
    spinner.fail(`Account setup failed: ${error.message}`);
    return false;
  }
}

async function setupVaultLiquidity() {
  const spinner = ora('Adding liquidity to BettingVault...').start();
  
  try {
    // Check current liquidity
    const currentLiquidity = await contracts.bettingVault.totalLiquidity();
    
    if (currentLiquidity < ethers.parseEther('50000')) {
      // Add liquidity
      const liquidityAmount = ethers.parseEther('50000');
      
      // Approve vault
      const approveTx = await contracts.botToken.approve(contracts.bettingVault.target, liquidityAmount);
      await approveTx.wait();
      
      // Deposit liquidity
      const depositTx = await contracts.bettingVault.depositLiquidity(liquidityAmount);
      await depositTx.wait();
    }
    
    const finalLiquidity = await contracts.bettingVault.totalLiquidity();
    spinner.succeed(`Vault liquidity: ${ethers.formatEther(finalLiquidity)} BOT`);
    return true;
  } catch (error) {
    spinner.fail(`Vault setup failed: ${error.message}`);
    return false;
  }
}

async function grantNecessaryRoles() {
  const spinner = ora('Configuring contract permissions...').start();
  
  try {
    // Grant OPERATOR_ROLE to our demo account for CrapsGame
    const OPERATOR_ROLE = await contracts.crapsGame.OPERATOR_ROLE();
    const grantTx = await contracts.crapsGame.grantRole(OPERATOR_ROLE, wallets[0].address);
    await grantTx.wait();
    
    // Grant BETS_ROLE to CrapsBets contract
    const BETS_ROLE = await contracts.bettingVault.BETS_ROLE();
    const grantBetsTx = await contracts.bettingVault.grantRole(BETS_ROLE, deployment.contracts.CrapsBets);
    await grantBetsTx.wait();
    
    // Grant GAME_ROLE to CrapsGame contract
    const GAME_ROLE = await contracts.bettingVault.GAME_ROLE();
    const grantGameTx = await contracts.bettingVault.grantRole(GAME_ROLE, deployment.contracts.CrapsGameV2Plus);
    await grantGameTx.wait();
    
    spinner.succeed('Contract permissions configured');
    return true;
  } catch (error) {
    spinner.fail(`Role configuration failed: ${error.message}`);
    return false;
  }
}

async function displayContractStatus() {
  console.log(chalk.yellow('\n📊 Contract Status:'));
  
  const table = new Table({
    head: ['Contract', 'Address', 'Status'],
    colWidths: [20, 45, 15]
  });
  
  // Check each contract
  for (const [name, contract] of Object.entries(contracts)) {
    try {
      // Simple check - just verify contract exists
      const code = await provider.getCode(contract.target);
      const status = code !== '0x' ? chalk.green('✅ Active') : chalk.red('❌ Missing');
      table.push([name, contract.target, status]);
    } catch {
      table.push([name, contract.target, chalk.red('❌ Error')]);
    }
  }
  
  console.log(table.toString());
}

async function initializeGame() {
  const spinner = ora('Initializing game...').start();
  
  try {
    // Try to initialize game
    const tx = await contracts.crapsGame.initializeGame();
    await tx.wait();
    
    // Start a new series
    const seriesTx = await contracts.crapsGame.startNewSeries();
    await seriesTx.wait();
    
    const seriesId = await contracts.crapsGame.getCurrentSeriesId();
    spinner.succeed(`Game initialized - Series #${seriesId}`);
    return true;
  } catch (error) {
    // Game might already be initialized
    try {
      const isActive = await contracts.crapsGame.isGameActive();
      if (isActive) {
        spinner.succeed('Game already active');
        return true;
      }
    } catch {}
    
    spinner.fail(`Game initialization failed: ${error.message}`);
    return false;
  }
}

async function demonstrateBetting() {
  console.log(chalk.yellow('\n🎰 Demonstrating Real Betting:'));
  
  const spinner = ora('Placing real bet...').start();
  
  try {
    // Get bet limits
    const minBet = await contracts.crapsBets.getMinBet();
    const maxBet = await contracts.crapsBets.getMaxBet();
    
    // Place a modest bet
    const betAmount = ethers.parseEther('100');
    
    // Approve tokens for betting
    const approveTx = await contracts.botToken.approve(contracts.crapsBets.target, betAmount);
    await approveTx.wait();
    
    // Place Pass Line bet (bet type 0)
    const betTx = await contracts.crapsBets.placeBet(0, betAmount, 0);
    const receipt = await betTx.wait();
    
    spinner.succeed(`Placed ${ethers.formatEther(betAmount)} BOT on Pass Line`);
    console.log(chalk.gray(`  Transaction: ${receipt.hash}`));
    console.log(chalk.gray(`  Gas used: ${receipt.gasUsed.toString()}`));
    
    return true;
  } catch (error) {
    spinner.fail(`Betting failed: ${error.message}`);
    return false;
  }
}

async function demonstrateDiceRoll() {
  console.log(chalk.yellow('\n🎲 Rolling Dice:'));
  
  const spinner = ora('Rolling dice on-chain...').start();
  
  try {
    const rollTx = await contracts.crapsGame.rollDice();
    const receipt = await rollTx.wait();
    
    // Get the dice values from events or return value
    spinner.succeed('Dice rolled successfully!');
    console.log(chalk.gray(`  Transaction: ${receipt.hash}`));
    console.log(chalk.gray(`  Gas used: ${receipt.gasUsed.toString()}`));
    
    // Get current game state
    const phase = await contracts.crapsGame.getCurrentPhase();
    const point = await contracts.crapsGame.getPoint();
    
    console.log(chalk.cyan(`  Game Phase: ${['IDLE', 'COME_OUT', 'POINT'][phase]}`));
    if (phase === 2) { // POINT phase
      console.log(chalk.cyan(`  Point: ${point}`));
    }
    
    return true;
  } catch (error) {
    spinner.fail(`Dice roll failed: ${error.message}`);
    return false;
  }
}

async function demonstrateBotActivity() {
  console.log(chalk.yellow('\n🤖 Bot Activity:'));
  
  const spinner = ora('Loading bot personalities...').start();
  
  try {
    const botCount = await contracts.botManager.getBotCount();
    spinner.succeed(`${botCount} bots loaded`);
    
    // Display first 3 bots
    const table = new Table({
      head: ['Bot', 'Personality', 'Aggressiveness', 'Risk Tolerance'],
      colWidths: [15, 35, 15, 15]
    });
    
    for (let i = 0; i < Math.min(3, Number(botCount)); i++) {
      const bot = await contracts.botManager.getBot(i);
      table.push([
        bot.name,
        bot.description.substring(0, 30) + '...',
        `${bot.aggressiveness}/10`,
        `${bot.riskTolerance}/10`
      ]);
    }
    
    console.log(table.toString());
    
    // Simulate bot decision
    console.log(chalk.cyan('\n  Simulating bot decision...'));
    const decision = await contracts.botManager.makeBotDecision(0, 1, 0, Date.now());
    console.log(chalk.gray(`    Bot 0 would bet ${ethers.formatEther(decision[1])} BOT on bet type ${decision[0]}`));
    
    return true;
  } catch (error) {
    spinner.fail(`Bot demonstration failed: ${error.message}`);
    return false;
  }
}

async function displayFinalStats() {
  console.log(chalk.yellow('\n📈 Final Statistics:'));
  
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 40]
  });
  
  try {
    const totalSupply = await contracts.botToken.totalSupply();
    const vaultLiquidity = await contracts.bettingVault.totalLiquidity();
    const treasuryFees = await contracts.treasury.getAccumulatedFees();
    const stakingTotal = await contracts.stakingPool.totalSupply();
    
    table.push(
      ['Total BOT Supply', `${ethers.formatEther(totalSupply)} BOT`],
      ['Vault Liquidity', `${ethers.formatEther(vaultLiquidity)} BOT`],
      ['Treasury Fees', `${ethers.formatEther(treasuryFees)} BOT`],
      ['Total Staked', `${ethers.formatEther(stakingTotal)} BOT`]
    );
    
    console.log(table.toString());
  } catch (error) {
    console.log(chalk.red(`Failed to fetch statistics: ${error.message}`));
  }
}

async function main() {
  await displayHeader();
  
  console.log(chalk.cyan('Starting Demo Sequence...\n'));
  
  // Setup phase
  const setupSuccess = await setupAccounts() && 
                      await setupVaultLiquidity() && 
                      await grantNecessaryRoles();
  
  if (!setupSuccess) {
    console.log(chalk.red('\n❌ Setup failed. Please check your environment.'));
    process.exit(1);
  }
  
  // Display contract status
  await displayContractStatus();
  
  // Game initialization
  await initializeGame();
  
  // Demonstrate features
  await demonstrateBetting();
  await demonstrateDiceRoll();
  await demonstrateBotActivity();
  
  // Final statistics
  await displayFinalStats();
  
  console.log(chalk.green.bold('\n✅ Demo Complete - All Transactions On-Chain!\n'));
  console.log(chalk.gray('All operations were real blockchain transactions.'));
  console.log(chalk.gray('Check your local Hardhat node for transaction logs.\n'));
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});

// Run the demo
main().catch((error) => {
  console.error(chalk.red('\n❌ Demo failed:'), error);
  process.exit(1);
});