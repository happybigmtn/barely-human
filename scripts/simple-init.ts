import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Simple Game Initialization\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    try {
        // 1. Just start a game
        console.log(chalk.yellow("1. Starting game..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        const currentPhase = await crapsGame.read.getCurrentPhase();
        console.log(`   Current phase: ${currentPhase}`);
        
        if (currentPhase === 0) {
            await crapsGame.write.startNewSeries([deployer.account.address]);
            console.log(`   ✅ Game series started`);
        } else {
            console.log(`   ℹ️  Game already active`);
        }
        
        // 2. Fund demo account
        console.log(chalk.yellow("\n2. Funding demo account..."));
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        const demoAccount = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
        const balance = await botToken.read.balanceOf([demoAccount]);
        
        if (balance < parseEther("1000")) {
            // Transfer from deployer (who should have tokens from deployment)
            await botToken.write.transfer([demoAccount, parseEther("10000")]);
            const newBalance = await botToken.read.balanceOf([demoAccount]);
            console.log(`   ✅ Demo account funded: ${newBalance / 10n**18n} BOT`);
        } else {
            console.log(`   ℹ️  Demo account already has ${balance / 10n**18n} BOT`);
        }
        
        // 3. Check vault (don't try to fund it for now)
        console.log(chalk.yellow("\n3. Checking vault..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        
        const totalLiquidity = await bettingVault.read.totalLiquidity();
        console.log(`   Vault liquidity: ${totalLiquidity / 10n**18n} BOT`);
        
        // If vault has no liquidity, we'll just simulate bets without actual vault interactions
        if (totalLiquidity === 0n) {
            console.log(chalk.yellow(`   ⚠️  Vault has no liquidity - demo will use simulated betting`));
        }
        
        // 4. Setup VRF
        console.log(chalk.yellow("\n4. Setting up VRF..."));
        const vrfCoordinator = await viem.getContractAt("MockVRFCoordinatorV2Plus", deployment.contracts.MockVRFV2Plus);
        
        const subscriptionId = 1n;
        const isGameConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
        
        if (!isGameConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
            console.log(`   ✅ Added CrapsGame as VRF consumer`);
        } else {
            console.log(`   ℹ️  CrapsGame already VRF consumer`);
        }
        
        // Summary
        console.log(chalk.green("\n✅ Simple Initialization Complete!\n"));
        
        const finalPhase = await crapsGame.read.getCurrentPhase();
        const seriesId = await crapsGame.read.getSeriesId();
        
        console.log(chalk.cyan("📊 Status:"));
        console.log(chalk.gray(`   • Game Series: #${seriesId}`));
        console.log(chalk.gray(`   • Phase: ${['IDLE', 'COME_OUT', 'POINT'][Number(finalPhase)]}`));
        console.log(chalk.gray(`   • Demo Account: ${balance / 10n**18n} BOT`));
        console.log(chalk.gray(`   • Vault: ${totalLiquidity / 10n**18n} BOT`));
        
        console.log(chalk.yellow("\n🎮 Ready for demo!"));
        console.log(chalk.gray("Run: node frontend/cli/demo-interactive-betting.js"));
        
    } catch (error) {
        console.error(chalk.red("\n❌ Initialization failed:"), error);
        process.exit(1);
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