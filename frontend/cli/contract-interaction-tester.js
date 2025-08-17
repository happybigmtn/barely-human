#!/usr/bin/env node

/**
 * Contract Interaction Tester
 * Comprehensive testing of all contract functions with real blockchain calls
 * Tests actual contract interactions, not frontend simulations
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hardhat local chain config
const hardhatChain = {
  id: 31337,
  name: 'Hardhat',
  network: 'hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] }
  }
};

// Complete contract ABIs for testing
const CONTRACT_ABIS = {
  BOTToken: parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ]),
  
  CrapsGameV2Plus: parseAbi([
    'function currentSeriesId() view returns (uint256)',
    'function getCurrentPhase() view returns (uint8)',
    'function getCurrentPoint() view returns (uint256)',
    'function rollDice() returns (uint256)',
    'function isGameActive() view returns (bool)',
    'function initializeGame()',
    'function startNewSeries()',
    'function canPlaceBet(uint8 betType) view returns (bool)',
    'function getSeriesId() view returns (uint256)',
    'function getCurrentShooter() view returns ((address,uint8,uint256,bool))'
  ]),
  
  CrapsBets: parseAbi([
    'function placeBet(uint8 betType, uint256 amount)',
    'function getBet(address player, uint8 betType) view returns ((uint256,uint8,uint8,uint256,bool))',
    'function hasActiveBet(address player, uint8 betType) view returns (bool)',
    'function getTotalAtRisk(address player) view returns (uint256)',
    'function getActiveBetTypes(address player) view returns (uint8[])',
    'function removeBet(uint8 betType)',
    'function placeOddsBet(uint8 baseBetType, uint256 oddsAmount)',
    'function getPlayerBets(address player) view returns ((uint64,uint8,uint256))',
    'function minBetAmount() view returns (uint256)',
    'function maxBetAmount() view returns (uint256)'
  ]),
  
  BotManagerV2Plus: parseAbi([
    'function getBotCount() view returns (uint256)',
    'function getBotPersonality(uint256 botId) view returns ((uint256,string,string,uint8,uint8,uint8,uint8,uint8,bool,address,uint256,uint256,uint256))',
    'function getBettingStrategy(uint256 botId) view returns ((uint256,uint256,uint8[],uint8,bool,bool))',
    'function requestBotDecision(uint256 botId, uint256 seriesId, uint8 gamePhase) returns (uint256)',
    'function isDecisionPending(uint256 requestId) view returns (bool)',
    'function getBotVault(uint256 botId) view returns (address)',
    'function isInitialized() view returns (bool)',
    'function totalBots() view returns (uint256)'
  ]),
  
  CrapsVault: parseAbi([
    'function getVaultBalance() view returns (uint256)',
    'function getTotalLP() view returns (uint256)',
    'function getPlayerShare(address player) view returns (uint256)',
    'function processBet(address player, uint256 amount) returns (bool)',
    'function processPayout(address player, uint256 amount) returns (bool)',
    'function allocateProfit(uint256 seriesId, uint256 profit)',
    'function allocateLoss(uint256 seriesId, uint256 loss)',
    'function getSeriesResults(uint256 seriesId) view returns ((uint256,uint256,uint256,uint256))',
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)'
  ]),
  
  StakingPool: parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalStaked() view returns (uint256)',
    'function stake(uint256 amount)',
    'function unstake(uint256 amount)',
    'function earned(address) view returns (uint256)',
    'function getRewardRate() view returns (uint256)',
    'function lastUpdateTime() view returns (uint256)'
  ]),
  
  Treasury: parseAbi([
    'function getTotalStats() view returns ((uint256,uint256,uint256,uint256))',
    'function getAccumulatedFees(address) view returns (uint256)',
    'function distributeFees()',
    'function updateFeeDistribution(uint256 stakingFee, uint256 vaultFee)',
    'function totalFeesCollected() view returns (uint256)'
  ])
};

class ContractInteractionTester {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.account = null;
    this.contracts = {};
    this.contractAddresses = {};
    this.testResults = {};
    this.failedTests = [];
    this.passedTests = [];
  }
  
  async init() {
    console.log(chalk.bold.cyan('🧪 Contract Interaction Tester'));
    console.log(chalk.yellow('Testing real blockchain contract calls (not simulations)\n'));
    
    // Load deployment configuration
    const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('No deployment found. Please run deployment first.');
    }
    
    const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    this.contractAddresses = config.contracts;
    
    console.log(chalk.blue('📋 Loaded contract addresses:'));
    Object.entries(this.contractAddresses).forEach(([name, address]) => {
      console.log(chalk.gray(`  ${name}: ${address}`));
    });
    console.log();
    
    // Setup Viem clients
    this.publicClient = createPublicClient({
      chain: hardhatChain,
      transport: http()
    });
    
    // Use hardhat default account
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    this.account = privateKeyToAccount(privateKey);
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: hardhatChain,
      transport: http()
    });
    
    // Initialize contracts
    await this.initializeContracts();
    
    console.log(chalk.green(`✅ Connected to Hardhat Network`));
    console.log(chalk.gray(`Test Account: ${this.account.address}\n`));
  }
  
  async initializeContracts() {
    const spinner = ora('Initializing contract interfaces...').start();
    
    try {
      for (const [name, address] of Object.entries(this.contractAddresses)) {
        if (CONTRACT_ABIS[name]) {
          this.contracts[name] = {
            address,
            abi: CONTRACT_ABIS[name],
            read: async (functionName, args = []) => {
              return await this.publicClient.readContract({
                address,
                abi: CONTRACT_ABIS[name],
                functionName,
                args
              });
            },
            write: async (functionName, args = []) => {
              const { request } = await this.publicClient.simulateContract({
                account: this.account,
                address,
                abi: CONTRACT_ABIS[name],
                functionName,
                args
              });
              return await this.walletClient.writeContract(request);
            }
          };
        }
      }
      
      spinner.succeed('Contract interfaces initialized');
    } catch (error) {
      spinner.fail(`Contract initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  async runAllTests() {
    console.log(chalk.bold.yellow('🚀 Starting Comprehensive Contract Testing\n'));
    
    const testSuites = [
      { name: 'BOT Token Contract', test: () => this.testBOTToken() },
      { name: 'Bot Manager Contract', test: () => this.testBotManager() },
      { name: 'Craps Game Contract', test: () => this.testCrapsGame() },
      { name: 'Craps Bets Contract', test: () => this.testCrapsBets() },
      { name: 'Craps Vault Contract', test: () => this.testCrapsVault() },
      { name: 'Staking Pool Contract', test: () => this.testStakingPool() },
      { name: 'Treasury Contract', test: () => this.testTreasury() },
      { name: 'Integration Tests', test: () => this.testIntegration() }
    ];
    
    for (const suite of testSuites) {
      await this.runTestSuite(suite.name, suite.test);
    }
    
    await this.showFinalResults();
  }
  
  async runTestSuite(suiteName, testFunction) {
    console.log(chalk.bold.blue(`\n📦 Testing: ${suiteName}`));
    console.log(chalk.gray('─'.repeat(60)));
    
    try {
      await testFunction();
      console.log(chalk.green(`✅ ${suiteName} completed successfully\n`));
    } catch (error) {
      console.log(chalk.red(`❌ ${suiteName} failed: ${error.message}\n`));
      this.failedTests.push(`${suiteName}: ${error.message}`);
    }
  }
  
  async testFunction(contractName, functionName, args = [], testName = null) {
    const fullTestName = testName || `${contractName}.${functionName}()`;
    
    try {
      console.log(chalk.cyan(`  🔍 Testing: ${fullTestName}`));
      
      if (!this.contracts[contractName]) {
        throw new Error(`Contract ${contractName} not found`);
      }
      
      const result = await this.contracts[contractName].read(functionName, args);
      console.log(chalk.green(`    ✅ Success: ${this.formatResult(result)}`));
      this.passedTests.push(fullTestName);
      return result;
      
    } catch (error) {
      console.log(chalk.red(`    ❌ Failed: ${error.message}`));
      this.failedTests.push(`${fullTestName}: ${error.message}`);
      throw error;
    }
  }
  
  async testWriteFunction(contractName, functionName, args = [], testName = null) {
    const fullTestName = testName || `${contractName}.${functionName}()`;
    
    try {
      console.log(chalk.cyan(`  🔍 Testing: ${fullTestName} (write)`));
      
      if (!this.contracts[contractName]) {
        throw new Error(`Contract ${contractName} not found`);
      }
      
      const hash = await this.contracts[contractName].write(functionName, args);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      console.log(chalk.green(`    ✅ Success: tx ${hash.slice(0, 10)}... (gas: ${receipt.gasUsed})`));
      this.passedTests.push(fullTestName);
      return receipt;
      
    } catch (error) {
      console.log(chalk.red(`    ❌ Failed: ${error.message}`));
      this.failedTests.push(`${fullTestName}: ${error.message}`);
      throw error;
    }
  }
  
  async testBOTToken() {
    await this.testFunction('BOTToken', 'name', [], 'Get token name');
    await this.testFunction('BOTToken', 'symbol', [], 'Get token symbol');
    await this.testFunction('BOTToken', 'decimals', [], 'Get token decimals');
    await this.testFunction('BOTToken', 'totalSupply', [], 'Get total supply');
    
    const balance = await this.testFunction('BOTToken', 'balanceOf', [this.account.address], 'Get account balance');
    console.log(chalk.blue(`    💰 Account balance: ${formatEther(balance)} BOT`));
    
    // Test allowance
    await this.testFunction('BOTToken', 'allowance', [this.account.address, this.contractAddresses.CrapsBets], 'Check CrapsBets allowance');
    
    // Test approval (write function)
    const approveAmount = parseEther('1000');
    await this.testWriteFunction('BOTToken', 'approve', [this.contractAddresses.CrapsBets, approveAmount], 'Approve CrapsBets spending');
    
    // Verify approval worked
    const allowance = await this.testFunction('BOTToken', 'allowance', [this.account.address, this.contractAddresses.CrapsBets], 'Verify approval');
    console.log(chalk.blue(`    ✅ Allowance set: ${formatEther(allowance)} BOT`));
  }
  
  async testBotManager() {
    // Test if contract is initialized
    try {
      const initialized = await this.testFunction('BotManagerV2Plus', 'isInitialized', [], 'Check if initialized');
      console.log(chalk.blue(`    📊 Initialized: ${initialized}`));
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  isInitialized() not available, continuing...`));
    }
    
    // Test bot count
    const botCount = await this.testFunction('BotManagerV2Plus', 'getBotCount', [], 'Get bot count');
    console.log(chalk.blue(`    🤖 Bot count: ${botCount}`));
    
    if (Number(botCount) > 0) {
      // Test getting first bot personality
      try {
        const personality = await this.testFunction('BotManagerV2Plus', 'getBotPersonality', [0n], 'Get bot 0 personality');
        console.log(chalk.blue(`    🎭 Bot 0 name: ${personality[1] || 'N/A'}`));
      } catch (error) {
        console.log(chalk.yellow(`    ⚠️  Bot personality format may differ: ${error.message}`));
      }
      
      // Test getting betting strategy
      try {
        const strategy = await this.testFunction('BotManagerV2Plus', 'getBettingStrategy', [0n], 'Get bot 0 strategy');
        console.log(chalk.blue(`    💰 Bot 0 base bet: ${formatEther(strategy[1] || 0n)} BOT`));
      } catch (error) {
        console.log(chalk.yellow(`    ⚠️  Bot strategy format may differ: ${error.message}`));
      }
      
      // Test bot vault address
      try {
        await this.testFunction('BotManagerV2Plus', 'getBotVault', [0n], 'Get bot 0 vault');
      } catch (error) {
        console.log(chalk.yellow(`    ⚠️  Bot vault not set: ${error.message}`));
      }
    }
  }
  
  async testCrapsGame() {
    // Test game state functions
    await this.testFunction('CrapsGameV2Plus', 'isGameActive', [], 'Check if game is active');
    await this.testFunction('CrapsGameV2Plus', 'getCurrentPhase', [], 'Get current phase');
    await this.testFunction('CrapsGameV2Plus', 'getCurrentPoint', [], 'Get current point');
    await this.testFunction('CrapsGameV2Plus', 'currentSeriesId', [], 'Get current series ID');
    
    // Test if we can place certain bet types
    try {
      await this.testFunction('CrapsGameV2Plus', 'canPlaceBet', [0], 'Can place Pass Line bet');
      await this.testFunction('CrapsGameV2Plus', 'canPlaceBet', [1], 'Can place Don\'t Pass bet');
      await this.testFunction('CrapsGameV2Plus', 'canPlaceBet', [4], 'Can place Field bet');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  canPlaceBet() may not be implemented: ${error.message}`));
    }
    
    // Test game initialization (write function)
    try {
      await this.testWriteFunction('CrapsGameV2Plus', 'initializeGame', [], 'Initialize game');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Game may already be initialized: ${error.message}`));
    }
  }
  
  async testCrapsBets() {
    // Test bet limits
    await this.testFunction('CrapsBets', 'minBetAmount', [], 'Get minimum bet amount');
    await this.testFunction('CrapsBets', 'maxBetAmount', [], 'Get maximum bet amount');
    
    // Test player bets for our account
    const playerBets = await this.testFunction('CrapsBets', 'getPlayerBets', [this.account.address], 'Get player bets summary');
    console.log(chalk.blue(`    💰 Player total at risk: ${formatEther(playerBets[2] || 0n)} BOT`));
    
    // Test active bet types
    const activeBetTypes = await this.testFunction('CrapsBets', 'getActiveBetTypes', [this.account.address], 'Get active bet types');
    console.log(chalk.blue(`    🎲 Active bet types: ${activeBetTypes.length}`));
    
    // Test if player has specific bets
    await this.testFunction('CrapsBets', 'hasActiveBet', [this.account.address, 0], 'Has Pass Line bet');
    await this.testFunction('CrapsBets', 'hasActiveBet', [this.account.address, 1], 'Has Don\'t Pass bet');
    
    // Test placing a bet (write function)
    try {
      const betAmount = parseEther('10'); // 10 BOT minimum bet
      await this.testWriteFunction('CrapsBets', 'placeBet', [0, betAmount], 'Place Pass Line bet');
      
      // Verify bet was placed
      const hasBet = await this.testFunction('CrapsBets', 'hasActiveBet', [this.account.address, 0], 'Verify Pass Line bet placed');
      console.log(chalk.blue(`    ✅ Pass Line bet placed: ${hasBet}`));
      
      // Get bet details
      const betDetails = await this.testFunction('CrapsBets', 'getBet', [this.account.address, 0], 'Get Pass Line bet details');
      console.log(chalk.blue(`    💰 Bet amount: ${formatEther(betDetails[0] || 0n)} BOT`));
      
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Bet placement failed (may need token approval): ${error.message}`));
    }
  }
  
  async testCrapsVault() {
    // Test vault state
    try {
      const vaultBalance = await this.testFunction('CrapsVault', 'getVaultBalance', [], 'Get vault balance');
      console.log(chalk.blue(`    💰 Vault balance: ${formatEther(vaultBalance)} BOT`));
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Vault balance function may differ: ${error.message}`));
    }
    
    try {
      const totalLP = await this.testFunction('CrapsVault', 'getTotalLP', [], 'Get total LP tokens');
      console.log(chalk.blue(`    🏦 Total LP: ${formatEther(totalLP)} LP`));
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  LP function may differ: ${error.message}`));
    }
    
    // Test player share
    try {
      await this.testFunction('CrapsVault', 'getPlayerShare', [this.account.address], 'Get player LP share');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Player share function may differ: ${error.message}`));
    }
    
    // Test ERC20 functions if vault is tokenized
    try {
      await this.testFunction('CrapsVault', 'balanceOf', [this.account.address], 'Get vault token balance');
      await this.testFunction('CrapsVault', 'totalSupply', [], 'Get vault total supply');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Vault may not be ERC20: ${error.message}`));
    }
  }
  
  async testStakingPool() {
    // Test staking state
    await this.testFunction('StakingPool', 'totalStaked', [], 'Get total staked amount');
    await this.testFunction('StakingPool', 'balanceOf', [this.account.address], 'Get user staked balance');
    await this.testFunction('StakingPool', 'earned', [this.account.address], 'Get earned rewards');
    
    // Test additional staking functions
    try {
      await this.testFunction('StakingPool', 'getRewardRate', [], 'Get reward rate');
      await this.testFunction('StakingPool', 'lastUpdateTime', [], 'Get last update time');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Additional staking functions may not exist: ${error.message}`));
    }
  }
  
  async testTreasury() {
    // Test treasury stats
    const stats = await this.testFunction('Treasury', 'getTotalStats', [], 'Get total treasury stats');
    console.log(chalk.blue(`    📊 Treasury stats: ${stats.length} fields`));
    
    // Test accumulated fees
    await this.testFunction('Treasury', 'getAccumulatedFees', [this.account.address], 'Get accumulated fees');
    
    // Test additional treasury functions
    try {
      await this.testFunction('Treasury', 'totalFeesCollected', [], 'Get total fees collected');
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Additional treasury functions may not exist: ${error.message}`));
    }
  }
  
  async testIntegration() {
    console.log(chalk.cyan('  🔗 Testing cross-contract integration...'));
    
    // Test game-bet integration
    try {
      const gameActive = await this.contracts.CrapsGameV2Plus.read('isGameActive');
      const seriesId = await this.contracts.CrapsGameV2Plus.read('currentSeriesId');
      console.log(chalk.blue(`    🎮 Game active: ${gameActive}, Series: ${seriesId}`));
      
      // Test if bets can be placed when game is active
      if (gameActive) {
        const canPlacePass = await this.contracts.CrapsGameV2Plus.read('canPlaceBet', [0]);
        console.log(chalk.blue(`    ✅ Can place Pass Line: ${canPlacePass}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Game-bet integration test skipped: ${error.message}`));
    }
    
    // Test token-vault integration
    try {
      const botBalance = await this.contracts.BOTToken.read('balanceOf', [this.account.address]);
      const vaultAllowance = await this.contracts.BOTToken.read('allowance', [this.account.address, this.contractAddresses.CrapsVault]);
      console.log(chalk.blue(`    💰 BOT balance: ${formatEther(botBalance)}, Vault allowance: ${formatEther(vaultAllowance)}`));
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Token-vault integration test failed: ${error.message}`));
    }
    
    // Test bot manager initialization
    try {
      const botCount = await this.contracts.BotManagerV2Plus.read('getBotCount');
      if (Number(botCount) === 0) {
        console.log(chalk.yellow(`    ⚠️  Bot manager not initialized (0 bots)`));
      } else {
        console.log(chalk.blue(`    🤖 Bot manager has ${botCount} bots initialized`));
      }
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Bot manager test failed: ${error.message}`));
    }
  }
  
  async showFinalResults() {
    console.log(chalk.bold.yellow('\n📋 Test Results Summary'));
    console.log('═'.repeat(80));
    
    console.log(chalk.green(`\n✅ Passed Tests: ${this.passedTests.length}`));
    this.passedTests.forEach(test => {
      console.log(chalk.gray(`  ✓ ${test}`));
    });
    
    if (this.failedTests.length > 0) {
      console.log(chalk.red(`\n❌ Failed Tests: ${this.failedTests.length}`));
      this.failedTests.forEach(test => {
        console.log(chalk.gray(`  ✗ ${test}`));
      });
    }
    
    const totalTests = this.passedTests.length + this.failedTests.length;
    const successRate = totalTests > 0 ? ((this.passedTests.length / totalTests) * 100).toFixed(1) : 0;
    
    console.log(chalk.bold.cyan(`\n📊 Success Rate: ${successRate}% (${this.passedTests.length}/${totalTests})`));
    
    if (this.failedTests.length === 0) {
      console.log(chalk.bold.green('\n🎉 All contract interactions working perfectly!'));
    } else if (successRate >= 80) {
      console.log(chalk.bold.yellow('\n⚠️  Most contract interactions working, some issues found'));
    } else {
      console.log(chalk.bold.red('\n❌ Significant contract interaction issues detected'));
    }
    
    console.log('\n═'.repeat(80));
  }
  
  formatResult(result) {
    if (typeof result === 'bigint') {
      if (result > 1000000000000000000n) { // If > 1 ether, format as ether
        return `${formatEther(result)} (${result})`;
      }
      return result.toString();
    }
    if (Array.isArray(result)) {
      return `Array[${result.length}]`;
    }
    if (typeof result === 'string') {
      return result.length > 50 ? `${result.slice(0, 47)}...` : result;
    }
    return String(result);
  }
}

// Main execution
async function main() {
  try {
    const tester = new ContractInteractionTester();
    await tester.init();
    await tester.runAllTests();
  } catch (error) {
    console.error(chalk.red('Contract testing failed:'), error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ContractInteractionTester;