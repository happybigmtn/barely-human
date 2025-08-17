#!/usr/bin/env node

/**
 * Debug Treasury contract calls to understand why they're failing
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

// Treasury ABI
const TREASURY_ABI = [
    { inputs: [], name: 'distributeBotFees', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [{ type: 'address' }, { type: 'uint256' }], name: 'receiveFees', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'DISTRIBUTOR_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'VAULT_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'hasRole', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'grantRole', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'DEFAULT_ADMIN_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'address' }], name: 'accumulatedFees', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
];

async function debugTreasury() {
    console.log(chalk.bold.cyan('🔍 Debugging Treasury Contract\n'));
    
    const treasuryContract = deployment.contracts.Treasury;
    
    console.log(chalk.cyan('📊 Contract Info:'));
    console.log(chalk.gray(`   Treasury: ${treasuryContract}`));
    console.log(chalk.gray(`   Account: ${account.address}\n`));
    
    try {
        // 1. Check roles
        console.log(chalk.yellow('1️⃣ Checking roles...'));
        
        const defaultAdminRole = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'DEFAULT_ADMIN_ROLE'
        });
        
        const distributorRole = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'DISTRIBUTOR_ROLE'
        });
        
        const vaultRole = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'VAULT_ROLE'
        });
        
        const hasAdmin = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'hasRole',
            args: [defaultAdminRole, account.address]
        });
        
        const hasDistributor = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'hasRole',
            args: [distributorRole, account.address]
        });
        
        const hasVault = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'hasRole',
            args: [vaultRole, account.address]
        });
        
        console.log(chalk.gray(`   DEFAULT_ADMIN_ROLE: ${defaultAdminRole}`));
        console.log(chalk.gray(`   DISTRIBUTOR_ROLE: ${distributorRole}`));
        console.log(chalk.gray(`   VAULT_ROLE: ${vaultRole}`));
        console.log(hasAdmin ? chalk.green('   ✅ Has admin role') : chalk.red('   ❌ Missing admin role'));
        console.log(hasDistributor ? chalk.green('   ✅ Has distributor role') : chalk.red('   ❌ Missing distributor role'));
        console.log(hasVault ? chalk.green('   ✅ Has vault role') : chalk.red('   ❌ Missing vault role'));
        
        // 2. Grant roles if needed
        if (hasAdmin && !hasDistributor) {
            console.log(chalk.yellow('\n2️⃣ Granting distributor role...'));
            
            const grantTx = await walletClient.writeContract({
                address: treasuryContract,
                abi: TREASURY_ABI,
                functionName: 'grantRole',
                args: [distributorRole, account.address],
                gas: 100000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Distributor role granted: https://sepolia.basescan.org/tx/${grantTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...'));
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        if (hasAdmin && !hasVault) {
            console.log(chalk.yellow('\n3️⃣ Granting vault role...'));
            
            const grantVaultTx = await walletClient.writeContract({
                address: treasuryContract,
                abi: TREASURY_ABI,
                functionName: 'grantRole',
                args: [vaultRole, account.address],
                gas: 100000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Vault role granted: https://sepolia.basescan.org/tx/${grantVaultTx}`));
            console.log(chalk.gray('⏳ Waiting for confirmation...\n'));
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // 4. Check accumulated fees
        console.log(chalk.yellow('4️⃣ Checking accumulated fees...'));
        
        const botTokenFees = await publicClient.readContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'accumulatedFees',
            args: [deployment.contracts.BOTToken]
        });
        
        console.log(chalk.gray(`   BOT token fees: ${botTokenFees} wei (${Number(botTokenFees) / 1e18} BOT)`));
        
        // 5. Test receiveFees if no fees
        if (botTokenFees === 0n) {
            console.log(chalk.yellow('\n5️⃣ Adding test fees...'));
            
            const testAmount = 1000n * 10n**18n; // 1000 BOT
            
            const feesTx = await walletClient.writeContract({
                address: treasuryContract,
                abi: TREASURY_ABI,
                functionName: 'receiveFees',
                args: [deployment.contracts.BOTToken, testAmount],
                gas: 200000n,
                gasPrice: parseGwei('0.1')
            });
            
            console.log(chalk.green(`✅ Test fees added: https://sepolia.basescan.org/tx/${feesTx}`));
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // 6. Test distributeBotFees
        console.log(chalk.yellow('\n6️⃣ Testing distributeBotFees...'));
        
        const distributeTx = await walletClient.writeContract({
            address: treasuryContract,
            abi: TREASURY_ABI,
            functionName: 'distributeBotFees',
            gas: 400000n,
            gasPrice: parseGwei('0.1')
        });
        
        console.log(chalk.bold.green('🎉 SUCCESS! Distribution worked!'));
        console.log(chalk.green(`🔗 Distribution TX: https://sepolia.basescan.org/tx/${distributeTx}`));
        
        return { success: true, distributeTx };
        
    } catch (error) {
        console.error(chalk.red('\n❌ Debug failed:'), error.shortMessage || error.message);
        
        if (error.message.includes('AccessControl')) {
            console.log(chalk.yellow('💡 Access control issue - need proper role'));
        } else if (error.message.includes('InsufficientBalance')) {
            console.log(chalk.yellow('💡 No fees to distribute'));
        } else if (error.message.includes('execution reverted')) {
            console.log(chalk.yellow('💡 Contract reverted - check requirements'));
        }
        
        return { success: false, error: error.message };
    }
}

debugTreasury()
    .then(result => {
        console.log(chalk.bold.blue('\n📊 Debug Result:'), result);
        
        if (result.success) {
            console.log(chalk.bold.green('✅ Treasury functions work - can use in demo!'));
        } else {
            console.log(chalk.bold.yellow('⚠️  Need to fix Treasury setup first'));
        }
    })
    .catch(console.error);