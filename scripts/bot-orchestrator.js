#!/usr/bin/env node

/**
 * Bot Orchestrator for Barely Human DeFi Casino
 * Automates bot gameplay with personality-based decisions
 */

import chalk from 'chalk';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { hardhatChain, contractCallWithRetry, logContractError, validateDeployment } from '../config/chains.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bot personalities configuration
const BOT_PERSONALITIES = [
    { name: 'Alice "All-In"', emoji: '🎯', aggressiveness: 90, riskTolerance: 85, strategy: 'aggressive' },
    { name: 'Bob "The Calculator"', emoji: '🧮', aggressiveness: 30, riskTolerance: 25, strategy: 'conservative' },
    { name: 'Charlie "Lucky Charm"', emoji: '🍀', aggressiveness: 60, riskTolerance: 70, strategy: 'martingale' },
    { name: 'Diana "Ice Queen"', emoji: '❄️', aggressiveness: 40, riskTolerance: 35, strategy: 'fibonacci' },
    { name: 'Eddie "The Entertainer"', emoji: '🎭', aggressiveness: 75, riskTolerance: 80, strategy: 'paroli' },
    { name: 'Fiona "Fearless"', emoji: '⚡', aggressiveness: 95, riskTolerance: 90, strategy: 'aggressive' },
    { name: 'Greg "The Grinder"', emoji: '💎', aggressiveness: 35, riskTolerance: 30, strategy: 'oscar_grind' },
    { name: 'Helen "Hot Streak"', emoji: '🔥', aggressiveness: 70, riskTolerance: 75, strategy: 'adaptive' },
    { name: 'Ivan "The Intimidator"', emoji: '👹', aggressiveness: 80, riskTolerance: 60, strategy: 'random' },
    { name: 'Julia "Jinx"', emoji: '🌀', aggressiveness: 55, riskTolerance: 65, strategy: 'mixed' }
];

class BotOrchestrator {
    constructor() {
        this.bots = [];
        this.gameState = { phase: 'IDLE', point: 0, round: 0 };
        this.running = false;
    }
    
    async initialize() {
        console.log(chalk.cyan('\n🤖 Initializing Bot Orchestrator\n'));
        console.log(chalk.gray('='.repeat(60)));
        
        // Load deployments with validation
        const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run deployment script first.');
        }
        
        try {
            this.deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            validateDeployment(this.deployments);
            console.log(chalk.gray(`📂 Loaded deployment from ${deploymentPath}`));
            console.log(chalk.gray(`🔗 Chain ID: ${this.deployments.chainId}`));
        } catch (error) {
            throw new Error(`Failed to load deployment: ${error.message}`);
        }
        
        // Create public client with correct chain
        this.publicClient = createPublicClient({
            chain: hardhatChain,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Verify chain connection
        try {
            const chainId = await this.publicClient.getChainId();
            console.log(chalk.gray(`🌐 Connected to chain ID: ${chainId}`));
            if (chainId !== 31337) {
                console.warn(chalk.yellow(`⚠️  Warning: Expected chain ID 31337, got ${chainId}`));
            }
        } catch (error) {
            throw new Error(`Failed to connect to chain: ${error.message}`);
        }
        
        // Initialize bots with unique wallets
        for (let i = 0; i < BOT_PERSONALITIES.length; i++) {
            const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: hardhatChain,
                transport: http('http://127.0.0.1:8545')
            });
            
            this.bots.push({
                id: i,
                ...BOT_PERSONALITIES[i],
                account,
                walletClient,
                vaultAddress: this.deployments.contracts.BotVaults[i],
                stats: {
                    totalBets: 0,
                    wins: 0,
                    losses: 0,
                    currentStreak: 0,
                    profit: 0n
                }
            });
        }
        
        console.log(chalk.green('✅ Initialized ' + this.bots.length + ' bots'));
    }
    
    async simulateRound() {
        this.gameState.round++;
        console.log(chalk.yellow(`\n📍 Round ${this.gameState.round}`));
        console.log(chalk.gray('-'.repeat(40)));
        
        // Simulate dice roll
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        
        console.log(chalk.cyan(`🎲 Roll: ${die1} + ${die2} = ${total}`));
        
        // Update game phase based on roll
        if (this.gameState.phase === 'IDLE' || this.gameState.phase === 'COME_OUT') {
            if (total === 7 || total === 11) {
                console.log(chalk.green('  Natural! Pass line wins!'));
                this.gameState.phase = 'COME_OUT';
            } else if (total === 2 || total === 3 || total === 12) {
                console.log(chalk.red('  Craps! Pass line loses!'));
                this.gameState.phase = 'COME_OUT';
            } else {
                this.gameState.point = total;
                this.gameState.phase = 'POINT';
                console.log(chalk.yellow(`  Point established: ${total}`));
            }
        } else if (this.gameState.phase === 'POINT') {
            if (total === this.gameState.point) {
                console.log(chalk.green(`  Point hit! Pass line wins!`));
                this.gameState.phase = 'COME_OUT';
                this.gameState.point = 0;
            } else if (total === 7) {
                console.log(chalk.red('  Seven out! Pass line loses!'));
                this.gameState.phase = 'COME_OUT';
                this.gameState.point = 0;
            } else {
                console.log(chalk.gray(`  Roll again (point is ${this.gameState.point})`));
            }
        }
        
        // Each bot makes a decision
        const activeBots = [];
        for (const bot of this.bots) {
            if (this.shouldBotBet(bot)) {
                const betAmount = this.calculateBetAmount(bot);
                const betType = this.chooseBetType(bot);
                activeBots.push({ bot, betAmount, betType });
            }
        }
        
        // Display bot actions
        if (activeBots.length > 0) {
            console.log(chalk.magenta('\n  Bot Actions:'));
            for (const { bot, betAmount, betType } of activeBots) {
                const betTypes = ['PASS', "DON'T PASS", 'COME', "DON'T COME", 'FIELD'];
                console.log(`    ${bot.emoji} ${bot.name}: Bets ${formatEther(betAmount)} BOT on ${betTypes[betType] || 'UNKNOWN'}`);
                bot.stats.totalBets++;
            }
        }
        
        // Simulate outcomes
        for (const { bot } of activeBots) {
            const won = Math.random() > 0.5;
            if (won) {
                bot.stats.wins++;
                bot.stats.currentStreak = bot.stats.currentStreak > 0 ? bot.stats.currentStreak + 1 : 1;
            } else {
                bot.stats.losses++;
                bot.stats.currentStreak = bot.stats.currentStreak < 0 ? bot.stats.currentStreak - 1 : -1;
            }
        }
    }
    
    shouldBotBet(bot) {
        // Decision based on personality
        const chance = Math.random() * 100;
        return chance < bot.aggressiveness;
    }
    
    calculateBetAmount(bot) {
        // Calculate bet based on risk tolerance
        const minBet = parseEther('10');
        const maxBet = parseEther('1000');
        const riskFactor = bot.riskTolerance / 100;
        
        // Apply strategy modifiers
        let multiplier = 1;
        if (bot.strategy === 'martingale' && bot.stats.currentStreak < 0) {
            multiplier = Math.pow(2, Math.abs(bot.stats.currentStreak));
        } else if (bot.strategy === 'paroli' && bot.stats.currentStreak > 0) {
            multiplier = Math.min(8, Math.pow(2, bot.stats.currentStreak));
        }
        
        const baseAmount = minBet + ((maxBet - minBet) * BigInt(Math.floor(riskFactor * 100)) / 100n);
        return baseAmount * BigInt(Math.floor(multiplier));
    }
    
    chooseBetType(bot) {
        // Choose bet type based on game phase and strategy
        if (this.gameState.phase === 'COME_OUT') {
            if (bot.strategy === 'conservative') return 1; // Don't Pass
            if (bot.strategy === 'aggressive') return 0; // Pass
            return Math.random() > 0.5 ? 0 : 1;
        } else {
            const betTypes = [2, 3, 4]; // Come, Don't Come, Field
            return betTypes[Math.floor(Math.random() * betTypes.length)];
        }
    }
    
    async displayStats() {
        console.log(chalk.cyan('\n📊 Bot Statistics'));
        console.log(chalk.gray('='.repeat(60)));
        
        const sortedBots = [...this.bots].sort((a, b) => b.stats.wins - a.stats.wins);
        
        for (const bot of sortedBots) {
            const winRate = bot.stats.totalBets > 0 
                ? ((bot.stats.wins / bot.stats.totalBets) * 100).toFixed(1)
                : '0.0';
            
            const streak = bot.stats.currentStreak !== 0
                ? (bot.stats.currentStreak > 0 ? chalk.green(`+${bot.stats.currentStreak}`) : chalk.red(`${bot.stats.currentStreak}`))
                : chalk.gray('0');
            
            console.log(
                `${bot.emoji} ${bot.name.padEnd(25)} | ` +
                `Bets: ${bot.stats.totalBets.toString().padStart(3)} | ` +
                `W/L: ${bot.stats.wins}/${bot.stats.losses} | ` +
                `Rate: ${winRate.padStart(5)}% | ` +
                `Streak: ${streak}`
            );
        }
    }
    
    async run(rounds = 10) {
        console.log(chalk.cyan(`\n🎮 Running ${rounds} Game Rounds\n`));
        this.running = true;
        
        for (let i = 0; i < rounds && this.running; i++) {
            await this.simulateRound();
            
            // Add delay for visibility
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        await this.displayStats();
        
        console.log(chalk.green(`\n✅ Completed ${rounds} rounds!`));
        const topBot = [...this.bots].sort((a, b) => b.stats.wins - a.stats.wins)[0];
        console.log(chalk.yellow('🏆 Top Performer: ' + topBot.emoji + ' ' + topBot.name));
    }
    
    stop() {
        this.running = false;
    }
}

// Main execution
async function main() {
    const orchestrator = new BotOrchestrator();
    
    try {
        await orchestrator.initialize();
        
        // Display bot roster
        console.log(chalk.yellow('\n🤖 Bot Roster:'));
        for (const bot of orchestrator.bots) {
            console.log(`  ${bot.emoji} ${bot.name} - ${bot.strategy} strategy`);
        }
        
        // Run simulation
        await orchestrator.run(20);
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error:'), error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Shutting down...'));
    process.exit(0);
});

// Run orchestrator
main().catch(console.error);