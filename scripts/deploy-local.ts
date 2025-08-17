import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

async function main() {
    console.log("🎰 Deploying Barely Human locally...\n");
    
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
        
        // 2. Deploy Mock VRF Coordinator V2Plus
        console.log("\n2. Deploying Mock VRF Coordinator V2Plus...");
        const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
        console.log("   ✅ Mock VRF V2Plus deployed at:", mockVRF.address);
        
        // 3. Deploy Treasury
        console.log("\n3. Deploying Treasury...");
        const treasuryContract = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address, // dev wallet
            deployer.account.address  // insurance wallet
        ]);
        console.log("   ✅ Treasury deployed at:", treasuryContract.address);
        
        // 4. Deploy StakingPool
        console.log("\n4. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,          // staking token (BOT)
            botToken.address,          // reward token (also BOT)
            treasuryContract.address   // treasury address
        ]);
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        // 5. Deploy CrapsGame with mock VRF (using V2Plus variant)
        console.log("\n5. Deploying CrapsGameV2Plus...");
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,                    // VRF coordinator
            1n,                                 // subscription ID
            "0x0000000000000000000000000000000000000000000000000000000000000000" // key hash (mock)
        ]);
        console.log("   ✅ CrapsGameV2Plus deployed at:", crapsGame.address);
        
        // 6. Deploy BotManagerV2Plus  
        console.log("\n6. Deploying BotManagerV2Plus...");
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,                    // VRF coordinator
            1n,                                 // subscription ID
            "0x0000000000000000000000000000000000000000000000000000000000000000" // key hash (mock)
        ]);
        console.log("   ✅ BotManagerV2Plus deployed at:", botManager.address);
        
        // 7. Deploy BettingVault (no factory needed!)
        console.log("\n7. Deploying BettingVault...");
        const bettingVault = await viem.deployContract("BettingVault", [
            botToken.address,
            treasuryContract.address
        ]);
        console.log("   ✅ BettingVault deployed at:", bettingVault.address);
        
        // Test basic functionality
        console.log("\n📊 Testing basic functionality...");
        
        const totalSupply = await botToken.read.totalSupply();
        console.log("   Total supply:", formatEther(totalSupply), "BOT");
        
        const treasuryBalance = await botToken.read.balanceOf([treasury.account.address]);
        console.log("   Treasury balance:", formatEther(treasuryBalance), "BOT");
        
        console.log("\n🎉 Local deployment complete!");
        
        // Save deployment addresses to file
        const deploymentData = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            contracts: {
                BOTToken: botToken.address,
                MockVRFV2Plus: mockVRF.address,
                Treasury: treasuryContract.address,
                StakingPool: stakingPool.address,
                CrapsGameV2Plus: crapsGame.address,
                BotManagerV2Plus: botManager.address,
                BettingVault: bettingVault.address
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
        await fs.writeFile('deployments/localhost.json', JSON.stringify(deploymentData, null, 2));
        console.log("   💾 Deployment addresses saved to deployments/localhost.json");
        
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