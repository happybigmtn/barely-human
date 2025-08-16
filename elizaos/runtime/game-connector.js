import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { localhost } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load contract ABIs
const loadABI = (contractName) => {
    try {
        const abiPath = path.join(__dirname, '../../artifacts/contracts');
        // Create a recursive search for the ABI file
        const searchDir = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const result = searchDir(fullPath);
                    if (result) return result;
                } else if (entry.name === `${contractName}.json`) {
                    const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    return artifact.abi;
                }
            }
            return null;
        };
        
        const abi = searchDir(abiPath);
        if (!abi) throw new Error(`ABI not found for ${contractName}`);
        return abi;
    } catch (error) {
        console.error(`Error loading ABI for ${contractName}:`, error.message);
        // Return a minimal ABI for testing
        return [];
    }
};

/**
 * GameConnector - Connects ElizaOS bot personalities to the Craps game
 */
export class GameConnector {
    constructor(config) {
        this.config = config;
        this.deployments = this.loadDeployments();
        this.bots = new Map();
        this.publicClient = null;
        this.contracts = {};
        this.gameState = {
            phase: 'IDLE',
            point: 0,
            lastRoll: null,
            seriesId: 0,
            activeBets: new Map()
        };
    }
    
    loadDeployments() {
        const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run deployment script first.');
        }
        return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    }
    
    async initialize() {
        console.log('🔌 Initializing Game Connector...\n');
        
        // Create public client
        this.publicClient = createPublicClient({
            chain: localhost,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Load contract instances
        this.contracts = {
            crapsGame: {
                address: this.deployments.contracts.CrapsGame,
                abi: loadABI('CrapsGame')
            },
            crapsBets: {
                address: this.deployments.contracts.CrapsBets,
                abi: loadABI('CrapsBets')
            },
            crapsSettlement: {
                address: this.deployments.contracts.CrapsSettlement,
                abi: loadABI('CrapsSettlement')
            },
            botManager: {
                address: this.deployments.contracts.BotManager,
                abi: loadABI('BotManager')
            },
            botToken: {
                address: this.deployments.contracts.BOTToken,
                abi: loadABI('BOTToken')
            },
            vaultFactory: {
                address: this.deployments.contracts.VaultFactory,
                abi: loadABI('VaultFactoryOptimized')
            }
        };
        
        console.log('✅ Game Connector initialized');
    }
    
    /**
     * Create bot instance with personality and wallet
     */
    async createBot(botId, privateKey) {
        const account = privateKeyToAccount(privateKey);
        
        const walletClient = createWalletClient({
            account,
            chain: localhost,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Get bot personality from contract
        const personality = await this.publicClient.readContract({
            address: this.contracts.botManager.address,
            abi: this.contracts.botManager.abi,
            functionName: 'getPersonality',
            args: [botId]
        });
        
        // Get vault address for this bot
        const vaultAddress = this.deployments.contracts.BotVaults[botId];
        
        const bot = {
            id: botId,
            account,
            walletClient,
            vaultAddress,
            personality: {
                aggressiveness: Number(personality[0]),
                riskTolerance: Number(personality[1]),
                patience: Number(personality[2]),
                adaptability: Number(personality[3]),
                confidence: Number(personality[4]),
                preferredStrategy: Number(personality[5]),
                quirk: personality[6]
            },
            stats: {
                totalBets: 0,
                wins: 0,
                losses: 0,
                profit: 0n,
                currentStreak: 0,
                isWinStreak: false
            }
        };
        
        this.bots.set(botId, bot);
        return bot;
    }
    
    /**
     * Get current game state
     */
    async getGameState() {
        const phase = await this.publicClient.readContract({
            address: this.contracts.crapsGame.address,
            abi: this.contracts.crapsGame.abi,
            functionName: 'getCurrentPhase'
        });
        
        const shooter = await this.publicClient.readContract({
            address: this.contracts.crapsGame.address,
            abi: this.contracts.crapsGame.abi,
            functionName: 'getCurrentShooter'
        });
        
        const lastRoll = await this.publicClient.readContract({
            address: this.contracts.crapsGame.address,
            abi: this.contracts.crapsGame.abi,
            functionName: 'getLastRoll'
        });
        
        this.gameState = {
            phase: ['IDLE', 'COME_OUT', 'POINT'][Number(phase)],
            point: Number(shooter[1]), // point is at index 1
            lastRoll: lastRoll ? {
                die1: Number(lastRoll[0]),
                die2: Number(lastRoll[1]),
                total: Number(lastRoll[2])
            } : null,
            seriesId: Number(shooter[3]), // seriesId at index 3
            activeBets: this.gameState.activeBets
        };
        
        return this.gameState;
    }
    
    /**
     * Start a new game series
     */
    async startNewSeries(shooterAddress) {
        console.log('🎲 Starting new game series...');
        
        const bot = this.bots.get(0); // Use first bot as operator
        if (!bot) throw new Error('No bot available to start series');
        
        const { request } = await this.publicClient.simulateContract({
            address: this.contracts.crapsGame.address,
            abi: this.contracts.crapsGame.abi,
            functionName: 'startNewSeries',
            args: [shooterAddress],
            account: bot.account
        });
        
        const hash = await bot.walletClient.writeContract(request);
        await this.publicClient.waitForTransactionReceipt({ hash });
        
        console.log('✅ New series started');
        await this.getGameState();
        return this.gameState;
    }
    
    /**
     * Bot makes a betting decision based on personality
     */
    async makeBettingDecision(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);
        
        await this.getGameState();
        
        // Don't bet if game not active
        if (this.gameState.phase === 'IDLE') {
            return null;
        }
        
        // Get vault balance
        const balance = await this.publicClient.readContract({
            address: this.contracts.botToken.address,
            abi: this.contracts.botToken.abi,
            functionName: 'balanceOf',
            args: [bot.vaultAddress]
        });
        
        // Simple decision logic based on personality
        const shouldBet = Math.random() * 100 < bot.personality.aggressiveness;
        
        if (!shouldBet) {
            return null;
        }
        
        // Calculate bet amount based on risk tolerance
        const maxBet = parseEther('1000'); // Max 1000 BOT
        const minBet = parseEther('10');   // Min 10 BOT
        const riskFactor = bot.personality.riskTolerance / 100;
        const betAmount = minBet + ((maxBet - minBet) * BigInt(Math.floor(riskFactor * 100)) / 100n);
        
        // Choose bet type based on phase and strategy
        let betType;
        if (this.gameState.phase === 'COME_OUT') {
            // In come-out, can bet Pass or Don't Pass
            betType = bot.personality.aggressiveness > 50 ? 0 : 1; // 0=PASS, 1=DONT_PASS
        } else {
            // In point phase, more options
            const betOptions = [2, 3, 4]; // COME, DONT_COME, FIELD
            betType = betOptions[Math.floor(Math.random() * betOptions.length)];
        }
        
        return {
            botId,
            betType,
            amount: betAmount,
            confidence: bot.personality.confidence
        };
    }
    
    /**
     * Place a bet for a bot
     */
    async placeBet(botId, betType, amount) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);
        
        console.log(`🎯 Bot ${botId} placing bet: Type ${betType}, Amount ${formatEther(amount)} BOT`);
        
        try {
            // First approve the bet amount
            const { request: approveRequest } = await this.publicClient.simulateContract({
                address: this.contracts.botToken.address,
                abi: this.contracts.botToken.abi,
                functionName: 'approve',
                args: [this.contracts.crapsBets.address, amount],
                account: bot.account
            });
            
            const approveHash = await bot.walletClient.writeContract(approveRequest);
            await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
            
            // Place the bet
            const { request: betRequest } = await this.publicClient.simulateContract({
                address: this.contracts.crapsBets.address,
                abi: this.contracts.crapsBets.abi,
                functionName: 'placeBet',
                args: [betType, amount],
                account: bot.account
            });
            
            const betHash = await bot.walletClient.writeContract(betRequest);
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash: betHash });
            
            // Track the bet
            const betKey = `${botId}-${betType}`;
            this.gameState.activeBets.set(betKey, {
                botId,
                betType,
                amount,
                timestamp: Date.now()
            });
            
            bot.stats.totalBets++;
            
            console.log(`✅ Bet placed successfully`);
            return receipt;
            
        } catch (error) {
            console.error(`❌ Failed to place bet: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Roll the dice (trigger VRF)
     */
    async rollDice() {
        console.log('🎲 Rolling dice...');
        
        const bot = this.bots.get(0); // Use first bot as operator
        if (!bot) throw new Error('No bot available to roll dice');
        
        const { request } = await this.publicClient.simulateContract({
            address: this.contracts.crapsGame.address,
            abi: this.contracts.crapsGame.abi,
            functionName: 'rollDice',
            account: bot.account
        });
        
        const hash = await bot.walletClient.writeContract(request);
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        
        // In local mode, trigger VRF fulfillment immediately
        // Mock VRF will auto-fulfill
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for fulfillment
        
        const newState = await this.getGameState();
        console.log(`✅ Dice rolled: ${newState.lastRoll?.die1} + ${newState.lastRoll?.die2} = ${newState.lastRoll?.total}`);
        
        return newState.lastRoll;
    }
    
    /**
     * Check and settle bets after a roll
     */
    async settleBets() {
        console.log('💰 Settling bets...');
        
        for (const [key, bet] of this.gameState.activeBets) {
            const bot = this.bots.get(bet.botId);
            if (!bot) continue;
            
            try {
                // Check if bet won
                const betInfo = await this.publicClient.readContract({
                    address: this.contracts.crapsBets.address,
                    abi: this.contracts.crapsBets.abi,
                    functionName: 'getBet',
                    args: [bot.account.address, bet.betType]
                });
                
                if (!betInfo[4]) { // isActive at index 4
                    // Bet was settled
                    this.gameState.activeBets.delete(key);
                    
                    // Check balance to determine if won
                    const newBalance = await this.publicClient.readContract({
                        address: this.contracts.botToken.address,
                        abi: this.contracts.botToken.abi,
                        functionName: 'balanceOf',
                        args: [bot.vaultAddress]
                    });
                    
                    // Update bot stats (simplified - in real implementation, track actual payouts)
                    console.log(`  Bot ${bet.botId}: Bet settled`);
                }
            } catch (error) {
                console.error(`Error checking bet for bot ${bet.botId}:`, error.message);
            }
        }
        
        console.log('✅ Bets settled');
    }
    
    /**
     * Run a complete game round with all bots
     */
    async runGameRound() {
        console.log('\n' + '='.repeat(60));
        console.log('🎮 RUNNING GAME ROUND');
        console.log('='.repeat(60) + '\n');
        
        await this.getGameState();
        
        // Start new series if needed
        if (this.gameState.phase === 'IDLE') {
            const firstBot = this.bots.get(0);
            await this.startNewSeries(firstBot.account.address);
        }
        
        // Each bot makes a betting decision
        const decisions = [];
        for (const [botId, bot] of this.bots) {
            const decision = await this.makeBettingDecision(botId);
            if (decision) {
                decisions.push(decision);
            }
        }
        
        // Place bets
        for (const decision of decisions) {
            try {
                await this.placeBet(decision.botId, decision.betType, decision.amount);
            } catch (error) {
                console.error(`Bot ${decision.botId} bet failed:`, error.message);
            }
        }
        
        // Roll dice
        await this.rollDice();
        
        // Settle bets
        await this.settleBets();
        
        // Update game state
        await this.getGameState();
        
        console.log('\n📊 Round Complete!');
        console.log(`  Phase: ${this.gameState.phase}`);
        console.log(`  Point: ${this.gameState.point || 'None'}`);
        console.log(`  Active Bets: ${this.gameState.activeBets.size}`);
        
        return this.gameState;
    }
    
    /**
     * Get bot statistics
     */
    getBotStats(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return null;
        
        return {
            id: botId,
            personality: bot.personality,
            stats: bot.stats,
            vaultAddress: bot.vaultAddress
        };
    }
    
    /**
     * Get all bot stats
     */
    getAllBotStats() {
        const stats = [];
        for (const [botId, bot] of this.bots) {
            stats.push(this.getBotStats(botId));
        }
        return stats;
    }
}

export default GameConnector;