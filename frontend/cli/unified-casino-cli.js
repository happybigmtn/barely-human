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
import { BOT_PERSONALITIES, BET_TYPES, GAME_PHASES } from './config/game-constants.js';
import { getNetworkConfig, CLI_CONFIG, validateEnvironment } from './config/environment.js';
import StateManager from './core/state-manager.js';
import CacheManager from './core/cache-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Command line arguments parsing
const args = process.argv.slice(2);
const parseArgs = () => {
  const parsed = {
    nonInteractive: args.includes('--non-interactive') || args.includes('-n'),
    testMode: args.includes('--test') || args.includes('-t'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    network: getArgValue('--network') || 'local',
    command: getArgValue('--command'),
    amount: getArgValue('--amount'),
    betType: getArgValue('--bet-type'),
    player: getArgValue('--player'),
    botId: getArgValue('--bot-id'),
    strategy: getArgValue('--strategy'),
    rounds: parseInt(getArgValue('--rounds')) || 1,
    vaultType: getArgValue('--vault-type'),
    help: args.includes('--help') || args.includes('-h'),
    gasReport: args.includes('--gas-report'),
    batchFile: getArgValue('--batch-file')
  };
  return parsed;
};

const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
};

const cliArgs = parseArgs();
const isNonInteractive = cliArgs.nonInteractive;
const isTestMode = cliArgs.testMode;
const isQuiet = cliArgs.quiet;

class UnifiedCasinoCLI {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.testResults = [];
    this.transactionReceipts = [];
    
    // Initialize state and cache management
    this.stateManager = new StateManager();
    this.cacheManager = new CacheManager({
      ttl: CLI_CONFIG.CACHE_TTL,
      enabled: CLI_CONFIG.ENABLE_CACHING
    });
    
    // Network configuration with validation
    this.networkConfig = getNetworkConfig(cliArgs.network);
    this.validateEnvironment();
  }

  validateEnvironment() {
    const validation = validateEnvironment(cliArgs.network);
    if (!validation.valid && !isQuiet) {
      console.log(chalk.yellow('⚠️  Environment validation warnings:'));
      validation.issues.forEach(issue => {
        console.log(chalk.gray(`  • ${issue}`));
      });
      console.log();
    }
  }

  async init() {
    try {
      // Load configuration based on network
      const configPath = path.join(__dirname, `../../deployments/${this.networkConfig.deploymentFile}`);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.contractAddresses = config.contracts;
        
        // Use first bot vault as main vault if CrapsVault not specified
        if (!this.contractAddresses.CrapsVault && this.contractAddresses.BotVaults?.length > 0) {
          this.contractAddresses.CrapsVault = this.contractAddresses.BotVaults[0];
        }
      } else {
        this.contractAddresses = this.getDefaultAddresses();
      }

      // Connect to network  
      this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl, {
        name: this.networkConfig.name,
        chainId: this.networkConfig.chainId
      });
      
      // Get signer - use different keys for different networks
      const privateKey = this.getPrivateKeyForNetwork(cliArgs.network);
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Verify network connection
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.networkConfig.chainId) {
        throw new Error(`Network mismatch: expected ${this.networkConfig.chainId}, got ${network.chainId}`);
      }

      // Initialize contracts with caching
      await this.initializeContracts();
      
      // Update state
      this.stateManager.updateSession({
        network: cliArgs.network,
        contractAddresses: this.contractAddresses,
        rpcUrl: this.networkConfig.rpcUrl
      });

      if (!isQuiet) {
        console.log(chalk.green(`✅ Connected to ${this.networkConfig.name}`));
        console.log(chalk.gray(`Chain ID: ${this.networkConfig.chainId}`));
        console.log(chalk.gray(`RPC: ${this.networkConfig.rpcUrl}`));
        console.log(chalk.gray(`Signer: ${this.signer.address}`));
        
        // Show balance
        const balance = await this.provider.getBalance(this.signer.address);
        console.log(chalk.gray(`ETH Balance: ${ethers.formatEther(balance)} ETH`));
      }
    } catch (error) {
      console.error(chalk.red('Failed to initialize:'), error.message);
      process.exit(1);
    }
  }

  getPrivateKeyForNetwork(network) {
    return this.networkConfig.privateKey;
  }

  getDefaultAddresses() {
    // Default local hardhat addresses
    return {
      BOTToken: '0x1613beb3b2c4f22ee086b2b38c1476a3ce7f78e8',
      Treasury: '0x851356ae760d987e095750cceb3bc6014560891c',
      StakingPool: '0xf5059a5d33d5853360d16c683c16e67980206f36',
      CrapsGame: '0x70e0ba845a1a0f2da3359c97e0285013525ffc49',
      CrapsBets: '0x4826533b4897376654bb4d4ad88b7fafd0c98528',
      CrapsSettlement: '0x99bba657f2bbc93c02d617f8ba121cb8fc104acf',
      CrapsVault: '0xb4dC171C0edEc8C0032cd0f2d30921c09FA35e34', // First bot vault as main vault
      BotManager: '0x0e801d84fa97b50751dbf25036d067dcf18858bf'
    };
  }

  // Enhanced transaction execution with gas reporting
  async executeTransaction(contractName, methodName, params = [], value = 0) {
    const contract = this.contracts[contractName];
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }

    const method = contract[methodName];
    if (!method) {
      throw new Error(`Method ${methodName} not found on ${contractName}`);
    }

    // Estimate gas
    const gasEstimate = await method.estimateGas(...params, value ? { value } : {});
    
    // Execute transaction
    const tx = await method(...params, value ? { value } : {});
    const receipt = await tx.wait();

    // Record gas usage
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || tx.gasPrice;
    const gasCost = gasUsed * gasPrice;

    const gasInfo = {
      contract: contractName,
      method: methodName,
      gasEstimate: gasEstimate.toString(),
      gasUsed: gasUsed.toString(),
      gasPrice: gasPrice.toString(),
      gasCost: ethers.formatEther(gasCost),
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };

    // Store in state manager
    this.stateManager.addGasUsage(gasInfo);
    this.stateManager.addTransaction({
      hash: receipt.hash,
      contract: contractName,
      method: methodName,
      gasUsed: gasUsed.toString(),
      blockNumber: receipt.blockNumber
    });
    
    this.transactionReceipts.push(receipt);

    if (cliArgs.gasReport && !isQuiet) {
      console.log(chalk.cyan(`Gas Report - ${contractName}.${methodName}:`));
      console.log(chalk.gray(`  Estimated: ${gasEstimate.toString()}`));
      console.log(chalk.gray(`  Used: ${gasUsed.toString()}`));
      console.log(chalk.gray(`  Cost: ${ethers.formatEther(gasCost)} ETH`));
      console.log(chalk.gray(`  Tx: ${receipt.hash}`));
    }

    return receipt;
  }

  async initializeContracts() {
    for (const [name, address] of Object.entries(this.contractAddresses)) {
      if (CONTRACT_ABIS[name]) {
        const contract = new ethers.Contract(
          address,
          CONTRACT_ABIS[name],
          this.signer
        );
        
        // Wrap contract with caching if enabled
        this.contracts[name] = CLI_CONFIG.ENABLE_CACHING ? 
          this.cacheManager.wrapContract(contract, name) : 
          contract;
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
    
    // Show cache and state statistics if available
    if (CLI_CONFIG.ENABLE_CACHING && !isQuiet) {
      console.log(chalk.bold.magenta('\n📈 Performance Statistics\n'));
      
      const cacheStats = this.cacheManager.getStats();
      const sessionStats = this.stateManager.getSessionStats();
      const gasAnalytics = this.stateManager.getGasAnalytics();
      
      const perfTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 30]
      });
      
      perfTable.push(
        ['Cache Hit Rate', cacheStats.hitRate],
        ['Cache Size', `${cacheStats.size}/${cacheStats.maxSize}`],
        ['Session Duration', `${Math.round(sessionStats.duration / 60)}m`],
        ['Total Commands', sessionStats.totalCommands.toString()],
        ['Gas Used (24h)', gasAnalytics.totalGas.toLocaleString()],
        ['Avg Gas per Tx', gasAnalytics.avgGas.toLocaleString()]
      );
      
      console.log(perfTable.toString());
      console.log(chalk.gray('═'.repeat(60)));
    }
  }

  // Display help information
  displayHelp() {
    console.log(chalk.bold.cyan('Barely Human Casino CLI\n'));
    console.log(chalk.yellow('Usage: npm run cli -- [options]\n'));
    
    console.log(chalk.bold('Options:'));
    console.log('  --network <network>        Network to connect to (local, baseSepolia)');
    console.log('  --non-interactive, -n      Run in non-interactive mode');
    console.log('  --test, -t                 Run all tests');
    console.log('  --quiet, -q                Suppress verbose output');
    console.log('  --gas-report               Show gas usage report');
    console.log('  --help, -h                 Show this help message\n');
    
    console.log(chalk.bold('Commands (for non-interactive mode):'));
    console.log('  --command bet              Place a bet');
    console.log('  --command vault-deposit    Deposit to vault');
    console.log('  --command vault-withdraw   Withdraw from vault');
    console.log('  --command stake            Stake tokens');
    console.log('  --command unstake          Unstake tokens');
    console.log('  --command claim-rewards    Claim staking rewards');
    console.log('  --command bot-play         Simulate bot playing\n');
    
    console.log(chalk.bold('Parameters:'));
    console.log('  --amount <amount>          Amount for transactions (in BOT)');
    console.log('  --bet-type <type>          Bet type ID (0-63)');
    console.log('  --bot-id <id>              Bot ID (0-9)');
    console.log('  --rounds <rounds>          Number of rounds for bot simulation');
    console.log('  --batch-file <file>        Execute commands from file\n');
    
    console.log(chalk.bold('Examples:'));
    console.log('  npm run cli -- --network local --non-interactive --command bet --amount 100 --bet-type 0');
    console.log('  npm run cli -- --network local --non-interactive --command bot-play --bot-id 1 --rounds 5');
    console.log('  npm run cli -- --network local --test --gas-report');
    console.log('  npm run cli -- --network baseSepolia --command vault-deposit --amount 1000\n');
  }

  // Process batch file
  async processBatchFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`Batch file not found: ${filePath}`));
      return;
    }

    const commands = fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.trim());

    console.log(chalk.cyan(`Processing ${commands.length} commands from batch file...\n`));

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(chalk.blue(`Command ${i + 1}/${commands.length}: ${command}`));
      
      // Parse command arguments
      const cmdArgs = command.split(' ');
      const batchCliArgs = parseBatchArgs(cmdArgs);
      
      // Execute command based on type
      await this.executeNonInteractiveCommand(batchCliArgs);
      
      console.log(chalk.gray('─'.repeat(60)));
    }
  }

  // Execute non-interactive command
  async executeNonInteractiveCommand(cmdArgs = cliArgs) {
    try {
      switch (cmdArgs.command) {
        case 'bet':
          const betType = cmdArgs.betType ? parseInt(cmdArgs.betType) : 0;
          const betAmount = cmdArgs.amount || '10';
          await this.placeBetNonInteractive(betType, betAmount);
          break;
          
        case 'vault-deposit':
          const depositAmount = cmdArgs.amount || '100';
          await this.depositToVaultNonInteractive(depositAmount);
          break;
          
        case 'vault-withdraw':
          const withdrawAmount = cmdArgs.amount || '50';
          await this.withdrawFromVaultNonInteractive(withdrawAmount);
          break;
          
        case 'stake':
          const stakeAmount = cmdArgs.amount || '100';
          await this.stakeTokensNonInteractive(stakeAmount);
          break;
          
        case 'unstake':
          const unstakeAmount = cmdArgs.amount || '50';
          await this.unstakeTokensNonInteractive(unstakeAmount);
          break;
          
        case 'claim-rewards':
          await this.claimRewardsNonInteractive();
          break;
          
        case 'bot-play':
          const botId = cmdArgs.botId ? parseInt(cmdArgs.botId) : 0;
          const rounds = cmdArgs.rounds || 1;
          await this.simulateBotPlay(botId, rounds);
          break;
          
        case 'roll':
          await this.rollDiceNonInteractive();
          break;
          
        default:
          console.log(chalk.yellow('No specific command provided, running all tests...'));
          await this.runAllTests();
      }
    } catch (error) {
      console.error(chalk.red(`Command failed: ${error.message}`));
      this.testResults.push({ test: `Command: ${cmdArgs.command}`, status: 'FAIL', error: error.message });
    }
  }

  // Main execution loop
  async run() {
    // Show help if requested
    if (cliArgs.help) {
      this.displayHelp();
      process.exit(0);
    }

    await this.init();

    // Process batch file if provided
    if (cliArgs.batchFile) {
      await this.processBatchFile(cliArgs.batchFile);
      this.displayTestResults();
      process.exit(this.testResults.some(r => r.status === 'FAIL') ? 1 : 0);
    }

    if (isTestMode) {
      // Test mode: run all tests and exit
      await this.runAllTests();
      process.exit(this.testResults.some(r => r.status === 'FAIL') ? 1 : 0);
    } else if (isNonInteractive) {
      // Non-interactive mode: execute specific command
      console.log(chalk.yellow(`Running in non-interactive mode on ${this.networkConfig.name}...`));
      await this.executeNonInteractiveCommand();
      
      // Display results if not quiet
      if (!isQuiet) {
        this.displayTestResults();
      }
      
      process.exit(this.testResults.some(r => r.status === 'FAIL') ? 1 : 0);
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
      
      // Save final state
      this.stateManager.saveState();
      this.cacheManager.destroy();
      
      process.exit(0);
    }
  }
}

// Helper function for parsing arguments from array (for batch processing)
function parseBatchArgs(argArray = args) {
  const getArgValue = (flag, arr = argArray) => {
    const index = arr.indexOf(flag);
    return index !== -1 && index + 1 < arr.length ? arr[index + 1] : null;
  };

  return {
    nonInteractive: argArray.includes('--non-interactive') || argArray.includes('-n'),
    testMode: argArray.includes('--test') || argArray.includes('-t'),
    quiet: argArray.includes('--quiet') || argArray.includes('-q'),
    network: getArgValue('--network', argArray) || 'local',
    command: getArgValue('--command', argArray),
    amount: getArgValue('--amount', argArray),
    betType: getArgValue('--bet-type', argArray),
    player: getArgValue('--player', argArray),
    botId: getArgValue('--bot-id', argArray),
    strategy: getArgValue('--strategy', argArray),
    rounds: parseInt(getArgValue('--rounds', argArray)) || 1,
    vaultType: getArgValue('--vault-type', argArray),
    help: argArray.includes('--help') || argArray.includes('-h'),
    gasReport: argArray.includes('--gas-report'),
    batchFile: getArgValue('--batch-file', argArray)
  };
}

// Run the CLI
const cli = new UnifiedCasinoCLI();
cli.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});