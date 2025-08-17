import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

/**
 * Simple Emergency Funding Fix
 * Addresses the critical "sender's balance is: 0" crisis
 */
async function main() {
    console.log("🚨 EMERGENCY FUNDING FIX - Addressing Zero Balance Crisis\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, liquidity] = walletClients;
        
        // Load deployment info
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        if (!fs.existsSync(deploymentPath)) {
            throw new Error("No deployment found. Run: npm run deploy:local");
        }
        
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const botTokenAddress = deployments.contracts.BOTToken;
        
        console.log("📊 Current System Status:");
        console.log(`  BOT Token: ${botTokenAddress}`);
        console.log(`  Deployer: ${deployer.account.address}`);
        console.log(`  Liquidity: ${liquidity.account.address}\n`);
        
        // Generate 10 unique bot wallets
        console.log("🤖 Generating 10 Bot Wallets...");
        const botWallets = [];
        
        for (let i = 0; i < 10; i++) {
            // Generate deterministic but unique private key
            const seed = `bot-${i}-${Date.now()}`;
            const privateKey = '0x' + Buffer.from(seed).toString('hex').padStart(64, '0').slice(0, 64);
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            
            botWallets.push({
                id: i,
                privateKey,
                address: account.address
            });
            
            console.log(`  Bot ${i}: ${account.address}`);
        }
        
        // Fund each bot with ETH and BOT tokens
        console.log("\n💰 Emergency Funding in Progress...");
        
        const ethAmount = parseEther("0.2"); // 0.2 ETH per bot
        const botAmount = parseEther("20000"); // 20,000 BOT per bot
        
        for (const bot of botWallets) {
            console.log(`\n🔄 Funding Bot ${bot.id} (${bot.address})...`);
            
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
            
            // Verify funding
            const ethBalance = await publicClient.getBalance({ address: bot.address });
            const botBalance = await publicClient.readContract({
                address: botTokenAddress,
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
                args: [bot.address]
            });
            
            console.log(`     📊 Final: ${formatEther(ethBalance)} ETH, ${formatEther(botBalance)} BOT`);
        }
        
        // Save wallet info for persistence
        console.log("\n💾 Saving Bot Wallet Information...");
        const walletInfo = {
            timestamp: new Date().toISOString(),
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
        console.log("🎉 EMERGENCY FUNDING COMPLETE!");
        console.log("=".repeat(60));
        console.log("\n📊 Funding Summary:");
        console.log(`  • Bots funded: ${botWallets.length}`);
        console.log(`  • ETH per bot: ${formatEther(ethAmount)}`);
        console.log(`  • BOT per bot: ${formatEther(botAmount)}`);
        console.log(`  • Total ETH distributed: ${formatEther(ethAmount * BigInt(botWallets.length))}`);
        console.log(`  • Total BOT distributed: ${formatEther(botAmount * BigInt(botWallets.length))}`);
        
        console.log("\n🎮 Crisis Resolved!");
        console.log("  • No more 'sender's balance is: 0' errors");
        console.log("  • All bots can now send transactions");
        console.log("  • Ready for interactive gameplay");
        
        console.log("\n🚀 Next Steps:");
        console.log("  • Run: npm run cli:interactive");
        console.log("  • Start playing with funded bots!");
        
        return {
            success: true,
            botWallets,
            totalEthDistributed: ethAmount * BigInt(botWallets.length),
            totalBotDistributed: botAmount * BigInt(botWallets.length)
        };
        
    } catch (error) {
        console.error("\n❌ Emergency funding failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run the emergency funding
main()
    .then((result) => {
        console.log("\n✅ Emergency funding completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Emergency funding failed:", error);
        process.exit(1);
    });

export default main;