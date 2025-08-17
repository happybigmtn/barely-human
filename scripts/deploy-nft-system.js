#!/usr/bin/env node

/**
 * Deploy the complete NFT system for Barely Human
 * Includes mint passes, generative art NFTs, and redemption service
 */

const { execSync } = require('child_process');
const { network } = require('hardhat');
const fs = require('fs');
const path = require('path');

const COLOR = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m'
};

function log(message, color = COLOR.RESET) {
  console.log(`${color}${message}${COLOR.RESET}`);
}

async function deployNFTSystem() {
  try {
    log('🎨 Starting Barely Human NFT System Deployment...', COLOR.CYAN);
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const deployer = walletClients[0];
    
    log(`📡 Connected to network: ${await publicClient.getChainId()}`, COLOR.GREEN);
    log(`🏦 Deployer address: ${deployer.account.address}`, COLOR.GREEN);
    
    const deployedContracts = {};
    
    // Step 1: Deploy GachaMintPass
    log('\n📋 Step 1: Deploying GachaMintPass...', COLOR.YELLOW);
    
    // Chainlink VRF configuration (using mock for local development)
    const vrfCoordinator = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625"; // Base Sepolia
    const subscriptionId = 1; // You'll need to create this
    const keyHash = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"; // Base Sepolia
    const baseURI = "https://api.barelyhuman.xyz/mintpass/";
    
    const mintPassContract = await viem.deployContract("GachaMintPass", [
      vrfCoordinator,
      subscriptionId,
      keyHash,
      baseURI
    ]);
    
    deployedContracts.mintPass = mintPassContract.address;
    log(`✅ GachaMintPass deployed to: ${mintPassContract.address}`, COLOR.GREEN);
    
    // Step 2: Deploy BarelyHumanArt
    log('\n🎨 Step 2: Deploying BarelyHumanArt...', COLOR.YELLOW);
    
    const artContract = await viem.deployContract("BarelyHumanArt", [
      "Barely Human Generative Art",
      "BHGA"
    ]);
    
    deployedContracts.art = artContract.address;
    log(`✅ BarelyHumanArt deployed to: ${artContract.address}`, COLOR.GREEN);
    
    // Step 3: Deploy ArtRedemptionService
    log('\n🔄 Step 3: Deploying ArtRedemptionService...', COLOR.YELLOW);
    
    const redemptionContract = await viem.deployContract("ArtRedemptionService", [
      mintPassContract.address,
      artContract.address
    ]);
    
    deployedContracts.redemption = redemptionContract.address;
    log(`✅ ArtRedemptionService deployed to: ${redemptionContract.address}`, COLOR.GREEN);
    
    // Step 4: Configure permissions
    log('\n🔐 Step 4: Configuring permissions...', COLOR.YELLOW);
    
    // Grant MINTER_ROLE to redemption service on art contract
    const MINTER_ROLE = await publicClient.readContract({
      address: artContract.address,
      abi: artContract.abi,
      functionName: 'MINTER_ROLE',
    });
    
    await walletClients[0].writeContract({
      address: artContract.address,
      abi: artContract.abi,
      functionName: 'grantRole',
      args: [MINTER_ROLE, redemptionContract.address],
    });
    
    // Grant GENERATOR_ROLE to deployer (for testing)
    const GENERATOR_ROLE = await publicClient.readContract({
      address: redemptionContract.address,
      abi: redemptionContract.abi,
      functionName: 'GENERATOR_ROLE',
    });
    
    await walletClients[0].writeContract({
      address: redemptionContract.address,
      abi: redemptionContract.abi,
      functionName: 'grantRole',
      args: [GENERATOR_ROLE, deployer.account.address],
    });
    
    log('✅ Permissions configured', COLOR.GREEN);
    
    // Step 5: Test the system with a sample mint pass
    log('\n🧪 Step 5: Testing with sample mint pass...', COLOR.YELLOW);
    
    // Admin mint a test pass
    const testMintTx = await walletClients[0].writeContract({
      address: mintPassContract.address,
      abi: mintPassContract.abi,
      functionName: 'adminMint',
      args: [deployer.account.address, 2, 0], // Epic rarity, Alice bot
    });
    
    const testMintReceipt = await publicClient.waitForTransactionReceipt({
      hash: testMintTx,
    });
    
    log(`✅ Test mint pass created. Transaction: ${testMintTx}`, COLOR.GREEN);
    
    // Request redemption
    const requestTx = await walletClients[0].writeContract({
      address: redemptionContract.address,
      abi: redemptionContract.abi,
      functionName: 'requestRedemption',
      args: [1], // Token ID 1
    });
    
    await publicClient.waitForTransactionReceipt({ hash: requestTx });
    log(`✅ Redemption requested. Transaction: ${requestTx}`, COLOR.GREEN);
    
    // Step 6: Save deployment info
    log('\n💾 Step 6: Saving deployment information...', COLOR.YELLOW);
    
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      network: await publicClient.getChainId(),
      deployer: deployer.account.address,
      contracts: deployedContracts,
      configuration: {
        vrfCoordinator,
        subscriptionId,
        keyHash,
        baseURI
      },
      transactions: {
        mintPass: mintPassContract.transactionHash,
        art: artContract.transactionHash,
        redemption: redemptionContract.transactionHash,
        testMint: testMintTx,
        testRequest: requestTx
      }
    };
    
    const deploymentPath = path.join(process.cwd(), 'nft-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    log(`✅ Deployment info saved to: ${deploymentPath}`, COLOR.GREEN);
    
    // Step 7: Generate service configuration
    log('\n⚙️  Step 7: Generating service configuration...', COLOR.YELLOW);
    
    const serviceConfig = {
      rpcUrl: 'http://127.0.0.1:8545',
      privateKey: 'YOUR_PRIVATE_KEY_HERE',
      contracts: {
        redemptionService: deployedContracts.redemption,
        mintPass: deployedContracts.mintPass,
        art: deployedContracts.art
      },
      metadata: {
        baseUrl: 'https://api.barelyhuman.xyz',
        frontendUrl: 'https://barelyhuman.xyz',
        feeRecipient: deployer.account.address
      }
    };
    
    const configPath = path.join(process.cwd(), 'art', 'service-config.json');
    fs.writeFileSync(configPath, JSON.stringify(serviceConfig, null, 2));
    log(`✅ Service config saved to: ${configPath}`, COLOR.GREEN);
    
    // Close connection
    await connection.close();
    
    // Step 8: Summary
    log('\n🎉 NFT System Deployment Complete!', COLOR.CYAN);
    log('\n📋 Deployed Contracts:', COLOR.BLUE);
    log(`   🎫 Mint Pass: ${deployedContracts.mintPass}`, COLOR.BLUE);
    log(`   🎨 Art NFT: ${deployedContracts.art}`, COLOR.BLUE);
    log(`   🔄 Redemption: ${deployedContracts.redemption}`, COLOR.BLUE);
    
    log('\n🚀 Next Steps:', COLOR.YELLOW);
    log('   1. Configure Chainlink VRF subscription for production', COLOR.YELLOW);
    log('   2. Start the NFT generation service:', COLOR.YELLOW);
    log('      node art/nft-generation-service.js', COLOR.YELLOW);
    log('   3. Start the OpenSea metadata server:', COLOR.YELLOW);
    log('      node art/opensea-metadata-server.js', COLOR.YELLOW);
    log('   4. Update service-config.json with your private key', COLOR.YELLOW);
    log('   5. Deploy to OpenSea testnet for testing', COLOR.YELLOW);
    
    log('\n📊 Test Commands:', COLOR.MAGENTA);
    log(`   npx hardhat run scripts/test-nft-redemption.js`, COLOR.MAGENTA);
    log(`   curl http://localhost:3001/mintpass/1`, COLOR.MAGENTA);
    log(`   curl http://localhost:3001/collection`, COLOR.MAGENTA);
    
    return deployedContracts;
    
  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, COLOR.RED);
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Deployment interrupted', COLOR.YELLOW);
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  deployNFTSystem().catch(console.error);
}

module.exports = { deployNFTSystem };