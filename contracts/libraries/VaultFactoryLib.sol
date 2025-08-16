// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../vault/CrapsVault.sol";

/**
 * @title VaultFactoryLib
 * @notice Library for VaultFactory operations to reduce contract size
 */
library VaultFactoryLib {
    struct BotConfig {
        string name;
        address manager;
        uint256 minBet;
        uint256 maxBet;
        uint8 aggressiveness;
        uint8 riskTolerance;
        string personality;
    }
    
    struct VaultInfo {
        address vaultAddress;
        address asset;
        uint256 botId;
        string botName;
        uint256 deployedAt;
        bool isActive;
    }
    
    /**
     * @notice Get predefined bot names
     */
    function getBotNames() internal pure returns (string[10] memory) {
        return [
            "Lucky", "Dice Devil", "Risk Taker", "Calculator",
            "Zen Master", "Hot Shot", "Cool Hand", "Wild Card",
            "Steady Eddie", "Maverick"
        ];
    }
    
    /**
     * @notice Get predefined bot personalities
     */
    function getBotPersonalities() internal pure returns (string[10] memory) {
        return [
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
    }
    
    /**
     * @notice Get predefined bot aggressiveness levels
     */
    function getBotAggressiveness() internal pure returns (uint8[10] memory) {
        return [30, 90, 70, 40, 20, 85, 50, 95, 15, 75];
    }
    
    /**
     * @notice Get predefined bot risk tolerance levels
     */
    function getBotRiskTolerance() internal pure returns (uint8[10] memory) {
        return [40, 95, 80, 30, 25, 90, 45, 100, 10, 85];
    }
    
    /**
     * @notice Grant roles to a vault
     */
    function grantVaultRoles(
        address vaultAddress,
        address gameContract,
        address botManagerContract,
        address treasuryAddress
    ) internal {
        CrapsVault vault = CrapsVault(vaultAddress);
        
        if (gameContract != address(0)) {
            vault.grantRole(vault.GAME_ROLE(), gameContract);
        }
        if (botManagerContract != address(0)) {
            vault.grantRole(vault.MANAGER_ROLE(), botManagerContract);
        }
        if (treasuryAddress != address(0)) {
            vault.grantRole(vault.FEE_COLLECTOR_ROLE(), treasuryAddress);
        }
    }
    
    /**
     * @notice Count active vaults
     */
    function countActiveVaults(
        mapping(uint256 => VaultInfo) storage vaults,
        uint256 nextBotId
    ) internal view returns (uint256 count) {
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) {
                count++;
            }
        }
    }
    
    /**
     * @notice Collect active vault addresses
     */
    function collectActiveVaults(
        mapping(uint256 => VaultInfo) storage vaults,
        uint256 nextBotId,
        uint256 activeCount
    ) internal view returns (address[] memory) {
        address[] memory activeVaults = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < nextBotId; i++) {
            if (vaults[i].isActive) {
                activeVaults[index++] = vaults[i].vaultAddress;
            }
        }
        
        return activeVaults;
    }
}