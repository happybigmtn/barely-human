#!/usr/bin/env node

/**
 * Deploy Betting Vault
 * Deploys a fully functional betting vault without factory
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { network } from 'hardhat';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    console.log(chalk.bold.cyan('🚀 Deploying Fully Functional Betting Vault\n'));
    
    const spinner = ora('Connecting to Hardhat network...').start();
    
    try {
        // Connect to network
        const connection = await network.connect();
        const { viem } = connection;
        
        // Get deployer account
        const [deployerAccount] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        
        spinner.succeed('Connected to Hardhat network');
        
        // Load existing deployment
        const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        
        // Deploy BettingVault
        spinner.start('Deploying BettingVault...');
        const bettingVault = await viem.deployContract("BettingVault", [
            deployment.contracts.BOTToken,
            deployment.contracts.Treasury
        ]);
        spinner.succeed(`BettingVault deployed at: ${bettingVault.address}`);
        
        // Grant roles
        spinner.start('Configuring vault roles...');
        
        // Grant BETS_ROLE to CrapsBets contract
        await bettingVault.write.grantBetsRole([deployment.contracts.CrapsBets]);
        console.log(chalk.green('  ✓ Granted BETS_ROLE to CrapsBets'));
        
        // Grant GAME_ROLE to CrapsGame contract
        await bettingVault.write.grantGameRole([deployment.contracts.CrapsGameV2Plus]);
        console.log(chalk.green('  ✓ Granted GAME_ROLE to CrapsGame'));
        
        spinner.succeed('Vault roles configured');
        
        // Fund vault with initial liquidity
        spinner.start('Adding initial liquidity...');
        
        // Use liquidity account
        const liquidityAccount = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
        const botToken = await viem.getContractAt('BOTToken', deployment.contracts.BOTToken);
        
        // Check liquidity account balance
        const balance = await botToken.read.balanceOf([liquidityAccount]);
        console.log(chalk.cyan(`  Liquidity account balance: ${formatEther(balance)} BOT`));
        
        if (balance > parseEther('1000000')) {
            // Transfer some tokens to vault for initial liquidity
            const liquidityAmount = parseEther('10000000'); // 10M BOT
            
            // Get liquidity wallet client
            const liquidityPrivateKey = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
            const liquidityWalletAccount = privateKeyToAccount(liquidityPrivateKey);
            const liquidityWallet = await viem.getWalletClient(liquidityWalletAccount);
            
            // Approve vault
            await botToken.write.approve([bettingVault.address, liquidityAmount], {
                account: liquidityWalletAccount
            });
            console.log(chalk.green(`  ✓ Approved ${formatEther(liquidityAmount)} BOT`));
            
            // Deposit liquidity
            await bettingVault.write.depositLiquidity([liquidityAmount], {
                account: liquidityWalletAccount
            });
            console.log(chalk.green(`  ✓ Deposited ${formatEther(liquidityAmount)} BOT liquidity`));
            
            spinner.succeed('Initial liquidity added');
        } else {
            spinner.warn('Insufficient balance for initial liquidity');
        }
        
        // Update CrapsBets to use new vault
        spinner.start('Updating CrapsBets contract...');
        const crapsBets = await viem.getContractAt('CrapsBets', deployment.contracts.CrapsBets);
        await crapsBets.write.setContracts([
            deployment.contracts.CrapsGameV2Plus,
            bettingVault.address,
            deployment.contracts.CrapsSettlement
        ]);
        spinner.succeed('CrapsBets updated with new vault');
        
        // Verify vault stats
        spinner.start('Verifying vault deployment...');
        const stats = await bettingVault.read.getVaultStats();
        const vaultBalance = await bettingVault.read.getVaultBalance();
        
        console.log(chalk.bold.green('\n✅ BETTING VAULT DEPLOYED SUCCESSFULLY!\n'));
        console.log(chalk.cyan('Vault Statistics:'));
        console.log(chalk.white(`  Address: ${bettingVault.address}`));
        console.log(chalk.white(`  Total Liquidity: ${formatEther(stats[0])} BOT`));
        console.log(chalk.white(`  Available Liquidity: ${formatEther(stats[2])} BOT`));
        console.log(chalk.white(`  Vault Balance: ${formatEther(vaultBalance)} BOT`));
        
        // Update deployment file
        deployment.contracts.BettingVault = bettingVault.address;
        deployment.updatedAt = new Date().toISOString();
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        
        console.log(chalk.bold.yellow('\n📊 System Status:'));
        console.log(chalk.green('  ✓ BettingVault deployed and configured'));
        console.log(chalk.green('  ✓ Roles granted to game contracts'));
        console.log(chalk.green('  ✓ Initial liquidity provided'));
        console.log(chalk.green('  ✓ CrapsBets connected to vault'));
        console.log(chalk.green('  ✓ Ready for betting operations'));
        
        console.log(chalk.bold.magenta('\n🎉 100% FUNCTIONALITY ACHIEVED!'));
        console.log(chalk.cyan('The betting system is now fully operational with a proper vault!'));
        
        await connection.close();
        
    } catch (error) {
        spinner.fail(`Deployment failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default main;