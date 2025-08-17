#!/usr/bin/env node

/**
 * Reset game to IDLE phase by ending current series
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

// Contract ABI
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'currentSeriesId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'endCurrentSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' }
];

async function resetGameToIdle() {
    console.log(chalk.bold.cyan('🎮 Resetting Game to IDLE Phase\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Current State:'));
    console.log(chalk.gray(`   Contract: ${gameContract}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
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
        console.log(chalk.yellow('🎯 Current Game State:'));
        console.log(chalk.gray(`   Phase: ${phaseNames[currentPhase]} (${currentPhase})`));
        console.log(chalk.gray(`   Series ID: ${seriesId}\n`));
        
        if (currentPhase === 0) {
            console.log(chalk.green('✅ Game is already in IDLE phase!'));
            return { success: true, alreadyIdle: true };
        }
        
        // End current series to reset to IDLE
        console.log(chalk.yellow('🔄 Ending current series to reset to IDLE...'));
        
        const endTx = await walletClient.writeContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'endCurrentSeries',
            gas: 200000n,
            gasPrice: parseGwei('0.1')
        });
        
        console.log(chalk.green(`✅ Series ended successfully!`));
        console.log(chalk.green(`🔗 TX: https://sepolia.basescan.org/tx/${endTx}`));
        
        // Wait for confirmation
        console.log(chalk.gray('⏳ Waiting for confirmation...'));
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Verify new state
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
        
        console.log(chalk.green('\n🎉 New Game State:'));
        console.log(chalk.green(`   Phase: ${phaseNames[newPhase]} (${newPhase})`));
        console.log(chalk.green(`   Series ID: ${newSeriesId}`));
        
        if (newPhase === 0) {
            console.log(chalk.bold.green('\n✅ SUCCESS: Game reset to IDLE phase!'));
            console.log(chalk.bold.green('🎮 Demo can now start new series properly!'));
            return { success: true, endTx, newPhase, newSeriesId };
        } else {
            console.log(chalk.yellow('\n⚠️  Game not in IDLE phase yet - may need another roll'));
            return { success: false, newPhase, newSeriesId };
        }
        
    } catch (error) {
        console.error(chalk.red('\n❌ Reset failed:'), error.shortMessage || error.message);
        
        if (error.message.includes('AccessControl')) {
            console.log(chalk.yellow('💡 Access control issue - need OPERATOR_ROLE'));
        } else if (error.message.includes('no active series')) {
            console.log(chalk.yellow('💡 No active series to end'));
        }
        
        return { success: false, error: error.message };
    }
}

resetGameToIdle()
    .then(result => {
        console.log(chalk.bold.blue('\n📊 Reset Result:'), result);
        
        if (result.success) {
            if (result.alreadyIdle) {
                console.log(chalk.bold.green('🎯 Game was already in IDLE phase - demo ready!'));
            } else {
                console.log(chalk.bold.green('🎯 Game successfully reset - demo ready!'));
            }
        } else {
            console.log(chalk.bold.red('❌ Reset failed - demo may still encounter issues'));
        }
    })
    .catch(console.error);