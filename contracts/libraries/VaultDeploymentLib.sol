// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../vault/CrapsVault.sol";
import "./VaultFactoryLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VaultDeploymentLib
 * @notice Library to handle vault deployment logic
 * @dev Extracted to reduce VaultFactory contract size
 */
library VaultDeploymentLib {
    event VaultCreated(uint256 indexed botId, address indexed vault, string botName);
    
    /**
     * @notice Deploy a single vault with configuration
     */
    function deploySingleVault(
        uint256 botId,
        string memory botName,
        address manager,
        IERC20 asset,
        VaultFactoryLib.BotConfig memory config
    ) external returns (address vault, VaultFactoryLib.VaultInfo memory info) {
        // Deploy vault
        CrapsVault newVault = new CrapsVault(asset, botId, botName, manager);
        vault = address(newVault);
        
        // Create vault info
        info = VaultFactoryLib.VaultInfo({
            vaultAddress: vault,
            asset: address(asset),
            botId: botId,
            botName: botName,
            deployedAt: block.timestamp,
            isActive: true
        });
        
        // Update config
        config.name = botName;
        config.manager = manager;
        
        emit VaultCreated(botId, vault, botName);
    }
    
    /**
     * @notice Deploy all 10 bot vaults
     */
    function deployAllBotVaults(
        IERC20 defaultAsset,
        address deployer
    ) external returns (
        address[10] memory vaultAddresses,
        VaultFactoryLib.VaultInfo[10] memory vaultInfos,
        VaultFactoryLib.BotConfig[10] memory configs
    ) {
        string[10] memory names = VaultFactoryLib.getBotNames();
        string[10] memory personalities = VaultFactoryLib.getBotPersonalities();
        uint8[10] memory aggressiveness = VaultFactoryLib.getBotAggressiveness();
        uint8[10] memory riskTolerance = VaultFactoryLib.getBotRiskTolerance();
        
        for (uint256 i = 0; i < 10; i++) {
            CrapsVault vault = new CrapsVault(defaultAsset, i, names[i], deployer);
            vaultAddresses[i] = address(vault);
            
            vaultInfos[i] = VaultFactoryLib.VaultInfo({
                vaultAddress: vaultAddresses[i],
                asset: address(defaultAsset),
                botId: i,
                botName: names[i],
                deployedAt: block.timestamp,
                isActive: true
            });
            
            configs[i] = VaultFactoryLib.BotConfig({
                name: names[i],
                manager: deployer,
                minBet: 10 * 10**18,
                maxBet: 1000 * 10**18,
                aggressiveness: aggressiveness[i],
                riskTolerance: riskTolerance[i],
                personality: personalities[i]
            });
            
            emit VaultCreated(i, vaultAddresses[i], names[i]);
        }
    }
    
    /**
     * @notice Grant roles to vaults in batch
     */
    function grantRolesToVaults(
        address[] memory vaults,
        address gameContract,
        address botManagerContract,
        address treasuryAddress
    ) external {
        for (uint256 i = 0; i < vaults.length; i++) {
            VaultFactoryLib.grantVaultRoles(
                vaults[i],
                gameContract,
                botManagerContract,
                treasuryAddress
            );
        }
    }
}