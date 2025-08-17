#!/usr/bin/env node

/**
 * Start series with correct parameters
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

// Correct ABI
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'address' }], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'currentSeriesId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
];

async function startSeriesFixed() {
    console.log(chalk.bold.cyan('🎲 Starting Series with Correct Parameters\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Contract:'), chalk.gray(gameContract));
    console.log(chalk.cyan('Shooter:'), chalk.gray(account.address), '\n');
    
    try {
        // Check current phase
        const currentPhase = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const seriesId = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'currentSeriesId'
        });
        
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        console.log(chalk.yellow('🎮 Current State:'));
        console.log(chalk.gray(`   Phase: ${phaseNames[currentPhase]} (${currentPhase})`));
        console.log(chalk.gray(`   Series ID: ${seriesId}\n`));
        
        if (currentPhase === 0) {
            console.log(chalk.yellow('🚀 Starting new series with shooter address...'));
            
            const startTx = await walletClient.writeContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'startNewSeries',
                args: [account.address], // Shooter address parameter
                gas: 200000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Series started: https://sepolia.basescan.org/tx/${startTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 15000));
            
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
                console.log(chalk.green.bold('🎉 SERIES STARTED SUCCESSFULLY!'));
                console.log(chalk.yellow('🎲 Testing dice roll...'));
                
                const rollTx = await walletClient.writeContract({
                    address: gameContract,
                    abi: CRAPS_GAME_ABI,
                    functionName: 'requestDiceRoll',
                    gas: 300000n,
                    gasPrice: parseGwei('0.1')
                });
                
                console.log(chalk.green.bold(`🎊 VRF dice roll successful!`));
                console.log(chalk.green.bold(`🔗 TX: https://sepolia.basescan.org/tx/${rollTx}`));
                console.log(chalk.bold.cyan('\n🚀 READY FOR ETHGLOBAL DEMO!'));
                
            } else {
                console.log(chalk.red('❌ Series start failed - state not updated'));
            }
            
        } else {
            console.log(chalk.green('✅ Series already active!'));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed:'), error.shortMessage || error.message);
    }
}

startSeriesFixed().catch(console.error);