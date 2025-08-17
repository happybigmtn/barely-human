#!/usr/bin/env node

/**
 * Redeploy With Working Vault
 * Redeploys contracts with the new VaultFactoryMinimal to achieve 100% functionality
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
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
    console.log(chalk.bold.cyan('🚀 Redeploying Contracts with Working Vault Factory\n'));
    
    const spinner = ora('Connecting to Hardhat network...').start();
    
    try {
        // Connect to network
        const connection = await network.connect();
        const { viem } = connection;
        
        // Get deployer account
        const [deployerAccount] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        
        spinner.succeed('Connected to Hardhat network');
        
        // Deploy contracts in order
        const contracts = {};
        
        // 1. Deploy BOT Token
        spinner.start('Deploying BOT Token...');
        const botToken = await viem.deployContract("BOTToken", [
            parseEther("1000000000"), // 1B tokens
            deployerAccount.account.address
        ]);
        contracts.BOTToken = botToken.address;
        spinner.succeed(`BOT Token deployed at: ${botToken.address}`);
        
        // 2. Deploy Mock VRF (for local testing)
        spinner.start('Deploying Mock VRF Coordinator...');
        const mockVRF = await viem.deployContract("MockVRFV2Plus");
        contracts.MockVRFV2Plus = mockVRF.address;
        spinner.succeed(`Mock VRF deployed at: ${mockVRF.address}`);
        
        // 3. Deploy Treasury
        spinner.start('Deploying Treasury...');
        const treasury = await viem.deployContract("Treasury", [
            botToken.address
        ]);
        contracts.Treasury = treasury.address;
        spinner.succeed(`Treasury deployed at: ${treasury.address}`);
        
        // 4. Deploy Staking Pool
        spinner.start('Deploying Staking Pool...');
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            treasury.address
        ]);
        contracts.StakingPool = stakingPool.address;
        spinner.succeed(`Staking Pool deployed at: ${stakingPool.address}`);
        
        // 5. Deploy CrapsGameV2Plus
        spinner.start('Deploying CrapsGameV2Plus...');
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001" // keyHash
        ]);
        contracts.CrapsGameV2Plus = crapsGame.address;
        spinner.succeed(`CrapsGame deployed at: ${crapsGame.address}`);
        
        // 6. Deploy CrapsBets
        spinner.start('Deploying CrapsBets...');
        const crapsBets = await viem.deployContract("CrapsBets", [
            botToken.address,
            parseEther("1"),    // minBet
            parseEther("10000") // maxBet
        ]);
        contracts.CrapsBets = crapsBets.address;
        spinner.succeed(`CrapsBets deployed at: ${crapsBets.address}`);
        
        // 7. Deploy CrapsSettlement
        spinner.start('Deploying CrapsSettlement...');
        const crapsSettlement = await viem.deployContract("CrapsSettlement");
        contracts.CrapsSettlement = crapsSettlement.address;
        spinner.succeed(`CrapsSettlement deployed at: ${crapsSettlement.address}`);
        
        // 8. Deploy BotManagerV2Plus
        spinner.start('Deploying BotManagerV2Plus...');
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001", // keyHash
            crapsGame.address,
            crapsBets.address,
            treasury.address
        ]);
        contracts.BotManagerV2Plus = botManager.address;
        spinner.succeed(`BotManager deployed at: ${botManager.address}`);
        
        // 9. Deploy NEW VaultFactoryMinimal
        spinner.start('Deploying VaultFactoryMinimal...');
        const vaultFactory = await viem.deployContract("VaultFactoryMinimal", [
            botToken.address,
            treasury.address
        ]);
        contracts.VaultFactoryMinimal = vaultFactory.address;
        spinner.succeed(`VaultFactoryMinimal deployed at: ${vaultFactory.address}`);
        
        // 10. Create a vault
        spinner.start('Creating initial vault...');
        const createVaultHash = await vaultFactory.write.createVault([
            botToken.address,
            "Craps Vault",
            "CVAULT"
        ]);
        await publicClient.waitForTransactionReceipt({ hash: createVaultHash });
        const vaultAddress = await vaultFactory.read.getVault([0n]);
        spinner.succeed(`Vault created at: ${vaultAddress}`);
        
        // 11. Set up contract connections
        spinner.start('Setting up contract connections...');
        
        // Connect CrapsBets to other contracts
        const setBetsHash = await crapsBets.write.setContracts([
            crapsGame.address,
            vaultAddress,
            crapsSettlement.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: setBetsHash });
        
        // Connect CrapsSettlement to other contracts
        const setSettlementHash = await crapsSettlement.write.setContracts([
            crapsGame.address,
            crapsBets.address,
            treasury.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: setSettlementHash });
        
        spinner.succeed('Contract connections established');
        
        // 12. Initialize bots
        spinner.start('Initializing bot manager...');
        const initBotsHash = await botManager.write.initializeBots();
        await publicClient.waitForTransactionReceipt({ hash: initBotsHash });
        spinner.succeed('Bot manager initialized with 10 bots');
        
        // 13. Distribute tokens
        spinner.start('Distributing tokens...');
        const accounts = await viem.getWalletClients();
        
        // Transfer to key accounts
        const distributions = [
            { to: accounts[1].account.address, amount: parseEther("100000000"), name: "Treasury" },
            { to: accounts[2].account.address, amount: parseEther("300000000"), name: "Liquidity" },
            { to: accounts[3].account.address, amount: parseEther("100000000"), name: "Staking" },
            { to: vaultAddress, amount: parseEther("100000000"), name: "Vault" }
        ];
        
        for (const dist of distributions) {
            const hash = await botToken.write.transfer([dist.to, dist.amount]);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(chalk.green(`  ✓ ${dist.name}: ${formatEther(dist.amount)} BOT`));
        }
        
        spinner.succeed('Token distribution complete');
        
        // 14. Start game series
        spinner.start('Starting initial game series...');
        const startGameHash = await crapsGame.write.startNewSeries([deployerAccount.account.address]);
        await publicClient.waitForTransactionReceipt({ hash: startGameHash });
        spinner.succeed('Game series started');
        
        // Save deployment info
        const deploymentInfo = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            contracts,
            vaultAddress,
            deployer: deployerAccount.account.address,
            accounts: {
                treasury: accounts[1].account.address,
                liquidity: accounts[2].account.address,
                staking: accounts[3].account.address,
                team: accounts[4].account.address,
                community: accounts[5].account.address
            }
        };
        
        const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log(chalk.bold.green('\n✅ DEPLOYMENT COMPLETE!'));
        console.log(chalk.cyan('\nContract Addresses:'));
        Object.entries(contracts).forEach(([name, address]) => {
            console.log(chalk.white(`  ${name}: ${address}`));
        });
        console.log(chalk.white(`  Vault: ${vaultAddress}`));
        
        console.log(chalk.bold.yellow('\n📊 System Status:'));
        console.log(chalk.green('  ✓ All contracts deployed'));
        console.log(chalk.green('  ✓ Vault factory working'));
        console.log(chalk.green('  ✓ Initial vault created'));
        console.log(chalk.green('  ✓ Contracts connected'));
        console.log(chalk.green('  ✓ Bots initialized'));
        console.log(chalk.green('  ✓ Tokens distributed'));
        console.log(chalk.green('  ✓ Game series active'));
        
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