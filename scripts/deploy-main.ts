import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from 'fs';

async function main() {
    console.log("🎲 Deploying Barely Human DeFi Casino System...\n");
    
    // Connect to network using Hardhat 3.0 pattern
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await viem.getWalletClients();
    
    console.log("Deployer address:", deployer.account.address);
    
    try {
        // Core Contracts
        const botToken = await viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            staking.account.address,
            team.account.address,
            community.account.address
        ]);
        console.log("✅ BOT Token:", botToken.address);
        
        const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
        console.log("✅ Mock VRF:", mockVRF.address);
        
        const treasuryContract = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address,
            deployer.account.address
        ]);
        console.log("✅ Treasury:", treasuryContract.address);
        
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            botToken.address,
            treasuryContract.address
        ]);
        console.log("✅ StakingPool:", stakingPool.address);
        
        // Game Contracts (V2Plus versions)
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001" // keyHash
        ]);
        console.log("✅ CrapsGameV2Plus:", crapsGame.address);
        
        const crapsBets = await viem.deployContract("CrapsBets", [
            botToken.address,
            parseEther("1"),    // minBet
            parseEther("10000") // maxBet
        ]);
        console.log("✅ CrapsBets:", crapsBets.address);
        
        const crapsSettlement = await viem.deployContract("CrapsSettlement");
        console.log("✅ CrapsSettlement:", crapsSettlement.address);
        
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001", // keyHash
            crapsGame.address,
            crapsBets.address,
            treasuryContract.address
        ]);
        console.log("✅ BotManagerV2Plus:", botManager.address);
        
        // Deploy BettingVault (no factory needed!)
        const bettingVault = await viem.deployContract("BettingVault", [
            botToken.address,
            treasuryContract.address
        ]);
        console.log("✅ BettingVault:", bettingVault.address);
        
        // Configure connections
        await crapsBets.write.setContracts([
            crapsGame.address,
            bettingVault.address,
            crapsSettlement.address
        ]);
        
        await crapsSettlement.write.setContracts([
            crapsGame.address,
            crapsBets.address,
            treasuryContract.address
        ]);
        
        await bettingVault.write.grantBetsRole([crapsBets.address]);
        await bettingVault.write.grantGameRole([crapsGame.address]);
        
        await botManager.write.initializeBots();
        
        console.log("\n✅ Deployment complete!");
        
        // Save deployment info
        const deployment = {
            network: network.name,
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
            }
        };
        
        fs.writeFileSync(
            `deployments/${network.name}.json`,
            JSON.stringify(deployment, null, 2)
        );
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);
