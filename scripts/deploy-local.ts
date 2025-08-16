import hre from "hardhat";
import { parseEther, formatEther } from "viem";

async function main() {
    console.log("🎰 Deploying Barely Human locally...\n");
    
    const publicClient = await hre.viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await hre.viem.getWalletClients();
    
    console.log("Deployer address:", deployer.account.address);
    
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Deployer balance:", formatEther(balance), "ETH\n");
    
    try {
        // 1. Deploy BOT Token
        console.log("1. Deploying BOT Token...");
        const botToken = await hre.viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            staking.account.address,
            team.account.address,
            community.account.address
        ]);
        console.log("   ✅ BOT Token deployed at:", botToken.address);
        
        // 2. Deploy Mock VRF Coordinator
        console.log("\n2. Deploying Mock VRF Coordinator...");
        const mockVRF = await hre.viem.deployContract("MockVRFCoordinator");
        console.log("   ✅ Mock VRF deployed at:", mockVRF.address);
        
        // 3. Deploy Treasury
        console.log("\n3. Deploying Treasury...");
        const treasuryContract = await hre.viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address, // dev wallet
            deployer.account.address  // insurance wallet
        ]);
        console.log("   ✅ Treasury deployed at:", treasuryContract.address);
        
        // 4. Deploy StakingPool
        console.log("\n4. Deploying StakingPool...");
        const stakingPool = await hre.viem.deployContract("StakingPool", [
            botToken.address,
            treasuryContract.address
        ]);
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        // Test basic functionality
        console.log("\n📊 Testing basic functionality...");
        
        const totalSupply = await botToken.read.totalSupply();
        console.log("   Total supply:", formatEther(totalSupply), "BOT");
        
        const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
        console.log("   Treasury balance:", formatEther(treasuryBalance), "BOT");
        
        console.log("\n🎉 Local deployment complete!");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });