#!/usr/bin/env node

/**
 * Interactive Casino CLI with Bot Chat and Betting - Fixed Version
 * Users can chat with AI bots and bet on their performance
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import configurations
const hardhatChain = {
    id: 31337,
    name: 'Hardhat',
    network: 'hardhat',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
        public: { http: ['http://127.0.0.1:8545'] },
    },
};

// Helper function for contract calls with retry
async function contractCallWithRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Simple LLM response generator (simulated, no external dependencies)
class SimpleLLMManager {
    constructor() {
        this.personalities = {
            0: {
                name: 'Alice "All-In"',
                responses: {
                    greeting: ["Let's go big!", "Time to raise the stakes!", "All or nothing!"],
                    win: ["BOOM! That's how we do it!", "Fortune favors the bold!", "All in pays off!"],
                    lose: ["Just warming up!", "Next one's mine!", "I'll double down!"],
                    strategy: ["Go big or go home!", "Maximum bet, maximum reward!", "No guts, no glory!"]
                }
            },
            1: {
                name: 'Bob "The Calculator"',
                responses: {
                    greeting: ["Let me analyze the odds.", "Statistical analysis initiated.", "Calculating probabilities..."],
                    win: ["As predicted by my calculations.", "The numbers never lie.", "Statistical success."],
                    lose: ["Within expected variance.", "Recalculating strategy...", "Adjusting parameters."],
                    strategy: ["The odds are 47.3% favorable.", "Expected value is positive.", "Risk-adjusted returns."]
                }
            },
            2: {
                name: 'Charlie "Lucky Charm"',
                responses: {
                    greeting: ["My lucky socks are on!", "The stars are aligned!", "Feeling lucky today!"],
                    win: ["My four-leaf clover worked!", "The universe smiles upon us!", "Lucky streak!"],
                    lose: ["Must be a full moon...", "Need to cleanse my aura.", "Bad juju today."],
                    strategy: ["Follow the signs!", "Trust the cosmic energy!", "Luck is on our side!"]
                }
            },
            3: {
                name: 'Diana "Ice Queen"',
                responses: {
                    greeting: ["Emotions are irrelevant.", "Logic will prevail.", "Beginning analysis."],
                    win: ["Expected outcome.", "Efficiency maintained.", "Proceed."],
                    lose: ["Minor setback.", "Adjusting.", "Irrelevant."],
                    strategy: ["Pure logic.", "No emotions.", "Calculate and execute."]
                }
            },
            4: {
                name: 'Eddie "The Entertainer"',
                responses: {
                    greeting: ["Ladies and gentlemen!", "The show begins!", "Welcome to the spectacle!"],
                    win: ["The crowd goes wild!", "That's showbiz!", "Take a bow!"],
                    lose: ["The show must go on!", "Plot twist!", "Building suspense!"],
                    strategy: ["Make it spectacular!", "Entertainment value!", "Give them a show!"]
                }
            }
        };
    }

    async getBotResponse(botId, context, prompt) {
        const personality = this.personalities[botId] || this.personalities[0];
        const responseType = context.toLowerCase().includes('win') ? 'win' :
                           context.toLowerCase().includes('lose') ? 'lose' :
                           context.toLowerCase().includes('strategy') ? 'strategy' : 'greeting';
        
        const responses = personality.responses[responseType];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

// Simple Game Connector (simulated)
class SimpleGameConnector {
    constructor() {
        this.gameState = {
            round: 0,
            point: null,
            phase: 'IDLE'
        };
        this.botStats = new Map();
        for (let i = 0; i < 10; i++) {
            this.botStats.set(i, {
                wins: 0,
                losses: 0,
                balance: 1000,
                lastBet: null
            });
        }
    }

    async placeBet(botId, betType, amount) {
        const stats = this.botStats.get(botId);
        stats.lastBet = { type: betType, amount };
        return { success: true, betId: Math.random().toString(36).substr(2, 9) };
    }

    async simulateRound() {
        this.gameState.round++;
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;
        
        // Simple win/loss logic
        for (const [botId, stats] of this.botStats) {
            if (stats.lastBet) {
                const won = Math.random() < 0.5;
                if (won) {
                    stats.wins++;
                    stats.balance += stats.lastBet.amount;
                } else {
                    stats.losses++;
                    stats.balance -= stats.lastBet.amount;
                }
            }
        }
        
        return { dice1, dice2, total, round: this.gameState.round };
    }

    getBotStats(botId) {
        return this.botStats.get(botId);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bot information
const BOT_INFO = [
    { id: 0, name: 'Alice "All-In"', emoji: '🎯', strategy: 'Aggressive', color: chalk.red },
    { id: 1, name: 'Bob "The Calculator"', emoji: '🧮', strategy: 'Conservative', color: chalk.blue },
    { id: 2, name: 'Charlie "Lucky Charm"', emoji: '🍀', strategy: 'Superstitious', color: chalk.green },
    { id: 3, name: 'Diana "Ice Queen"', emoji: '❄️', strategy: 'Cold Logic', color: chalk.cyan },
    { id: 4, name: 'Eddie "The Entertainer"', emoji: '🎭', strategy: 'Showman', color: chalk.magenta },
    { id: 5, name: 'Fiona "Fearless"', emoji: '⚡', strategy: 'Daredevil', color: chalk.yellow },
    { id: 6, name: 'Greg "The Grinder"', emoji: '💎', strategy: 'Patient', color: chalk.gray },
    { id: 7, name: 'Helen "Hot Streak"', emoji: '🔥', strategy: 'Momentum', color: chalk.redBright },
    { id: 8, name: 'Ivan "The Intimidator"', emoji: '👹', strategy: 'Psychological', color: chalk.bgRed },
    { id: 9, name: 'Julia "Jinx"', emoji: '🌀', strategy: 'Chaos', color: chalk.magentaBright }
];

class InteractiveCasinoCLI {
    constructor() {
        this.llmManager = new SimpleLLMManager();
        this.gameConnector = new SimpleGameConnector();
        this.userBets = new Map();
        this.escrowBalance = 0n;
        this.userBalance = 1000;
        this.connected = false;
        this.useBlockchain = false; // Set to true to use real blockchain
    }

    async start() {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('Barely Human', { horizontalLayout: 'full' })));
        console.log(chalk.yellow('\n🎰 Welcome to the Barely Human DeFi Casino!\n'));
        console.log(chalk.gray('Interactive Mode with AI Bot Personalities\n'));

        // Check connection options
        const { connectionChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'connectionChoice',
                message: 'How would you like to connect?',
                choices: [
                    '🎮 Demo Mode (No blockchain required)',
                    '⛓️ Blockchain Mode (Requires local node)',
                    '❌ Exit'
                ]
            }
        ]);

        if (connectionChoice === '❌ Exit') {
            console.log(chalk.green('\nThanks for visiting! 🎰\n'));
            process.exit(0);
        }

        this.useBlockchain = connectionChoice.includes('Blockchain');
        
        if (this.useBlockchain) {
            await this.connectToBlockchain();
        } else {
            console.log(chalk.green('\n✅ Running in Demo Mode - No blockchain required!\n'));
            this.connected = true;
        }

        if (this.connected) {
            await this.mainMenu();
        }
    }

    async connectToBlockchain() {
        const spinner = ora('Connecting to local blockchain...').start();
        
        try {
            const publicClient = createPublicClient({
                chain: hardhatChain,
                transport: http(),
            });

            const blockNumber = await publicClient.getBlockNumber();
            spinner.succeed(`Connected to local blockchain at block ${blockNumber}`);
            this.connected = true;
            this.publicClient = publicClient;
        } catch (error) {
            spinner.fail('Failed to connect to blockchain');
            console.log(chalk.red('\n⚠️ Make sure your local Hardhat node is running:'));
            console.log(chalk.white('  npm run node\n'));
            
            const { retry } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'retry',
                    message: 'Would you like to run in Demo Mode instead?',
                    default: true
                }
            ]);

            if (retry) {
                this.useBlockchain = false;
                this.connected = true;
                console.log(chalk.green('\n✅ Switched to Demo Mode\n'));
            }
        }
    }

    async mainMenu() {
        const choices = [
            '💬 Chat with AI Bots',
            '🎯 Bet on Bot Performance',
            '🎲 Watch Bots Play',
            '📊 View Leaderboard',
            '💰 Check Balance',
            '📈 Bot Statistics',
            '🔄 Refresh',
            '❌ Exit'
        ];

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'What would you like to do?',
                choices
            }
        ]);

        switch(choice) {
            case '💬 Chat with AI Bots':
                await this.chatWithBots();
                break;
            case '🎯 Bet on Bot Performance':
                await this.betOnBots();
                break;
            case '🎲 Watch Bots Play':
                await this.watchBotsPlay();
                break;
            case '📊 View Leaderboard':
                await this.showLeaderboard();
                break;
            case '💰 Check Balance':
                await this.checkBalance();
                break;
            case '📈 Bot Statistics':
                await this.showBotStats();
                break;
            case '🔄 Refresh':
                console.clear();
                break;
            case '❌ Exit':
                console.log(chalk.green('\nThanks for playing! Come back soon! 🎰\n'));
                process.exit(0);
        }

        await this.mainMenu();
    }

    async chatWithBots() {
        console.log(chalk.cyan('\n=== Chat with AI Bots ===\n'));

        const botChoices = BOT_INFO.slice(0, 5).map(bot => `${bot.emoji} ${bot.name}`);
        const { selectedBot } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedBot',
                message: 'Which bot would you like to chat with?',
                choices: [...botChoices, '← Back']
            }
        ]);

        if (selectedBot === '← Back') return;

        const botIndex = botChoices.indexOf(selectedBot);
        const bot = BOT_INFO[botIndex];

        console.log(`\n${bot.color(bot.emoji + ' ' + bot.name + ' is typing...')}\n`);
        
        const spinner = ora('').start();
        await new Promise(resolve => setTimeout(resolve, 1500));
        spinner.stop();

        const { topic } = await inquirer.prompt([
            {
                type: 'list',
                name: 'topic',
                message: 'What would you like to ask?',
                choices: [
                    'What\'s your betting strategy?',
                    'How are you feeling about the next round?',
                    'Any tips for winning?',
                    'Tell me about your biggest win',
                    'What makes you different from other bots?',
                    '← Back'
                ]
            }
        ]);

        if (topic !== '← Back') {
            const spinner2 = ora(`${bot.name} is thinking...`).start();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await this.llmManager.getBotResponse(
                bot.id, 
                topic, 
                topic
            );
            
            spinner2.stop();
            console.log(bot.color(`\n${bot.emoji} ${bot.name}:`));
            console.log(chalk.white(`"${response}"\n`));

            await inquirer.prompt([
                {
                    type: 'input',
                    name: 'continue',
                    message: 'Press Enter to continue...'
                }
            ]);
        }
    }

    async betOnBots() {
        console.log(chalk.cyan('\n=== Bet on Bot Performance ===\n'));
        console.log(chalk.white(`Your balance: ${chalk.green(`$${this.userBalance}`)}\n`));

        const botChoices = BOT_INFO.slice(0, 5).map(bot => {
            const stats = this.gameConnector.getBotStats(bot.id);
            return `${bot.emoji} ${bot.name} (W:${stats.wins} L:${stats.losses})`;
        });

        const { selectedBot, amount } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedBot',
                message: 'Which bot do you want to bet on?',
                choices: [...botChoices, '← Back']
            },
            {
                type: 'number',
                name: 'amount',
                message: 'How much do you want to bet?',
                default: 10,
                validate: (value) => {
                    if (value <= 0) return 'Bet must be positive';
                    if (value > this.userBalance) return 'Insufficient balance';
                    return true;
                },
                when: (answers) => answers.selectedBot !== '← Back'
            }
        ]);

        if (selectedBot === '← Back') return;

        const botIndex = botChoices.indexOf(selectedBot);
        const bot = BOT_INFO[botIndex];

        console.log(chalk.yellow(`\n📝 Placing bet on ${bot.name}...\n`));
        
        // Place bot's bet
        await this.gameConnector.placeBet(bot.id, 'PASS', amount);
        
        const spinner = ora('Bots are playing...').start();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate round
        const result = await this.gameConnector.simulateRound();
        spinner.stop();

        console.log(chalk.cyan(`\n🎲 Dice Roll: ${result.dice1} + ${result.dice2} = ${result.total}\n`));

        const stats = this.gameConnector.getBotStats(bot.id);
        const won = stats.wins > (stats.wins + stats.losses) / 2;

        if (won) {
            const winnings = amount * 2;
            this.userBalance += winnings;
            
            console.log(chalk.green(`✅ ${bot.name} WON! You earned $${winnings}!`));
            
            const response = await this.llmManager.getBotResponse(bot.id, 'win', '');
            console.log(bot.color(`\n${bot.emoji}: "${response}"\n`));
        } else {
            this.userBalance -= amount;
            
            console.log(chalk.red(`❌ ${bot.name} lost. You lost $${amount}.`));
            
            const response = await this.llmManager.getBotResponse(bot.id, 'lose', '');
            console.log(bot.color(`\n${bot.emoji}: "${response}"\n`));
        }

        console.log(chalk.white(`New balance: ${chalk.green(`$${this.userBalance}`)}\n`));

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async watchBotsPlay() {
        console.log(chalk.cyan('\n=== Watch Bots Play ===\n'));

        const spinner = ora('Bots are deciding their bets...').start();
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate bots placing bets
        for (let i = 0; i < 5; i++) {
            const bot = BOT_INFO[i];
            const betAmount = Math.floor(Math.random() * 50) + 10;
            await this.gameConnector.placeBet(i, 'PASS', betAmount);
        }

        spinner.text = 'Rolling the dice...';
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const result = await this.gameConnector.simulateRound();
        spinner.stop();

        console.log(chalk.yellow(`\n🎲 Round ${result.round} Results:`));
        console.log(chalk.cyan(`   Dice: ${result.dice1} + ${result.dice2} = ${result.total}\n`));

        // Show each bot's result
        for (let i = 0; i < 5; i++) {
            const bot = BOT_INFO[i];
            const stats = this.gameConnector.getBotStats(i);
            const won = Math.random() < 0.5;
            
            if (won) {
                console.log(chalk.green(`✅ ${bot.emoji} ${bot.name} - WIN!`));
            } else {
                console.log(chalk.red(`❌ ${bot.emoji} ${bot.name} - LOSS`));
            }
        }

        console.log();

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async showLeaderboard() {
        console.log(chalk.cyan('\n=== Bot Leaderboard ===\n'));

        const table = new Table({
            head: ['Rank', 'Bot', 'Wins', 'Losses', 'Win Rate', 'Balance'],
            style: {
                head: ['cyan']
            }
        });

        const botData = [];
        for (let i = 0; i < 10; i++) {
            const bot = BOT_INFO[i];
            const stats = this.gameConnector.getBotStats(i);
            const totalGames = stats.wins + stats.losses;
            const winRate = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : '0.0';
            botData.push({ bot, stats, winRate: parseFloat(winRate) });
        }

        botData.sort((a, b) => b.stats.balance - a.stats.balance);

        botData.forEach((entry, index) => {
            const { bot, stats, winRate } = entry;
            const rank = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            
            table.push([
                rank,
                `${bot.emoji} ${bot.name}`,
                chalk.green(stats.wins),
                chalk.red(stats.losses),
                `${winRate}%`,
                chalk.yellow(`$${stats.balance}`)
            ]);
        });

        console.log(table.toString());

        if (botData[0].stats.wins > 0) {
            const champion = botData[0].bot;
            const response = await this.llmManager.getBotResponse(champion.id, 'win', '');
            console.log(chalk.yellow(`\n🏆 ${champion.emoji} ${champion.name}: "${response}"\n`));
        }

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async checkBalance() {
        console.log(chalk.cyan('\n=== Your Balance ===\n'));
        console.log(chalk.white('Current Balance: ') + chalk.green(`$${this.userBalance}`));
        console.log(chalk.white('Starting Balance: ') + chalk.yellow('$1000'));
        
        const profit = this.userBalance - 1000;
        if (profit > 0) {
            console.log(chalk.white('Profit: ') + chalk.green(`+$${profit}`));
        } else if (profit < 0) {
            console.log(chalk.white('Loss: ') + chalk.red(`$${Math.abs(profit)}`));
        } else {
            console.log(chalk.white('Profit/Loss: ') + chalk.yellow('$0'));
        }

        console.log(chalk.white('\nMode: ') + chalk.cyan(this.useBlockchain ? 'Blockchain' : 'Demo'));

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to continue...'
            }
        ]);
    }

    async showBotStats() {
        console.log(chalk.cyan('\n=== Detailed Bot Statistics ===\n'));

        for (let i = 0; i < 5; i++) {
            const bot = BOT_INFO[i];
            const stats = this.gameConnector.getBotStats(i);
            const totalGames = stats.wins + stats.losses;
            const winRate = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : '0.0';

            console.log(bot.color(`${bot.emoji} ${bot.name}:`));
            console.log(`  Strategy: ${bot.strategy}`);
            console.log(`  Games Played: ${totalGames}`);
            console.log(`  Wins: ${chalk.green(stats.wins)} | Losses: ${chalk.red(stats.losses)}`);
            console.log(`  Win Rate: ${winRate}%`);
            console.log(`  Balance: ${chalk.yellow(`$${stats.balance}`)}`);
            console.log();
        }

        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }
}

// Start the CLI
const cli = new InteractiveCasinoCLI();
cli.start().catch(console.error);