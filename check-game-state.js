#!/usr/bin/env node

/**
 * Check current game state and fix series issue
 */

import { createPublicClient, createWalletClient, http, parseGwei } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import chalk from 'chalk';
import fs from 'fs';

// Load deployment and environment
const deployment = JSON.parse(fs.readFileSync('deployments/base-sepolia-deployment.json', 'utf8'));
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key] = value;
    return acc;
}, {});

// Setup clients
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
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'currentSeriesId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getLastRollResult', outputs: [{ type: 'uint8' }, { type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' }
];

async function checkGameState() {
    console.log(chalk.bold.cyan('🎲 Checking Game State\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Contract:'), chalk.gray(gameContract));
    console.log(chalk.cyan('Account:'), chalk.gray(account.address), '\n');
    
    try {
        // Check current phase
        const currentPhase = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        // Check series ID
        const seriesId = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'currentSeriesId'
        });
        
        // Check last roll
        let lastRoll = { die1: 0, die2: 0 };
        try {
            const [die1, die2] = await publicClient.readContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'getLastRollResult'
            });
            lastRoll = { die1, die2 };
        } catch (error) {
            console.log(chalk.gray('No previous roll result'));
        }
        
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        
        console.log(chalk.yellow('🎮 Current Game State:'));
        console.log(chalk.gray(`   Phase: ${phaseNames[currentPhase]} (${currentPhase})`));
        console.log(chalk.gray(`   Series ID: ${seriesId}`));
        console.log(chalk.gray(`   Last Roll: ${lastRoll.die1} + ${lastRoll.die2} = ${lastRoll.die1 + lastRoll.die2}\n`));
        
        if (currentPhase === 0) {
            console.log(chalk.red('❌ Game is in IDLE phase - need to start series'));
            console.log(chalk.yellow('🚀 Starting new series...'));
            
            const startTx = await walletClient.writeContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'startNewSeries',
                gas: 200000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Series started: https://sepolia.basescan.org/tx/${startTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check new state
            const newPhase = await publicClient.readContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'getCurrentPhase'
            });
            
            const newSeriesId = await publicClient.readContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'currentSeriesId'
            });
            
            console.log(chalk.green('✅ New State:'));
            console.log(chalk.gray(`   Phase: ${phaseNames[newPhase]} (${newPhase})`));
            console.log(chalk.gray(`   Series ID: ${newSeriesId}\n`));
            
            if (newPhase > 0) {
                console.log(chalk.green('✅ Game is now ready for dice rolls!'));
                
                // Test a dice roll
                console.log(chalk.yellow('🎲 Testing dice roll...'));
                
                try {
                    const rollTx = await walletClient.writeContract({
                        address: gameContract,
                        abi: CRAPS_GAME_ABI,
                        functionName: 'requestDiceRoll',
                        gas: 300000n,
                        gasPrice: parseGwei('0.1')
                    });
                    
                    console.log(chalk.green.bold(`🎉 Dice roll successful!`));
                    console.log(chalk.green.bold(`🔗 TX: https://sepolia.basescan.org/tx/${rollTx}`));
                    
                } catch (rollError) {
                    console.log(chalk.red('❌ Dice roll failed:'), rollError.shortMessage);
                }
            }
            
        } else {
            console.log(chalk.green('✅ Game has active series and is ready for dice rolls!'));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to check game state:'), error.shortMessage || error.message);
    }
}

checkGameState().catch(console.error);