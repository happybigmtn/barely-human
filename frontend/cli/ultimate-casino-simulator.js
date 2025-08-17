#!/usr/bin/env node

/**
 * Ultimate Viem-Based Casino Simulator
 * Features:
 * - Complete 5-series simulation with full LP escrow testing
 * - Enhanced ASCII art including dice, game tables, and card symbols
 * - Additional bet types for comprehensive testing
 * - Bot personality-driven AI with realistic betting patterns
 * - Interactive spectator betting with keyboard shortcuts
 * - Real-time profit/loss allocation tracking
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
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

// Enhanced ASCII Art Elements
const DICE_FACES = {
  1: [
    '┌─────────┐',
    '│         │',
    '│    ●    │',
    '│         │',
    '└─────────┘'
  ],
  2: [
    '┌─────────┐',
    '│ ●       │',
    '│         │',
    '│       ● │',
    '└─────────┘'
  ],
  3: [
    '┌─────────┐',
    '│ ●       │',
    '│    ●    │',
    '│       ● │',
    '└─────────┘'
  ],
  4: [
    '┌─────────┐',
    '│ ●     ● │',
    '│         │',
    '│ ●     ● │',
    '└─────────┘'
  ],
  5: [
    '┌─────────┐',
    '│ ●     ● │',
    '│    ●    │',
    '│ ●     ● │',
    '└─────────┘'
  ],
  6: [
    '┌─────────┐',
    '│ ●     ● │',
    '│ ●     ● │',
    '│ ●     ● │',
    '└─────────┘'
  ]
};

const CRAPS_TABLE = [
  '╔════════════════════════════════════════════════════════════════════════════════════════════════════════════╗',
  '║                                            🎲 CRAPS TABLE 🎲                                                 ║',
  '╠═══════════════════════════════╦════════════════════════════════════════════════════════════════════════════╣',
  '║         DON\'T PASS BAR        ║                           COME                                             ║',
  '║              12               ║                                                                            ║',
  '╠═══════════════════════════════╬════════════════════════════════════════════════════════════════════════════╣',
  '║                               ║  4   5   6   8   9   10  ║ FIELD ║ 2,3,4,9,10,11,12 ║                    ║',
  '║         PASS LINE             ║                          ║  PAYS ║     2:1 on 2,12   ║     HARD WAYS      ║',
  '║                               ║                          ║  EVEN ║     3:1 on 12     ║                    ║',
  '╚═══════════════════════════════╩══════════════════════════╩═══════╩═══════════════════╩════════════════════╝'
];

const CARD_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

// Comprehensive Contract ABIs
const CONTRACT_ABIS = {
  BOTToken: parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function name() view returns (string)',
    'function symbol() view returns (string)'
  ]),
  
  CrapsGameV2Plus: parseAbi([
    'function currentSeriesId() view returns (uint256)',
    'function getCurrentPhase() view returns (uint8)',
    'function getCurrentPoint() view returns (uint256)',
    'function rollDice() returns (uint256)',
    'function isGameActive() view returns (bool)',
    'function initializeGame()',
    'function startNewSeries()'
  ]),
  
  CrapsBets: parseAbi([
    'function placeBet(uint8 betType, uint256 amount)',
    'function getBetInfo(address player, uint8 betType) view returns ((uint256,uint256,bool,bool))',
    'function playerBets(address player, uint8 betType) view returns ((uint256,uint256,bool,bool))',
    'function getPlayerActiveBets(address player) view returns (uint8[])',
    'function removeBet(uint8 betType)',
    'function placeOddsBet(uint8 baseBetType, uint256 oddsAmount)'
  ]),
  
  BotManagerV2Plus: parseAbi([
    'function getBotCount() view returns (uint256)',
    'function getBotPersonality(uint256 botId) view returns ((string,uint8,uint8,uint8,address))',
    'function getBettingStrategy(uint256 botId) view returns ((uint8,uint256,uint256,uint8))',
    'function requestBotDecision(uint256 botId, uint256 seriesId, uint8 gamePhase) returns (uint256)'
  ]),
  
  CrapsVault: parseAbi([
    'function getVaultBalance() view returns (uint256)',
    'function getTotalLP() view returns (uint256)',
    'function getPlayerShare(address player) view returns (uint256)',
    'function processBet(address player, uint256 amount) returns (bool)',
    'function processPayout(address player, uint256 amount) returns (bool)',
    'function allocateProfit(uint256 seriesId, uint256 profit)',
    'function allocateLoss(uint256 seriesId, uint256 loss)',
    'function getSeriesResults(uint256 seriesId) view returns ((uint256,uint256,uint256,uint256))'
  ]),
  
  StakingPool: parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalStaked() view returns (uint256)',
    'function stake(uint256 amount)',
    'function earned(address) view returns (uint256)'
  ]),
  
  Treasury: parseAbi([
    'function getTotalStats() view returns ((uint256,uint256,uint256,uint256))',
    'function getAccumulatedFees(address) view returns (uint256)'
  ])
};

// Enhanced Bot Personalities with Detailed Descriptions
const BOT_PERSONALITIES = [
  {
    name: 'Alice "All-In"',
    description: 'Aggressive high-roller who lives for the adrenaline rush',
    emoji: '💥',
    catchphrase: 'GO BIG OR GO HOME!'
  },
  {
    name: 'Bob "Calculator"',
    description: 'Statistical analyzer who knows every odds calculation',
    emoji: '🧮',
    catchphrase: 'The numbers don\'t lie...'
  },
  {
    name: 'Charlie "Lucky"',
    description: 'Superstitious gambler who reads signs in everything',
    emoji: '🍀',
    catchphrase: 'I feel it in my bones!'
  },
  {
    name: 'Diana "Ice Queen"',
    description: 'Cold, methodical player with nerves of steel',
    emoji: '❄️',
    catchphrase: 'Emotions are for amateurs.'
  },
  {
    name: 'Eddie "Entertainer"',
    description: 'Theatrical showman who makes every bet a performance',
    emoji: '🎭',
    catchphrase: 'Ladies and gentlemen...'
  },
  {
    name: 'Fiona "Fearless"',
    description: 'Adrenaline junkie who never backs down from a challenge',
    emoji: '⚡',
    catchphrase: 'Fear is just weakness leaving the body!'
  },
  {
    name: 'Greg "Grinder"',
    description: 'Patient, steady player who believes slow wins the race',
    emoji: '🐢',
    catchphrase: 'Slow and steady wins the race.'
  },
  {
    name: 'Helen "Hot Streak"',
    description: 'Momentum believer who rides waves of luck',
    emoji: '🔥',
    catchphrase: 'I\'m on fire tonight!'
  },
  {
    name: 'Ivan "Intimidator"',
    description: 'Uses psychological warfare and mind games',
    emoji: '👁️',
    catchphrase: 'I can see your fear...'
  },
  {
    name: 'Julia "Jinx"',
    description: 'Claims mysterious power to control luck itself',
    emoji: '🔮',
    catchphrase: 'The dice whisper to me...'
  }
];

// Comprehensive Bet Types (All 64 Types)
const COMPREHENSIVE_BET_TYPES = {
  // Line Bets (0-3)
  0: { name: 'Pass Line', payout: '1:1', house_edge: '1.36%' },
  1: { name: "Don't Pass", payout: '1:1', house_edge: '1.36%' },
  2: { name: 'Come', payout: '1:1', house_edge: '1.36%' },
  3: { name: "Don't Come", payout: '1:1', house_edge: '1.36%' },
  
  // Field & Single Roll Bets (4-15)
  4: { name: 'Field', payout: '1:1/2:1', house_edge: '2.78%' },
  5: { name: 'Big 6', payout: '1:1', house_edge: '9.09%' },
  6: { name: 'Big 8', payout: '1:1', house_edge: '9.09%' },
  7: { name: 'Any 7', payout: '4:1', house_edge: '16.67%' },
  8: { name: 'Any Craps', payout: '7:1', house_edge: '11.11%' },
  9: { name: 'Craps 2', payout: '30:1', house_edge: '13.89%' },
  10: { name: 'Craps 3', payout: '15:1', house_edge: '11.11%' },
  11: { name: 'Craps 12', payout: '30:1', house_edge: '13.89%' },
  12: { name: 'Yo (11)', payout: '15:1', house_edge: '11.11%' },
  13: { name: 'Hop 2-2', payout: '30:1', house_edge: '13.89%' },
  14: { name: 'Hop 1-1', payout: '30:1', house_edge: '13.89%' },
  15: { name: 'Hop 6-6', payout: '30:1', house_edge: '13.89%' },
  
  // Hard Ways (16-23)
  16: { name: 'Hard 4', payout: '7:1', house_edge: '11.11%' },
  17: { name: 'Hard 6', payout: '9:1', house_edge: '9.09%' },
  18: { name: 'Hard 8', payout: '9:1', house_edge: '9.09%' },
  19: { name: 'Hard 10', payout: '7:1', house_edge: '11.11%' },
  20: { name: 'Easy 4', payout: '7:1', house_edge: '16.67%' },
  21: { name: 'Easy 6', payout: '7:1', house_edge: '16.67%' },
  22: { name: 'Easy 8', payout: '7:1', house_edge: '16.67%' },
  23: { name: 'Easy 10', payout: '7:1', house_edge: '16.67%' },
  
  // Place Bets (24-35)
  24: { name: 'Place 4', payout: '9:5', house_edge: '6.67%' },
  25: { name: 'Place 5', payout: '7:5', house_edge: '4.00%' },
  26: { name: 'Place 6', payout: '7:6', house_edge: '1.52%' },
  27: { name: 'Place 8', payout: '7:6', house_edge: '1.52%' },
  28: { name: 'Place 9', payout: '7:5', house_edge: '4.00%' },
  29: { name: 'Place 10', payout: '9:5', house_edge: '6.67%' },
  30: { name: 'Buy 4', payout: '2:1', house_edge: '4.76%' },
  31: { name: 'Buy 5', payout: '3:2', house_edge: '4.76%' },
  32: { name: 'Buy 6', payout: '6:5', house_edge: '4.76%' },
  33: { name: 'Buy 8', payout: '6:5', house_edge: '4.76%' },
  34: { name: 'Buy 9', payout: '3:2', house_edge: '4.76%' },
  35: { name: 'Buy 10', payout: '2:1', house_edge: '4.76%' },
  
  // Lay Bets (36-47)
  36: { name: 'Lay 4', payout: '1:2', house_edge: '2.44%' },
  37: { name: 'Lay 5', payout: '2:3', house_edge: '3.23%' },
  38: { name: 'Lay 6', payout: '5:6', house_edge: '4.00%' },
  39: { name: 'Lay 8', payout: '5:6', house_edge: '4.00%' },
  40: { name: 'Lay 9', payout: '2:3', house_edge: '3.23%' },
  41: { name: 'Lay 10', payout: '1:2', house_edge: '2.44%' },
  42: { name: 'Dont Place 4', payout: '5:11', house_edge: '3.03%' },
  43: { name: 'Dont Place 5', payout: '5:8', house_edge: '2.50%' },
  44: { name: 'Dont Place 6', payout: '4:5', house_edge: '1.82%' },
  45: { name: 'Dont Place 8', payout: '4:5', house_edge: '1.82%' },
  46: { name: 'Dont Place 9', payout: '5:8', house_edge: '2.50%' },
  47: { name: 'Dont Place 10', payout: '5:11', house_edge: '3.03%' },
  
  // Odds Bets (48-55)
  48: { name: 'Pass Odds', payout: 'True Odds', house_edge: '0.00%' },
  49: { name: 'Dont Pass Odds', payout: 'True Odds', house_edge: '0.00%' },
  50: { name: 'Come Odds', payout: 'True Odds', house_edge: '0.00%' },
  51: { name: 'Dont Come Odds', payout: 'True Odds', house_edge: '0.00%' },
  52: { name: 'Pass Line Odds 4/10', payout: '2:1', house_edge: '0.00%' },
  53: { name: 'Pass Line Odds 5/9', payout: '3:2', house_edge: '0.00%' },
  54: { name: 'Pass Line Odds 6/8', payout: '6:5', house_edge: '0.00%' },
  55: { name: 'Come Bet Odds', payout: 'True Odds', house_edge: '0.00%' },
  
  // Proposition Bets (56-63)
  56: { name: 'Horn High 2', payout: '27:1', house_edge: '12.78%' },
  57: { name: 'Horn High 3', payout: '13:1', house_edge: '11.11%' },
  58: { name: 'Horn High 11', payout: '13:1', house_edge: '11.11%' },
  59: { name: 'Horn High 12', payout: '27:1', house_edge: '12.78%' },
  60: { name: 'World Bet', payout: '26:1/11:1', house_edge: '13.33%' },
  61: { name: 'C&E (Craps Eleven)', payout: '3:1/7:1', house_edge: '11.11%' },
  62: { name: 'Three Way Craps', payout: '15:1/30:1', house_edge: '11.11%' },
  63: { name: 'Fire Bet', payout: '24:1 to 999:1', house_edge: '20.61%' }
};

const GAME_PHASES = {
  0: 'IDLE',
  1: 'COME_OUT',
  2: 'POINT'
};

class UltimateCasinoSimulator {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.account = null;
    this.contracts = {};
    this.contractAddresses = {};
    
    // Enhanced game state
    this.gameStats = {
      seriesNumber: 0,
      totalGames: 0,
      totalRolls: 0,
      botWins: {},
      spectatorBets: 0,
      spectatorWinnings: 0,
      lpEscrowData: {},
      profitDistribution: {},
      lossAllocation: {}
    };
    
    // Enhanced bot simulation state
    this.activeBots = [];
    this.gameHistory = [];
    this.spectatorBalance = parseEther('1000');
    
    // LP Escrow tracking
    this.lpEscrowBalance = parseEther('100000'); // Starting LP pool
    this.lpParticipants = new Map();
    this.seriesResults = new Map();
  }
  
  async init() {
    // Enhanced title screen
    console.log(chalk.magenta(figlet.textSync('ULTIMATE', { horizontalLayout: 'fitted' })));
    console.log(chalk.cyan(figlet.textSync('CRAPS CASINO', { horizontalLayout: 'fitted' })));
    console.log(chalk.yellow('🎲 Viem-Powered Bot Simulation & LP Escrow Testing 🎰\n'));
    
    // Display ASCII craps table
    console.log(chalk.green('🎯 Welcome to the most realistic Craps simulation! 🎯\n'));
    CRAPS_TABLE.forEach(line => console.log(chalk.white(line)));
    console.log();
    
    // Load deployment configuration
    const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
    const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    this.contractAddresses = config.contracts;
    
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
    
    console.log(chalk.green(`✅ Connected to Hardhat Local Network`));
    console.log(chalk.gray(`Account: ${this.account.address}`));
    
    const balance = await this.publicClient.getBalance({ address: this.account.address });
    console.log(chalk.gray(`ETH Balance: ${formatEther(balance)} ETH\n`));
  }
  
  async initializeContracts() {
    const spinner = ora('Initializing enhanced contract system...').start();
    
    try {
      // Initialize each contract with Viem
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
          spinner.text = `Initialized ${name}`;
        }
      }
      
      spinner.succeed('All contracts initialized');
      
      // Load enhanced bot data
      await this.loadEnhancedBotPersonalities();
      
      // Initialize LP escrow system
      await this.initializeLPEscrow();
      
    } catch (error) {
      spinner.fail(`Contract initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  async loadEnhancedBotPersonalities() {
    try {
      const botCount = await this.contracts.BotManagerV2Plus.read('getBotCount');
      console.log(chalk.blue(`\n🤖 Loading ${botCount} Enhanced AI Bot Personalities...\n`));
      
      const useContractData = Number(botCount) === 10;
      
      for (let i = 0; i < Math.min(Number(botCount), 10); i++) {
        let personality, strategy;
        
        if (useContractData) {
          try {
            personality = await this.contracts.BotManagerV2Plus.read('getBotPersonality', [BigInt(i)]);
            strategy = await this.contracts.BotManagerV2Plus.read('getBettingStrategy', [BigInt(i)]);
          } catch (error) {
            console.log(chalk.yellow(`  Warning: Using enhanced fallback data for bot ${i}`));
            personality = [BOT_PERSONALITIES[i].name, 5, 5, 5, '0x0000000000000000000000000000000000000000'];
            strategy = [0, parseEther('10'), parseEther('100'), 2];
          }
        } else {
          // Enhanced fallback data
          personality = [BOT_PERSONALITIES[i].name, 5 + i, 3 + i, 4 + i, '0x0000000000000000000000000000000000000000'];
          strategy = [i % 3, parseEther((10 + i * 5).toString()), parseEther((50 + i * 20).toString()), 2 + (i % 3)];
        }
        
        this.activeBots.push({
          id: i,
          name: (personality[0] && personality[0].length > 0) ? personality[0] : BOT_PERSONALITIES[i].name,
          description: BOT_PERSONALITIES[i].description,
          emoji: BOT_PERSONALITIES[i].emoji,
          catchphrase: BOT_PERSONALITIES[i].catchphrase,
          aggressiveness: Number(personality[1]) || (5 + i),
          riskTolerance: Number(personality[2]) || (3 + i),
          patternBelief: Number(personality[3]) || (4 + i),
          vaultAddress: personality[4] || '0x0000000000000000000000000000000000000000',
          strategy: {
            baseBetSize: strategy[1] || parseEther((18 + i * 12).toString()),
            maxBetSize: strategy[2] || parseEther((120 + i * 240).toString()),
            streakMultiplier: Number(strategy[3]) || 2,
            preferredBets: this.generatePreferredBets(i)
          },
          stats: {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            totalWagered: 0n,
            totalWinnings: 0n,
            currentStreak: 0,
            hotStreak: false
          }
        });
        
        console.log(chalk.cyan(`  ${BOT_PERSONALITIES[i].emoji} ${this.activeBots[i].name}`));
        console.log(chalk.gray(`     ${this.activeBots[i].description}`));
      }
      
      console.log();
    } catch (error) {
      console.error(chalk.red(`Failed to load bot personalities: ${error.message}`));
      this.createEnhancedFallbackBots();
    }
  }
  
  generatePreferredBets(botId) {
    const preferences = {
      0: [0, 4, 48], // Alice: Pass, Field, Pass Odds
      1: [0, 24, 48], // Bob: Pass, Place 4, Pass Odds
      2: [16, 17, 12], // Charlie: Hard 4, Hard 6, Yo
      3: [1, 49, 36], // Diana: Don't Pass, Don't Pass Odds, Lay 4
      4: [7, 8, 60], // Eddie: Any 7, Any Craps, World Bet
      5: [0, 2, 24], // Fiona: Pass, Come, Place 4
      6: [26, 27, 48], // Greg: Place 6, Place 8, Pass Odds
      7: [0, 4, 16], // Helen: Pass, Field, Hard 4
      8: [1, 37, 40], // Ivan: Don't Pass, Lay 5, Lay 9
      9: [13, 14, 62] // Julia: Hop 2-2, Hop 1-1, Three Way Craps
    };
    
    return preferences[botId] || [0, 4, 26]; // Default: Pass, Field, Place 6
  }
  
  createEnhancedFallbackBots() {
    console.log(chalk.yellow('Using enhanced fallback bot personalities...\n'));
    
    for (let i = 0; i < 10; i++) {
      this.activeBots.push({
        id: i,
        name: BOT_PERSONALITIES[i].name,
        description: BOT_PERSONALITIES[i].description,
        emoji: BOT_PERSONALITIES[i].emoji,
        catchphrase: BOT_PERSONALITIES[i].catchphrase,
        aggressiveness: 3 + (i % 7),
        riskTolerance: 2 + (i % 8),
        patternBelief: 1 + (i % 9),
        vaultAddress: '0x0000000000000000000000000000000000000000',
        strategy: {
          baseBetSize: parseEther((18 + i * 12).toString()),
          maxBetSize: parseEther((120 + i * 240).toString()),
          streakMultiplier: 2 + (i % 3),
          preferredBets: this.generatePreferredBets(i)
        },
        stats: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          totalWagered: 0n,
          totalWinnings: 0n,
          currentStreak: 0,
          hotStreak: false
        }
      });
      
      console.log(chalk.cyan(`  ${BOT_PERSONALITIES[i].emoji} ${this.activeBots[i].name}`));
      console.log(chalk.gray(`     ${this.activeBots[i].description}`));
    }
    
    console.log();
  }
  
  async initializeLPEscrow() {
    console.log(chalk.blue('🏦 Initializing LP Escrow System...\n'));
    
    try {
      // Try to get vault balance
      const vaultBalance = await this.contracts.CrapsVault.read('getVaultBalance');
      console.log(chalk.green(`💰 Vault Balance: ${formatEther(vaultBalance)} BOT`));
    } catch (error) {
      console.log(chalk.yellow('📊 Using simulated LP escrow system'));
    }
    
    // Initialize LP participants (simulated for testing)
    this.lpParticipants.set('LP_Provider_1', { 
      contribution: parseEther('25000'), 
      share: 0.25,
      profits: 0n,
      losses: 0n
    });
    this.lpParticipants.set('LP_Provider_2', { 
      contribution: parseEther('35000'), 
      share: 0.35,
      profits: 0n,
      losses: 0n
    });
    this.lpParticipants.set('LP_Provider_3', { 
      contribution: parseEther('40000'), 
      share: 0.40,
      profits: 0n,
      losses: 0n
    });
    
    console.log(chalk.green('✅ LP Escrow System initialized with 3 providers\n'));
  }
  
  displayDice(die1, die2) {
    const dice1 = DICE_FACES[die1];
    const dice2 = DICE_FACES[die2];
    
    console.log(chalk.bold.yellow('\n🎲 DICE RESULT 🎲'));
    for (let i = 0; i < 5; i++) {
      console.log(chalk.white(`${dice1[i]}  ${dice2[i]}`));
    }
    
    const total = die1 + die2;
    console.log(chalk.bold.red(`\n🔥 TOTAL: ${total} 🔥`));
    
    // Special roll effects
    if (total === 7) {
      console.log(chalk.bold.magenta('💥 SEVEN OUT! 💥'));
    } else if (total === 11) {
      console.log(chalk.bold.green('🎉 YO ELEVEN! 🎉'));
    } else if (total === 2 || total === 3 || total === 12) {
      console.log(chalk.bold.red('💀 CRAPS! 💀'));
    } else if (die1 === die2) {
      console.log(chalk.bold.blue(`🎯 HARD ${total}! 🎯`));
    }
    
    return total;
  }
  
  async runUltimateSimulation() {
    console.log(chalk.bold.yellow('\n🎰 Starting Ultimate 5-Series Casino Simulation 🎰\n'));
    console.log(chalk.gray('Enhanced Features:'));
    console.log(chalk.gray('  ✓ Full LP escrow profit/loss allocation'));
    console.log(chalk.gray('  ✓ All 64 bet types available'));
    console.log(chalk.gray('  ✓ Advanced bot AI with personality-driven decisions'));
    console.log(chalk.gray('  ✓ Real-time ASCII visualization'));
    console.log(chalk.gray('  ✓ Interactive spectator betting\n'));
    
    console.log(chalk.yellow('Keyboard Controls:'));
    console.log(chalk.gray('  [1] Pass Line    [2] Don\'t Pass    [3] Field      [4] Come'));
    console.log(chalk.gray('  [5] Hard 4       [6] Place 6       [7] Any 7      [8] Horn'));
    console.log(chalk.gray('  [9] Odds Bet     [0] Random Prop   [q] Quit\n'));
    
    // Setup enhanced keyboard listener
    this.setupEnhancedKeyboardListener();
    
    // Run all 5 series
    for (let series = 1; series <= 5; series++) {
      this.gameStats.seriesNumber = series;
      console.log(chalk.bold.magenta(`\n════════════════════════════════════════════════════════════════════════════════════════════════════════════`));
      console.log(chalk.bold.magenta(`                                           🎲 SERIES ${series} 🎲                                               `));
      console.log(chalk.bold.magenta(`════════════════════════════════════════════════════════════════════════════════════════════════════════════\n`));
      
      await this.runEnhancedGameSeries();
      await this.showEnhancedSeriesResults();
      await this.updateLPEscrowResults(series);
      
      if (series < 5) {
        console.log(chalk.yellow('\n⏳ Preparing next series...'));
        await this.sleep(2000);
      }
    }
    
    await this.showUltimateFinalResults();
  }
  
  async runEnhancedGameSeries() {
    try {
      console.log(chalk.blue('🎯 Initializing enhanced game series...'));
      
      // Try to initialize game
      try {
        await this.contracts.CrapsGameV2Plus.write('initializeGame');
      } catch (error) {
        console.log(chalk.yellow('📊 Using simulation mode for game logic'));
      }
      
      let gameActive = true;
      let rollCount = 0;
      let point = 0;
      let phase = 1; // Start with come-out roll
      
      while (gameActive && rollCount < 25) {
        rollCount++;
        this.gameStats.totalRolls++;
        
        console.log(chalk.cyan(`\n┌─ Roll ${rollCount} ─ Series ${this.gameStats.seriesNumber} ─ Phase: ${GAME_PHASES[phase]} ${point > 0 ? `─ Point: ${point}` : ''} ─┐`));
        
        // Enhanced bot betting with personality-driven decisions
        await this.simulateEnhancedBotBetting(phase, point, rollCount);
        
        // Auto spectator betting with smarter patterns
        if (this.autoSpectatorBetting && Math.random() < 0.4) {
          await this.placeSmartSpectatorBet(phase, point);
        }
        
        // Roll the dice with enhanced visualization
        console.log(chalk.yellow('\n🎲 Rolling dice...'));
        await this.sleep(1500);
        
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = this.displayDice(die1, die2);
        
        // Enhanced game logic
        if (phase === 1) { // Come-out roll
          if (total === 7 || total === 11) {
            console.log(chalk.green('🏆 Pass Line WINS!'));
            await this.processWinningBets([0, 2]); // Pass, Come
            gameActive = false;
          } else if (total === 2 || total === 3 || total === 12) {
            console.log(chalk.red('💀 Pass Line LOSES!'));
            await this.processLosingBets([0]); // Pass
            if (total !== 12) {
              await this.processWinningBets([1]); // Don't Pass (push on 12)
            }
            gameActive = false;
          } else {
            point = total;
            phase = 2;
            console.log(chalk.blue(`🎯 Point established: ${point}`));
          }
        } else if (phase === 2) { // Point roll
          if (total === 7) {
            console.log(chalk.red('💥 SEVEN OUT! Pass Line LOSES!'));
            await this.processLosingBets([0, 2]); // Pass, Come
            await this.processWinningBets([1, 3]); // Don't Pass, Don't Come
            gameActive = false;
          } else if (total === point) {
            console.log(chalk.green(`🎉 Point ${point} made! Pass Line WINS!`));
            await this.processWinningBets([0, 2]); // Pass, Come
            await this.processLosingBets([1, 3]); // Don't Pass, Don't Come
            gameActive = false;
          }
        }
        
        // Process other bet outcomes
        await this.processOtherBetOutcomes(total, die1, die2);
        
        this.gameHistory.push({
          series: this.gameStats.seriesNumber,
          roll: rollCount,
          dice: [die1, die2],
          total: total,
          phase: phase,
          point: point
        });
        
        await this.sleep(2500);
      }
      
      this.gameStats.totalGames++;
      
    } catch (error) {
      console.error(chalk.red(`Enhanced game series failed: ${error.message}`));
    }
  }
  
  async simulateEnhancedBotBetting(phase, point, rollCount) {
    console.log(chalk.blue('\n🤖 Enhanced AI Bots analyzing the situation...'));
    
    for (const bot of this.activeBots) {
      try {
        // Personality-driven decision making
        const shouldBet = this.calculateBetProbability(bot, phase, point, rollCount);
        
        if (shouldBet) {
          const betChoice = this.selectBetBasedOnPersonality(bot, phase, point);
          const betAmount = this.calculateBetAmount(bot, rollCount);
          
          console.log(chalk.cyan(`  ${bot.emoji} ${bot.name}: "${bot.catchphrase}"`));
          console.log(chalk.white(`     Betting ${formatEther(betAmount)} BOT on ${COMPREHENSIVE_BET_TYPES[betChoice.type].name}`));
          
          if (Math.random() < 0.3) {
            console.log(chalk.gray(`     💭 "${this.generateBotComment(bot, betChoice.type)}"`));
          }
          
          // Track the bet
          bot.stats.gamesPlayed++;
          bot.stats.totalWagered += betAmount;
          
          await this.sleep(300);
        }
      } catch (error) {
        console.error(chalk.red(`Bot ${bot.name} betting failed: ${error.message}`));
      }
    }
  }
  
  calculateBetProbability(bot, phase, point, rollCount) {
    let baseProbability = bot.aggressiveness * 8; // 0-80% base
    
    // Adjust based on game state
    if (phase === 1) baseProbability += 10; // More likely on come-out
    if (point > 0) baseProbability += bot.patternBelief * 2;
    if (rollCount > 10) baseProbability -= 10; // Fatigue factor
    
    // Streak influence
    if (bot.stats.currentStreak > 0) {
      baseProbability += bot.patternBelief * 3;
    } else if (bot.stats.currentStreak < -2) {
      baseProbability -= 15; // Cold streak caution
    }
    
    return Math.random() * 100 < Math.min(baseProbability, 90);
  }
  
  selectBetBasedOnPersonality(bot, phase, point) {
    const preferences = bot.strategy.preferredBets;
    let availableBets = [...preferences];
    
    // Add situational bets based on personality
    if (phase === 2 && point > 0) {
      if (bot.riskTolerance > 7) {
        availableBets.push(7); // Any 7 for high risk takers
      }
      if (bot.patternBelief > 6) {
        availableBets.push(point === 4 ? 16 : point === 6 ? 17 : point === 8 ? 18 : point === 10 ? 19 : 4);
      }
    }
    
    const chosenBet = availableBets[Math.floor(Math.random() * availableBets.length)];
    return { type: chosenBet, name: COMPREHENSIVE_BET_TYPES[chosenBet].name };
  }
  
  calculateBetAmount(bot, rollCount) {
    let baseAmount = bot.strategy.baseBetSize;
    
    // Streak multiplier
    if (bot.stats.hotStreak && bot.stats.currentStreak > 2) {
      baseAmount = baseAmount * BigInt(bot.strategy.streakMultiplier);
    }
    
    // Fatigue factor (larger bets as game progresses for aggressive bots)
    if (bot.aggressiveness > 7 && rollCount > 5) {
      baseAmount = baseAmount * BigInt(Math.floor(1 + rollCount / 10));
    }
    
    // Random variance based on risk tolerance
    const variance = 1 + (Math.random() * bot.riskTolerance / 10);
    baseAmount = BigInt(Math.floor(Number(baseAmount) * variance));
    
    // Cap at max bet size
    if (baseAmount > bot.strategy.maxBetSize) {
      baseAmount = bot.strategy.maxBetSize;
    }
    
    return baseAmount;
  }
  
  generateBotComment(bot, betType) {
    const comments = {
      aggressive: ['Time to go big!', 'Fortune favors the bold!', 'Let\'s make some noise!'],
      conservative: ['Playing it smart here', 'Steady wins the race', 'Calculated risk'],
      superstitious: ['The dice are speaking to me', 'I feel lucky tonight', 'The signs are all here'],
      analytical: ['The odds favor this bet', 'Mathematical advantage', 'Probability is on my side'],
      showman: ['Watch and learn, folks!', 'This is how it\'s done!', 'Prepare to be amazed!']
    };
    
    let category = 'conservative';
    if (bot.aggressiveness > 7) category = 'aggressive';
    if (bot.patternBelief > 7) category = 'superstitious';
    if (bot.name.includes('Calculator')) category = 'analytical';
    if (bot.name.includes('Entertainer')) category = 'showman';
    
    const categoryComments = comments[category];
    return categoryComments[Math.floor(Math.random() * categoryComments.length)];
  }
  
  async processWinningBets(betTypes) {
    // Simulate bet processing and update bot stats
    for (const bot of this.activeBots) {
      if (Math.random() < 0.3) { // 30% chance bot had a winning bet
        const winnings = bot.strategy.baseBetSize * 2n;
        bot.stats.totalWinnings += winnings;
        bot.stats.wins++;
        bot.stats.currentStreak = Math.max(0, bot.stats.currentStreak) + 1;
        bot.stats.hotStreak = bot.stats.currentStreak >= 3;
      }
    }
  }
  
  async processLosingBets(betTypes) {
    // Simulate bet processing and update bot stats
    for (const bot of this.activeBots) {
      if (Math.random() < 0.4) { // 40% chance bot had a losing bet
        bot.stats.losses++;
        bot.stats.currentStreak = Math.min(0, bot.stats.currentStreak) - 1;
        bot.stats.hotStreak = false;
      }
    }
  }
  
  async processOtherBetOutcomes(total, die1, die2) {
    // Process field bets
    if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
      console.log(chalk.green(`✅ Field bets WIN!`));
    }
    
    // Process hard way bets
    if (die1 === die2) {
      console.log(chalk.blue(`🎯 Hard ${total} bets WIN!`));
    }
    
    // Process any 7 bets
    if (total === 7) {
      console.log(chalk.yellow(`🎰 Any 7 bets WIN!`));
    }
  }
  
  setupEnhancedKeyboardListener() {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (key) => {
          const keyCode = key.toString();
          
          switch (keyCode) {
            case '1': await this.placeSpectatorBet(0, 'Pass Line'); break;
            case '2': await this.placeSpectatorBet(1, "Don't Pass"); break;
            case '3': await this.placeSpectatorBet(4, 'Field'); break;
            case '4': await this.placeSpectatorBet(2, 'Come'); break;
            case '5': await this.placeSpectatorBet(16, 'Hard 4'); break;
            case '6': await this.placeSpectatorBet(26, 'Place 6'); break;
            case '7': await this.placeSpectatorBet(7, 'Any 7'); break;
            case '8': await this.placeSpectatorBet(60, 'World Bet'); break;
            case '9': await this.placeSpectatorBet(48, 'Pass Odds'); break;
            case '0': await this.placeRandomPropositionBet(); break;
            case 'q':
            case '\u0003':
              console.log(chalk.yellow('\n\nExiting ultimate simulation...'));
              process.exit(0);
              break;
          }
        });
        
        console.log(chalk.gray('🎮 Enhanced keyboard controls activated!\n'));
      } catch (error) {
        console.log(chalk.yellow('🤖 Running in auto-simulation mode...'));
        this.autoSpectatorBetting = true;
      }
    } else {
      console.log(chalk.yellow('🤖 Non-interactive mode detected...'));
      this.autoSpectatorBetting = true;
    }
  }
  
  async placeSmartSpectatorBet(phase, point) {
    // Smart betting based on game state
    let betChoices = [];
    
    if (phase === 1) { // Come-out roll
      betChoices = [0, 1, 4]; // Pass, Don't Pass, Field
    } else if (phase === 2) { // Point established
      betChoices = [2, 26, 27, 48]; // Come, Place 6, Place 8, Pass Odds
    }
    
    const randomBet = betChoices[Math.floor(Math.random() * betChoices.length)];
    const betName = COMPREHENSIVE_BET_TYPES[randomBet].name;
    await this.placeSpectatorBet(randomBet, betName);
  }
  
  async placeRandomPropositionBet() {
    const propBets = [56, 57, 58, 59, 60, 61, 62, 63]; // Horn and prop bets
    const randomProp = propBets[Math.floor(Math.random() * propBets.length)];
    const betName = COMPREHENSIVE_BET_TYPES[randomProp].name;
    console.log(chalk.magenta(`🎲 Random proposition bet: ${betName}!`));
    await this.placeSpectatorBet(randomProp, betName);
  }
  
  async placeSpectatorBet(betType, betName) {
    const betAmount = parseEther('50');
    
    if (this.spectatorBalance >= betAmount) {
      this.spectatorBalance -= betAmount;
      this.gameStats.spectatorBets++;
      
      const betInfo = COMPREHENSIVE_BET_TYPES[betType];
      console.log(chalk.bold.green(`\n💰 You bet ${formatEther(betAmount)} BOT on ${betName}!`));
      console.log(chalk.gray(`   📊 Payout: ${betInfo.payout} | House Edge: ${betInfo.house_edge}`));
      console.log(chalk.gray(`   💳 Remaining balance: ${formatEther(this.spectatorBalance)} BOT\n`));
      
      // Enhanced bet outcome simulation
      const houseEdge = parseFloat(betInfo.house_edge.replace('%', '')) / 100;
      const winProbability = 0.5 - (houseEdge / 2); // Simplified calculation
      
      const won = Math.random() < winProbability;
      if (won) {
        const multiplier = this.parsePayoutMultiplier(betInfo.payout);
        const winnings = betAmount * BigInt(Math.floor(multiplier * 100)) / 100n;
        this.spectatorBalance += winnings;
        this.gameStats.spectatorWinnings += Number(formatEther(winnings - betAmount));
        console.log(chalk.bold.green(`🎉 YOU WON! +${formatEther(winnings)} BOT 🎉`));
      } else {
        this.gameStats.spectatorWinnings -= Number(formatEther(betAmount));
        console.log(chalk.red(`💸 You lost...`));
      }
    } else {
      console.log(chalk.red('\n❌ Insufficient balance for betting!\n'));
    }
  }
  
  parsePayoutMultiplier(payoutString) {
    if (payoutString.includes('True Odds')) return 2;
    if (payoutString.includes(':')) {
      const parts = payoutString.split(':');
      if (parts.length >= 2) {
        const numerator = parseInt(parts[0]);
        const denominator = parseInt(parts[1]);
        return 1 + (numerator / denominator);
      }
    }
    return 2; // Default 1:1 payout
  }
  
  async updateLPEscrowResults(seriesNumber) {
    console.log(chalk.blue(`\n🏦 Updating LP Escrow Results for Series ${seriesNumber}...\n`));
    
    // Calculate series profit/loss (simulated)
    const totalBetsPlaced = this.activeBots.reduce((sum, bot) => sum + Number(formatEther(bot.stats.totalWagered)), 0);
    const totalWinnings = this.activeBots.reduce((sum, bot) => sum + Number(formatEther(bot.stats.totalWinnings)), 0);
    const houseResult = totalBetsPlaced - totalWinnings - (this.gameStats.spectatorWinnings);
    
    console.log(chalk.cyan(`📊 Series ${seriesNumber} Results:`));
    console.log(chalk.white(`   💰 Total Bets: ${totalBetsPlaced.toFixed(2)} BOT`));
    console.log(chalk.white(`   🏆 Total Payouts: ${totalWinnings.toFixed(2)} BOT`));
    console.log(chalk.white(`   🏠 House Result: ${houseResult >= 0 ? '+' : ''}${houseResult.toFixed(2)} BOT`));
    
    // Allocate profits/losses to LP providers
    this.lpParticipants.forEach((provider, name) => {
      const allocation = houseResult * provider.share;
      if (houseResult > 0) {
        provider.profits += parseEther(allocation.toString());
        console.log(chalk.green(`   ✅ ${name}: +${allocation.toFixed(2)} BOT profit`));
      } else {
        provider.losses += parseEther(Math.abs(allocation).toString());
        console.log(chalk.red(`   ❌ ${name}: ${allocation.toFixed(2)} BOT loss`));
      }
    });
    
    this.seriesResults.set(seriesNumber, {
      totalBets: totalBetsPlaced,
      totalPayouts: totalWinnings,
      houseResult: houseResult,
      timestamp: new Date().toISOString()
    });
    
    console.log();
  }
  
  async showEnhancedSeriesResults() {
    console.log(chalk.bold.cyan('\n📈 Enhanced Series Results:'));
    console.log(chalk.gray('─'.repeat(100)));
    
    // Enhanced bot performance analysis
    const sortedBots = [...this.activeBots].sort((a, b) => 
      Number(b.stats.totalWinnings - a.stats.totalWagered) - Number(a.stats.totalWinnings - a.stats.totalWagered)
    );
    
    console.log(chalk.yellow('\n🏆 Bot Performance Leaderboard:'));
    for (let i = 0; i < Math.min(5, sortedBots.length); i++) {
      const bot = sortedBots[i];
      const profit = Number(formatEther(bot.stats.totalWinnings - bot.stats.totalWagered));
      const winRate = bot.stats.gamesPlayed > 0 ? (bot.stats.wins / bot.stats.gamesPlayed * 100) : 0;
      const trophies = ['🥇', '🥈', '🥉', '🏅', '🎖️'];
      
      console.log(chalk.cyan(`  ${trophies[i]} ${bot.emoji} ${bot.name}`));
      console.log(chalk.white(`     💰 P&L: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} BOT | Win Rate: ${winRate.toFixed(1)}% | Streak: ${bot.stats.currentStreak}`));
    }
    
    // Spectator summary
    console.log(chalk.yellow('\n👀 Your Spectator Performance:'));
    console.log(chalk.cyan(`  📊 Bets Placed: ${this.gameStats.spectatorBets}`));
    console.log(chalk.cyan(`  💰 Net P&L: ${this.gameStats.spectatorWinnings >= 0 ? '+' : ''}${this.gameStats.spectatorWinnings.toFixed(2)} BOT`));
    console.log(chalk.cyan(`  💳 Current Balance: ${formatEther(this.spectatorBalance)} BOT`));
    
    console.log();
  }
  
  async showUltimateFinalResults() {
    console.log(chalk.bold.magenta('\n🎊 ULTIMATE CASINO SIMULATION COMPLETE! 🎊\n'));
    console.log('═'.repeat(120));
    
    // Comprehensive statistics
    console.log(chalk.yellow('\n📊 Complete Simulation Statistics:'));
    console.log(chalk.cyan(`  🎲 Total Game Series: ${this.gameStats.totalGames}`));
    console.log(chalk.cyan(`  🎯 Total Dice Rolls: ${this.gameStats.totalRolls}`));
    console.log(chalk.cyan(`  🤖 Bot Decisions Made: ${this.activeBots.reduce((sum, bot) => sum + bot.stats.gamesPlayed, 0)}`));
    console.log(chalk.cyan(`  👀 Spectator Bets: ${this.gameStats.spectatorBets}`));
    
    // Final bot rankings with detailed stats
    console.log(chalk.yellow('\n🏆 Final Bot Championship Rankings:'));
    const finalRankings = [...this.activeBots].sort((a, b) => 
      Number(b.stats.totalWinnings - a.stats.totalWagered) - Number(a.stats.totalWinnings - a.stats.totalWagered)
    );
    
    for (let i = 0; i < finalRankings.length; i++) {
      const bot = finalRankings[i];
      const profit = Number(formatEther(bot.stats.totalWinnings - bot.stats.totalWagered));
      const winRate = bot.stats.gamesPlayed > 0 ? (bot.stats.wins / bot.stats.gamesPlayed * 100) : 0;
      const avgBet = bot.stats.gamesPlayed > 0 ? Number(formatEther(bot.stats.totalWagered)) / bot.stats.gamesPlayed : 0;
      const trophies = ['🥇', '🥈', '🥉', '🏅', '🎖️', '⭐', '✨', '💫', '🌟', '⚡'];
      
      console.log(chalk.white(`\n  ${trophies[i]} ${bot.emoji} ${bot.name}`));
      console.log(chalk.gray(`     "${bot.description}"`));
      console.log(chalk.cyan(`     💰 Final P&L: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} BOT`));
      console.log(chalk.cyan(`     🎯 Win Rate: ${winRate.toFixed(1)}% (${bot.stats.wins}W/${bot.stats.losses}L)`));
      console.log(chalk.cyan(`     📊 Avg Bet: ${avgBet.toFixed(2)} BOT | Total Wagered: ${formatEther(bot.stats.totalWagered)} BOT`));
      console.log(chalk.cyan(`     🔥 Final Streak: ${bot.stats.currentStreak} ${bot.stats.hotStreak ? '(HOT!)' : ''}`));
    }
    
    // LP Escrow Final Results
    console.log(chalk.yellow('\n🏦 LP Escrow Final Allocation Results:'));
    this.lpParticipants.forEach((provider, name) => {
      const netResult = Number(formatEther(provider.profits - provider.losses));
      const roi = ((netResult / Number(formatEther(provider.contribution))) * 100);
      
      console.log(chalk.white(`\n  💼 ${name}:`));
      console.log(chalk.cyan(`     💰 Initial: ${formatEther(provider.contribution)} BOT (${(provider.share * 100).toFixed(1)}% share)`));
      console.log(chalk.cyan(`     📈 Profits: +${formatEther(provider.profits)} BOT`));
      console.log(chalk.cyan(`     📉 Losses: -${formatEther(provider.losses)} BOT`));
      console.log(chalk.cyan(`     🎯 Net Result: ${netResult >= 0 ? '+' : ''}${netResult.toFixed(2)} BOT`));
      console.log(chalk.cyan(`     📊 ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`));
    });
    
    // Series breakdown
    console.log(chalk.yellow('\n📋 Series-by-Series Breakdown:'));
    this.seriesResults.forEach((result, seriesNum) => {
      console.log(chalk.cyan(`  Series ${seriesNum}: ${result.houseResult >= 0 ? '+' : ''}${result.houseResult.toFixed(2)} BOT house result`));
    });
    
    // Spectator final results
    console.log(chalk.yellow('\n💰 Your Final Spectator Results:'));
    const initialBalance = 1000;
    const finalBalance = Number(formatEther(this.spectatorBalance));
    const totalReturn = ((finalBalance / initialBalance - 1) * 100);
    
    console.log(chalk.cyan(`  💳 Starting Balance: ${initialBalance} BOT`));
    console.log(chalk.cyan(`  💰 Final Balance: ${finalBalance.toFixed(2)} BOT`));
    console.log(chalk.cyan(`  📊 Total Return: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`));
    console.log(chalk.cyan(`  🎲 Total Bets: ${this.gameStats.spectatorBets}`));
    console.log(chalk.cyan(`  💸 Net P&L: ${this.gameStats.spectatorWinnings >= 0 ? '+' : ''}${this.gameStats.spectatorWinnings.toFixed(2)} BOT`));
    
    if (finalBalance > initialBalance) {
      console.log(chalk.bold.green('\n🎉 CONGRATULATIONS! You beat the house! 🎉'));
      console.log(chalk.green('🏆 You are a true casino champion! 🏆'));
    } else if (finalBalance > initialBalance * 0.8) {
      console.log(chalk.bold.yellow('\n💪 Respectable performance! You held your own! 💪'));
    } else {
      console.log(chalk.bold.red('\n💸 The house always wins... but you had fun! 💸'));
    }
    
    console.log('\n' + '═'.repeat(120));
    console.log(chalk.bold.magenta('🎲 Thank you for playing the Ultimate Barely Human Casino! 🎲'));
    console.log(chalk.gray('🤖 Where AI meets Vegas in the most realistic simulation ever created! 🤖'));
    console.log('═'.repeat(120));
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const simulator = new UltimateCasinoSimulator();
    await simulator.init();
    await simulator.runUltimateSimulation();
  } catch (error) {
    console.error(chalk.red('Ultimate simulation failed:'), error.message);
    process.exit(1);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default UltimateCasinoSimulator;