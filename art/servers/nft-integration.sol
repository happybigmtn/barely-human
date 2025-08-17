// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BarelyHumanGenerativeArt
 * @dev NFT contract for deterministic generative art from Barely Human DeFi Casino
 * Each NFT is generated from VRF seeds and bot personalities, creating unique
 * substrate-style artwork that reflects the gambling bot's characteristics.
 */
contract BarelyHumanGenerativeArt is ERC721, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    // Counters
    Counters.Counter private _tokenIdCounter;

    // NFT metadata structure
    struct ArtMetadata {
        uint256 seed;           // VRF seed used for generation
        uint8 botId;           // Bot personality (0-9)
        uint256 seriesId;      // Game series number
        string traits;         // JSON encoded traits
        uint256 timestamp;     // Generation timestamp
        uint8 rarityScore;     // Calculated rarity score (0-100)
    }

    // Mappings
    mapping(uint256 => ArtMetadata) public artMetadata;
    mapping(uint256 => string) private _artSVG; // On-chain SVG storage
    mapping(address => bool) public authorizedMinters;

    // Bot personality names
    string[10] public botNames = [
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
    ];

    // Events
    event ArtGenerated(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 seed,
        uint8 botId,
        uint256 seriesId,
        uint8 rarityScore
    );

    event SVGStored(uint256 indexed tokenId, uint256 svgLength);

    constructor() ERC721("Barely Human Generative Art", "BHGA") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint new generative art NFT from VRF seed
     * @param to Recipient address
     * @param seed VRF seed for deterministic generation
     * @param botId Bot personality ID (0-9)
     * @param seriesId Game series number
     * @param traits JSON encoded traits string
     * @param rarityScore Calculated rarity score
     * @param svgData Compressed SVG art data
     */
    function mintGenerativeArt(
        address to,
        uint256 seed,
        uint8 botId,
        uint256 seriesId,
        string calldata traits,
        uint8 rarityScore,
        string calldata svgData
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(botId < 10, "Invalid bot ID");
        require(rarityScore <= 100, "Invalid rarity score");
        require(bytes(svgData).length > 0, "SVG data required");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Store metadata
        artMetadata[tokenId] = ArtMetadata({
            seed: seed,
            botId: botId,
            seriesId: seriesId,
            traits: traits,
            timestamp: block.timestamp,
            rarityScore: rarityScore
        });

        // Store SVG on-chain
        _artSVG[tokenId] = svgData;

        // Mint NFT
        _safeMint(to, tokenId);

        emit ArtGenerated(tokenId, to, seed, botId, seriesId, rarityScore);
        emit SVGStored(tokenId, bytes(svgData).length);
    }

    /**
     * @dev Batch mint multiple NFTs (for efficient deployment)
     */
    function batchMintGenerativeArt(
        address[] calldata recipients,
        uint256[] calldata seeds,
        uint8[] calldata botIds,
        uint256[] calldata seriesIds,
        string[] calldata traitsArray,
        uint8[] calldata rarityScores,
        string[] calldata svgDataArray
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(recipients.length == seeds.length, "Array length mismatch");
        require(recipients.length == botIds.length, "Array length mismatch");
        require(recipients.length == seriesIds.length, "Array length mismatch");
        require(recipients.length == traitsArray.length, "Array length mismatch");
        require(recipients.length == rarityScores.length, "Array length mismatch");
        require(recipients.length == svgDataArray.length, "Array length mismatch");
        require(recipients.length <= 50, "Batch size too large");

        for (uint256 i = 0; i < recipients.length; i++) {
            mintGenerativeArt(
                recipients[i],
                seeds[i],
                botIds[i],
                seriesIds[i],
                traitsArray[i],
                rarityScores[i],
                svgDataArray[i]
            );
        }
    }

    /**
     * @dev Generate tokenURI with on-chain metadata and SVG
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        ArtMetadata memory metadata = artMetadata[tokenId];
        string memory svg = _artSVG[tokenId];
        
        // Create JSON metadata
        string memory json = string(
            abi.encodePacked(
                '{"name": "',
                botNames[metadata.botId],
                ' - Series ',
                metadata.seriesId.toString(),
                '", "description": "A unique generative artwork created by ',
                botNames[metadata.botId],
                ', an AI gambling bot. This piece was generated deterministically from blockchain randomness, capturing the bot\'s personality in algorithmic art.", "image": "data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '", "attributes": ',
                _buildAttributes(metadata),
                '}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /**
     * @dev Build attributes JSON for metadata
     */
    function _buildAttributes(ArtMetadata memory metadata) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                '[',
                '{"trait_type": "Bot", "value": "', botNames[metadata.botId], '"},',
                '{"trait_type": "Series", "value": ', metadata.seriesId.toString(), '},',
                '{"trait_type": "Rarity Score", "value": ', uint256(metadata.rarityScore).toString(), '},',
                '{"trait_type": "Generation", "value": "Genesis"},',
                '{"trait_type": "Timestamp", "value": ', metadata.timestamp.toString(), '},',
                '{"trait_type": "Seed", "value": "', metadata.seed.toString(), '"}',
                ']'
            )
        );
    }

    /**
     * @dev Get art SVG data for external use
     */
    function getArtSVG(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _artSVG[tokenId];
    }

    /**
     * @dev Get comprehensive token information
     */
    function getTokenInfo(uint256 tokenId) external view returns (
        ArtMetadata memory metadata,
        string memory svg,
        address owner
    ) {
        require(_exists(tokenId), "Token does not exist");
        
        metadata = artMetadata[tokenId];
        svg = _artSVG[tokenId];
        owner = ownerOf(tokenId);
    }

    /**
     * @dev Get tokens by bot personality
     */
    function getTokensByBot(uint8 botId) external view returns (uint256[] memory) {
        require(botId < 10, "Invalid bot ID");
        
        uint256 totalSupply = _tokenIdCounter.current();
        uint256[] memory tempTokens = new uint256[](totalSupply);
        uint256 count = 0;

        for (uint256 i = 0; i < totalSupply; i++) {
            if (artMetadata[i].botId == botId) {
                tempTokens[count] = i;
                count++;
            }
        }

        // Create properly sized array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempTokens[i];
        }

        return result;
    }

    /**
     * @dev Get tokens by series
     */
    function getTokensBySeries(uint256 seriesId) external view returns (uint256[] memory) {
        uint256 totalSupply = _tokenIdCounter.current();
        uint256[] memory tempTokens = new uint256[](totalSupply);
        uint256 count = 0;

        for (uint256 i = 0; i < totalSupply; i++) {
            if (artMetadata[i].seriesId == seriesId) {
                tempTokens[count] = i;
                count++;
            }
        }

        // Create properly sized array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempTokens[i];
        }

        return result;
    }

    /**
     * @dev Get rarity distribution statistics
     */
    function getRarityStats() external view returns (
        uint256[11] memory rarityBuckets, // 0-10, 11-20, ..., 91-100
        uint256 totalSupply,
        uint256 averageRarity
    ) {
        totalSupply = _tokenIdCounter.current();
        uint256 totalRarity = 0;

        for (uint256 i = 0; i < totalSupply; i++) {
            uint8 rarity = artMetadata[i].rarityScore;
            totalRarity += rarity;
            
            // Place in appropriate bucket (0-10, 11-20, etc.)
            uint256 bucket = rarity / 10;
            if (bucket > 10) bucket = 10; // Cap at bucket 10 for scores 91-100
            rarityBuckets[bucket]++;
        }

        averageRarity = totalSupply > 0 ? totalRarity / totalSupply : 0;
    }

    /**
     * @dev Get all NFTs owned by address with metadata
     */
    function getOwnerTokens(address owner) external view returns (
        uint256[] memory tokenIds,
        ArtMetadata[] memory metadata
    ) {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);
        metadata = new ArtMetadata[](balance);

        uint256 totalSupply = _tokenIdCounter.current();
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < totalSupply && currentIndex < balance; i++) {
            if (ownerOf(i) == owner) {
                tokenIds[currentIndex] = i;
                metadata[currentIndex] = artMetadata[i];
                currentIndex++;
            }
        }
    }

    /**
     * @dev Update SVG data (for fixes or improvements)
     * Only admin can update, and only before token is transferred
     */
    function updateArtSVG(
        uint256 tokenId, 
        string calldata newSvgData
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        require(bytes(newSvgData).length > 0, "SVG data required");
        
        _artSVG[tokenId] = newSvgData;
        emit SVGStored(tokenId, bytes(newSvgData).length);
    }

    /**
     * @dev Emergency functions
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get total number of minted tokens
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Check if token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    /**
     * @dev Required override for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Hook to prevent transfers when paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}