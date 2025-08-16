#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import ora from 'ora';
import { config } from 'dotenv';
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Commands
import { playGame } from './commands/play.js';
import { viewStats } from './commands/stats.js';
import { manageBots } from './commands/bots.js';
import { stakingMenu } from './commands/staking.js';
import { vaultMenu } from './commands/vault.js';

// Load environment
config();

// ASCII Art Banner
const showBanner = () => {
    console.clear();
    console.log(
        chalk.cyan(
            figlet.textSync('BARELY HUMAN', {
                font: 'ANSI Shadow',
                horizontalLayout: 'default',
                verticalLayout: 'default',
            })
        )
    );
    console.log(chalk.yellow('🎲 DeFi Casino with AI Bot Gamblers 🤖\n'));
};

// Initialize clients
const initializeClients = () => {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error(chalk.red('❌ PRIVATE_KEY not found in environment'));
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey);
    
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    });

    return { publicClient, walletClient, account };
};

// Main Menu
const mainMenu = async () => {
    const { publicClient, walletClient, account } = initializeClients();
    
    // Display wallet info
    console.log(chalk.blue('Connected Wallet:'), account.address);
    
    try {
        const balance = await publicClient.getBalance({ address: account.address });
        console.log(chalk.green('ETH Balance:'), formatEther(balance), 'ETH\n');
    } catch (error) {
        console.log(chalk.yellow('⚠️  Could not fetch balance (offline mode)\n'));
    }

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '🎲 Play Craps', value: 'play' },
                { name: '🤖 Manage Bot Personalities', value: 'bots' },
                { name: '💰 Vault Management', value: 'vault' },
                { name: '🪙 BOT Staking', value: 'staking' },
                { name: '📊 View Statistics', value: 'stats' },
                { name: '🎁 Check NFT Raffles', value: 'nft' },
                { name: '⚙️  Settings', value: 'settings' },
                { name: '❌ Exit', value: 'exit' }
            ]
        }
    ]);

    switch (action) {
        case 'play':
            await playGame(publicClient, walletClient, account);
            break;
        case 'bots':
            await manageBots(publicClient, walletClient, account);
            break;
        case 'vault':
            await vaultMenu(publicClient, walletClient, account);
            break;
        case 'staking':
            await stakingMenu(publicClient, walletClient, account);
            break;
        case 'stats':
            await viewStats(publicClient, account);
            break;
        case 'nft':
            await checkNFTRaffles(publicClient, account);
            break;
        case 'settings':
            await settings();
            break;
        case 'exit':
            console.log(chalk.cyan('\n👋 Thanks for playing Barely Human!\n'));
            process.exit(0);
    }

    // Return to main menu
    await mainMenu();
};

// NFT Raffle Check
const checkNFTRaffles = async (publicClient, account) => {
    const spinner = ora('Checking raffle status...').start();
    
    // Simulate checking
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.succeed('Raffle checked!');
    
    console.log(chalk.yellow('\n📋 Current Raffle Status:'));
    console.log('Series #42 - In Progress');
    console.log('Your entries: 3');
    console.log('Total entries: 127');
    console.log('Your chance: 2.36%\n');
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Options:',
            choices: [
                'View My Mint Passes',
                'Redeem Mint Pass',
                'Back to Main Menu'
            ]
        }
    ]);
    
    if (action === 'View My Mint Passes') {
        console.log(chalk.green('\n🎟️  Your Mint Passes:'));
        console.log('1. Series #38 - Epic (Bot: Alice All-In)');
        console.log('2. Series #25 - Rare (Bot: Greg Grinder)\n');
    }
    
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
};

// Settings Menu
const settings = async () => {
    console.log(chalk.blue('\n⚙️  Settings\n'));
    
    const { setting } = await inquirer.prompt([
        {
            type: 'list',
            name: 'setting',
            message: 'Select setting to configure:',
            choices: [
                'Change Network',
                'Update Contract Addresses',
                'Export Private Key Warning',
                'Clear Cache',
                'Back to Main Menu'
            ]
        }
    ]);
    
    if (setting === 'Change Network') {
        const { network } = await inquirer.prompt([
            {
                type: 'list',
                name: 'network',
                message: 'Select network:',
                choices: ['Base Sepolia (Testnet)', 'Base (Mainnet)', 'Local Development']
            }
        ]);
        console.log(chalk.green(`✅ Network changed to ${network}`));
    }
    
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
};

// Program entry point
const program = new Command();

program
    .name('barely-human')
    .description('CLI for Barely Human DeFi Casino')
    .version('1.0.0')
    .action(async () => {
        showBanner();
        await mainMenu();
    });

// Direct run command
program
    .command('play')
    .description('Jump straight into a game')
    .action(async () => {
        showBanner();
        const { publicClient, walletClient, account } = initializeClients();
        await playGame(publicClient, walletClient, account);
    });

program
    .command('stats')
    .description('View your statistics')
    .action(async () => {
        showBanner();
        const { publicClient, walletClient, account } = initializeClients();
        await viewStats(publicClient, account);
    });

program.parse(process.argv);

// If no command provided, show interactive menu
if (!process.argv.slice(2).length) {
    showBanner();
    mainMenu();
}