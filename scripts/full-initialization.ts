import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther, formatEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 BARELY HUMAN - Full System Initialization\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, user1, user2] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    console.log(chalk.gray(`Deployer: ${deployer.account.address}`));
    console.log(chalk.gray(`Network: localhost\n`));
    
    try {
        // ==========================================
        // 1. TOKEN SETUP
        // ==========================================
        console.log(chalk.yellow.bold("1. Setting up BOT Token..."));
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        // Check deployer balance
        const deployerBalance = await botToken.read.balanceOf([deployer.account.address]);
        console.log(`   Deployer balance: ${formatEther(deployerBalance)} BOT`);
        
        // Fund test accounts
        const testAccounts = [
            { address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', name: 'Demo Account' },
            { address: user1.account.address, name: 'User 1' },
            { address: user2.account.address, name: 'User 2' }
        ];
        
        for (const account of testAccounts) {
            try {
                const currentBalance = await botToken.read.balanceOf([account.address]);
                if (currentBalance < parseEther("1000") && account.address !== deployer.account.address) {
                    await botToken.write.transfer([account.address, parseEther("10000")]);
                    console.log(`   ✅ Funded ${account.name}: 10,000 BOT`);
                } else {
                    console.log(`   ℹ️  ${account.name} already has ${formatEther(currentBalance)} BOT`);
                }
            } catch (e) {
                console.log(`   ⚠️  Could not fund ${account.name}`);
            }
        }
        
        // ==========================================
        // 2. VRF SETUP
        // ==========================================
        console.log(chalk.yellow.bold("\n2. Configuring VRF..."));
        const vrfCoordinator = await viem.getContractAt("MockVRFCoordinatorV2Plus", deployment.contracts.MockVRFV2Plus);
        
        const subscriptionId = 1n;
        
        // Add CrapsGame as VRF consumer
        const isGameConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
        if (!isGameConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
            console.log(`   ✅ Added CrapsGameV2Plus as VRF consumer`);
        } else {
            console.log(`   ℹ️  CrapsGameV2Plus already VRF consumer`);
        }
        
        // Add BotManager as VRF consumer
        const isBotConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.BotManagerV2Plus]);
        if (!isBotConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.BotManagerV2Plus]);
            console.log(`   ✅ Added BotManagerV2Plus as VRF consumer`);
        } else {
            console.log(`   ℹ️  BotManagerV2Plus already VRF consumer`);
        }
        
        // ==========================================
        // 3. BOT MANAGER SETUP
        // ==========================================
        console.log(chalk.yellow.bold("\n3. Initializing Bot Manager..."));
        const botManager = await viem.getContractAt("BotManagerV2Plus", deployment.contracts.BotManagerV2Plus);
        
        // Check if already initialized
        const isInitialized = await botManager.read.isInitialized();
        
        if (!isInitialized) {
            console.log(`   Initializing 10 bot personalities...`);
            await botManager.write.initializeBots();
            console.log(`   ✅ Bot personalities initialized`);
        } else {
            console.log(`   ℹ️  Bots already initialized`);
        }
        
        // Verify bot count
        const botCount = await botManager.read.getBotCount();
        console.log(`   Total bots: ${botCount}`);
        
        // ==========================================
        // 4. GAME PERMISSIONS
        // ==========================================
        console.log(chalk.yellow.bold("\n4. Setting up permissions..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        // Grant OPERATOR_ROLE to deployer
        const OPERATOR_ROLE = await crapsGame.read.OPERATOR_ROLE();
        const hasOperatorRole = await crapsGame.read.hasRole([OPERATOR_ROLE, deployer.account.address]);
        
        if (!hasOperatorRole) {
            await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
            console.log(`   ✅ Granted OPERATOR_ROLE to deployer`);
        } else {
            console.log(`   ℹ️  Deployer already has OPERATOR_ROLE`);
        }
        
        // Grant VAULT_ROLE to BettingVault
        const VAULT_ROLE = await crapsGame.read.VAULT_ROLE();
        const hasVaultRole = await crapsGame.read.hasRole([VAULT_ROLE, deployment.contracts.BettingVault]);
        
        if (!hasVaultRole) {
            await crapsGame.write.grantRole([VAULT_ROLE, deployment.contracts.BettingVault]);
            console.log(`   ✅ Granted VAULT_ROLE to BettingVault`);
        } else {
            console.log(`   ℹ️  BettingVault already has VAULT_ROLE`);
        }
        
        // Grant SETTLEMENT_ROLE to CrapsBets
        const SETTLEMENT_ROLE = await crapsGame.read.SETTLEMENT_ROLE();
        const hasSettlementRole = await crapsGame.read.hasRole([SETTLEMENT_ROLE, deployment.contracts.CrapsBets]);
        
        if (!hasSettlementRole) {
            await crapsGame.write.grantRole([SETTLEMENT_ROLE, deployment.contracts.CrapsBets]);
            console.log(`   ✅ Granted SETTLEMENT_ROLE to CrapsBets`);
        } else {
            console.log(`   ℹ️  CrapsBets already has SETTLEMENT_ROLE`);
        }
        
        // ==========================================
        // 5. VAULT LIQUIDITY
        // ==========================================
        console.log(chalk.yellow.bold("\n5. Setting up BettingVault..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        
        // Check current liquidity
        const currentLiquidity = await bettingVault.read.totalLiquidity();
        console.log(`   Current liquidity: ${formatEther(currentLiquidity)} BOT`);
        
        if (currentLiquidity < parseEther("10000")) {
            // Approve and deposit
            const depositAmount = parseEther("50000");
            console.log(`   Depositing ${formatEther(depositAmount)} BOT...`);
            
            try {
                // First approve
                await botToken.write.approve([deployment.contracts.BettingVault, depositAmount]);
                console.log(`   ✅ Approved vault for ${formatEther(depositAmount)} BOT`);
                
                // Then deposit
                await bettingVault.write.depositLiquidity([depositAmount]);
                const newLiquidity = await bettingVault.read.totalLiquidity();
                console.log(`   ✅ Vault funded: ${formatEther(newLiquidity)} BOT total liquidity`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not fund vault: ${error.message?.substring(0, 50)}`);
            }
        }
        
        // ==========================================
        // 6. START GAME SERIES
        // ==========================================
        console.log(chalk.yellow.bold("\n6. Starting game series..."));
        
        const currentPhase = await crapsGame.read.getCurrentPhase();
        const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
        console.log(`   Current phase: ${phaseNames[Number(currentPhase)]}`);
        
        if (currentPhase === 0) { // IDLE
            await crapsGame.write.startNewSeries([deployer.account.address]);
            const seriesId = await crapsGame.read.getSeriesId();
            console.log(`   ✅ Started new game series #${seriesId}`);
        } else {
            const seriesId = await crapsGame.read.getSeriesId();
            console.log(`   ℹ️  Game series #${seriesId} already active`);
        }
        
        // ==========================================
        // 7. TEST DICE ROLL
        // ==========================================
        console.log(chalk.yellow.bold("\n7. Testing dice roll..."));
        
        try {
            // Request dice roll
            const requestId = await crapsGame.write.requestDiceRoll();
            console.log(`   ✅ Dice roll requested (ID: ${requestId})`);
            
            // Auto-fulfill for testing
            await vrfCoordinator.write.autoFulfillRequest([1n]);
            console.log(`   ✅ VRF request fulfilled`);
            
            // Check result
            const lastRoll = await crapsGame.read.getLastRoll();
            if (lastRoll) {
                const die1 = Number(lastRoll[0]) || 0;
                const die2 = Number(lastRoll[1]) || 0;
                const total = Number(lastRoll[2]) || 0;
                if (total > 0) {
                    console.log(`   🎲 Dice result: ${die1} + ${die2} = ${total}`);
                }
            }
        } catch (error: any) {
            console.log(`   ⚠️  Could not test dice roll: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 8. VERIFY BOT DECISIONS
        // ==========================================
        console.log(chalk.yellow.bold("\n8. Testing bot decisions..."));
        
        try {
            // Test bot 0 (Alice)
            const decision = await botManager.read.makeBotDecision([
                0n, // Bot ID
                1, // Game phase (COME_OUT)
                0, // Point (none yet)
                BigInt(Date.now()) // Seed for randomness
            ]);
            
            if (decision) {
                console.log(`   ✅ Bot 0 (Alice) decision test successful`);
                console.log(`      Bet type: ${decision[0]}, Amount: ${formatEther(decision[1])} BOT`);
            }
        } catch (error: any) {
            console.log(`   ⚠️  Bot decision test issue: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // FINAL SUMMARY
        // ==========================================
        console.log(chalk.green.bold("\n✅ INITIALIZATION COMPLETE!\n"));
        
        const finalPhase = await crapsGame.read.getCurrentPhase();
        const finalSeriesId = await crapsGame.read.getSeriesId();
        const finalLiquidity = await bettingVault.read.totalLiquidity();
        const finalBotCount = await botManager.read.getBotCount();
        
        console.log(chalk.cyan.bold("📊 System Status:"));
        console.log(chalk.gray(`   • Game Series: #${finalSeriesId}`));
        console.log(chalk.gray(`   • Phase: ${phaseNames[Number(finalPhase)]}`));
        console.log(chalk.gray(`   • Vault Liquidity: ${formatEther(finalLiquidity)} BOT`));
        console.log(chalk.gray(`   • Active Bots: ${finalBotCount}`));
        console.log(chalk.gray(`   • VRF: ✅ Configured`));
        console.log(chalk.gray(`   • Permissions: ✅ Set`));
        
        console.log(chalk.yellow.bold("\n🎮 Ready to run demo!"));
        console.log(chalk.gray("Run: cd frontend/cli && node demo-interactive-betting.js"));
        
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