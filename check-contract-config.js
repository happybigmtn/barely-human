#!/usr/bin/env node

/**
 * Check if contract is properly configured with new subscription ID
 */

import { createPublicClient, http } from 'viem';
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

// Contract ABI to check configuration
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'subscriptionId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'keyHash', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 's_vrfCoordinator', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' }
];

async function checkContractConfig() {
    console.log(chalk.bold.cyan('🔍 Checking Contract VRF Configuration\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    console.log(chalk.gray(`Contract: ${gameContract}\n`));
    
    try {
        // Check subscription ID
        const contractSubId = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'subscriptionId'
        });
        
        const expectedSubId = BigInt(deployment.vrfConfig.subscriptionId);
        
        console.log(chalk.yellow('📊 Subscription ID:'));
        console.log(chalk.gray(`   Contract has: ${contractSubId.toString()}`));
        console.log(chalk.gray(`   Expected:     ${expectedSubId.toString()}`));
        
        if (contractSubId === expectedSubId) {
            console.log(chalk.green('   ✅ Subscription ID matches\n'));
        } else {
            console.log(chalk.red('   ❌ Subscription ID mismatch!\n'));
            console.log(chalk.yellow('💡 The contract was deployed with the old subscription ID'));
            console.log(chalk.gray('   You need to either:'));
            console.log(chalk.gray('   1. Redeploy contract with new subscription ID, OR'));
            console.log(chalk.gray('   2. Use the original subscription ID\n'));
        }
        
        // Check coordinator
        const contractCoordinator = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 's_vrfCoordinator'
        });
        
        console.log(chalk.yellow('📊 VRF Coordinator:'));
        console.log(chalk.gray(`   Contract has: ${contractCoordinator}`));
        console.log(chalk.gray(`   Expected:     ${deployment.vrfConfig.coordinator}`));
        
        if (contractCoordinator.toLowerCase() === deployment.vrfConfig.coordinator.toLowerCase()) {
            console.log(chalk.green('   ✅ Coordinator matches\n'));
        } else {
            console.log(chalk.red('   ❌ Coordinator mismatch!\n'));
        }
        
        // Check key hash
        const contractKeyHash = await publicClient.readContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'keyHash'
        });
        
        console.log(chalk.yellow('📊 Key Hash:'));
        console.log(chalk.gray(`   Contract has: ${contractKeyHash}`));
        console.log(chalk.gray(`   Expected:     ${deployment.vrfConfig.keyHash}`));
        
        if (contractKeyHash === deployment.vrfConfig.keyHash) {
            console.log(chalk.green('   ✅ Key hash matches\n'));
        } else {
            console.log(chalk.red('   ❌ Key hash mismatch!\n'));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to check config:'), error.message);
    }
}

checkContractConfig().catch(console.error);