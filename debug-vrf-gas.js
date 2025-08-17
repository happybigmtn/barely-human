#!/usr/bin/env node

/**
 * Debug VRF with higher gas limit and detailed error analysis
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
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
];

async function debugVRFGas() {
    console.log(chalk.bold.red('🔍 Debugging VRF with Gas Analysis\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Contract Info:'));
    console.log(chalk.gray(`   Contract: ${gameContract}`));
    console.log(chalk.gray(`   VRF Coordinator: ${deployment.vrfConfig.coordinator}`));
    console.log(chalk.gray(`   Subscription: ${deployment.vrfConfig.subscriptionId}`));
    console.log(chalk.gray(`   Key Hash: ${deployment.vrfConfig.keyHash}\n`));
    
    // Check current phase
    const currentPhase = await publicClient.readContract({
        address: gameContract,
        abi: CRAPS_GAME_ABI,
        functionName: 'getCurrentPhase'
    });
    
    const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
    console.log(chalk.yellow(`Current Phase: ${phaseNames[currentPhase]}\n`));
    
    if (currentPhase === 0) {
        console.log(chalk.red('❌ Game is in IDLE phase'));
        console.log(chalk.yellow('Need to start a series first\n'));
        return;
    }
    
    try {
        // Simulate the call first
        console.log(chalk.yellow('🧪 Simulating requestDiceRoll...'));
        
        const simulation = await publicClient.simulateContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll',
            account: account.address,
            gas: 500000n // Higher gas limit
        });
        
        console.log(chalk.green('✅ Simulation successful!'));
        console.log(chalk.gray(`   Estimated gas: ${simulation.request.gas}`));
        
        // Try with different gas limits
        const gasLimits = [200000n, 300000n, 500000n, 1000000n];
        
        for (const gasLimit of gasLimits) {
            console.log(chalk.yellow(`\n🔥 Trying with ${gasLimit} gas...`));
            
            try {
                const txHash = await walletClient.writeContract({
                    address: gameContract,
                    abi: CRAPS_GAME_ABI,
                    functionName: 'requestDiceRoll',
                    gas: gasLimit,
                    gasPrice: parseGwei('0.1') // Low gas price for testnet
                });
                
                console.log(chalk.green.bold(`✅ SUCCESS with ${gasLimit} gas!`));
                console.log(chalk.green.bold(`🔗 TX: https://sepolia.basescan.org/tx/${txHash}`));
                console.log(chalk.green.bold('🎉 CHAINLINK VRF IS WORKING!'));
                
                return { success: true, txHash, gasUsed: gasLimit };
                
            } catch (error) {
                console.log(chalk.red(`❌ Failed with ${gasLimit} gas: ${error.shortMessage}`));
                
                if (error.message.includes('insufficient funds')) {
                    console.log(chalk.yellow('   💡 Need more ETH for gas'));
                } else if (error.message.includes('InvalidSubscription')) {
                    console.log(chalk.yellow('   💡 Subscription issue'));
                } else if (error.message.includes('InsufficientBalance')) {
                    console.log(chalk.yellow('   💡 Need more LINK in subscription'));
                }
            }
        }
        
    } catch (error) {
        console.log(chalk.red('❌ Simulation failed:'));
        console.log(chalk.gray(`   ${error.message}`));
        
        // Check specific error types
        if (error.message.includes('execution reverted')) {
            console.log(chalk.yellow('\n💡 The contract reverted. Possible causes:'));
            console.log(chalk.gray('   1. Wrong subscription ID in contract'));
            console.log(chalk.gray('   2. Wrong key hash in contract'));
            console.log(chalk.gray('   3. VRF coordinator interface mismatch'));
            console.log(chalk.gray('   4. Insufficient LINK balance'));
            console.log(chalk.gray('   5. Contract not added as consumer'));
        }
    }
    
    console.log(chalk.bold.yellow('\n🔧 Troubleshooting Steps:'));
    console.log(chalk.white('1. Verify subscription has LINK balance'));
    console.log(chalk.white('2. Confirm contract is added as consumer'));
    console.log(chalk.white('3. Check VRF coordinator is correct for Base Sepolia'));
    console.log(chalk.white('4. Ensure key hash matches Base Sepolia requirements'));
}

debugVRFGas().catch(console.error);