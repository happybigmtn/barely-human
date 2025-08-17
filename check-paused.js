#!/usr/bin/env node

/**
 * Check if contract is paused and unpause if needed
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

// Pausable ABI
const PAUSABLE_ABI = [
    { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'unpause', outputs: [], stateMutability: 'nonpayable', type: 'function' }
];

const CRAPS_GAME_ABI = [
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'address' }], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'currentSeriesId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
];

async function checkPaused() {
    console.log(chalk.bold.cyan('⏸️  Checking Contract Pause State\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Contract:'), chalk.gray(gameContract));
    console.log(chalk.cyan('Account:'), chalk.gray(account.address), '\n');
    
    try {
        // Check if paused
        const isPaused = await publicClient.readContract({
            address: gameContract,
            abi: PAUSABLE_ABI,
            functionName: 'paused'
        });
        
        console.log(chalk.yellow('⏸️  Pause State:'));
        console.log(isPaused ? 
            chalk.red('   ❌ Contract is PAUSED') : 
            chalk.green('   ✅ Contract is NOT paused')
        );
        
        if (isPaused) {
            console.log(chalk.yellow('\n🔧 Unpausing contract...'));
            
            const unpauseTx = await walletClient.writeContract({
                address: gameContract,
                abi: PAUSABLE_ABI,
                functionName: 'unpause',
                gas: 100000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Unpause TX: https://sepolia.basescan.org/tx/${unpauseTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check pause state again
            const newPauseState = await publicClient.readContract({
                address: gameContract,
                abi: PAUSABLE_ABI,
                functionName: 'paused'
            });
            
            console.log(chalk.green('✅ New Pause State:'));
            console.log(newPauseState ? 
                chalk.red('   ❌ Still PAUSED') : 
                chalk.green('   ✅ Contract UNPAUSED')
            );
        }
        
        // Now try starting series
        console.log(chalk.yellow('\n🚀 Testing series start...'));
        
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
        console.log(chalk.gray(`   Current Phase: ${phaseNames[currentPhase]} (${currentPhase})`));
        console.log(chalk.gray(`   Series ID: ${seriesId}`));
        
        if (currentPhase === 0) {
            console.log(chalk.yellow('📍 Starting new series...'));
            
            const startTx = await walletClient.writeContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'startNewSeries',
                args: [account.address],
                gas: 200000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Series start TX: https://sepolia.basescan.org/tx/${startTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Check final state
            const finalPhase = await publicClient.readContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'getCurrentPhase'
            });
            
            const finalSeriesId = await publicClient.readContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'currentSeriesId'
            });
            
            console.log(chalk.green('🎯 Final State:'));
            console.log(chalk.gray(`   Phase: ${phaseNames[finalPhase]} (${finalPhase})`));
            console.log(chalk.gray(`   Series ID: ${finalSeriesId}`));
            
            if (finalPhase > 0 && finalSeriesId > seriesId) {
                console.log(chalk.bold.green('\n🎉 SUCCESS! Series started and contract is ready!'));
                console.log(chalk.bold.cyan('🚀 Demo is now ready to run with working VRF!'));
            } else {
                console.log(chalk.red('\n❌ Series start failed - state not updated'));
            }
        } else {
            console.log(chalk.green('✅ Series already active!'));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed:'), error.shortMessage || error.message);
        
        if (error.message.includes('Pausable: paused')) {
            console.log(chalk.yellow('💡 Contract is paused - need to unpause first'));
        }
    }
}

checkPaused().catch(console.error);