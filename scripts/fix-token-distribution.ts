import { network } from "hardhat";
import chalk from 'chalk';
import fs from 'fs';
import { parseEther, formatEther } from 'viem';

async function main() {
    console.log(chalk.bold.cyan("\n🎲 Fixing Token Distribution & Vault Funding\n"));
    
    // Load deployment
    const deployment = JSON.parse(fs.readFileSync('deployments/localhost.json', 'utf8'));
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const [deployer, user1, user2, user3, user4, user5] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    try {
        console.log(chalk.yellow.bold("1. Checking Token Distribution..."));
        const botToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken);
        
        // Check who has the tokens
        const accounts = [
            { wallet: deployer, name: 'Deployer' },
            { wallet: user1, name: 'User 1' },
            { wallet: user2, name: 'User 2' },
            { wallet: user3, name: 'User 3' },
            { wallet: user4, name: 'User 4' },
            { wallet: user5, name: 'User 5' }
        ];
        
        let richestAccount = null;
        let highestBalance = 0n;
        
        for (const account of accounts) {
            const balance = await botToken.read.balanceOf([account.wallet.account.address]);
            console.log(`   ${account.name}: ${formatEther(balance)} BOT`);
            
            if (balance > highestBalance) {
                highestBalance = balance;
                richestAccount = account;
            }
        }
        
        // Also check treasury
        const treasuryBalance = await botToken.read.balanceOf([deployment.contracts.Treasury]);
        console.log(`   Treasury: ${formatEther(treasuryBalance)} BOT`);
        
        if (treasuryBalance > highestBalance) {
            console.log(chalk.yellow("\n2. Treasury has the most tokens, need to extract..."));
            
            // Treasury should have a withdraw function for admin
            const treasury = await viem.getContractAt("Treasury", deployment.contracts.Treasury);
            
            try {
                // Try to withdraw from treasury
                await treasury.write.withdrawTokens([
                    deployment.contracts.BOTToken,
                    parseEther("100000"),
                    deployer.account.address
                ]);
                console.log(`   ✅ Withdrew 100,000 BOT from Treasury`);
            } catch (e: any) {
                console.log(`   ❌ Could not withdraw from Treasury: ${e.message?.substring(0, 50)}`);
            }
        }
        
        // Now distribute tokens properly
        console.log(chalk.yellow.bold("\n3. Distributing Tokens..."));
        
        if (richestAccount && highestBalance > parseEther("50000")) {
            const distributor = richestAccount.wallet;
            
            // Fund deployer if needed
            if (richestAccount.name !== 'Deployer') {
                // Switch to the rich account's client
                const richToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, distributor);
                await richToken.write.transfer([
                    deployer.account.address,
                    parseEther("50000")
                ]);
                console.log(`   ✅ Sent 50,000 BOT to Deployer`);
            }
            
            // Fund demo accounts
            const demoAccounts = [
                '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat account 0
                '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat account 1
                '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'  // Hardhat account 2
            ];
            
            for (const account of demoAccounts) {
                try {
                    const currentBalance = await botToken.read.balanceOf([account]);
                    if (currentBalance < parseEther("10000")) {
                        const richToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, distributor);
                        await richToken.write.transfer([
                            account,
                            parseEther("10000")
                        ]);
                        console.log(`   ✅ Sent 10,000 BOT to ${account.substring(0, 10)}...`);
                    }
                } catch (e) {
                    // Skip if fails
                }
            }
        }
        
        // Now fund the vault
        console.log(chalk.yellow.bold("\n4. Funding BettingVault..."));
        const bettingVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault);
        
        // Check current vault liquidity
        const currentLiquidity = await bettingVault.read.totalLiquidity();
        console.log(`   Current liquidity: ${formatEther(currentLiquidity)} BOT`);
        
        if (currentLiquidity < parseEther("10000")) {
            // Find an account with enough balance
            let funder = null;
            let funderBalance = 0n;
            
            for (const account of accounts) {
                const balance = await botToken.read.balanceOf([account.wallet.account.address]);
                if (balance > parseEther("20000")) {
                    funder = account.wallet;
                    funderBalance = balance;
                    break;
                }
            }
            
            if (funder) {
                try {
                    // Approve vault
                    const funderToken = await viem.getContractAt("BOTToken", deployment.contracts.BOTToken, funder);
                    await funderToken.write.approve([
                        deployment.contracts.BettingVault,
                        parseEther("20000")
                    ]);
                    console.log(`   ✅ Approved 20,000 BOT for vault`);
                    
                    // Deposit to vault
                    const funderVault = await viem.getContractAt("BettingVault", deployment.contracts.BettingVault, funder);
                    await funderVault.write.depositLiquidity([
                        parseEther("20000")
                    ]);
                    
                    const newLiquidity = await bettingVault.read.totalLiquidity();
                    console.log(`   ✅ Deposited! New liquidity: ${formatEther(newLiquidity)} BOT`);
                } catch (e: any) {
                    console.log(`   ❌ Vault deposit failed: ${e.message?.substring(0, 100)}`);
                }
            } else {
                console.log(`   ❌ No account has enough tokens to fund vault`);
            }
        } else {
            console.log(`   ✅ Vault already has sufficient liquidity`);
        }
        
        // Final status
        console.log(chalk.green.bold("\n✅ FINAL STATUS:"));
        
        const finalDeployerBalance = await botToken.read.balanceOf([deployer.account.address]);
        const finalVaultLiquidity = await bettingVault.read.totalLiquidity();
        
        console.log(`   Deployer: ${formatEther(finalDeployerBalance)} BOT`);
        console.log(`   Vault Liquidity: ${formatEther(finalVaultLiquidity)} BOT`);
        
        // Check if demo can run
        if (finalVaultLiquidity > 0n || finalDeployerBalance > parseEther("1000")) {
            console.log(chalk.green.bold("\n🎮 System is ready for demo!"));
            console.log(chalk.white("   cd frontend/cli && node demo-working.js"));
        } else {
            console.log(chalk.yellow.bold("\n⚠️  Limited functionality - using simulated mode"));
            console.log(chalk.white("   Demo will still work with simulated betting"));
        }
        
    } catch (error) {
        console.error(chalk.red("\n❌ Token distribution failed:"), error);
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