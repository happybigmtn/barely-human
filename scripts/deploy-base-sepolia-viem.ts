import hre from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from "fs";
import path from "path";

// Base Sepolia addresses
const BASE_SEPOLIA = {
    CHAINLINK_VRF_COORDINATOR: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" as `0x${string}`,
    CHAINLINK_KEY_HASH: "0x83250c5584ffa93feb6ee082981c5ebe484c865196750b39835ad4f13780435d" as `0x${string}`,
    CHAINLINK_SUBSCRIPTION_ID: 1n, // You'll need to create this
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`, // Base Sepolia USDC
    WETH: "0x4200000000000000000000000000000000000006" as `0x${string}`, // Base Sepolia WETH
    UNISWAP_V2_ROUTER: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24" as `0x${string}`, // Base Sepolia Router
};

// Deployment configuration
const CONFIG = {
    // Team wallets (replace with actual addresses)
    TEAM_WALLET: (process.env.TEAM_WALLET || "0x0000000000000000000000000000000000000001") as `0x${string}`,
    DEVELOPMENT_WALLET: (process.env.DEV_WALLET || "0x0000000000000000000000000000000000000002") as `0x${string}`,
    INSURANCE_WALLET: (process.env.INSURANCE_WALLET || "0x0000000000000000000000000000000000000003") as `0x${string}`,
    
    // Bot personalities
    BOT_NAMES: [
        "Alice All-In",
        "Bob Calculator",
        "Charlie Lucky",
        "Diana Ice Queen",
        "Eddie Entertainer",
        "Fiona Fearless",
        "Greg Grinder",
        "Helen Hot Streak",
        "Ivan Intimidator",
        "Julia Jinx"
    ],
    
    // Initial liquidity (in BOT tokens)
    INITIAL_LIQUIDITY_PER_VAULT: parseEther("10000000"), // 10M BOT per vault
};

async function main() {
    console.log("🎰 Deploying Barely Human to Base Sepolia...\n");
    
    const publicClient = await hre.viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await hre.viem.getWalletClients();
    
    console.log("Deployer address:", deployer.account.address);
    
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Deployer balance:", formatEther(balance), "ETH\n");
    
    // Track deployed addresses
    const deployed: Record<string, `0x${string}`> = {};
    
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
        deployed.BOTToken = botToken.address;
        console.log("   ✅ BOT Token deployed at:", botToken.address);
        
        // 2. Deploy Mock VRF Coordinator (for testing)
        console.log("\n2. Deploying Mock VRF Coordinator...");
        const mockVRF = await hre.viem.deployContract("MockVRFCoordinator");
        deployed.MockVRFCoordinator = mockVRF.address;
        console.log("   ✅ Mock VRF deployed at:", mockVRF.address);
        
        // 3. Deploy Treasury
        console.log("\n3. Deploying Treasury...");
        const treasuryContract = await hre.viem.deployContract("Treasury", [
            botToken.address,
            CONFIG.DEVELOPMENT_WALLET,
            CONFIG.INSURANCE_WALLET
        ]);
        deployed.Treasury = treasuryContract.address;
        console.log("   ✅ Treasury deployed at:", treasuryContract.address);
        
        // 4. Deploy StakingPool
        console.log("\n4. Deploying StakingPool...");
        const stakingPool = await hre.viem.deployContract("StakingPool", [
            botToken.address,
            treasuryContract.address
        ]);
        deployed.StakingPool = stakingPool.address;
        console.log("   ✅ StakingPool deployed at:", stakingPool.address);
        
        // 5. Deploy VaultFactoryLib
        console.log("\n5. Deploying VaultFactoryLib...");
        const vaultFactoryLib = await hre.viem.deployContract("VaultFactoryLib");
        deployed.VaultFactoryLib = vaultFactoryLib.address;
        console.log("   ✅ VaultFactoryLib deployed at:", vaultFactoryLib.address);
        
        // 6. Deploy CrapsGame
        console.log("\n6. Deploying CrapsGame...");
        const crapsGame = await hre.viem.deployContract("CrapsGame", [
            mockVRF.address,
            BASE_SEPOLIA.CHAINLINK_SUBSCRIPTION_ID,
            BASE_SEPOLIA.CHAINLINK_KEY_HASH
        ]);
        deployed.CrapsGame = crapsGame.address;
        console.log("   ✅ CrapsGame deployed at:", crapsGame.address);
        
        // 7. Deploy CrapsBets
        console.log("\n7. Deploying CrapsBets...");
        const crapsBets = await hre.viem.deployContract("CrapsBets", [
            crapsGame.address
        ]);
        deployed.CrapsBets = crapsBets.address;
        console.log("   ✅ CrapsBets deployed at:", crapsBets.address);
        
        // 8. Deploy CrapsSettlement
        console.log("\n8. Deploying CrapsSettlement...");
        const crapsSettlement = await hre.viem.deployContract("CrapsSettlement", [
            crapsGame.address
        ]);
        deployed.CrapsSettlement = crapsSettlement.address;
        console.log("   ✅ CrapsSettlement deployed at:", crapsSettlement.address);
        
        // 9. Deploy BotManager
        console.log("\n9. Deploying BotManager...");
        const botManager = await hre.viem.deployContract("BotManager", [
            crapsGame.address
        ]);
        deployed.BotManager = botManager.address;
        console.log("   ✅ BotManager deployed at:", botManager.address);
        
        // 10. Deploy VaultFactoryOptimized (with library)
        console.log("\n10. Deploying VaultFactoryOptimized...");
        const vaultFactory = await hre.viem.deployContract("VaultFactoryOptimized", [
            botToken.address,
            crapsGame.address,
            treasuryContract.address
        ], {
            libraries: {
                VaultFactoryLib: vaultFactoryLib.address
            }
        });
        deployed.VaultFactoryOptimized = vaultFactory.address;
        console.log("   ✅ VaultFactoryOptimized deployed at:", vaultFactory.address);
        
        // 11. Deploy GachaMintPass
        console.log("\n11. Deploying GachaMintPass...");
        const gachaMintPass = await hre.viem.deployContract("GachaMintPass", [
            mockVRF.address,
            BASE_SEPOLIA.CHAINLINK_SUBSCRIPTION_ID,
            BASE_SEPOLIA.CHAINLINK_KEY_HASH,
            crapsGame.address
        ]);
        deployed.GachaMintPass = gachaMintPass.address;
        console.log("   ✅ GachaMintPass deployed at:", gachaMintPass.address);
        
        // 12. Deploy BotSwapFeeHook
        console.log("\n12. Deploying BotSwapFeeHook...");
        const botSwapFeeHook = await hre.viem.deployContract("BotSwapFeeHook", [
            botToken.address,
            treasuryContract.address
        ]);
        deployed.BotSwapFeeHook = botSwapFeeHook.address;
        console.log("   ✅ BotSwapFeeHook deployed at:", botSwapFeeHook.address);
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=".repeat(50));
        
        // Configure contracts
        console.log("\n📝 Configuring contracts...");
        
        // Set up roles
        console.log("   Setting up CrapsGame roles...");
        const GAME_ROLE = await crapsGame.read.GAME_ROLE();
        await crapsGame.write.grantRole([GAME_ROLE, crapsBets.address]);
        await crapsGame.write.grantRole([GAME_ROLE, crapsSettlement.address]);
        await crapsGame.write.grantRole([GAME_ROLE, botManager.address]);
        
        // Create bot vaults
        console.log("   Creating bot vaults...");
        for (let i = 0; i < CONFIG.BOT_NAMES.length; i++) {
            const tx = await vaultFactory.write.createBotVault([
                BigInt(i),
                CONFIG.BOT_NAMES[i]
            ]);
            console.log(`      ✅ Created vault for ${CONFIG.BOT_NAMES[i]}`);
        }
        
        // Save deployment addresses
        const deploymentPath = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath);
        }
        
        const deploymentFile = path.join(deploymentPath, `base-sepolia-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify({
            network: "base-sepolia",
            chainId: 84532,
            deployer: deployer.account.address,
            timestamp: new Date().toISOString(),
            contracts: deployed
        }, null, 2));
        
        console.log("\n📁 Deployment addresses saved to:", deploymentFile);
        
        // Print summary
        console.log("\n" + "=".repeat(50));
        console.log("📋 DEPLOYMENT SUMMARY");
        console.log("=".repeat(50));
        Object.entries(deployed).forEach(([name, address]) => {
            console.log(`${name}: ${address}`);
        });
        
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