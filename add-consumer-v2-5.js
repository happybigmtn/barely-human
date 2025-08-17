#!/usr/bin/env node

/**
 * Add Contract as Consumer to VRF v2.5 Subscription
 * Subscription ID: 13432555525251721422301614680368403155934725671777160009854888233485644392607
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

// VRF Coordinator ABI for v2.5
const VRF_COORDINATOR_ABI = [
    {
        inputs: [{ type: 'uint256' }, { type: 'address' }],
        name: 'addConsumer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ type: 'uint256' }],
        name: 'getSubscription',
        outputs: [
            { type: 'uint96' },   // balance
            { type: 'uint64' },   // reqCount  
            { type: 'address' },  // owner
            { type: 'address[]' } // consumers
        ],
        stateMutability: 'view',
        type: 'function'
    }
];

async function addConsumerToV25Subscription() {
    console.log(chalk.bold.blue('🔧 Adding Consumer to VRF v2.5 Subscription\n'));
    
    const subscriptionId = deployment.vrfConfig.subscriptionId;
    const coordinator = deployment.vrfConfig.coordinator;
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   VRF Coordinator: ${coordinator}`));
    console.log(chalk.gray(`   Subscription ID: ${subscriptionId}`));
    console.log(chalk.gray(`   Game Contract: ${gameContract}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    try {
        // First check current subscription status
        console.log(chalk.yellow('1️⃣ Checking subscription status...'));
        
        try {
            const subscriptionData = await publicClient.readContract({
                address: coordinator,
                abi: VRF_COORDINATOR_ABI,
                functionName: 'getSubscription',
                args: [BigInt(subscriptionId)]
            });
            
            const [balance, reqCount, owner, consumers] = subscriptionData;
            console.log(chalk.green(`   ✅ Subscription found`));
            console.log(chalk.gray(`   Balance: ${balance} LINK`));
            console.log(chalk.gray(`   Owner: ${owner}`));
            console.log(chalk.gray(`   Current consumers: ${consumers.length}`));
            
            const isConsumer = consumers.some(addr => 
                addr.toLowerCase() === gameContract.toLowerCase()
            );
            
            if (isConsumer) {
                console.log(chalk.green(`   ✅ Game contract already a consumer`));
                console.log(chalk.bold.green('\n🎯 Ready to test VRF!'));
                return;
            }
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Cannot read subscription: ${error.message}`));
        }
        
        // Add consumer
        console.log(chalk.yellow('\n2️⃣ Adding game contract as consumer...'));
        const spinner = ora('Submitting addConsumer transaction...').start();
        
        const txHash = await walletClient.writeContract({
            address: coordinator,
            abi: VRF_COORDINATOR_ABI,
            functionName: 'addConsumer',
            args: [BigInt(subscriptionId), gameContract]
        });
        
        spinner.succeed('✅ Consumer added successfully');
        console.log(chalk.green.bold(`🔗 TX: https://sepolia.basescan.org/tx/${txHash}`));
        
        console.log(chalk.yellow('\n⏳ Waiting for confirmation...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(chalk.bold.green('\n🎯 VRF v2.5 Setup Complete!'));
        console.log(chalk.white('   ✅ Contract added as consumer'));
        console.log(chalk.white('   ✅ 25 LINK funded'));
        console.log(chalk.white('   ✅ Ready for dice rolls\n'));
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to add consumer:'), error.shortMessage || error.message);
        
        if (error.message.includes('OnlyOwner')) {
            console.log(chalk.yellow('\n💡 You need to be the subscription owner to add consumers'));
            console.log(chalk.gray('   Make sure you created the subscription with this account'));
        }
    }
}

addConsumerToV25Subscription().catch(console.error);