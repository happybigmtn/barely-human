#!/usr/bin/env node

/**
 * Debug VRF requestDiceRoll Revert Issue
 * Check all possible failure conditions
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
const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL)
});

// Extended ABI for debugging
const CRAPS_GAME_ABI = [
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'OPERATOR_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'hasRole', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'requestDiceRoll', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' }
];

// VRF Coordinator ABI (simplified)
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

async function debugVRFIssue() {
    console.log(chalk.bold.red('🔍 Debugging requestDiceRoll Revert Issue\n'));
    
    console.log(chalk.cyan('📊 Contract Information:'));
    console.log(chalk.gray(`   Game Contract: ${deployment.contracts.CrapsGameV2Plus}`));
    console.log(chalk.gray(`   VRF Coordinator: ${deployment.vrfConfig.coordinator}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    try {
        // 1. Check current phase
        console.log(chalk.yellow('1️⃣ Checking game phase...'));
        const currentPhase = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'getCurrentPhase'
        });
        
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        console.log(chalk.green(`   Phase: ${phaseNames[currentPhase]} (${currentPhase})`));
        
        if (currentPhase === 0) {
            console.log(chalk.red('   ❌ ISSUE: Phase is IDLE - no active series'));
            console.log(chalk.yellow('   💡 FIX: Need to start a new series first'));
        } else {
            console.log(chalk.green('   ✅ Phase is active (not IDLE)'));
        }
        
        // 2. Check OPERATOR_ROLE
        console.log(chalk.yellow('\n2️⃣ Checking OPERATOR_ROLE...'));
        const operatorRole = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'OPERATOR_ROLE'
        });
        
        const hasRole = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'hasRole',
            args: [operatorRole, account.address]
        });
        
        if (hasRole) {
            console.log(chalk.green('   ✅ Account has OPERATOR_ROLE'));
        } else {
            console.log(chalk.red('   ❌ ISSUE: Account lacks OPERATOR_ROLE'));
            console.log(chalk.yellow('   💡 FIX: Grant OPERATOR_ROLE to account'));
        }
        
        // 3. Check if contract is paused
        console.log(chalk.yellow('\n3️⃣ Checking contract pause state...'));
        const isPaused = await publicClient.readContract({
            address: deployment.contracts.CrapsGameV2Plus,
            abi: CRAPS_GAME_ABI,
            functionName: 'paused'
        });
        
        if (isPaused) {
            console.log(chalk.red('   ❌ ISSUE: Contract is paused'));
            console.log(chalk.yellow('   💡 FIX: Unpause the contract'));
        } else {
            console.log(chalk.green('   ✅ Contract is not paused'));
        }
        
        // 4. Check VRF subscription
        console.log(chalk.yellow('\n4️⃣ Checking VRF subscription...'));
        try {
            const subscriptionData = await publicClient.readContract({
                address: deployment.vrfConfig.coordinator,
                abi: VRF_COORDINATOR_ABI,
                functionName: 'getSubscription',
                args: [BigInt(deployment.vrfConfig.subscriptionId)]
            });
            
            const [balance, reqCount, owner, consumers] = subscriptionData;
            console.log(chalk.green(`   ✅ Subscription ID: ${deployment.vrfConfig.subscriptionId}`));
            console.log(chalk.gray(`   Balance: ${balance} LINK`));
            console.log(chalk.gray(`   Request Count: ${reqCount}`));
            console.log(chalk.gray(`   Owner: ${owner}`));
            console.log(chalk.gray(`   Consumers: ${consumers.length}`));
            
            const gameIsConsumer = consumers.includes(deployment.contracts.CrapsGameV2Plus.toLowerCase());
            if (gameIsConsumer) {
                console.log(chalk.green('   ✅ Game contract is authorized consumer'));
            } else {
                console.log(chalk.red('   ❌ ISSUE: Game contract not in consumer list'));
                console.log(chalk.yellow('   💡 FIX: Add game contract as VRF consumer'));
            }
            
            if (balance === 0n) {
                console.log(chalk.red('   ❌ ISSUE: VRF subscription has no LINK balance'));
                console.log(chalk.yellow('   💡 FIX: Fund the VRF subscription with LINK tokens'));
            }
            
        } catch (error) {
            console.log(chalk.red(`   ❌ ISSUE: Cannot read VRF subscription`));
            console.log(chalk.gray(`   Error: ${error.shortMessage || error.message}`));
        }
        
        // 5. Try to simulate the call
        console.log(chalk.yellow('\n5️⃣ Attempting to simulate requestDiceRoll...'));
        try {
            const result = await publicClient.simulateContract({
                address: deployment.contracts.CrapsGameV2Plus,
                abi: CRAPS_GAME_ABI,
                functionName: 'requestDiceRoll',
                account: account.address
            });
            
            console.log(chalk.green('   ✅ Simulation successful - call should work'));
            console.log(chalk.gray(`   Estimated gas: ${result.request.gas || 'N/A'}`));
            
        } catch (error) {
            console.log(chalk.red('   ❌ ISSUE: Simulation failed'));
            console.log(chalk.gray(`   Error: ${error.shortMessage || error.message}`));
            
            // Parse revert reason
            if (error.message.includes('No active series')) {
                console.log(chalk.yellow('   💡 Root cause: No active series (need to start series first)'));
            } else if (error.message.includes('AccessControl')) {
                console.log(chalk.yellow('   💡 Root cause: Missing OPERATOR_ROLE permission'));
            } else if (error.message.includes('Pausable')) {
                console.log(chalk.yellow('   💡 Root cause: Contract is paused'));
            } else if (error.message.includes('VRF') || error.message.includes('coordinator')) {
                console.log(chalk.yellow('   💡 Root cause: VRF subscription or coordinator issue'));
            }
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Debug failed:'), error.message);
    }
    
    console.log(chalk.bold.blue('\n🔧 NEXT STEPS:'));
    console.log(chalk.white('1. Ensure game series is active (not IDLE phase)'));
    console.log(chalk.white('2. Verify OPERATOR_ROLE is granted'));
    console.log(chalk.white('3. Check contract is not paused'));
    console.log(chalk.white('4. Verify VRF subscription funding and consumer authorization'));
}

debugVRFIssue().catch(console.error);