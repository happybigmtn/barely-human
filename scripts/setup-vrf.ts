import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Setting up VRF for Dice Rolls\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer] = await viem.getWalletClients();
    
    try {
        // 1. Get VRF Coordinator
        console.log(chalk.yellow("1. Configuring VRF Coordinator..."));
        const vrfCoordinator = await viem.getContractAt("MockVRFCoordinatorV2Plus", deployment.contracts.MockVRFV2Plus);
        
        // 2. Check if CrapsGame is already a consumer
        const subscriptionId = 1n; // Default subscription ID
        const isConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
        
        if (!isConsumer) {
            // Add CrapsGame as consumer
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.CrapsGameV2Plus]);
            console.log(`   ✅ Added CrapsGameV2Plus as VRF consumer`);
        } else {
            console.log(`   ℹ️  CrapsGameV2Plus already authorized`);
        }
        
        // 3. Also add BotManager if it uses VRF
        const isBotManagerConsumer = await vrfCoordinator.read.consumerIsAdded([subscriptionId, deployment.contracts.BotManagerV2Plus]);
        
        if (!isBotManagerConsumer) {
            await vrfCoordinator.write.addConsumer([subscriptionId, deployment.contracts.BotManagerV2Plus]);
            console.log(`   ✅ Added BotManagerV2Plus as VRF consumer`);
        } else {
            console.log(`   ℹ️  BotManagerV2Plus already authorized`);
        }
        
        // 4. Test VRF setup by requesting dice roll
        console.log(chalk.yellow("\n2. Testing VRF with dice roll..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        // Grant OPERATOR_ROLE if needed
        const OPERATOR_ROLE = await crapsGame.read.OPERATOR_ROLE();
        const hasRole = await crapsGame.read.hasRole([OPERATOR_ROLE, deployer.account.address]);
        
        if (!hasRole) {
            await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
            console.log(`   ✅ Granted OPERATOR_ROLE to deployer`);
        }
        
        // First check if there's an active game series
        const currentPhase = await crapsGame.read.getCurrentPhase();
        
        if (currentPhase === 0) { // IDLE phase
            console.log(chalk.yellow("   ⚠️  No active game series. Starting one..."));
            await crapsGame.write.startNewSeries([deployer.account.address]);
            console.log(`   ✅ Started new game series`);
        }
        
        // Request dice roll
        console.log(chalk.yellow("\n3. Requesting dice roll..."));
        try {
            const requestTx = await crapsGame.write.requestDiceRoll();
            console.log(`   ✅ Dice roll requested, tx: ${requestTx}`);
            
            // In a real scenario, we'd wait for the VRF callback
            // For testing, we can auto-fulfill
            console.log(chalk.yellow("\n4. Auto-fulfilling VRF request..."));
            
            // Get the request ID from events (simplified for demo)
            const requestId = 1n; // This would come from the event
            
            // Auto-fulfill the request
            await vrfCoordinator.write.autoFulfillRequest([requestId]);
            console.log(`   ✅ VRF request fulfilled`);
            
            // Check the result
            const lastRoll = await crapsGame.read.getLastRoll();
            console.log(`   🎲 Dice result: ${lastRoll[0]} + ${lastRoll[1]} = ${lastRoll[0] + lastRoll[1]}`);
            
        } catch (error: any) {
            console.error(chalk.red("   ❌ Error requesting dice roll:"), error.message);
            // Don't throw, just log the error
        }
        
        console.log(chalk.green("\n✅ VRF Setup Complete!"));
        console.log(chalk.gray("\nVRF is now configured for:"));
        console.log(chalk.gray("  • CrapsGameV2Plus - Dice rolls"));
        console.log(chalk.gray("  • BotManagerV2Plus - Bot decisions"));
        
        // Save VRF configuration
        const vrfConfig = {
            timestamp: new Date().toISOString(),
            subscriptionId: subscriptionId.toString(),
            consumers: [
                deployment.contracts.CrapsGameV2Plus,
                deployment.contracts.BotManagerV2Plus
            ],
            coordinator: deployment.contracts.MockVRFV2Plus
        };
        
        fs.writeFileSync('deployments/vrf-config.json', JSON.stringify(vrfConfig, null, 2));
        console.log(chalk.gray("\n📄 VRF configuration saved to deployments/vrf-config.json"));
        
    } catch (error) {
        console.error(chalk.red("\n❌ VRF setup failed:"), error);
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