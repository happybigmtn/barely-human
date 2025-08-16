// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CrapsVault.sol";
import "../libraries/VaultFactoryLib.sol";

/**
 * @title VaultFactoryOptimized
 * @notice Optimized factory contract for deploying bot vaults
 * @dev Uses library to reduce contract size below 24KB limit
 */
contract VaultFactoryOptimized is AccessControl {
    using VaultFactoryLib for mapping(uint256 => VaultFactoryLib.VaultInfo);
    
    // Roles
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    // State variables
    uint256 public constant MAX_BOTS = 10;
    uint256 public nextBotId;
    
    mapping(uint256 => VaultFactoryLib.VaultInfo) public vaults;
    mapping(address => uint256) public vaultToBotId;
    mapping(string => bool) public botNameExists;
    mapping(uint256 => VaultFactoryLib.BotConfig) public botConfigs;
    
    address[] public allVaults;
    
    IERC20 public defaultAsset;
    address public gameContract;
    address public botManagerContract;
    address public treasuryAddress;
    
    // Events
    event VaultCreated(uint256 indexed botId, address indexed vault, string botName);
    event VaultDeactivated(uint256 indexed botId);
    event VaultReactivated(uint256 indexed botId);
    event BotConfigUpdated(uint256 indexed botId);
    event ContractUpdated(string contractType, address indexed newAddress);
    
    constructor(IERC20 _defaultAsset, address _treasuryAddress) {
        require(address(_defaultAsset) != address(0) && _treasuryAddress != address(0), "Invalid params");
        
        defaultAsset = _defaultAsset;
        treasuryAddress = _treasuryAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Deploy a new vault for a bot
     */
    function deployVault(
        string memory botName,
        address manager,
        address asset,
        VaultFactoryLib.BotConfig memory config
    ) external onlyRole(DEPLOYER_ROLE) returns (address vault) {
        require(nextBotId < MAX_BOTS && bytes(botName).length > 0, "Invalid params");
        require(!botNameExists[botName] && manager != address(0), "Invalid name/manager");
        
        IERC20 vaultAsset = asset == address(0) ? defaultAsset : IERC20(asset);
        uint256 botId = nextBotId++;
        
        // Deploy vault
        CrapsVault newVault = new CrapsVault(vaultAsset, botId, botName, manager);
        vault = address(newVault);
        
        // Store info
        vaults[botId] = VaultFactoryLib.VaultInfo({
            vaultAddress: vault,
            asset: address(vaultAsset),
            botId: botId,
            botName: botName,
            deployedAt: block.timestamp,
            isActive: true
        });
        
        config.name = botName;
        config.manager = manager;
        botConfigs[botId] = config;
        
        vaultToBotId[vault] = botId;
        botNameExists[botName] = true;
        allVaults.push(vault);
        
        // Grant roles using library
        VaultFactoryLib.grantVaultRoles(vault, gameContract, botManagerContract, treasuryAddress);
        
        emit VaultCreated(botId, vault, botName);
    }
    
    /**
     * @notice Deploy all 10 bot vaults with predefined personalities
     */
    function deployAllBots() external onlyRole(DEPLOYER_ROLE) {
        require(nextBotId == 0, "Already deployed");
        
        string[10] memory names = VaultFactoryLib.getBotNames();
        string[10] memory personalities = VaultFactoryLib.getBotPersonalities();
        uint8[10] memory aggressiveness = VaultFactoryLib.getBotAggressiveness();
        uint8[10] memory riskTolerance = VaultFactoryLib.getBotRiskTolerance();
        
        for (uint256 i = 0; i < 10; i++) {
            uint256 botId = nextBotId++;
            
            CrapsVault vault = new CrapsVault(defaultAsset, botId, names[i], msg.sender);
            address vaultAddr = address(vault);
            
            vaults[botId] = VaultFactoryLib.VaultInfo({
                vaultAddress: vaultAddr,
                asset: address(defaultAsset),
                botId: botId,
                botName: names[i],
                deployedAt: block.timestamp,
                isActive: true
            });
            
            botConfigs[botId] = VaultFactoryLib.BotConfig({
                name: names[i],
                manager: msg.sender,
                minBet: 0.001 ether,
                maxBet: 1 ether,
                aggressiveness: aggressiveness[i],
                riskTolerance: riskTolerance[i],
                personality: personalities[i]
            });
            
            vaultToBotId[vaultAddr] = botId;
            botNameExists[names[i]] = true;
            allVaults.push(vaultAddr);
            
            VaultFactoryLib.grantVaultRoles(vaultAddr, gameContract, botManagerContract, treasuryAddress);
            
            emit VaultCreated(botId, vaultAddr, names[i]);
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
        require(botId < nextBotId && aggressiveness <= 100 && riskTolerance <= 100, "Invalid params");
        
        VaultFactoryLib.BotConfig storage config = botConfigs[botId];
        config.minBet = minBet;
        config.maxBet = maxBet;
        config.aggressiveness = aggressiveness;
        config.riskTolerance = riskTolerance;
        
        emit BotConfigUpdated(botId);
    }
    
    /**
     * @notice Toggle vault active status
     */
    function toggleVaultStatus(uint256 botId) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid bot ID");
        
        VaultFactoryLib.VaultInfo storage vault = vaults[botId];
        vault.isActive = !vault.isActive;
        
        CrapsVault crapsVault = CrapsVault(vault.vaultAddress);
        if (vault.isActive) {
            crapsVault.unpause();
            emit VaultReactivated(botId);
        } else {
            crapsVault.pause();
            emit VaultDeactivated(botId);
        }
    }
    
    /**
     * @notice Update contract addresses and grant roles
     */
    function updateContract(string memory contractType, address newAddress) external onlyRole(MANAGER_ROLE) {
        require(newAddress != address(0), "Invalid address");
        
        bytes32 typeHash = keccak256(bytes(contractType));
        
        if (typeHash == keccak256("game")) {
            gameContract = newAddress;
            _updateAllVaultRoles(0);
        } else if (typeHash == keccak256("botManager")) {
            botManagerContract = newAddress;
            _updateAllVaultRoles(1);
        } else if (typeHash == keccak256("treasury")) {
            treasuryAddress = newAddress;
            _updateAllVaultRoles(2);
        } else {
            revert("Unknown contract type");
        }
        
        emit ContractUpdated(contractType, newAddress);
    }
    
    /**
     * @notice Internal function to update vault roles
     */
    function _updateAllVaultRoles(uint8 roleType) private {
        for (uint256 i = 0; i < allVaults.length; i++) {
            CrapsVault vault = CrapsVault(allVaults[i]);
            
            if (roleType == 0 && gameContract != address(0)) {
                vault.grantRole(vault.GAME_ROLE(), gameContract);
            } else if (roleType == 1 && botManagerContract != address(0)) {
                vault.grantRole(vault.MANAGER_ROLE(), botManagerContract);
            } else if (roleType == 2 && treasuryAddress != address(0)) {
                vault.grantRole(vault.FEE_COLLECTOR_ROLE(), treasuryAddress);
            }
        }
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
        uint256 count = vaults.countActiveVaults(nextBotId);
        return vaults.collectActiveVaults(nextBotId, count);
    }
    
    /**
     * @notice Get bot configuration
     */
    function getBotConfig(uint256 botId) external view returns (VaultFactoryLib.BotConfig memory) {
        require(botId < nextBotId, "Invalid bot ID");
        return botConfigs[botId];
    }
    
    /**
     * @notice Get total value locked across all vaults
     */
    function getTotalValueLocked() external view returns (uint256 total) {
        for (uint256 i = 0; i < allVaults.length; i++) {
            address vault = allVaults[i];
            if (vaults[vaultToBotId[vault]].isActive) {
                total += CrapsVault(vault).totalAssets();
            }
        }
    }
}