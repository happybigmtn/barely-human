// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

/**
 * @title GachaMintPass
 * @notice NFT mint passes distributed through weighted raffle after each game series
 * @dev Uses Chainlink VRF for fair raffle selection
 */
contract GachaMintPass is 
    ERC721,
    ERC721Enumerable,
    AccessControl,
    ReentrancyGuard,
    Pausable,
    VRFConsumerBaseV2
{
    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    
    // VRF Configuration
    VRFCoordinatorV2Interface public immutable vrfCoordinator;
    uint64 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public constant CALLBACK_GAS_LIMIT = 200000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;
    
    // NFT Configuration
    uint256 public nextTokenId;
    string public baseTokenURI;
    mapping(uint256 => string) private _tokenURIs;
    
    // Raffle Configuration
    struct RaffleEntry {
        address player;
        uint256 weight;
    }
    
    struct Raffle {
        uint256 seriesId;
        uint256 totalWeight;
        uint256 requestId;
        bool fulfilled;
        address winner;
        RaffleEntry[] entries;
    }
    
    mapping(uint256 => Raffle) public raffles; // seriesId => Raffle
    mapping(uint256 => uint256) public requestToSeries; // VRF requestId => seriesId
    uint256 public currentSeriesId;
    
    // Mint Pass Configuration
    struct MintPass {
        uint256 seriesId;
        uint256 vrfSeed;
        uint8 rarity; // 0: Common, 1: Rare, 2: Epic, 3: Legendary
        uint8 botId; // Which bot personality (0-9)
        bool redeemed;
    }
    
    mapping(uint256 => MintPass) public mintPasses; // tokenId => MintPass
    
    // Rarity weights (out of 10000)
    uint256 public constant COMMON_WEIGHT = 6000;    // 60%
    uint256 public constant RARE_WEIGHT = 3000;      // 30%
    uint256 public constant EPIC_WEIGHT = 900;       // 9%
    uint256 public constant LEGENDARY_WEIGHT = 100;  // 1%
    
    // Events
    event RaffleStarted(uint256 indexed seriesId, uint256 entryCount);
    event RaffleEntryAdded(uint256 indexed seriesId, address indexed player, uint256 weight);
    event RaffleRequested(uint256 indexed seriesId, uint256 requestId);
    event RaffleFulfilled(uint256 indexed seriesId, address indexed winner, uint256 tokenId);
    event MintPassRedeemed(uint256 indexed tokenId, address indexed owner);
    event BaseURIUpdated(string newBaseURI);
    
    // Errors
    error RaffleNotStarted();
    error RaffleAlreadyFulfilled();
    error NoEntries();
    error InvalidWeight();
    error MintPassAlreadyRedeemed();
    error NotOwner();
    error InvalidRaffleId();
    
    constructor(
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash,
        string memory _baseURI
    ) 
        ERC721("Barely Human Mint Pass", "BHMP")
        VRFConsumerBaseV2(_vrfCoordinator)
    {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        baseTokenURI = _baseURI;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(URI_SETTER_ROLE, msg.sender);
    }
    
    // Raffle Management
    
    /**
     * @notice Start a new raffle for a game series
     * @param seriesId The game series ID
     */
    function startRaffle(uint256 seriesId) external onlyRole(GAME_ROLE) {
        if (raffles[seriesId].seriesId != 0) revert RaffleAlreadyFulfilled();
        
        raffles[seriesId].seriesId = seriesId;
        currentSeriesId = seriesId;
        
        emit RaffleStarted(seriesId, 0);
    }
    
    /**
     * @notice Add a player entry to the current raffle
     * @param player The player address
     * @param weight The entry weight (based on participation/performance)
     */
    function addRaffleEntry(address player, uint256 weight) 
        external 
        onlyRole(GAME_ROLE) 
    {
        if (currentSeriesId == 0) revert RaffleNotStarted();
        if (weight == 0) revert InvalidWeight();
        
        Raffle storage raffle = raffles[currentSeriesId];
        raffle.entries.push(RaffleEntry({
            player: player,
            weight: weight
        }));
        raffle.totalWeight += weight;
        
        emit RaffleEntryAdded(currentSeriesId, player, weight);
    }
    
    /**
     * @notice Request VRF randomness to determine raffle winner
     */
    function requestRaffleWinner() 
        external 
        onlyRole(GAME_ROLE) 
        returns (uint256 requestId) 
    {
        if (currentSeriesId == 0) revert RaffleNotStarted();
        
        Raffle storage raffle = raffles[currentSeriesId];
        if (raffle.entries.length == 0) revert NoEntries();
        if (raffle.fulfilled) revert RaffleAlreadyFulfilled();
        
        requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );
        
        raffle.requestId = requestId;
        requestToSeries[requestId] = currentSeriesId;
        
        emit RaffleRequested(currentSeriesId, requestId);
    }
    
    /**
     * @notice Chainlink VRF callback
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        uint256 seriesId = requestToSeries[requestId];
        if (seriesId == 0) revert InvalidRaffleId();
        
        Raffle storage raffle = raffles[seriesId];
        if (raffle.fulfilled) return;
        
        // Select winner based on weighted random
        uint256 randomValue = randomWords[0] % raffle.totalWeight;
        uint256 cumulativeWeight = 0;
        address winner;
        
        for (uint256 i = 0; i < raffle.entries.length; i++) {
            cumulativeWeight += raffle.entries[i].weight;
            if (randomValue < cumulativeWeight) {
                winner = raffle.entries[i].player;
                break;
            }
        }
        
        raffle.fulfilled = true;
        raffle.winner = winner;
        
        // Mint the pass
        uint256 tokenId = _mintPass(winner, seriesId, randomWords[0]);
        
        emit RaffleFulfilled(seriesId, winner, tokenId);
        
        // Reset for next series
        if (seriesId == currentSeriesId) {
            currentSeriesId = 0;
        }
    }
    
    // NFT Minting
    
    /**
     * @notice Mint a new pass NFT
     */
    function _mintPass(address to, uint256 seriesId, uint256 vrfSeed) 
        private 
        returns (uint256 tokenId) 
    {
        tokenId = nextTokenId++;
        
        // Determine rarity based on VRF seed
        uint8 rarity = _determineRarity(vrfSeed);
        
        // Determine bot personality (0-9)
        uint8 botId = uint8((vrfSeed >> 8) % 10);
        
        mintPasses[tokenId] = MintPass({
            seriesId: seriesId,
            vrfSeed: vrfSeed,
            rarity: rarity,
            botId: botId,
            redeemed: false
        });
        
        _safeMint(to, tokenId);
        
        // Set token URI based on attributes
        string memory uri = _generateTokenURI(tokenId, rarity, botId);
        _tokenURIs[tokenId] = uri;
    }
    
    /**
     * @notice Determine rarity based on random seed
     */
    function _determineRarity(uint256 seed) private pure returns (uint8) {
        uint256 roll = seed % 10000;
        
        if (roll < LEGENDARY_WEIGHT) return 3; // Legendary
        if (roll < LEGENDARY_WEIGHT + EPIC_WEIGHT) return 2; // Epic
        if (roll < LEGENDARY_WEIGHT + EPIC_WEIGHT + RARE_WEIGHT) return 1; // Rare
        return 0; // Common
    }
    
    /**
     * @notice Generate token URI based on attributes
     */
    function _generateTokenURI(uint256 tokenId, uint8 rarity, uint8 botId) 
        private 
        view 
        returns (string memory) 
    {
        // Format: baseURI/tokenId-rarity-botId.json
        return string(abi.encodePacked(
            baseTokenURI,
            "/",
            _toString(tokenId),
            "-",
            _toString(rarity),
            "-",
            _toString(botId),
            ".json"
        ));
    }
    
    /**
     * @notice Admin mint function for special events
     */
    function adminMint(address to, uint8 rarity, uint8 botId) 
        external 
        onlyRole(MINTER_ROLE) 
        returns (uint256 tokenId) 
    {
        tokenId = nextTokenId++;
        
        mintPasses[tokenId] = MintPass({
            seriesId: 0, // Admin mint, no series
            vrfSeed: 0,
            rarity: rarity,
            botId: botId,
            redeemed: false
        });
        
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = _generateTokenURI(tokenId, rarity, botId);
    }
    
    /**
     * @notice Redeem a mint pass for the actual generative art NFT
     * @dev This would trigger minting in a separate art contract
     */
    function redeemPass(uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        
        MintPass storage pass = mintPasses[tokenId];
        if (pass.redeemed) revert MintPassAlreadyRedeemed();
        
        pass.redeemed = true;
        
        // In production, this would call the generative art contract
        // For now, just mark as redeemed
        
        emit MintPassRedeemed(tokenId, msg.sender);
    }
    
    // Admin Functions
    
    function setBaseURI(string memory newBaseURI) external onlyRole(URI_SETTER_ROLE) {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // View Functions
    
    function getRaffleEntries(uint256 seriesId) 
        external 
        view 
        returns (RaffleEntry[] memory) 
    {
        return raffles[seriesId].entries;
    }
    
    function getMintPassDetails(uint256 tokenId) 
        external 
        view 
        returns (MintPass memory) 
    {
        return mintPasses[tokenId];
    }
    
    function getRarityName(uint8 rarity) public pure returns (string memory) {
        if (rarity == 0) return "Common";
        if (rarity == 1) return "Rare";
        if (rarity == 2) return "Epic";
        if (rarity == 3) return "Legendary";
        return "Unknown";
    }
    
    // Utility Functions
    
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Required Overrides
    
    // Override _update for pausable functionality
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }
    
    // Override _increaseBalance required by multiple inheritance
    function _increaseBalance(address account, uint128 amount) 
        internal 
        override(ERC721, ERC721Enumerable) 
    {
        super._increaseBalance(account, amount);
    }
    
    // _burn is no longer overrideable in OpenZeppelin 5.x
    // Burning functionality is handled through _update
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        string memory _tokenURI = _tokenURIs[tokenId];
        
        // If there is no base URI, return the token URI.
        if (bytes(baseTokenURI).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI.
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(baseTokenURI, _tokenURI));
        }
        // If there is a baseURI but no tokenURI, return base + tokenId
        return string(abi.encodePacked(baseTokenURI, Strings.toString(tokenId)));
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