#!/usr/bin/env node

/**
 * Check roles and permissions
 */

import { createPublicClient, createWalletClient, http, parseGwei, keccak256, toHex } from 'viem';
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

// Contract ABIs
const ACCESS_CONTROL_ABI = [
    { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'hasRole', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'grantRole', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'DEFAULT_ADMIN_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' }
];

const CRAPS_GAME_ABI = [
    { inputs: [], name: 'getCurrentPhase', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'startNewSeries', outputs: [], stateMutability: 'nonpayable', type: 'function' }
];

async function checkRoles() {
    console.log(chalk.bold.cyan('🔐 Checking Roles and Permissions\n'));
    
    const gameContract = deployment.contracts.CrapsGameV2Plus;
    
    console.log(chalk.cyan('📊 Contract:'), chalk.gray(gameContract));
    console.log(chalk.cyan('Account:'), chalk.gray(account.address), '\n');
    
    try {
        // Check DEFAULT_ADMIN_ROLE
        const defaultAdminRole = await publicClient.readContract({
            address: gameContract,
            abi: ACCESS_CONTROL_ABI,
            functionName: 'DEFAULT_ADMIN_ROLE'
        });
        
        // Common roles
        const operatorRole = keccak256(toHex('OPERATOR_ROLE'));
        const settlementRole = keccak256(toHex('SETTLEMENT_ROLE'));
        
        console.log(chalk.yellow('🎯 Role Definitions:'));
        console.log(chalk.gray(`   DEFAULT_ADMIN_ROLE: ${defaultAdminRole}`));
        console.log(chalk.gray(`   OPERATOR_ROLE: ${operatorRole}`));
        console.log(chalk.gray(`   SETTLEMENT_ROLE: ${settlementRole}\n`));
        
        // Check if account has roles
        const hasAdmin = await publicClient.readContract({
            address: gameContract,
            abi: ACCESS_CONTROL_ABI,
            functionName: 'hasRole',
            args: [defaultAdminRole, account.address]
        });
        
        const hasOperator = await publicClient.readContract({
            address: gameContract,
            abi: ACCESS_CONTROL_ABI,
            functionName: 'hasRole',
            args: [operatorRole, account.address]
        });
        
        const hasSettlement = await publicClient.readContract({
            address: gameContract,
            abi: ACCESS_CONTROL_ABI,
            functionName: 'hasRole',
            args: [settlementRole, account.address]
        });
        
        console.log(chalk.yellow('👤 Account Permissions:'));
        console.log(hasAdmin ? 
            chalk.green('   ✅ DEFAULT_ADMIN_ROLE') : 
            chalk.red('   ❌ DEFAULT_ADMIN_ROLE')
        );
        console.log(hasOperator ? 
            chalk.green('   ✅ OPERATOR_ROLE') : 
            chalk.red('   ❌ OPERATOR_ROLE')
        );
        console.log(hasSettlement ? 
            chalk.green('   ✅ SETTLEMENT_ROLE') : 
            chalk.red('   ❌ SETTLEMENT_ROLE')
        );
        
        if (!hasOperator) {
            console.log(chalk.red('\n❌ Account missing OPERATOR_ROLE - needed for startNewSeries'));
            console.log(chalk.yellow('🔧 Granting OPERATOR_ROLE...'));
            
            if (hasAdmin) {
                const grantTx = await walletClient.writeContract({
                    address: gameContract,
                    abi: ACCESS_CONTROL_ABI,
                    functionName: 'grantRole',
                    args: [operatorRole, account.address],
                    gas: 100000n,
                    gasPrice: parseGwei('0.1')
                });
                
                console.log(chalk.green(`✅ Role granted: https://sepolia.basescan.org/tx/${grantTx}`));
                console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // Test series start again
                console.log(chalk.yellow('🚀 Testing series start with new role...'));
                
                const startTx = await walletClient.writeContract({
                    address: gameContract,
                    abi: CRAPS_GAME_ABI,
                    functionName: 'startNewSeries',
                    gas: 200000n,
                    gasPrice: parseGwei('0.1')
                });
                
                console.log(chalk.green(`✅ Series start: https://sepolia.basescan.org/tx/${startTx}`));
                
            } else {
                console.log(chalk.red('❌ Account lacks admin role to grant permissions'));
                console.log(chalk.yellow('💡 Need contract owner to grant OPERATOR_ROLE'));
            }
        } else {
            console.log(chalk.green('\n✅ Account has all necessary roles'));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to check roles:'), error.shortMessage || error.message);
    }
}

checkRoles().catch(console.error);