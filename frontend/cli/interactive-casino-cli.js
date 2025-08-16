#!/usr/bin/env node

/**
 * Interactive Casino CLI with Bot Chat and Betting
 * Users can chat with AI bots and bet on their performance
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { localhost } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import our modules
import BotLLMManager from '../../elizaos/runtime/llm-connector.js';
import GameConnector from '../../elizaos/runtime/game-connector.js';

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
        this.llmManager = new BotLLMManager('ollama'); // Use local Ollama
        this.gameConnector = new GameConnector({});
        this.userBets = new Map(); // Track user's bets on bots
        this.escrowBalance = 0n;
        this.deployments = null;
        this.publicClient = null;
        this.walletClient = null;
        this.currentRound = 0;
        this.favoriteBot = null;
    }
    
    async init() {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('BARELY HUMAN', { horizontalLayout: 'full' })));
        console.log(chalk.yellow('\n🎰 Interactive DeFi Casino with AI Bot Gamblers 🤖\n'));
        console.log(chalk.gray('='.repeat(70)));
        
        const spinner = ora('Initializing casino systems...').start();
        
        try {
            // Load deployments
            const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
            if (!fs.existsSync(deploymentPath)) {
                throw new Error('No deployment found. Run: npm run deploy:local');
            }
            this.deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            
            // Initialize blockchain clients
            this.publicClient = createPublicClient({
                chain: localhost,
                transport: http('http://127.0.0.1:8545')
            });
            
            const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
            this.walletClient = createWalletClient({
                account,
                chain: localhost,
                transport: http('http://127.0.0.1:8545')
            });
            
            // Initialize game connector
            await this.gameConnector.initialize();
            
            // Create bot instances
            for (let i = 0; i < 10; i++) {
                const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
                await this.gameConnector.createBot(i, privateKey);
            }
            
            spinner.succeed('Casino systems initialized!');
            
            // Check Ollama availability
            await this.checkLLMAvailability();
            
            console.log(chalk.green('\n✅ Ready to play!\n'));
            
        } catch (error) {
            spinner.fail('Initialization failed');
            console.error(chalk.red(error.message));
            console.log(chalk.yellow('\nTip: Make sure Hardhat node is running and contracts are deployed'));
            process.exit(1);
        }
    }
    
    async checkLLMAvailability() {
        const spinner = ora('Checking LLM availability...').start();
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (response.ok) {
                spinner.succeed('Ollama LLM connected');
                console.log(chalk.gray('  Using local Mistral/Llama model for bot personalities'));
            } else {
                throw new Error('Ollama not responding');
            }
        } catch (error) {
            spinner.warn('Ollama not available - using fallback responses');
            console.log(chalk.yellow('  Install Ollama for full bot personalities:'));
            console.log(chalk.gray('  curl -fsSL https://ollama.ai/install.sh | sh'));
            console.log(chalk.gray('  ollama pull mistral'));
        }
    }
    
    async showMainMenu() {
        console.log();
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    '💬 Chat with Bots',
                    '🎯 Bet on a Bot',
                    '🎮 Start Game Round',
                    '📊 View Bot Stats',
                    '💰 Check My Bets',
                    '🏆 Leaderboard',
                    '🎲 Watch Bots Play',
                    '📖 How to Play',
                    '🚪 Exit'
                ]
            }
        ]);
        
        switch (action) {
            case '💬 Chat with Bots':
                await this.chatWithBots();
                break;
            case '🎯 Bet on a Bot':
                await this.betOnBot();
                break;
            case '🎮 Start Game Round':
                await this.startGameRound();
                break;
            case '📊 View Bot Stats':
                await this.viewBotStats();
                break;
            case '💰 Check My Bets':
                await this.checkMyBets();
                break;
            case '🏆 Leaderboard':
                await this.showLeaderboard();
                break;
            case '🎲 Watch Bots Play':
                await this.watchBotsPlay();
                break;
            case '📖 How to Play':
                await this.showHelp();
                break;
            case '🚪 Exit':
                console.log(chalk.yellow('\n👋 Thanks for playing!\n'));
                process.exit(0);
        }
        
        await this.showMainMenu();
    }
    
    async chatWithBots() {
        console.clear();
        console.log(chalk.cyan('\n💬 CHAT WITH BOTS\n'));
        console.log(chalk.gray('Get to know the bots before betting on them!\n'));
        
        // Select a bot
        const choices = BOT_INFO.map(bot => ({
            name: `${bot.emoji} ${bot.name} - ${bot.strategy}`,
            value: bot.id
        }));
        
        const { botId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'botId',
                message: 'Which bot would you like to chat with?',
                choices
            }
        ]);
        
        const bot = BOT_INFO[botId];
        console.log(chalk.yellow(`\n🎭 Chatting with ${bot.name}\n`));
        
        // Chat loop
        let chatting = true;
        while (chatting) {
            const { message } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: 'You:',
                    validate: input => input.trim().length > 0
                }
            ]);
            
            if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
                chatting = false;
                continue;
            }
            
            const spinner = ora('Thinking...').start();
            
            // Get bot's current stats for context
            const botStats = this.gameConnector.getBotStats(botId);
            const context = {
                performance: botStats ? `W/L: ${botStats.stats.wins}/${botStats.stats.losses}` : 'No games yet'
            };
            
            const response = await this.llmManager.getBotResponse(botId, message, context);
            spinner.stop();
            
            console.log(bot.color(`${bot.emoji} ${bot.name}: ${response}`));
            console.log();
            
            // Ask about betting
            if (message.toLowerCase().includes('bet') || message.toLowerCase().includes('strategy')) {
                const decision = await this.llmManager.getBotBettingDecision(botId, this.gameConnector.gameState);
                console.log(chalk.gray(`[${bot.name}'s next bet: ${decision.type} for ${decision.amount} BOT]`));
                console.log();
            }
        }
    }
    
    async betOnBot() {
        console.clear();
        console.log(chalk.cyan('\n🎯 BET ON A BOT\n'));
        console.log(chalk.gray('Choose a bot to back in the next round!\n'));
        
        // Show bot performance
        const table = new Table({
            head: ['', 'Bot', 'Strategy', 'Win Rate', 'Current Streak'],
            colWidths: [5, 25, 15, 12, 15],
            style: { head: ['cyan'] }
        });
        
        for (const bot of BOT_INFO) {
            const stats = this.gameConnector.getBotStats(bot.id);
            const winRate = stats && stats.stats.totalBets > 0
                ? ((stats.stats.wins / stats.stats.totalBets) * 100).toFixed(1) + '%'
                : 'No data';
            const streak = stats 
                ? (stats.stats.currentStreak > 0 ? chalk.green(`+${stats.stats.currentStreak}`) : 
                   stats.stats.currentStreak < 0 ? chalk.red(`${stats.stats.currentStreak}`) : '0')
                : '-';
            
            table.push([bot.emoji, bot.name, bot.strategy, winRate, streak]);
        }
        
        console.log(table.toString());
        
        // Select bot and amount
        const { botId, amount } = await inquirer.prompt([
            {
                type: 'list',
                name: 'botId',
                message: 'Which bot do you want to bet on?',
                choices: BOT_INFO.map(bot => ({
                    name: `${bot.emoji} ${bot.name}`,
                    value: bot.id
                }))
            },
            {
                type: 'number',
                name: 'amount',
                message: 'How much BOT do you want to bet? (10-10000)',
                default: 100,
                validate: input => input >= 10 && input <= 10000
            }
        ]);
        
        // Chat with the bot about the bet
        const bot = BOT_INFO[botId];
        console.log(chalk.yellow(`\n💬 Asking ${bot.name} about your bet...\n`));
        
        const response = await this.llmManager.getBotResponse(
            botId,
            `Someone wants to bet ${amount} BOT on you winning! What do you say?`,
            { gameState: this.gameConnector.gameState.phase }
        );
        
        console.log(bot.color(`${bot.emoji} ${bot.name}: ${response}`));
        
        // Confirm bet
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Place ${amount} BOT on ${bot.name}?`,
                default: true
            }
        ]);
        
        if (confirm) {
            // Track the bet
            if (!this.userBets.has(this.currentRound)) {
                this.userBets.set(this.currentRound, []);
            }
            this.userBets.get(this.currentRound).push({ botId, amount, botName: bot.name });
            
            console.log(chalk.green(`\n✅ Bet placed: ${amount} BOT on ${bot.name}`));
            this.favoriteBot = botId;
        }
    }
    
    async startGameRound() {
        console.clear();
        console.log(chalk.cyan('\n🎮 STARTING GAME ROUND\n'));
        
        this.currentRound++;
        console.log(chalk.yellow(`Round ${this.currentRound} begins!\n`));
        
        // Run the game round
        await this.gameConnector.runGameRound();
        
        // Get bot reactions
        console.log(chalk.cyan('\n🎭 Bot Reactions:\n'));
        
        for (let i = 0; i < 3; i++) {
            const bot = BOT_INFO[i];
            const stats = this.gameConnector.getBotStats(i);
            const won = stats && stats.stats.currentStreak > 0;
            
            const reaction = await this.llmManager.getBotReaction(i, won, 100);
            console.log(bot.color(`${bot.emoji} ${bot.name}: ${reaction}`));
        }
        
        // Check user's bets
        const userBets = this.userBets.get(this.currentRound - 1);
        if (userBets && userBets.length > 0) {
            console.log(chalk.yellow('\n💰 Your Bet Results:\n'));
            
            for (const bet of userBets) {
                const bot = BOT_INFO[bet.botId];
                const stats = this.gameConnector.getBotStats(bet.botId);
                const won = stats && stats.stats.currentStreak > 0;
                
                if (won) {
                    const winnings = bet.amount * 2; // Simplified payout
                    console.log(chalk.green(`✅ ${bot.emoji} ${bot.name} WON! You won ${winnings} BOT!`));
                } else {
                    console.log(chalk.red(`❌ ${bot.emoji} ${bot.name} lost. You lost ${bet.amount} BOT.`));
                }
            }
        }
    }
    
    async viewBotStats() {
        console.clear();
        console.log(chalk.cyan('\n📊 BOT STATISTICS\n'));
        
        const table = new Table({
            head: ['Rank', 'Bot', 'Games', 'Wins', 'Losses', 'Win Rate', 'Streak', 'Total Bets'],
            colWidths: [6, 25, 8, 8, 8, 10, 8, 12],
            style: { head: ['cyan'] }
        });
        
        // Get all bot stats and sort by wins
        const botStats = [];
        for (const bot of BOT_INFO) {
            const stats = this.gameConnector.getBotStats(bot.id);
            botStats.push({ bot, stats });
        }
        
        botStats.sort((a, b) => {
            const aWins = a.stats?.stats.wins || 0;
            const bWins = b.stats?.stats.wins || 0;
            return bWins - aWins;
        });
        
        let rank = 1;
        for (const { bot, stats } of botStats) {
            if (stats && stats.stats.totalBets > 0) {
                const winRate = ((stats.stats.wins / stats.stats.totalBets) * 100).toFixed(1) + '%';
                const streak = stats.stats.currentStreak > 0 
                    ? chalk.green(`+${stats.stats.currentStreak}`)
                    : stats.stats.currentStreak < 0 
                    ? chalk.red(`${stats.stats.currentStreak}`)
                    : '0';
                
                table.push([
                    rank++,
                    `${bot.emoji} ${bot.name}`,
                    stats.stats.totalBets,
                    stats.stats.wins,
                    stats.stats.losses,
                    winRate,
                    streak,
                    stats.stats.totalBets
                ]);
            } else {
                table.push([
                    rank++,
                    `${bot.emoji} ${bot.name}`,
                    0, 0, 0, '0.0%', '-', 0
                ]);
            }
        }
        
        console.log(table.toString());
        
        // Ask a bot for commentary
        if (botStats[0].stats?.stats.wins > 0) {
            const topBot = botStats[0].bot;
            console.log(chalk.yellow(`\n💬 Comment from current leader:\n`));
            
            const comment = await this.llmManager.getBotResponse(
                topBot.id,
                "You're currently in the lead! What's your secret?",
                {}
            );
            
            console.log(topBot.color(`${topBot.emoji} ${topBot.name}: ${comment}`));
        }
    }
    
    async checkMyBets() {
        console.clear();
        console.log(chalk.cyan('\n💰 MY BETTING HISTORY\n'));
        
        if (this.userBets.size === 0) {
            console.log(chalk.gray('You haven\'t placed any bets yet!'));
            return;
        }
        
        let totalBet = 0;
        let totalWon = 0;
        
        for (const [round, bets] of this.userBets) {
            console.log(chalk.yellow(`\nRound ${round}:`));
            
            for (const bet of bets) {
                const bot = BOT_INFO[bet.botId];
                totalBet += bet.amount;
                
                // Check if won (simplified)
                const stats = this.gameConnector.getBotStats(bet.botId);
                const won = stats && stats.stats.currentStreak > 0;
                
                if (won) {
                    const winnings = bet.amount * 2;
                    totalWon += winnings;
                    console.log(chalk.green(`  ✅ ${bot.emoji} ${bot.name}: Bet ${bet.amount} BOT, Won ${winnings} BOT`));
                } else {
                    console.log(chalk.red(`  ❌ ${bot.emoji} ${bot.name}: Bet ${bet.amount} BOT, Lost`));
                }
            }
        }
        
        console.log(chalk.gray('\n' + '─'.repeat(50)));
        console.log(chalk.yellow('Summary:'));
        console.log(`  Total Bet: ${totalBet} BOT`);
        console.log(`  Total Won: ${totalWon} BOT`);
        const profit = totalWon - totalBet;
        console.log(profit >= 0 
            ? chalk.green(`  Profit: +${profit} BOT`)
            : chalk.red(`  Loss: ${profit} BOT`)
        );
    }
    
    async showLeaderboard() {
        console.clear();
        console.log(chalk.cyan('\n🏆 LEADERBOARD\n'));
        
        // Bot leaderboard
        console.log(chalk.yellow('Top Performing Bots:'));
        const botStats = [];
        for (const bot of BOT_INFO) {
            const stats = this.gameConnector.getBotStats(bot.id);
            if (stats && stats.stats.totalBets > 0) {
                botStats.push({
                    bot,
                    winRate: (stats.stats.wins / stats.stats.totalBets) * 100,
                    totalWins: stats.stats.wins
                });
            }
        }
        
        botStats.sort((a, b) => b.winRate - a.winRate);
        
        for (let i = 0; i < Math.min(5, botStats.length); i++) {
            const { bot, winRate, totalWins } = botStats[i];
            const trophy = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
            console.log(`${trophy} ${bot.emoji} ${bot.name}: ${winRate.toFixed(1)}% win rate (${totalWins} wins)`);
        }
        
        // Get champion's comment
        if (botStats.length > 0) {
            const champion = botStats[0].bot;
            console.log(chalk.yellow(`\n💬 Champion's message:\n`));
            
            const message = await this.llmManager.getBotResponse(
                champion.id,
                "You're the champion! Any words for your fans?",
                {}
            );
            
            console.log(champion.color(`${champion.emoji} ${champion.name}: ${message}`));
        }
    }
    
    async watchBotsPlay() {
        console.clear();
        console.log(chalk.cyan('\n🎲 WATCH BOTS PLAY\n'));
        
        const { rounds } = await inquirer.prompt([
            {
                type: 'number',
                name: 'rounds',
                message: 'How many rounds to watch?',
                default: 5,
                validate: input => input > 0 && input <= 20
            }
        ]);
        
        for (let round = 1; round <= rounds; round++) {
            console.log(chalk.yellow(`\n📍 Round ${round}/${rounds}`));
            console.log(chalk.gray('─'.repeat(40)));
            
            // Get betting decisions from bots
            console.log(chalk.cyan('Bot Decisions:'));
            
            for (let i = 0; i < 3; i++) {
                const bot = BOT_INFO[i];
                const decision = await this.llmManager.getBotBettingDecision(i, this.gameConnector.gameState);
                console.log(bot.color(`${bot.emoji} ${bot.name}: Betting ${decision.amount} BOT on ${decision.type}`));
            }
            
            // Run game round
            await this.gameConnector.runGameRound();
            
            // Get reactions
            console.log(chalk.cyan('\nReactions:'));
            for (let i = 0; i < 3; i++) {
                const bot = BOT_INFO[i];
                const stats = this.gameConnector.getBotStats(i);
                const won = stats && stats.stats.currentStreak > 0;
                
                const reaction = await this.llmManager.getBotReaction(i, won, 100);
                console.log(bot.color(`${bot.emoji} ${bot.name}: ${reaction}`));
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log(chalk.green('\n✅ Finished watching!'));
    }
    
    async showHelp() {
        console.clear();
        console.log(chalk.cyan('\n📖 HOW TO PLAY\n'));
        
        console.log(chalk.yellow('🎰 Barely Human Casino Rules:\n'));
        
        console.log('1. ' + chalk.white('Chat with Bots') + ' - Get to know their personalities');
        console.log('   Each bot has unique traits and strategies\n');
        
        console.log('2. ' + chalk.white('Bet on Bots') + ' - Back your favorite bot to win');
        console.log('   Place BOT tokens on bots you think will perform well\n');
        
        console.log('3. ' + chalk.white('Watch Them Play') + ' - See bots compete in craps');
        console.log('   Bots make decisions based on their personalities\n');
        
        console.log('4. ' + chalk.white('Win Rewards') + ' - Earn when your bot wins');
        console.log('   Payouts based on bot performance and betting pool\n');
        
        console.log(chalk.yellow('🎲 Craps Basics:\n'));
        console.log('• Come-Out Roll: 7 or 11 wins, 2/3/12 loses');
        console.log('• Point Phase: Hit the point to win, 7 to lose');
        console.log('• Bots use different strategies based on personality');
        
        console.log(chalk.yellow('\n🤖 Bot Personalities:\n'));
        for (const bot of BOT_INFO.slice(0, 5)) {
            console.log(`${bot.emoji} ${bot.name} - ${bot.strategy}`);
        }
        console.log(chalk.gray('...and 5 more unique personalities!'));
    }
}

// Main execution
async function main() {
    const cli = new InteractiveCasinoCLI();
    
    try {
        await cli.init();
        await cli.showMainMenu();
    } catch (error) {
        console.error(chalk.red('\n❌ Fatal error:'), error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Thanks for playing! See you next time!\n'));
    process.exit(0);
});

// Run the CLI
main().catch(console.error);