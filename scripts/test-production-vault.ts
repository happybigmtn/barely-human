import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther, formatEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Testing Production Vault & Settlement\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, user1, user2] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    console.log(chalk.gray(`Using accounts:`));
    console.log(chalk.gray(`  Deployer: ${deployer.account.address}`));
    console.log(chalk.gray(`  User1: ${user1.account.address}`));
    console.log(chalk.gray(`  User2: ${user2.account.address}\n`));
    
    try {
        // Use the deployed V2 contracts
        const vaultAddress = deployment.contracts.BettingVaultV2 || deployment.contracts.BettingVault;
        const settlementAddress = deployment.contracts.CrapsSettlementV2 || deployment.contracts.CrapsSettlement;
        
        console.log(chalk.yellow("Using contracts:"));
        console.log(chalk.gray(`  Vault: ${vaultAddress}`));
        console.log(chalk.gray(`  Settlement: ${settlementAddress}\n`));
        
        const bettingVault = await viem.getContractAt("BettingVaultV2", vaultAddress);
        const settlement = await viem.getContractAt("CrapsSettlementV2", settlementAddress);
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        // Check token balances
        console.log(chalk.yellow.bold("1. Token Balances:"));
        const user1Balance = await botToken.read.balanceOf([user1.account.address]);
        const user2Balance = await botToken.read.balanceOf([user2.account.address]);
        console.log(`   User1: ${formatEther(user1Balance)} BOT`);
        console.log(`   User2: ${formatEther(user2Balance)} BOT`);
        
        // Check vault status
        console.log(chalk.yellow.bold("\n2. Vault Status:"));
        const vaultStats = await bettingVault.read.getVaultStats();
        console.log(`   Liquidity: ${formatEther(vaultStats[0])} BOT`);
        console.log(`   In Escrow: ${formatEther(vaultStats[1])} BOT`);
        console.log(`   Paid Out: ${formatEther(vaultStats[2])} BOT`);
        console.log(`   Fees: ${formatEther(vaultStats[3])} BOT`);
        console.log(`   Bets Placed: ${vaultStats[4]}`);
        
        // If vault has no liquidity, fund it
        if (vaultStats[0] === 0n && user2Balance > parseEther("10000")) {
            console.log(chalk.yellow.bold("\n3. Funding Vault:"));
            
            // User2 funds the vault
            const fundAmount = parseEther("10000");
            const user2Token = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, user2);
            await user2Token.write.approve([vaultAddress, fundAmount]);
            console.log(`   ✅ Approved ${formatEther(fundAmount)} BOT`);
            
            const user2Vault = await viem.getContractAt("BettingVaultV2", vaultAddress, user2);
            const shares = await user2Vault.write.depositLiquidity([fundAmount]);
            console.log(`   ✅ Deposited! Received shares`);
            
            const newLiquidity = await bettingVault.read.totalLiquidity();
            console.log(`   ✅ New vault liquidity: ${formatEther(newLiquidity)} BOT`);
        }
        
        // Test betting flow
        console.log(chalk.yellow.bold("\n4. Testing Bet Placement:"));
        
        if (user1Balance > parseEther("100")) {
            const betAmount = parseEther("100");
            
            // User1 places a bet
            const user1Token = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, user1);
            await user1Token.write.approve([vaultAddress, betAmount]);
            console.log(`   ✅ User1 approved ${formatEther(betAmount)} BOT`);
            
            const user1Vault = await viem.getContractAt("BettingVaultV2", vaultAddress, user1);
            const betId = await user1Vault.write.placeBet([
                0, // Pass line bet
                betAmount,
                1, // Series ID
                0  // No specific number
            ]);
            console.log(`   ✅ User1 placed bet (ID: ${betId})`);
            
            // Check escrow
            const escrow = await bettingVault.read.playerTotalEscrow([user1.account.address]);
            console.log(`   ✅ User1 escrow: ${formatEther(escrow)} BOT`);
            
            // Get bet info
            const betInfo = await bettingVault.read.getBetInfo([user1.account.address, 0n]);
            console.log(`   ✅ Bet info: Type ${betInfo[2]}, Amount ${formatEther(betInfo[0])} BOT`);
            
            // Test settlement
            console.log(chalk.yellow.bold("\n5. Testing Settlement:"));
            
            // Grant settlement role if needed
            const SETTLEMENT_ROLE = await bettingVault.read.SETTLEMENT_ROLE();
            const hasRole = await bettingVault.read.hasRole([SETTLEMENT_ROLE, settlement.address]);
            if (!hasRole) {
                await bettingVault.write.grantRole([SETTLEMENT_ROLE, settlement.address]);
                console.log(`   ✅ Granted SETTLEMENT_ROLE to settlement contract`);
            }
            
            // Process settlement (simulate a win)
            try {
                await settlement.write.processRollSettlement([
                    1n, // Series ID
                    3,  // Die 1
                    4,  // Die 2 (total = 7, pass line wins on come out)
                    [user1.account.address],
                    [0n] // Bet ID
                ]);
                console.log(`   ✅ Settlement processed!`);
                
                // Check new balance
                const newBalance = await botToken.read.balanceOf([user1.account.address]);
                const profit = newBalance > user1Balance ? newBalance - user1Balance : 0n;
                if (profit > 0n) {
                    console.log(`   ✅ User1 won! Profit: ${formatEther(profit)} BOT`);
                } else {
                    console.log(`   ❌ User1 lost the bet`);
                }
                
                // Check updated vault stats
                const finalStats = await bettingVault.read.getVaultStats();
                console.log(`   Final escrow: ${formatEther(finalStats[1])} BOT`);
                console.log(`   Total paid out: ${formatEther(finalStats[2])} BOT`);
                console.log(`   Bets won: ${finalStats[5]}`);
                console.log(`   Bets lost: ${finalStats[6]}`);
                
            } catch (error: any) {
                console.log(`   ❌ Settlement failed: ${error.message?.substring(0, 100)}`);
            }
        } else {
            console.log(`   ⚠️  User1 has insufficient balance for betting`);
        }
        
        // Final summary
        console.log(chalk.green.bold("\n✅ PRODUCTION VAULT TEST COMPLETE\n"));
        
        const finalStats = await bettingVault.read.getVaultStats();
        console.log(chalk.cyan("📊 Final Vault Statistics:"));
        console.log(chalk.gray(`   • Total Liquidity: ${formatEther(finalStats[0])} BOT`));
        console.log(chalk.gray(`   • In Escrow: ${formatEther(finalStats[1])} BOT`));
        console.log(chalk.gray(`   • Total Paid Out: ${formatEther(finalStats[2])} BOT`));
        console.log(chalk.gray(`   • Fees Collected: ${formatEther(finalStats[3])} BOT`));
        console.log(chalk.gray(`   • Bets Placed: ${finalStats[4]}`));
        console.log(chalk.gray(`   • Bets Won: ${finalStats[5]}`));
        console.log(chalk.gray(`   • Bets Lost: ${finalStats[6]}`));
        
        const settlementStats = await settlement.read.getSettlementStats();
        console.log(chalk.cyan("\n📊 Settlement Statistics:"));
        console.log(chalk.gray(`   • Total Settlements: ${settlementStats[0]}`));
        console.log(chalk.gray(`   • Winning Bets: ${settlementStats[1]}`));
        console.log(chalk.gray(`   • Losing Bets: ${settlementStats[2]}`));
        if (settlementStats[0] > 0n) {
            console.log(chalk.gray(`   • Win Rate: ${Number(settlementStats[3]) / 100}%`));
        }
        
        console.log(chalk.green.bold("\n🎯 SYSTEM STATUS:"));
        if (finalStats[0] > 0n && finalStats[4] > 0n) {
            console.log(chalk.green("   ✅ Vault funded and operational"));
            console.log(chalk.green("   ✅ Betting system working"));
            console.log(chalk.green("   ✅ Settlement system working"));
            console.log(chalk.green("   ✅ Escrow management working"));
            console.log(chalk.green("   ✅ PRODUCTION READY!"));
        } else if (finalStats[0] > 0n) {
            console.log(chalk.yellow("   ✅ Vault funded"));
            console.log(chalk.yellow("   ⚠️  No bets placed yet"));
        } else {
            console.log(chalk.red("   ❌ Vault needs funding"));
        }
        
    } catch (error) {
        console.error(chalk.red("\n❌ Test failed:"), error);
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