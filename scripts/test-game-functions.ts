import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther, formatEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Testing Game Functions & Escrow Operations\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, player1, player2] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    const results = {
        gamePhase: '❌ Failed',
        diceRoll: '❌ Failed',
        vrfFulfillment: '❌ Failed',
        tokenTransfers: '❌ Failed',
        vaultDeposit: '❌ Failed',
        escrowHold: '❌ Failed',
        betPlacement: '❌ Failed',
        payoutProcessing: '❌ Failed',
        botDecisions: '❌ Failed'
    };
    
    try {
        // ==========================================
        // 1. TEST GAME PHASE TRANSITIONS
        // ==========================================
        console.log(chalk.yellow.bold("1. Testing Game Phase Transitions..."));
        const crapsGame = await viem.getContractAt("CrapsGameV2Plus", deployment.contracts.CrapsGameV2Plus);
        
        try {
            const currentPhase = await crapsGame.read.getCurrentPhase();
            const seriesId = await crapsGame.read.getSeriesId();
            const phaseNames = ['IDLE', 'COME_OUT', 'POINT'];
            
            console.log(`   Current phase: ${phaseNames[Number(currentPhase)]}`);
            console.log(`   Series ID: ${seriesId}`);
            
            // If idle, start a new series
            if (currentPhase === 0) {
                await crapsGame.write.startNewSeries([deployer.account.address]);
                const newPhase = await crapsGame.read.getCurrentPhase();
                console.log(`   ✅ Started new series, phase: ${phaseNames[Number(newPhase)]}`);
            }
            
            results.gamePhase = '✅ Working';
        } catch (error: any) {
            console.log(`   ❌ Game phase error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 2. TEST DICE ROLL & VRF
        // ==========================================
        console.log(chalk.yellow.bold("\n2. Testing Dice Roll & VRF..."));
        const vrfCoordinator = await viem.getContractAt("MockVRFCoordinatorV2Plus", deployment.contracts.MockVRFV2Plus);
        
        try {
            // Request dice roll
            const requestId = await crapsGame.write.requestDiceRoll();
            console.log(`   Dice roll requested: ${requestId}`);
            results.diceRoll = '✅ Requested';
            
            // Check if request is pending
            const isPending = await crapsGame.read.isRequestPending([BigInt(1)]);
            console.log(`   Request pending: ${isPending}`);
            
            // Auto-fulfill VRF
            try {
                await vrfCoordinator.write.fulfillSpecificDice([BigInt(1), 4, 3]);
                console.log(`   ✅ VRF fulfilled with dice: 4 + 3 = 7`);
                results.vrfFulfillment = '✅ Working';
                
                // Get last roll
                const lastRoll = await crapsGame.read.getLastRoll();
                if (lastRoll) {
                    console.log(`   Last roll: ${lastRoll[0]} + ${lastRoll[1]} = ${lastRoll[2]}`);
                }
            } catch (e: any) {
                console.log(`   ⚠️  VRF fulfillment issue: ${e.message?.substring(0, 50)}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Dice roll error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 3. TEST TOKEN OPERATIONS
        // ==========================================
        console.log(chalk.yellow.bold("\n3. Testing Token Operations..."));
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        try {
            // Check balances
            const deployerBalance = await botToken.read.balanceOf([deployer.account.address]);
            const player1Balance = await botToken.read.balanceOf([player1.account.address]);
            
            console.log(`   Deployer balance: ${formatEther(deployerBalance)} BOT`);
            console.log(`   Player 1 balance: ${formatEther(player1Balance)} BOT`);
            
            // Test transfer if deployer has funds
            if (deployerBalance > parseEther("100")) {
                await botToken.write.transfer([player1.account.address, parseEther("100")]);
                const newBalance = await botToken.read.balanceOf([player1.account.address]);
                console.log(`   ✅ Transferred 100 BOT to Player 1`);
                results.tokenTransfers = '✅ Working';
            } else {
                console.log(`   ⚠️  Insufficient balance for transfer test`);
            }
        } catch (error: any) {
            console.log(`   ❌ Token operation error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 4. TEST BETTING VAULT
        // ==========================================
        console.log(chalk.yellow.bold("\n4. Testing BettingVault..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        
        try {
            // Check vault state
            const totalLiquidity = await bettingVault.read.totalLiquidity();
            const totalShares = await bettingVault.read.totalShares();
            const totalInEscrow = await bettingVault.read.totalInEscrow();
            
            console.log(`   Total liquidity: ${formatEther(totalLiquidity)} BOT`);
            console.log(`   Total shares: ${formatEther(totalShares)}`);
            console.log(`   Total in escrow: ${formatEther(totalInEscrow)} BOT`);
            
            // Try to deposit liquidity
            if (deployerBalance > parseEther("1000")) {
                try {
                    await botToken.write.approve([deployment.contracts.BettingVault, parseEther("1000")]);
                    await bettingVault.write.depositLiquidity([parseEther("1000")]);
                    console.log(`   ✅ Deposited 1000 BOT to vault`);
                    results.vaultDeposit = '✅ Working';
                } catch (e: any) {
                    console.log(`   ⚠️  Vault deposit failed: ${e.message?.substring(0, 50)}`);
                }
            }
        } catch (error: any) {
            console.log(`   ❌ Vault error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 5. TEST BET PLACEMENT & ESCROW
        // ==========================================
        console.log(chalk.yellow.bold("\n5. Testing Bet Placement & Escrow..."));
        const crapsBets = await viem.getContractAt("CrapsBets", deployment.contracts.CrapsBets);
        
        try {
            // Check if we can place a bet
            const canPlaceBet = await crapsGame.read.canPlaceBet([0]); // Pass line bet
            console.log(`   Can place pass line bet: ${canPlaceBet}`);
            
            // Try to place a bet
            if (canPlaceBet && player1Balance > parseEther("10")) {
                try {
                    // Player approves vault
                    await botToken.connect(player1).write.approve([
                        deployment.contracts.BettingVault, 
                        parseEther("10")
                    ]);
                    
                    // Place bet through CrapsBets
                    await crapsBets.connect(player1).write.placeBet([
                        0, // Pass line
                        parseEther("10"),
                        0 // No specific number
                    ]);
                    
                    console.log(`   ✅ Placed 10 BOT pass line bet`);
                    results.betPlacement = '✅ Working';
                    
                    // Check escrow
                    const playerEscrow = await bettingVault.read.playerTotalEscrow([player1.account.address]);
                    console.log(`   Player escrow: ${formatEther(playerEscrow)} BOT`);
                    
                    if (playerEscrow > 0n) {
                        results.escrowHold = '✅ Working';
                    }
                } catch (e: any) {
                    console.log(`   ⚠️  Bet placement failed: ${e.message?.substring(0, 50)}`);
                }
            }
        } catch (error: any) {
            console.log(`   ❌ Betting error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 6. TEST SETTLEMENT & PAYOUTS
        // ==========================================
        console.log(chalk.yellow.bold("\n6. Testing Settlement & Payouts..."));
        const crapsSettlement = await viem.getContractAt("CrapsSettlement", deployment.contracts.CrapsSettlement);
        
        try {
            // Check if there are any bets to settle
            const activeBets = await crapsBets.read.getActiveBets([player1.account.address]);
            console.log(`   Active bets for Player 1: ${activeBets.length}`);
            
            if (activeBets.length > 0) {
                // Try to process settlement after a roll
                try {
                    await crapsSettlement.write.processBetSettlement([
                        player1.account.address,
                        0, // Bet ID
                        true, // Won
                        parseEther("20") // Payout (2x)
                    ]);
                    
                    console.log(`   ✅ Processed payout of 20 BOT`);
                    results.payoutProcessing = '✅ Working';
                } catch (e: any) {
                    console.log(`   ⚠️  Settlement failed: ${e.message?.substring(0, 50)}`);
                }
            }
        } catch (error: any) {
            console.log(`   ❌ Settlement error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // 7. TEST BOT MANAGER
        // ==========================================
        console.log(chalk.yellow.bold("\n7. Testing Bot Manager..."));
        const botManager = await viem.getContractAt("BotManagerV2Plus", deployment.contracts.BotManagerV2Plus);
        
        try {
            const botCount = await botManager.read.getBotCount();
            console.log(`   Total bots: ${botCount}`);
            
            // Test bot decision making
            for (let i = 0; i < Math.min(3, Number(botCount)); i++) {
                try {
                    const botData = await botManager.read.bots([BigInt(i)]);
                    const strategy = await botManager.read.strategies([BigInt(i)]);
                    
                    console.log(`   Bot ${i}: ${botData[1]} - Base bet: ${formatEther(strategy[0])} BOT`);
                    
                    // Test decision request (would need VRF in real scenario)
                    if (i === 0) {
                        results.botDecisions = '✅ Loaded';
                    }
                } catch (e: any) {
                    console.log(`   ⚠️  Bot ${i} error: ${e.message?.substring(0, 30)}`);
                }
            }
        } catch (error: any) {
            console.log(`   ❌ Bot manager error: ${error.message?.substring(0, 50)}`);
        }
        
        // ==========================================
        // RESULTS SUMMARY
        // ==========================================
        console.log(chalk.green.bold("\n📊 TEST RESULTS SUMMARY\n"));
        
        const table: string[] = [];
        for (const [test, result] of Object.entries(results)) {
            const status = result.includes('✅') ? chalk.green(result) : 
                          result.includes('⚠️') ? chalk.yellow(result) : 
                          chalk.red(result);
            table.push(`   ${test.padEnd(20)} ${status}`);
        }
        
        console.log(table.join('\n'));
        
        // Overall assessment
        const workingCount = Object.values(results).filter(r => r.includes('✅')).length;
        const totalTests = Object.keys(results).length;
        const percentage = Math.round((workingCount / totalTests) * 100);
        
        console.log(chalk.cyan.bold(`\n🎯 Overall: ${workingCount}/${totalTests} functions working (${percentage}%)\n`));
        
        if (percentage < 50) {
            console.log(chalk.red("⚠️  Critical issues detected - many functions not working"));
        } else if (percentage < 80) {
            console.log(chalk.yellow("⚠️  Some functions need attention"));
        } else {
            console.log(chalk.green("✅ System is mostly functional"));
        }
        
    } catch (error) {
        console.error(chalk.red("\n❌ Test suite failed:"), error);
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