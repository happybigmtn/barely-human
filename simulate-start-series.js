#!/usr/bin/env node

/**
 * Simulate startNewSeries to see revert reason
 */

import { createPublicClient, http } from 'viem';
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

// Setup client
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);

// Contract ABI
const CRAPS_GAME_ABI = [
    { inputs: [{ type: 'address' }], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
];

async function simulateStartSeries() {
    console.log(chalk.bold.cyan('🔍 Simulating startNewSeries Call\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Details:'));
    console.log(chalk.gray(`   Contract: ${gameContract}`));
    console.log(chalk.gray(`   Shooter: ${account.address}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    try {
        // Check current phase first
        const currentPhase = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        console.log(chalk.yellow(`Current Phase: ${phaseNames[currentPhase]} (${currentPhase})\n`));
        
        // Simulate the transaction
        console.log(chalk.yellow('🧪 Simulating startNewSeries...'));
        
        const simulation = await publicClient.simulateContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'startNewSeries',
            args: [account.address],
            account: account.address
        });
        
        console.log(chalk.green('✅ Simulation successful!'));
        console.log(chalk.gray('The transaction should work when executed'));
        console.log(chalk.gray(`Gas estimate: ${simulation.request.gas}`));
        
        return { success: true, simulation };
        
    } catch (error) {
        console.log(chalk.red('❌ Simulation failed:'));
        console.log(chalk.red(`Error: ${error.shortMessage || error.message}`));
        
        // Try to extract more details
        if (error.details) {
            console.log(chalk.yellow('\n📋 Error Details:'));
            console.log(chalk.gray(error.details));
        }
        
        if (error.cause && error.cause.details) {
            console.log(chalk.yellow('\n🔍 Root Cause:'));
            console.log(chalk.gray(error.cause.details));
        }
        
        // Common error interpretations
        if (error.message.includes('Game not in IDLE phase')) {
            console.log(chalk.yellow('\n💡 The game is not in IDLE phase'));
        } else if (error.message.includes('Invalid shooter address')) {
            console.log(chalk.yellow('\n💡 Shooter address is invalid (zero address)'));
        } else if (error.message.includes('AccessControl')) {
            console.log(chalk.yellow('\n💡 Account lacks OPERATOR_ROLE'));
        } else if (error.message.includes('Pausable: paused')) {
            console.log(chalk.yellow('\n💡 Contract is paused'));
        } else if (error.message.includes('ReentrancyGuard')) {
            console.log(chalk.yellow('\n💡 Reentrancy guard active'));
        }
        
        return { success: false, error: error.message };
    }
}

simulateStartSeries()
    .then(result => {
        console.log(chalk.bold.blue('\n📊 Result:'), result.success ? 'Success' : 'Failed');
        
        if (!result.success) {
            console.log(chalk.bold.yellow('\n🔧 Troubleshooting needed:'));
            console.log(chalk.white('1. Check contract initialization'));
            console.log(chalk.white('2. Verify all dependencies are deployed'));
            console.log(chalk.white('3. Check for missing contract setup'));
        }
    })
    .catch(console.error);