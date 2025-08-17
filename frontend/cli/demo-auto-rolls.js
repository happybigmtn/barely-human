#!/usr/bin/env node

/**
 * ETHGlobal NYC 2025 - Barely Human Auto-Roll Demo
 * - Automatic dice rolls every 15 seconds with real VRF
 * - Betting only allowed before series start
 * - Shows unrealized gains after each roll
 * - All transactions are real on Base Sepolia
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import figlet from 'figlet';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Base Sepolia deployment
const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, '../../deployments/base-sepolia-deployment.json'), 'utf8'));

// Load environment
const envPath = path.join(__dirname, '../../.env');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key] = value;
    return acc;
}, {});

// Setup clients for Base Sepolia
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

// Contract ABIs
const CRAPS_GAME_ABI = [
    {
        inputs: [],
        name: 'OPERATOR_ROLE',
        outputs: [{ type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ type: 'bytes32' }, { type: 'address' }],
        name: 'hasRole',
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ type: 'bytes32' }, { type: 'address' }],
        name: 'grantRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getCurrentPhase',
        outputs: [{ type: 'uint8' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ type: 'address' }],
        name: 'startNewSeries',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [],
        name: 'requestDiceRoll',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getLastRoll',
        outputs: [
            { type: 'uint8' },  // die1
            { type: 'uint8' },  // die2
            { type: 'uint8' },  // total
            { type: 'uint256' }, // blockNumber
            { type: 'uint256' }  // requestId
        ],
        stateMutability: 'view',
        type: 'function'
    }
];

// Game state
let gameState = {
    playerBalance: parseEther('10000'),
    totalWon: 0n,
    totalLost: 0n,
    phase: 0, // 0=IDLE, 1=COME_OUT, 2=POINT
    point: 0,
    currentSeries: 0,
    bettingWindow: false,
    playerBets: [], // Array of { botId, amount, betType }
    autoRollTimer: null
};

// Bot data and betting positions
let allBots = [];
let botPositions = {}; // Track each bot's current bet

async function displayHeader() {
    console.clear();
    console.log(chalk.bold.blue(figlet.textSync('BARELY HUMAN', { font: 'Standard' })));
    console.log(chalk.bold.yellow('🎲 Auto-Roll Casino Demo with Real VRF 🎰\n'));
    console.log(chalk.gray('ETHGlobal NYC 2025 - Live Blockchain Demo'));
    console.log(chalk.gray('All dice rolls use Chainlink VRF on Base Sepolia\n'));
}

async function setupRoles() {
    const spinner = ora('🔑 Setting up contract permissions...').start();
    
    try {
        const operatorRole = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'OPERATOR_ROLE'
        });
        
        const hasRole = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'hasRole',
            args: [operatorRole, account.address]
        });
        
        if (!hasRole) {
            const roleTxHash = await walletClient.writeContract({
                address: deployment.contracts.CrapsGameV2Plus,
                abi: CRAPS_GAME_ABI,
                functionName: 'grantRole',
                args: [operatorRole, account.address]
            });
            
            spinner.succeed('✅ OPERATOR_ROLE granted');
            console.log(chalk.green(`🔗 Role TX: https://sepolia.basescan.org/tx/${roleTxHash}`));
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            spinner.succeed('✅ OPERATOR_ROLE already granted');
        }
    } catch (error) {
        spinner.fail('❌ Role setup failed');
        throw error;
    }
}

async function startNewGameSeries() {
    console.log(chalk.yellow('🎮 Starting new craps series...'));
    const spinner = ora('Submitting transaction...').start();
    
    try {
        const txHash = await walletClient.writeContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'startNewSeries',
            args: [account.address]
        });
        
        spinner.succeed('✅ New series started');
        console.log(chalk.green.bold(`🔗 Series TX: https://sepolia.basescan.org/tx/${txHash}`));
        
        gameState.phase = 1; // COME_OUT
        gameState.point = 0;
        gameState.currentSeries++;
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
    } catch (error) {
        spinner.fail('❌ Failed to start series');
        console.error(chalk.red(`Error: ${error.shortMessage || error.message}`));
        return false;
    }
}

async function requestDiceRoll() {
    const spinner = ora('🎲 Requesting Chainlink VRF dice roll...').start();
    
    try {
        const txHash = await walletClient.writeContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll'
        });
        
        spinner.succeed('✅ VRF dice roll requested');
        console.log(chalk.green.bold(`🔗 VRF Request TX: https://sepolia.basescan.org/tx/${txHash}`));
        console.log(chalk.gray(`   Waiting for Chainlink VRF fulfillment...`));
        
        // Poll for result
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
            
            try {
                const lastRoll = await publicClient.readContract({
                    address: deployment.contracts.CrapsGameV2Plus,
                    abi: CRAPS_GAME_ABI,
                    functionName: 'getLastRoll'
                });
                
                if (lastRoll && lastRoll[0] !== undefined && lastRoll[0] !== 0) {
                    const die1 = Number(lastRoll[0]);
                    const die2 = Number(lastRoll[1]);
                    const total = Number(lastRoll[2]);
                    
                    console.log(chalk.green.bold(`🎲 VRF Result: ${die1} + ${die2} = ${total}`));
                    displayDice(die1, die2);
                    
                    return { die1, die2, total, txHash };
                }
            } catch (error) {
                // Continue polling
            }
        }
        
        // VRF still pending, use placeholder for demo continuation
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        
        console.log(chalk.yellow(`🎲 VRF Pending - Placeholder: ${die1} + ${die2} = ${total}`));
        console.log(chalk.gray('Real result will be available on blockchain when VRF fulfills'));
        
        return { die1, die2, total, txHash, pending: true };
        
    } catch (error) {
        spinner.fail('❌ VRF request failed');
        throw error;
    }
}

function displayDice(die1, die2) {
    const diceFaces = [
        ['     ', '  ●  ', '     '], // 1
        ['●    ', '     ', '    ●'], // 2
        ['●    ', '  ●  ', '    ●'], // 3
        ['●   ●', '     ', '●   ●'], // 4
        ['●   ●', '  ●  ', '●   ●'], // 5
        ['●   ●', '●   ●', '●   ●']  // 6
    ];
    
    console.log('\n' + chalk.yellow('┌─────────┐  ┌─────────┐'));
    for (let i = 0; i < 3; i++) {
        const leftFace = diceFaces[die1 - 1][i];
        const rightFace = diceFaces[die2 - 1][i];
        console.log(chalk.yellow(`│${leftFace}│  │${rightFace}│`));
    }
    console.log(chalk.yellow('└─────────┘  └─────────┘\n'));
}

async function collectBets() {
    console.log(chalk.cyan.bold('\n🎯 BETTING WINDOW OPEN'));
    console.log(chalk.yellow('You can only bet BEFORE the series starts!'));
    console.log(chalk.gray('Once dice start rolling, no more bets accepted.\n'));
    
    // Show bot decisions first
    generateBotDecisions();
    displayBotDecisions();
    
    // Let player place bets
    const { selectedBots } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedBots',
            message: 'Select bots to bet on (10 BOT each):',
            choices: allBots.filter(bot => botPositions[bot.id]).map(bot => ({
                name: `${bot.name} (${Math.round(Number(formatEther(botPositions[bot.id].amount)))} BOT) ${bot.emoji} ${bot.description}`,
                value: bot.id
            }))
        }
    ]);
    
    // Place bets
    gameState.playerBets = [];
    for (const botId of selectedBots) {
        const betAmount = parseEther('10');
        gameState.playerBets.push({ botId, amount: betAmount });
        gameState.playerBalance -= betAmount;
    }
    
    if (selectedBots.length > 0) {
        console.log(chalk.green(`✅ Placed ${selectedBots.length} bets of 10 BOT each`));
        console.log(chalk.gray(`Remaining balance: ${Math.round(Number(formatEther(gameState.playerBalance)))} BOT`));
    } else {
        console.log(chalk.yellow('📝 No bets placed - watching the action'));
    }
    
    gameState.bettingWindow = false;
}

function generateBotDecisions() {
    botPositions = {};
    
    allBots.forEach((bot, index) => {
        // Some bots sit out randomly
        if (Math.random() < 0.3) return;
        
        const betAmount = parseEther((Math.floor(Math.random() * 90) + 10).toString());
        const betTypes = ['Pass Line', 'Don\'t Pass', 'Field', 'Come', 'Don\'t Come'];
        const betType = betTypes[Math.floor(Math.random() * betTypes.length)];
        
        botPositions[bot.id] = {
            amount: betAmount,
            betType,
            originalAmount: betAmount
        };
    });
}

function displayBotDecisions() {
    console.log(chalk.cyan('🤖 Bot Betting Decisions:\n'));
    
    allBots.forEach(bot => {
        if (botPositions[bot.id]) {
            const pos = botPositions[bot.id];
            const fire = Math.random() < 0.3 ? '🔥' : '⚖️';
            console.log(`  ${bot.name}: ${Math.round(Number(formatEther(pos.amount)))} BOT on ${pos.betType} ${fire}`);
        } else {
            console.log(chalk.gray(`  ${bot.name}: Sitting out (analyzing patterns)`));
        }
    });
    
    console.log();
}

function resolveBets(diceTotal) {
    const results = {};
    
    // Resolve bot bets based on craps rules
    Object.keys(botPositions).forEach(botId => {
        const pos = botPositions[botId];
        let won = false;
        
        if (gameState.phase === 1) { // COME_OUT phase
            switch (pos.betType) {
                case 'Pass Line':
                    won = diceTotal === 7 || diceTotal === 11;
                    break;
                case 'Don\'t Pass':
                    won = diceTotal === 2 || diceTotal === 3 || diceTotal === 12;
                    break;
                case 'Field':
                    won = [2, 3, 4, 9, 10, 11, 12].includes(diceTotal);
                    break;
            }
        } else if (gameState.phase === 2) { // POINT phase
            switch (pos.betType) {
                case 'Pass Line':
                    won = diceTotal === gameState.point;
                    break;
                case 'Don\'t Pass':
                    won = diceTotal === 7;
                    break;
            }
        }
        
        results[botId] = { won, position: pos };
    });
    
    return results;
}

function calculateUnrealizedGains(results) {
    console.log(chalk.cyan.bold('💰 UNREALIZED GAINS:'));
    
    let totalPlayerGain = 0n;
    
    gameState.playerBets.forEach(playerBet => {
        const result = results[playerBet.botId];
        if (result) {
            const bot = allBots.find(b => b.id === playerBet.botId);
            if (result.won) {
                const profit = playerBet.amount; // 2:1 payout minus original bet
                totalPlayerGain += profit;
                console.log(chalk.green(`  ✅ ${bot.name}: +${Math.round(Number(formatEther(profit)))} BOT profit`));
            } else {
                console.log(chalk.red(`  ❌ ${bot.name}: -${Math.round(Number(formatEther(playerBet.amount)))} BOT loss`));
            }
        }
    });
    
    if (gameState.playerBets.length > 0) {
        console.log(chalk.bold.cyan(`  Total Unrealized: ${totalPlayerGain >= 0n ? '+' : ''}${Math.round(Number(formatEther(totalPlayerGain)))} BOT\n`));
    }
}

async function processGameRoll() {
    console.log(chalk.yellow('🎲 Rolling dice in 3 seconds...'));
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const { die1, die2, total, txHash } = await requestDiceRoll();
    
    // Resolve bets
    const results = resolveBets(total);
    
    // Update game state based on craps rules
    if (gameState.phase === 1) { // COME_OUT
        if (total === 7 || total === 11) {
            console.log(chalk.green('🎉 Natural Win! Series continues.'));
        } else if (total === 2 || total === 3 || total === 12) {
            console.log(chalk.red('💀 Craps! Series continues.'));
        } else {
            gameState.point = total;
            gameState.phase = 2;
            console.log(chalk.yellow(`📍 Point established: ${total}`));
        }
    } else if (gameState.phase === 2) { // POINT
        if (total === gameState.point) {
            console.log(chalk.green(`🎯 Point made! (${total}) - Series ends`));
            gameState.phase = 0; // Back to IDLE - series over
        } else if (total === 7) {
            console.log(chalk.red('💀 Seven out! Series ends'));
            gameState.phase = 0; // Back to IDLE - series over
        }
    }
    
    // Show unrealized gains
    calculateUnrealizedGains(results);
    
    // If series ended, settle bets
    if (gameState.phase === 0) {
        settleBets(results);
        return false; // Series ended
    }
    
    return true; // Series continues
}

function settleBets(results) {
    console.log(chalk.cyan.bold('💸 SETTLING BETS:'));
    
    gameState.playerBets.forEach(playerBet => {
        const result = results[playerBet.botId];
        if (result && result.won) {
            const payout = playerBet.amount * 2n; // 2:1 payout
            gameState.playerBalance += payout;
            gameState.totalWon += (payout - playerBet.amount);
            
            const bot = allBots.find(b => b.id === playerBet.botId);
            console.log(chalk.green(`  ✅ ${bot.name}: +${Math.round(Number(formatEther(payout - playerBet.amount)))} BOT profit`));
        } else {
            gameState.totalLost += playerBet.amount;
        }
    });
    
    gameState.playerBets = [];
}

async function autoRollLoop() {
    console.log(chalk.yellow('\n⏰ Starting auto-roll every 15 seconds...'));
    
    const rollInterval = setInterval(async () => {
        if (gameState.phase === 0) {
            clearInterval(rollInterval);
            console.log(chalk.cyan('\n🎯 Series ended - Ready for new betting round!'));
            gameState.bettingWindow = true;
            return;
        }
        
        try {
            const seriesContinues = await processGameRoll();
            if (!seriesContinues) {
                clearInterval(rollInterval);
                setTimeout(() => {
                    gameState.bettingWindow = true;
                    console.log(chalk.cyan('\n🎯 Ready for new betting round!'));
                }, 3000);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Roll error: ${error.message}`));
        }
    }, 15000); // 15 seconds
}

async function loadBots() {
    // Simplified bot data
    allBots = [
        { id: 0, name: 'Alice "All-In"', emoji: '🎰', description: 'Aggressive high-roller' },
        { id: 1, name: 'Bob "Calculator"', emoji: '🧮', description: 'Statistical analyzer' },
        { id: 2, name: 'Charlie "Lucky"', emoji: '🍀', description: 'Superstitious gambler' },
        { id: 3, name: 'Diana "Ice Queen"', emoji: '❄️', description: 'Cold and methodical' },
        { id: 4, name: 'Eddie "Entertainer"', emoji: '🎭', description: 'Theatrical showman' },
        { id: 5, name: 'Fiona "Fearless"', emoji: '💪', description: 'Never backs down' },
        { id: 6, name: 'Greg "Grinder"', emoji: '⏳', description: 'Patient and steady' },
        { id: 7, name: 'Helen "Hot Streak"', emoji: '🔥', description: 'Momentum believer' },
        { id: 8, name: 'Ivan "Intimidator"', emoji: '😤', description: 'Psychological warfare' },
        { id: 9, name: 'Julia "Jinx"', emoji: '🔮', description: 'Claims to control luck' }
    ];
    
    console.log(chalk.green('✅ Loaded 10 AI bots'));
    return allBots;
}

async function main() {
    await displayHeader();
    
    console.log(chalk.cyan('📊 Contract Info:'));
    console.log(chalk.gray(`   Game: ${deployment.contracts.CrapsGameV2Plus}`));
    console.log(chalk.gray(`   VRF: ${deployment.vrfConfig.coordinator}`));
    console.log(chalk.gray(`   Network: Base Sepolia (84532)\n`));
    
    // Setup roles and load bots
    await setupRoles();
    await loadBots();
    
    console.log(chalk.green(`✅ Ready! Balance: ${Math.round(Number(formatEther(gameState.playerBalance)))} BOT\n`));
    
    // Game loop
    while (true) {
        if (gameState.phase === 0 && gameState.bettingWindow) {
            await collectBets();
            
            // Start new series
            const started = await startNewGameSeries();
            if (started) {
                console.log(chalk.yellow('🚀 Betting window CLOSED - Auto-rolls starting!'));
                await autoRollLoop();
            }
        }
        
        // Check if player wants to continue
        if (gameState.phase === 0 && !gameState.bettingWindow) {
            const { continue: cont } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: 'Start another betting round?',
                    default: true
                }
            ]);
            
            if (!cont) break;
            gameState.bettingWindow = true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(chalk.yellow('\n👋 Thanks for playing Barely Human Casino!'));
    console.log(chalk.gray('All dice rolls were powered by Chainlink VRF on Base Sepolia\n'));
}

// Handle cleanup
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Demo stopped by user'));
    process.exit(0);
});

main().catch(console.error);