#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { localhost } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Note: Dynamic import for GameConnector to avoid module issues
const { default: GameConnector } = await import('../../elizaos/runtime/game-connector.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load bot personalities
const loadBotPersonality = (botId) => {
    const names = [
        'alice_allin', 'bob_calculator', 'charlie_lucky', 'diana_icequeen',
        'eddie_entertainer', 'fiona_fearless', 'greg_grinder',
        'helen_hotstreak', 'ivan_intimidator', 'julia_jinx'
    ];
    
    const yamlPath = path.join(__dirname, '../../elizaos/characters', `${names[botId]}.yaml`);
    // For now, return simplified personality
    return {
        name: names[botId].replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        emoji: ['🎯', '🧮', '🍀', '❄️', '🎭', '⚡', '💎', '🔥', '👹', '🌀'][botId]
    };
};

class CasinoCLI {
    constructor() {
        this.gameConnector = new GameConnector({});
        this.spinner = null;
        this.isRunning = false;
        this.autoMode = false;
        this.roundCount = 0;
    }
    
    async init() {
        // Display welcome banner
        console.clear();
        console.log(
            chalk.cyan(
                figlet.textSync('Barely Human', { horizontalLayout: 'full' })
            )
        );
        console.log(chalk.yellow('\n🎲 DeFi Casino with AI Bot Gamblers 🤖\n'));
        console.log(chalk.gray('=' .repeat(60)));
        
        // Initialize game connector
        this.spinner = ora('Connecting to blockchain...').start();
        
        try {
            await this.gameConnector.initialize();
            
            // Create bot instances with test private keys
            // In production, these would be managed securely
            for (let i = 0; i < 10; i++) {
                // Generate deterministic private key for testing
                const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
                await this.gameConnector.createBot(i, privateKey);
            }
            
            this.spinner.succeed('Connected to local blockchain');
            
            // Get initial game state
            await this.gameConnector.getGameState();
            
            console.log(chalk.green('\n✅ Casino is ready!\n'));
            
        } catch (error) {
            this.spinner.fail('Failed to connect');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    }
    
    async showMainMenu() {
        const choices = [
            '🎮 Start New Game',
            '🤖 View Bot Status',
            '📊 Game Statistics',
            '🎲 Single Round',
            '🔄 Auto Play (10 rounds)',
            '💰 Check Balances',
            '📖 Game Rules',
            '🚪 Exit'
        ];
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices
            }
        ]);
        
        switch (action) {
            case '🎮 Start New Game':
                await this.startNewGame();
                break;
            case '🤖 View Bot Status':
                await this.showBotStatus();
                break;
            case '📊 Game Statistics':
                await this.showStatistics();
                break;
            case '🎲 Single Round':
                await this.playSingleRound();
                break;
            case '🔄 Auto Play (10 rounds)':
                await this.autoPlay(10);
                break;
            case '💰 Check Balances':
                await this.checkBalances();
                break;
            case '📖 Game Rules':
                await this.showRules();
                break;
            case '🚪 Exit':
                await this.exit();
                return;
        }
        
        // Return to menu
        await this.showMainMenu();
    }
    
    async startNewGame() {
        console.clear();
        console.log(chalk.cyan('\n🎮 STARTING NEW GAME\n'));
        
        this.spinner = ora('Starting new series...').start();
        
        try {
            const firstBot = this.gameConnector.bots.get(0);
            await this.gameConnector.startNewSeries(firstBot.account.address);
            this.spinner.succeed('New game started!');
            
            await this.displayGameState();
            
        } catch (error) {
            this.spinner.fail('Failed to start game');
            console.error(chalk.red(error.message));
        }
        
        await this.promptContinue();
    }
    
    async playSingleRound() {
        console.clear();
        console.log(chalk.cyan('\n🎲 PLAYING SINGLE ROUND\n'));
        
        await this.gameConnector.runGameRound();
        this.roundCount++;
        
        await this.promptContinue();
    }
    
    async autoPlay(rounds) {
        console.clear();
        console.log(chalk.cyan(`\n🔄 AUTO PLAY: ${rounds} ROUNDS\n`));
        
        this.autoMode = true;
        
        for (let i = 0; i < rounds; i++) {
            console.log(chalk.yellow(`\n📍 Round ${i + 1}/${rounds}`));
            console.log(chalk.gray('-'.repeat(40)));
            
            await this.gameConnector.runGameRound();
            this.roundCount++;
            
            // Add delay for visibility
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        this.autoMode = false;
        
        console.log(chalk.green(`\n✅ Completed ${rounds} rounds!`));
        await this.promptContinue();
    }
    
    async showBotStatus() {
        console.clear();
        console.log(chalk.cyan('\n🤖 BOT STATUS\n'));
        
        const table = new Table({
            head: ['Bot', 'Name', 'Strategy', 'Aggression', 'Risk', 'Confidence'],
            colWidths: [5, 20, 15, 12, 8, 12],
            style: { head: ['cyan'] }
        });
        
        for (let i = 0; i < 10; i++) {
            const bot = this.gameConnector.bots.get(i);
            const personality = loadBotPersonality(i);
            
            if (bot) {
                const strategyNames = [
                    'Conservative', 'Aggressive', 'Martingale', 'Fibonacci',
                    'Paroli', 'D\'Alembert', 'Oscar Grind', 'Random',
                    'Adaptive', 'Mixed'
                ];
                
                table.push([
                    personality.emoji,
                    personality.name,
                    strategyNames[bot.personality.preferredStrategy],
                    `${bot.personality.aggressiveness}%`,
                    `${bot.personality.riskTolerance}%`,
                    `${bot.personality.confidence}%`
                ]);
            }
        }
        
        console.log(table.toString());
        
        await this.promptContinue();
    }
    
    async showStatistics() {
        console.clear();
        console.log(chalk.cyan('\n📊 GAME STATISTICS\n'));
        
        const stats = this.gameConnector.getAllBotStats();
        
        console.log(chalk.yellow('Overall Statistics:'));
        console.log(`  Total Rounds Played: ${this.roundCount}`);
        console.log(`  Current Game Phase: ${this.gameConnector.gameState.phase}`);
        console.log(`  Current Point: ${this.gameConnector.gameState.point || 'None'}`);
        console.log(`  Active Bets: ${this.gameConnector.gameState.activeBets.size}`);
        
        console.log(chalk.yellow('\nBot Performance:'));
        
        const perfTable = new Table({
            head: ['Bot', 'Total Bets', 'Wins', 'Losses', 'Win Rate', 'Streak'],
            colWidths: [20, 12, 8, 8, 10, 15],
            style: { head: ['cyan'] }
        });
        
        for (const stat of stats) {
            const personality = loadBotPersonality(stat.id);
            const winRate = stat.stats.totalBets > 0 
                ? ((stat.stats.wins / stat.stats.totalBets) * 100).toFixed(1) 
                : '0.0';
            
            const streak = stat.stats.currentStreak > 0
                ? `${stat.stats.isWinStreak ? '🔥' : '❄️'} ${stat.stats.currentStreak}`
                : '-';
            
            perfTable.push([
                `${personality.emoji} ${personality.name}`,
                stat.stats.totalBets,
                stat.stats.wins,
                stat.stats.losses,
                `${winRate}%`,
                streak
            ]);
        }
        
        console.log(perfTable.toString());
        
        await this.promptContinue();
    }
    
    async checkBalances() {
        console.clear();
        console.log(chalk.cyan('\n💰 BOT BALANCES\n'));
        
        this.spinner = ora('Fetching balances...').start();
        
        const table = new Table({
            head: ['Bot', 'Name', 'Vault Balance (BOT)'],
            colWidths: [5, 20, 25],
            style: { head: ['cyan'] }
        });
        
        try {
            for (let i = 0; i < 10; i++) {
                const bot = this.gameConnector.bots.get(i);
                const personality = loadBotPersonality(i);
                
                if (bot) {
                    const balance = await this.gameConnector.publicClient.readContract({
                        address: this.gameConnector.contracts.botToken.address,
                        abi: this.gameConnector.contracts.botToken.abi,
                        functionName: 'balanceOf',
                        args: [bot.vaultAddress]
                    });
                    
                    table.push([
                        personality.emoji,
                        personality.name,
                        formatEther(balance)
                    ]);
                }
            }
            
            this.spinner.succeed('Balances fetched');
            console.log(table.toString());
            
        } catch (error) {
            this.spinner.fail('Failed to fetch balances');
            console.error(chalk.red(error.message));
        }
        
        await this.promptContinue();
    }
    
    async showRules() {
        console.clear();
        console.log(chalk.cyan('\n📖 CRAPS RULES\n'));
        
        console.log(chalk.yellow('Basic Game Flow:'));
        console.log('1. Come-Out Roll: Establish the point');
        console.log('   • 7 or 11 = Pass line wins');
        console.log('   • 2, 3, or 12 = Pass line loses (craps)');
        console.log('   • 4, 5, 6, 8, 9, 10 = Point established');
        console.log('\n2. Point Phase: Try to hit the point');
        console.log('   • Roll the point = Pass line wins');
        console.log('   • Roll 7 = Pass line loses (seven out)');
        
        console.log(chalk.yellow('\nBet Types:'));
        console.log('• Pass/Don\'t Pass: Basic bets');
        console.log('• Come/Don\'t Come: Like Pass but during point phase');
        console.log('• Field: One-roll bet on 2,3,4,9,10,11,12');
        console.log('• Hardways: Exact dice combinations');
        console.log('• And 60+ more bet types!');
        
        console.log(chalk.yellow('\nBot Strategies:'));
        console.log('• Conservative: Small, safe bets');
        console.log('• Aggressive: High risk, high reward');
        console.log('• Martingale: Double after loss');
        console.log('• Fibonacci: Mathematical progression');
        console.log('• And 6 more unique strategies!');
        
        await this.promptContinue();
    }
    
    async displayGameState() {
        const state = this.gameConnector.gameState;
        
        console.log(chalk.yellow('\n📍 Current Game State:'));
        console.log(`  Phase: ${chalk.green(state.phase)}`);
        console.log(`  Point: ${state.point > 0 ? chalk.cyan(state.point) : chalk.gray('None')}`);
        
        if (state.lastRoll) {
            console.log(`  Last Roll: ${chalk.red(state.lastRoll.die1)} + ${chalk.red(state.lastRoll.die2)} = ${chalk.yellow(state.lastRoll.total)}`);
        }
        
        console.log(`  Active Bets: ${chalk.magenta(state.activeBets.size)}`);
    }
    
    async promptContinue() {
        console.log();
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...',
            }
        ]);
    }
    
    async exit() {
        console.log(chalk.yellow('\n👋 Thanks for playing Barely Human!\n'));
        console.log(chalk.gray('Shutting down...'));
        process.exit(0);
    }
}

// Main execution
async function main() {
    const cli = new CasinoCLI();
    
    try {
        await cli.init();
        await cli.showMainMenu();
    } catch (error) {
        console.error(chalk.red('\n❌ Fatal error:'), error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Shutting down gracefully...'));
    process.exit(0);
});

// Run the CLI
main().catch(console.error);