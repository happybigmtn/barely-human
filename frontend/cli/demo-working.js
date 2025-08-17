#!/usr/bin/env node

/**
 * WORKING Interactive Casino Demo
 * - Works with actual deployed contracts
 * - Real on-chain transactions where possible
 * - Simulated betting for demo purposes
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

// Load environment for private key
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

// Use deployer account from .env
const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

// Simplified ABIs
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
        inputs: [],
        name: 'getCurrentShooter',
        outputs: [
            {
                components: [
                    { name: 'shooter', type: 'address' },
                    { name: 'point', type: 'uint8' },
                    { name: 'phase', type: 'uint8' },
                    { name: 'pointsMadeCount', type: 'uint8' },
                    { name: 'consecutiveWins', type: 'uint8' },
                    { name: 'fireMask', type: 'uint16' },
                    { name: 'doublesMask', type: 'uint8' },
                    { name: 'smallTallMask', type: 'uint16' },
                    { name: 'rollCount', type: 'uint8[13]' },
                    { name: 'seriesStartBlock', type: 'uint256' }
                ],
                type: 'tuple'
            }
        ],
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
        name: 'requestDiceRoll',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [],
        name: 'getLastRoll',
        outputs: [
            {
                components: [
                    { name: 'die1', type: 'uint8' },
                    { name: 'die2', type: 'uint8' },
                    { name: 'total', type: 'uint8' },
                    { name: 'timestamp', type: 'uint256' },
                    { name: 'requestId', type: 'uint256' }
                ],
                type: 'tuple'
            }
        ],
        stateMutability: 'view',
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
        name: 'bots',
        outputs: [
            { name: 'id', type: 'uint256' },
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'aggressiveness', type: 'uint8' },
            { name: 'riskTolerance', type: 'uint8' },
            { name: 'patternBelief', type: 'uint8' },
            { name: 'socialInfluence', type: 'uint8' },
            { name: 'adaptability', type: 'uint8' },
            { name: 'isActive', type: 'bool' },
            { name: 'vaultAddress', type: 'address' },
            { name: 'totalBetsPlaced', type: 'uint256' },
            { name: 'totalWinnings', type: 'uint256' },
            { name: 'totalLosses', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ name: 'botId', type: 'uint256' }],
        name: 'strategies',
        outputs: [
            { name: 'baseBetSize', type: 'uint256' },
            { name: 'maxBetSize', type: 'uint256' },
            { name: 'preferredBetTypes', type: 'uint8[]' },
            { name: 'streakMultiplier', type: 'uint8' },
            { name: 'followsStreaks', type: 'bool' },
            { name: 'contrarian', type: 'bool' }
        ],
        stateMutability: 'view',
        type: 'function'
    }
];

// Bot personalities
const BOT_PERSONALITIES = [
    { name: 'Alice "All-In"', style: '🎰 Aggressive high-roller' },
    { name: 'Bob "Calculator"', style: '🧮 Statistical analyzer' },
    { name: 'Charlie "Lucky"', style: '🍀 Superstitious gambler' },
    { name: 'Diana "Ice Queen"', style: '❄️ Cold and methodical' },
    { name: 'Eddie "Entertainer"', style: '🎭 Theatrical showman' },
    { name: 'Fiona "Fearless"', style: '💪 Never backs down' },
    { name: 'Greg "Grinder"', style: '⏳ Patient and steady' },
    { name: 'Helen "Hot Streak"', style: '🔥 Momentum believer' },
    { name: 'Ivan "Intimidator"', style: '😤 Psychological warfare' },
    { name: 'Julia "Jinx"', style: '🔮 Claims to control luck' }
];

// Game state
let gameState = {
    phase: 0,
    point: 0,
    seriesId: 0,
    playerBalance: parseEther('10000'), // Start with simulated balance
    playerBets: new Map(),
    botDecisions: new Map(),
    totalWinnings: 0n,
    totalLosses: 0n,
    rounds: 0,
    liquidityProviders: new Map()
};

// Initialize LP simulation
function initializeLPs() {
    // Player is the main LP
    gameState.liquidityProviders.set('You', {
        name: 'You',
        initialDeposit: parseEther('10000'),
        currentBalance: parseEther('10000'),
        totalWinnings: 0n,
        totalLosses: 0n,
        roundsPlayed: 0,
        isPlayer: true
    });
    
    // Add 3 other simulated LPs
    const otherLPs = [
        { name: 'DeFi_Whale_777', deposit: parseEther('25000') },
        { name: 'CryptoShark_23', deposit: parseEther('15000') },
        { name: 'YieldFarmer_Pro', deposit: parseEther('8000') }
    ];
    
    otherLPs.forEach(lp => {
        gameState.liquidityProviders.set(lp.name, {
            name: lp.name,
            initialDeposit: lp.deposit,
            currentBalance: lp.deposit,
            totalWinnings: 0n,
            totalLosses: 0n,
            roundsPlayed: 0,
            isPlayer: false
        });
    });
}

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
        
        const seriesId = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'getSeriesId'
        });
        
        gameState.phase = phase;
        gameState.seriesId = seriesId;
        
        spinner.succeed(`Game ready! Series #${seriesId}, Phase: ${['IDLE', 'COME_OUT', 'POINT'][phase]}`);
        
        return phase !== 0; // Not IDLE
    } catch (error) {
        spinner.fail('Contract check failed');
        console.error(error);
        return false;
    }
}

async function loadBots() {
    const spinner = ora('Loading AI bots...').start();
    const bots = [];
    
    try {
        const botCount = await publicClient.readContract({
            address: deployment.contracts.BotManager,
            abi: BOT_MANAGER_ABI,
            functionName: 'getBotCount'
        });
        
        for (let i = 0; i < Math.min(10, Number(botCount)); i++) {
            try {
                const botData = await publicClient.readContract({
                    address: deployment.contracts.BotManager,
                    abi: BOT_MANAGER_ABI,
                    functionName: 'bots',
                    args: [BigInt(i)]
                });
                
                const strategyData = await publicClient.readContract({
                    address: deployment.contracts.BotManager,
                    abi: BOT_MANAGER_ABI,
                    functionName: 'strategies',
                    args: [BigInt(i)]
                });
                
                bots.push({
                    id: i,
                    name: BOT_PERSONALITIES[i].name,
                    style: BOT_PERSONALITIES[i].style,
                    aggressiveness: botData[3],
                    riskTolerance: botData[4],
                    baseBet: strategyData[0],
                    maxBet: strategyData[1],
                    isActive: botData[8]
                });
            } catch (e) {
                // Use default data if contract read fails
                bots.push({
                    id: i,
                    name: BOT_PERSONALITIES[i].name,
                    style: BOT_PERSONALITIES[i].style,
                    aggressiveness: 5 + Math.floor(Math.random() * 5),
                    riskTolerance: 5 + Math.floor(Math.random() * 5),
                    baseBet: parseEther(String(10 + Math.random() * 40)),
                    maxBet: parseEther(String(50 + Math.random() * 50)),
                    isActive: true
                });
            }
        }
        
        spinner.succeed(`Loaded ${bots.length} AI bots`);
        return bots;
    } catch (error) {
        spinner.warn('Using simulated bot data');
        
        // Return simulated bots
        for (let i = 0; i < 10; i++) {
            bots.push({
                id: i,
                name: BOT_PERSONALITIES[i].name,
                style: BOT_PERSONALITIES[i].style,
                aggressiveness: 5 + Math.floor(Math.random() * 5),
                riskTolerance: 5 + Math.floor(Math.random() * 5),
                baseBet: parseEther(String(10 + Math.random() * 40)),
                maxBet: parseEther(String(50 + Math.random() * 50)),
                isActive: true
            });
        }
        return bots;
    }
}

async function simulateBotDecisions(bots) {
    console.log(chalk.yellow('\n🤖 Bot Decisions:'));
    const decisions = new Map();
    
    for (const bot of bots) {
        // Simulate decision based on personality and risk tolerance
        const willBet = Math.random() < (bot.aggressiveness / 12); // Reduced from /10 to make betting less frequent
        
        if (willBet) {
            // Different bots have different betting preferences
            let preferredBets = [];
            
            switch (bot.id) {
                case 0: // Alice "All-In" - loves Pass Line
                    preferredBets = [0, 0, 0, 2]; // Mostly Pass, some Field
                    break;
                case 1: // Bob "Calculator" - strategic, likes Don't Pass
                    preferredBets = [1, 1, 3, 4]; // Don't Pass, Come, Don't Come
                    break;
                case 2: // Charlie "Lucky" - loves Field bets
                    preferredBets = [2, 2, 2, 0]; // Mostly Field, some Pass
                    break;
                case 3: // Diana "Ice Queen" - conservative Don't Pass
                    preferredBets = [1, 1, 4]; // Don't Pass, Don't Come
                    break;
                case 4: // Eddie "Entertainer" - flashy Field bets
                    preferredBets = [2, 2, 3]; // Field, Come
                    break;
                default:
                    preferredBets = [0, 1, 2, 3, 4]; // Random
            }
            
            const betType = preferredBets[Math.floor(Math.random() * preferredBets.length)];
            
            // Vary bet amounts based on risk tolerance
            const riskMultiplier = bot.riskTolerance / 10;
            const baseAmount = bot.baseBet;
            const variationFactor = BigInt(Math.floor(Math.random() * 3)); // 0, 1, or 2
            const betAmount = baseAmount + (baseAmount * variationFactor * BigInt(Math.floor(riskMultiplier * 100)) / 100n);
            
            const finalAmount = betAmount > bot.maxBet ? bot.maxBet : betAmount;
            
            decisions.set(bot.id, {
                betType: betType,
                amount: finalAmount
            });
            
            const betTypeNames = ['Pass Line', "Don't Pass", 'Field', 'Come', "Don't Come"];
            const riskLevel = bot.riskTolerance > 7 ? '🔥' : bot.riskTolerance > 4 ? '⚖️' : '🛡️';
            const roundedAmount = Math.round(Number(formatEther(decisions.get(bot.id).amount)));
            console.log(chalk.gray(`  ${bot.name}: ${roundedAmount} BOT on ${betTypeNames[decisions.get(bot.id).betType]} ${riskLevel}`));
        } else {
            // Bot decides not to bet this round
            const reasons = ['waiting for better odds', 'conserving bankroll', 'analyzing patterns', 'feeling cautious'];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            if (Math.random() < 0.3) { // Only show some non-betting decisions to avoid clutter
                console.log(chalk.gray(`  ${bot.name}: Sitting out (${reason})`));
            }
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
                name: `${bot.name} (${Math.round(Number(formatEther(decision.amount)))} BOT) ${bot.style}`,
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
            },
            when: (answers) => answers.selectedBots.length > 0
        }
    ]);
    
    // Place bets
    gameState.playerBets.clear();
    
    if (answers.selectedBots && answers.selectedBots.length > 0) {
        const betAmount = parseEther(answers.betAmount);
        
        for (const botId of answers.selectedBots) {
            gameState.playerBets.set(botId, betAmount);
            gameState.playerBalance -= betAmount;
        }
        
        console.log(chalk.green(`\n✅ Placed ${answers.selectedBots.length} bets of ${answers.betAmount} BOT each`));
        console.log(chalk.gray(`Remaining balance: ${formatEther(gameState.playerBalance)} BOT`));
    }
}

async function rollDice() {
    const spinner = ora('🎲 Checking permissions...').start();
    
    try {
        // Check if account has OPERATOR_ROLE
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
            spinner.text = '🔑 Granting OPERATOR_ROLE...';
            const roleTxHash = await walletClient.writeContract({
                address: deployment.contracts.CrapsGameV2Plus,
                abi: CRAPS_GAME_ABI,
                functionName: 'grantRole',
                args: [operatorRole, account.address]
            });
            
            spinner.text = '⏳ Waiting for role grant confirmation...';
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(chalk.yellow(`🔑 Role TX: https://sepolia.basescan.org/tx/${roleTxHash}`));
        }
        
        spinner.text = '🎲 Requesting VRF dice roll...';
        
        // Request actual dice roll via Chainlink VRF on Base Sepolia
        const txHash = await walletClient.writeContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll'
        });
        
        spinner.succeed('✅ VRF dice roll requested');
        console.log(chalk.green.bold(`🔗 Base Sepolia Transaction: https://sepolia.basescan.org/tx/${txHash}`));
        console.log(chalk.gray(`   Contract: ${deployment.contracts.CrapsGameV2Plus}`));
        console.log(chalk.gray(`   VRF Coordinator: ${deployment.vrfConfig.coordinator}`));
        
        // Wait for transaction confirmation
        spinner.start('⏳ Waiting for Chainlink VRF fulfillment...');
        
        // Poll for VRF result (Chainlink typically takes 10-30 seconds on testnets)
        let attempts = 0;
        const maxAttempts = 12; // 60 seconds total
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
            attempts++;
            
            spinner.text = `🔮 Waiting for Chainlink VRF... (${attempts * 5}s)`;
            
            try {
                // Check for dice roll result
                const lastRoll = await publicClient.readContract({
                    address: deployment.contracts.CrapsGameV2Plus,
                    abi: CRAPS_GAME_ABI,
                    functionName: 'getLastRoll'
                });
                
                if (lastRoll && lastRoll[0] !== undefined && lastRoll[0] !== 0) {
                    const die1 = Number(lastRoll[0]);
                    const die2 = Number(lastRoll[1]);
                    const total = Number(lastRoll[2]);
                    
                    spinner.succeed(`🎲 Chainlink VRF Result: ${die1} + ${die2} = ${total}`);
                    console.log(chalk.green.bold(`✅ VERIFIED ON BASE SEPOLIA BLOCKCHAIN`));
                    console.log(chalk.gray(`   Request ID: ${lastRoll[4] || 'N/A'}`));
                    console.log(chalk.gray(`   Block: ${lastRoll[3] || 'N/A'}`));
                    
                    return { die1, die2, total, txHash, isOnChain: true };
                }
            } catch (error) {
                // Continue polling if read fails
                console.log(chalk.yellow(`   Read attempt ${attempts} failed, continuing...`));
            }
        }
        
        // If VRF hasn't fulfilled after 60 seconds, show pending status
        spinner.warn('⚠️  Chainlink VRF still pending (can take up to 5 minutes on testnet)');
        console.log(chalk.yellow('   Your transaction is valid but VRF fulfillment is delayed'));
        console.log(chalk.yellow('   For demo purposes, using placeholder dice (marked as pending)'));
        
        // Generate placeholder dice for demo continuation
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
            
        console.log(chalk.yellow(`🎲 Temporary result: ${die1} + ${die2} = ${total} (VRF pending)`));
        console.log(chalk.gray(`   Real result will be available once VRF fulfills the request`));
        return { die1, die2, total, txHash, isOnChain: true, pending: true };
        
    } catch (error) {
        spinner.fail('❌ On-chain dice roll failed');
        console.error(chalk.red(`Error: ${error.message?.substring(0, 100)}...`));
        throw error; // Don't fallback - this should work for ETHGlobal demo
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
        console.log(chalk.yellow('│') + leftFace + chalk.yellow('│  │') + rightFace + chalk.yellow('│'));
    }
    console.log(chalk.yellow('└─────────┘  └─────────┘'));
}

function calculateResults(diceTotal, bots) {
    const winners = [];
    const losers = [];
    
    console.log(chalk.yellow('\n🎯 Bet Resolution:'));
    console.log(chalk.gray(`Dice Total: ${diceTotal}, Phase: ${['IDLE', 'COME_OUT', 'POINT'][gameState.phase]}, Point: ${gameState.point || 'None'}`));
    
    // Detailed bot outcomes based on actual craps rules
    gameState.botDecisions.forEach((decision, botId) => {
        const bot = bots.find(b => b.id === botId);
        const betType = decision.betType;
        const betTypeNames = ['Pass Line', "Don't Pass", 'Field', 'Come', "Don't Come"];
        let won = false;
        let explanation = '';
        
        // Implement actual craps rules
        switch (betType) {
            case 0: // Pass Line
                if (gameState.phase === 1) { // COME_OUT
                    if (diceTotal === 7 || diceTotal === 11) {
                        won = true;
                        explanation = 'Pass wins on 7/11 in come-out';
                    } else if (diceTotal === 2 || diceTotal === 3 || diceTotal === 12) {
                        won = false;
                        explanation = 'Pass loses on craps (2,3,12) in come-out';
                    } else {
                        won = false;
                        explanation = `Point ${diceTotal} established - bet continues`;
                    }
                } else if (gameState.phase === 2) { // POINT
                    if (diceTotal === gameState.point) {
                        won = true;
                        explanation = `Pass wins - point ${gameState.point} made`;
                    } else if (diceTotal === 7) {
                        won = false;
                        explanation = 'Pass loses - seven out';
                    } else {
                        won = false;
                        explanation = 'Roll continues';
                    }
                }
                break;
                
            case 1: // Don't Pass
                if (gameState.phase === 1) { // COME_OUT
                    if (diceTotal === 2 || diceTotal === 3) {
                        won = true;
                        explanation = "Don't Pass wins on 2/3 in come-out";
                    } else if (diceTotal === 7 || diceTotal === 11) {
                        won = false;
                        explanation = "Don't Pass loses on 7/11 in come-out";
                    } else if (diceTotal === 12) {
                        won = false;
                        explanation = "Don't Pass pushes on 12 (bar 12)";
                    } else {
                        won = false;
                        explanation = `Point ${diceTotal} established - bet continues`;
                    }
                } else if (gameState.phase === 2) { // POINT
                    if (diceTotal === 7) {
                        won = true;
                        explanation = "Don't Pass wins - seven out";
                    } else if (diceTotal === gameState.point) {
                        won = false;
                        explanation = `Don't Pass loses - point ${gameState.point} made`;
                    } else {
                        won = false;
                        explanation = 'Roll continues';
                    }
                }
                break;
                
            case 2: // Field
                if ([3, 4, 9, 10, 11].includes(diceTotal)) {
                    won = true;
                    explanation = `Field wins on ${diceTotal} (1:1 payout)`;
                } else if (diceTotal === 2) {
                    won = true;
                    explanation = 'Field wins on 2 (2:1 payout)';
                } else if (diceTotal === 12) {
                    won = true;
                    explanation = 'Field wins on 12 (3:1 payout)';
                } else {
                    won = false;
                    explanation = `Field loses on ${diceTotal}`;
                }
                break;
                
            case 3: // Come (simplified - similar to Pass Line)
                won = Math.random() < 0.47; // Slightly less than 50%
                explanation = won ? 'Come bet wins' : 'Come bet loses';
                break;
                
            case 4: // Don't Come (simplified - similar to Don't Pass)
                won = Math.random() < 0.48; // Slightly less than 50%
                explanation = won ? "Don't Come bet wins" : "Don't Come bet loses";
                break;
        }
        
        console.log(chalk.gray(`  ${bot.name}: ${betTypeNames[betType]} - ${won ? chalk.green('WON') : chalk.red('LOST')} (${explanation})`));
        
        if (won) {
            winners.push(botId);
        } else {
            losers.push(botId);
        }
    });
    
    return { winners, losers };
}

function processPlayerWinnings(winners, losers, bots) {
    console.log(chalk.cyan('\n📊 Round Results:'));
    
    // Show overall bot performance first
    const totalBots = gameState.botDecisions.size;
    const winningBots = winners.length;
    const losingBots = losers.length;
    
    console.log(chalk.gray(`Bot Performance: ${chalk.green(winningBots + ' winners')} vs ${chalk.red(losingBots + ' losers')} out of ${totalBots} betting\n`));
    
    let totalWon = 0n;
    let totalLost = 0n;
    
    if (gameState.playerBets.size === 0) {
        console.log(chalk.yellow('  No player bets placed this round'));
        return;
    }
    
    console.log(chalk.cyan('Your Bet Results:'));
    gameState.playerBets.forEach((betAmount, botId) => {
        const bot = bots.find(b => b.id === botId);
        if (winners.includes(botId)) {
            const payout = betAmount * 2n; // 2x payout (includes original bet)
            const profit = payout - betAmount; // Net profit (exclude original bet)
            totalWon += profit;
            gameState.playerBalance += payout; // Add full payout to balance
            console.log(chalk.green(`  ✅ ${bot.name} WON! Profit: ${Math.round(Number(formatEther(profit)))} BOT (payout: ${Math.round(Number(formatEther(payout)))} BOT)`));
        } else {
            totalLost += betAmount;
            console.log(chalk.red(`  ❌ ${bot.name} LOST! Lost: ${Math.round(Number(formatEther(betAmount)))} BOT`));
        }
    });
    
    gameState.totalWinnings += totalWon; // Track net winnings
    gameState.totalLosses += totalLost;
    
    const netPL = totalWon - totalLost;
    if (netPL > 0n) {
        console.log(chalk.green.bold(`\n🎉 Net Profit: +${Math.round(Number(formatEther(netPL)))} BOT`));
    } else if (netPL < 0n) {
        console.log(chalk.red.bold(`\n😔 Net Loss: ${Math.round(Number(formatEther(netPL)))} BOT`));
    } else if (gameState.playerBets.size > 0) {
        console.log(chalk.yellow.bold(`\n🤝 Break Even!`));
    }
    
    // Track overall win rate
    if (!gameState.roundsWithBets) gameState.roundsWithBets = 0;
    if (!gameState.roundsWon) gameState.roundsWon = 0;
    
    if (gameState.playerBets.size > 0) {
        gameState.roundsWithBets++;
        if (totalWon > totalLost) {
            gameState.roundsWon++;
        }
    }
}

function simulateOtherLPs() {
    // Simulate other LPs placing bets and having outcomes
    gameState.liquidityProviders.forEach((lp, name) => {
        if (!lp.isPlayer && Math.random() < 0.6) { // 60% chance other LPs bet
            lp.roundsPlayed++;
            const betAmount = lp.initialDeposit / BigInt(20 + Math.floor(Math.random() * 30)); // 2-5% of capital
            const won = Math.random() < 0.45; // Slightly losing edge for realism
            
            if (won) {
                const profit = betAmount; // 1:1 profit
                lp.totalWinnings += profit;
                lp.currentBalance += profit;
            } else {
                lp.totalLosses += betAmount;
                lp.currentBalance -= betAmount;
            }
        }
    });
}

function calculateProRata() {
    const totalPoolSize = Array.from(gameState.liquidityProviders.values())
        .reduce((sum, lp) => sum + lp.currentBalance, 0n);
    
    console.log(chalk.cyan('\n📊 Pro Rata LP Shares This Round:'));
    
    gameState.liquidityProviders.forEach((lp, name) => {
        const sharePercent = totalPoolSize > 0n ? 
            Number((lp.currentBalance * 10000n) / totalPoolSize) / 100 : 0;
        const shareDisplay = sharePercent >= 10 ? 
            chalk.green(`${sharePercent.toFixed(1)}%`) : 
            chalk.gray(`${sharePercent.toFixed(1)}%`);
        
        console.log(chalk.gray(`  ${lp.name}: ${shareDisplay} (${Math.round(Number(formatEther(lp.currentBalance)))} BOT)`));
    });
    
    console.log(chalk.gray(`\nTotal Pool: ${Math.round(Number(formatEther(totalPoolSize)))} BOT`));
}

function displayLPLeaderboard() {
    const lpArray = Array.from(gameState.liquidityProviders.values());
    
    // Sort by ROI (return on investment)
    lpArray.sort((a, b) => {
        const roiA = a.initialDeposit > 0n ? Number(((a.currentBalance - a.initialDeposit) * 10000n) / a.initialDeposit) / 100 : 0;
        const roiB = b.initialDeposit > 0n ? Number(((b.currentBalance - b.initialDeposit) * 10000n) / b.initialDeposit) / 100 : 0;
        return roiB - roiA;
    });
    
    console.log(chalk.cyan('\n🏆 LP Leaderboard (by ROI):'));
    
    lpArray.forEach((lp, index) => {
        const roi = lp.initialDeposit > 0n ? 
            Number(((lp.currentBalance - lp.initialDeposit) * 10000n) / lp.initialDeposit) / 100 : 0;
        
        const roiDisplay = roi >= 0 ? 
            chalk.green(`+${roi.toFixed(1)}%`) : 
            chalk.red(`${roi.toFixed(1)}%`);
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        const nameDisplay = lp.isPlayer ? chalk.yellow.bold(lp.name) : chalk.white(lp.name);
        
        console.log(`${medal} ${nameDisplay}: ${roiDisplay} (${Math.round(Number(formatEther(lp.currentBalance)))} BOT)`);
    });
}

async function displayStats() {
    const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 30]
    });
    
    const netPL = gameState.totalWinnings - gameState.totalLosses;
    const netPLFormatted = netPL >= 0n ? 
        chalk.green(`+${formatEther(netPL)} BOT`) : 
        chalk.red(`-${formatEther(-netPL)} BOT`);
    
    // Calculate win rate
    let winRateDisplay = 'N/A';
    if (gameState.roundsWithBets > 0) {
        const winRate = Math.round((gameState.roundsWon / gameState.roundsWithBets) * 100);
        winRateDisplay = winRate >= 50 ? 
            chalk.green(`${winRate}%`) : 
            chalk.red(`${winRate}%`);
    }
    
    table.push(
        ['Current Balance', `${Math.round(Number(formatEther(gameState.playerBalance)))} BOT`],
        ['Total Winnings', `${Math.round(Number(formatEther(gameState.totalWinnings)))} BOT`],
        ['Total Losses', `${Math.round(Number(formatEther(gameState.totalLosses)))} BOT`],
        ['Net P/L', netPLFormatted],
        ['Rounds Played', String(gameState.rounds)],
        ['Rounds Bet', String(gameState.roundsWithBets || 0)],
        ['Win Rate', winRateDisplay]
    );
    
    console.log('\n' + table.toString());
    
    // Update player LP stats
    const playerLP = gameState.liquidityProviders.get('You');
    if (playerLP) {
        playerLP.currentBalance = gameState.playerBalance;
        playerLP.totalWinnings = gameState.totalWinnings;
        playerLP.totalLosses = gameState.totalLosses;
        playerLP.roundsPlayed = gameState.rounds;
    }
    
    // Simulate other LPs
    simulateOtherLPs();
    
    // Show pro rata and leaderboard
    calculateProRata();
    displayLPLeaderboard();
}

async function playRound(bots) {
    gameState.rounds++;
    
    console.log(chalk.yellow('\n' + '═'.repeat(60)));
    console.log(chalk.yellow.bold(`ROUND ${gameState.rounds}`));
    console.log(chalk.yellow('═'.repeat(60)));
    
    // Update game state
    try {
        gameState.phase = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const shooter = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentShooter'
        });
        
        if (shooter && shooter[1] !== undefined) {
            gameState.point = shooter[1];
        }
    } catch (e) {
        // Use simulated phase
        if (gameState.phase === 0) gameState.phase = 1;
    }
    
    const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
    console.log(chalk.gray(`\nGame Phase: ${phaseNames[gameState.phase]}`));
    
    if (gameState.phase === 2 && gameState.point) {
        console.log(chalk.gray(`Point: ${gameState.point}`));
    }
    
    // Bot decisions
    await simulateBotDecisions(bots);
    
    // Player betting
    await promptPlayerBets(bots);
    
    // Roll dice
    const { die1, die2, total } = await rollDice();
    displayDice(die1, die2);
    console.log(chalk.yellow.bold(`\nTotal: ${total}`));
    
    // Update phase based on roll
    if (gameState.phase === 1) { // COME_OUT
        if (total === 7 || total === 11) {
            console.log(chalk.green('🎉 Natural Win!'));
        } else if (total === 2 || total === 3 || total === 12) {
            console.log(chalk.red('💀 Craps!'));
        } else {
            gameState.point = total;
            gameState.phase = 2;
            console.log(chalk.yellow(`📍 Point established: ${total}`));
        }
    } else if (gameState.phase === 2) { // POINT
        if (total === gameState.point) {
            console.log(chalk.green(`🎯 Point made! (${total})`));
            gameState.phase = 1;
            gameState.point = 0;
        } else if (total === 7) {
            console.log(chalk.red('💥 Seven out!'));
            gameState.phase = 1;
            gameState.point = 0;
        }
    }
    
    // Calculate results
    const { winners, losers } = calculateResults(total, bots);
    
    // Process winnings
    processPlayerWinnings(winners, losers, bots);
    
    // Display stats
    await displayStats();
}

async function main() {
    await displayHeader();
    
    // Initialize LP simulation
    initializeLPs();
    
    // Check contracts
    const isActive = await checkContracts();
    if (!isActive) {
        console.log(chalk.yellow('\n⚠️  Game not active, using simulation mode'));
    }
    
    // Load bots
    const bots = await loadBots();
    
    console.log(chalk.green('\n✅ Ready to play!'));
    console.log(chalk.gray(`Your balance: ${Math.round(Number(formatEther(gameState.playerBalance)))} BOT\n`));
    
    // Game loop
    let continueGame = true;
    while (continueGame) {
        await playRound(bots);
        
        if (gameState.playerBalance <= 0n) {
            console.log(chalk.red('\n💸 You ran out of BOT tokens!'));
            break;
        }
        
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
    console.log(chalk.gray('Where AI bots gamble and humans bet on their luck!\n'));
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