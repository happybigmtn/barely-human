#!/usr/bin/env node

/**
 * Debug the exact revert reason for requestDiceRoll
 */

import { createPublicClient, createWalletClient, http } from 'viem';
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

// Contract ABI
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' }
];

async function debugRevertReason() {
    console.log(chalk.bold.red('🔍 Debugging Exact Revert Reason\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    try {
        // Try to simulate the call to get detailed error
        console.log(chalk.yellow('🧪 Simulating requestDiceRoll call...'));
        
        const result = await publicClient.simulateContract({
            address: gameContract,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll',
            account: account.address
        });
        
        console.log(chalk.green('✅ Simulation successful! The call should work.'));
        console.log(chalk.gray(`Gas estimate: ${result.request.gas || 'N/A'}`));
        
    } catch (error) {
        console.log(chalk.red('❌ Simulation failed with detailed error:'));
        console.log(chalk.yellow(`Full error: ${error.message}`));
        
        // Try to extract specific revert reasons
        if (error.message.includes('No active series')) {
            console.log(chalk.cyan('\n💡 Issue: No active series'));
            console.log(chalk.gray('   The game phase is IDLE - need to start a new series first'));
        } else if (error.message.includes('AccessControl')) {
            console.log(chalk.cyan('\n💡 Issue: Access control'));
            console.log(chalk.gray('   Account lacks OPERATOR_ROLE permission'));
        } else if (error.message.includes('Pausable')) {
            console.log(chalk.cyan('\n💡 Issue: Contract paused'));
            console.log(chalk.gray('   The contract is in paused state'));
        } else if (error.message.includes('InvalidSubscription')) {
            console.log(chalk.cyan('\n💡 Issue: Invalid subscription'));
            console.log(chalk.gray('   The subscription ID in contract is invalid'));
        } else if (error.message.includes('InsufficientBalance')) {
            console.log(chalk.cyan('\n💡 Issue: Insufficient LINK balance'));
            console.log(chalk.gray('   VRF subscription needs more LINK funding'));
        } else if (error.message.includes('InvalidConsumer')) {
            console.log(chalk.cyan('\n💡 Issue: Invalid consumer'));
            console.log(chalk.gray('   Contract not properly added as consumer'));
        } else if (error.message.includes('execution reverted')) {
            console.log(chalk.cyan('\n💡 Issue: Contract reverted without specific reason'));
            console.log(chalk.gray('   This often means subscription ID mismatch'));
            console.log(chalk.gray('   Contract was likely deployed with old subscription ID'));
        }
        
        // Show the most likely solution
        console.log(chalk.bold.yellow('\n🎯 Most Likely Solution:'));
        console.log(chalk.white('Your contract was deployed with the OLD subscription ID.'));
        console.log(chalk.white('Either:'));
        console.log(chalk.gray('1. Add consumer to OLD subscription: 2237641769...'));
        console.log(chalk.gray('2. Redeploy contract with NEW subscription: 1343255552...'));
        console.log(chalk.gray('3. Use current demo (works perfectly for ETHGlobal)'));
    }
}

debugRevertReason().catch(console.error);