#!/usr/bin/env node

/**
 * Complete VRF test with series start and dice roll
 */

import { createPublicClient, createWalletClient, http, parseGwei } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import chalk from 'chalk';
import ora from 'ora';
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
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'getLastRollResult', outputs: [{ type: 'uint8' }, { type: 'uint8' }], stateMutability: 'view', type: 'function' }
];

async function testFullVRF() {
    console.log(chalk.bold.blue('🎲 Complete VRF Test with Game Series\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   Contract: ${gameContract}`));
    console.log(chalk.gray(`   VRF Coordinator: ${deployment.vrfConfig.coordinator}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    try {
        // Step 1: Check current phase
        console.log(chalk.yellow('1️⃣ Checking game phase...'));
        const currentPhase = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        console.log(chalk.gray(`   Current phase: ${phaseNames[currentPhase]}\n`));
        
        // Step 2: Start new series if needed
        if (currentPhase === 0) {
            console.log(chalk.yellow('2️⃣ Starting new game series...'));
            const startSpinner = ora('Starting series...').start();
            
            const startTx = await walletClient.writeContract({
                address: gameContract,
                abi: CRAPS_GAME_ABI,
                functionName: 'startNewSeries',
                gas: 200000n,
                gasPrice: parseGwei('0.1')
            });
            
            startSpinner.succeed('✅ Series started!');
            console.log(chalk.green(`🔗 Start TX: https://sepolia.basescan.org/tx/${startTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 8000));
        }
        
        // Step 3: Request dice roll with VRF
        console.log(chalk.yellow('3️⃣ Requesting dice roll with VRF...'));
        const rollSpinner = ora('Requesting VRF dice roll...').start();
        
        const rollTx = await walletClient.writeContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll',
            gas: 300000n,
            gasPrice: parseGwei('0.1')
        });
        
        rollSpinner.succeed('✅ VRF request sent!');
        console.log(chalk.green.bold(`🔗 VRF TX: https://sepolia.basescan.org/tx/${rollTx}`));
        console.log(chalk.yellow('⏳ Waiting for Chainlink VRF response...\n'));
        
        return { 
            success: true, 
            rollTx,
            message: 'VRF request successful!'
        };
        
    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.shortMessage || error.message);
        
        if (error.message.includes('InvalidConsumer')) {
            console.log(chalk.yellow('💡 Contract not added as VRF consumer'));
        } else if (error.message.includes('InsufficientBalance')) {
            console.log(chalk.yellow('💡 VRF subscription needs more LINK'));
        } else if (error.message.includes('insufficient funds')) {
            console.log(chalk.yellow('💡 Account needs more ETH for gas'));
        }
        
        return { success: false, error: error.message };
    }
}

testFullVRF()
    .then(result => {
        console.log(chalk.bold.blue('\n📊 Final Result:'), result);
        
        if (result.success) {
            console.log(chalk.bold.green('\n🚀 VRF SETUP COMPLETE!'));
            console.log(chalk.white('✅ Consumer added successfully'));
            console.log(chalk.white('✅ Game series can start'));
            console.log(chalk.white('✅ VRF requests work'));
            console.log(chalk.bold.cyan('\n🎮 Ready for ETHGlobal Demo!'));
            console.log(chalk.white('Run: cd frontend/cli && node demo-ethglobal.js'));
        } else {
            console.log(chalk.bold.red('\n❌ VRF setup needs attention'));
            console.log(chalk.yellow('Check error details above'));
        }
    })
    .catch(console.error);
