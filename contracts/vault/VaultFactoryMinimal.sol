// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CrapsVault.sol";

/**
 * @title VaultFactoryMinimal
 * @notice Minimal factory for deploying bot vaults - optimized for size
 * @dev Stripped down version to fit under 24KB limit
 */
contract VaultFactoryMinimal is AccessControl {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    
    uint256 public constant MAX_BOTS = 10;
    uint256 public nextBotId;
    
    IERC20 public immutable defaultAsset;
    address public immutable treasuryAddress;
    address public gameAddress;
    address public botManager;
    
    mapping(uint256 => address) public botVaults;
    address[] public allVaults;
    
    event VaultDeployed(uint256 indexed botId, address indexed vault);
    event BotManagerSet(address indexed botManager);
    event GameAddressSet(address indexed gameAddress);
    
    constructor(IERC20 _defaultAsset, address _treasuryAddress) {
        require(address(_defaultAsset) != address(0) && _treasuryAddress != address(0), "Invalid params");
        
        defaultAsset = _defaultAsset;
        treasuryAddress = _treasuryAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
    }
    
    function setBotManager(address _botManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_botManager != address(0), "Invalid address");
        botManager = _botManager;
        emit BotManagerSet(_botManager);
    }
    
    function setGameAddress(address _gameAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameAddress != address(0), "Invalid address");
        gameAddress = _gameAddress;
        emit GameAddressSet(_gameAddress);
    }
    
    function deployVault(uint256 botId) public onlyRole(DEPLOYER_ROLE) returns (address) {
        require(botId < MAX_BOTS, "Invalid bot ID");
        require(botVaults[botId] == address(0), "Already deployed");
        require(botManager != address(0), "Bot manager not set");
        
        string memory name = getBotName(botId);
        
        CrapsVault vault = new CrapsVault(
            defaultAsset,
            botId,
            name,
            botManager
        );
        
        botVaults[botId] = address(vault);
        allVaults.push(address(vault));
        
        if (botId >= nextBotId) {
            nextBotId = botId + 1;
        }
        
        emit VaultDeployed(botId, address(vault));
        return address(vault);
    }
    
    function deployAllBots() external onlyRole(DEPLOYER_ROLE) {
        for (uint256 i = 0; i < MAX_BOTS; i++) {
            if (botVaults[i] == address(0)) {
                deployVault(i);
            }
        }
    }
    
    function getBotVault(uint8 botId) external view returns (address) {
        return botVaults[botId];
    }
    
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }
    
    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }
    
    function getBotName(uint256 botId) internal pure returns (string memory) {
        if (botId == 0) return "Alice";
        if (botId == 1) return "Bob";
        if (botId == 2) return "Charlie";
        if (botId == 3) return "Diana";
        if (botId == 4) return "Eddie";
        if (botId == 5) return "Fiona";
        if (botId == 6) return "Greg";
        if (botId == 7) return "Helen";
        if (botId == 8) return "Ivan";
        if (botId == 9) return "Julia";
        return "Unknown";
    }
    
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}