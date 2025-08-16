import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { BlockchainPlugin } from '../plugins/blockchain-plugin.js';
import { BettingStrategy } from './betting-strategy.js';
import { BotPersonality } from './bot-personality.js';

config(); // Load environment variables

// Configuration
const CONFIG = {
    network: process.env.NETWORK || 'testnet',
    rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
    contracts: {
        crapsGame: process.env.CRAPS_GAME_ADDRESS,
        crapsBets: process.env.CRAPS_BETS_ADDRESS,
        crapsSettlement: process.env.CRAPS_SETTLEMENT_ADDRESS,
        botToken: process.env.BOT_TOKEN_ADDRESS,
        vault: process.env.VAULT_ADDRESS
    },
    bots: [
        'alice_allin',
        'bob_calculator',
        'charlie_lucky',
        'diana_icequeen',
        'eddie_entertainer',
        'fiona_fearless',
        'greg_grinder',
        'helen_hotstreak',
        'ivan_intimidator',
        'julia_jinx'
    ]
};

class BarelyHumanBots {
    constructor() {
        this.blockchain = new BlockchainPlugin(CONFIG);
        this.bots = new Map();
        this.isRunning = false;
        this.gameState = {
            phase: 'IDLE',
            point: 0,
            lastRoll: { die1: 0, die2: 0, total: 0 },
            seriesId: 0,
            rollNumber: 0
        };
    }

    async initialize() {
        console.log('🎲 Initializing Barely Human Bots...\n');

        // Load bot personalities
        for (const botName of CONFIG.bots) {
            try {
                const characterFile = readFileSync(
                    `./characters/${botName}.yaml`,
                    'utf8'
                );
                const character = parse(characterFile);
                
                // Initialize bot with personality and strategy
                const bot = {
                    name: character.name,
                    personality: new BotPersonality(character),
                    strategy: new BettingStrategy(character.betting_strategy),
                    isActive: false,
                    currentBets: [],
                    balance: 0n,
                    stats: {
                        totalBets: 0,
                        totalWins: 0,
                        totalLosses: 0,
                        profit: 0n
                    }
                };

                // Initialize blockchain wallet (using env variable for private key)
                const privateKey = process.env[`${botName.toUpperCase()}_PRIVATE_KEY`];
                if (privateKey) {
                    const address = await this.blockchain.initializeBot(botName, privateKey);
                    bot.address = address;
                    bot.isActive = true;
                    console.log(`✅ ${character.name} initialized at ${address}`);
                } else {
                    console.log(`⚠️  ${character.name} missing private key`);
                }

                this.bots.set(botName, bot);
            } catch (error) {
                console.error(`❌ Failed to load ${botName}:`, error.message);
            }
        }

        // Subscribe to game events
        await this.subscribeToEvents();

        console.log('\n🎲 Bot initialization complete!\n');
    }

    async subscribeToEvents() {
        // Subscribe to dice roll events
        this.blockchain.subscribeToGameEvents((event) => {
            this.handleGameEvent(event);
        });

        // Poll for game state changes
        setInterval(async () => {
            await this.updateGameState();
        }, 5000); // Check every 5 seconds
    }

    async updateGameState() {
        try {
            const phase = await this.blockchain.getCurrentPhase();
            const point = await this.blockchain.getCurrentPoint();
            const lastRoll = await this.blockchain.getLastRoll();

            const stateChanged = 
                phase !== this.gameState.phase ||
                point !== this.gameState.point;

            this.gameState = {
                ...this.gameState,
                phase,
                point,
                lastRoll
            };

            if (stateChanged) {
                console.log(`\n📊 Game State Update:`);
                console.log(`   Phase: ${phase}`);
                console.log(`   Point: ${point || 'None'}`);
                console.log(`   Last Roll: ${lastRoll.die1} + ${lastRoll.die2} = ${lastRoll.total}\n`);

                // Trigger bot decisions based on new state
                await this.makeBettingDecisions();
            }
        } catch (error) {
            console.error('Error updating game state:', error);
        }
    }

    async handleGameEvent(event) {
        console.log(`\n🎲 Event: ${event.type}`);
        
        if (event.type === 'DICE_ROLLED') {
            const { die1, die2, total } = event.data;
            console.log(`   Roll: ${die1} + ${die2} = ${total}`);
            
            // Update game state
            this.gameState.lastRoll = { die1, die2, total };
            this.gameState.rollNumber = event.data.rollNumber;

            // Let bots react to the roll
            for (const [botName, bot] of this.bots) {
                if (bot.isActive) {
                    const reaction = bot.personality.reactToRoll(die1, die2, total);
                    if (reaction) {
                        console.log(`   ${bot.name}: ${reaction}`);
                    }
                }
            }
        }
    }

    async makeBettingDecisions() {
        if (this.gameState.phase === 'IDLE') {
            return; // No betting when game is idle
        }

        for (const [botName, bot] of this.bots) {
            if (!bot.isActive) continue;

            try {
                // Get bot's current balance and bets
                bot.balance = BigInt(await this.blockchain.getBalance(botName));
                const activeBets = await this.blockchain.getActiveBets(botName);

                // Let the bot decide what to bet
                const decision = bot.strategy.decideBet(
                    this.gameState,
                    bot.balance,
                    activeBets
                );

                if (decision && decision.betType && decision.amount > 0n) {
                    // Convert bet type name to ID
                    const betTypeId = this.blockchain.getBetTypeId(decision.betType);
                    
                    if (betTypeId >= 0) {
                        console.log(`\n💰 ${bot.name} betting ${decision.amount} on ${decision.betType}`);
                        
                        const result = await this.blockchain.placeBet(
                            botName,
                            betTypeId,
                            decision.amount
                        );

                        if (result.success) {
                            bot.currentBets.push({
                                type: decision.betType,
                                amount: decision.amount,
                                txHash: result.txHash
                            });
                            bot.stats.totalBets++;
                            
                            // Bot reaction to placing bet
                            const message = bot.personality.getBettingMessage(decision.betType, decision.amount);
                            console.log(`   ${bot.name}: "${message}"`);
                        } else {
                            console.log(`   ❌ Bet failed: ${result.error}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing ${bot.name}:`, error.message);
            }
        }
    }

    async start() {
        this.isRunning = true;
        console.log('🎮 Starting bot runtime...\n');

        // Initial game state update
        await this.updateGameState();

        // Main loop
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    stop() {
        this.isRunning = false;
        console.log('\n🛑 Stopping bot runtime...');
    }

    // Display bot statistics
    displayStats() {
        console.log('\n📊 Bot Statistics:');
        console.log('━'.repeat(60));
        
        for (const [botName, bot] of this.bots) {
            if (bot.isActive) {
                console.log(`\n${bot.name}:`);
                console.log(`  Balance: ${bot.balance} BOT`);
                console.log(`  Total Bets: ${bot.stats.totalBets}`);
                console.log(`  Wins: ${bot.stats.totalWins}`);
                console.log(`  Losses: ${bot.stats.totalLosses}`);
                console.log(`  P&L: ${bot.stats.profit} BOT`);
            }
        }
        
        console.log('\n' + '━'.repeat(60));
    }
}

// Main execution
async function main() {
    const runtime = new BarelyHumanBots();
    
    // Handle shutdown gracefully
    process.on('SIGINT', () => {
        runtime.stop();
        runtime.displayStats();
        process.exit(0);
    });

    try {
        await runtime.initialize();
        await runtime.start();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default BarelyHumanBots;