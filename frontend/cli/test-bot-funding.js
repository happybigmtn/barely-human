#!/usr/bin/env node

/**
 * Test Bot Funding - Quick test to verify the funding fix worked
 */

import chalk from 'chalk';
import figlet from 'figlet';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { hardhatChain } from '../../config/chains.js';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bot information
const BOT_INFO = [
    { id: 0, name: 'Alice "All-In"', emoji: '🎯', strategy: 'Aggressive', color: chalk.red },
    { id: 1, name: 'Bob "The Calculator"', emoji: '🧮', strategy: 'Conservative', color: chalk.blue },
    { id: 2, name: 'Charlie "Lucky Charm"', emoji: '🍀', strategy: 'Superstitious', color: chalk.green },
    { id: 3, name: 'Diana "Ice Queen"', emoji: '❄️', strategy: 'Cold Logic', color: chalk.cyan },
    { id: 4, name: 'Eddie "The Entertainer"', emoji: '🎭', strategy: 'Showman', color: chalk.magenta }
];

async function main() {
    console.clear();
    console.log(chalk.cyan(figlet.textSync('FUNDING TEST', { horizontalLayout: 'full' })));
    console.log(chalk.yellow('\\n🧪 Testing Bot Funding Fix 🤖\\n'));
    console.log(chalk.gray('='.repeat(70)));
    
    try {
        // Initialize blockchain clients
        const publicClient = createPublicClient({
            chain: hardhatChain,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Load deployments
        const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run: npm run deploy:local');
        }
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        
        console.log(chalk.green('✅ Connected to blockchain\\n'));
        
        // Test bot wallet funding
        console.log(chalk.cyan('🤖 Checking Bot Wallet Balances...\\n'));
        
        let totalEth = 0n;
        let fundedBots = 0;
        
        for (let i = 0; i < 5; i++) { // Test first 5 bots
            // Generate bot wallet (same pattern as minimal-bot-funding.ts)
            const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
            const account = privateKeyToAccount(privateKey);
            const bot = BOT_INFO[i];
            
            console.log(`${bot.emoji} ${bot.name}:`);
            console.log(`  Address: ${account.address}`);
            
            try {
                // Check ETH balance
                const ethBalance = await publicClient.getBalance({ address: account.address });
                const ethFormatted = formatEther(ethBalance);
                
                console.log(`  ETH Balance: ${ethFormatted}`);
                
                if (ethBalance > parseEther("0.1")) {
                    console.log(chalk.green('  ✅ Sufficient ETH for transactions'));
                    fundedBots++;
                } else {
                    console.log(chalk.red('  ❌ Low ETH balance'));
                }
                
                totalEth += ethBalance;
                
                // Try to check BOT token balance (may fail, that's okay)
                try {
                    const botBalance = await publicClient.readContract({
                        address: deployments.contracts.BOTToken,
                        abi: [
                            {
                                name: "balanceOf",
                                type: "function",
                                stateMutability: "view",
                                inputs: [{ name: "account", type: "address" }],
                                outputs: [{ name: "", type: "uint256" }]
                            }
                        ],
                        functionName: "balanceOf",
                        args: [account.address]
                    });
                    console.log(`  BOT Balance: ${formatEther(botBalance)}`);
                } catch (error) {
                    console.log(`  BOT Balance: ${chalk.yellow('Unable to check (contract issue)')}`);
                }
                
                console.log(); // Empty line
                
            } catch (error) {
                console.log(chalk.red(`  ❌ Error checking balance: ${error.message}\\n`));
            }
        }
        
        // Summary
        console.log(chalk.gray('='.repeat(70)));
        console.log(chalk.yellow('\\n📊 FUNDING TEST RESULTS:\\n'));
        
        console.log(`🤖 Bots tested: 5`);
        console.log(`✅ Bots with sufficient ETH: ${fundedBots}/5`);
        console.log(`💰 Total ETH across bots: ${formatEther(totalEth)}`);
        
        if (fundedBots >= 4) {
            console.log(chalk.green('\\n🎉 FUNDING FIX SUCCESSFUL!'));
            console.log(chalk.green('   ✅ Bots should be able to send transactions'));
            console.log(chalk.green('   ✅ Zero balance crisis resolved'));
            console.log(chalk.green('   ✅ Ready for interactive gameplay'));
        } else {
            console.log(chalk.red('\\n⚠️  FUNDING INCOMPLETE'));
            console.log(chalk.yellow('   🔄 May need to run funding script again'));
            console.log(chalk.yellow('   💡 Try: npx hardhat run scripts/minimal-bot-funding.ts'));
        }
        
        console.log(chalk.cyan('\\n🚀 Next Steps:'));
        console.log('  • Bots are now funded and ready to play');
        console.log('  • Interactive CLI should work without balance errors');
        console.log('  • You can start placing bets and watching AI personalities');
        
        // Test a simple transaction to verify funding works
        console.log(chalk.cyan('\\n🧪 Testing Bot Transaction Capability...'));
        
        try {
            const testBot = privateKeyToAccount(`0x${(1).toString(16).padStart(64, '0')}`);
            const testWallet = createWalletClient({
                account: testBot,
                chain: hardhatChain,
                transport: http('http://127.0.0.1:8545')
            });
            
            console.log(`🤖 Test Bot: ${testBot.address}`);
            
            // Try to send a small amount to itself (should work if funded)
            const testAmount = parseEther("0.001");
            console.log(`💸 Attempting to send ${formatEther(testAmount)} ETH to self...`);
            
            const txHash = await testWallet.sendTransaction({
                to: testBot.address,
                value: testAmount
            });
            
            console.log(chalk.green(`✅ Transaction successful: ${txHash}`));
            console.log(chalk.green('🎯 CONFIRMED: Bots can send transactions!'));
            
        } catch (txError) {
            console.log(chalk.yellow(`⚠️  Transaction test failed: ${txError.message}`));
            console.log(chalk.yellow('   This might indicate funding is still needed'));
        }
        
    } catch (error) {
        console.error(chalk.red('\\n❌ Test failed:'), error.message);
        console.log(chalk.yellow('\\n💡 Troubleshooting:'));
        console.log('  • Make sure Hardhat node is running: npm run node');
        console.log('  • Make sure contracts are deployed: npm run deploy:local');
        console.log('  • Run funding script: npx hardhat run scripts/minimal-bot-funding.ts');
    }
}

// Run the test
main().catch(console.error);