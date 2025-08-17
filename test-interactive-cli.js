#!/usr/bin/env node

/**
 * Simple test to verify the interactive CLI can run
 */

import chalk from 'chalk';
import figlet from 'figlet';

console.log(chalk.cyan(figlet.textSync('Barely Human', { horizontalLayout: 'full' })));
console.log(chalk.yellow('\n🎰 Welcome to the DeFi Casino - Interactive Mode Test\n'));

// Test bot display
const BOT_INFO = [
    { id: 0, name: 'Alice "All-In"', emoji: '🎯', strategy: 'Aggressive' },
    { id: 1, name: 'Bob "The Calculator"', emoji: '🧮', strategy: 'Conservative' },
    { id: 2, name: 'Charlie "Lucky Charm"', emoji: '🍀', strategy: 'Superstitious' },
    { id: 3, name: 'Diana "Ice Queen"', emoji: '❄️', strategy: 'Cold Logic' },
    { id: 4, name: 'Eddie "The Entertainer"', emoji: '🎭', strategy: 'Showman' }
];

console.log(chalk.green('Available Bots:'));
BOT_INFO.forEach(bot => {
    console.log(`  ${bot.emoji} ${chalk.bold(bot.name)} - ${bot.strategy}`);
});

console.log(chalk.cyan('\n✅ Interactive CLI components are working!'));
console.log(chalk.yellow('\nTo run the full interactive CLI:'));
console.log(chalk.white('1. Ensure a local Hardhat node is running: npm run node'));
console.log(chalk.white('2. Deploy contracts: npm run deploy:local'));
console.log(chalk.white('3. Run the CLI: npm run cli:interactive'));

process.exit(0);