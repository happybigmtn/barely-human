import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

/**
 * Minimal Bot Funding - Just fund the bots without verification
 * Based on the existing wallets from the game connector
 */
async function main() {
    console.log("🚨 MINIMAL BOT FUNDING - Quick Fix for Zero Balance Crisis\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, liquidity] = walletClients;
        
        // Load deployment info
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const botTokenAddress = deployments.contracts.BOTToken;
        
        console.log("📊 Current System Status:");
        console.log(`  BOT Token: ${botTokenAddress}`);
        console.log(`  Deployer: ${deployer.account.address}`);
        console.log(`  Block: ${await publicClient.getBlockNumber()}\n`);
        
        // Use the same bot wallet generation as in game-connector.js
        console.log("🤖 Funding Bot Wallets from Game Connector Pattern...");
        
        const botWallets = [];
        for (let i = 0; i < 10; i++) {
            // Use the same pattern as game-connector.js
            const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            botWallets.push({
                id: i,
                privateKey,
                address: account.address
            });
        }
        
        // Fund each bot
        const ethAmount = parseEther("0.2"); // 0.2 ETH per bot
        const botAmount = parseEther("20000"); // 20,000 BOT per bot
        
        console.log(`💰 Funding ${botWallets.length} bots with ${formatEther(ethAmount)} ETH and ${formatEther(botAmount)} BOT each...\n`);
        
        for (const bot of botWallets) {
            console.log(`🔄 Funding Bot ${bot.id}: ${bot.address}`);
            
            // Check current balance
            const currentEth = await publicClient.getBalance({ address: bot.address });
            console.log(`  Current ETH: ${formatEther(currentEth)}`);
            
            // Fund with ETH
            console.log(`  💎 Sending ${formatEther(ethAmount)} ETH...`);
            const ethTx = await deployer.sendTransaction({
                to: bot.address,
                value: ethAmount
            });
            await publicClient.waitForTransactionReceipt({ hash: ethTx });
            console.log(`     ✅ ETH sent: ${ethTx}`);
            
            // Fund with BOT tokens
            console.log(`  🪙 Sending ${formatEther(botAmount)} BOT tokens...`);
            const botTx = await liquidity.writeContract({
                address: botTokenAddress,
                abi: [
                    {
                        name: "transfer",
                        type: "function",
                        stateMutability: "nonpayable",
                        inputs: [
                            { name: "to", type: "address" },
                            { name: "amount", type: "uint256" }
                        ],
                        outputs: [{ name: "", type: "bool" }]
                    }
                ],
                functionName: "transfer",
                args: [bot.address, botAmount]
            });
            await publicClient.waitForTransactionReceipt({ hash: botTx });
            console.log(`     ✅ BOT tokens sent: ${botTx}`);
            
            // Quick balance check (ETH only)
            const newEth = await publicClient.getBalance({ address: bot.address });
            console.log(`     📊 New ETH Balance: ${formatEther(newEth)}\n`);
        }
        
        // Save the wallet info for the game connector
        console.log("💾 Saving Bot Wallet Information...");
        const walletInfo = {
            timestamp: new Date().toISOString(),
            fundingAmount: {
                eth: formatEther(ethAmount),
                bot: formatEther(botAmount)
            },
            botWallets: botWallets.map(bot => ({
                id: bot.id,
                address: bot.address,
                privateKey: bot.privateKey
            }))
        };
        
        const walletPath = path.join(process.cwd(), "bot-wallets.json");
        fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
        console.log(`  ✅ Bot wallets saved to: ${walletPath}`);
        
        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("🎉 BOT FUNDING COMPLETE!");
        console.log("=".repeat(60));
        console.log("\n📊 Funding Summary:");
        console.log(`  • Bots funded: ${botWallets.length}`);
        console.log(`  • ETH per bot: ${formatEther(ethAmount)}`);
        console.log(`  • BOT per bot: ${formatEther(botAmount)}`);
        console.log(`  • Total ETH distributed: ${formatEther(ethAmount * BigInt(botWallets.length))}`);
        console.log(`  • Total BOT distributed: ${formatEther(botAmount * BigInt(botWallets.length))}`);
        
        console.log("\n🎮 Crisis Should Be Resolved!");
        console.log("  • No more 'sender's balance is: 0' errors expected");
        console.log("  • Bots should be able to send transactions");
        console.log("  • Ready for interactive gameplay");
        
        console.log("\n🚀 Next Steps:");
        console.log("  • Test: npm run cli:interactive");
        console.log("  • If issues persist, check contract deployment");
        
        return {
            success: true,
            botWallets,
            funded: botWallets.length,
            ethPerBot: formatEther(ethAmount),
            botPerBot: formatEther(botAmount)
        };
        
    } catch (error) {
        console.error("\n❌ Bot funding failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run the funding
main()
    .then((result) => {
        console.log("\n✅ Bot funding completed successfully!");
        console.log(`   Funded ${result.funded} bots with ${result.ethPerBot} ETH and ${result.botPerBot} BOT each`);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Bot funding failed:", error);
        process.exit(1);
    });

export default main;