import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

async function main() {
    console.log("🎰 Deploying Basic Contracts locally...\n");
    
    // Connect to local network using Hardhat 3.0 pattern
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await viem.getWalletClients();
    
    console.log("Deployer address:", deployer.account.address);
    
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Deployer balance:", formatEther(balance), "ETH\n");
    
    try {
        // 1. Deploy BOT Token
        console.log("1. Deploying BOT Token...");
        const botToken = await viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            staking.account.address,
            team.account.address,
            community.account.address
        ]);
        console.log("   ✅ BOT Token deployed at:", botToken.address);
        
        // 2. Deploy Treasury
        console.log("\n2. Deploying Treasury...");
        const treasuryContract = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address, // dev wallet
            deployer.account.address  // insurance wallet
        ]);
        console.log("   ✅ Treasury deployed at:", treasuryContract.address);
        
        // 3. Deploy StakingPool
        console.log("\n3. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,          // staking token (BOT)
            botToken.address,          // reward token (also BOT)
            treasuryContract.address   // treasury address
        ]);
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        // Test basic functionality
        console.log("\n📊 Testing basic functionality...");
        
        const totalSupply = await botToken.read.totalSupply();
        console.log("   Total supply:", formatEther(totalSupply), "BOT");
        
        const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
        console.log("   Treasury balance:", formatEther(treasuryBalance), "BOT");
        
        console.log("\n🎉 Basic deployment complete!");
        
        // Save deployment addresses to file
        const deploymentData = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            contracts: {
                BOTToken: botToken.address,
                Treasury: treasuryContract.address,
                StakingPool: stakingPool.address
            },
            deployer: deployer.account.address,
            accounts: {
                treasury: treasury.account.address,
                liquidity: liquidity.account.address,
                staking: staking.account.address,
                team: team.account.address,
                community: community.account.address
            }
        };
        
        // Write to deployments directory
        const fs = await import('fs/promises');
        await fs.writeFile('deployments/localhost-simple.json', JSON.stringify(deploymentData, null, 2));
        console.log("   💾 Deployment addresses saved to deployments/localhost-simple.json");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
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