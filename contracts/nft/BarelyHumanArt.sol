// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BarelyHumanArt
 * @notice Generative art NFTs redeemed from mint passes
 * @dev Stores generative art metadata and SVG on-chain for full decentralization
 */
contract BarelyHumanArt is 
    ERC721,
    ERC721Enumerable,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    
    // Art Configuration
    uint256 public nextTokenId = 1;
    string public description = "Barely Human Generative Art - AI Bot Personalities in Algorithmic Art";
    string public externalUrl = "https://barelyhuman.xyz";
    
    // Art Data Structure
    struct Artwork {
        uint256 mintPassId;      // Reference to original mint pass
        uint256 seriesId;        // Game series this was generated from
        uint256 vrfSeed;         // VRF seed used for generation
        uint8 rarity;            // 0: Common, 1: Rare, 2: Epic, 3: Legendary
        uint8 botId;             // AI bot personality (0-9)
        string svgData;          // On-chain SVG art data
        uint256 generatedAt;     // Timestamp of generation
        string[] traits;         // Art generation traits
        address originalOwner;   // Original mint pass owner
    }
    
    mapping(uint256 => Artwork) public artworks; // tokenId => Artwork
    mapping(uint256 => bool) public mintPassUsed; // mintPassId => used
    
    // Bot personality names for metadata
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
    
    // Rarity names
    string[4] public rarityNames = ["Common", "Rare", "Epic", "Legendary"];
    
    // Events
    event ArtworkGenerated(
        uint256 indexed tokenId, 
        uint256 indexed mintPassId, 
        address indexed owner,
        uint8 botId,
        uint8 rarity
    );
    event MetadataUpdated(uint256 indexed tokenId);
    event DescriptionUpdated(string newDescription);
    event ExternalUrlUpdated(string newUrl);
    
    // Errors
    error MintPassAlreadyUsed();
    error InvalidMintPass();
    error NotAuthorized();
    error EmptySVGData();
    error InvalidBotId();
    error InvalidRarity();
    
    constructor(string memory _name, string memory _symbol) 
        ERC721(_name, _symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(URI_SETTER_ROLE, msg.sender);
    }
    
    /**
     * @notice Mint generative art NFT from mint pass
     * @param to Recipient address
     * @param mintPassId Original mint pass ID
     * @param seriesId Game series ID
     * @param vrfSeed VRF seed for generation
     * @param rarity Artwork rarity (0-3)
     * @param botId Bot personality (0-9)
     * @param svgData On-chain SVG artwork data
     * @param traits Array of trait strings
     */
    function mintArtwork(
        address to,
        uint256 mintPassId,
        uint256 seriesId,
        uint256 vrfSeed,
        uint8 rarity,
        uint8 botId,
        string memory svgData,
        string[] memory traits
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 tokenId) {
        if (mintPassUsed[mintPassId]) revert MintPassAlreadyUsed();
        if (bytes(svgData).length == 0) revert EmptySVGData();
        if (botId >= 10) revert InvalidBotId();
        if (rarity >= 4) revert InvalidRarity();
        
        tokenId = nextTokenId++;
        mintPassUsed[mintPassId] = true;
        
        artworks[tokenId] = Artwork({
            mintPassId: mintPassId,
            seriesId: seriesId,
            vrfSeed: vrfSeed,
            rarity: rarity,
            botId: botId,
            svgData: svgData,
            generatedAt: block.timestamp,
            traits: traits,
            originalOwner: to
        });
        
        _safeMint(to, tokenId);
        
        emit ArtworkGenerated(tokenId, mintPassId, to, botId, rarity);
        
        return tokenId;
    }
    
    /**
     * @notice Update SVG data for an existing artwork (in case of bugs)
     * @param tokenId Token to update
     * @param newSvgData New SVG data
     */
    function updateArtworkSVG(uint256 tokenId, string memory newSvgData) 
        external 
        onlyRole(URI_SETTER_ROLE) 
    {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        if (bytes(newSvgData).length == 0) revert EmptySVGData();
        
        artworks[tokenId].svgData = newSvgData;
        emit MetadataUpdated(tokenId);
    }
    
    /**
     * @notice Update artwork traits
     * @param tokenId Token to update
     * @param newTraits New traits array
     */
    function updateArtworkTraits(uint256 tokenId, string[] memory newTraits) 
        external 
        onlyRole(URI_SETTER_ROLE) 
    {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        artworks[tokenId].traits = newTraits;
        emit MetadataUpdated(tokenId);
    }
    
    /**
     * @notice Generate JSON metadata for OpenSea compatibility
     * @param tokenId Token ID
     * @return JSON metadata string
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        Artwork memory artwork = artworks[tokenId];
        
        // Build attributes array
        string memory attributes = _buildAttributes(artwork);
        
        // Build JSON metadata
        string memory json = string(abi.encodePacked(
            '{"name": "Barely Human #',
            Strings.toString(tokenId),
            '", "description": "',
            description,
            '", "external_url": "',
            externalUrl,
            '", "image": "data:image/svg+xml;base64,',
            Base64.encode(bytes(artwork.svgData)),
            '", "attributes": [',
            attributes,
            '], "properties": {',
            '"series": ', Strings.toString(artwork.seriesId), ',',
            '"vrf_seed": "', _toHexString(artwork.vrfSeed), '",',
            '"generated_at": ', Strings.toString(artwork.generatedAt), ',',
            '"original_owner": "', Strings.toHexString(artwork.originalOwner), '",',
            '"mint_pass_id": ', Strings.toString(artwork.mintPassId),
            '}}'
        ));
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }
    
    /**
     * @notice Build attributes array for metadata
     */
    function _buildAttributes(Artwork memory artwork) private view returns (string memory) {
        string memory baseAttributes = string(abi.encodePacked(
            '{"trait_type": "Bot Personality", "value": "', botNames[artwork.botId], '"},',
            '{"trait_type": "Rarity", "value": "', rarityNames[artwork.rarity], '"},',
            '{"trait_type": "Series", "value": "', Strings.toString(artwork.seriesId), '"},',
            '{"trait_type": "Algorithm", "value": "Authentic Substrate Physics"}'
        ));
        
        // Add dynamic traits from generation
        string memory dynamicTraits = "";
        for (uint256 i = 0; i < artwork.traits.length; i++) {
            dynamicTraits = string(abi.encodePacked(
                dynamicTraits,
                ', {"trait_type": "Generated Trait ', Strings.toString(i + 1), '", "value": "', artwork.traits[i], '"}'
            ));
        }
        
        return string(abi.encodePacked(baseAttributes, dynamicTraits));
    }
    
    /**
     * @notice Get raw SVG data for an artwork
     * @param tokenId Token ID
     * @return SVG data string
     */
    function getArtworkSVG(uint256 tokenId) external view returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return artworks[tokenId].svgData;
    }
    
    /**
     * @notice Get artwork details
     * @param tokenId Token ID
     * @return Artwork struct
     */
    function getArtworkDetails(uint256 tokenId) external view returns (Artwork memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return artworks[tokenId];
    }
    
    /**
     * @notice Get all artworks by bot ID
     * @param botId Bot personality ID (0-9)
     * @return Array of token IDs
     */
    function getArtworksByBot(uint8 botId) external view returns (uint256[] memory) {
        if (botId >= 10) revert InvalidBotId();
        
        uint256 count = 0;
        uint256 supply = totalSupply();
        
        // Count artworks by this bot
        for (uint256 i = 1; i <= supply; i++) {
            if (artworks[i].botId == botId) {
                count++;
            }
        }
        
        // Build result array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= supply; i++) {
            if (artworks[i].botId == botId) {
                result[index] = i;
                index++;
            }
        }
        
        return result;
    }
    
    /**
     * @notice Get artworks by rarity
     * @param rarity Rarity level (0-3)
     * @return Array of token IDs
     */
    function getArtworksByRarity(uint8 rarity) external view returns (uint256[] memory) {
        if (rarity >= 4) revert InvalidRarity();
        
        uint256 count = 0;
        uint256 supply = totalSupply();
        
        // Count artworks by this rarity
        for (uint256 i = 1; i <= supply; i++) {
            if (artworks[i].rarity == rarity) {
                count++;
            }
        }
        
        // Build result array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= supply; i++) {
            if (artworks[i].rarity == rarity) {
                result[index] = i;
                index++;
            }
        }
        
        return result;
    }
    
    /**
     * @notice Convert uint256 to hex string
     */
    function _toHexString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0x0";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 4;
        }
        bytes memory buffer = new bytes(2 + length);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 + length - 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
    
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    
    // Admin Functions
    
    function setDescription(string memory newDescription) external onlyRole(URI_SETTER_ROLE) {
        description = newDescription;
        emit DescriptionUpdated(newDescription);
    }
    
    function setExternalUrl(string memory newUrl) external onlyRole(URI_SETTER_ROLE) {
        externalUrl = newUrl;
        emit ExternalUrlUpdated(newUrl);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // Required Overrides
    
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 amount) 
        internal 
        override(ERC721, ERC721Enumerable) 
    {
        super._increaseBalance(account, amount);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}