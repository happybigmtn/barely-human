#!/usr/bin/env node

/**
 * Check VRF subscription consumers to verify they were actually added
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

// VRF Coordinator ABI
const VRF_COORDINATOR_ABI = [
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

async function checkVRFConsumers() {
    console.log(chalk.bold.cyan('🔍 Checking VRF Subscription Consumers\n'));
    
    const coordinator = deployment.vrfConfig.coordinator;
    const subscriptionId = deployment.vrfConfig.subscriptionId;
    const expectedCrapsGame = deployment.contracts.CrapsGameV2Plus;
    const expectedBotManager = deployment.contracts.BotManager;
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   VRF Coordinator: ${coordinator}`));
    console.log(chalk.gray(`   Subscription ID: ${subscriptionId}`));
    console.log(chalk.gray(`   Expected CrapsGame: ${expectedCrapsGame}`));
    console.log(chalk.gray(`   Expected BotManager: ${expectedBotManager}\n`));
    
    try {
        console.log(chalk.yellow('📋 Reading subscription data...'));
        
        const subscriptionData = await publicClient.readContract({
            address: coordinator,
            abi: VRF_COORDINATOR_ABI,
            functionName: 'getSubscription',
            args: [BigInt(subscriptionId)]
        });
        
        const [balance, reqCount, owner, consumers] = subscriptionData;
        
        console.log(chalk.green('✅ Subscription found!'));
        console.log(chalk.gray(`   Balance: ${balance} LINK`));
        console.log(chalk.gray(`   Request Count: ${reqCount}`));
        console.log(chalk.gray(`   Owner: ${owner}`));
        console.log(chalk.gray(`   Total Consumers: ${consumers.length}\n`));
        
        if (consumers.length === 0) {
            console.log(chalk.red('❌ NO CONSUMERS FOUND!'));
            console.log(chalk.yellow('The addConsumer transactions may have failed or not been confirmed'));
            return false;
        }
        
        console.log(chalk.cyan('👥 Current Consumers:'));
        consumers.forEach((consumer, index) => {
            console.log(chalk.gray(`   ${index + 1}. ${consumer}`));
        });
        
        // Check if our contracts are in the list
        const crapsGameAdded = consumers.some(addr => 
            addr.toLowerCase() === expectedCrapsGame.toLowerCase()
        );
        
        const botManagerAdded = consumers.some(addr => 
            addr.toLowerCase() === expectedBotManager.toLowerCase()
        );
        
        console.log(chalk.yellow('\n🎯 Expected Contracts:'));
        console.log(crapsGameAdded ? 
            chalk.green(`   ✅ CrapsGame: ${expectedCrapsGame}`) : 
            chalk.red(`   ❌ CrapsGame: ${expectedCrapsGame} (NOT FOUND)`)
        );
        console.log(botManagerAdded ? 
            chalk.green(`   ✅ BotManager: ${expectedBotManager}`) : 
            chalk.red(`   ❌ BotManager: ${expectedBotManager} (NOT FOUND)`)
        );
        
        if (!crapsGameAdded || !botManagerAdded) {
            console.log(chalk.bold.red('\n💥 ISSUE FOUND: Contracts not properly added as consumers!'));
            console.log(chalk.yellow('This explains why VRF requests are failing.'));
            
            console.log(chalk.bold.cyan('\n🔧 Next Steps:'));
            if (!crapsGameAdded) {
                console.log(chalk.white(`1. Add CrapsGame as consumer: ${expectedCrapsGame}`));
            }
            if (!botManagerAdded) {
                console.log(chalk.white(`2. Add BotManager as consumer: ${expectedBotManager}`));
            }
            console.log(chalk.white('3. Use VRF dashboard: https://vrf.chain.link/base-sepolia'));
            
            return false;
        } else {
            console.log(chalk.bold.green('\n✅ ALL CONTRACTS ARE PROPERLY ADDED AS CONSUMERS!'));
            console.log(chalk.yellow('VRF issue must be something else (gas, parameters, etc.)'));
            return true;
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to read subscription:'), error.message);
        
        if (error.message.includes('returned no data')) {
            console.log(chalk.yellow('\n💡 Subscription not found or wrong coordinator address'));
            console.log(chalk.gray('Check if coordinator address is correct for Base Sepolia'));
        }
        
        return false;
    }
}

checkVRFConsumers()
    .then(success => {
        if (success) {
            console.log(chalk.bold.blue('\n🚀 Ready to investigate other VRF issues'));
        } else {
            console.log(chalk.bold.yellow('\n⚠️  Need to fix consumer setup first'));
        }
    })
    .catch(console.error);