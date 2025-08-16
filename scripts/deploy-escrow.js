#!/usr/bin/env node

/**
 * Deploy BotBettingEscrow contract
 */

import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    console.log("🎰 Deploying Bot Betting Escrow Contract\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer] = walletClients;
        
        // Load existing deployments
        const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run deployment script first.');
        }
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        
        console.log(`Deployer: ${deployer.account.address}`);
        console.log(`BOT Token: ${deployments.contracts.BOTToken}`);
        console.log(`Treasury: ${deployments.contracts.Treasury}\n`);
        
        // Deploy BotBettingEscrow
        console.log("Deploying BotBettingEscrow...");
        const escrow = await viem.deployContract("BotBettingEscrow", [
            deployments.contracts.BOTToken,
            deployments.contracts.Treasury
        ]);
        
        console.log(`✅ BotBettingEscrow deployed: ${escrow.address}`);
        
        // Grant oracle role to deployer for testing
        const ORACLE_ROLE = await escrow.read.ORACLE_ROLE([]);
        const tx1 = await escrow.write.grantRole([ORACLE_ROLE, deployer.account.address]);
        await publicClient.waitForTransactionReceipt({ hash: tx1 });
        console.log("✅ Oracle role granted to deployer");
        
        // Start first round
        const tx2 = await escrow.write.startNewRound([]);
        await publicClient.waitForTransactionReceipt({ hash: tx2 });
        console.log("✅ First betting round started");
        
        // Update deployments file
        deployments.contracts.BotBettingEscrow = escrow.address;
        deployments.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));
        console.log("\n✅ Deployment info updated");
        
        console.log("\n========================================");
        console.log("🎉 ESCROW DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("\nUsers can now:");
        console.log("1. Chat with bots to learn their personalities");
        console.log("2. Bet on which bot will perform best");
        console.log("3. Watch bots compete and win rewards");
        console.log("\nRun: npm run cli:interactive");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });