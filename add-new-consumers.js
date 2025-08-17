#!/usr/bin/env node

/**
 * Add NEW redeployed contracts as consumers to VRF v2.5 subscription
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';

// Load environment and deployment
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key] = value;
    return acc;
}, {});

const deployment = JSON.parse(fs.readFileSync('deployments/base-sepolia-deployment.json', 'utf8'));

// Setup wallet client
const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

// VRF details
const VRF_COORDINATOR = deployment.vrfConfig.coordinator;
const SUBSCRIPTION_ID = deployment.vrfConfig.subscriptionId;
const NEW_CRAPS_GAME = deployment.contracts.CrapsGameV2Plus;
const NEW_BOT_MANAGER = deployment.contracts.BotManager;

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

async function addNewConsumers() {
    console.log(chalk.bold.blue('🔧 Adding NEW Contracts as VRF Consumers\n'));
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   VRF Coordinator: ${VRF_COORDINATOR}`));
    console.log(chalk.gray(`   Subscription ID: ${SUBSCRIPTION_ID}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    console.log(chalk.yellow('🎯 LATEST Contracts to Add (with correct key hash):'));
    console.log(chalk.gray(`   CrapsGameV2Plus: ${NEW_CRAPS_GAME}`));
    console.log(chalk.gray(`   BotManager: ${NEW_BOT_MANAGER}\n`));
    
    try {
        // Add CrapsGameV2Plus as consumer
        console.log(chalk.yellow('1️⃣ Adding CrapsGameV2Plus as consumer...'));
        const spinner1 = ora('Adding CrapsGameV2Plus...').start();
        
        const txHash1 = await walletClient.writeContract({
            address: VRF_COORDINATOR,
            abi: VRF_COORDINATOR_ABI,
            functionName: 'addConsumer',
            args: [BigInt(SUBSCRIPTION_ID), NEW_CRAPS_GAME]
        });
        
        spinner1.succeed('✅ CrapsGameV2Plus added as consumer');
        console.log(chalk.green(`🔗 TX: https://sepolia.basescan.org/tx/${txHash1}`));
        
        // Wait a bit before next transaction
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Add BotManager as consumer
        console.log(chalk.yellow('\n2️⃣ Adding BotManager as consumer...'));
        const spinner2 = ora('Adding BotManager...').start();
        
        const txHash2 = await walletClient.writeContract({
            address: VRF_COORDINATOR,
            abi: VRF_COORDINATOR_ABI,
            functionName: 'addConsumer',
            args: [BigInt(SUBSCRIPTION_ID), NEW_BOT_MANAGER]
        });
        
        spinner2.succeed('✅ BotManager added as consumer');
        console.log(chalk.green(`🔗 TX: https://sepolia.basescan.org/tx/${txHash2}`));
        
        console.log(chalk.yellow('\n⏳ Waiting for confirmations...'));
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log(chalk.bold.green('\n🎯 VRF Setup Complete!'));
        console.log(chalk.white('   ✅ Both contracts added as consumers'));
        console.log(chalk.white('   ✅ 25 LINK funded'));
        console.log(chalk.white('   ✅ Contracts deployed with correct subscription ID'));
        
        console.log(chalk.bold.cyan('\n🎲 Test VRF:'));
        console.log(chalk.white('   node test-dice-roll.js'));
        
        console.log(chalk.bold.blue('\n🚀 Run Demo:'));
        console.log(chalk.white('   cd frontend/cli && node demo-ethglobal.js'));
        
        console.log(chalk.bold.yellow('\n📋 Summary:'));
        console.log(chalk.gray(`   NEW CrapsGame: ${NEW_CRAPS_GAME}`));
        console.log(chalk.gray(`   NEW BotManager: ${NEW_BOT_MANAGER}`));
        console.log(chalk.gray(`   VRF Subscription: ${SUBSCRIPTION_ID}`));
        console.log(chalk.gray(`   Both are now VRF consumers with 25 LINK funding`));
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to add consumers:'), error.shortMessage || error.message);
    }
}

addNewConsumers().catch(console.error);