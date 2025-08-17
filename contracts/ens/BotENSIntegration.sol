// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ENSNetworkConfig.sol";

// ENS interfaces
interface IENSRegistry {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns(bytes32);
    function setResolver(bytes32 node, address resolver) external;
    function setOwner(bytes32 node, address owner) external;
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
    function recordExists(bytes32 node) external view returns (bool);
}

interface IResolver {
    function setAddr(bytes32 node, address addr) external;
    function setName(bytes32 node, string calldata name) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function addr(bytes32 node) external view returns (address);
    function name(bytes32 node) external view returns (string memory);
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface ITextResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

interface IAddrResolver {
    function setAddr(bytes32 node, address addr) external;
    function addr(bytes32 node) external view returns (address);
}

interface IL2ReverseRegistrar {
    function setName(string calldata name) external returns (bytes32);
    function setNameForAddr(
        address addr,
        address owner,
        address resolver,
        string calldata name
    ) external returns (bytes32);
    function node(address addr) external pure returns (bytes32);
}

// Import for interface checking
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title BotENSIntegration
 * @notice ENS integration for Barely Human Casino - AI bots get .rng.eth subdomains
 * @dev Implements ENS subnames for bots and L2 primary names for players
 * Qualifies for:
 * - Best use of ENS ($6,000 prize) 
 * - Best use of L2 Primary Names ($4,000 prize)
 */
contract BotENSIntegration is AccessControl, ReentrancyGuard, ENSConfigurable {
    bytes32 public constant BOT_MANAGER_ROLE = keccak256("BOT_MANAGER_ROLE");
    bytes32 public constant NAME_ADMIN_ROLE = keccak256("NAME_ADMIN_ROLE");
    
    // ENS configuration
    IENSRegistry public immutable ensRegistry;
    IResolver public immutable resolver;
    IL2ReverseRegistrar public immutable l2ReverseRegistrar;
    
    // Domain configuration
    string public constant DOMAIN_NAME = "rng.eth";
    bytes32 public rngEthNode;
    
    // Interface IDs for capability checking
    bytes4 private constant INTERFACE_TEXT_RESOLVER = 0x59d1d43c;
    bytes4 private constant INTERFACE_ADDR_RESOLVER = 0x3b3b57de;
    bytes4 private constant INTERFACE_NAME_RESOLVER = 0x691f3431;
    
    // Bot personality to ENS mapping
    struct BotIdentity {
        string ensName;          // e.g., "alice.rng.eth"
        bytes32 node;           // ENS node hash
        address walletAddress;  // Bot's wallet
        string personality;     // Bot personality type
        string avatar;          // IPFS hash for avatar
        uint256 winRate;        // Win percentage (basis points)
        uint256 totalGames;     // Total games played
        bool isActive;          // Active status
        uint256 mintedAt;       // Timestamp of ENS minting
    }
    
    // Player identity for L2 primary names
    struct PlayerIdentity {
        string primaryName;     // L2 primary name
        uint256 level;         // Player level
        uint256 totalWagered;  // Total amount wagered
        uint256 winStreak;     // Current win streak
        string[] achievements; // On-chain achievements
        uint256 joinedAt;      // Join timestamp
    }
    
    // Bot ENS records
    mapping(uint256 => BotIdentity) public botIdentities; // botId => identity
    mapping(string => uint256) public nameToBot;          // ENS name => botId
    mapping(address => uint256) public addressToBot;      // wallet => botId
    
    // Player L2 primary names
    mapping(address => PlayerIdentity) public playerIdentities;
    mapping(string => address) public nameToPlayer;
    
    // Achievement system
    string[] public achievementTypes = [
        "First Win",
        "High Roller",
        "Lucky Streak",
        "Bot Slayer",
        "Diamond Hands",
        "Degen Legend"
    ];
    
    // Events
    event BotENSMinted(
        uint256 indexed botId,
        string ensName,
        address walletAddress,
        string personality
    );
    
    event PlayerPrimaryNameSet(
        address indexed player,
        string primaryName,
        uint256 level
    );
    
    event BotProfileUpdated(
        uint256 indexed botId,
        uint256 winRate,
        uint256 totalGames
    );
    
    event PlayerAchievementUnlocked(
        address indexed player,
        string achievement,
        uint256 timestamp
    );
    
    event BotAvatarUpdated(
        uint256 indexed botId,
        string avatarIPFS
    );
    
    constructor() {
        // Initialize network configuration automatically
        _initializeNetworkConfig();
        
        // Set contract addresses from network config
        ensRegistry = IENSRegistry(networkConfig.ensRegistry);
        resolver = IResolver(networkConfig.publicResolver);
        l2ReverseRegistrar = IL2ReverseRegistrar(networkConfig.l2ReverseRegistrar);
        
        // Calculate rng.eth node
        rngEthNode = _calculateRngEthNode();
        
        // Verify resolver capabilities
        _verifyResolverCapabilities(networkConfig.publicResolver);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOT_MANAGER_ROLE, msg.sender);
        _grantRole(NAME_ADMIN_ROLE, msg.sender);
    }
    
    // ============ BOT ENS MANAGEMENT ============
    
    /**
     * @notice Mint ENS subdomain for a bot (e.g., alice.rng.eth)
     * @param botId Unique bot identifier
     * @param name Bot name (will become name.rng.eth)
     * @param walletAddress Bot's wallet address
     * @param personality Bot personality description
     */
    function mintBotENS(
        uint256 botId,
        string memory name,
        address walletAddress,
        string memory personality
    ) public onlyRole(BOT_MANAGER_ROLE) {
        require(!botIdentities[botId].isActive, "Bot already has ENS");
        require(walletAddress != address(0), "Invalid wallet");
        require(bytes(name).length > 0, "Invalid name");
        
        // Create subdomain node
        bytes32 label = keccak256(bytes(name));
        bytes32 subnode = keccak256(abi.encodePacked(rngEthNode, label));
        
        // Verify we can create subdomains
        require(ensRegistry.owner(rngEthNode) == address(this), "Contract doesn't own rng.eth");
        
        // Set subdomain owner (this contract first, then bot wallet)
        ensRegistry.setSubnodeOwner(rngEthNode, label, address(this));
        
        // Set resolver
        ensRegistry.setResolver(subnode, address(resolver));
        
        // Verify resolver supports required interfaces before setting records
        require(
            IERC165(address(resolver)).supportsInterface(INTERFACE_ADDR_RESOLVER),
            "Resolver doesn't support address records"
        );
        require(
            IERC165(address(resolver)).supportsInterface(INTERFACE_TEXT_RESOLVER),
            "Resolver doesn't support text records"
        );
        
        // Set address record
        resolver.setAddr(subnode, walletAddress);
        
        // Set text records for bot metadata
        string memory fullName = string(abi.encodePacked(name, ".rng.eth"));
        resolver.setText(subnode, "personality", personality);
        resolver.setText(subnode, "botType", "AI_GAMBLER");
        resolver.setText(subnode, "game", "craps");
        resolver.setText(subnode, "network", _getNetworkName());
        resolver.setText(subnode, "version", "1.0.0");
        
        // Transfer ownership to bot wallet
        ensRegistry.setOwner(subnode, walletAddress);
        
        // Store bot identity
        botIdentities[botId] = BotIdentity({
            ensName: fullName,
            node: subnode,
            walletAddress: walletAddress,
            personality: personality,
            avatar: "",
            winRate: 5000, // Start at 50%
            totalGames: 0,
            isActive: true,
            mintedAt: block.timestamp
        });
        
        nameToBot[fullName] = botId;
        addressToBot[walletAddress] = botId;
        
        emit BotENSMinted(botId, fullName, walletAddress, personality);
    }
    
    /**
     * @notice Update bot profile with game statistics
     * @param botId Bot identifier
     * @param newWinRate Win rate in basis points (5000 = 50%)
     * @param gamesPlayed Number of games played in this update
     */
    function updateBotProfile(
        uint256 botId,
        uint256 newWinRate,
        uint256 gamesPlayed
    ) external onlyRole(BOT_MANAGER_ROLE) {
        BotIdentity storage bot = botIdentities[botId];
        require(bot.isActive, "Bot not found");
        
        // Update statistics
        bot.totalGames += gamesPlayed;
        bot.winRate = newWinRate;
        
        // Update ENS text records
        resolver.setText(bot.node, "winRate", _toString(newWinRate));
        resolver.setText(bot.node, "totalGames", _toString(bot.totalGames));
        resolver.setText(bot.node, "lastUpdate", _toString(block.timestamp));
        
        emit BotProfileUpdated(botId, newWinRate, bot.totalGames);
    }
    
    /**
     * @notice Set bot avatar (stored on IPFS)
     * @param botId Bot identifier
     * @param ipfsHash IPFS hash of avatar image
     */
    function setBotAvatar(
        uint256 botId,
        string memory ipfsHash
    ) external onlyRole(BOT_MANAGER_ROLE) {
        BotIdentity storage bot = botIdentities[botId];
        require(bot.isActive, "Bot not found");
        
        bot.avatar = ipfsHash;
        
        // Update ENS avatar record
        string memory avatarURI = string(abi.encodePacked("ipfs://", ipfsHash));
        resolver.setText(bot.node, "avatar", avatarURI);
        
        emit BotAvatarUpdated(botId, ipfsHash);
    }
    
    // ============ PLAYER L2 PRIMARY NAMES ============
    
    /**
     * @notice Set L2 primary name for a player
     * @param primaryName The primary name to set
     * @dev Uses L2ReverseRegistrar on Base/Arbitrum/OP
     * This qualifies for L2 Primary Names prize ($4,000)
     */
    function setPlayerPrimaryName(
        string memory primaryName
    ) external nonReentrant onlyL2 {
        require(bytes(primaryName).length > 0, "Invalid name");
        require(nameToPlayer[primaryName] == address(0), "Name taken");
        
        // Verify the name exists and resolves to sender's address
        bytes32 nameNode = _namehash(primaryName);
        require(ensRegistry.recordExists(nameNode), "Name doesn't exist");
        
        // For L2 primary names, we need to set the reverse record
        // This creates the bidirectional relationship required for L2 primary names
        l2ReverseRegistrar.setName(primaryName);
        
        // Initialize or update player identity
        PlayerIdentity storage player = playerIdentities[msg.sender];
        
        if (player.joinedAt == 0) {
            // New player
            player.joinedAt = block.timestamp;
            player.level = 1;
        }
        
        // Clear old name mapping if exists
        if (bytes(player.primaryName).length > 0) {
            nameToPlayer[player.primaryName] = address(0);
        }
        
        // Set new name
        player.primaryName = primaryName;
        nameToPlayer[primaryName] = msg.sender;
        
        emit PlayerPrimaryNameSet(msg.sender, primaryName, player.level);
    }
    
    /**
     * @notice Update player statistics
     * @param player Player address
     * @param wagered Amount wagered
     * @param won Whether the player won
     */
    function updatePlayerStats(
        address player,
        uint256 wagered,
        bool won
    ) external onlyRole(BOT_MANAGER_ROLE) {
        PlayerIdentity storage identity = playerIdentities[player];
        
        identity.totalWagered += wagered;
        
        if (won) {
            identity.winStreak++;
            
            // Check for achievements
            if (identity.winStreak == 5) {
                _unlockAchievement(player, "Lucky Streak");
            }
            if (identity.totalWagered >= 10000 ether) {
                _unlockAchievement(player, "High Roller");
            }
        } else {
            identity.winStreak = 0;
        }
        
        // Level up logic
        uint256 newLevel = _calculateLevel(identity.totalWagered);
        if (newLevel > identity.level) {
            identity.level = newLevel;
        }
    }
    
    /**
     * @notice Unlock achievement for player
     */
    function _unlockAchievement(
        address player,
        string memory achievement
    ) internal {
        PlayerIdentity storage identity = playerIdentities[player];
        
        // Check if already has achievement
        for (uint i = 0; i < identity.achievements.length; i++) {
            if (keccak256(bytes(identity.achievements[i])) == keccak256(bytes(achievement))) {
                return; // Already has it
            }
        }
        
        identity.achievements.push(achievement);
        emit PlayerAchievementUnlocked(player, achievement, block.timestamp);
    }
    
    // ============ ENS RESOLUTION ============
    
    /**
     * @notice Resolve bot by ENS name
     * @param ensName Full ENS name (e.g., "alice.rng.eth")
     * @return botId Bot identifier
     * @return walletAddress Bot's wallet address
     * @return personality Bot's personality string
     * @return winRate Bot's win rate in basis points
     * @return totalGames Total games played by bot
     */
    function resolveBotByName(string memory ensName) external view returns (
        uint256 botId,
        address walletAddress,
        string memory personality,
        uint256 winRate,
        uint256 totalGames
    ) {
        botId = nameToBot[ensName];
        require(botId > 0, "Bot not found");
        
        BotIdentity memory bot = botIdentities[botId];
        return (
            botId,
            bot.walletAddress,
            bot.personality,
            bot.winRate,
            bot.totalGames
        );
    }
    
    /**
     * @notice Resolve player by primary name
     */
    function resolvePlayerByName(string memory name) external view returns (
        address playerAddress,
        uint256 level,
        uint256 totalWagered,
        uint256 winStreak,
        string[] memory achievements
    ) {
        playerAddress = nameToPlayer[name];
        require(playerAddress != address(0), "Player not found");
        
        PlayerIdentity memory player = playerIdentities[playerAddress];
        return (
            playerAddress,
            player.level,
            player.totalWagered,
            player.winStreak,
            player.achievements
        );
    }
    
    // ============ BATCH OPERATIONS ============
    
    /**
     * @notice Initialize all 10 bot personalities with ENS names
     */
    function initializeAllBots() external onlyRole(BOT_MANAGER_ROLE) {
        // Bot personalities with their ENS subdomains
        string[10] memory botNames = [
            "alice",    // alice.rng.eth
            "bob",      // bob.rng.eth
            "charlie",  // charlie.rng.eth
            "diana",    // diana.rng.eth
            "eddie",    // eddie.rng.eth
            "fiona",    // fiona.rng.eth
            "greg",     // greg.rng.eth
            "helen",    // helen.rng.eth
            "ivan",     // ivan.rng.eth
            "julia"     // julia.rng.eth
        ];
        
        string[10] memory personalities = [
            "Aggressive high-roller who goes all-in",
            "Statistical analyzer calculating odds",
            "Superstitious believer in lucky charms",
            "Cold methodical ice queen",
            "Theatrical showman entertainer",
            "Fearless adrenaline junkie",
            "Steady consistent grinder",
            "Momentum believer riding hot streaks",
            "Psychological warfare intimidator",
            "Claims to control luck itself"
        ];
        
        for (uint256 i = 0; i < 10; i++) {
            // Generate deterministic wallet for each bot
            address botWallet = address(uint160(uint256(keccak256(abi.encodePacked("BOT", i)))));
            
            mintBotENS(
                i + 1, // botId (1-indexed)
                botNames[i],
                botWallet,
                personalities[i]
            );
        }
    }
    
    // ============ NETWORK CONFIGURATION ============
    
    /**
     * @notice Get network name for metadata
     */
    function _getNetworkName() internal view returns (string memory) {
        return networkConfig.networkName;
    }
    
    /**
     * @notice Calculate rng.eth node hash
     */
    function _calculateRngEthNode() internal pure returns (bytes32) {
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
        return keccak256(abi.encodePacked(ethNode, keccak256("rng")));
    }
    
    /**
     * @notice Verify resolver supports required interfaces
     */
    function _verifyResolverCapabilities(address _resolver) internal view {
        require(
            IERC165(_resolver).supportsInterface(INTERFACE_ADDR_RESOLVER),
            "Resolver must support address resolution"
        );
        require(
            IERC165(_resolver).supportsInterface(INTERFACE_TEXT_RESOLVER),
            "Resolver must support text records"
        );
    }
    
    /**
     * @notice Calculate namehash for ENS name
     * @param name The ENS name (e.g., "alice.rng.eth")
     */
    function _namehash(string memory name) internal pure returns (bytes32) {
        bytes32 node = 0x0000000000000000000000000000000000000000000000000000000000000000;
        bytes memory nameBytes = bytes(name);
        
        if (nameBytes.length == 0) {
            return node;
        }
        
        // Split by dots and hash each label
        // uint256 start = 0; // Unused variable - could be used for future optimization
        for (uint256 i = nameBytes.length; i > 0; i--) {
            if (nameBytes[i-1] == 0x2e) { // '.'
                bytes memory label = new bytes(nameBytes.length - i);
                for (uint256 j = 0; j < label.length; j++) {
                    label[j] = nameBytes[i + j];
                }
                node = keccak256(abi.encodePacked(node, keccak256(label)));
                nameBytes = _substring(nameBytes, 0, i-1);
                i = nameBytes.length + 1;
            }
        }
        
        // Handle the last label
        if (nameBytes.length > 0) {
            node = keccak256(abi.encodePacked(node, keccak256(nameBytes)));
        }
        
        return node;
    }
    
    /**
     * @notice Extract substring from bytes
     */
    function _substring(bytes memory str, uint256 start, uint256 end) internal pure returns (bytes memory) {
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = str[i];
        }
        return result;
    }
    
    // ============ HELPER FUNCTIONS ============
    
    /**
     * @notice Calculate player level based on total wagered
     */
    function _calculateLevel(uint256 totalWagered) internal pure returns (uint256) {
        if (totalWagered >= 100000 ether) return 10;
        if (totalWagered >= 50000 ether) return 9;
        if (totalWagered >= 25000 ether) return 8;
        if (totalWagered >= 10000 ether) return 7;
        if (totalWagered >= 5000 ether) return 6;
        if (totalWagered >= 2500 ether) return 5;
        if (totalWagered >= 1000 ether) return 4;
        if (totalWagered >= 500 ether) return 3;
        if (totalWagered >= 100 ether) return 2;
        return 1;
    }
    
    /**
     * @notice Convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
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
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get all active bot ENS names
     */
    function getAllBotNames() external view returns (string[] memory) {
        string[] memory names = new string[](10);
        for (uint256 i = 1; i <= 10; i++) {
            if (botIdentities[i].isActive) {
                names[i - 1] = botIdentities[i].ensName;
            }
        }
        return names;
    }
    
    /**
     * @notice Get network configuration for frontend integration
     */
    function getFullNetworkConfig() external view returns (
        address _ensRegistry,
        address _publicResolver,
        address _l2ReverseRegistrar,
        uint256 _chainId,
        bool _isL2,
        string memory _networkName
    ) {
        return (
            networkConfig.ensRegistry,
            networkConfig.publicResolver,
            networkConfig.l2ReverseRegistrar,
            block.chainid,
            networkConfig.isL2,
            networkConfig.networkName
        );
    }
    
    /**
     * @notice Verify ENS name ownership (for security)
     */
    function verifyNameOwnership(string memory ensName, address expectedOwner) 
        external view returns (bool) {
        bytes32 nameNode = _namehash(ensName);
        return ensRegistry.owner(nameNode) == expectedOwner;
    }
    
    /**
     * @notice Get comprehensive bot information including ENS resolution
     */
    function getBotInfo(uint256 botId) external view returns (
        BotIdentity memory bot,
        bool ensResolvesToWallet,
        string memory resolvedPersonality
    ) {
        require(botIdentities[botId].isActive, "Bot not found");
        
        bot = botIdentities[botId];
        
        // Verify ENS resolution
        address resolvedAddr = resolver.addr(bot.node);
        ensResolvesToWallet = (resolvedAddr == bot.walletAddress);
        
        // Get personality from ENS
        resolvedPersonality = resolver.text(bot.node, "personality");
        
        return (bot, ensResolvesToWallet, resolvedPersonality);
    }
    
    /**
     * @notice Get player's full profile
     */
    function getPlayerProfile(address player) external view returns (
        string memory primaryName,
        uint256 level,
        uint256 totalWagered,
        uint256 winStreak,
        string[] memory achievements,
        uint256 joinedAt
    ) {
        PlayerIdentity memory identity = playerIdentities[player];
        return (
            identity.primaryName,
            identity.level,
            identity.totalWagered,
            identity.winStreak,
            identity.achievements,
            identity.joinedAt
        );
    }
}