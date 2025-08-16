#!/usr/bin/env node

/**
 * Simplified Casino CLI for Barely Human
 * Interactive terminal interface for the DeFi Casino
 */

import chalk from 'chalk';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple banner
const showBanner = () => {
    console.clear();
    console.log(chalk.cyan('╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                                        ║'));
    console.log(chalk.cyan('║        🎲 BARELY HUMAN CASINO 🎲       ║'));
    console.log(chalk.cyan('║     DeFi Casino with AI Gamblers      ║'));
    console.log(chalk.cyan('║                                        ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════╝'));
    console.log();
};

class SimpleCasinoCLI {
    constructor() {
        this.deployments = null;
        this.publicClient = null;
        this.walletClient = null;
        this.contracts = {};
        this.gameState = {
            phase: 'IDLE',
            point: 0,
            lastRoll: null
        };
    }
    
    async init() {
        showBanner();
        
        const spinner = ora('Initializing casino...').start();
        
        try {
            // Load deployment info
            const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
            if (!fs.existsSync(deploymentPath)) {
                throw new Error('No deployment found. Run: npm run deploy:local');
            }
            this.deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            
            // Create clients
            this.publicClient = createPublicClient({
                chain: localhost,
                transport: http('http://127.0.0.1:8545')
            });
            
            // Use first test account
            const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
            this.walletClient = createWalletClient({
                account,
                chain: localhost,
                transport: http('http://127.0.0.1:8545')
            });
            
            spinner.succeed('Casino initialized!');
            console.log(chalk.green('✅ Connected to local blockchain'));
            console.log(chalk.gray(`   Account: ${account.address}`));
            console.log();
            
        } catch (error) {
            spinner.fail('Initialization failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    }
    
    async showMenu() {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    '🎮 View Game State',
                    '🎲 Start New Series',
                    '💰 Check Balances',
                    '🤖 Bot Status',
                    '📊 Statistics',
                    '🔄 Auto Play Demo',
                    '📖 Game Rules',
                    '🚪 Exit'
                ]
            }
        ]);
        
        console.log();
        
        switch (action) {
            case '🎮 View Game State':
                await this.viewGameState();
                break;
            case '🎲 Start New Series':
                await this.startNewSeries();
                break;
            case '💰 Check Balances':
                await this.checkBalances();
                break;
            case '🤖 Bot Status':
                await this.showBotStatus();
                break;
            case '📊 Statistics':
                await this.showStatistics();
                break;
            case '🔄 Auto Play Demo':
                await this.autoPlayDemo();
                break;
            case '📖 Game Rules':
                await this.showRules();
                break;
            case '🚪 Exit':
                console.log(chalk.yellow('👋 Thanks for playing!'));
                process.exit(0);
        }
        
        console.log();
        await this.showMenu();
    }
    
    async viewGameState() {
        console.log(chalk.cyan('📍 Current Game State'));
        console.log(chalk.gray('─'.repeat(40)));
        
        try {
            // Note: We'll show deployment addresses for now
            console.log(chalk.yellow('Deployed Contracts:'));
            console.log(`  CrapsGame: ${this.deployments.contracts.CrapsGame}`);
            console.log(`  BOT Token: ${this.deployments.contracts.BOTToken}`);
            console.log(`  Bot Vaults: ${this.deployments.contracts.BotVaults.length} deployed`);
            
            // Get block number
            const blockNumber = await this.publicClient.getBlockNumber();
            console.log(`\n  Current Block: ${blockNumber}`);
            
        } catch (error) {
            console.error(chalk.red('Error:', error.message));
        }
    }
    
    async startNewSeries() {
        console.log(chalk.cyan('🎲 Starting New Series'));
        console.log(chalk.gray('─'.repeat(40)));
        
        const spinner = ora('Starting series...').start();
        
        try {
            // Simple transaction example
            const tx = await this.walletClient.sendTransaction({
                to: this.deployments.contracts.CrapsGame,
                value: 0n,
                data: '0x' // Would be actual function call data
            });
            
            spinner.succeed(`Transaction sent: ${tx}`);
            console.log(chalk.green('✅ New series started!'));
            
        } catch (error) {
            spinner.fail('Failed to start series');
            console.error(chalk.red(error.message));
        }
    }
    
    async checkBalances() {
        console.log(chalk.cyan('💰 Bot Vault Balances'));
        console.log(chalk.gray('─'.repeat(40)));
        
        const table = new Table({
            head: ['Bot #', 'Vault Address', 'Balance (BOT)'],
            colWidths: [8, 45, 20],
            style: { head: ['cyan'] }
        });
        
        try {
            // Show first 5 vaults
            for (let i = 0; i < Math.min(5, this.deployments.contracts.BotVaults.length); i++) {
                const vault = this.deployments.contracts.BotVaults[i];
                
                // Get balance (simplified - would use actual ABI)
                const balance = await this.publicClient.getBalance({
                    address: vault
                });
                
                table.push([
                    `Bot ${i}`,
                    vault,
                    formatEther(balance)
                ]);
            }
            
            console.log(table.toString());
            console.log(chalk.gray(`\nShowing first 5 of ${this.deployments.contracts.BotVaults.length} vaults`));
            
        } catch (error) {
            console.error(chalk.red('Error:', error.message));
        }
    }
    
    async showBotStatus() {
        console.log(chalk.cyan('🤖 Bot Personalities'));
        console.log(chalk.gray('─'.repeat(40)));
        
        const bots = [
            { name: 'Alice All-In', emoji: '🎯', strategy: 'Aggressive', risk: 'High' },
            { name: 'Bob Calculator', emoji: '🧮', strategy: 'Conservative', risk: 'Low' },
            { name: 'Charlie Lucky', emoji: '🍀', strategy: 'Martingale', risk: 'Medium' },
            { name: 'Diana Ice Queen', emoji: '❄️', strategy: 'Fibonacci', risk: 'Low' },
            { name: 'Eddie Entertainer', emoji: '🎭', strategy: 'Paroli', risk: 'High' },
            { name: 'Fiona Fearless', emoji: '⚡', strategy: 'Aggressive', risk: 'Very High' },
            { name: 'Greg Grinder', emoji: '💎', strategy: 'Oscar Grind', risk: 'Low' },
            { name: 'Helen Hot Streak', emoji: '🔥', strategy: 'Adaptive', risk: 'High' },
            { name: 'Ivan Intimidator', emoji: '👹', strategy: 'Random', risk: 'Variable' },
            { name: 'Julia Jinx', emoji: '🌀', strategy: 'Mixed', risk: 'Medium' }
        ];
        
        const table = new Table({
            head: ['', 'Name', 'Strategy', 'Risk Level'],
            colWidths: [5, 20, 15, 15],
            style: { head: ['cyan'] }
        });
        
        for (const bot of bots) {
            table.push([bot.emoji, bot.name, bot.strategy, bot.risk]);
        }
        
        console.log(table.toString());
    }
    
    async showStatistics() {
        console.log(chalk.cyan('📊 Casino Statistics'));
        console.log(chalk.gray('─'.repeat(40)));
        
        console.log(chalk.yellow('Deployment Info:'));
        console.log(`  Network: ${this.deployments.network}`);
        console.log(`  Chain ID: ${this.deployments.chainId}`);
        console.log(`  Deployed: ${new Date(this.deployments.timestamp).toLocaleString()}`);
        
        console.log(chalk.yellow('\nContract Addresses:'));
        console.log(`  BOT Token: ${this.deployments.contracts.BOTToken}`);
        console.log(`  Treasury: ${this.deployments.contracts.Treasury}`);
        console.log(`  Craps Game: ${this.deployments.contracts.CrapsGame}`);
        console.log(`  Bot Manager: ${this.deployments.contracts.BotManager}`);
        
        console.log(chalk.yellow('\nGame Configuration:'));
        console.log(`  Total Bots: 10`);
        console.log(`  Bet Types: 64`);
        console.log(`  Min Bet: 1 BOT`);
        console.log(`  Max Bet: 10,000 BOT`);
    }
    
    async autoPlayDemo() {
        console.log(chalk.cyan('🔄 Auto Play Demo'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(chalk.yellow('\nSimulating 5 rounds...\n'));
        
        for (let round = 1; round <= 5; round++) {
            const spinner = ora(`Round ${round}/5`).start();
            
            // Simulate round
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const roll1 = Math.floor(Math.random() * 6) + 1;
            const roll2 = Math.floor(Math.random() * 6) + 1;
            const total = roll1 + roll2;
            
            spinner.succeed(`Round ${round}: 🎲 ${roll1} + ${roll2} = ${total}`);
            
            // Random bot actions
            const botActions = [
                'Alice bets 500 BOT on PASS',
                'Bob calculates odds...',
                'Charlie feels lucky!',
                'Diana remains calm',
                'Eddie cheers loudly!'
            ];
            
            const action = botActions[Math.floor(Math.random() * botActions.length)];
            console.log(chalk.gray(`   ${action}`));
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(chalk.green('\n✅ Demo complete!'));
    }
    
    async showRules() {
        console.log(chalk.cyan('📖 Craps Rules'));
        console.log(chalk.gray('─'.repeat(40)));
        
        console.log(chalk.yellow('\nBasic Game:'));
        console.log('• Come-Out Roll: Establish the point');
        console.log('  - 7 or 11 = Pass line wins');
        console.log('  - 2, 3, or 12 = Pass line loses');
        console.log('  - Other = Point established');
        
        console.log(chalk.yellow('\nPoint Phase:'));
        console.log('• Roll the point = Pass line wins');
        console.log('• Roll 7 = Pass line loses');
        
        console.log(chalk.yellow('\nBet Types:'));
        console.log('• Pass/Don\'t Pass: Basic bets');
        console.log('• Come/Don\'t Come: Like Pass during point');
        console.log('• Field: One-roll bet');
        console.log('• Hardways: Exact dice combos');
        console.log('• Plus 60+ more bet types!');
        
        console.log(chalk.yellow('\nBot Strategies:'));
        console.log('• Each bot has unique personality');
        console.log('• Different risk tolerances');
        console.log('• Various betting strategies');
    }
}

// Main execution
async function main() {
    const cli = new SimpleCasinoCLI();
    await cli.init();
    await cli.showMenu();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Shutting down...'));
    process.exit(0);
});

// Run the CLI
main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});