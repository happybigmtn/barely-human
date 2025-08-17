#!/usr/bin/env node

/**
 * Test VRF v2.5 subscription access with proper data types
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

// VRF v2.5 Coordinator ABI - updated for v2.5
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
    },
    {
        inputs: [{ type: 'uint256' }, { type: 'address' }],
        name: 'addConsumer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
];

async function testVRFSubscription() {
    console.log(chalk.bold.cyan('🔍 Testing VRF v2.5 Subscription Access\n'));
    
    const coordinator = deployment.vrfConfig.coordinator;
    const subscriptionId = deployment.vrfConfig.subscriptionId;
    
    console.log(chalk.cyan('📊 Configuration:'));
    console.log(chalk.gray(`   VRF Coordinator: ${coordinator}`));
    console.log(chalk.gray(`   Subscription ID: ${subscriptionId}`));
    console.log(chalk.gray(`   Subscription ID (hex): 0x${BigInt(subscriptionId).toString(16)}`));
    console.log(chalk.gray(`   Expected CrapsGame: ${deployment.contracts.CrapsGameV2Plus}`));
    console.log(chalk.gray(`   Expected BotManager: ${deployment.contracts.BotManager}\n`));
    
    try {
        console.log(chalk.yellow('📋 Attempting to read subscription...'));
        
        // Try with smaller number first to test coordinator
        console.log(chalk.gray('Testing with subscription ID: 1'));
        try {
            await publicClient.readContract({
                address: coordinator,
                abi: VRF_COORDINATOR_ABI,
                functionName: 'getSubscription',
                args: [1n]
            });
            console.log(chalk.green('✅ Coordinator responds to getSubscription calls'));
        } catch (testError) {
            console.log(chalk.yellow(`Test call failed: ${testError.shortMessage}`));
        }
        
        // Now try our actual subscription ID
        console.log(chalk.gray(`\nTesting with our subscription ID...`));
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
            return { hasConsumers: false, needsConsumers: true };
        }
        
        console.log(chalk.cyan('👥 Current Consumers:'));
        consumers.forEach((consumer, index) => {
            console.log(chalk.gray(`   ${index + 1}. ${consumer}`));
        });
        
        // Check if our contracts are in the list
        const crapsGameAdded = consumers.some(addr => 
            addr.toLowerCase() === deployment.contracts.CrapsGameV2Plus.toLowerCase()
        );
        
        const botManagerAdded = consumers.some(addr => 
            addr.toLowerCase() === deployment.contracts.BotManager.toLowerCase()
        );
        
        console.log(chalk.yellow('\n🎯 Expected Contracts:'));
        console.log(crapsGameAdded ? 
            chalk.green(`   ✅ CrapsGame: ${deployment.contracts.CrapsGameV2Plus}`) : 
            chalk.red(`   ❌ CrapsGame: ${deployment.contracts.CrapsGameV2Plus} (NOT FOUND)`)
        );
        console.log(botManagerAdded ? 
            chalk.green(`   ✅ BotManager: ${deployment.contracts.BotManager}`) : 
            chalk.red(`   ❌ BotManager: ${deployment.contracts.BotManager} (NOT FOUND)`)
        );
        
        return {
            hasConsumers: consumers.length > 0,
            needsConsumers: !crapsGameAdded || !botManagerAdded,
            crapsGameAdded,
            botManagerAdded
        };
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to read subscription:'), error.shortMessage || error.message);
        
        if (error.message.includes('returned no data')) {
            console.log(chalk.yellow('\n💡 Subscription not found or wrong coordinator address'));
        } else if (error.message.includes('out of bounds')) {
            console.log(chalk.yellow('\n💡 Subscription ID format issue - might be VRF v2.5 vs v2.0 mismatch'));
        }
        
        return { hasConsumers: false, needsConsumers: true, error: error.message };
    }
}

testVRFSubscription()
    .then(result => {
        console.log(chalk.bold.blue('\n📊 Result:'), result);
        if (result.needsConsumers) {
            console.log(chalk.bold.yellow('⚠️  Need to add contracts as consumers through Chainlink dashboard'));
            console.log(chalk.white('🌐 Dashboard: https://vrf.chain.link/base-sepolia'));
        } else {
            console.log(chalk.bold.green('✅ VRF setup is complete!'));
        }
    })
    .catch(console.error);