import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Import contract ABIs
import CrapsGameABI from '../../artifacts/contracts/game/CrapsGame.sol/CrapsGame.json' assert { type: 'json' };
import CrapsBetsABI from '../../artifacts/contracts/game/CrapsBets.sol/CrapsBets.json' assert { type: 'json' };
import BotTokenABI from '../../artifacts/contracts/token/BOTToken.sol/BOTToken.json' assert { type: 'json' };
import VaultABI from '../../artifacts/contracts/vault/CrapsVault.sol/CrapsVault.json' assert { type: 'json' };

export class BlockchainPlugin {
    constructor(config) {
        this.config = config;
        this.chain = config.network === 'mainnet' ? base : baseSepolia;
        
        // Initialize clients
        this.publicClient = createPublicClient({
            chain: this.chain,
            transport: http(config.rpcUrl)
        });
        
        // Initialize wallet for each bot
        this.wallets = new Map();
    }

    async initializeBot(botName, privateKey) {
        const account = privateKeyToAccount(privateKey);
        const walletClient = createWalletClient({
            account,
            chain: this.chain,
            transport: http(this.config.rpcUrl)
        });
        
        this.wallets.set(botName, {
            account,
            walletClient
        });
        
        return account.address;
    }

    // Game state queries
    async getCurrentPhase() {
        try {
            const phase = await this.publicClient.readContract({
                address: this.config.contracts.crapsGame,
                abi: CrapsGameABI.abi,
                functionName: 'getCurrentPhase'
            });
            return ['IDLE', 'COME_OUT', 'POINT'][phase];
        } catch (error) {
            console.error('Error getting phase:', error);
            return 'UNKNOWN';
        }
    }

    async getCurrentPoint() {
        try {
            const point = await this.publicClient.readContract({
                address: this.config.contracts.crapsGame,
                abi: CrapsGameABI.abi,
                functionName: 'getCurrentPoint'
            });
            return Number(point);
        } catch (error) {
            console.error('Error getting point:', error);
            return 0;
        }
    }

    async getLastRoll() {
        try {
            const [die1, die2] = await this.publicClient.readContract({
                address: this.config.contracts.crapsGame,
                abi: CrapsGameABI.abi,
                functionName: 'getLastRoll'
            });
            return {
                die1: Number(die1),
                die2: Number(die2),
                total: Number(die1) + Number(die2)
            };
        } catch (error) {
            console.error('Error getting last roll:', error);
            return { die1: 0, die2: 0, total: 0 };
        }
    }

    // Betting functions
    async placeBet(botName, betType, amount) {
        const wallet = this.wallets.get(botName);
        if (!wallet) {
            throw new Error(`Bot ${botName} not initialized`);
        }

        try {
            // First approve BOT tokens
            const approveTx = await wallet.walletClient.writeContract({
                address: this.config.contracts.botToken,
                abi: BotTokenABI.abi,
                functionName: 'approve',
                args: [this.config.contracts.vault, amount]
            });

            await this.publicClient.waitForTransactionReceipt({ hash: approveTx });

            // Place the bet through the vault
            const betTx = await wallet.walletClient.writeContract({
                address: this.config.contracts.vault,
                abi: VaultABI.abi,
                functionName: 'placeBet',
                args: [betType, amount]
            });

            await this.publicClient.waitForTransactionReceipt({ hash: betTx });

            return {
                success: true,
                txHash: betTx,
                betType,
                amount: amount.toString()
            };
        } catch (error) {
            console.error(`Error placing bet for ${botName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getActiveBets(botName) {
        const wallet = this.wallets.get(botName);
        if (!wallet) {
            throw new Error(`Bot ${botName} not initialized`);
        }

        try {
            const [totalAtRisk, activeBetCount] = await this.publicClient.readContract({
                address: this.config.contracts.crapsBets,
                abi: CrapsBetsABI.abi,
                functionName: 'getPlayerBets',
                args: [wallet.account.address]
            });

            return {
                totalAtRisk: totalAtRisk.toString(),
                activeBetCount: Number(activeBetCount)
            };
        } catch (error) {
            console.error(`Error getting bets for ${botName}:`, error);
            return {
                totalAtRisk: '0',
                activeBetCount: 0
            };
        }
    }

    async getBalance(botName) {
        const wallet = this.wallets.get(botName);
        if (!wallet) {
            throw new Error(`Bot ${botName} not initialized`);
        }

        try {
            const balance = await this.publicClient.readContract({
                address: this.config.contracts.botToken,
                abi: BotTokenABI.abi,
                functionName: 'balanceOf',
                args: [wallet.account.address]
            });

            return balance.toString();
        } catch (error) {
            console.error(`Error getting balance for ${botName}:`, error);
            return '0';
        }
    }

    // Bet type mapping
    getBetTypeId(betName) {
        const betTypes = {
            'PASS': 0,
            'DONT_PASS': 1,
            'COME': 2,
            'DONT_COME': 3,
            'FIELD': 4,
            'YES_2': 5,
            'YES_3': 6,
            'YES_4': 7,
            'YES_5': 8,
            'YES_6': 9,
            'YES_8': 10,
            'YES_9': 11,
            'YES_10': 12,
            'YES_11': 13,
            'YES_12': 14,
            'NO_2': 15,
            'NO_3': 16,
            'NO_4': 17,
            'NO_5': 18,
            'NO_6': 19,
            'NO_8': 20,
            'NO_9': 21,
            'NO_10': 22,
            'NO_11': 23,
            'NO_12': 24,
            'HARD4': 25,
            'HARD6': 26,
            'HARD8': 27,
            'HARD10': 28,
            'ODDS_PASS': 29,
            'ODDS_DONT_PASS': 30,
            'ODDS_COME': 31,
            'ODDS_DONT_COME': 32,
            'FIRE': 33,
            'SMALL': 34,
            'TALL': 35,
            'ALL': 36,
            'HOT_ROLLER': 37,
            'RIDE_LINE': 38,
            'MUGGSY': 39,
            'REPLAY': 40,
            'DIFFERENT_DOUBLES': 41,
            'RESERVED': 42,
            'NEXT_2': 43,
            'NEXT_3': 44,
            'NEXT_4': 45,
            'NEXT_5': 46,
            'NEXT_6': 47,
            'NEXT_7': 48,
            'NEXT_8': 49,
            'NEXT_9': 50,
            'NEXT_10': 51,
            'NEXT_11': 52,
            'NEXT_12': 53,
            'REPEATER_2': 54,
            'REPEATER_3': 55,
            'REPEATER_4': 56,
            'REPEATER_5': 57,
            'REPEATER_6': 58,
            'REPEATER_8': 59,
            'REPEATER_9': 60,
            'REPEATER_10': 61,
            'REPEATER_11': 62,
            'REPEATER_12': 63
        };
        
        return betTypes[betName] ?? -1;
    }

    // Event monitoring
    async subscribeToGameEvents(callback) {
        const unwatch = this.publicClient.watchContractEvent({
            address: this.config.contracts.crapsGame,
            abi: CrapsGameABI.abi,
            eventName: 'DiceRolled',
            onLogs: (logs) => {
                logs.forEach(log => {
                    callback({
                        type: 'DICE_ROLLED',
                        data: {
                            seriesId: log.args.seriesId.toString(),
                            rollNumber: log.args.rollNumber.toString(),
                            die1: Number(log.args.die1),
                            die2: Number(log.args.die2),
                            total: Number(log.args.total),
                            shooter: log.args.shooter
                        }
                    });
                });
            }
        });

        return unwatch;
    }
}

export default BlockchainPlugin;