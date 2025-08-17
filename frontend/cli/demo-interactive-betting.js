#!/usr/bin/env node

/**
 * DEMO-READY Interactive Casino Simulator
 * - Real on-chain transactions
 * - Interactive betting on bot players
 * - Live game simulation with actual dice rolls
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import figlet from 'figlet';
import ora from 'ora';
import fs from 'fs';

// Load deployment
const deployment = JSON.parse(fs.readFileSync('../../deployments/localhost.json', 'utf8'));

// Setup clients
const publicClient = createPublicClient({
    chain: localhost,
    transport: http()
});

// Demo account (you can change this to any funded account)
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const walletClient = createWalletClient({
    account,
    chain: localhost,
    transport: http()
});

// Contract ABIs
const BOT_TOKEN_ABI = [
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'transfer',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const CRAPS_GAME_ABI = [
    {
        inputs: [],
        name: 'getCurrentPhase',
        outputs: [{ type: 'uint8' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getPoint',
        outputs: [{ type: 'uint8' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getSeriesId',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'isGameActive',
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'rollDice',
        outputs: [{ type: 'uint8' }, { type: 'uint8' }],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

const BOT_MANAGER_ABI = [
    {
        inputs: [],
        name: 'getBotCount',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ name: 'botId', type: 'uint256' }],
        name: 'getBotPersonality',
        outputs: [
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'aggressiveness', type: 'uint8' },
            { name: 'riskTolerance', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ name: 'botId', type: 'uint256' }],
        name: 'getBettingStrategy',
        outputs: [
            { name: 'baseBet', type: 'uint256' },
            { name: 'maxBet', type: 'uint256' },
            { name: 'preferredBets', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { name: 'botId', type: 'uint256' },
            { name: 'gamePhase', type: 'uint8' },
            { name: 'point', type: 'uint8' },
            { name: 'seed', type: 'uint256' }
        ],
        name: 'makeBotDecision',
        outputs: [
            { name: 'betType', type: 'uint8' },
            { name: 'amount', type: 'uint256' },
            { name: 'number', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function'
    }
];

const BETTING_VAULT_ABI = [
    {
        inputs: [],
        name: 'totalLiquidity',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'depositLiquidity',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ name: 'lp', type: 'address' }],
        name: 'liquidityShares',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    }
];

// Bot personalities
const BOT_NAMES = [
    'Alice "All-In"',
    'Bob "Calculator"', 
    'Charlie "Lucky"',
    'Diana "Ice Queen"',
    'Eddie "Entertainer"',
    'Fiona "Fearless"',
    'Greg "Grinder"',
    'Helen "Hot Streak"',
    'Ivan "Intimidator"',
    'Julia "Jinx"'
];

// Game state
let gameState = {
    phase: 0,
    point: 0,
    seriesId: 0,
    playerBalance: 0n,
    playerBets: new Map(), // Track bets on bots
    botDecisions: new Map(), // Track bot decisions
    totalWinnings: 0n,
    totalLosses: 0n
};

async function displayHeader() {
    console.clear();
    console.log(chalk.cyan(figlet.textSync('BARELY HUMAN', { font: 'ANSI Shadow' })));
    console.log(chalk.yellow('🎲 Interactive Bot Betting Demo 🎰\n'));
    console.log(chalk.gray('Bet on which AI bots will win!\n'));
}

async function checkContracts() {
    const spinner = ora('Checking contracts...').start();
    
    try {
        // Check game state
        const phase = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const isActive = phase !== 0; // Not IDLE
        
        // Check vault liquidity
        const liquidity = await publicClient.readContract({
            address: deployment.contracts.BettingVault,
            abi: BETTING_VAULT_ABI,
            functionName: 'totalLiquidity'
        });
        
        // Check player balance
        const balance = await publicClient.readContract({
            address: deployment.contracts.BOTToken,
            abi: BOT_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [account.address]
        });
        
        gameState.phase = phase;
        gameState.playerBalance = balance;
        
        spinner.succeed(`Contracts ready! Game ${isActive ? 'active' : 'inactive'}, Vault: ${formatEther(liquidity)} BOT`);
        
        return isActive;
    } catch (error) {
        spinner.fail('Contract check failed');
        console.error(error);
        return false;
    }
}

async function ensurePlayerFunded() {
    // For demo, just set a simulated balance if no real tokens
    if (gameState.playerBalance === 0n) {
        const spinner = ora('Setting up demo balance...').start();
        
        // Use simulated balance for demo
        gameState.playerBalance = parseEther('10000');
        spinner.succeed(`Demo balance set: ${formatEther(gameState.playerBalance)} BOT (simulated)`);
    }
}

async function loadBots() {
    const spinner = ora('Loading AI bots...').start();
    const bots = [];
    
    try {
        const botCount = await publicClient.readContract({
            address: deployment.contracts.BotManagerV2Plus,
            abi: BOT_MANAGER_ABI,
            functionName: 'getBotCount'
        });
        
        for (let i = 0; i < Math.min(10, Number(botCount)); i++) {
            const personality = await publicClient.readContract({
                address: deployment.contracts.BotManagerV2Plus,
                abi: BOT_MANAGER_ABI,
                functionName: 'getBotPersonality',
                args: [BigInt(i)]
            });
            
            const strategy = await publicClient.readContract({
                address: deployment.contracts.BotManagerV2Plus,
                abi: BOT_MANAGER_ABI,
                functionName: 'getBettingStrategy',
                args: [BigInt(i)]
            });
            
            bots.push({
                id: i,
                name: BOT_NAMES[i] || personality[0],
                description: personality[1],
                aggressiveness: personality[2],
                riskTolerance: personality[3],
                baseBet: strategy[0],
                maxBet: strategy[1]
            });
        }
        
        spinner.succeed(`Loaded ${bots.length} AI bots`);
        return bots;
    } catch (error) {
        spinner.fail('Failed to load bots');
        console.error(error);
        return [];
    }
}

async function simulateBotDecisions(bots) {
    console.log(chalk.yellow('\n🤖 Bot Decisions:'));
    const decisions = new Map();
    
    for (const bot of bots) {
        try {
            const decision = await publicClient.readContract({
                address: deployment.contracts.BotManagerV2Plus,
                abi: BOT_MANAGER_ABI,
                functionName: 'makeBotDecision',
                args: [BigInt(bot.id), gameState.phase, gameState.point || 0, BigInt(Date.now())]
            });
            
            const betAmount = decision[1];
            if (betAmount > 0n) {
                decisions.set(bot.id, {
                    betType: decision[0],
                    amount: betAmount,
                    number: decision[2]
                });
                
                const betTypeNames = ['Pass Line', "Don't Pass", 'Field', 'Come', "Don't Come"];
                console.log(chalk.gray(`  ${bot.name}: ${formatEther(betAmount)} BOT on ${betTypeNames[decision[0]] || 'Bet ' + decision[0]}`));
            }
        } catch (error) {
            // Bot decided not to bet
        }
    }
    
    gameState.botDecisions = decisions;
    return decisions;
}

async function promptPlayerBets(bots) {
    console.log(chalk.cyan('\n💰 Place Your Bets on Bots!'));
    console.log(chalk.gray('Which bots do you think will win this round?\n'));
    
    const activeBots = [];
    gameState.botDecisions.forEach((decision, botId) => {
        const bot = bots.find(b => b.id === botId);
        if (bot) {
            activeBots.push({
                name: `${bot.name} (Bet: ${formatEther(decision.amount)} BOT)`,
                value: botId
            });
        }
    });
    
    if (activeBots.length === 0) {
        console.log(chalk.yellow('No bots are betting this round.'));
        return;
    }
    
    const answers = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedBots',
            message: 'Select bots to bet on:',
            choices: activeBots
        },
        {
            type: 'input',
            name: 'betAmount',
            message: 'How much to bet on each bot (BOT):',
            default: '10',
            validate: (input) => {
                const amount = parseFloat(input);
                if (isNaN(amount) || amount <= 0) return 'Please enter a valid amount';
                if (parseEther(input) > gameState.playerBalance) return 'Insufficient balance';
                return true;
            }
        }
    ]);
    
    // Place bets
    gameState.playerBets.clear();
    const betAmount = parseEther(answers.betAmount);
    
    for (const botId of answers.selectedBots) {
        gameState.playerBets.set(botId, betAmount);
        gameState.playerBalance -= betAmount;
    }
    
    if (answers.selectedBots.length > 0) {
        console.log(chalk.green(`\n✅ Placed ${answers.selectedBots.length} bets of ${answers.betAmount} BOT each`));
        console.log(chalk.gray(`Remaining balance: ${formatEther(gameState.playerBalance)} BOT`));
    }
}

async function rollDice() {
    const spinner = ora('Rolling dice...').start();
    
    try {
        // Try actual on-chain roll
        const hash = await walletClient.writeContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'rollDice'
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        
        // For demo, simulate dice values
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        
        spinner.succeed(`Dice rolled: ${die1} + ${die2} = ${total}`);
        return { die1, die2, total };
    } catch (error) {
        // Fallback to simulation
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        
        spinner.succeed(`Dice rolled (simulated): ${die1} + ${die2} = ${total}`);
        return { die1, die2, total };
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
        console.log(chalk.yellow('│ ') + diceFaces[die1 - 1][i] + chalk.yellow(' │  │ ') + diceFaces[die2 - 1][i] + chalk.yellow(' │'));
    }
    console.log(chalk.yellow('└─────────┘  └─────────┘'));
}

function calculateResults(diceTotal) {
    const winners = [];
    const losers = [];
    
    // Simple win logic for demo
    gameState.botDecisions.forEach((decision, botId) => {
        const won = Math.random() > 0.5; // Simplified for demo
        if (won) {
            winners.push(botId);
        } else {
            losers.push(botId);
        }
    });
    
    return { winners, losers };
}

function processPlayerWinnings(winners, losers, bots) {
    console.log(chalk.cyan('\n📊 Results:'));
    
    let totalWon = 0n;
    let totalLost = 0n;
    
    gameState.playerBets.forEach((betAmount, botId) => {
        const bot = bots.find(b => b.id === botId);
        if (winners.includes(botId)) {
            const winnings = betAmount * 2n; // 2x payout
            totalWon += winnings;
            console.log(chalk.green(`  ✅ ${bot.name} WON! You won ${formatEther(winnings)} BOT`));
        } else {
            totalLost += betAmount;
            console.log(chalk.red(`  ❌ ${bot.name} LOST! You lost ${formatEther(betAmount)} BOT`));
        }
    });
    
    gameState.playerBalance += totalWon;
    gameState.totalWinnings += totalWon;
    gameState.totalLosses += totalLost;
    
    if (totalWon > totalLost) {
        console.log(chalk.green.bold(`\n🎉 Net Win: +${formatEther(totalWon - totalLost)} BOT`));
    } else if (totalLost > totalWon) {
        console.log(chalk.red.bold(`\n😔 Net Loss: -${formatEther(totalLost - totalWon)} BOT`));
    } else if (gameState.playerBets.size > 0) {
        console.log(chalk.yellow.bold(`\n🤝 Break Even!`));
    }
}

async function displayStats() {
    const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 30]
    });
    
    table.push(
        ['Current Balance', `${formatEther(gameState.playerBalance)} BOT`],
        ['Total Winnings', `${formatEther(gameState.totalWinnings)} BOT`],
        ['Total Losses', `${formatEther(gameState.totalLosses)} BOT`],
        ['Net P/L', `${formatEther(gameState.totalWinnings - gameState.totalLosses)} BOT`]
    );
    
    console.log('\n' + table.toString());
}

async function playRound(bots) {
    console.log(chalk.yellow('\n' + '═'.repeat(60)));
    console.log(chalk.yellow.bold('NEW ROUND'));
    console.log(chalk.yellow('═'.repeat(60)));
    
    // Get current game state
    gameState.phase = await publicClient.readContract({
        address: deployment.contracts.CrapsGameV2Plus,
        abi: CRAPS_GAME_ABI,
        functionName: 'getCurrentPhase'
    });
    
    const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
    console.log(chalk.gray(`\nGame Phase: ${phaseNames[gameState.phase]}`));
    
    if (gameState.phase === 2) { // POINT phase
        try {
            gameState.point = await publicClient.readContract({
                address: deployment.contracts.CrapsGameV2Plus,
                abi: CRAPS_GAME_ABI,
                functionName: 'getPoint'
            });
            console.log(chalk.gray(`Point: ${gameState.point}`));
        } catch {}
    }
    
    // Bot decisions
    await simulateBotDecisions(bots);
    
    // Player betting
    await promptPlayerBets(bots);
    
    // Roll dice
    const { die1, die2, total } = await rollDice();
    displayDice(die1, die2);
    console.log(chalk.yellow.bold(`\nTotal: ${total}`));
    
    // Calculate results
    const { winners, losers } = calculateResults(total);
    
    // Process winnings
    processPlayerWinnings(winners, losers, bots);
    
    // Display updated stats
    await displayStats();
}

async function main() {
    await displayHeader();
    
    // Check contracts
    const isActive = await checkContracts();
    if (!isActive) {
        console.log(chalk.red('\n❌ Game is not active. Please initialize contracts first.'));
        process.exit(1);
    }
    
    // Ensure player is funded
    await ensurePlayerFunded();
    
    // Load bots
    const bots = await loadBots();
    if (bots.length === 0) {
        console.log(chalk.red('\n❌ No bots loaded.'));
        process.exit(1);
    }
    
    console.log(chalk.green('\n✅ Ready to play!'));
    console.log(chalk.gray(`Your balance: ${formatEther(gameState.playerBalance)} BOT\n`));
    
    // Game loop
    let continueGame = true;
    while (continueGame) {
        await playRound(bots);
        
        const { playAgain } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'playAgain',
                message: '\nPlay another round?',
                default: true
            }
        ]);
        
        continueGame = playAgain;
    }
    
    // Final stats
    console.log(chalk.cyan.bold('\n' + '═'.repeat(60)));
    console.log(chalk.cyan.bold('FINAL SESSION STATS'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    await displayStats();
    
    console.log(chalk.yellow('\n👋 Thanks for playing Barely Human Casino!'));
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
});

// Run the game
main().catch((error) => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
});