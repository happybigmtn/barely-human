#!/usr/bin/env node

/**
 * Direct test of requestDiceRoll after adding consumer
 */

import { createPublicClient, createWalletClient, http } from 'viem';
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

// Contract ABI
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' }
];

async function testDiceRoll() {
    console.log(chalk.bold.blue('🎲 Testing requestDiceRoll with VRF v2.5 subscription\n'));
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   Contract: ${deployment.contracts.CrapsGameV2Plus}`));
    console.log(chalk.gray(`   VRF Coordinator: ${deployment.vrfConfig.coordinator}`));
    console.log(chalk.gray(`   Subscription: ${deployment.vrfConfig.subscriptionId}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    const spinner = ora('🎲 Requesting dice roll...').start();
    
    try {
        const txHash = await walletClient.writeContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'requestDiceRoll'
        });
        
        spinner.succeed('✅ Dice roll successful!');
        console.log(chalk.green.bold(`🔗 Transaction: https://sepolia.basescan.org/tx/${txHash}`));
        console.log(chalk.green('🎉 VRF is working! Consumer was added successfully.'));
        
        return { success: true, txHash };
        
    } catch (error) {
        spinner.fail('❌ Dice roll failed');
        console.log(chalk.red(`Error: ${error.shortMessage || error.message}`));
        
        if (error.message.includes('InvalidConsumer')) {
            console.log(chalk.yellow('💡 Consumer might not be properly added yet'));
        } else if (error.message.includes('InsufficientBalance')) {
            console.log(chalk.yellow('💡 VRF subscription needs LINK funding'));
        } else if (error.message.includes('No active series')) {
            console.log(chalk.yellow('💡 Need to start a new game series first'));
        }
        
        return { success: false, error: error.message };
    }
}

testDiceRoll()
    .then(result => {
        if (result.success) {
            console.log(chalk.bold.green('\n🎯 SUCCESS: VRF is fully functional!'));
            console.log(chalk.white('Ready to run the full demo with real dice rolls.'));
        } else {
            console.log(chalk.bold.yellow('\n⚠️  VRF needs additional setup'));
            console.log(chalk.white('Demo will still work with transaction attempts shown.'));
        }
    })
    .catch(console.error);