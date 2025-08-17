/**
 * OpenSea Metadata Server for Barely Human NFTs
 * Serves dynamic metadata for mint passes and generative art NFTs
 */

const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

class OpenSeaMetadataServer {
    constructor(config) {
        this.config = config;
        this.app = express();
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        // Contract instances
        this.mintPassContract = null;
        this.artContract = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Collection metadata
        this.app.get('/collection', this.getCollectionMetadata.bind(this));
        
        // Mint pass metadata
        this.app.get('/mintpass/:tokenId', this.getMintPassMetadata.bind(this));
        
        // Art NFT metadata  
        this.app.get('/art/:tokenId', this.getArtMetadata.bind(this));
        
        // Contract metadata (for OpenSea)
        this.app.get('/contract/:contractAddress', this.getContractMetadata.bind(this));
        
        // Health check
        this.app.get('/health', this.healthCheck.bind(this));
        
        // Refresh metadata (webhook for OpenSea)
        this.app.post('/refresh/:contractAddress/:tokenId', this.refreshMetadata.bind(this));
    }
    
    async initialize() {
        try {
            // Load contract ABIs and initialize contracts
            const mintPassABI = await this.loadABI('GachaMintPass');
            const artABI = await this.loadABI('BarelyHumanArt');
            
            this.mintPassContract = new ethers.Contract(
                this.config.contracts.mintPass,
                mintPassABI,
                this.provider
            );
            
            this.artContract = new ethers.Contract(
                this.config.contracts.art,
                artABI,
                this.provider
            );
            
            console.log('OpenSea Metadata Server initialized successfully');
        } catch (error) {
            console.error('Failed to initialize metadata server:', error);
            throw error;
        }
    }
    
    async loadABI(contractName) {
        const artifactPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
        const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
        return artifact.abi;
    }
    
    // Collection metadata endpoint
    async getCollectionMetadata(req, res) {
        try {
            const collectionPath = path.join(__dirname, 'opensea-collection.json');
            const collection = JSON.parse(await fs.readFile(collectionPath, 'utf8'));
            res.json(collection);
        } catch (error) {
            console.error('Error serving collection metadata:', error);
            res.status(500).json({ error: 'Failed to load collection metadata' });
        }
    }
    
    // Mint pass metadata endpoint
    async getMintPassMetadata(req, res) {
        try {
            const tokenId = req.params.tokenId;
            
            // Get mint pass details from contract
            const mintPass = await this.mintPassContract.getMintPassDetails(tokenId);
            const owner = await this.mintPassContract.ownerOf(tokenId);
            
            // Get bot personality info
            const botData = this.getBotPersonalityData(mintPass.botId);
            const rarityName = this.getRarityName(mintPass.rarity);
            
            const metadata = {
                name: `Barely Human Mint Pass #${tokenId}`,
                description: `A mint pass for ${botData.name}, the ${botData.trait} AI bot. This pass can be redeemed for a unique generative art piece created by ${botData.name}'s personality algorithm. Rarity: ${rarityName}`,
                image: `${this.config.baseUrl}/images/mint-pass-${mintPass.rarity}-${mintPass.botId}.png`,
                external_url: `${this.config.frontendUrl}/mint-pass/${tokenId}`,
                attributes: [
                    {
                        trait_type: "Bot Personality",
                        value: botData.name
                    },
                    {
                        trait_type: "Bot Trait",
                        value: botData.trait
                    },
                    {
                        trait_type: "Rarity",
                        value: rarityName
                    },
                    {
                        trait_type: "Series",
                        value: mintPass.seriesId.toString()
                    },
                    {
                        trait_type: "Status",
                        value: mintPass.redeemed ? "Redeemed" : "Unredeemed"
                    },
                    {
                        trait_type: "VRF Seed",
                        value: `0x${mintPass.vrfSeed.toString(16)}`
                    }
                ],
                properties: {
                    category: "Mint Pass",
                    collection: "Barely Human",
                    mint_pass_id: tokenId,
                    series_id: mintPass.seriesId.toString(),
                    bot_id: mintPass.botId,
                    rarity_level: mintPass.rarity,
                    redeemed: mintPass.redeemed,
                    vrf_seed: `0x${mintPass.vrfSeed.toString(16)}`
                }
            };
            
            res.json(metadata);
            
        } catch (error) {
            console.error('Error serving mint pass metadata:', error);
            res.status(500).json({ error: 'Failed to load mint pass metadata' });
        }
    }
    
    // Art NFT metadata endpoint
    async getArtMetadata(req, res) {
        try {
            const tokenId = req.params.tokenId;
            
            // Get artwork details from contract
            const artwork = await this.artContract.getArtworkDetails(tokenId);
            const owner = await this.artContract.ownerOf(tokenId);
            
            // Get bot personality info
            const botData = this.getBotPersonalityData(artwork.botId);
            const rarityName = this.getRarityName(artwork.rarity);
            
            // Build attributes from stored traits
            const attributes = [
                {
                    trait_type: "Bot Personality",
                    value: botData.name
                },
                {
                    trait_type: "Bot Theme",
                    value: botData.theme
                },
                {
                    trait_type: "Rarity", 
                    value: rarityName
                },
                {
                    trait_type: "Series",
                    value: artwork.seriesId.toString()
                },
                {
                    trait_type: "Algorithm",
                    value: "Authentic Substrate Physics"
                }
            ];
            
            // Add dynamic traits from contract
            for (let i = 0; i < artwork.traits.length; i++) {
                attributes.push({
                    trait_type: `Generated Trait ${i + 1}`,
                    value: artwork.traits[i]
                });
            }
            
            const metadata = {
                name: `Barely Human #${tokenId}`,
                description: `Generative art created by ${botData.name}, the ${botData.trait} AI bot. This unique piece was generated using authentic substrate crack physics, creating a one-of-a-kind algorithmic artwork that reflects the bot's personality and betting behavior.`,
                image: `data:image/svg+xml;base64,${Buffer.from(artwork.svgData).toString('base64')}`,
                animation_url: `${this.config.baseUrl}/art/${tokenId}/animation`,
                external_url: `${this.config.frontendUrl}/art/${tokenId}`,
                attributes: attributes,
                properties: {
                    category: "Generative Art",
                    collection: "Barely Human",
                    art_token_id: tokenId,
                    mint_pass_id: artwork.mintPassId.toString(),
                    series_id: artwork.seriesId.toString(),
                    bot_id: artwork.botId,
                    rarity_level: artwork.rarity,
                    vrf_seed: `0x${artwork.vrfSeed.toString(16)}`,
                    generated_at: artwork.generatedAt.toString(),
                    original_owner: artwork.originalOwner
                }
            };
            
            res.json(metadata);
            
        } catch (error) {
            console.error('Error serving art metadata:', error);
            res.status(500).json({ error: 'Failed to load art metadata' });
        }
    }
    
    // Contract metadata endpoint (for OpenSea collection pages)
    async getContractMetadata(req, res) {
        try {
            const contractAddress = req.params.contractAddress.toLowerCase();
            
            let metadata;
            
            if (contractAddress === this.config.contracts.mintPass.toLowerCase()) {
                metadata = {
                    name: "Barely Human Mint Passes",
                    description: "Mint passes earned through gameplay in the Barely Human DeFi casino. Each pass can be redeemed for unique generative art created by AI bot personalities.",
                    image: `${this.config.baseUrl}/images/mint-pass-collection.png`,
                    external_link: `${this.config.frontendUrl}`,
                    seller_fee_basis_points: 500,
                    fee_recipient: this.config.feeRecipient
                };
            } else if (contractAddress === this.config.contracts.art.toLowerCase()) {
                metadata = {
                    name: "Barely Human Generative Art",
                    description: "AI-generated algorithmic art created by bot personalities using authentic substrate crack physics. Each piece is unique and reflects the personality of the AI bot that created it.",
                    image: `${this.config.baseUrl}/images/art-collection.png`,
                    external_link: `${this.config.frontendUrl}`,
                    seller_fee_basis_points: 500,
                    fee_recipient: this.config.feeRecipient
                };
            } else {
                return res.status(404).json({ error: 'Contract not found' });
            }
            
            res.json(metadata);
            
        } catch (error) {
            console.error('Error serving contract metadata:', error);
            res.status(500).json({ error: 'Failed to load contract metadata' });
        }
    }
    
    // Get bot personality data
    getBotPersonalityData(botId) {
        const bots = [
            { name: "Alice All-In", trait: "Aggressive", theme: "Volcanic" },
            { name: "Bob Calculator", trait: "Analytical", theme: "Klein Blue" },
            { name: "Charlie Lucky", trait: "Superstitious", theme: "Aurora" },
            { name: "Diana Ice Queen", trait: "Methodical", theme: "Mist" },
            { name: "Eddie Entertainer", trait: "Theatrical", theme: "Neon" },
            { name: "Fiona Fearless", trait: "Bold", theme: "Storm" },
            { name: "Greg Grinder", trait: "Patient", theme: "Zen" },
            { name: "Helen Hot Streak", trait: "Momentum-driven", theme: "Dawn" },
            { name: "Ivan Intimidator", trait: "Intimidating", theme: "Void" },
            { name: "Julia Jinx", trait: "Chaotic", theme: "Cyber" }
        ];
        
        return bots[botId] || { name: "Unknown", trait: "Unknown", theme: "Unknown" };
    }
    
    // Get rarity name
    getRarityName(rarity) {
        const rarities = ["Common", "Rare", "Epic", "Legendary"];
        return rarities[rarity] || "Unknown";
    }
    
    // Health check endpoint
    async healthCheck(req, res) {
        try {
            // Check contract connections
            const mintPassAddress = await this.mintPassContract.getAddress();
            const artAddress = await this.artContract.getAddress();
            
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                contracts: {
                    mintPass: mintPassAddress,
                    art: artAddress
                },
                version: '1.0.0'
            });
        } catch (error) {
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Refresh metadata endpoint (for OpenSea webhooks)
    async refreshMetadata(req, res) {
        try {
            const contractAddress = req.params.contractAddress;
            const tokenId = req.params.tokenId;
            
            console.log(`Metadata refresh requested for ${contractAddress}:${tokenId}`);
            
            // In a production system, you might want to:
            // 1. Invalidate any caches
            // 2. Re-generate metadata if needed
            // 3. Notify other services
            
            res.json({
                success: true,
                message: `Metadata refreshed for token ${tokenId}`,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`OpenSea Metadata Server running on port ${port}`);
            console.log(`Collection: ${this.config.baseUrl}/collection`);
            console.log(`Mint Pass: ${this.config.baseUrl}/mintpass/{tokenId}`);
            console.log(`Art NFT: ${this.config.baseUrl}/art/{tokenId}`);
        });
    }
}

module.exports = { OpenSeaMetadataServer };

// Example configuration
const exampleConfig = {
    rpcUrl: 'http://127.0.0.1:8545',
    baseUrl: 'https://api.barelyhuman.xyz',
    frontendUrl: 'https://barelyhuman.xyz',
    feeRecipient: '0x742d35Cc64C0532A79B08aE5b9b3EF2E50DE5E65',
    contracts: {
        mintPass: '0x...',
        art: '0x...'
    }
};

// Export example for documentation
module.exports.exampleConfig = exampleConfig;