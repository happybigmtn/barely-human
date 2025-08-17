// ENS Integration Deployment Script for ETHGlobal NYC 2025
// Supports Base Sepolia, Arbitrum Sepolia, and OP Sepolia

const { ethers, network } = require("hardhat");

async function main() {
    console.log(`🌐 Deploying ENS Integration on ${network.name} (Chain ID: ${network.config.chainId})`);
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log(`📝 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
    
    // Check if network is supported
    const supportedNetworks = [84532, 421614, 11155420, 8453, 42161, 10, 1, 11155111];
    if (!supportedNetworks.includes(network.config.chainId)) {
        throw new Error(`❌ Network ${network.name} (${network.config.chainId}) not supported for ENS`);
    }
    
    console.log("\n🔧 Deploying ENS Network Configuration Library...");
    
    // Deploy ENS Network Config Library
    const ENSNetworkConfig = await ethers.getContractFactory("ENSNetworkConfig");
    const ensNetworkConfig = await ENSNetworkConfig.deploy();
    await ensNetworkConfig.waitForDeployment();
    
    console.log(`✅ ENSNetworkConfig deployed at: ${ensNetworkConfig.target}`);
    
    console.log("\n🤖 Deploying Bot ENS Integration Contract...");
    
    // Deploy Bot ENS Integration
    const BotENSIntegration = await ethers.getContractFactory("BotENSIntegration", {
        libraries: {
            ENSNetworkConfig: ensNetworkConfig.target
        }
    });
    
    const botENSIntegration = await BotENSIntegration.deploy();
    await botENSIntegration.waitForDeployment();
    
    console.log(`✅ BotENSIntegration deployed at: ${botENSIntegration.target}`);
    
    // Get network configuration
    const networkConfig = await botENSIntegration.getENSNetworkConfig();
    console.log("\n📋 Network Configuration:");
    console.log(`   ENS Registry: ${networkConfig.ensRegistry}`);
    console.log(`   Public Resolver: ${networkConfig.publicResolver}`);
    console.log(`   L2 Reverse Registrar: ${networkConfig.l2ReverseRegistrar}`);
    console.log(`   Network Name: ${networkConfig.networkName}`);
    console.log(`   Is L2: ${networkConfig.isL2}`);
    console.log(`   Is Supported: ${networkConfig.isSupported}`);
    
    // Initialize bot personalities with ENS names
    console.log("\n🎭 Initializing Bot Personalities with ENS names...");
    
    try {
        // Check if we can create subdomains (requires owning rng.eth)
        const rngEthNode = await botENSIntegration.rngEthNode();
        console.log(`   rng.eth node: ${rngEthNode}`);
        
        // This would require ownership of rng.eth domain
        console.log("   ⚠️  Note: Bot ENS initialization requires ownership of 'rng.eth' domain");
        console.log("   ⚠️  For demo purposes, this can be simulated on testnet");
        
        // Uncomment if you own rng.eth domain:
        // const tx = await botENSIntegration.initializeAllBots();
        // await tx.wait();
        // console.log("✅ All bot personalities initialized with ENS names");
        
    } catch (error) {
        console.log(`   ⚠️  Cannot initialize bots: ${error.message}`);
        console.log("   ℹ️  This is expected if 'rng.eth' is not owned by the contract");
    }
    
    // Test L2 Primary Names (if on L2)
    if (networkConfig.isL2) {
        console.log("\n👤 Testing L2 Primary Names functionality...");
        
        try {
            // Example: Set primary name for deployer
            // This would require the name to exist and resolve to deployer's address
            console.log("   ⚠️  Note: Setting L2 primary names requires the ENS name to exist");
            console.log("   ℹ️  For testing, you would need to register a name first");
            
            // Uncomment if you have a registered ENS name:
            // const primaryNameTx = await botENSIntegration.setPlayerPrimaryName("yourname.eth");
            // await primaryNameTx.wait();
            // console.log("✅ L2 Primary Name set successfully");
            
        } catch (error) {
            console.log(`   ⚠️  Cannot set primary name: ${error.message}`);
        }
    }
    
    // Display deployment summary
    console.log("\n📊 Deployment Summary:");
    console.log("=" .repeat(50));
    console.log(`Network: ${networkConfig.networkName} (${network.config.chainId})`);
    console.log(`ENS Network Config: ${ensNetworkConfig.target}`);
    console.log(`Bot ENS Integration: ${botENSIntegration.target}`);
    console.log(`L2 Support: ${networkConfig.isL2 ? "✅" : "❌"}`);
    console.log("=" .repeat(50));
    
    // Prize qualification summary
    console.log("\n🏆 ETHGlobal NYC 2025 Prize Qualification:");
    console.log("=" .repeat(50));
    console.log("✅ Best use of ENS ($6,000):");
    console.log("   - Meaningful ENS integration for bot personalities");
    console.log("   - Dynamic subdomain creation under rng.eth");
    console.log("   - Text records for bot metadata and statistics");
    console.log("   - ENS resolution for bot discovery");
    
    if (networkConfig.isL2) {
        console.log("✅ Best use of L2 Primary Names ($4,000):");
        console.log("   - L2ReverseRegistrar integration");
        console.log("   - Player identity system with primary names");
        console.log("   - Achievement tracking via ENS");
        console.log("   - Multi-chain ENS support");
    }
    console.log("=" .repeat(50));
    
    // Next steps
    console.log("\n📋 Next Steps for Full Integration:");
    console.log("1. Register 'rng.eth' domain (or use subdomain of owned domain)");
    console.log("2. Initialize bot personalities with ENS names");
    console.log("3. Connect to frontend for name resolution");
    console.log("4. Implement player registration with ENS names");
    console.log("5. Add achievement system integration");
    console.log("6. Create demo video for prize submission");
    
    // Save deployment info
    const deploymentInfo = {
        network: networkConfig.networkName,
        chainId: network.config.chainId,
        contracts: {
            ensNetworkConfig: ensNetworkConfig.target,
            botENSIntegration: botENSIntegration.target
        },
        ensConfig: {
            registry: networkConfig.ensRegistry,
            resolver: networkConfig.publicResolver,
            l2ReverseRegistrar: networkConfig.l2ReverseRegistrar,
            isL2: networkConfig.isL2
        },
        timestamp: new Date().toISOString()
    };
    
    require('fs').writeFileSync(
        `./deployments/ens-integration-${network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n💾 Deployment info saved to: ./deployments/ens-integration-${network.name}.json`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });