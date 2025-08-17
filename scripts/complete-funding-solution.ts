import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

/**
 * Complete Funding Solution - Deploy, Fund, and Verify in One Script
 * This eliminates any connection issues between scripts
 */
async function main() {
    console.log("🚀 COMPLETE FUNDING SOLUTION - Deploy, Fund, Verify\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, treasury, liquidity] = walletClients;
        
        console.log("📊 Initial Status:");
        console.log(`  Chain ID: ${await publicClient.getChainId()}`);
        console.log(`  Block: ${await publicClient.getBlockNumber()}`);
        console.log(`  Deployer: ${deployer.account.address}\n`);
        
        // Step 1: Deploy BOT Token (minimum needed for funding)
        console.log("📦 Step 1: Deploying BOT Token...");
        const botToken = await viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            deployer.account.address,
            deployer.account.address,
            deployer.account.address
        ]);
        console.log(`   ✅ BOT Token deployed: ${botToken.address}\n`);
        
        // Step 2: Generate and Fund Bot Wallets
        console.log("🤖 Step 2: Generating and Funding Bot Wallets...");
        
        const botWallets = [];
        const ethAmount = parseEther("0.3"); // Increased to 0.3 ETH per bot
        const botAmount = parseEther("25000"); // Increased to 25,000 BOT per bot
        
        for (let i = 0; i < 10; i++) {
            // Generate bot wallet
            const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            
            botWallets.push({
                id: i,
                privateKey,
                address: account.address
            });
            
            console.log(`\n🤖 Bot ${i}: ${account.address}`);
            
            // Fund with ETH
            console.log(`   💎 Sending ${formatEther(ethAmount)} ETH...`);
            const ethTx = await deployer.sendTransaction({
                to: account.address,
                value: ethAmount
            });
            await publicClient.waitForTransactionReceipt({ hash: ethTx });
            
            // Fund with BOT tokens
            console.log(`   🪙 Sending ${formatEther(botAmount)} BOT tokens...`);
            const botTx = await liquidity.writeContract({
                address: botToken.address,
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
                args: [account.address, botAmount]
            });
            await publicClient.waitForTransactionReceipt({ hash: botTx });
            
            // IMMEDIATE VERIFICATION
            const ethBalance = await publicClient.getBalance({ address: account.address });
            console.log(`   📊 Verified ETH: ${formatEther(ethBalance)}`);
            
            if (ethBalance >= parseEther("0.1")) {
                console.log(`   ✅ Bot ${i} funded successfully`);
            } else {
                console.log(`   ❌ Bot ${i} funding failed!`);
                throw new Error(`Bot ${i} funding verification failed`);
            }
        }
        
        // Step 3: Final Verification of All Bots
        console.log("\n🔍 Step 3: Final Verification of All Bot Balances...");
        
        let successCount = 0;
        let totalEth = 0n;
        
        for (const bot of botWallets) {
            const ethBalance = await publicClient.getBalance({ address: bot.address });
            const ethFormatted = formatEther(ethBalance);
            
            console.log(`Bot ${bot.id}: ${ethFormatted} ETH`);
            
            if (ethBalance >= parseEther("0.1")) {
                successCount++;
            }
            totalEth += ethBalance;
        }
        
        // Step 4: Test Transaction Capability
        console.log("\n🧪 Step 4: Testing Transaction Capability...");
        
        const testBot = botWallets[0];
        const testAccount = privateKeyToAccount(testBot.privateKey as `0x${string}`);
        const testWallet = createWalletClient({
            account: testAccount,
            chain: { id: 31337, name: 'Hardhat', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } },
            transport: http('http://127.0.0.1:8545')
        });
        
        try {
            console.log(`🤖 Testing with Bot 0: ${testAccount.address}`);
            const testAmount = parseEther("0.001");
            
            const txHash = await testWallet.sendTransaction({
                to: testAccount.address,
                value: testAmount
            });
            
            await publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log(`✅ Transaction test successful: ${txHash}`);
            
        } catch (txError) {
            console.log(`❌ Transaction test failed: ${txError.message}`);
            throw new Error(`Transaction capability test failed: ${txError.message}`);
        }
        
        // Step 5: Save Deployment and Wallet Info
        console.log("\n💾 Step 5: Saving Configuration...");
        
        const deployments = {
            network: "localhost",
            chainId: 31337,
            contracts: {
                BOTToken: botToken.address
            },
            timestamp: new Date().toISOString()
        };
        
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        const deploymentDir = path.dirname(deploymentPath);
        
        if (!fs.existsSync(deploymentDir)) {
            fs.mkdirSync(deploymentDir, { recursive: true });
        }
        
        fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));
        console.log(`   ✅ Deployment saved: ${deploymentPath}`);
        
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
        console.log(`   ✅ Wallets saved: ${walletPath}`);
        
        // Final Summary
        console.log("\n" + "=".repeat(60));
        console.log("🎉 COMPLETE FUNDING SOLUTION - SUCCESS!");
        console.log("=".repeat(60));
        
        console.log("\n📊 Final Results:");
        console.log(`  • Bots successfully funded: ${successCount}/10`);
        console.log(`  • Total ETH distributed: ${formatEther(totalEth)}`);
        console.log(`  • ETH per bot: ${formatEther(ethAmount)}`);
        console.log(`  • BOT per bot: ${formatEther(botAmount)}`);
        console.log(`  • Transaction test: ✅ Passed`);
        
        if (successCount === 10) {
            console.log("\n🎮 CRISIS RESOLVED!");
            console.log("  ✅ All bots funded and verified");
            console.log("  ✅ Transaction capability confirmed");
            console.log("  ✅ No more 'sender's balance is: 0' errors");
            console.log("  ✅ Ready for interactive gameplay");
        } else {
            throw new Error(`Only ${successCount}/10 bots funded successfully`);
        }
        
        console.log("\n🚀 Next Steps:");
        console.log("  • Interactive CLI should now work");
        console.log("  • Bots can place bets and send transactions");
        console.log("  • Zero balance crisis is resolved");
        
        return {
            success: true,
            fundedBots: successCount,
            totalEthDistributed: formatEther(totalEth),
            botTokenAddress: botToken.address,
            transactionTestPassed: true
        };
        
    } catch (error) {
        console.error("\n❌ Complete funding solution failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Import createWalletClient function
import { createWalletClient, http } from "viem";

// Run the complete solution
main()
    .then((result) => {
        console.log("\n✅ Complete funding solution succeeded!");
        console.log(`   ${result.fundedBots} bots funded with ${result.totalEthDistributed} ETH total`);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Complete funding solution failed:", error);
        process.exit(1);
    });

export default main;