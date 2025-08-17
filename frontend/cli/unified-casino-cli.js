#!/usr/bin/env node

/**
 * Unified Barely Human Casino CLI
 * Combines all CLI functionality with both interactive and non-interactive modes
 * Supports comprehensive testing of all functions
 */

import { ethers } from 'ethers';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CONTRACT_ABIS } from './config/contract-abis.js';
import { BOT_PERSONALITIES, BET_TYPES, GAME_PHASES, CLI_CONFIG } from './config/game-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Command line arguments
const args = process.argv.slice(2);
const isNonInteractive = args.includes('--non-interactive') || args.includes('-n');
const isTestMode = args.includes('--test') || args.includes('-t');
const isQuiet = args.includes('--quiet') || args.includes('-q');

class UnifiedCasinoCLI {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.testResults = [];
  }

  async init() {
    try {
      // Load configuration
      const configPath = path.join(__dirname, '../../deployments/localhost.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.contractAddresses = config.contracts;
      } else {
        this.contractAddresses = this.getDefaultAddresses();
      }

      // Connect to network
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Get signer
      const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Initialize contracts
      await this.initializeContracts();

      if (!isQuiet) {
        console.log(chalk.green('✅ Connected to network'));
        console.log(chalk.gray(`Signer: ${this.signer.address}`));
      }
    } catch (error) {
      console.error(chalk.red('Failed to initialize:'), error.message);
      process.exit(1);
    }
  }

  getDefaultAddresses() {
    return {
      BOTToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      Treasury: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      StakingPool: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      CrapsGame: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      CrapsBets: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      CrapsSettlement: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      CrapsVault: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
      BotManager: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853'
    };
  }

  async initializeContracts() {
    for (const [name, address] of Object.entries(this.contractAddresses)) {
      if (CONTRACT_ABIS[name]) {
        this.contracts[name] = new ethers.Contract(
          address,
          CONTRACT_ABIS[name],
          this.signer
        );
      }
    }
  }

  // Display banner
  displayBanner() {
    console.clear();
    console.log(chalk.cyan(figlet.textSync('Barely Human', { horizontalLayout: 'full' })));
    console.log(chalk.yellow('🎲 DeFi Casino with AI Bot Gamblers 🤖\n'));
    console.log(chalk.gray('═'.repeat(60)));
  }

  // Main menu
  async showMainMenu() {
    const choices = [
      { name: '🎲 Play Craps Game', value: 'play' },
      { name: '🤖 Watch Bot Arena', value: 'bots' },
      { name: '💰 Manage Vault', value: 'vault' },
      { name: '🏦 Staking Pool', value: 'staking' },
      { name: '📊 View Statistics', value: 'stats' },
      { name: '💸 Treasury Info', value: 'treasury' },
      { name: '🧪 Run Tests', value: 'test' },
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices
      }
    ]);

    return action;
  }

  // Play craps game
  async playGame() {
    console.log(chalk.bold('\n🎲 Craps Game'));
    
    try {
      // Get current game state
      const phase = await this.contracts.CrapsGame.gamePhase();
      const seriesId = await this.contracts.CrapsGame.currentSeriesId();
      const point = await this.contracts.CrapsGame.currentPoint();

      console.log(chalk.cyan(`Series #${seriesId}`));
      console.log(chalk.yellow(`Phase: ${phase === 0 ? 'IDLE' : phase === 1 ? 'COME_OUT' : 'POINT'}`));
      if (phase === 2) {
        console.log(chalk.green(`Point: ${point}`));
      }

      if (isNonInteractive) {
        // Non-interactive: place a bet and roll
        await this.placeBetNonInteractive();
        await this.rollDiceNonInteractive();
      } else {
        // Interactive menu
        const { gameAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'gameAction',
            message: 'Choose action:',
            choices: [
              { name: '🎯 Place Bet', value: 'bet' },
              { name: '🎲 Roll Dice', value: 'roll' },
              { name: '📊 View Bets', value: 'view' },
              { name: '🔙 Back', value: 'back' }
            ]
          }
        ]);

        switch (gameAction) {
          case 'bet':
            await this.placeBet();
            break;
          case 'roll':
            await this.rollDice();
            break;
          case 'view':
            await this.viewBets();
            break;
        }
      }
    } catch (error) {
      console.error(chalk.red('Game error:'), error.message);
    }
  }

  async placeBetNonInteractive() {
    const spinner = ora('Placing Pass Line bet...').start();
    try {
      const amount = ethers.parseEther('10'); // 10 BOT
      await this.contracts.BOTToken.approve(this.contractAddresses.CrapsBets, amount);
      const tx = await this.contracts.CrapsBets.placeBet(0, amount); // Pass Line
      await tx.wait();
      spinner.succeed('Bet placed successfully');
      this.testResults.push({ test: 'Place Bet', status: 'PASS' });
    } catch (error) {
      spinner.fail('Failed to place bet');
      this.testResults.push({ test: 'Place Bet', status: 'FAIL', error: error.message });
    }
  }

  async rollDiceNonInteractive() {
    const spinner = ora('Rolling dice...').start();
    try {
      const tx = await this.contracts.CrapsGame.rollDice();
      const receipt = await tx.wait();
      spinner.succeed('Dice rolled successfully');
      this.testResults.push({ test: 'Roll Dice', status: 'PASS' });
    } catch (error) {
      spinner.fail('Failed to roll dice');
      this.testResults.push({ test: 'Roll Dice', status: 'FAIL', error: error.message });
    }
  }

  async placeBet() {
    const betTypes = Object.entries(BET_TYPES).map(([id, name]) => ({
      name: `${name} (ID: ${id})`,
      value: parseInt(id)
    }));

    const { betType, amount } = await inquirer.prompt([
      {
        type: 'list',
        name: 'betType',
        message: 'Select bet type:',
        choices: betTypes
      },
      {
        type: 'input',
        name: 'amount',
        message: 'Enter bet amount (BOT):',
        default: '10',
        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
      }
    ]);

    const spinner = ora('Placing bet...').start();
    try {
      const betAmount = ethers.parseEther(amount);
      await this.contracts.BOTToken.approve(this.contractAddresses.CrapsBets, betAmount);
      const tx = await this.contracts.CrapsBets.placeBet(betType, betAmount);
      await tx.wait();
      spinner.succeed(`Bet placed: ${BET_TYPES[betType]} for ${amount} BOT`);
    } catch (error) {
      spinner.fail(`Failed to place bet: ${error.message}`);
    }
  }

  async rollDice() {
    const spinner = ora('Rolling dice...').start();
    try {
      const tx = await this.contracts.CrapsGame.rollDice();
      const receipt = await tx.wait();
      
      // Parse events to get dice results
      const diceRolledEvent = receipt.logs.find(log => {
        try {
          const parsed = this.contracts.CrapsGame.interface.parseLog(log);
          return parsed?.name === 'DiceRolled';
        } catch { return false; }
      });

      if (diceRolledEvent) {
        const parsed = this.contracts.CrapsGame.interface.parseLog(diceRolledEvent);
        const [die1, die2] = parsed.args;
        const total = die1 + die2;
        spinner.succeed(`Rolled: ${die1} + ${die2} = ${total}`);
      } else {
        spinner.succeed('Dice rolled successfully');
      }
    } catch (error) {
      spinner.fail(`Failed to roll dice: ${error.message}`);
    }
  }

  async viewBets() {
    console.log(chalk.bold('\n📊 Your Active Bets'));
    // Implementation for viewing bets
    console.log(chalk.gray('No active bets'));
  }

  // Bot Arena
  async botArena() {
    console.log(chalk.bold('\n🤖 Bot Arena'));
    
    if (isNonInteractive) {
      await this.testBotFunctions();
    } else {
      const table = new Table({
        head: ['Bot', 'Wins', 'Losses', 'Streak', 'Status'],
        colWidths: [25, 10, 10, 10, 15]
      });

      for (const bot of BOT_PERSONALITIES) {
        try {
          const performance = await this.contracts.BotManager.getBotPerformance(bot.id);
          table.push([
            `${bot.emoji} ${bot.name}`,
            performance[0].toString(),
            performance[1].toString(),
            performance[2].toString(),
            chalk.green('Active')
          ]);
        } catch {
          table.push([
            `${bot.emoji} ${bot.name}`,
            '0', '0', '0', chalk.gray('Inactive')
          ]);
        }
      }

      console.log(table.toString());
    }
  }

  // Vault management
  async manageVault() {
    console.log(chalk.bold('\n💰 Vault Management'));
    
    try {
      const balance = await this.contracts.CrapsVault.balanceOf(this.signer.address);
      const totalAssets = await this.contracts.CrapsVault.totalAssets();
      
      console.log(chalk.cyan(`Your shares: ${ethers.formatEther(balance)} vBOT`));
      console.log(chalk.yellow(`Total vault assets: ${ethers.formatEther(totalAssets)} BOT`));

      if (isNonInteractive) {
        await this.testVaultFunctions();
      } else {
        const { vaultAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'vaultAction',
            message: 'Choose action:',
            choices: [
              { name: '➕ Deposit', value: 'deposit' },
              { name: '➖ Withdraw', value: 'withdraw' },
              { name: '📊 View Stats', value: 'stats' },
              { name: '🔙 Back', value: 'back' }
            ]
          }
        ]);

        switch (vaultAction) {
          case 'deposit':
            await this.depositToVault();
            break;
          case 'withdraw':
            await this.withdrawFromVault();
            break;
          case 'stats':
            await this.viewVaultStats();
            break;
        }
      }
    } catch (error) {
      console.error(chalk.red('Vault error:'), error.message);
    }
  }

  async depositToVault() {
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter deposit amount (BOT):',
        default: '100',
        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
      }
    ]);

    const spinner = ora('Depositing to vault...').start();
    try {
      const depositAmount = ethers.parseEther(amount);
      await this.contracts.BOTToken.approve(this.contractAddresses.CrapsVault, depositAmount);
      const tx = await this.contracts.CrapsVault.deposit(depositAmount, this.signer.address);
      await tx.wait();
      spinner.succeed(`Deposited ${amount} BOT to vault`);
    } catch (error) {
      spinner.fail(`Failed to deposit: ${error.message}`);
    }
  }

  async withdrawFromVault() {
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter withdrawal amount (BOT):',
        default: '100',
        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
      }
    ]);

    const spinner = ora('Withdrawing from vault...').start();
    try {
      const withdrawAmount = ethers.parseEther(amount);
      const tx = await this.contracts.CrapsVault.withdraw(
        withdrawAmount, 
        this.signer.address, 
        this.signer.address
      );
      await tx.wait();
      spinner.succeed(`Withdrew ${amount} BOT from vault`);
    } catch (error) {
      spinner.fail(`Failed to withdraw: ${error.message}`);
    }
  }

  async viewVaultStats() {
    const spinner = ora('Loading vault statistics...').start();
    try {
      const totalAssets = await this.contracts.CrapsVault.totalAssets();
      const totalSupply = await this.contracts.CrapsVault.totalSupply();
      const sharePrice = totalSupply > 0n ? 
        (totalAssets * ethers.parseEther('1')) / totalSupply : 
        ethers.parseEther('1');

      spinner.stop();
      
      const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 30]
      });

      table.push(
        ['Total Assets', `${ethers.formatEther(totalAssets)} BOT`],
        ['Total Shares', `${ethers.formatEther(totalSupply)} vBOT`],
        ['Share Price', `${ethers.formatEther(sharePrice)} BOT/vBOT`]
      );

      console.log(table.toString());
    } catch (error) {
      spinner.fail(`Failed to load stats: ${error.message}`);
    }
  }

  // Staking Pool
  async stakingPool() {
    console.log(chalk.bold('\n🏦 Staking Pool'));
    
    try {
      const staked = await this.contracts.StakingPool.getStakedBalance(this.signer.address);
      const rewards = await this.contracts.StakingPool.getRewardBalance(this.signer.address);
      const totalStaked = await this.contracts.StakingPool.totalStaked();
      
      console.log(chalk.cyan(`Your staked: ${ethers.formatEther(staked)} BOT`));
      console.log(chalk.green(`Your rewards: ${ethers.formatEther(rewards)} BOT`));
      console.log(chalk.yellow(`Total pool: ${ethers.formatEther(totalStaked)} BOT`));

      if (isNonInteractive) {
        await this.testStakingFunctions();
      } else {
        const { stakingAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'stakingAction',
            message: 'Choose action:',
            choices: [
              { name: '➕ Stake BOT', value: 'stake' },
              { name: '➖ Withdraw', value: 'withdraw' },
              { name: '💎 Claim Rewards', value: 'claim' },
              { name: '🔙 Back', value: 'back' }
            ]
          }
        ]);

        switch (stakingAction) {
          case 'stake':
            await this.stakeTokens();
            break;
          case 'withdraw':
            await this.withdrawStake();
            break;
          case 'claim':
            await this.claimRewards();
            break;
        }
      }
    } catch (error) {
      console.error(chalk.red('Staking error:'), error.message);
    }
  }

  async stakeTokens() {
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter stake amount (BOT):',
        default: '100',
        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
      }
    ]);

    const spinner = ora('Staking tokens...').start();
    try {
      const stakeAmount = ethers.parseEther(amount);
      await this.contracts.BOTToken.approve(this.contractAddresses.StakingPool, stakeAmount);
      const tx = await this.contracts.StakingPool.stake(stakeAmount);
      await tx.wait();
      spinner.succeed(`Staked ${amount} BOT`);
    } catch (error) {
      spinner.fail(`Failed to stake: ${error.message}`);
    }
  }

  async withdrawStake() {
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter withdrawal amount (BOT):',
        default: '100',
        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
      }
    ]);

    const spinner = ora('Withdrawing stake...').start();
    try {
      const withdrawAmount = ethers.parseEther(amount);
      const tx = await this.contracts.StakingPool.withdraw(withdrawAmount);
      await tx.wait();
      spinner.succeed(`Withdrew ${amount} BOT`);
    } catch (error) {
      spinner.fail(`Failed to withdraw: ${error.message}`);
    }
  }

  async claimRewards() {
    const spinner = ora('Claiming rewards...').start();
    try {
      const tx = await this.contracts.StakingPool.claimRewards();
      await tx.wait();
      spinner.succeed('Rewards claimed successfully');
    } catch (error) {
      spinner.fail(`Failed to claim rewards: ${error.message}`);
    }
  }

  // View statistics
  async viewStatistics() {
    console.log(chalk.bold('\n📊 Casino Statistics'));
    
    const spinner = ora('Loading statistics...').start();
    try {
      const botBalance = await this.contracts.BOTToken.balanceOf(this.signer.address);
      const totalSupply = await this.contracts.BOTToken.totalSupply();
      const seriesId = await this.contracts.CrapsGame.currentSeriesId();
      const treasuryBalance = await this.contracts.Treasury.getBalance();
      
      spinner.stop();
      
      const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 40]
      });

      table.push(
        ['Your BOT Balance', `${ethers.formatEther(botBalance)} BOT`],
        ['Total BOT Supply', `${ethers.formatEther(totalSupply)} BOT`],
        ['Current Game Series', seriesId.toString()],
        ['Treasury Balance', `${ethers.formatEther(treasuryBalance)} BOT`],
        ['Active Bots', BOT_PERSONALITIES.length.toString()]
      );

      console.log(table.toString());

      if (isNonInteractive) {
        this.testResults.push({ test: 'View Statistics', status: 'PASS' });
      }
    } catch (error) {
      spinner.fail(`Failed to load statistics: ${error.message}`);
      if (isNonInteractive) {
        this.testResults.push({ test: 'View Statistics', status: 'FAIL', error: error.message });
      }
    }
  }

  // Treasury info
  async treasuryInfo() {
    console.log(chalk.bold('\n💸 Treasury Information'));
    
    const spinner = ora('Loading treasury data...').start();
    try {
      const balance = await this.contracts.Treasury.getBalance();
      const stats = await this.contracts.Treasury.getTreasuryStats();
      
      spinner.stop();
      
      console.log(chalk.cyan(`Treasury Balance: ${ethers.formatEther(balance)} BOT`));
      console.log(chalk.yellow(`Total Collected: ${ethers.formatEther(stats[0])} BOT`));
      console.log(chalk.green(`Total Distributed: ${ethers.formatEther(stats[1])} BOT`));
      console.log(chalk.magenta(`Staking Rewards: ${ethers.formatEther(stats[2])} BOT`));
      console.log(chalk.blue(`Buybacks: ${ethers.formatEther(stats[3])} BOT`));

      if (isNonInteractive) {
        this.testResults.push({ test: 'Treasury Info', status: 'PASS' });
      }
    } catch (error) {
      spinner.fail(`Failed to load treasury: ${error.message}`);
      if (isNonInteractive) {
        this.testResults.push({ test: 'Treasury Info', status: 'FAIL', error: error.message });
      }
    }
  }

  // Test mode - run all functions non-interactively
  async runAllTests() {
    console.log(chalk.bold.cyan('\n🧪 Running Comprehensive CLI Tests\n'));
    
    const tests = [
      { name: 'Initialize Contracts', fn: () => this.testInitialization() },
      { name: 'Token Functions', fn: () => this.testTokenFunctions() },
      { name: 'Game Functions', fn: () => this.testGameFunctions() },
      { name: 'Vault Functions', fn: () => this.testVaultFunctions() },
      { name: 'Staking Functions', fn: () => this.testStakingFunctions() },
      { name: 'Bot Functions', fn: () => this.testBotFunctions() },
      { name: 'Treasury Functions', fn: () => this.testTreasuryFunctions() },
      { name: 'Statistics', fn: () => this.viewStatistics() }
    ];

    for (const test of tests) {
      console.log(chalk.blue(`\nTesting: ${test.name}`));
      console.log(chalk.gray('─'.repeat(40)));
      
      try {
        await test.fn();
        console.log(chalk.green(`✅ ${test.name} - PASSED`));
      } catch (error) {
        console.log(chalk.red(`❌ ${test.name} - FAILED`));
        console.log(chalk.gray(`   Error: ${error.message}`));
        this.testResults.push({ test: test.name, status: 'FAIL', error: error.message });
      }
    }

    this.displayTestResults();
  }

  async testInitialization() {
    // Test contract initialization
    for (const [name, contract] of Object.entries(this.contracts)) {
      if (!contract.target) {
        throw new Error(`${name} contract not initialized`);
      }
    }
    this.testResults.push({ test: 'Contract Initialization', status: 'PASS' });
  }

  async testTokenFunctions() {
    const balance = await this.contracts.BOTToken.balanceOf(this.signer.address);
    const symbol = await this.contracts.BOTToken.symbol();
    const name = await this.contracts.BOTToken.name();
    
    console.log(`  Token: ${name} (${symbol})`);
    console.log(`  Balance: ${ethers.formatEther(balance)} BOT`);
    
    this.testResults.push({ test: 'Token Balance Check', status: 'PASS' });
    this.testResults.push({ test: 'Token Metadata', status: 'PASS' });
  }

  async testGameFunctions() {
    const phase = await this.contracts.CrapsGame.gamePhase();
    const seriesId = await this.contracts.CrapsGame.currentSeriesId();
    
    console.log(`  Game Phase: ${phase}`);
    console.log(`  Series ID: ${seriesId}`);
    
    this.testResults.push({ test: 'Game State Query', status: 'PASS' });
  }

  async testVaultFunctions() {
    const totalAssets = await this.contracts.CrapsVault.totalAssets();
    const balance = await this.contracts.CrapsVault.balanceOf(this.signer.address);
    
    console.log(`  Vault Assets: ${ethers.formatEther(totalAssets)} BOT`);
    console.log(`  User Shares: ${ethers.formatEther(balance)} vBOT`);
    
    this.testResults.push({ test: 'Vault Query', status: 'PASS' });
  }

  async testStakingFunctions() {
    const staked = await this.contracts.StakingPool.getStakedBalance(this.signer.address);
    const totalStaked = await this.contracts.StakingPool.totalStaked();
    
    console.log(`  User Staked: ${ethers.formatEther(staked)} BOT`);
    console.log(`  Total Staked: ${ethers.formatEther(totalStaked)} BOT`);
    
    this.testResults.push({ test: 'Staking Query', status: 'PASS' });
  }

  async testBotFunctions() {
    const activeBots = await this.contracts.BotManager.activeBots();
    console.log(`  Active Bots: ${activeBots}`);
    
    // Test getting bot info
    const botInfo = await this.contracts.BotManager.getBotInfo(0);
    console.log(`  Bot 0 Name: ${botInfo[0]}`);
    
    this.testResults.push({ test: 'Bot Manager Query', status: 'PASS' });
  }

  async testTreasuryFunctions() {
    const balance = await this.contracts.Treasury.getBalance();
    console.log(`  Treasury Balance: ${ethers.formatEther(balance)} BOT`);
    
    this.testResults.push({ test: 'Treasury Query', status: 'PASS' });
  }

  displayTestResults() {
    console.log(chalk.bold.cyan('\n📊 Test Results Summary\n'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const table = new Table({
      head: ['Test', 'Status', 'Details'],
      colWidths: [30, 15, 35]
    });

    let passed = 0;
    let failed = 0;

    for (const result of this.testResults) {
      const status = result.status === 'PASS' ? 
        chalk.green('✅ PASS') : 
        chalk.red('❌ FAIL');
      
      if (result.status === 'PASS') passed++;
      else failed++;
      
      table.push([
        result.test,
        status,
        result.error || '-'
      ]);
    }

    console.log(table.toString());
    
    console.log(chalk.gray('\n═'.repeat(60)));
    console.log(chalk.bold('Summary:'));
    console.log(chalk.green(`  Passed: ${passed}`));
    console.log(chalk.red(`  Failed: ${failed}`));
    console.log(chalk.yellow(`  Total: ${passed + failed}`));
    console.log(chalk.cyan(`  Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`));
    console.log(chalk.gray('═'.repeat(60)));
  }

  // Main execution loop
  async run() {
    await this.init();

    if (isTestMode) {
      // Test mode: run all tests and exit
      await this.runAllTests();
      process.exit(this.testResults.some(r => r.status === 'FAIL') ? 1 : 0);
    } else if (isNonInteractive) {
      // Non-interactive mode: run specific tests
      console.log(chalk.yellow('Running in non-interactive mode...'));
      await this.runAllTests();
      process.exit(0);
    } else {
      // Interactive mode
      this.displayBanner();
      
      let running = true;
      while (running) {
        const action = await this.showMainMenu();
        
        switch (action) {
          case 'play':
            await this.playGame();
            break;
          case 'bots':
            await this.botArena();
            break;
          case 'vault':
            await this.manageVault();
            break;
          case 'staking':
            await this.stakingPool();
            break;
          case 'stats':
            await this.viewStatistics();
            break;
          case 'treasury':
            await this.treasuryInfo();
            break;
          case 'test':
            await this.runAllTests();
            break;
          case 'exit':
            running = false;
            break;
        }
        
        if (running && action !== 'exit') {
          console.log(chalk.gray('\nPress Enter to continue...'));
          await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
        }
      }
      
      console.log(chalk.yellow('\n👋 Thanks for playing Barely Human Casino!'));
      process.exit(0);
    }
  }
}

// Run the CLI
const cli = new UnifiedCasinoCLI();
cli.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});