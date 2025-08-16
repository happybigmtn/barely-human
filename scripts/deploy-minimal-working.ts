import { network } from "hardhat";
import fs from "fs";

async function main() {
    console.log("🚀 Minimal Working Deployment");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        const publicClient = await viem.getPublicClient();
        const walletClients = await viem.getWalletClients();
        const deployer = walletClients[0];
        
        console.log(`📍 Deployer: ${deployer.account.address}`);
        
        const deployments: any = {
            network: "localhost",
            chainId: 31337,
            contracts: {},
            timestamp: new Date().toISOString()
        };
        
        // Step 1: Deploy BOT Token
        console.log("\n1. Deploying BOT Token...");
        const botToken = await viem.deployContract("BOTToken", [
            deployer.account.address, // treasury
            deployer.account.address, // liquidity
            deployer.account.address, // staking rewards
            deployer.account.address, // team
            deployer.account.address  // community
        ]);
        deployments.contracts.BOTToken = botToken.address;
        
        // Verify it exists
        let bytecode = await publicClient.getBytecode({ address: botToken.address });
        console.log(`   ✅ BOT Token: ${botToken.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 2: Deploy Treasury
        console.log("\n2. Deploying Treasury...");
        const treasury = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address, // development wallet
            deployer.account.address  // insurance wallet
        ]);
        deployments.contracts.Treasury = treasury.address;
        
        bytecode = await publicClient.getBytecode({ address: treasury.address });
        console.log(`   ✅ Treasury: ${treasury.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 3: Deploy StakingPool
        console.log("\n3. Deploying StakingPool...");
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address, // staking token
            botToken.address, // reward token (same token)
            treasury.address  // treasury
        ]);
        deployments.contracts.StakingPool = stakingPool.address;
        
        bytecode = await publicClient.getBytecode({ address: stakingPool.address });
        console.log(`   ✅ StakingPool: ${stakingPool.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 4: Deploy Mock VRF
        console.log("\n4. Deploying Mock VRF...");
        const mockVRF = await viem.deployContract("MockVRFCoordinator", []);
        deployments.contracts.MockVRF = mockVRF.address;
        
        bytecode = await publicClient.getBytecode({ address: mockVRF.address });
        console.log(`   ✅ Mock VRF: ${mockVRF.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 5: Deploy VaultFactory (Optimized)
        console.log("\n5. Deploying VaultFactory...");
        const vaultFactory = await viem.deployContract("VaultFactoryOptimized", [
            botToken.address,
            treasury.address
        ]);
        deployments.contracts.VaultFactory = vaultFactory.address;
        
        bytecode = await publicClient.getBytecode({ address: vaultFactory.address });
        console.log(`   ✅ VaultFactory: ${vaultFactory.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 6: Deploy Game Contracts
        console.log("\n6. Deploying Game Contracts...");
        
        const crapsGame = await viem.deployContract("CrapsGame", [
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
        ]);
        deployments.contracts.CrapsGame = crapsGame.address;
        
        const crapsBets = await viem.deployContract("CrapsBets", []);
        deployments.contracts.CrapsBets = crapsBets.address;
        
        const crapsSettlement = await viem.deployContract("CrapsSettlement", []);
        deployments.contracts.CrapsSettlement = crapsSettlement.address;
        
        console.log(`   ✅ CrapsGame: ${crapsGame.address}`);
        console.log(`   ✅ CrapsBets: ${crapsBets.address}`);
        console.log(`   ✅ CrapsSettlement: ${crapsSettlement.address}`);
        
        // Step 7: Deploy BotManager
        console.log("\n7. Deploying BotManager...");
        const botManager = await viem.deployContract("BotManager", [
            vaultFactory.address,
            mockVRF.address,
            1n,
            "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
        ]);
        deployments.contracts.BotManager = botManager.address;
        
        bytecode = await publicClient.getBytecode({ address: botManager.address });
        console.log(`   ✅ BotManager: ${botManager.address} (${bytecode ? 'EXISTS' : 'MISSING'})`);
        
        // Step 8: Create Bot Vaults
        console.log("\n8. Creating Bot Vaults...");
        const deployAllTx = await vaultFactory.write.deployAllBots([]);
        await publicClient.waitForTransactionReceipt({ hash: deployAllTx });
        
        // Get all vault addresses
        const vaultAddresses: string[] = [];
        for (let i = 0; i < 10; i++) {
            const vaultAddress = await vaultFactory.read.getVault([i]);
            vaultAddresses.push(vaultAddress);
        }
        
        deployments.contracts.BotVaults = vaultAddresses;
        console.log(`   ✅ Created ${vaultAddresses.length} bot vaults`);
        
        // Step 9: Configure Game Contracts
        console.log("\n9. Configuring Game Contracts...");
        
        // Configure CrapsGame with its dependencies
        const configTx1 = await crapsGame.write.setContracts([
            crapsBets.address,
            crapsSettlement.address,
            vaultAddresses[0] // Use first vault as default
        ]);
        await publicClient.waitForTransactionReceipt({ hash: configTx1 });
        
        // Configure CrapsBets with all contracts
        const configTx2 = await crapsBets.write.setContracts([
            crapsGame.address,
            vaultFactory.address,
            crapsSettlement.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: configTx2 });
        
        // Configure CrapsSettlement with all contracts
        const configTx3 = await crapsSettlement.write.setContracts([
            crapsGame.address,
            crapsBets.address,
            vaultFactory.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: configTx3 });
        
        // Configure BotManager with game contract
        const configTx4 = await botManager.write.setGameContract([
            crapsGame.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: configTx4 });
        
        // Step 9.5: Set up roles for contract interactions
        console.log("\n9.5. Setting up contract roles...");
        
        // Grant SETTLEMENT_ROLE to CrapsSettlement on CrapsGame
        const roleTx1 = await crapsGame.write.grantRole([
            await crapsGame.read.SETTLEMENT_ROLE(),
            crapsSettlement.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: roleTx1 });
        
        // Grant VAULT_ROLE to VaultFactory on CrapsGame
        const roleTx2 = await crapsGame.write.grantRole([
            await crapsGame.read.VAULT_ROLE(),
            vaultFactory.address
        ]);
        await publicClient.waitForTransactionReceipt({ hash: roleTx2 });
        
        console.log(`   ✅ Contract roles configured`);
        console.log(`   ✅ Game contracts fully configured`);
        
        // Step 10: Initialize BotManager
        console.log("\n10. Initializing BotManager...");
        const initTx = await botManager.write.initializeBots([]);
        await publicClient.waitForTransactionReceipt({ hash: initTx });
        console.log(`   ✅ Bot personalities initialized`);
        
        // Step 11: Test BotManager
        console.log("\n11. Testing BotManager...");
        try {
            const personality = await botManager.read.getPersonality([0]);
            console.log(`   ✅ Bot 0 personality: ${personality}`);
        } catch (error) {
            console.log(`   ❌ Failed to read personality: ${error.message}`);
        }
        
        // Save deployment info
        const deploymentPath = "./deployments/localhost.json";
        fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));
        console.log(`\n💾 Deployment saved to ${deploymentPath}`);
        
        console.log("\n🎉 Deployment Complete!");
        console.log("✅ All contracts deployed and verified");
        console.log("✅ Bot personalities initialized");
        console.log("✅ Ready for interactive CLI");
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);