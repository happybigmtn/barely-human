// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title VaultFactoryProxy
 * @notice UUPS proxy for VaultFactory to solve contract size issues
 * @dev Implements proper upgrade pattern as recommended by senior review
 */
contract VaultFactoryProxy is ERC1967Proxy {
    constructor(
        address _implementation,
        bytes memory _data
    ) ERC1967Proxy(_implementation, _data) {}
}

/**
 * @title VaultFactoryImplementation
 * @notice Upgradeable implementation of VaultFactory
 * @dev Uses UUPS pattern for gas-efficient upgrades
 */
contract VaultFactoryImplementation is 
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    // Storage layout must be carefully maintained for upgrades
    struct VaultInfo {
        address vault;
        uint256 botId;
        bool isActive;
        uint256 totalDeposits;
        uint256 totalBets;
        uint256 netPnL;
    }

    struct BotConfig {
        string name;
        uint8 aggressiveness;
        uint8 riskTolerance;
        uint256 minBet;
        uint256 maxBet;
    }

    // Storage variables
    uint256 public constant MAX_BOTS = 10;
    uint256 public nextBotId;
    
    mapping(uint256 => VaultInfo) public vaults;
    mapping(address => uint256) public vaultToBotId;
    mapping(uint256 => BotConfig) public botConfigs;
    
    address[] public allVaults;
    
    address public defaultAsset;
    address public gameContract;
    address public botManagerContract;
    address public treasuryAddress;
    
    // Events
    event VaultCreated(uint256 indexed botId, address indexed vault, string botName);
    event VaultStatusChanged(uint256 indexed botId, bool active);
    event ContractsUpdated(address game, address botManager);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @dev Called once during deployment via proxy
     */
    function initialize(
        address _defaultAsset,
        address _treasuryAddress
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        require(_defaultAsset != address(0), "Invalid asset");
        require(_treasuryAddress != address(0), "Invalid treasury");
        
        defaultAsset = _defaultAsset;
        treasuryAddress = _treasuryAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Initialize bot configurations
        _initializeBotConfigs();
    }

    /**
     * @notice Deploy all bot vaults in a single transaction
     * @dev Gas-optimized batch deployment
     */
    function deployAllBots() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(nextBotId == 0, "Already deployed");
        
        // Deploy all 10 bots in optimized loop
        for (uint256 i = 0; i < MAX_BOTS;) {
            _deployVault(i);
            unchecked { ++i; } // Gas optimization
        }
    }

    /**
     * @notice Internal function to deploy a single vault
     */
    function _deployVault(uint256 botId) private {
        // Use CREATE2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(botId, block.timestamp));
        
        // Deploy minimal proxy to save gas
        address vault = _deployMinimalProxy(salt);
        
        vaults[botId] = VaultInfo({
            vault: vault,
            botId: botId,
            isActive: true,
            totalDeposits: 0,
            totalBets: 0,
            netPnL: 0
        });
        
        vaultToBotId[vault] = botId;
        allVaults.push(vault);
        
        emit VaultCreated(botId, vault, botConfigs[botId].name);
        
        nextBotId = botId + 1;
    }

    /**
     * @notice Deploy minimal proxy using CREATE2
     */
    function _deployMinimalProxy(bytes32 salt) private returns (address) {
        // Minimal proxy bytecode
        bytes memory bytecode = hex"363d3d373d3d3d363d73";
        bytecode = abi.encodePacked(bytecode, defaultAsset, hex"5af43d82803e903d91602b57fd5bf3");
        
        address proxy;
        assembly {
            proxy := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        require(proxy != address(0), "Proxy deployment failed");
        return proxy;
    }

    /**
     * @notice Initialize bot configurations
     */
    function _initializeBotConfigs() private {
        botConfigs[0] = BotConfig("Alice All-In", 95, 10, 100e18, 10000e18);
        botConfigs[1] = BotConfig("Bob Calculator", 30, 80, 10e18, 1000e18);
        botConfigs[2] = BotConfig("Charlie Lucky", 60, 60, 50e18, 5000e18);
        botConfigs[3] = BotConfig("Diana Ice", 25, 90, 20e18, 2000e18);
        botConfigs[4] = BotConfig("Eddie Show", 70, 40, 100e18, 7500e18);
        botConfigs[5] = BotConfig("Fiona Fearless", 85, 20, 200e18, 10000e18);
        botConfigs[6] = BotConfig("Greg Grinder", 40, 70, 10e18, 500e18);
        botConfigs[7] = BotConfig("Helen Streak", 65, 50, 50e18, 5000e18);
        botConfigs[8] = BotConfig("Ivan Intimidator", 80, 30, 100e18, 8000e18);
        botConfigs[9] = BotConfig("Julia Jinx", 55, 55, 25e18, 2500e18);
    }

    /**
     * @notice Update game and bot manager contracts
     */
    function setContracts(
        address _gameContract,
        address _botManagerContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid game");
        require(_botManagerContract != address(0), "Invalid manager");
        
        gameContract = _gameContract;
        botManagerContract = _botManagerContract;
        
        emit ContractsUpdated(_gameContract, _botManagerContract);
    }

    /**
     * @notice Get vault by bot ID
     */
    function getVault(uint256 botId) external view returns (address) {
        require(botId < nextBotId, "Invalid bot ID");
        return vaults[botId].vault;
    }

    /**
     * @notice Get total number of vaults
     */
    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /**
     * @notice Authorize upgrade (only admin)
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}
}