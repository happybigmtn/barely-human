// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CrapsVault.sol";
import "../libraries/VaultFactoryLib.sol";

/**
 * @title VaultFactoryMinimal
 * @notice Minimal factory contract for deploying bot vaults (under 24KB limit)
 */
contract VaultFactoryMinimal is AccessControl {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    uint256 public constant MAX_BOTS = 10;
    uint256 public nextBotId;
    
    mapping(uint256 => VaultFactoryLib.VaultInfo) public vaults;
    mapping(address => uint256) public vaultToBotId;
    mapping(uint256 => VaultFactoryLib.BotConfig) public botConfigs;
    
    address[] public allVaults;
    
    IERC20 public defaultAsset;
    address public gameContract;
    address public botManagerContract;
    address public treasuryAddress;
    
    event VaultCreated(uint256 indexed botId, address indexed vault, string botName);
    event VaultStatusChanged(uint256 indexed botId, bool active);
    
    constructor(IERC20 _defaultAsset, address _treasuryAddress) {
        require(address(_defaultAsset) != address(0), "Invalid asset");
        defaultAsset = _defaultAsset;
        treasuryAddress = _treasuryAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
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
                minBet: 10 * 10**18,
                maxBet: 1000 * 10**18,
                aggressiveness: aggressiveness[i],
                riskTolerance: riskTolerance[i],
                personality: personalities[i]
            });
            
            vaultToBotId[vaultAddr] = botId;
            allVaults.push(vaultAddr);
            
            VaultFactoryLib.grantVaultRoles(vaultAddr, gameContract, botManagerContract, treasuryAddress);
            
            emit VaultCreated(botId, vaultAddr, names[i]);
        }
    }
    
    function setGameContract(address _game) external onlyRole(MANAGER_ROLE) {
        gameContract = _game;
        _updateAllVaultRoles(1);
    }
    
    function setBotManager(address _manager) external onlyRole(MANAGER_ROLE) {
        botManagerContract = _manager;
        _updateAllVaultRoles(2);
    }
    
    function setTreasury(address _treasury) external onlyRole(MANAGER_ROLE) {
        treasuryAddress = _treasury;
        _updateAllVaultRoles(3);
    }
    
    function toggleVaultStatus(uint256 botId) external onlyRole(MANAGER_ROLE) {
        require(botId < nextBotId, "Invalid bot ID");
        vaults[botId].isActive = !vaults[botId].isActive;
        emit VaultStatusChanged(botId, vaults[botId].isActive);
    }
    
    function _updateAllVaultRoles(uint8 roleType) private {
        for (uint256 i = 0; i < nextBotId; i++) {
            address vaultAddr = vaults[i].vaultAddress;
            if (vaultAddr != address(0)) {
                CrapsVault vault = CrapsVault(vaultAddr);
                
                if (roleType == 1 && gameContract != address(0)) {
                    vault.grantRole(vault.GAME_ROLE(), gameContract);
                } else if (roleType == 2 && botManagerContract != address(0)) {
                    vault.grantRole(vault.MANAGER_ROLE(), botManagerContract);
                } else if (roleType == 3 && treasuryAddress != address(0)) {
                    vault.grantRole(vault.FEE_COLLECTOR_ROLE(), treasuryAddress);
                }
            }
        }
    }
    
    // Essential getters only
    function getVault(uint256 botId) external view returns (address) {
        return vaults[botId].vaultAddress;
    }
    
    function getVaultCount() external view returns (uint256) {
        return nextBotId;
    }
    
    function treasury() external view returns (address) {
        return treasuryAddress;
    }
}