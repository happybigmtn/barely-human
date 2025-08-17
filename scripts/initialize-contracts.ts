import { network } from "hardhat";
import { parseEther } from "viem";
import fs from 'fs';
import chalk from 'chalk';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Initializing Barely Human Contracts\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await viem.getWalletClients();
    
    try {
        // 1. Initialize CrapsGame
        console.log(chalk.yellow("1. Initializing CrapsGame..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        // Grant OPERATOR_ROLE to deployer
        const OPERATOR_ROLE = await crapsGame.read.OPERATOR_ROLE();
        await crapsGame.write.grantRole([OPERATOR_ROLE, deployer.account.address]);
        console.log("   ✅ Granted OPERATOR_ROLE");
        
        // Start a new series with deployer as initial shooter
        await crapsGame.write.startNewSeries([deployer.account.address]);
        const seriesId = await crapsGame.read.getSeriesId();
        console.log(`   ✅ Started series #${seriesId}`);
        
        // 2. Setup BettingVault with initial liquidity
        console.log(chalk.yellow("\n2. Setting up BettingVault..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        // Fund liquidity provider account
        const liquidityAmount = parseEther("100000");
        const liquidityBalance = await botToken.read.balanceOf([liquidity.account.address]);
        
        if (liquidityBalance >= liquidityAmount) {
            // Approve and deposit liquidity
            const tokenAsLiquidity = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, { client: liquidity });
            await tokenAsLiquidity.write.approve([bettingVault.address, liquidityAmount]);
            
            const vaultAsLiquidity = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault, { client: liquidity });
            await vaultAsLiquidity.write.depositLiquidity([liquidityAmount]);
            
            const totalLiquidity = await bettingVault.read.totalLiquidity();
            console.log(`   ✅ Vault liquidity: ${parseFloat(totalLiquidity.toString()) / 1e18} BOT`);
        }
        
        // Grant necessary roles
        const BETS_ROLE = await bettingVault.read.BETS_ROLE();
        const GAME_ROLE = await bettingVault.read.GAME_ROLE();
        
        await bettingVault.write.grantRole([BETS_ROLE, deployment.contracts.CrapsBets]);
        await bettingVault.write.grantRole([GAME_ROLE, deployment.contracts.CrapsGameV2Plus]);
        console.log("   ✅ Granted vault roles");
        
        // 3. Setup CrapsBets
        console.log(chalk.yellow("\n3. Configuring CrapsBets..."));
        const crapsBets = await viem.getContractAt("CrapsBets", deployment.contracts.CrapsBets);
        
        // Set betting limits
        await crapsBets.write.setBettingLimits([parseEther("1"), parseEther("10000")]);
        console.log("   ✅ Set betting limits: 1-10,000 BOT");
        
        // Grant roles for game interaction
        const GAME_ROLE_BETS = await crapsBets.read.GAME_ROLE();
        await crapsBets.write.grantRole([GAME_ROLE_BETS, deployment.contracts.CrapsGameV2Plus]);
        console.log("   ✅ Granted GAME_ROLE to CrapsGame");
        
        // 4. Fund bot wallets
        console.log(chalk.yellow("\n4. Funding bot wallets..."));
        const botManager = await viem.getContractAt("BotManagerV2Plus", deployment.contracts.BotManagerV2Plus);
        const botCount = await botManager.read.getBotCount();
        
        // Create bot wallets and fund them
        for (let i = 0; i < Math.min(10, Number(botCount)); i++) {
            // Use deterministic addresses for bots
            const botWallet = await viem.getWalletClient({ 
                account: viem.privateKeyToAccount(`0x${(i + 100).toString(16).padStart(64, '0')}`)
            });
            
            // Transfer BOT tokens to bot
            const tokenAsTreasury = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, { client: treasury });
            await tokenAsTreasury.write.transfer([botWallet.account.address, parseEther("10000")]);
            
            // Set bot wallet in manager
            await botManager.write.setBotWallet([BigInt(i), botWallet.account.address]);
            
            console.log(`   ✅ Bot ${i} funded: ${botWallet.account.address}`);
        }
        
        // 5. Setup Treasury permissions
        console.log(chalk.yellow("\n5. Setting up Treasury..."));
        const treasuryContract = await viem.getContractAt("Treasury", deployment.contracts.Treasury);
        
        const DISTRIBUTOR_ROLE = await treasuryContract.read.DISTRIBUTOR_ROLE();
        const VAULT_ROLE = await treasuryContract.read.VAULT_ROLE();
        
        await treasuryContract.write.grantRole([DISTRIBUTOR_ROLE, deployment.contracts.StakingPool]);
        await treasuryContract.write.grantRole([VAULT_ROLE, deployment.contracts.BettingVault]);
        console.log("   ✅ Treasury roles configured");
        
        // 6. Create test players
        console.log(chalk.yellow("\n6. Creating test players..."));
        const testPlayers = [];
        
        for (let i = 0; i < 3; i++) {
            const playerWallet = await viem.getWalletClient({
                account: viem.privateKeyToAccount(`0x${(i + 200).toString(16).padStart(64, '0')}`)
            });
            
            // Fund with BOT tokens
            const tokenAsTeam = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, { client: team });
            await tokenAsTeam.write.transfer([playerWallet.account.address, parseEther("5000")]);
            
            testPlayers.push(playerWallet.account.address);
            console.log(`   ✅ Player ${i + 1} funded: ${playerWallet.account.address}`);
        }
        
        // 7. Verify setup
        console.log(chalk.yellow("\n7. Verifying setup..."));
        
        const gameActive = await crapsGame.read.isGameActive();
        const currentPhase = await crapsGame.read.getCurrentPhase();
        const vaultLiquidity = await bettingVault.read.totalLiquidity();
        const minBet = await crapsBets.read.getMinBet();
        const maxBet = await crapsBets.read.getMaxBet();
        
        console.log(chalk.green("\n✅ Initialization Complete!"));
        console.log(chalk.gray("   Game Active: ") + gameActive);
        console.log(chalk.gray("   Current Phase: ") + ["IDLE", "COME_OUT", "POINT"][Number(currentPhase)]);
        console.log(chalk.gray("   Vault Liquidity: ") + `${parseFloat(vaultLiquidity.toString()) / 1e18} BOT`);
        console.log(chalk.gray("   Bet Limits: ") + `${parseFloat(minBet.toString()) / 1e18} - ${parseFloat(maxBet.toString()) / 1e18} BOT`);
        console.log(chalk.gray("   Bot Count: ") + botCount);
        console.log(chalk.gray("   Test Players: ") + testPlayers.length);
        
        // Save initialization data
        const initData = {
            timestamp: new Date().toISOString(),
            gameActive,
            currentPhase: Number(currentPhase),
            seriesId: Number(seriesId),
            vaultLiquidity: vaultLiquidity.toString(),
            botWallets: [],
            testPlayers
        };
        
        for (let i = 0; i < Math.min(10, Number(botCount)); i++) {
            const botWallet = viem.privateKeyToAccount(`0x${(i + 100).toString(16).padStart(64, '0')}`);
            initData.botWallets.push(botWallet.address);
        }
        
        fs.writeFileSync('deployments/initialization.json', JSON.stringify(initData, null, 2));
        console.log(chalk.gray("\n   📄 Initialization data saved to deployments/initialization.json"));
        
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