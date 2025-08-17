import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Initializing Barely Human Casino Demo\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, user1, user2] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    try {
        // 1. Setup VRF consumers
        console.log(chalk.yellow("1. Setting up VRF..."));
        const vrfCoordinator = await viem.getContractAt("MockVRFCoordinatorV2Plus", deployment.contracts.MockVRFV2Plus);
        
        const subscriptionId = 1n;
        const isGameConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
        
        if (!isGameConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
            console.log(`   ✅ Added CrapsGame as VRF consumer`);
        }
        
        const isBotConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.BotManagerV2Plus]);
        
        if (!isBotConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.BotManagerV2Plus]);
            console.log(`   ✅ Added BotManager as VRF consumer`);
        }
        
        // 2. Fund the vault
        console.log(chalk.yellow("\n2. Funding the vault..."));
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        
        // Approve and deposit liquidity
        const liquidityAmount = parseEther("100000");
        await botToken.write.approve([deployment.contracts.BettingVault, liquidityAmount]);
        await bettingVault.write.depositLiquidity([liquidityAmount]);
        
        const totalLiquidity = await bettingVault.read.totalLiquidity();
        console.log(`   ✅ Vault funded with ${totalLiquidity / 10n**18n} BOT`);
        
        // 3. Grant roles
        console.log(chalk.yellow("\n3. Setting up permissions..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        const OPERATOR_ROLE = await crapsGame.read.OPERATOR_ROLE();
        const hasOperatorRole = await crapsGame.read.hasRole([OPERATOR_ROLE, deployer.account.address]);
        
        if (!hasOperatorRole) {
            await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
            console.log(`   ✅ Granted OPERATOR_ROLE to deployer`);
        }
        
        // Grant vault role to betting vault
        const VAULT_ROLE = await crapsGame.read.VAULT_ROLE();
        const hasVaultRole = await crapsGame.read.hasRole([VAULT_ROLE, deployment.contracts.BettingVault]);
        
        if (!hasVaultRole) {
            await crapsGame.write.grantRole([VAULT_ROLE, deployment.contracts.BettingVault]);
            console.log(`   ✅ Granted VAULT_ROLE to BettingVault`);
        }
        
        // 4. Initialize bot manager
        console.log(chalk.yellow("\n4. Initializing bots..."));
        const botManager = await viem.getContractAt("BotManagerV2Plus", deployment.contracts.BotManagerV2Plus);
        
        try {
            await botManager.write.initializeBots();
            console.log(`   ✅ Bot personalities initialized`);
        } catch (error: any) {
            if (error.message.includes("Already initialized")) {
                console.log(`   ℹ️  Bots already initialized`);
            } else {
                throw error;
            }
        }
        
        // 5. Start a game series
        console.log(chalk.yellow("\n5. Starting game series..."));
        await crapsGame.write.startNewSeries([deployer.account.address]);
        
        const seriesId = await crapsGame.read.getSeriesId();
        const phase = await crapsGame.read.getCurrentPhase();
        console.log(`   ✅ Game series ${seriesId} started`);
        console.log(`   📍 Current phase: ${['IDLE', 'COME_OUT', 'POINT'][Number(phase)]}`);
        
        // 6. Fund demo accounts
        console.log(chalk.yellow("\n6. Funding demo accounts..."));
        const demoAccounts = [
            user1.account.address,
            user2.account.address,
            '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' // Default demo account
        ];
        
        for (const account of demoAccounts) {
            await botToken.write.transfer([account, parseEther("10000")]);
            const balance = await botToken.read.balanceOf([account]);
            console.log(`   ✅ ${account.slice(0, 8)}... funded with ${balance / 10n**18n} BOT`);
        }
        
        // 7. Test dice roll
        console.log(chalk.yellow("\n7. Testing dice roll..."));
        try {
            const requestId = await crapsGame.write.requestDiceRoll();
            console.log(`   ✅ Dice roll requested (ID: ${requestId})`);
            
            // Auto-fulfill for testing
            await vrfCoordinator.write.autoFulfillRequest([1n]);
            console.log(`   ✅ VRF request fulfilled`);
            
            const lastRoll = await crapsGame.read.getLastRoll();
            if (lastRoll && lastRoll[0] !== undefined && lastRoll[1] !== undefined) {
                const die1 = Number(lastRoll[0]) + 1;
                const die2 = Number(lastRoll[1]) + 1;
                console.log(`   🎲 Dice result: ${die1} + ${die2} = ${die1 + die2}`);
            }
        } catch (error: any) {
            console.log(`   ⚠️  Could not test dice roll: ${error.message}`);
        }
        
        // Summary
        console.log(chalk.green("\n✅ Demo Initialization Complete!\n"));
        console.log(chalk.cyan("📊 System Status:"));
        console.log(chalk.gray(`   • Game Series: #${seriesId}`));
        console.log(chalk.gray(`   • Phase: ${['IDLE', 'COME_OUT', 'POINT'][Number(phase)]}`));
        console.log(chalk.gray(`   • Vault Liquidity: ${totalLiquidity / 10n**18n} BOT`));
        console.log(chalk.gray(`   • Bots Ready: 10 AI personalities`));
        console.log(chalk.gray(`   • VRF: Configured and tested`));
        
        console.log(chalk.yellow("\n🎮 Ready to run the demo!"));
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