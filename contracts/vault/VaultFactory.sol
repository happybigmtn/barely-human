// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CrapsVault.sol";

/**
 * @title VaultFactory
 * @notice Factory contract for deploying bot vaults
 * @dev Manages creation and tracking of all bot vaults
 */
contract VaultFactory is AccessControl {
    // Roles
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    // Bot configuration
    struct BotConfig {
        string name;
        address manager;
        uint256 minBet;
        uint256 maxBet;
        uint8 aggressiveness; // 0-100 scale
        uint8 riskTolerance;  // 0-100 scale
        string personality;    // Description of bot personality
    }
    
    // Vault tracking
    struct VaultInfo {
        address vaultAddress;
        address asset;
        uint256 botId;
        string botName;
        uint256 deployedAt;
        bool isActive;
    }
    
    // State variables
    uint256 public constant MAX_BOTS = 10;
    uint256 public nextBotId;
    
    mapping(uint256 => VaultInfo) public vaults;
    mapping(address => uint256) public vaultToBotId;
    mapping(string => bool) public botNameExists;
    mapping(uint256 => BotConfig) public botConfigs;
    
    address[] public allVaults;
    
    // Default asset for vaults (can be USDC or WETH)
    IERC20 public defaultAsset;
    
    // Connected contracts
    address public gameContract;
    address public botManagerContract;
    address public treasuryAddress;
    
    // Events
    event VaultCreated(
        uint256 indexed botId,
        address indexed vault,
        string botName,
        address asset,
        address manager
    );
    event VaultDeactivated(uint256 indexed botId);
    event VaultReactivated(uint256 indexed botId);
    event BotConfigUpdated(uint256 indexed botId);
    event DefaultAssetUpdated(address indexed newAsset);
    event TreasuryUpdated(address indexed newTreasury);
    
    /**
     * @notice Constructor
     * @param _defaultAsset The default asset for vaults
     * @param _treasuryAddress The treasury address for fees
     */
    constructor(IERC20 _defaultAsset, address _treasuryAddress) {
        require(address(_defaultAsset) != address(0), "Invalid asset");
        require(_treasuryAddress != address(0), "Invalid treasury");
        
        defaultAsset = _defaultAsset;
        treasuryAddress = _treasuryAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Deploy a new vault for a bot
     * @param botName The name of the bot
     * @param manager The address managing the bot
     * @param asset The asset for the vault (use address(0) for default)
     * @param config The bot configuration
     * @return vault The deployed vault address
     */
    function deployVault(
        string memory botName,
        address manager,
        address asset,
        BotConfig memory config
    ) external onlyRole(DEPLOYER_ROLE) returns (address vault) {
        return _deployVault(botName, manager, asset, config);
    }
    
    /**
     * @notice Internal function to deploy a new vault
     */
    function _deployVault(
        string memory botName,
        address manager,
        address asset,
        BotConfig memory config
    ) internal returns (address vault) {
        require(nextBotId < MAX_BOTS, "Max bots reached");
        require(bytes(botName).length > 0, "Invalid bot name");
        require(!botNameExists[botName], "Bot name exists");
        require(manager != address(0), "Invalid manager");
        
        // Use default asset if none specified
        IERC20 vaultAsset = asset == address(0) ? defaultAsset : IERC20(asset);
        
        uint256 botId = nextBotId++;
        
        // Deploy new vault
        CrapsVault newVault = new CrapsVault(
            vaultAsset,
            botId,
            botName,
            manager
        );
        
        vault = address(newVault);
        
        // Store vault info
        vaults[botId] = VaultInfo({
            vaultAddress: vault,
            asset: address(vaultAsset),
            botId: botId,
            botName: botName,
            deployedAt: block.timestamp,
            isActive: true
        });
        
        // Store bot config
        config.name = botName;
        config.manager = manager;
        botConfigs[botId] = config;
        
        // Update mappings
        vaultToBotId[vault] = botId;
        botNameExists[botName] = true;
        allVaults.push(vault);
        
        // Grant roles
        if (gameContract != address(0)) {
            newVault.grantRole(newVault.GAME_ROLE(), gameContract);
        }
        if (botManagerContract != address(0)) {
            newVault.grantRole(newVault.MANAGER_ROLE(), botManagerContract);
        }
        if (treasuryAddress != address(0)) {
            newVault.grantRole(newVault.FEE_COLLECTOR_ROLE(), treasuryAddress);
        }
        
        emit VaultCreated(botId, vault, botName, address(vaultAsset), manager);
        
        return vault;
    }
    
    /**
     * @notice Deploy all 10 bot vaults with predefined personalities
     */
    function deployAllBots() external onlyRole(DEPLOYER_ROLE) {
        require(nextBotId == 0, "Bots already deployed");
        
        // Define the 10 bot personalities
        string[10] memory names = [
            "Lucky", "Dice Devil", "Risk Taker", "Calculator",
            "Zen Master", "Hot Shot", "Cool Hand", "Wild Card",
            "Steady Eddie", "Maverick"
        ];
        
        string[10] memory personalities = [
            "Optimistic and believes in lucky streaks",
            "Aggressive player who loves high-risk bets",
            "Calculated risk-taker with strategic approach",
            "Mathematical player focused on odds",
            "Calm and patient, waits for the right moment",
            "Confident shooter who bets big on hot streaks",
            "Cool under pressure, makes smart bets",
            "Unpredictable and chaotic betting style",
            "Consistent and conservative approach",
            "Independent thinker with unconventional strategies"
        ];
        
        uint8[10] memory aggressiveness = [
            30, 90, 70, 40, 20, 85, 50, 95, 15, 75
        ];
        
        uint8[10] memory riskTolerance = [
            40, 95, 80, 30, 25, 90, 45, 100, 10, 85
        ];
        
        for (uint256 i = 0; i < 10; i++) {
            BotConfig memory config = BotConfig({
                name: names[i],
                manager: msg.sender, // Initial manager, can be updated
                minBet: 0.001 ether,
                maxBet: 1 ether,
                aggressiveness: aggressiveness[i],
                riskTolerance: riskTolerance[i],
                personality: personalities[i]
            });
            
            _deployVault(
                names[i],
                msg.sender,
                address(0), // Use default asset
                config
            );
        }
    }
    
    /**
     * @notice Update bot configuration
     */
    function updateBotConfig(
        uint256 botId,
        uint256 minBet,
        uint256 maxBet,
        uint8 aggressiveness,
        uint8 riskTolerance
    ) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid bot ID");
        require(aggressiveness <= 100, "Invalid aggressiveness");
        require(riskTolerance <= 100, "Invalid risk tolerance");
        
        BotConfig storage config = botConfigs[botId];
        config.minBet = minBet;
        config.maxBet = maxBet;
        config.aggressiveness = aggressiveness;
        config.riskTolerance = riskTolerance;
        
        emit BotConfigUpdated(botId);
    }
    
    /**
     * @notice Deactivate a vault
     */
    function deactivateVault(uint256 botId) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid bot ID");
        require(vaults[botId].isActive, "Already inactive");
        
        vaults[botId].isActive = false;
        
        // Pause the vault
        CrapsVault(vaults[botId].vaultAddress).pause();
        
        emit VaultDeactivated(botId);
    }
    
    /**
     * @notice Reactivate a vault
     */
    function reactivateVault(uint256 botId) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid bot ID");
        require(!vaults[botId].isActive, "Already active");
        
        vaults[botId].isActive = true;
        
        // Unpause the vault
        CrapsVault(vaults[botId].vaultAddress).unpause();
        
        emit VaultReactivated(botId);
    }
    
    /**
     * @notice Set game contract address
     */
    function setGameContract(address _gameContract) external onlyRole(MANAGER_ROLE) {
        require(_gameContract != address(0), "Invalid address");
        gameContract = _gameContract;
        
        // Grant game role to all existing vaults
        for (uint256 i = 0; i < allVaults.length; i++) {
            CrapsVault vault = CrapsVault(allVaults[i]);
            vault.grantRole(vault.GAME_ROLE(), _gameContract);
        }
    }
    
    /**
     * @notice Set bot manager contract address
     */
    function setBotManagerContract(address _botManagerContract) external onlyRole(MANAGER_ROLE) {
        require(_botManagerContract != address(0), "Invalid address");
        botManagerContract = _botManagerContract;
        
        // Grant manager role to all existing vaults
        for (uint256 i = 0; i < allVaults.length; i++) {
            CrapsVault vault = CrapsVault(allVaults[i]);
            vault.grantRole(vault.MANAGER_ROLE(), _botManagerContract);
        }
    }
    
    /**
     * @notice Update treasury address
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasuryAddress != address(0), "Invalid address");
        treasuryAddress = _treasuryAddress;
        
        // Update fee collector role for all vaults
        for (uint256 i = 0; i < allVaults.length; i++) {
            CrapsVault vault = CrapsVault(allVaults[i]);
            vault.grantRole(vault.FEE_COLLECTOR_ROLE(), _treasuryAddress);
        }
        
        emit TreasuryUpdated(_treasuryAddress);
    }
    
    /**
     * @notice Update default asset
     */
    function setDefaultAsset(IERC20 _defaultAsset) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(_defaultAsset) != address(0), "Invalid asset");
        defaultAsset = _defaultAsset;
        emit DefaultAssetUpdated(address(_defaultAsset));
    }
    
    /**
     * @notice Get vault by bot ID
     */
    function getVault(uint256 botId) external view returns (address) {
        require(botId < nextBotId, "Invalid bot ID");
        return vaults[botId].vaultAddress;
    }
    
    /**
     * @notice Get all active vaults
     */
    function getActiveVaults() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) {
                activeCount++;
            }
        }
        
        address[] memory activeVaults = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) {
                activeVaults[index++] = vaults[i].vaultAddress;
            }
        }
        
        return activeVaults;
    }
    
    /**
     * @notice Get bot configuration
     */
    function getBotConfig(uint256 botId) external view returns (BotConfig memory) {
        require(botId < nextBotId, "Invalid bot ID");
        return botConfigs[botId];
    }
    
    /**
     * @notice Get total value locked across all vaults
     */
    function getTotalValueLocked() external view returns (uint256 total) {
        for (uint256 i = 0; i < allVaults.length; i++) {
            CrapsVault vault = CrapsVault(allVaults[i]);
            if (vaults[vaultToBotId[allVaults[i]]].isActive) {
                total += vault.totalAssets();
            }
        }
    }
    
    /**
     * @notice Get aggregated statistics across all vaults
     */
    function getAggregateStats() external view returns (
        uint256 totalTVL,
        uint256 totalLocked,
        uint256 totalProfit,
        uint256 totalFees,
        uint256 totalLPs,
        uint256 activeVaultCount
    ) {
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) {
                CrapsVault vault = CrapsVault(vaults[i].vaultAddress);
                (
                    uint256 tvl,
                    ,
                    uint256 locked,
                    uint256 profit,
                    uint256 fees,
                    uint256 lpCount
                ) = vault.getVaultStats();
                
                totalTVL += tvl;
                totalLocked += locked;
                totalProfit += profit;
                totalFees += fees;
                totalLPs += lpCount;
                activeVaultCount++;
            }
        }
    }
}