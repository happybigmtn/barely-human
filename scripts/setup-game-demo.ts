import { network } from "hardhat";
import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from 'fs';
import chalk from 'chalk';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Setting up Barely Human for Demo\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, treasury, liquidity] = await viem.getWalletClients();
    
    try {
        console.log(chalk.yellow("1. Setting up BettingVault liquidity..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        // Check current liquidity
        const currentLiquidity = await bettingVault.read.totalLiquidity();
        console.log(`   Current liquidity: ${parseFloat(currentLiquidity.toString()) / 1e18} BOT`);
        
        if (currentLiquidity < parseEther("50000")) {
            // Fund liquidity from treasury
            const liquidityAmount = parseEther("100000");
            const tokenAsTreasury = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, { client: treasury });
            
            // Approve and deposit
            await tokenAsTreasury.write.approve([bettingVault.address, liquidityAmount]);
            
            const vaultAsTreasury = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault, { client: treasury });
            await vaultAsTreasury.write.depositLiquidity([liquidityAmount]);
            
            const newLiquidity = await bettingVault.read.totalLiquidity();
            console.log(`   ✅ Added liquidity: ${parseFloat(newLiquidity.toString()) / 1e18} BOT`);
        } else {
            console.log(`   ✅ Sufficient liquidity already present`);
        }
        
        console.log(chalk.yellow("\n2. Setting up CrapsGame..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        // Check game state
        const currentPhase = await crapsGame.read.getCurrentPhase();
        const isActive = await crapsGame.read.isGameActive();
        
        console.log(`   Current phase: ${["IDLE", "COME_OUT", "POINT"][Number(currentPhase)]}`);
        console.log(`   Game active: ${isActive}`);
        
        // If game is idle, start a new series
        if (Number(currentPhase) === 0) {
            const OPERATOR_ROLE = await crapsGame.read.OPERATOR_ROLE();
            await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
            await crapsGame.write.startNewSeries([deployer.account.address]);
            console.log(`   ✅ Started new game series`);
        } else {
            console.log(`   ✅ Game already active`);
        }
        
        console.log(chalk.yellow("\n3. Setting up CrapsBets..."));
        const crapsBets = await viem.getContractAt("CrapsBets", deployment.contracts.CrapsBets);
        
        // Check and set limits if needed
        try {
            await crapsBets.write.setBettingLimits([parseEther("1"), parseEther("10000")]);
            console.log(`   ✅ Set betting limits: 1-10,000 BOT`);
        } catch {
            console.log(`   ℹ️  Betting limits already set`);
        }
        
        console.log(chalk.yellow("\n4. Funding demo accounts..."));
        
        // Create and fund demo players
        const demoAccounts = [];
        for (let i = 0; i < 3; i++) {
            const wallet = privateKeyToAccount(`0x${(i + 300).toString(16).padStart(64, '0')}`);
            
            const balance = await botToken.read.balanceOf([wallet.address]);
            if (balance < parseEther("1000")) {
                const tokenAsTreasury = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, { client: treasury });
                await tokenAsTreasury.write.transfer([wallet.address, parseEther("5000")]);
                console.log(`   ✅ Funded demo player ${i + 1}: ${wallet.address}`);
            }
            
            demoAccounts.push({
                address: wallet.address,
                privateKey: `0x${(i + 300).toString(16).padStart(64, '0')}`
            });
        }
        
        console.log(chalk.yellow("\n5. Verifying bot manager..."));
        const botManager = await viem.getContractAt("BotManagerV2Plus", deployment.contracts.BotManagerV2Plus);
        const botCount = await botManager.read.getBotCount();
        console.log(`   ✅ ${botCount} bots initialized`);
        
        // Save demo configuration
        const demoConfig = {
            timestamp: new Date().toISOString(),
            network: "localhost",
            contracts: deployment.contracts,
            demoAccounts,
            gameState: {
                phase: Number(currentPhase),
                active: isActive,
                vaultLiquidity: currentLiquidity.toString()
            }
        };
        
        fs.writeFileSync('deployments/demo-config.json', JSON.stringify(demoConfig, null, 2));
        
        console.log(chalk.green("\n✅ Demo Setup Complete!"));
        console.log(chalk.gray("\nDemo accounts created:"));
        demoAccounts.forEach((acc, i) => {
            console.log(chalk.gray(`  Player ${i + 1}: ${acc.address}`));
        });
        console.log(chalk.gray("\n📄 Configuration saved to deployments/demo-config.json"));
        
    } catch (error) {
        console.error(chalk.red("\n❌ Setup failed:"), error);
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