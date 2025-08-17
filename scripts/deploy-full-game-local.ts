import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from 'fs';

async function main() {
    console.log("🎲 Deploying Full Barely Human Game System Locally...\n");
    
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
        
        // 5. Deploy CrapsGameV2Plus with proper configuration
        console.log("\n5. Deploying CrapsGameV2Plus...");
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,                    // VRF coordinator
            1n,                                 // subscription ID
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // key hash
        ]);
        console.log("   ✅ CrapsGameV2Plus deployed at:", crapsGame.address);
        
        // 6. Deploy CrapsBets
        console.log("\n6. Deploying CrapsBets...");
        const crapsBets = await viem.deployContract("CrapsBets");
        console.log("   ✅ CrapsBets deployed at:", crapsBets.address);
        
        // 7. Deploy CrapsSettlement
        console.log("\n7. Deploying CrapsSettlement...");
        const crapsSettlement = await viem.deployContract("CrapsSettlement");
        console.log("   ✅ CrapsSettlement deployed at:", crapsSettlement.address);
        
        // 8. Deploy BotManagerV2Plus  
        console.log("\n8. Deploying BotManagerV2Plus...");
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,                    // VRF coordinator
            1n,                                 // subscription ID
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // key hash
        ]);
        console.log("   ✅ BotManagerV2Plus deployed at:", botManager.address);
        
        // 9. Deploy BettingVault (no factory needed!)  
        console.log("\n9. Deploying BettingVault...");
        const bettingVault = await viem.deployContract("BettingVault", [
            botToken.address,
            treasuryContract.address
        ]);
        console.log("   ✅ BettingVault deployed at:", bettingVault.address);
        
        // 10. Set up contract permissions and relationships
        console.log("\n10. Setting up contract permissions...");
        
        // Set contracts on CrapsBets
        await crapsBets.write.setContracts([crapsGame.address, bettingVault.address, crapsSettlement.address]);
        console.log("   ✅ Set contracts on CrapsBets");
        
        // Set contracts on CrapsSettlement  
        await crapsSettlement.write.setContracts([crapsGame.address, crapsBets.address, treasuryContract.address]);
        console.log("   ✅ Set contracts on CrapsSettlement");
        
        // Grant roles to CrapsBets on CrapsGame
        await crapsGame.write.grantRole([await crapsGame.read.SETTLEMENT_ROLE(), crapsBets.address]);
        console.log("   ✅ Granted SETTLEMENT_ROLE to CrapsBets");
        
        // Grant roles to CrapsSettlement
        await crapsGame.write.grantRole([await crapsGame.read.SETTLEMENT_ROLE(), crapsSettlement.address]);
        await crapsBets.write.grantRole([await crapsBets.read.SETTLEMENT_ROLE(), crapsSettlement.address]);
        console.log("   ✅ Granted roles to CrapsSettlement");
        
        // Initialize bot personalities
        await botManager.write.initializeBots();
        console.log("   ✅ Initialized bot personalities");
        
        // Test basic functionality
        console.log("\n📊 Testing basic functionality...");
        
        const totalSupply = await botToken.read.totalSupply();
        console.log("   Total supply:", formatEther(totalSupply), "BOT");
        
        const gamePhase = await crapsGame.read.getCurrentPhase();
        console.log("   Game phase:", gamePhase);
        
        const botCount = await botManager.read.getBotCount();
        console.log("   Bot count:", botCount.toString());
        
        console.log("\n🎉 Full game deployment complete!");
        
        // Save deployment addresses to file for CLI
        const deploymentData = {
            network: "localhost",
            timestamp: new Date().toISOString(),
            contracts: {
                BOTToken: botToken.address,
                MockVRFV2Plus: mockVRF.address,
                Treasury: treasuryContract.address,
                StakingPool: stakingPool.address,
                CrapsGameV2Plus: crapsGame.address,
                CrapsBets: crapsBets.address,
                CrapsSettlement: crapsSettlement.address,
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
        
        // Ensure deployments directory exists
        if (!fs.existsSync('deployments')) {
            fs.mkdirSync('deployments');
        }
        
        fs.writeFileSync('deployments/localhost.json', JSON.stringify(deploymentData, null, 2));
        console.log("   📄 Deployment data saved to deployments/localhost.json");
        
        await connection.close();
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        await connection.close();
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });