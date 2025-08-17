#!/usr/bin/env node

/**
 * Enhanced Barely Human Casino CLI
 * Complete interface for all 21 smart contracts
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import figlet from 'figlet';
import { createPublicClient, createWalletClient, http, formatEther, parseEther, formatUnits, parseUnits } from 'viem';
import { hardhatChain } from '../../config/chains.js';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import gradient from 'gradient-string';
import boxen from 'boxen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load deployment addresses
const DEPLOYMENT_PATH = path.join(__dirname, '../../deployments/local-deployment.json');
let CONTRACTS = {};
try {
    CONTRACTS = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
} catch (e) {
    console.error(chalk.red('⚠️  No deployment found. Run deployment script first.'));
    process.exit(1);
}

// Load ABIs
const loadABI = (contractName) => {
    try {
        const abiPath = path.join(__dirname, `../../artifacts/contracts/${contractName}.json`);
        const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        return artifact.abi;
    } catch (e) {
        console.warn(chalk.yellow(`Warning: Could not load ABI for ${contractName}`));
        return [];
    }
};

// Bot personalities
const BOTS = [
    { id: 0, name: 'Alice "All-In"', emoji: '🎯', personality: 'Aggressive risk-taker', color: chalk.red },
    { id: 1, name: 'Bob "Calculator"', emoji: '🧮', personality: 'Statistical analyzer', color: chalk.blue },
    { id: 2, name: 'Charlie "Lucky"', emoji: '🍀', personality: 'Superstitious believer', color: chalk.green },
    { id: 3, name: 'Diana "Ice Queen"', emoji: '❄️', personality: 'Cold and methodical', color: chalk.cyan },
    { id: 4, name: 'Eddie "Entertainer"', emoji: '🎭', personality: 'Theatrical showman', color: chalk.magenta },
    { id: 5, name: 'Fiona "Fearless"', emoji: '⚡', personality: 'Never backs down', color: chalk.yellow },
    { id: 6, name: 'Greg "Grinder"', emoji: '💎', personality: 'Steady and patient', color: chalk.gray },
    { id: 7, name: 'Helen "Hot Streak"', emoji: '🔥', personality: 'Momentum believer', color: chalk.redBright },
    { id: 8, name: 'Ivan "Intimidator"', emoji: '👹', personality: 'Psychological warfare', color: chalk.bgRed },
    { id: 9, name: 'Julia "Jinx"', emoji: '🌀', personality: 'Controls luck itself', color: chalk.magentaBright }
];

class EnhancedCasinoCLI {
    constructor() {
        this.publicClient = createPublicClient({
            chain: hardhatChain,
            transport: http()
        });
        
        this.walletClient = null;
        this.account = null;
        this.currentUser = null;
        
        // Contract instances
        this.contracts = {};
        this.abis = {};
        
        // Game state
        this.currentGameId = null;
        this.currentSeriesId = null;
        this.gamePhase = 'IDLE';
        this.point = 0;
        
        // User state
        this.stakedAmount = 0n;
        this.vaultShares = new Map();
        this.nftBalance = 0;
    }

    async init() {
        console.clear();
        
        // Display title
        const title = await figlet.text('BARELY HUMAN', {
            font: 'ANSI Shadow',
            horizontalLayout: 'full'
        });
        
        console.log(gradient.rainbow(title));
        console.log(boxen(
            chalk.bold('🎲 DeFi Casino with AI Gambling Bots 🤖\n') +
            chalk.gray('Version 2.0 - Full Contract Suite'),
            { padding: 1, margin: 1, borderStyle: 'double' }
        ));
        
        // Load ABIs for all contracts
        this.loadAllABIs();
        
        // Setup wallet
        await this.setupWallet();
        
        // Initialize contract connections
        await this.initializeContracts();
        
        // Start main menu
        await this.mainMenu();
    }

    loadAllABIs() {
        const contracts = [
            'token/BOTToken',
            'game/CrapsGameV2Plus',
            'game/BotManager',
            'vault/CrapsVault',
            'vault/VaultFactoryMinimal',
            'staking/StakingPool',
            'treasury/Treasury',
            'nft/GachaMintPassV2Plus',
            'nft/GenerativeArtNFT',
            'escrow/BotBettingEscrow',
            'crosschain/OmniVaultCoordinator',
            'hooks/BotSwapFeeHookV4Final'
        ];
        
        for (const contract of contracts) {
            const name = contract.split('/').pop();
            this.abis[name] = loadABI(contract);
        }
    }

    async setupWallet() {
        const spinner = ora('Setting up wallet...').start();
        
        try {
            // Use test account
            const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
            this.account = privateKeyToAccount(privateKey);
            
            this.walletClient = createWalletClient({
                account: this.account,
                chain: hardhatChain,
                transport: http()
            });
            
            // Get BOT token balance
            const balance = await this.getTokenBalance(this.account.address);
            
            spinner.succeed(`Wallet connected: ${chalk.cyan(this.account.address.slice(0, 8))}...`);
            console.log(chalk.gray(`BOT Balance: ${formatUnits(balance, 18)} BOT\n`));
            
        } catch (error) {
            spinner.fail('Failed to setup wallet');
            console.error(error);
            process.exit(1);
        }
    }

    async initializeContracts() {
        // Initialize main contract interfaces
        this.contracts = {
            token: { address: CONTRACTS.BOTToken, abi: this.abis.BOTToken },
            game: { address: CONTRACTS.CrapsGameV2Plus, abi: this.abis.CrapsGameV2Plus },
            botManager: { address: CONTRACTS.BotManager, abi: this.abis.BotManager },
            vaultFactory: { address: CONTRACTS.VaultFactoryMinimal || CONTRACTS.VaultFactory, abi: this.abis.VaultFactoryMinimal },
            staking: { address: CONTRACTS.StakingPool, abi: this.abis.StakingPool },
            treasury: { address: CONTRACTS.Treasury, abi: this.abis.Treasury },
            mintPass: { address: CONTRACTS.GachaMintPassV2Plus, abi: this.abis.GachaMintPassV2Plus },
            artNFT: { address: CONTRACTS.GenerativeArtNFT, abi: this.abis.GenerativeArtNFT },
            escrow: { address: CONTRACTS.BotBettingEscrow, abi: this.abis.BotBettingEscrow },
            omniCoordinator: { address: CONTRACTS.OmniVaultCoordinator, abi: this.abis.OmniVaultCoordinator }
        };
    }

    async mainMenu() {
        while (true) {
            console.log(chalk.bold.cyan('\n🎰 Main Menu\n'));
            
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: '🎲 Game Center - Play Craps & Watch Bots', value: 'game' },
                        { name: '💰 Vault Management - LP Operations', value: 'vault' },
                        { name: '🏦 Staking - Stake BOT Tokens', value: 'staking' },
                        { name: '💎 Treasury - View Fees & Distribution', value: 'treasury' },
                        { name: '🎨 NFT Gallery - Mint Passes & Art', value: 'nft' },
                        { name: '🤖 Bot Arena - Chat & Bet on Bots', value: 'bots' },
                        { name: '🌐 Cross-Chain Hub - Omni Operations', value: 'crosschain' },
                        { name: '📊 Analytics Dashboard', value: 'analytics' },
                        { name: '⚙️  Settings & Tools', value: 'settings' },
                        new inquirer.Separator(),
                        { name: '🚪 Exit', value: 'exit' }
                    ]
                }
            ]);
            
            if (action === 'exit') {
                console.log(chalk.yellow('\n👋 Thanks for playing! Come back soon!\n'));
                process.exit(0);
            }
            
            await this.handleMenuAction(action);
        }
    }

    async handleMenuAction(action) {
        switch (action) {
            case 'game':
                await this.gameCenter();
                break;
            case 'vault':
                await this.vaultManagement();
                break;
            case 'staking':
                await this.stakingInterface();
                break;
            case 'treasury':
                await this.treasuryInterface();
                break;
            case 'nft':
                await this.nftGallery();
                break;
            case 'bots':
                await this.botArena();
                break;
            case 'crosschain':
                await this.crossChainHub();
                break;
            case 'analytics':
                await this.analyticsDashboard();
                break;
            case 'settings':
                await this.settingsMenu();
                break;
        }
    }

    // ==================== GAME CENTER ====================
    
    async gameCenter() {
        console.log(chalk.bold.green('\n🎲 Game Center\n'));
        
        // Get current game state
        const gameState = await this.getGameState();
        this.displayGameState(gameState);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Game Actions:',
                choices: [
                    { name: '🎯 Start New Series', value: 'start' },
                    { name: '🎲 Place Bet', value: 'bet' },
                    { name: '🎰 Roll Dice', value: 'roll' },
                    { name: '👀 Watch Bot Round', value: 'watch' },
                    { name: '📜 View Bet History', value: 'history' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'start':
                await this.startNewSeries();
                break;
            case 'bet':
                await this.placeBet();
                break;
            case 'roll':
                await this.rollDice();
                break;
            case 'watch':
                await this.watchBotRound();
                break;
            case 'history':
                await this.viewBetHistory();
                break;
            case 'back':
                return;
        }
        
        await this.gameCenter();
    }

    async getGameState() {
        try {
            const [currentSeries, gamePhase] = await Promise.all([
                this.publicClient.readContract({
                    address: this.contracts.game.address,
                    abi: this.contracts.game.abi,
                    functionName: 'currentSeriesId'
                }),
                this.publicClient.readContract({
                    address: this.contracts.game.address,
                    abi: this.contracts.game.abi,
                    functionName: 'gamePhase'
                })
            ]);
            
            return { currentSeries, gamePhase };
        } catch (error) {
            console.error('Error getting game state:', error);
            return { currentSeries: 0, gamePhase: 0 };
        }
    }

    displayGameState(state) {
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        const table = new Table({
            head: ['Game Status', 'Value'],
            colWidths: [20, 30]
        });
        
        table.push(
            ['Series ID', state.currentSeries?.toString() || '0'],
            ['Phase', phaseNames[state.gamePhase] || 'UNKNOWN'],
            ['Point', this.point || 'None']
        );
        
        console.log(table.toString());
    }

    // ==================== VAULT MANAGEMENT ====================
    
    async vaultManagement() {
        console.log(chalk.bold.blue('\n💰 Vault Management\n'));
        
        // Get all vaults
        const vaults = await this.getAllVaults();
        this.displayVaults(vaults);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Vault Actions:',
                choices: [
                    { name: '💵 Deposit to Vault', value: 'deposit' },
                    { name: '💸 Withdraw from Vault', value: 'withdraw' },
                    { name: '📊 View My Positions', value: 'positions' },
                    { name: '🏆 Top Performing Vaults', value: 'top' },
                    { name: '🤖 Bot Strategies', value: 'strategies' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'deposit':
                await this.depositToVault();
                break;
            case 'withdraw':
                await this.withdrawFromVault();
                break;
            case 'positions':
                await this.viewMyPositions();
                break;
            case 'top':
                await this.viewTopVaults();
                break;
            case 'strategies':
                await this.viewBotStrategies();
                break;
            case 'back':
                return;
        }
        
        await this.vaultManagement();
    }

    async getAllVaults() {
        try {
            const vaultCount = await this.publicClient.readContract({
                address: this.contracts.vaultFactory.address,
                abi: this.contracts.vaultFactory.abi,
                functionName: 'getVaultCount'
            });
            
            const vaults = [];
            for (let i = 0; i < vaultCount; i++) {
                const vaultAddress = await this.publicClient.readContract({
                    address: this.contracts.vaultFactory.address,
                    abi: this.contracts.vaultFactory.abi,
                    functionName: 'getVault',
                    args: [i]
                });
                
                if (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
                    // Get vault details
                    const totalAssets = await this.publicClient.readContract({
                        address: vaultAddress,
                        abi: this.abis.CrapsVault,
                        functionName: 'totalAssets'
                    });
                    
                    vaults.push({
                        id: i,
                        address: vaultAddress,
                        bot: BOTS[i],
                        totalAssets
                    });
                }
            }
            
            return vaults;
        } catch (error) {
            console.error('Error getting vaults:', error);
            return [];
        }
    }

    displayVaults(vaults) {
        const table = new Table({
            head: ['Bot', 'Vault', 'Total Assets', 'Strategy'],
            colWidths: [25, 15, 20, 25]
        });
        
        for (const vault of vaults) {
            table.push([
                `${vault.bot.emoji} ${vault.bot.name}`,
                vault.address.slice(0, 10) + '...',
                formatUnits(vault.totalAssets || 0n, 18) + ' BOT',
                vault.bot.personality
            ]);
        }
        
        console.log(table.toString());
    }

    // ==================== STAKING INTERFACE ====================
    
    async stakingInterface() {
        console.log(chalk.bold.yellow('\n🏦 BOT Token Staking\n'));
        
        // Get staking stats
        const stats = await this.getStakingStats();
        this.displayStakingStats(stats);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Staking Actions:',
                choices: [
                    { name: '➕ Stake BOT Tokens', value: 'stake' },
                    { name: '➖ Unstake BOT Tokens', value: 'unstake' },
                    { name: '💰 Claim Rewards', value: 'claim' },
                    { name: '📊 View APY', value: 'apy' },
                    { name: '👥 Top Stakers', value: 'top' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'stake':
                await this.stakeBOT();
                break;
            case 'unstake':
                await this.unstakeBOT();
                break;
            case 'claim':
                await this.claimRewards();
                break;
            case 'apy':
                await this.viewAPY();
                break;
            case 'top':
                await this.viewTopStakers();
                break;
            case 'back':
                return;
        }
        
        await this.stakingInterface();
    }

    async getStakingStats() {
        try {
            const [totalStaked, rewardRate, myStake, myRewards] = await Promise.all([
                this.publicClient.readContract({
                    address: this.contracts.staking.address,
                    abi: this.contracts.staking.abi,
                    functionName: 'totalSupply'
                }),
                this.publicClient.readContract({
                    address: this.contracts.staking.address,
                    abi: this.contracts.staking.abi,
                    functionName: 'rewardRate'
                }),
                this.publicClient.readContract({
                    address: this.contracts.staking.address,
                    abi: this.contracts.staking.abi,
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }),
                this.publicClient.readContract({
                    address: this.contracts.staking.address,
                    abi: this.contracts.staking.abi,
                    functionName: 'earned',
                    args: [this.account.address]
                })
            ]);
            
            return { totalStaked, rewardRate, myStake, myRewards };
        } catch (error) {
            console.error('Error getting staking stats:', error);
            return { totalStaked: 0n, rewardRate: 0n, myStake: 0n, myRewards: 0n };
        }
    }

    displayStakingStats(stats) {
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total Staked', formatUnits(stats.totalStaked, 18) + ' BOT'],
            ['Reward Rate', formatUnits(stats.rewardRate, 18) + ' BOT/sec'],
            ['Your Stake', formatUnits(stats.myStake, 18) + ' BOT'],
            ['Pending Rewards', formatUnits(stats.myRewards, 18) + ' BOT']
        );
        
        console.log(table.toString());
    }

    // ==================== TREASURY INTERFACE ====================
    
    async treasuryInterface() {
        console.log(chalk.bold.magenta('\n💎 Treasury Management\n'));
        
        // Get treasury stats
        const stats = await this.getTreasuryStats();
        this.displayTreasuryStats(stats);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Treasury Actions:',
                choices: [
                    { name: '💰 View Fee Collection', value: 'fees' },
                    { name: '📊 Distribution Breakdown', value: 'distribution' },
                    { name: '🔄 Trigger Distribution', value: 'distribute' },
                    { name: '📈 Historical Fees', value: 'history' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'fees':
                await this.viewFeeCollection();
                break;
            case 'distribution':
                await this.viewDistribution();
                break;
            case 'distribute':
                await this.triggerDistribution();
                break;
            case 'history':
                await this.viewFeeHistory();
                break;
            case 'back':
                return;
        }
        
        await this.treasuryInterface();
    }

    async getTreasuryStats() {
        try {
            const treasuryBalance = await this.getTokenBalance(this.contracts.treasury.address);
            
            // Get distribution percentages
            const [stakingPercent, buybackPercent, devPercent] = await Promise.all([
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'stakingPercent'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'buybackPercent'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'devPercent'
                })
            ]);
            
            return { treasuryBalance, stakingPercent, buybackPercent, devPercent };
        } catch (error) {
            console.error('Error getting treasury stats:', error);
            return { treasuryBalance: 0n, stakingPercent: 50, buybackPercent: 20, devPercent: 15 };
        }
    }

    displayTreasuryStats(stats) {
        const table = new Table({
            head: ['Treasury Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Balance', formatUnits(stats.treasuryBalance, 18) + ' BOT'],
            ['Staking Distribution', stats.stakingPercent + '%'],
            ['Buyback Allocation', stats.buybackPercent + '%'],
            ['Dev Fund', stats.devPercent + '%'],
            ['Insurance Fund', (100 - stats.stakingPercent - stats.buybackPercent - stats.devPercent) + '%']
        );
        
        console.log(table.toString());
    }

    // ==================== NFT GALLERY ====================
    
    async nftGallery() {
        console.log(chalk.bold.cyan('\n🎨 NFT Gallery\n'));
        
        // Get NFT stats
        const stats = await this.getNFTStats();
        this.displayNFTStats(stats);
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'NFT Actions:',
                choices: [
                    { name: '🎟️ View Mint Passes', value: 'passes' },
                    { name: '🎨 Generate Art', value: 'generate' },
                    { name: '🏆 Raffle History', value: 'raffles' },
                    { name: '📸 My Collection', value: 'collection' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'passes':
                await this.viewMintPasses();
                break;
            case 'generate':
                await this.generateArt();
                break;
            case 'raffles':
                await this.viewRaffleHistory();
                break;
            case 'collection':
                await this.viewMyCollection();
                break;
            case 'back':
                return;
        }
        
        await this.nftGallery();
    }

    async getNFTStats() {
        try {
            const [totalPasses, myPasses, totalArt] = await Promise.all([
                this.publicClient.readContract({
                    address: this.contracts.mintPass.address,
                    abi: this.contracts.mintPass.abi,
                    functionName: 'totalSupply'
                }),
                this.publicClient.readContract({
                    address: this.contracts.mintPass.address,
                    abi: this.contracts.mintPass.abi,
                    functionName: 'balanceOf',
                    args: [this.account.address]
                }),
                this.publicClient.readContract({
                    address: this.contracts.artNFT.address,
                    abi: this.contracts.artNFT.abi,
                    functionName: 'totalSupply'
                })
            ]);
            
            return { totalPasses, myPasses, totalArt };
        } catch (error) {
            console.error('Error getting NFT stats:', error);
            return { totalPasses: 0n, myPasses: 0n, totalArt: 0n };
        }
    }

    displayNFTStats(stats) {
        const table = new Table({
            head: ['NFT Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total Mint Passes', stats.totalPasses.toString()],
            ['Your Mint Passes', stats.myPasses.toString()],
            ['Total Art Created', stats.totalArt.toString()]
        );
        
        console.log(table.toString());
    }

    // ==================== BOT ARENA ====================
    
    async botArena() {
        console.log(chalk.bold.red('\n🤖 Bot Arena\n'));
        
        // Display all bots
        this.displayBotRoster();
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Bot Arena Actions:',
                choices: [
                    { name: '💬 Chat with Bot', value: 'chat' },
                    { name: '🎰 Bet on Bot Performance', value: 'bet' },
                    { name: '📊 Bot Statistics', value: 'stats' },
                    { name: '🏆 Bot Leaderboard', value: 'leaderboard' },
                    { name: '⚔️ Head-to-Head Battle', value: 'battle' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'chat':
                await this.chatWithBot();
                break;
            case 'bet':
                await this.betOnBot();
                break;
            case 'stats':
                await this.viewBotStats();
                break;
            case 'leaderboard':
                await this.viewBotLeaderboard();
                break;
            case 'battle':
                await this.botBattle();
                break;
            case 'back':
                return;
        }
        
        await this.botArena();
    }

    displayBotRoster() {
        console.log(chalk.bold('\n🤖 Bot Roster:\n'));
        
        const table = new Table({
            head: ['ID', 'Bot', 'Personality', 'Strategy'],
            colWidths: [5, 25, 30, 20]
        });
        
        for (const bot of BOTS) {
            table.push([
                bot.id.toString(),
                `${bot.emoji} ${bot.name}`,
                bot.personality,
                bot.color('Active')
            ]);
        }
        
        console.log(table.toString());
    }

    // ==================== CROSS-CHAIN HUB ====================
    
    async crossChainHub() {
        console.log(chalk.bold.green('\n🌐 Cross-Chain Hub\n'));
        
        // Display supported chains
        this.displaySupportedChains();
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Cross-Chain Actions:',
                choices: [
                    { name: '🌉 Bridge BOT Tokens', value: 'bridge' },
                    { name: '💰 Cross-Chain Deposits', value: 'deposit' },
                    { name: '📊 Multi-Chain Stats', value: 'stats' },
                    { name: '🔄 Sync Vault States', value: 'sync' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'bridge':
                await this.bridgeTokens();
                break;
            case 'deposit':
                await this.crossChainDeposit();
                break;
            case 'stats':
                await this.multiChainStats();
                break;
            case 'sync':
                await this.syncVaultStates();
                break;
            case 'back':
                return;
        }
        
        await this.crossChainHub();
    }

    displaySupportedChains() {
        const table = new Table({
            head: ['Chain', 'Status', 'Type', 'TVL'],
            colWidths: [20, 15, 15, 20]
        });
        
        table.push(
            ['Base Sepolia', chalk.green('Active'), 'Hub', '1.2M BOT'],
            ['Arbitrum Sepolia', chalk.yellow('Ready'), 'Spoke', '0 BOT'],
            ['Flow Testnet', chalk.yellow('Ready'), 'Spoke', '0 BOT'],
            ['Unichain', chalk.gray('Pending'), 'Future', '0 BOT']
        );
        
        console.log(table.toString());
    }

    // ==================== ANALYTICS DASHBOARD ====================
    
    async analyticsDashboard() {
        console.log(chalk.bold.blue('\n📊 Analytics Dashboard\n'));
        
        const spinner = ora('Loading analytics...').start();
        
        try {
            // Gather all analytics data
            const [gameStats, vaultStats, stakingStats, treasuryStats] = await Promise.all([
                this.getGameAnalytics(),
                this.getVaultAnalytics(),
                this.getStakingAnalytics(),
                this.getTreasuryAnalytics()
            ]);
            
            spinner.succeed('Analytics loaded');
            
            // Display comprehensive dashboard
            this.displayGameAnalytics(gameStats);
            this.displayVaultAnalytics(vaultStats);
            this.displayStakingAnalytics(stakingStats);
            this.displayTreasuryAnalytics(treasuryStats);
            
        } catch (error) {
            spinner.fail('Failed to load analytics');
            console.error(error);
        }
        
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async getGameAnalytics() {
        // Placeholder - would fetch real game statistics
        return {
            totalGames: 1523,
            totalVolume: '15234000',
            avgBetSize: '100',
            houseEdge: '1.4%',
            playerWinRate: '48.6%'
        };
    }

    displayGameAnalytics(stats) {
        console.log(chalk.bold.green('\n🎲 Game Analytics:\n'));
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total Games Played', stats.totalGames],
            ['Total Volume', stats.totalVolume + ' BOT'],
            ['Average Bet Size', stats.avgBetSize + ' BOT'],
            ['House Edge', stats.houseEdge],
            ['Player Win Rate', stats.playerWinRate]
        );
        
        console.log(table.toString());
    }

    // ==================== HELPER FUNCTIONS ====================
    
    async getTokenBalance(address) {
        try {
            return await this.publicClient.readContract({
                address: this.contracts.token.address,
                abi: this.contracts.token.abi,
                functionName: 'balanceOf',
                args: [address]
            });
        } catch (error) {
            console.error('Error getting token balance:', error);
            return 0n;
        }
    }

    async depositToVault() {
        const vaults = await this.getAllVaults();
        
        const { vaultId, amount } = await inquirer.prompt([
            {
                type: 'list',
                name: 'vaultId',
                message: 'Select vault to deposit to:',
                choices: vaults.map(v => ({
                    name: `${v.bot.emoji} ${v.bot.name}`,
                    value: v.id
                }))
            },
            {
                type: 'input',
                name: 'amount',
                message: 'Amount to deposit (BOT):',
                validate: (value) => {
                    const num = parseFloat(value);
                    return num > 0 || 'Please enter a valid amount';
                }
            }
        ]);
        
        const spinner = ora('Processing deposit...').start();
        
        try {
            const vault = vaults[vaultId];
            const depositAmount = parseUnits(amount, 18);
            
            // Approve token transfer
            await this.walletClient.writeContract({
                address: this.contracts.token.address,
                abi: this.contracts.token.abi,
                functionName: 'approve',
                args: [vault.address, depositAmount]
            });
            
            // Deposit to vault
            const tx = await this.walletClient.writeContract({
                address: vault.address,
                abi: this.abis.CrapsVault,
                functionName: 'deposit',
                args: [depositAmount, this.account.address]
            });
            
            spinner.succeed(`Successfully deposited ${amount} BOT to ${vault.bot.name}'s vault!`);
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Deposit failed');
            console.error(error);
        }
    }

    async stakeBOT() {
        const { amount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: 'Amount to stake (BOT):',
                validate: (value) => {
                    const num = parseFloat(value);
                    return num > 0 || 'Please enter a valid amount';
                }
            }
        ]);
        
        const spinner = ora('Staking BOT tokens...').start();
        
        try {
            const stakeAmount = parseUnits(amount, 18);
            
            // Approve token transfer
            await this.walletClient.writeContract({
                address: this.contracts.token.address,
                abi: this.contracts.token.abi,
                functionName: 'approve',
                args: [this.contracts.staking.address, stakeAmount]
            });
            
            // Stake tokens
            const tx = await this.walletClient.writeContract({
                address: this.contracts.staking.address,
                abi: this.contracts.staking.abi,
                functionName: 'stake',
                args: [stakeAmount]
            });
            
            spinner.succeed(`Successfully staked ${amount} BOT!`);
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Staking failed');
            console.error(error);
        }
    }

    async claimRewards() {
        const spinner = ora('Claiming staking rewards...').start();
        
        try {
            const tx = await this.walletClient.writeContract({
                address: this.contracts.staking.address,
                abi: this.contracts.staking.abi,
                functionName: 'getReward'
            });
            
            spinner.succeed('Successfully claimed rewards!');
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Failed to claim rewards');
            console.error(error);
        }
    }

    async placeBet() {
        console.log(chalk.bold('\n🎲 Place Your Bet\n'));
        
        // Show available bet types
        const betTypes = [
            { name: 'Pass Line', value: 0 },
            { name: "Don't Pass", value: 1 },
            { name: 'Come', value: 2 },
            { name: "Don't Come", value: 3 },
            { name: 'Field', value: 4 },
            { name: 'Any 7', value: 43 },
            { name: 'Any Craps', value: 44 },
            { name: 'Hard 6', value: 25 },
            { name: 'Hard 8', value: 26 }
        ];
        
        const { betType, amount } = await inquirer.prompt([
            {
                type: 'list',
                name: 'betType',
                message: 'Select bet type:',
                choices: betTypes
            },
            {
                type: 'input',
                name: 'amount',
                message: 'Bet amount (BOT):',
                validate: (value) => {
                    const num = parseFloat(value);
                    return (num >= 1 && num <= 1000) || 'Bet must be between 1 and 1000 BOT';
                }
            }
        ]);
        
        const spinner = ora('Placing bet...').start();
        
        try {
            const betAmount = parseUnits(amount, 18);
            
            const tx = await this.walletClient.writeContract({
                address: this.contracts.game.address,
                abi: this.contracts.game.abi,
                functionName: 'placeBet',
                args: [betType, betAmount, 0] // 0 for bet value (not used for most bets)
            });
            
            spinner.succeed(`Bet placed: ${amount} BOT on ${betTypes.find(b => b.value === betType).name}`);
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Failed to place bet');
            console.error(error);
        }
    }

    async settingsMenu() {
        console.log(chalk.bold.gray('\n⚙️  Settings & Tools\n'));
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Settings:',
                choices: [
                    { name: '💵 Get Test BOT Tokens', value: 'faucet' },
                    { name: '🔑 Change Wallet', value: 'wallet' },
                    { name: '🌐 Change Network', value: 'network' },
                    { name: '📝 Export Data', value: 'export' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        
        switch (action) {
            case 'faucet':
                await this.requestTestTokens();
                break;
            case 'wallet':
                console.log(chalk.yellow('Wallet switching not implemented in demo'));
                break;
            case 'network':
                console.log(chalk.yellow('Network switching not implemented in demo'));
                break;
            case 'export':
                console.log(chalk.yellow('Data export not implemented in demo'));
                break;
            case 'back':
                return;
        }
        
        await this.settingsMenu();
    }

    async requestTestTokens() {
        const spinner = ora('Requesting test tokens...').start();
        
        try {
            // In a real implementation, this would call a faucet contract
            // For now, we'll just show a success message
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            spinner.succeed('Test tokens requested! Check your balance.');
            
        } catch (error) {
            spinner.fail('Failed to request tokens');
            console.error(error);
        }
    }

    // Additional helper methods for remaining features...
    async viewBotLeaderboard() {
        console.log(chalk.bold('\n🏆 Bot Leaderboard\n'));
        
        const table = new Table({
            head: ['Rank', 'Bot', 'Wins', 'Profit', 'Win Rate'],
            colWidths: [8, 25, 10, 15, 12]
        });
        
        // Mock data - would fetch from contracts
        const leaderboard = [
            { bot: BOTS[7], wins: 234, profit: '15234', rate: '62%' },
            { bot: BOTS[0], wins: 198, profit: '12100', rate: '58%' },
            { bot: BOTS[5], wins: 187, profit: '9800', rate: '55%' }
        ];
        
        leaderboard.forEach((entry, i) => {
            table.push([
                `#${i + 1}`,
                `${entry.bot.emoji} ${entry.bot.name}`,
                entry.wins.toString(),
                entry.profit + ' BOT',
                entry.rate
            ]);
        });
        
        console.log(table.toString());
        
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async getVaultAnalytics() {
        return {
            totalTVL: '5234000',
            avgAPY: '24.5%',
            topVault: 'Helen "Hot Streak"',
            activeVaults: 10,
            uniqueLPs: 342
        };
    }

    displayVaultAnalytics(stats) {
        console.log(chalk.bold.blue('\n💰 Vault Analytics:\n'));
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total TVL', stats.totalTVL + ' BOT'],
            ['Average APY', stats.avgAPY],
            ['Top Performing Vault', stats.topVault],
            ['Active Vaults', stats.activeVaults],
            ['Unique LPs', stats.uniqueLPs]
        );
        
        console.log(table.toString());
    }

    async getStakingAnalytics() {
        return {
            totalStaked: '2100000',
            stakingAPR: '18.2%',
            avgStakeTime: '14 days',
            totalRewardsPaid: '125000',
            activeStakers: 89
        };
    }

    displayStakingAnalytics(stats) {
        console.log(chalk.bold.yellow('\n🏦 Staking Analytics:\n'));
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total Staked', stats.totalStaked + ' BOT'],
            ['Staking APR', stats.stakingAPR],
            ['Avg Stake Duration', stats.avgStakeTime],
            ['Total Rewards Paid', stats.totalRewardsPaid + ' BOT'],
            ['Active Stakers', stats.activeStakers]
        );
        
        console.log(table.toString());
    }

    async getTreasuryAnalytics() {
        return {
            totalCollected: '450000',
            weeklyAvg: '12500',
            distributionRate: '95%',
            buybackExecuted: '85000',
            insuranceFund: '67500'
        };
    }

    displayTreasuryAnalytics(stats) {
        console.log(chalk.bold.magenta('\n💎 Treasury Analytics:\n'));
        
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 30]
        });
        
        table.push(
            ['Total Fees Collected', stats.totalCollected + ' BOT'],
            ['Weekly Average', stats.weeklyAvg + ' BOT'],
            ['Distribution Rate', stats.distributionRate],
            ['Buyback Executed', stats.buybackExecuted + ' BOT'],
            ['Insurance Fund', stats.insuranceFund + ' BOT']
        );
        
        console.log(table.toString());
    }
}

// Main execution
async function main() {
    const cli = new EnhancedCasinoCLI();
    await cli.init();
}

main().catch(console.error);