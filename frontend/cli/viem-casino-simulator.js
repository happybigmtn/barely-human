#!/usr/bin/env node

/**
 * Viem-Based Casino Simulator with Bot AI and Spectator Betting
 * Features:
 * - 5-game series simulation
 * - 10 AI bot personalities with real betting
 * - Keyboard shortcuts for spectator betting
 * - Real-time dice rolls and game visualization
 * - V2 multi-contract architecture (BotManagerV2Plus + CrapsBets + CrapsVault)
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
import inquirer from 'inquirer';
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

// Contract ABIs (simplified for Viem)
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
    'function getPlayerActiveBets(address player) view returns (uint8[])'
  ]),
  
  BotManagerV2Plus: parseAbi([
    'function getBotCount() view returns (uint256)',
    'function getBotPersonality(uint256 botId) view returns ((string,uint8,uint8,uint8,address))',
    'function getBettingStrategy(uint256 botId) view returns ((uint8,uint256,uint256,uint8))'
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

// Bot personalities and bet types
const BOT_PERSONALITIES = [
  'Alice "All-In" - Aggressive high-roller',
  'Bob "Calculator" - Statistical analyzer',
  'Charlie "Lucky" - Superstitious gambler', 
  'Diana "Ice Queen" - Cold, methodical',
  'Eddie "Entertainer" - Theatrical showman',
  'Fiona "Fearless" - Never backs down',
  'Greg "Grinder" - Steady, consistent',
  'Helen "Hot Streak" - Momentum believer',
  'Ivan "Intimidator" - Psychological warfare',
  'Julia "Jinx" - Claims to control luck'
];

const BET_TYPES = {
  0: 'Pass Line',
  1: "Don't Pass",
  2: 'Come',
  3: "Don't Come",
  4: 'Field',
  5: 'Big 6',
  6: 'Big 8',
  7: 'Hard 4',
  8: 'Hard 6',
  9: 'Hard 8',
  10: 'Hard 10'
};

const GAME_PHASES = {
  0: 'IDLE',
  1: 'COME_OUT', 
  2: 'POINT'
};

class ViemCasinoSimulator {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.account = null;
    this.contracts = {};
    this.contractAddresses = {};
    
    // Game state
    this.gameStats = {
      seriesNumber: 0,
      totalGames: 0,
      botWins: {},
      spectatorBets: 0,
      spectatorWinnings: 0
    };
    
    // Bot simulation state
    this.activeBots = [];
    this.gameHistory = [];
    this.spectatorBalance = parseEther('1000'); // Start with 1000 BOT
  }
  
  async init() {
    console.log(chalk.cyan(figlet.textSync('CRAPS CASINO', { horizontalLayout: 'fitted' })));
    console.log(chalk.yellow('🎲 Viem-Powered Bot Simulation & Spectator Betting 🎰\n'));
    
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
    const spinner = ora('Initializing contracts...').start();
    
    try {
      // Initialize each contract with Viem
      for (const [name, address] of Object.entries(this.contractAddresses)) {
        if (CONTRACT_ABIS[name]) {
          this.contracts[name] = {
            address,
            abi: CONTRACT_ABIS[name],
            // Helper methods for read calls
            read: async (functionName, args = []) => {
              return await this.publicClient.readContract({
                address,
                abi: CONTRACT_ABIS[name],
                functionName,
                args
              });
            },
            // Helper methods for write calls  
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
      
      // Load bot data
      await this.loadBotPersonalities();
      
    } catch (error) {
      spinner.fail(`Contract initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  async loadBotPersonalities() {
    try {
      const botCount = await this.contracts.BotManagerV2Plus.read('getBotCount');
      console.log(chalk.blue(`\n🤖 Loading ${botCount} AI Bot Personalities...\n`));
      
      // Use predefined personalities if contract data is corrupted
      const useContractData = Number(botCount) === 10;
      
      for (let i = 0; i < Math.min(Number(botCount), 10); i++) {
        let personality, strategy;
        
        if (useContractData) {
          try {
            personality = await this.contracts.BotManagerV2Plus.read('getBotPersonality', [BigInt(i)]);
            strategy = await this.contracts.BotManagerV2Plus.read('getBettingStrategy', [BigInt(i)]);
          } catch (error) {
            console.log(chalk.yellow(`  Warning: Using fallback data for bot ${i}`));
            personality = [BOT_PERSONALITIES[i], 5, 5, 5, '0x0000000000000000000000000000000000000000'];
            strategy = [0, parseEther('10'), parseEther('100'), 2];
          }
        } else {
          // Use fallback data
          personality = [BOT_PERSONALITIES[i], 5 + i, 3 + i, 4 + i, '0x0000000000000000000000000000000000000000'];
          strategy = [i % 3, parseEther((10 + i * 5).toString()), parseEther((50 + i * 10).toString()), 2 + (i % 3)];
        }
        
        this.activeBots.push({
          id: i,
          name: (personality[0] && personality[0].length > 0) ? personality[0] : BOT_PERSONALITIES[i],
          aggressiveness: Number(personality[1]) || (5 + i),
          riskTolerance: Number(personality[2]) || (3 + i), 
          patternBelief: Number(personality[3]) || (4 + i),
          vaultAddress: personality[4] || '0x0000000000000000000000000000000000000000',
          strategy: {
            baseBetSize: strategy[1] || parseEther('10'),
            maxBetSize: strategy[2] || parseEther('100'),
            streakMultiplier: Number(strategy[3]) || 2
          },
          stats: {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            totalWagered: 0n,
            totalWinnings: 0n
          }
        });
        
        console.log(chalk.cyan(`  ${i + 1}. ${this.activeBots[i].name}`));
      }
      
      console.log();
    } catch (error) {
      console.error(chalk.red(`Failed to load bot personalities: ${error.message}`));
      // Create default bots as fallback
      this.createFallbackBots();
    }
  }
  
  createFallbackBots() {
    console.log(chalk.yellow('Using fallback bot personalities...\n'));
    
    for (let i = 0; i < 10; i++) {
      this.activeBots.push({
        id: i,
        name: BOT_PERSONALITIES[i],
        aggressiveness: 3 + (i % 7),
        riskTolerance: 2 + (i % 8), 
        patternBelief: 1 + (i % 9),
        vaultAddress: '0x0000000000000000000000000000000000000000',
        strategy: {
          baseBetSize: parseEther((10 + i * 3).toString()),
          maxBetSize: parseEther((50 + i * 10).toString()),
          streakMultiplier: 2 + (i % 3)
        },
        stats: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          totalWagered: 0n,
          totalWinnings: 0n
        }
      });
      
      console.log(chalk.cyan(`  ${i + 1}. ${this.activeBots[i].name}`));
    }
    
    console.log();
  }
  
  async runSimulation() {
    console.log(chalk.bold.yellow('\n🎰 Starting 5-Game Series Simulation 🎰\n'));
    console.log(chalk.gray('Press SPACE to place spectator bets during games!'));
    console.log(chalk.gray('Available shortcuts:'));
    console.log(chalk.gray('  [1] Pass Line    [2] Don\'t Pass    [3] Field'));
    console.log(chalk.gray('  [4] Come         [5] Hard Ways     [q] Quit\n'));
    
    // Setup keyboard listener for spectator betting
    this.setupKeyboardListener();
    
    for (let series = 1; series <= 5; series++) {
      this.gameStats.seriesNumber = series;
      console.log(chalk.bold.magenta(`\n═══ SERIES ${series} ═══\n`));
      
      await this.runGameSeries();
      await this.showSeriesResults();
      
      if (series < 5) {
        console.log(chalk.yellow('\nPress Enter to continue to next series...'));
        await this.waitForEnter();
      }
    }
    
    await this.showFinalResults();
  }
  
  async runGameSeries() {
    try {
      // Start new game series
      console.log(chalk.blue('🎲 Starting new game series...'));
      
      // Initialize game if needed
      try {
        await this.contracts.CrapsGameV2Plus.write('initializeGame');
      } catch (error) {
        // Game might already be initialized
      }
      
      let gameActive = true;
      let rollCount = 0;
      
      while (gameActive && rollCount < 20) { // Max 20 rolls per series
        rollCount++;
        
        // Get current game state with error handling
        let phase, point, seriesId;
        try {
          phase = await this.contracts.CrapsGameV2Plus.read('getCurrentPhase');
          point = await this.contracts.CrapsGameV2Plus.read('getCurrentPoint');
          seriesId = await this.contracts.CrapsGameV2Plus.read('currentSeriesId');
        } catch (error) {
          console.log(chalk.yellow(`Warning: Game state read failed, using defaults: ${error.message}`));
          phase = 0; // IDLE
          point = 0;
          seriesId = BigInt(this.gameStats.seriesNumber);
        }
        
        console.log(chalk.cyan(`\n--- Roll ${rollCount} ---`));
        console.log(chalk.gray(`Phase: ${GAME_PHASES[phase]} | Point: ${point > 0 ? point : 'None'} | Series: ${seriesId}`));
        
        // Bots place their bets
        await this.simulateBotBetting(phase, point);
        
        // Auto spectator betting in non-interactive mode
        if (this.autoSpectatorBetting && Math.random() < 0.3) {
          const randomBet = Math.floor(Math.random() * 5);
          const betTypes = [0, 1, 4, 2, 7];
          const betNames = ['Pass Line', "Don't Pass", 'Field', 'Come', 'Hard 4'];
          await this.placeSpectatorBet(betTypes[randomBet], betNames[randomBet]);
        }
        
        // Roll the dice
        console.log(chalk.yellow('\n🎲 Rolling dice...'));
        await this.sleep(1000);
        
        try {
          let rollHash;
          try {
            rollHash = await this.contracts.CrapsGameV2Plus.write('rollDice');
            console.log(chalk.green(`Dice rolled! Transaction: ${rollHash.slice(0, 10)}...`));
          } catch (contractError) {
            console.log(chalk.yellow(`Contract roll failed, simulating dice: ${contractError.message}`));
          }
          
          // Simulate dice result (in real game this would come from VRF)
          const diceResult = Math.floor(Math.random() * 11) + 2; // 2-12
          console.log(chalk.bold.red(`🎲 DICE RESULT: ${diceResult} 🎲`));
          
          // Check if game ended
          if ((phase === 1 && (diceResult === 7 || diceResult === 11)) || 
              (phase === 1 && (diceResult === 2 || diceResult === 3 || diceResult === 12)) ||
              (phase === 2 && (diceResult === 7 || diceResult === Number(point)))) {
            gameActive = false;
            console.log(chalk.green('🏁 Game series ended!'));
          }
          
          this.gameHistory.push({
            series: this.gameStats.seriesNumber,
            roll: rollCount,
            dice: diceResult,
            phase: Number(phase),
            point: Number(point)
          });
          
        } catch (error) {
          console.error(chalk.red(`Simulation failed: ${error.message}`));
          // Continue with simulation even if contract calls fail
          const diceResult = Math.floor(Math.random() * 11) + 2;
          console.log(chalk.bold.red(`🎲 SIMULATED RESULT: ${diceResult} 🎲`));
          gameActive = rollCount >= 10; // End after 10 rolls max
        }
        
        await this.sleep(2000);
      }
      
      this.gameStats.totalGames++;
      
    } catch (error) {
      console.error(chalk.red(`Game series failed: ${error.message}`));
    }
  }
  
  async simulateBotBetting(phase, point) {
    console.log(chalk.blue('\n🤖 Bots are analyzing and placing bets...'));
    
    for (const bot of this.activeBots) {
      try {
        // Simulate bot decision making based on personality
        const shouldBet = Math.random() < (bot.aggressiveness / 10);
        
        if (shouldBet) {
          // Choose bet type based on phase and personality
          let betType = 0; // Default to Pass Line
          
          if (phase === 1) { // Come out roll
            betType = bot.riskTolerance > 5 ? 1 : 0; // Don't Pass vs Pass Line
          } else if (phase === 2) { // Point established
            betType = Math.random() < 0.3 ? 2 : 4; // Come or Field
          }
          
          // Calculate bet amount based on strategy
          const baseBet = bot.strategy.baseBetSize || parseEther('10');
          const randomMultiplier = Math.random() * 2 + 0.5; // 0.5x to 2.5x
          const betAmount = BigInt(Math.floor(Number(baseBet) * randomMultiplier));
          
          console.log(chalk.cyan(`  ${bot.name} bets ${formatEther(betAmount)} BOT on ${BET_TYPES[betType]}`));
          
          // In real implementation, would call CrapsBets.placeBet()
          // For simulation, just track the bet
          bot.stats.gamesPlayed++;
          bot.stats.totalWagered += betAmount;
          
          await this.sleep(200);
        }
      } catch (error) {
        console.error(chalk.red(`Bot ${bot.name} betting failed: ${error.message}`));
      }
    }
  }
  
  setupKeyboardListener() {
    // Only setup if in interactive terminal
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (key) => {
          const keyCode = key.toString();
          
          switch (keyCode) {
            case '1':
              await this.placeSpectatorBet(0, 'Pass Line');
              break;
            case '2':
              await this.placeSpectatorBet(1, "Don't Pass");
              break;
            case '3':
              await this.placeSpectatorBet(4, 'Field');
              break;
            case '4':
              await this.placeSpectatorBet(2, 'Come');
              break;
            case '5':
              await this.placeSpectatorBet(7, 'Hard 4');
              break;
            case 'q':
            case '\u0003': // Ctrl+C
              console.log(chalk.yellow('\n\nExiting simulation...'));
              process.exit(0);
              break;
          }
        });
        
        console.log(chalk.gray('Keyboard shortcuts enabled! Press 1-5 to bet, q to quit.'));
      } catch (error) {
        console.log(chalk.yellow('Keyboard shortcuts not available in this environment.'));
        console.log(chalk.gray('Running in auto-simulation mode...'));
      }
    } else {
      console.log(chalk.yellow('Running in non-interactive mode...'));
      // Auto-place some spectator bets during simulation
      this.autoSpectatorBetting = true;
    }
  }
  
  async placeSpectatorBet(betType, betName) {
    const betAmount = parseEther('50'); // 50 BOT per bet
    
    if (this.spectatorBalance >= betAmount) {
      this.spectatorBalance -= betAmount;
      this.gameStats.spectatorBets++;
      
      console.log(chalk.bold.green(`\n💰 You bet ${formatEther(betAmount)} BOT on ${betName}!`));
      console.log(chalk.gray(`Remaining balance: ${formatEther(this.spectatorBalance)} BOT\n`));
      
      // Simulate bet outcome (simplified)
      const won = Math.random() < 0.45; // Slightly house edge
      if (won) {
        const winnings = betAmount * 2n; // 2:1 payout
        this.spectatorBalance += winnings;
        this.gameStats.spectatorWinnings += Number(formatEther(winnings - betAmount));
        console.log(chalk.bold.green(`🎉 YOU WON! +${formatEther(winnings)} BOT`));
      } else {
        this.gameStats.spectatorWinnings -= Number(formatEther(betAmount));
        console.log(chalk.red(`💸 You lost...`));
      }
    } else {
      console.log(chalk.red('\n❌ Insufficient balance for betting!\n'));
    }
  }
  
  async showSeriesResults() {
    console.log(chalk.bold.cyan('\n📊 Series Results:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    // Show top performing bots
    const sortedBots = [...this.activeBots].sort((a, b) => 
      Number(b.stats.totalWinnings - a.stats.totalWagered) - Number(a.stats.totalWinnings - a.stats.totalWagered)
    );
    
    console.log(chalk.yellow('\n🏆 Top Performing Bots:'));
    for (let i = 0; i < Math.min(3, sortedBots.length); i++) {
      const bot = sortedBots[i];
      const profit = Number(formatEther(bot.stats.totalWinnings - bot.stats.totalWagered));
      console.log(chalk.cyan(`  ${i + 1}. ${bot.name}: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} BOT`));
    }
    
    // Show spectator stats
    console.log(chalk.yellow('\n👀 Your Spectator Stats:'));
    console.log(chalk.cyan(`  Bets Placed: ${this.gameStats.spectatorBets}`));
    console.log(chalk.cyan(`  Net P&L: ${this.gameStats.spectatorWinnings >= 0 ? '+' : ''}${this.gameStats.spectatorWinnings.toFixed(2)} BOT`));
    console.log(chalk.cyan(`  Current Balance: ${formatEther(this.spectatorBalance)} BOT`));
  }
  
  async showFinalResults() {
    console.log(chalk.bold.magenta('\n🎊 FINAL SIMULATION RESULTS 🎊\n'));
    console.log('═'.repeat(80));
    
    // Overall stats
    console.log(chalk.yellow('\n📈 Overall Statistics:'));
    console.log(chalk.cyan(`  Total Game Series: ${this.gameStats.totalGames}`));
    console.log(chalk.cyan(`  Total Dice Rolls: ${this.gameHistory.length}`));
    console.log(chalk.cyan(`  Spectator Bets: ${this.gameStats.spectatorBets}`));
    
    // Final bot rankings
    console.log(chalk.yellow('\n🏆 Final Bot Rankings:'));
    const finalRankings = [...this.activeBots].sort((a, b) => 
      Number(b.stats.totalWinnings - a.stats.totalWagered) - Number(a.stats.totalWinnings - a.stats.totalWagered)
    );
    
    for (let i = 0; i < finalRankings.length; i++) {
      const bot = finalRankings[i];
      const profit = Number(formatEther(bot.stats.totalWinnings - bot.stats.totalWagered));
      const trophy = i < 3 ? ['🥇', '🥈', '🥉'][i] : '  ';
      console.log(chalk.cyan(`  ${trophy} ${bot.name}: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} BOT`));
    }
    
    // Spectator final results
    console.log(chalk.yellow('\n💰 Your Final Results:'));
    const initialBalance = 1000;
    const finalBalance = Number(formatEther(this.spectatorBalance));
    const totalReturn = ((finalBalance / initialBalance - 1) * 100).toFixed(2);
    
    console.log(chalk.cyan(`  Starting Balance: ${initialBalance} BOT`));
    console.log(chalk.cyan(`  Final Balance: ${finalBalance.toFixed(2)} BOT`));
    console.log(chalk.cyan(`  Total Return: ${totalReturn}%`));
    
    if (finalBalance > initialBalance) {
      console.log(chalk.bold.green('\n🎉 Congratulations! You finished in profit! 🎉'));
    } else {
      console.log(chalk.bold.red('\n💸 House wins this time! Better luck next time! 💸'));
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log(chalk.gray('Thank you for playing Barely Human Casino! 🎲'));
  }
  
  async waitForEnter() {
    return new Promise((resolve) => {
      const listener = (key) => {
        if (key === '\r' || key === '\n') {
          process.stdin.removeListener('data', listener);
          resolve();
        }
      };
      process.stdin.on('data', listener);
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const simulator = new ViemCasinoSimulator();
    await simulator.init();
    await simulator.runSimulation();
  } catch (error) {
    console.error(chalk.red('Simulation failed:'), error.message);
    process.exit(1);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ViemCasinoSimulator;