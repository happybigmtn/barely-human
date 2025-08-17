/**
 * Barely Human NFT Generation Service
 * Integrates authentic art generator with smart contracts for mint pass redemption
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

// Import the authentic generator
const { AuthenticBarelyHumanGenerator } = require('./authentic-generator.js');

class NFTGenerationService {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        
        // Contract instances will be set in initialize()
        this.redemptionService = null;
        this.mintPassContract = null;
        this.artContract = null;
        
        // Generation queue
        this.processingQueue = new Map();
        this.isProcessing = false;
        
        // Bot personality themes mapping
        this.botThemes = {
            0: 'volcanic',    // Alice All-In
            1: 'klein',       // Bob Calculator  
            2: 'aurora',      // Charlie Lucky
            3: 'mist',        // Diana Ice Queen
            4: 'neon',        // Eddie Entertainer
            5: 'storm',       // Fiona Fearless
            6: 'zen',         // Greg Grinder
            7: 'dawn',        // Helen Hot Streak
            8: 'void',        // Ivan Intimidator
            9: 'cyber'        // Julia Jinx
        };
    }
    
    /**
     * Initialize the service with contract instances
     */
    async initialize() {
        try {
            // Load contract ABIs
            const redemptionABI = await this.loadABI('ArtRedemptionService');
            const mintPassABI = await this.loadABI('GachaMintPass');
            const artABI = await this.loadABI('BarelyHumanArt');
            
            // Initialize contracts
            this.redemptionService = new ethers.Contract(
                this.config.contracts.redemptionService,
                redemptionABI,
                this.wallet
            );
            
            this.mintPassContract = new ethers.Contract(
                this.config.contracts.mintPass,
                mintPassABI,
                this.provider
            );
            
            this.artContract = new ethers.Contract(
                this.config.contracts.art,
                artABI,
                this.wallet
            );
            
            console.log('NFT Generation Service initialized successfully');
            
            // Start processing loop
            this.startProcessingLoop();
            
        } catch (error) {
            console.error('Failed to initialize NFT Generation Service:', error);
            throw error;
        }
    }
    
    /**
     * Load contract ABI from artifacts
     */
    async loadABI(contractName) {
        try {
            const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
            const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
            return artifact.abi;
        } catch (error) {
            console.error(`Failed to load ABI for ${contractName}:`, error);
            throw error;
        }
    }
    
    /**
     * Start the processing loop to handle redemption requests
     */
    startProcessingLoop() {
        console.log('Starting NFT generation processing loop...');
        
        // Check for new requests every 30 seconds
        setInterval(async () => {
            if (!this.isProcessing) {
                await this.processNextRequest();
            }
        }, 30000);
        
        // Also process immediately
        setTimeout(() => this.processNextRequest(), 1000);
    }
    
    /**
     * Process the next pending redemption request
     */
    async processNextRequest() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            // Get next pending request
            const nextRequestId = await this.redemptionService.getNextPendingRequest();
            
            if (nextRequestId.toString() === '0') {
                // No pending requests
                this.isProcessing = false;
                return;
            }
            
            console.log(`Processing redemption request ${nextRequestId}...`);
            
            // Mark as processing
            await this.redemptionService.markProcessing(nextRequestId);
            
            // Get request details
            const [request, status] = await this.redemptionService.getRedemptionDetails(nextRequestId);
            
            // Get mint pass details
            const mintPass = await this.mintPassContract.getMintPassDetails(request.mintPassId);
            
            console.log(`Generating art for bot ${mintPass.botId}, rarity ${mintPass.rarity}, VRF seed ${mintPass.vrfSeed}`);
            
            // Generate the artwork
            const artworkResult = await this.generateArtwork(
                mintPass.vrfSeed,
                mintPass.botId,
                mintPass.seriesId,
                mintPass.rarity
            );
            
            if (!artworkResult.success) {
                console.error(`Art generation failed for request ${nextRequestId}:`, artworkResult.error);
                await this.redemptionService.markFailed(nextRequestId, artworkResult.error);
                return;
            }
            
            console.log(`Art generated successfully for request ${nextRequestId}`);
            
            // Submit the generated art
            const tx = await this.redemptionService.fulfillRedemption(
                nextRequestId,
                artworkResult.svg,
                artworkResult.traits
            );
            
            console.log(`Redemption fulfilled! Transaction: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
            
        } catch (error) {
            console.error('Error processing redemption request:', error);
            
            // Try to mark as failed if we have the request ID
            try {
                const nextRequestId = await this.redemptionService.getNextPendingRequest();
                if (nextRequestId.toString() !== '0') {
                    await this.redemptionService.markFailed(nextRequestId, error.message);
                }
            } catch (markError) {
                console.error('Failed to mark request as failed:', markError);
            }
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Generate artwork using the authentic generator
     */
    async generateArtwork(vrfSeed, botId, seriesId, rarity) {
        try {
            console.log(`Generating artwork: seed=${vrfSeed}, bot=${botId}, series=${seriesId}, rarity=${rarity}`);
            
            // Convert BigInt seed to regular number for the generator
            const seed = Number(vrfSeed.toString().slice(0, 16));
            
            // Create the authentic art generator
            const generator = new AuthenticBarelyHumanGenerator(seed, botId, seriesId);
            
            // Generate the SVG
            const svg = generator.generateSVG();
            
            if (!svg || svg.length === 0) {
                throw new Error('Generated SVG is empty');
            }
            
            // Extract traits from the generation process
            const traits = this.extractTraits(generator, botId, rarity);
            
            // Compress SVG for storage (remove unnecessary whitespace)
            const compressedSVG = this.compressSVG(svg);
            
            console.log(`Generated SVG: ${compressedSVG.length} characters`);
            console.log(`Traits: ${traits.join(', ')}`);
            
            return {
                success: true,
                svg: compressedSVG,
                traits: traits,
                metadata: {
                    botId: botId,
                    seriesId: seriesId,
                    rarity: rarity,
                    theme: this.botThemes[botId] || 'unknown'
                }
            };
            
        } catch (error) {
            console.error('Art generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Extract traits from the generated artwork
     */
    extractTraits(generator, botId, rarity) {
        const traits = [];
        
        // Add theme-based traits
        const theme = this.botThemes[botId];
        if (theme) {
            traits.push(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
        }
        
        // Add rarity-based traits
        const rarityNames = ['Common', 'Rare', 'Epic', 'Legendary'];
        traits.push(`Rarity: ${rarityNames[rarity] || 'Unknown'}`);
        
        // Add complexity-based traits (based on crack count)
        const complexity = this.analyzeComplexity(generator);
        traits.push(`Complexity: ${complexity}`);
        
        // Add color palette traits
        const palette = this.analyzeColorPalette(theme);
        traits.push(`Palette: ${palette}`);
        
        // Add formation-based traits
        const formation = this.analyzeFormation(generator);
        if (formation) {
            traits.push(`Formation: ${formation}`);
        }
        
        return traits;
    }
    
    /**
     * Analyze artwork complexity
     */
    analyzeComplexity(generator) {
        // This is a simplified analysis - in a full implementation,
        // you'd analyze the actual crack data from the generator
        const seed = generator.seed;
        const complexityScore = (seed % 100);
        
        if (complexityScore < 25) return 'Minimal';
        if (complexityScore < 50) return 'Simple';
        if (complexityScore < 75) return 'Moderate';
        return 'Complex';
    }
    
    /**
     * Analyze color palette for the theme
     */
    analyzeColorPalette(theme) {
        const palettes = {
            'volcanic': 'Fire',
            'klein': 'Blue Monochrome',
            'aurora': 'Ethereal',
            'mist': 'Soft Gray',
            'neon': 'Electric',
            'storm': 'Dynamic',
            'zen': 'Earth Tones',
            'dawn': 'Warm',
            'void': 'Dark',
            'cyber': 'Digital'
        };
        
        return palettes[theme] || 'Mixed';
    }
    
    /**
     * Analyze formation patterns
     */
    analyzeFormation(generator) {
        // Simplified formation analysis based on seed
        const formations = [
            'Organic Growth',
            'Crystalline',
            'Branching',
            'Spiral',
            'Lightning',
            'Circuit',
            'Zen Wave',
            'Kaleidoscope'
        ];
        
        const index = generator.seed % formations.length;
        return formations[index];
    }
    
    /**
     * Compress SVG by removing unnecessary whitespace and optimizing
     */
    compressSVG(svg) {
        return svg
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/>\s+</g, '><')        // Remove spaces between tags
            .replace(/\s+>/g, '>')          // Remove spaces before tag closings
            .replace(/\s+\/>/g, '/>')       // Remove spaces before self-closing tags
            .trim();                        // Remove leading/trailing whitespace
    }
    
    /**
     * Get current queue status
     */
    async getQueueStatus() {
        try {
            const queueLength = await this.redemptionService.getQueueLength();
            const isQueueFull = await this.redemptionService.isQueueFull();
            const pendingRequests = await this.redemptionService.getPendingRequests();
            
            return {
                queueLength: Number(queueLength),
                isQueueFull,
                pendingRequests: pendingRequests.map(id => Number(id)),
                isProcessing: this.isProcessing
            };
        } catch (error) {
            console.error('Error getting queue status:', error);
            return null;
        }
    }
    
    /**
     * Manually process a specific request (admin function)
     */
    async processSpecificRequest(requestId) {
        if (this.isProcessing) {
            throw new Error('Service is currently processing another request');
        }
        
        console.log(`Manually processing request ${requestId}...`);
        
        // Temporarily set the processing flag
        this.isProcessing = true;
        
        try {
            // Get request details
            const [request, status] = await this.redemptionService.getRedemptionDetails(requestId);
            
            if (request.requester === ethers.ZeroAddress) {
                throw new Error('Request not found');
            }
            
            if (request.fulfilled) {
                throw new Error('Request already fulfilled');
            }
            
            // Mark as processing
            await this.redemptionService.markProcessing(requestId);
            
            // Get mint pass details
            const mintPass = await this.mintPassContract.getMintPassDetails(request.mintPassId);
            
            // Generate the artwork
            const artworkResult = await this.generateArtwork(
                mintPass.vrfSeed,
                mintPass.botId,
                mintPass.seriesId,
                mintPass.rarity
            );
            
            if (!artworkResult.success) {
                await this.redemptionService.markFailed(requestId, artworkResult.error);
                throw new Error(`Art generation failed: ${artworkResult.error}`);
            }
            
            // Submit the generated art
            const tx = await this.redemptionService.fulfillRedemption(
                requestId,
                artworkResult.svg,
                artworkResult.traits
            );
            
            const receipt = await tx.wait();
            
            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                artworkData: artworkResult
            };
            
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Health check for the service
     */
    async healthCheck() {
        try {
            // Check contract connections
            const redemptionAddress = await this.redemptionService.getAddress();
            const mintPassAddress = await this.mintPassContract.getAddress();
            const artAddress = await this.artContract.getAddress();
            
            // Check wallet balance
            const balance = await this.provider.getBalance(this.wallet.address);
            
            // Check queue status
            const queueStatus = await this.getQueueStatus();
            
            return {
                status: 'healthy',
                contracts: {
                    redemptionService: redemptionAddress,
                    mintPass: mintPassAddress,
                    art: artAddress
                },
                wallet: {
                    address: this.wallet.address,
                    balance: ethers.formatEther(balance)
                },
                queue: queueStatus,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = { NFTGenerationService };

// Example usage and configuration
const exampleConfig = {
    rpcUrl: 'http://127.0.0.1:8545', // Local Hardhat
    privateKey: 'your-private-key-here',
    contracts: {
        redemptionService: '0x...',
        mintPass: '0x...',
        art: '0x...'
    }
};

// Export example for documentation
module.exports.exampleConfig = exampleConfig;