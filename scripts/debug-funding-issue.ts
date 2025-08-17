import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

/**
 * Debug Funding Issue - Figure out why bots still have 0 balance
 */
async function main() {
    console.log("🔍 DEBUGGING FUNDING ISSUE\n");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const [deployer, liquidity] = walletClients;
        
        console.log("📊 Blockchain Status:");
        console.log(`  Chain ID: ${await publicClient.getChainId()}`);
        console.log(`  Current Block: ${await publicClient.getBlockNumber()}`);
        console.log(`  Deployer: ${deployer.account.address}`);
        console.log(`  Liquidity: ${liquidity.account.address}\n`);
        
        // Check deployer balance
        const deployerBalance = await publicClient.getBalance({ address: deployer.account.address });
        console.log(`💰 Deployer ETH Balance: ${formatEther(deployerBalance)}`);
        
        // Load deployments
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        if (!fs.existsSync(deploymentPath)) {
            console.log("❌ No deployment file found");
            return;
        }
        
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log(`\n📋 Current Deployment:`);
        console.log(`  BOT Token: ${deployments.contracts.BOTToken}`);
        console.log(`  Block Number when saved: ${await publicClient.getBlockNumber()}\n`);
        
        // Check if we can read from BOT token contract
        try {
            const tokenName = await publicClient.readContract({
                address: deployments.contracts.BOTToken,
                abi: [
                    {
                        name: "name",
                        type: "function",
                        stateMutability: "view",
                        inputs: [],
                        outputs: [{ name: "", type: "string" }]
                    }
                ],
                functionName: "name"
            });
            console.log(`✅ BOT Token Contract accessible: ${tokenName}`);
        } catch (error) {
            console.log(`❌ BOT Token Contract error: ${error.message}`);
        }
        
        // Check the exact bot addresses from both scripts
        console.log("\n🤖 Checking Bot Addresses and Balances:");
        
        for (let i = 0; i < 3; i++) {
            const privateKey = `0x${(i + 1).toString(16).padStart(64, '0')}`;
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            
            console.log(`\nBot ${i}:`);
            console.log(`  Private Key: ${privateKey}`);
            console.log(`  Address: ${account.address}`);
            
            // Check balance
            const balance = await publicClient.getBalance({ address: account.address });
            console.log(`  ETH Balance: ${formatEther(balance)}`);
            
            if (balance === 0n) {
                console.log(`  ❌ No ETH - funding failed or wrong chain`);
            } else {
                console.log(`  ✅ Has ETH - funding worked`);
            }
        }
        
        // Check bot-wallets.json file if it exists
        const botWalletPath = path.join(process.cwd(), "bot-wallets.json");
        if (fs.existsSync(botWalletPath)) {
            console.log("\n📄 Checking saved bot-wallets.json:");
            const savedWallets = JSON.parse(fs.readFileSync(botWalletPath, 'utf8'));
            console.log(`  Timestamp: ${savedWallets.timestamp}`);
            console.log(`  Bot count: ${savedWallets.botWallets?.length || 0}`);
            
            if (savedWallets.botWallets && savedWallets.botWallets.length > 0) {
                for (let i = 0; i < Math.min(3, savedWallets.botWallets.length); i++) {
                    const savedBot = savedWallets.botWallets[i];
                    console.log(`  Saved Bot ${i}: ${savedBot.address}`);
                    
                    const balance = await publicClient.getBalance({ address: savedBot.address });
                    console.log(`    Balance: ${formatEther(balance)} ETH`);
                }
            }
        } else {
            console.log("\n📄 No bot-wallets.json file found");
        }
        
        // Try to find where the ETH actually went
        console.log("\n🔍 Investigating Recent Transactions:");
        const latestBlock = await publicClient.getBlockNumber();
        
        for (let blockNum = latestBlock; blockNum > Math.max(0n, latestBlock - 10n); blockNum--) {
            const block = await publicClient.getBlock({ 
                blockNumber: blockNum, 
                includeTransactions: true 
            });
            
            if (block.transactions.length > 0) {
                console.log(`\nBlock ${blockNum}: ${block.transactions.length} transactions`);
                for (const tx of block.transactions.slice(0, 5)) { // Show first 5 txs
                    if (typeof tx === 'object') {
                        console.log(`  TX: ${tx.hash}`);
                        console.log(`    From: ${tx.from}`);
                        console.log(`    To: ${tx.to}`);
                        console.log(`    Value: ${formatEther(tx.value || 0n)} ETH`);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("\n❌ Debug failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run the debug
main()
    .then(() => {
        console.log("\n✅ Debug completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Debug failed:", error);
        process.exit(1);
    });

export default main;