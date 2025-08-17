import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

async function main() {
    console.log("⛽ Testing Gas Usage for Deployed Contracts...\n");
    
    // Connect to local network using Hardhat 3.0 pattern
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const [deployer, user1, user2] = await viem.getWalletClients();
    
    try {
        // Load deployed contracts
        const botToken = await viem.getContractAt("BOTToken", "0x5fbdb2315678afecb367f032d93f642f64180aa3");
        const treasury = await viem.getContractAt("Treasury", "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512");
        const stakingPool = await viem.getContractAt("StakingPool", "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0");
        
        console.log("📊 Gas Usage Analysis:\n");
        
        // Test 1: Token Transfer
        console.log("1. Token Transfer (100 BOT):");
        const transferTx = await botToken.write.transfer([user1.account.address, parseEther("100")]);
        const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferTx });
        console.log(`   Gas Used: ${transferReceipt.gasUsed} (${formatEther(transferReceipt.gasUsed * transferReceipt.effectiveGasPrice)} ETH)`);
        
        // Test 2: Token Approval
        console.log("2. Token Approval (1000 BOT):");
        const approveTx = await botToken.write.approve([stakingPool.address, parseEther("1000")], { account: user1.account });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log(`   Gas Used: ${approveReceipt.gasUsed} (${formatEther(approveReceipt.gasUsed * approveReceipt.effectiveGasPrice)} ETH)`);
        
        // Test 3: Staking
        console.log("3. Staking (100 BOT):");
        const stakeTx = await stakingPool.write.stake([parseEther("100")], { account: user1.account });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({ hash: stakeTx });
        console.log(`   Gas Used: ${stakeReceipt.gasUsed} (${formatEther(stakeReceipt.gasUsed * stakeReceipt.effectiveGasPrice)} ETH)`);
        
        // Test 4: Withdrawing
        console.log("4. Withdrawing (50 BOT):");
        const withdrawTx = await stakingPool.write.withdraw([parseEther("50")], { account: user1.account });
        const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
        console.log(`   Gas Used: ${withdrawReceipt.gasUsed} (${formatEther(withdrawReceipt.gasUsed * withdrawReceipt.effectiveGasPrice)} ETH)`);
        
        // Calculate total gas used
        const totalGasUsed = transferReceipt.gasUsed + approveReceipt.gasUsed + stakeReceipt.gasUsed + withdrawReceipt.gasUsed;
        const avgGasPrice = (transferReceipt.effectiveGasPrice + approveReceipt.effectiveGasPrice + stakeReceipt.effectiveGasPrice + withdrawReceipt.effectiveGasPrice) / 4n;
        
        console.log(`\n📈 Summary:`);
        console.log(`   Total Gas Used: ${totalGasUsed}`);
        console.log(`   Average Gas Price: ${avgGasPrice} gwei`);
        console.log(`   Total ETH Cost: ${formatEther(totalGasUsed * avgGasPrice)} ETH`);
        
        // Performance metrics
        console.log(`\n🚀 Performance Metrics:`);
        console.log(`   BOTToken Transfer: ${transferReceipt.gasUsed} gas`);
        console.log(`   BOTToken Approval: ${approveReceipt.gasUsed} gas`);
        console.log(`   StakingPool Stake: ${stakeReceipt.gasUsed} gas`);
        console.log(`   StakingPool Withdraw: ${withdrawReceipt.gasUsed} gas`);
        
        // Gas efficiency ratings
        const gasEfficiency = {
            transfer: Number(transferReceipt.gasUsed),
            approval: Number(approveReceipt.gasUsed),
            stake: Number(stakeReceipt.gasUsed),
            withdraw: Number(withdrawReceipt.gasUsed)
        };
        
        console.log(`\n✅ Gas Efficiency Rating:`);
        Object.entries(gasEfficiency).forEach(([operation, gas]) => {
            const rating = gas < 50000 ? "Excellent" : gas < 100000 ? "Good" : gas < 200000 ? "Fair" : "Poor";
            console.log(`   ${operation}: ${gas} gas - ${rating}`);
        });
        
    } catch (error) {
        console.error("\n❌ Gas testing failed:", error);
        process.exit(1);
    } finally {
        // Close connection
        await connection.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });