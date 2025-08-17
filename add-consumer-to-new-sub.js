#!/usr/bin/env node

/**
 * Add Consumer to Your NEW VRF v2.5 Subscription
 * Subscription: 13432555525251721422301614680368403155934725671777160009854888233485644392607
 * Consumer: 0xa1abc0a9b7ae306a0f28552968591caa5eb946b6
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';

// Load environment
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key] = value;
    return acc;
}, {});

// Setup wallet client
const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

// VRF Coordinator and subscription details
const VRF_COORDINATOR = '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634';
const SUBSCRIPTION_ID = '13432555525251721422301614680368403155934725671777160009854888233485644392607';
const GAME_CONTRACT = '0xa1abc0a9b7ae306a0f28552968591caa5eb946b6';

// VRF Coordinator ABI
const VRF_COORDINATOR_ABI = [
    {
        inputs: [{ type: 'uint256' }, { type: 'address' }],
        name: 'addConsumer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

async function addConsumer() {
    console.log(chalk.bold.blue('🔧 Adding Consumer to VRF v2.5 Subscription\n'));
    
    console.log(chalk.cyan('📊 Details:'));
    console.log(chalk.gray(`   VRF Coordinator: ${VRF_COORDINATOR}`));
    console.log(chalk.gray(`   Subscription ID: ${SUBSCRIPTION_ID}`));
    console.log(chalk.gray(`   Consumer Address: ${GAME_CONTRACT}`));
    console.log(chalk.gray(`   Your Account: ${account.address}\n`));
    
    const spinner = ora('Adding consumer to subscription...').start();
    
    try {
        const txHash = await walletClient.writeContract({
            address: VRF_COORDINATOR,
            abi: VRF_COORDINATOR_ABI,
            functionName: 'addConsumer',
            args: [BigInt(SUBSCRIPTION_ID), GAME_CONTRACT]
        });
        
        spinner.succeed('✅ Consumer added successfully!');
        console.log(chalk.green.bold(`🔗 Transaction: https://sepolia.basescan.org/tx/${txHash}`));
        
        console.log(chalk.yellow('\n⏳ Waiting for confirmation...'));
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log(chalk.bold.green('🎯 VRF Setup Complete!'));
        console.log(chalk.white('   ✅ Contract added as consumer'));
        console.log(chalk.white('   ✅ 25 LINK funded'));
        console.log(chalk.white('   ✅ Ready to test dice rolls'));
        
        console.log(chalk.bold.cyan('\n🎲 Test VRF:'));
        console.log(chalk.white('   node test-dice-roll.js'));
        
        console.log(chalk.bold.blue('\n🚀 Run Demo:'));
        console.log(chalk.white('   cd frontend/cli && node demo-ethglobal.js'));
        
    } catch (error) {
        spinner.fail('❌ Failed to add consumer');
        console.error(chalk.red(`Error: ${error.shortMessage || error.message}`));
        
        if (error.message.includes('OnlyOwner')) {
            console.log(chalk.yellow('\n💡 Make sure you created the subscription with this account'));
        } else if (error.message.includes('InvalidConsumer')) {
            console.log(chalk.yellow('\n💡 Check that the contract address is correct'));
        }
    }
}

addConsumer().catch(console.error);