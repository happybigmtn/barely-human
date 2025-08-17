// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BotManagerMinimal
 * @notice Minimal bot manager for demo purposes
 */
contract BotManagerMinimal is AccessControl {
    struct BotPersonality {
        uint8 aggressiveness;
        uint8 riskTolerance;
        uint8 patience;
        string name;
    }
    
    mapping(uint8 => BotPersonality) public botPersonalities;
    bool public initialized;
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function initializeBots() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!initialized, "Already initialized");
        
        // Alice All-In
        botPersonalities[0] = BotPersonality(95, 90, 10, "Alice All-In");
        
        // Bob Calculator
        botPersonalities[1] = BotPersonality(30, 20, 90, "Bob Calculator");
        
        // Charlie Lucky
        botPersonalities[2] = BotPersonality(70, 80, 50, "Charlie Lucky");
        
        // Diana Ice Queen
        botPersonalities[3] = BotPersonality(40, 30, 95, "Diana Ice Queen");
        
        // Eddie Entertainer
        botPersonalities[4] = BotPersonality(60, 70, 40, "Eddie Entertainer");
        
        // Fiona Fearless
        botPersonalities[5] = BotPersonality(85, 95, 30, "Fiona Fearless");
        
        // Greg Grinder
        botPersonalities[6] = BotPersonality(20, 25, 100, "Greg Grinder");
        
        // Helen Hot Streak
        botPersonalities[7] = BotPersonality(75, 80, 35, "Helen Hot Streak");
        
        // Ivan Intimidator
        botPersonalities[8] = BotPersonality(90, 85, 50, "Ivan Intimidator");
        
        // Julia Jinx
        botPersonalities[9] = BotPersonality(65, 75, 60, "Julia Jinx");
        
        initialized = true;
    }
    
    function getPersonality(uint8 botId) external view returns (
        uint8 aggressiveness,
        uint8 riskTolerance,
        uint8 patience,
        string memory name
    ) {
        require(botId < 10, "Invalid bot ID");
        BotPersonality memory p = botPersonalities[botId];
        return (p.aggressiveness, p.riskTolerance, p.patience, p.name);
    }
    
    function getBettingStrategy(uint8 botId, uint8) external view returns (
        uint8 strategy,
        uint256 baseBetAmount,
        uint256 currentBetAmount,
        uint256 bankrollPercentage
    ) {
        require(botId < 10, "Invalid bot ID");
        BotPersonality memory p = botPersonalities[botId];
        
        // Simple strategy based on aggressiveness
        if (p.aggressiveness > 80) {
            strategy = 0; // Aggressive
            baseBetAmount = 1000 * 10**18;
            currentBetAmount = 1000 * 10**18;
            bankrollPercentage = 20;
        } else if (p.aggressiveness > 50) {
            strategy = 1; // Moderate
            baseBetAmount = 500 * 10**18;
            currentBetAmount = 500 * 10**18;
            bankrollPercentage = 10;
        } else {
            strategy = 2; // Conservative
            baseBetAmount = 100 * 10**18;
            currentBetAmount = 100 * 10**18;
            bankrollPercentage = 5;
        }
    }
}