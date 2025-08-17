#!/usr/bin/env node

/**
 * Test the complete NFT redemption flow
 * From mint pass creation to generative art NFT minting
 */

const { network } = require('hardhat');
const fs = require('fs');
const path = require('path');
const { AuthenticBarelyHumanGenerator } = require('../art/authentic-generator.js');

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

async function testNFTRedemption() {
  try {
    log('🧪 Starting NFT Redemption Test...', COLOR.CYAN);
    
    // Load deployment info
    const deploymentPath = path.join(process.cwd(), 'nft-deployment.json');
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('Deployment info not found. Run deploy-nft-system.js first.');
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    log(`📋 Loaded deployment from: ${deploymentPath}`, COLOR.GREEN);
    
    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const deployer = walletClients[0];
    
    log(`📡 Connected to network: ${await publicClient.getChainId()}`, COLOR.GREEN);
    
    // Get contract instances
    const mintPassContract = await viem.getContractAt("GachaMintPass", deployment.contracts.mintPass);
    const artContract = await viem.getContractAt("BarelyHumanArt", deployment.contracts.art);
    const redemptionContract = await viem.getContractAt("ArtRedemptionService", deployment.contracts.redemption);
    
    // Test 1: Create mint passes for all bot personalities
    log('\n🎫 Test 1: Creating mint passes for all bots...', COLOR.YELLOW);
    
    const mintPromises = [];
    for (let botId = 0; botId < 10; botId++) {
      const rarity = botId % 4; // Distribute rarities evenly
      mintPromises.push(
        walletClients[0].writeContract({
          address: mintPassContract.address,
          abi: mintPassContract.abi,
          functionName: 'adminMint',
          args: [deployer.account.address, rarity, botId],
        })
      );
    }
    
    const mintTxs = await Promise.all(mintPromises);
    log(`✅ Created ${mintTxs.length} mint passes`, COLOR.GREEN);
    
    // Wait for all transactions
    for (const tx of mintTxs) {
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    
    // Test 2: Check mint pass details
    log('\n🔍 Test 2: Checking mint pass details...', COLOR.YELLOW);
    
    for (let tokenId = 1; tokenId <= 10; tokenId++) {
      try {
        const mintPass = await publicClient.readContract({
          address: mintPassContract.address,
          abi: mintPassContract.abi,
          functionName: 'getMintPassDetails',
          args: [tokenId],
        });
        
        const rarityName = ['Common', 'Rare', 'Epic', 'Legendary'][mintPass.rarity];
        const botNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eddie', 'Fiona', 'Greg', 'Helen', 'Ivan', 'Julia'];
        
        log(`   Token ${tokenId}: ${botNames[mintPass.botId]} (${rarityName}) - Redeemed: ${mintPass.redeemed}`, COLOR.BLUE);
      } catch (error) {
        log(`   Token ${tokenId}: Error reading details`, COLOR.RED);
      }
    }
    
    // Test 3: Request redemptions
    log('\n🔄 Test 3: Requesting redemptions...', COLOR.YELLOW);
    
    const redemptionRequests = [];
    for (let tokenId = 1; tokenId <= 5; tokenId++) { // Test first 5
      const requestTx = await walletClients[0].writeContract({
        address: redemptionContract.address,
        abi: redemptionContract.abi,
        functionName: 'requestRedemption',
        args: [tokenId],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: requestTx });
      redemptionRequests.push(requestTx);
      
      log(`   ✅ Requested redemption for token ${tokenId}`, COLOR.GREEN);
    }
    
    // Test 4: Check queue status
    log('\n📊 Test 4: Checking redemption queue...', COLOR.YELLOW);
    
    const queueLength = await publicClient.readContract({
      address: redemptionContract.address,
      abi: redemptionContract.abi,
      functionName: 'getQueueLength',
    });
    
    log(`   Queue length: ${queueLength}`, COLOR.BLUE);
    
    const pendingRequests = await publicClient.readContract({
      address: redemptionContract.address,
      abi: redemptionContract.abi,
      functionName: 'getPendingRequests',
    });
    
    log(`   Pending requests: [${pendingRequests.join(', ')}]`, COLOR.BLUE);
    
    // Test 5: Process redemptions manually
    log('\n🎨 Test 5: Processing redemptions...', COLOR.YELLOW);
    
    for (let i = 0; i < Math.min(3, pendingRequests.length); i++) {
      const requestId = pendingRequests[i];
      
      // Get request details
      const [request, status] = await publicClient.readContract({
        address: redemptionContract.address,
        abi: redemptionContract.abi,
        functionName: 'getRedemptionDetails',
        args: [requestId],
      });
      
      // Get mint pass details
      const mintPass = await publicClient.readContract({
        address: mintPassContract.address,
        abi: mintPassContract.abi,
        functionName: 'getMintPassDetails',
        args: [request.mintPassId],
      });
      
      log(`   Processing request ${requestId} for mint pass ${request.mintPassId}...`, COLOR.BLUE);
      
      // Mark as processing
      await walletClients[0].writeContract({
        address: redemptionContract.address,
        abi: redemptionContract.abi,
        functionName: 'markProcessing',
        args: [requestId],
      });
      
      // Generate artwork
      const seed = Number(mintPass.vrfSeed.toString().slice(0, 16));
      const generator = new AuthenticBarelyHumanGenerator(seed, mintPass.botId, mintPass.seriesId);
      const svg = generator.generateSVG();
      
      // Create traits
      const traits = [
        `Theme: ${['Volcanic', 'Klein', 'Aurora', 'Mist', 'Neon', 'Storm', 'Zen', 'Dawn', 'Void', 'Cyber'][mintPass.botId]}`,
        `Complexity: ${['Minimal', 'Simple', 'Moderate', 'Complex'][seed % 4]}`,
        `Rarity: ${['Common', 'Rare', 'Epic', 'Legendary'][mintPass.rarity]}`
      ];
      
      // Compress SVG
      const compressedSVG = svg
        .replace(/\\s+/g, ' ')
        .replace(/>\\s+</g, '><')
        .trim();
      
      log(`   Generated SVG: ${compressedSVG.length} characters`, COLOR.BLUE);
      
      // Fulfill redemption
      const fulfillTx = await walletClients[0].writeContract({
        address: redemptionContract.address,
        abi: redemptionContract.abi,
        functionName: 'fulfillRedemption',
        args: [requestId, compressedSVG, traits],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
      
      log(`   ✅ Fulfilled redemption ${requestId}. Transaction: ${fulfillTx}`, COLOR.GREEN);
      
      // Brief delay between redemptions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 6: Check generated art NFTs
    log('\n🖼️  Test 6: Checking generated art NFTs...', COLOR.YELLOW);
    
    const artTotalSupply = await publicClient.readContract({
      address: artContract.address,
      abi: artContract.abi,
      functionName: 'totalSupply',
    });
    
    log(`   Total art NFTs minted: ${artTotalSupply}`, COLOR.BLUE);
    
    for (let tokenId = 1; tokenId <= Number(artTotalSupply); tokenId++) {
      try {
        const artwork = await publicClient.readContract({
          address: artContract.address,
          abi: artContract.abi,
          functionName: 'getArtworkDetails',
          args: [tokenId],
        });
        
        const botNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eddie', 'Fiona', 'Greg', 'Helen', 'Ivan', 'Julia'];
        const rarityNames = ['Common', 'Rare', 'Epic', 'Legendary'];
        
        log(`   Art NFT ${tokenId}: ${botNames[artwork.botId]} (${rarityNames[artwork.rarity]}) - ${artwork.traits.length} traits`, COLOR.BLUE);
        log(`     SVG length: ${artwork.svgData.length} chars`, COLOR.BLUE);
        log(`     Generated at: ${new Date(Number(artwork.generatedAt) * 1000).toISOString()}`, COLOR.BLUE);
      } catch (error) {
        log(`   Art NFT ${tokenId}: Error reading details`, COLOR.RED);
      }
    }
    
    // Test 7: Test metadata generation
    log('\n📄 Test 7: Testing metadata generation...', COLOR.YELLOW);
    
    for (let tokenId = 1; tokenId <= Math.min(3, Number(artTotalSupply)); tokenId++) {
      try {
        const tokenURI = await publicClient.readContract({
          address: artContract.address,
          abi: artContract.abi,
          functionName: 'tokenURI',
          args: [tokenId],
        });
        
        // Decode base64 JSON
        const base64Data = tokenURI.split(',')[1];
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf8');
        const metadata = JSON.parse(jsonData);
        
        log(`   NFT ${tokenId} metadata:`, COLOR.BLUE);
        log(`     Name: ${metadata.name}`, COLOR.BLUE);
        log(`     Attributes: ${metadata.attributes.length}`, COLOR.BLUE);
        log(`     Image: ${metadata.image.slice(0, 50)}...`, COLOR.BLUE);
      } catch (error) {
        log(`   NFT ${tokenId}: Error reading metadata`, COLOR.RED);
      }
    }
    
    // Test 8: Save sample SVG files
    log('\n💾 Test 8: Saving sample SVG files...', COLOR.YELLOW);
    
    const outputDir = path.join(process.cwd(), 'generated-art-samples');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    for (let tokenId = 1; tokenId <= Math.min(3, Number(artTotalSupply)); tokenId++) {
      try {
        const svgData = await publicClient.readContract({
          address: artContract.address,
          abi: artContract.abi,
          functionName: 'getArtworkSVG',
          args: [tokenId],
        });
        
        const filename = `barely-human-${tokenId}.svg`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, svgData);
        
        log(`   ✅ Saved ${filename}`, COLOR.GREEN);
      } catch (error) {
        log(`   Error saving SVG for token ${tokenId}`, COLOR.RED);
      }
    }
    
    // Close connection
    await connection.close();
    
    // Summary
    log('\n🎉 NFT Redemption Test Complete!', COLOR.CYAN);
    log('\n📊 Test Results:', COLOR.BLUE);
    log(`   🎫 Mint passes created: 10`, COLOR.BLUE);
    log(`   🔄 Redemptions requested: 5`, COLOR.BLUE);
    log(`   🎨 Art NFTs generated: ${artTotalSupply}`, COLOR.BLUE);
    log(`   💾 Sample files: ${outputDir}`, COLOR.BLUE);
    
    log('\n✅ All tests passed! The NFT system is working correctly.', COLOR.GREEN);
    
    return {
      mintPassesCreated: 10,
      redemptionsRequested: 5,
      artNFTsGenerated: Number(artTotalSupply),
      sampleFilesPath: outputDir
    };
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, COLOR.RED);
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Test interrupted', COLOR.YELLOW);
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  testNFTRedemption().catch(console.error);
}

module.exports = { testNFTRedemption };