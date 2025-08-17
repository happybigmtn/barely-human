/**
 * Barely Human Art Generation Service
 * Server-side art generation and on-chain integration
 */

const { BarelyHumanArtGenerator, ArtGeneratorUtils } = require('./deterministic-generator.js');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

class ArtGenerationService {
  constructor(config) {
    this.config = {
      rpcUrl: config.rpcUrl || 'http://localhost:8545',
      privateKey: config.privateKey,
      contractAddress: config.contractAddress,
      outputDir: config.outputDir || './generated-art',
      maxBatchSize: config.maxBatchSize || 10,
      compressionLevel: config.compressionLevel || 'medium', // low, medium, high
      ...config
    };
    
    this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    
    // Contract ABI (minimal for minting)
    this.contractABI = [
      "function mintGenerativeArt(address to, uint256 seed, uint8 botId, uint256 seriesId, string calldata traits, uint8 rarityScore, string calldata svgData) external",
      "function batchMintGenerativeArt(address[] calldata recipients, uint256[] calldata seeds, uint8[] calldata botIds, uint256[] calldata seriesIds, string[] calldata traitsArray, uint8[] calldata rarityScores, string[] calldata svgDataArray) external",
      "function totalSupply() external view returns (uint256)",
      "function getTokenInfo(uint256 tokenId) external view returns (tuple(uint256 seed, uint8 botId, uint256 seriesId, string traits, uint256 timestamp, uint8 rarityScore) metadata, string svg, address owner)"
    ];
    
    this.contract = new ethers.Contract(this.config.contractAddress, this.contractABI, this.wallet);
    
    // Statistics tracking
    this.stats = {
      generated: 0,
      minted: 0,
      errors: 0,
      totalGasUsed: ethers.BigNumber.from(0),
      rarityDistribution: {}
    };
  }

  /**
   * Generate art from VRF seed and mint NFT
   */
  async generateAndMint(vrfSeed, botId, seriesId, recipient) {
    try {
      console.log(`Generating art for bot ${botId}, series ${seriesId}...`);
      
      // Generate art
      const artwork = ArtGeneratorUtils.generateFromVRF(vrfSeed, botId, seriesId);
      
      // Compress SVG if needed
      const compressedSVG = this.compressSVG(artwork.svg);
      
      // Calculate rarity score
      const rarityScore = ArtGeneratorUtils.calculateRarityScore(artwork.traits);
      
      // Prepare traits JSON
      const traitsJSON = JSON.stringify(artwork.metadata.attributes);
      
      // Save to file system
      await this.saveArtwork(artwork, vrfSeed, botId, seriesId);
      
      // Mint NFT
      const tx = await this.contract.mintGenerativeArt(
        recipient,
        vrfSeed,
        botId,
        seriesId,
        traitsJSON,
        rarityScore,
        compressedSVG,
        {
          gasLimit: 500000 // Generous gas limit for SVG storage
        }
      );
      
      const receipt = await tx.wait();
      
      // Update statistics
      this.updateStats(rarityScore, receipt.gasUsed);
      
      console.log(`Art generated and minted! Token ID: ${await this.contract.totalSupply() - 1}`);
      console.log(`Transaction: ${receipt.transactionHash}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`Rarity score: ${rarityScore}`);
      
      return {
        success: true,
        tokenId: (await this.contract.totalSupply()).sub(1),
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        rarityScore: rarityScore,
        artwork: artwork
      };
      
    } catch (error) {
      this.stats.errors++;
      console.error('Art generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch generate and mint multiple NFTs
   */
  async batchGenerateAndMint(vrfSeeds, botIds, seriesIds, recipients) {
    try {
      if (vrfSeeds.length > this.config.maxBatchSize) {
        throw new Error(`Batch size ${vrfSeeds.length} exceeds maximum ${this.config.maxBatchSize}`);
      }
      
      console.log(`Batch generating ${vrfSeeds.length} artworks...`);
      
      const artworks = [];
      const compressedSVGs = [];
      const traitsJSONs = [];
      const rarityScores = [];
      
      // Generate all artworks
      for (let i = 0; i < vrfSeeds.length; i++) {
        const artwork = ArtGeneratorUtils.generateFromVRF(vrfSeeds[i], botIds[i], seriesIds[i]);
        const compressedSVG = this.compressSVG(artwork.svg);
        const rarityScore = ArtGeneratorUtils.calculateRarityScore(artwork.traits);
        const traitsJSON = JSON.stringify(artwork.metadata.attributes);
        
        artworks.push(artwork);
        compressedSVGs.push(compressedSVG);
        traitsJSONs.push(traitsJSON);
        rarityScores.push(rarityScore);
        
        // Save to file system
        await this.saveArtwork(artwork, vrfSeeds[i], botIds[i], seriesIds[i]);
      }
      
      // Batch mint
      const tx = await this.contract.batchMintGenerativeArt(
        recipients,
        vrfSeeds,
        botIds,
        seriesIds,
        traitsJSONs,
        rarityScores,
        compressedSVGs,
        {
          gasLimit: 500000 * vrfSeeds.length // Scale gas limit
        }
      );
      
      const receipt = await tx.wait();
      
      // Update statistics
      for (const score of rarityScores) {
        this.updateStats(score, receipt.gasUsed.div(vrfSeeds.length));
      }
      
      console.log(`Batch mint completed! Transaction: ${receipt.transactionHash}`);
      console.log(`Total gas used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        count: vrfSeeds.length,
        artworks: artworks
      };
      
    } catch (error) {
      this.stats.errors++;
      console.error('Batch generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Compress SVG based on configuration level
   */
  compressSVG(svg) {
    let compressed = svg;
    
    switch (this.config.compressionLevel) {
      case 'low':
        // Minimal compression - just remove extra whitespace
        compressed = svg.replace(/\s+/g, ' ').trim();
        break;
        
      case 'medium':
        // Standard compression
        compressed = svg
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .replace(/\s*=\s*/g, '=')
          .replace(/;\s*/g, ';')
          .trim();
        break;
        
      case 'high':
        // Aggressive compression
        compressed = svg
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .replace(/\s*=\s*/g, '=')
          .replace(/;\s*/g, ';')
          .replace(/"/g, "'") // Use single quotes
          .replace(/\s*,\s*/g, ',')
          .replace(/\s*:\s*/g, ':')
          .trim();
        break;
    }
    
    console.log(`SVG compressed: ${svg.length} -> ${compressed.length} bytes (${Math.round((1 - compressed.length/svg.length) * 100)}% reduction)`);
    
    return compressed;
  }

  /**
   * Save artwork to file system for backup/analysis
   */
  async saveArtwork(artwork, seed, botId, seriesId) {
    try {
      // Create output directory structure
      const botDir = path.join(this.config.outputDir, `bot-${botId}`);
      const seriesDir = path.join(botDir, `series-${seriesId}`);
      
      await fs.mkdir(seriesDir, { recursive: true });
      
      // Save SVG
      const svgPath = path.join(seriesDir, `artwork-${seed}.svg`);
      await fs.writeFile(svgPath, artwork.svg);
      
      // Save metadata
      const metadataPath = path.join(seriesDir, `metadata-${seed}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(artwork.metadata, null, 2));
      
      // Save summary info
      const infoPath = path.join(seriesDir, `info-${seed}.json`);
      const info = {
        seed: seed,
        botId: botId,
        seriesId: seriesId,
        rarityScore: ArtGeneratorUtils.calculateRarityScore(artwork.traits),
        traits: artwork.traits,
        timestamp: new Date().toISOString(),
        fileSize: {
          svg: artwork.svg.length,
          compressed: this.compressSVG(artwork.svg).length
        }
      };
      await fs.writeFile(infoPath, JSON.stringify(info, null, 2));
      
    } catch (error) {
      console.warn('Failed to save artwork to filesystem:', error.message);
    }
  }

  /**
   * Update internal statistics
   */
  updateStats(rarityScore, gasUsed) {
    this.stats.generated++;
    this.stats.minted++;
    this.stats.totalGasUsed = this.stats.totalGasUsed.add(gasUsed);
    
    // Rarity distribution
    const bucket = Math.floor(rarityScore / 10) * 10;
    this.stats.rarityDistribution[bucket] = (this.stats.rarityDistribution[bucket] || 0) + 1;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalGasUsed: this.stats.totalGasUsed.toString(),
      averageGasPerMint: this.stats.minted > 0 ? this.stats.totalGasUsed.div(this.stats.minted).toString() : '0',
      averageRarity: this.calculateAverageRarity()
    };
  }

  /**
   * Calculate average rarity score
   */
  calculateAverageRarity() {
    let total = 0;
    let count = 0;
    
    for (const [bucket, freq] of Object.entries(this.stats.rarityDistribution)) {
      total += parseInt(bucket) * freq;
      count += freq;
    }
    
    return count > 0 ? Math.round(total / count) : 0;
  }

  /**
   * Generate preview without minting
   */
  async generatePreview(seed, botId, seriesId, size = 400) {
    try {
      const artwork = ArtGeneratorUtils.generateFromVRF(seed, botId, seriesId);
      const preview = ArtGeneratorUtils.generatePreview(seed, botId, seriesId, size);
      
      return {
        success: true,
        svg: preview,
        metadata: artwork.metadata,
        traits: artwork.traits,
        rarityScore: ArtGeneratorUtils.calculateRarityScore(artwork.traits)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate VRF seed format
   */
  validateVRFSeed(vrfSeed) {
    if (typeof vrfSeed === 'string') {
      // Convert hex string to number
      if (vrfSeed.startsWith('0x')) {
        return parseInt(vrfSeed.slice(2, 18), 16);
      }
      return parseInt(vrfSeed);
    }
    return vrfSeed;
  }

  /**
   * Get on-chain token information
   */
  async getTokenInfo(tokenId) {
    try {
      const info = await this.contract.getTokenInfo(tokenId);
      return {
        success: true,
        metadata: {
          seed: info.metadata.seed.toString(),
          botId: info.metadata.botId,
          seriesId: info.metadata.seriesId.toString(),
          traits: info.metadata.traits,
          timestamp: info.metadata.timestamp.toString(),
          rarityScore: info.metadata.rarityScore
        },
        svg: info.svg,
        owner: info.owner
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Re-generate artwork from on-chain data (for verification)
   */
  async regenerateFromChain(tokenId) {
    try {
      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo.success) {
        return tokenInfo;
      }
      
      const { metadata } = tokenInfo;
      const seed = this.validateVRFSeed(metadata.seed);
      
      // Regenerate artwork
      const artwork = ArtGeneratorUtils.generateFromVRF(seed, metadata.botId, parseInt(metadata.seriesId));
      
      // Compare with on-chain version
      const onChainSVG = tokenInfo.svg;
      const regeneratedSVG = this.compressSVG(artwork.svg);
      
      const matches = onChainSVG === regeneratedSVG;
      
      return {
        success: true,
        matches: matches,
        onChainSVG: onChainSVG,
        regeneratedSVG: regeneratedSVG,
        metadata: metadata,
        artwork: artwork
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const totalSupply = await this.contract.totalSupply();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.wallet.getBalance();
      
      return {
        status: 'healthy',
        totalSupply: totalSupply.toString(),
        blockNumber: blockNumber,
        walletBalance: ethers.utils.formatEther(balance),
        contractAddress: this.config.contractAddress,
        stats: this.getStats()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

/**
 * Express.js API endpoints for art generation service
 */
function createArtAPI(artService) {
  const express = require('express');
  const router = express.Router();

  // Generate and mint single NFT
  router.post('/generate', async (req, res) => {
    try {
      const { vrfSeed, botId, seriesId, recipient } = req.body;
      
      if (!vrfSeed || botId === undefined || !seriesId || !recipient) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await artService.generateAndMint(vrfSeed, botId, seriesId, recipient);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Batch generate and mint
  router.post('/batch-generate', async (req, res) => {
    try {
      const { vrfSeeds, botIds, seriesIds, recipients } = req.body;
      
      if (!vrfSeeds || !botIds || !seriesIds || !recipients) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await artService.batchGenerateAndMint(vrfSeeds, botIds, seriesIds, recipients);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate preview without minting
  router.post('/preview', async (req, res) => {
    try {
      const { seed, botId, seriesId, size } = req.body;
      
      if (!seed || botId === undefined || !seriesId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await artService.generatePreview(seed, botId, seriesId, size);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get token information
  router.get('/token/:tokenId', async (req, res) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      const result = await artService.getTokenInfo(tokenId);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate and verify
  router.post('/verify/:tokenId', async (req, res) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      const result = await artService.regenerateFromChain(tokenId);
      res.json(result);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Service statistics
  router.get('/stats', (req, res) => {
    res.json(artService.getStats());
  });

  // Health check
  router.get('/health', async (req, res) => {
    const health = await artService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  return router;
}

module.exports = {
  ArtGenerationService,
  createArtAPI
};