const hre = require("hardhat");
const { ethers } = require("hardhat");

// Base Sepolia addresses
const BASE_SEPOLIA = {
    CHAINLINK_VRF_COORDINATOR: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634",
    CHAINLINK_KEY_HASH: "0x83250c5584ffa93feb6ee082981c5ebe484c865196750b39835ad4f13780435d",
    CHAINLINK_SUBSCRIPTION_ID: 1, // You'll need to create this
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    WETH: "0x4200000000000000000000000000000000000006", // Base Sepolia WETH
    UNISWAP_V2_ROUTER: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Base Sepolia Router
};

// Deployment configuration
const CONFIG = {
    // Team wallets (replace with actual addresses)
    TEAM_WALLET: process.env.TEAM_WALLET || "0x0000000000000000000000000000000000000001",
    DEVELOPMENT_WALLET: process.env.DEV_WALLET || "0x0000000000000000000000000000000000000002",
    INSURANCE_WALLET: process.env.INSURANCE_WALLET || "0x0000000000000000000000000000000000000003",
    
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
    INITIAL_LIQUIDITY_PER_VAULT: ethers.parseEther("10000000"), // 10M BOT per vault
};

async function main() {
    console.log("🎰 Deploying Barely Human to Base Sepolia...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");
    
    // Track deployed addresses
    const deployed = {};
    
    try {
        // 1. Deploy BOT Token
        console.log("1. Deploying BOT Token...");
        const BOTToken = await ethers.getContractFactory("BOTToken");
        const botToken = await BOTToken.deploy(
            CONFIG.TEAM_WALLET,
            CONFIG.DEVELOPMENT_WALLET,
            CONFIG.INSURANCE_WALLET
        );
        await botToken.waitForDeployment();
        deployed.BOTToken = await botToken.getAddress();
        console.log("   ✅ BOT Token deployed at:", deployed.BOTToken);
        
        // 2. Deploy Treasury
        console.log("\n2. Deploying Treasury...");
        const Treasury = await ethers.getContractFactory("Treasury");
        const treasury = await Treasury.deploy(
            deployed.BOTToken,
            CONFIG.DEVELOPMENT_WALLET,
            CONFIG.INSURANCE_WALLET
        );
        await treasury.waitForDeployment();
        deployed.Treasury = await treasury.getAddress();
        console.log("   ✅ Treasury deployed at:", deployed.Treasury);
        
        // 3. Deploy StakingPool
        console.log("\n3. Deploying StakingPool...");
        const StakingPool = await ethers.getContractFactory("StakingPool");
        const stakingPool = await StakingPool.deploy(
            deployed.BOTToken,
            deployed.BOTToken, // BOT is both staking and reward token
            deployed.Treasury
        );
        await stakingPool.waitForDeployment();
        deployed.StakingPool = await stakingPool.getAddress();
        console.log("   ✅ StakingPool deployed at:", deployed.StakingPool);
        
        // 4. Deploy CrapsGame
        console.log("\n4. Deploying CrapsGame...");
        const CrapsGame = await ethers.getContractFactory("CrapsGame");
        const crapsGame = await CrapsGame.deploy(
            BASE_SEPOLIA.CHAINLINK_VRF_COORDINATOR,
            BASE_SEPOLIA.CHAINLINK_SUBSCRIPTION_ID,
            BASE_SEPOLIA.CHAINLINK_KEY_HASH
        );
        await crapsGame.waitForDeployment();
        deployed.CrapsGame = await crapsGame.getAddress();
        console.log("   ✅ CrapsGame deployed at:", deployed.CrapsGame);
        
        // 5. Deploy CrapsBets
        console.log("\n5. Deploying CrapsBets...");
        const CrapsBets = await ethers.getContractFactory("CrapsBets");
        const crapsBets = await CrapsBets.deploy(deployed.CrapsGame);
        await crapsBets.waitForDeployment();
        deployed.CrapsBets = await crapsBets.getAddress();
        console.log("   ✅ CrapsBets deployed at:", deployed.CrapsBets);
        
        // 6. Deploy CrapsSettlement
        console.log("\n6. Deploying CrapsSettlement...");
        const CrapsSettlement = await ethers.getContractFactory("CrapsSettlement");
        const crapsSettlement = await CrapsSettlement.deploy(deployed.CrapsGame);
        await crapsSettlement.waitForDeployment();
        deployed.CrapsSettlement = await crapsSettlement.getAddress();
        console.log("   ✅ CrapsSettlement deployed at:", deployed.CrapsSettlement);
        
        // 7. Deploy BotManager
        console.log("\n7. Deploying BotManager...");
        const BotManager = await ethers.getContractFactory("BotManager");
        const botManager = await BotManager.deploy();
        await botManager.waitForDeployment();
        deployed.BotManager = await botManager.getAddress();
        console.log("   ✅ BotManager deployed at:", deployed.BotManager);
        
        // 8. Deploy VaultFactoryLib
        console.log("\n8. Deploying VaultFactoryLib...");
        const VaultFactoryLib = await ethers.getContractFactory("VaultFactoryLib");
        const vaultFactoryLib = await VaultFactoryLib.deploy();
        await vaultFactoryLib.waitForDeployment();
        deployed.VaultFactoryLib = await vaultFactoryLib.getAddress();
        console.log("   ✅ VaultFactoryLib deployed at:", deployed.VaultFactoryLib);
        
        // 9. Deploy VaultFactoryOptimized
        console.log("\n9. Deploying VaultFactoryOptimized...");
        const VaultFactoryOptimized = await ethers.getContractFactory("VaultFactoryOptimized", {
            libraries: {
                VaultFactoryLib: deployed.VaultFactoryLib
            }
        });
        const vaultFactory = await VaultFactoryOptimized.deploy(
            deployed.BOTToken,
            deployed.CrapsGame,
            deployed.BotManager,
            deployed.Treasury
        );
        await vaultFactory.waitForDeployment();
        deployed.VaultFactory = await vaultFactory.getAddress();
        console.log("   ✅ VaultFactory deployed at:", deployed.VaultFactory);
        
        // 10. Configure contracts
        console.log("\n10. Configuring contracts...");
        
        // Set up CrapsGame
        console.log("   - Setting bet and settlement contracts...");
        await crapsGame.setBetContract(deployed.CrapsBets);
        await crapsGame.setSettlementContract(deployed.CrapsSettlement);
        
        // Configure Treasury
        console.log("   - Configuring Treasury...");
        await treasury.setStakingPool(deployed.StakingPool);
        await treasury.setRouter(BASE_SEPOLIA.UNISWAP_V2_ROUTER);
        
        // Grant Treasury role to BOT token
        console.log("   - Granting Treasury roles...");
        const TREASURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ROLE"));
        await botToken.grantRole(TREASURY_ROLE, deployed.Treasury);
        
        // Grant Staking role to StakingPool
        const STAKING_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STAKING_ROLE"));
        await botToken.grantRole(STAKING_ROLE, deployed.StakingPool);
        
        // Create bot vaults
        console.log("\n11. Creating bot vaults...");
        for (let i = 0; i < CONFIG.BOT_NAMES.length; i++) {
            console.log(`   - Creating vault for ${CONFIG.BOT_NAMES[i]}...`);
            await vaultFactory.createBotVault(i);
        }
        
        // Get vault addresses
        const vaultAddresses = [];
        for (let i = 0; i < CONFIG.BOT_NAMES.length; i++) {
            const vaultAddr = await vaultFactory.botVaults(i);
            vaultAddresses.push(vaultAddr);
            console.log(`   ✅ Vault ${i} (${CONFIG.BOT_NAMES[i]}): ${vaultAddr}`);
        }
        
        // Grant vault roles to Treasury
        console.log("\n12. Granting vault roles to Treasury...");
        const VAULT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_ROLE"));
        for (const vaultAddr of vaultAddresses) {
            await treasury.addVault(vaultAddr);
        }
        
        // Save deployment addresses
        const deployment = {
            network: "base-sepolia",
            chainId: 84532,
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            contracts: deployed,
            vaults: vaultAddresses,
            config: BASE_SEPOLIA
        };
        
        const fs = require("fs");
        const deploymentPath = `./deployments/base-sepolia-${Date.now()}.json`;
        fs.mkdirSync("./deployments", { recursive: true });
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        
        console.log("\n✅ Deployment complete!");
        console.log("📁 Deployment info saved to:", deploymentPath);
        
        // Display summary
        console.log("\n📊 Deployment Summary:");
        console.log("=======================");
        for (const [name, address] of Object.entries(deployed)) {
            console.log(`${name}: ${address}`);
        }
        
        console.log("\n🎲 Bot Vaults:");
        console.log("==============");
        for (let i = 0; i < vaultAddresses.length; i++) {
            console.log(`${CONFIG.BOT_NAMES[i]}: ${vaultAddresses[i]}`);
        }
        
        console.log("\n⚠️  Next Steps:");
        console.log("1. Fund vaults with initial BOT liquidity");
        console.log("2. Create Chainlink VRF subscription at https://vrf.chain.link");
        console.log("3. Add CrapsGame as VRF consumer");
        console.log("4. Verify contracts on BaseScan");
        console.log("5. Deploy frontend and connect to contracts");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });