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
import { hardhatChain, contractCallWithRetry, logContractError } from '../../config/chains.js';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import our modules
import BotLLMManager from '../../elizaos/runtime/llm-connector.js';
import GameConnector from '../../elizaos/runtime/game-connector.js';
import { WalletManager } from './wallet-manager.js';
import WalletFundingManager from '../../scripts/fund-accounts.ts';
import EmergencyFundingManager from '../../scripts/emergency-fund-fix.ts';

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
        this.walletManager = new WalletManager();
        this.fundingManager = null;
        this.emergencyManager = null;
        this.currentUser = null;
        this.autoFundingEnabled = true;
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
                chain: hardhatChain,
                transport: http('http://127.0.0.1:8545')
            });
            
            // Initialize wallet manager
            spinner.text = 'Setting up wallet management...';
            await this.walletManager.initialize();
            
            // Initialize funding systems
            spinner.text = 'Initializing funding systems...';
            this.fundingManager = new WalletFundingManager();
            this.emergencyManager = new EmergencyFundingManager();
            
            // Check if emergency funding is needed
            spinner.text = 'Checking bot funding status...';
            await this.checkAndFixBotFunding();
            
            // Set up user wallet (interactive)
            spinner.stop();
            await this.setupUserWallet();
            
            spinner.start('Initializing game systems...');
            
            // Initialize game connector
            await this.gameConnector.initialize();
            
            // Create bot instances with proper wallet loading
            await this.initializeBotWallets();
            
            spinner.succeed('Casino systems initialized!');
            
            // Check Ollama availability
            await this.checkLLMAvailability();
            
            // Display user info
            if (this.currentUser) {
                console.log(chalk.blue(`👤 Welcome, ${this.currentUser.name || 'Player'}!`));
                console.log(chalk.gray(`   Address: ${this.currentUser.address}`));
                
                const balances = await this.walletManager.checkBalances();
                console.log(chalk.gray(`   Balance: ${balances.ethFormatted} ETH, ${balances.botTokenFormatted} BOT`));
            }
            
            console.log(chalk.green('\n✅ Ready to play!\n'));
            
        } catch (error) {
            spinner.fail('Initialization failed');
            console.error(chalk.red(error.message));
            
            // Check if it's a funding issue
            if (error.message.includes('balance') || error.message.includes('insufficient') || error.message.includes('sender\'s balance is: 0')) {
                console.log(chalk.yellow('\n🚨 This looks like a funding issue. Let me try to fix it...\n'));
                try {
                    await this.emergencyFundBots();
                    console.log(chalk.green('✅ Emergency funding completed. Please restart the CLI.\n'));
                } catch (fundingError) {
                    console.error(chalk.red('❌ Emergency funding failed:'), fundingError.message);
                }
            }
            
            console.log(chalk.yellow('\nTip: Make sure Hardhat node is running and contracts are deployed'));
            console.log(chalk.yellow('Run: npm run deploy:local'));
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
                    '💼 Wallet Management',
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
            case '💼 Wallet Management':
                await this.showWalletMenu();
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
    
    /**
     * Set up user wallet interactively
     */
    async setupUserWallet() {
        console.log(chalk.cyan('\n🔐 Wallet Setup'));
        console.log(chalk.gray('='.repeat(50)));
        
        try {
            // Check if user has existing wallet or wants to create/import one
            const currentWallet = await this.walletManager.setupWalletInteractive();
            
            if (currentWallet) {
                this.currentUser = currentWallet;
                
                // Create wallet client for transactions
                this.walletClient = createWalletClient({
                    account: currentWallet.account,
                    chain: hardhatChain,
                    transport: http('http://127.0.0.1:8545')
                });
                
                console.log(chalk.green('✅ Wallet setup complete!\n'));
            } else {
                throw new Error('Wallet setup was cancelled');
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Wallet setup failed:'), error.message);
            throw error;
        }
    }
    
    /**
     * Check and fix bot funding issues
     */
    async checkAndFixBotFunding() {
        try {
            // Quick check if wallets.json exists
            const walletPath = path.join(process.cwd(), 'wallets.json');
            if (!fs.existsSync(walletPath)) {
                console.log(chalk.yellow('⚠️  Bot wallets not found. Generating them...'));
                await this.emergencyFundBots();
                return;
            }
            
            // Load existing wallet info
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            const botWallets = new Map(walletInfo.botWallets || []);
            
            if (botWallets.size === 0) {
                console.log(chalk.yellow('⚠️  No bot wallets found. Creating them...'));
                await this.emergencyFundBots();
                return;
            }
            
            // Quick balance check for first few bots
            let needsFunding = false;
            for (let i = 0; i < Math.min(3, botWallets.size); i++) {
                const botWallet = botWallets.get(i);
                if (botWallet) {
                    const ethBalance = await this.publicClient.getBalance({ 
                        address: botWallet.address 
                    });
                    if (ethBalance < parseEther('0.001')) { // Very low threshold
                        needsFunding = true;
                        break;
                    }
                }
            }
            
            if (needsFunding) {
                console.log(chalk.yellow('⚠️  Bot funding is low. Running emergency funding...'));
                await this.emergencyFundBots();
            }
            
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not check bot funding. Will attempt emergency funding...'));
            await this.emergencyFundBots();
        }
    }
    
    /**
     * Emergency fund all bots
     */
    async emergencyFundBots() {
        try {
            console.log(chalk.yellow('\n🚨 Running emergency bot funding...\n'));
            
            await this.emergencyManager.initialize();
            const success = await this.emergencyManager.executeEmergencyFix();
            await this.emergencyManager.cleanup();
            
            if (success) {
                console.log(chalk.green('✅ Emergency funding completed successfully!\n'));
            } else {
                console.log(chalk.yellow('⚠️  Emergency funding partially completed\n'));
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Emergency funding failed:'), error.message);
            console.log(chalk.yellow('\nYou may need to:'));
            console.log(chalk.yellow('• Restart the node: npm run node'));
            console.log(chalk.yellow('• Redeploy: npm run deploy:local'));
            console.log(chalk.yellow('• Run manual funding: npm run fund:emergency\n'));
            throw error;
        }
    }
    
    /**
     * Initialize bot wallets with proper private keys
     */
    async initializeBotWallets() {
        const walletPath = path.join(process.cwd(), 'wallets.json');
        
        if (fs.existsSync(walletPath)) {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            const botWallets = new Map(walletInfo.botWallets || []);
            
            // Create bot instances with actual wallet private keys
            for (const [botId, botWallet] of botWallets) {
                if (botId < 10) { // Only first 10 bots
                    await this.gameConnector.createBot(botId, botWallet.privateKey);
                }
            }
            
            console.log(chalk.gray(`   ✅ Loaded ${Math.min(botWallets.size, 10)} bot wallets`));
        } else {
            // Fallback to generated keys
            console.log(chalk.yellow('   ⚠️  Using fallback bot keys'));
            for (let i = 0; i < 10; i++) {
                const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
                await this.gameConnector.createBot(i, privateKey);
            }
        }
    }
    
    /**
     * Check user balance and offer funding if needed
     */
    async checkUserFunding() {
        if (!this.currentUser) return;
        
        try {
            const balances = await this.walletManager.checkBalances();
            
            // Check if user needs funding
            const ethLow = parseFloat(balances.ethFormatted) < 0.01;
            const botLow = parseFloat(balances.botTokenFormatted) < 100;
            
            if (ethLow || botLow) {
                console.log(chalk.yellow('\n💰 Your balance is low:'));
                console.log(chalk.gray(`   ETH: ${balances.ethFormatted}`));
                console.log(chalk.gray(`   BOT: ${balances.botTokenFormatted}`));
                
                if (this.autoFundingEnabled) {
                    const { fundNow } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'fundNow',
                            message: 'Would you like to fund your wallet now?',
                            default: true
                        }
                    ]);
                    
                    if (fundNow) {
                        const spinner = ora('Funding your wallet...').start();
                        try {
                            await this.walletManager.requestFunding();
                            spinner.succeed('Wallet funded successfully!');
                        } catch (error) {
                            spinner.fail('Funding failed: ' + error.message);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(chalk.gray('Could not check user funding:'), error.message);
        }
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