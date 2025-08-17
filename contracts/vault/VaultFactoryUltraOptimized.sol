// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/VaultFactoryLib.sol";
import "../libraries/VaultDeploymentLib.sol";

/**
 * @title VaultFactoryUltraOptimized
 * @notice Ultra-optimized factory for bot vaults (under 24KB)
 * @dev Maximum logic extracted to libraries
 */
contract VaultFactoryUltraOptimized is AccessControl {
    // Roles
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    // Core state
    uint256 public nextBotId;
    IERC20 public immutable defaultAsset;
    address public treasuryAddress;
    address public gameContract;
    address public botManagerContract;
    
    // Mappings
    mapping(uint256 => VaultFactoryLib.VaultInfo) public vaults;
    mapping(uint256 => VaultFactoryLib.BotConfig) public botConfigs;
    mapping(address => uint256) public vaultToBotId;
    mapping(string => bool) public botNameExists;
    address[] public allVaults;
    
    // Events
    event VaultDeactivated(uint256 indexed botId);
    event VaultReactivated(uint256 indexed botId);
    event BotConfigUpdated(uint256 indexed botId);
    event ContractUpdated(string contractType, address indexed newAddress);
    
    constructor(IERC20 _asset, address _treasury) {
        defaultAsset = _asset;
        treasuryAddress = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Deploy single vault
     */
    function deployVault(
        string memory botName,
        address manager,
        address asset,
        VaultFactoryLib.BotConfig memory config
    ) external onlyRole(DEPLOYER_ROLE) returns (address vault) {
        require(nextBotId < 10 && !botNameExists[botName], "Invalid");
        
        uint256 botId = nextBotId++;
        IERC20 vaultAsset = asset == address(0) ? defaultAsset : IERC20(asset);
        
        VaultFactoryLib.VaultInfo memory info;
        (vault, info) = VaultDeploymentLib.deploySingleVault(
            botId,
            botName,
            manager,
            vaultAsset,
            config
        );
        
        vaults[botId] = info;
        botConfigs[botId] = config;
        vaultToBotId[vault] = botId;
        botNameExists[botName] = true;
        allVaults.push(vault);
        
        VaultFactoryLib.grantVaultRoles(vault, gameContract, botManagerContract, treasuryAddress);
    }
    
    /**
     * @notice Deploy all 10 bots
     */
    function deployAllBots() external onlyRole(DEPLOYER_ROLE) {
        require(nextBotId == 0, "Already deployed");
        
        address[10] memory vaultAddrs;
        VaultFactoryLib.VaultInfo[10] memory infos;
        VaultFactoryLib.BotConfig[10] memory configs;
        
        (vaultAddrs, infos, configs) = VaultDeploymentLib.deployAllBotVaults(
            defaultAsset,
            msg.sender
        );
        
        for (uint256 i = 0; i < 10; i++) {
            vaults[i] = infos[i];
            botConfigs[i] = configs[i];
            vaultToBotId[vaultAddrs[i]] = i;
            botNameExists[infos[i].botName] = true;
            allVaults.push(vaultAddrs[i]);
        }
        
        nextBotId = 10;
        
        // Grant roles in batch
        VaultDeploymentLib.grantRolesToVaults(
            allVaults,
            gameContract,
            botManagerContract,
            treasuryAddress
        );
    }
    
    /**
     * @notice Update bot config
     */
    function updateBotConfig(
        uint256 botId,
        uint256 minBet,
        uint256 maxBet,
        uint8 aggr,
        uint8 risk
    ) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid");
        botConfigs[botId].minBet = minBet;
        botConfigs[botId].maxBet = maxBet;
        botConfigs[botId].aggressiveness = aggr;
        botConfigs[botId].riskTolerance = risk;
        emit BotConfigUpdated(botId);
    }
    
    /**
     * @notice Update contracts
     */
    function updateContract(string memory cType, address addr) external onlyRole(MANAGER_ROLE) {
        bytes32 h = keccak256(bytes(cType));
        if (h == keccak256("game")) gameContract = addr;
        else if (h == keccak256("botManager")) botManagerContract = addr;
        else if (h == keccak256("treasury")) treasuryAddress = addr;
        else revert("Unknown");
        emit ContractUpdated(cType, addr);
    }
    
    // View functions
    function getVault(uint256 botId) external view returns (address) {
        return vaults[botId].vaultAddress;
    }
    
    function getActiveVaults() external view returns (address[] memory) {
        uint256 count;
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) count++;
        }
        
        address[] memory active = new address[](count);
        uint256 index;
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) active[index++] = vaults[i].vaultAddress;
        }
        return active;
    }
    
    function getBotConfig(uint256 botId) external view returns (VaultFactoryLib.BotConfig memory) {
        return botConfigs[botId];
    }
    
    function getBotPersonalities() external pure returns (string[10] memory) {
        return VaultFactoryLib.getBotPersonalities();
    }
    
    function getVaultConfig(uint256 botId) external view returns (
        string memory name,
        uint256 minBet,
        uint256 maxBet,
        uint8 aggressiveness,
        uint8 riskTolerance
    ) {
        VaultFactoryLib.BotConfig memory c = botConfigs[botId];
        return (c.name, c.minBet, c.maxBet, c.aggressiveness, c.riskTolerance);
    }
}