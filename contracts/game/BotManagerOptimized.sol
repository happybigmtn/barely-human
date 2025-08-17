// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/BotPersonalityLib.sol";

/**
 * @title BotManagerOptimized
 * @notice Optimized bot manager using library for personality data
 */
contract BotManagerOptimized is AccessControl, ReentrancyGuard, Pausable {
    using BotPersonalityLib for uint8;
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    // Bot state tracking
    struct BotState {
        uint256 totalBets;
        uint256 totalWins;
        uint256 totalLosses;
        uint256 totalWagered;
        uint256 totalWon;
        uint256 currentBankroll;
        uint8 consecutiveWins;
        uint8 consecutiveLosses;
        uint256 lastBetAmount;
        uint8 lastBetType;
        bool isActive;
        uint256 lastActionTimestamp;
    }
    
    // State variables
    mapping(uint8 => BotState) public botStates;
    mapping(uint8 => BotPersonalityLib.BotPersonality) public botPersonalities;
    mapping(uint8 => uint256[]) public botBetHistory;
    mapping(uint8 => bool[]) public botResultHistory;
    
    uint256 public constant BASE_BET = 100 * 10**18; // 100 BOT tokens
    uint256 public constant MAX_HISTORY = 100;
    
    bool public botsInitialized;
    
    // Events
    event BotInitialized(uint8 indexed botId);
    event BotBetPlaced(uint8 indexed botId, uint8 betType, uint256 amount);
    event BotBetSettled(uint8 indexed botId, bool won, uint256 payout);
    event BotStrategyUpdated(uint8 indexed botId, BotPersonalityLib.Strategy newStrategy);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Initialize all bot personalities
     */
    function initializeBots() external onlyRole(OPERATOR_ROLE) {
        require(!botsInitialized, "Already initialized");
        
        for (uint8 i = 0; i < 10; i++) {
            botPersonalities[i] = BotPersonalityLib.initializePersonality(i);
            botStates[i] = BotState({
                totalBets: 0,
                totalWins: 0,
                totalLosses: 0,
                totalWagered: 0,
                totalWon: 0,
                currentBankroll: 10000 * 10**18, // 10,000 BOT tokens
                consecutiveWins: 0,
                consecutiveLosses: 0,
                lastBetAmount: 0,
                lastBetType: 0,
                isActive: true,
                lastActionTimestamp: block.timestamp
            });
            emit BotInitialized(i);
        }
        
        botsInitialized = true;
    }
    
    /**
     * @notice Get bot decision for next bet
     */
    function getBotDecision(uint8 botId, uint8 gamePhase) 
        external 
        view 
        returns (uint8 betType, uint256 betAmount) 
    {
        require(botId < 10, "Invalid bot ID");
        require(botsInitialized, "Bots not initialized");
        
        BotPersonalityLib.BotPersonality memory personality = botPersonalities[botId];
        BotState memory state = botStates[botId];
        
        if (!state.isActive || state.currentBankroll < BASE_BET) {
            return (255, 0); // No bet
        }
        
        // Calculate bet amount using library
        betAmount = BotPersonalityLib.calculateBetSize(
            personality.aggressiveness,
            personality.riskTolerance,
            BASE_BET,
            state.currentBankroll,
            state.consecutiveWins,
            state.consecutiveLosses
        );
        
        // Determine bet type based on personality and game phase
        if (gamePhase == 0) { // COME_OUT phase
            if (personality.aggressiveness > 70) {
                betType = 0; // Pass line
            } else if (personality.riskTolerance < 30) {
                betType = 1; // Don't pass
            } else {
                betType = 4; // Field bet
            }
        } else { // POINT phase
            uint256 rand = uint256(keccak256(abi.encodePacked(botId, block.timestamp)));
            betType = uint8(rand % 20) + 5; // Random YES/NO bet
        }
        
        return (betType, betAmount);
    }
    
    /**
     * @notice Record bot bet
     */
    function recordBotBet(uint8 botId, uint8 betType, uint256 amount) 
        external 
        onlyRole(GAME_ROLE) 
    {
        require(botId < 10, "Invalid bot ID");
        
        BotState storage state = botStates[botId];
        state.totalBets++;
        state.totalWagered += amount;
        state.lastBetAmount = amount;
        state.lastBetType = betType;
        state.lastActionTimestamp = block.timestamp;
        
        // Update history
        if (botBetHistory[botId].length >= MAX_HISTORY) {
            for (uint256 i = 0; i < MAX_HISTORY - 1; i++) {
                botBetHistory[botId][i] = botBetHistory[botId][i + 1];
            }
            botBetHistory[botId][MAX_HISTORY - 1] = amount;
        } else {
            botBetHistory[botId].push(amount);
        }
        
        emit BotBetPlaced(botId, betType, amount);
    }
    
    /**
     * @notice Record bot bet result
     */
    function recordBotResult(uint8 botId, bool won, uint256 payout) 
        external 
        onlyRole(GAME_ROLE) 
    {
        require(botId < 10, "Invalid bot ID");
        
        BotState storage state = botStates[botId];
        
        if (won) {
            state.totalWins++;
            state.totalWon += payout;
            state.currentBankroll += payout;
            state.consecutiveWins++;
            state.consecutiveLosses = 0;
        } else {
            state.totalLosses++;
            state.currentBankroll -= state.lastBetAmount;
            state.consecutiveLosses++;
            state.consecutiveWins = 0;
        }
        
        // Update result history
        if (botResultHistory[botId].length >= MAX_HISTORY) {
            for (uint256 i = 0; i < MAX_HISTORY - 1; i++) {
                botResultHistory[botId][i] = botResultHistory[botId][i + 1];
            }
            botResultHistory[botId][MAX_HISTORY - 1] = won;
        } else {
            botResultHistory[botId].push(won);
        }
        
        emit BotBetSettled(botId, won, payout);
    }
    
    /**
     * @notice Get bot statistics
     */
    function getBotStats(uint8 botId) 
        external 
        view 
        returns (
            uint256 totalBets,
            uint256 totalWins,
            uint256 winRate,
            uint256 avgBetSize,
            uint256 currentStreak,
            bool isWinStreak
        ) 
    {
        require(botId < 10, "Invalid bot ID");
        
        BotState memory state = botStates[botId];
        
        totalBets = state.totalBets;
        totalWins = state.totalWins;
        winRate = totalBets > 0 ? (totalWins * 100) / totalBets : 0;
        avgBetSize = totalBets > 0 ? state.totalWagered / totalBets : 0;
        
        if (state.consecutiveWins > 0) {
            currentStreak = state.consecutiveWins;
            isWinStreak = true;
        } else {
            currentStreak = state.consecutiveLosses;
            isWinStreak = false;
        }
    }
    
    /**
     * @notice Get bot personality
     */
    function getPersonality(uint8 botId) 
        external 
        view 
        returns (
            uint8 aggressiveness,
            uint8 riskTolerance,
            uint8 patience,
            uint8 adaptability,
            uint8 confidence,
            BotPersonalityLib.Strategy preferredStrategy,
            string memory quirk
        ) 
    {
        require(botId < 10, "Invalid bot ID");
        BotPersonalityLib.BotPersonality memory p = botPersonalities[botId];
        return (
            p.aggressiveness,
            p.riskTolerance,
            p.patience,
            p.adaptability,
            p.confidence,
            p.preferredStrategy,
            p.quirk
        );
    }
    
    /**
     * @notice Get betting strategy
     */
    function getBettingStrategy(uint8 botId, uint8) 
        external 
        view 
        returns (
            BotPersonalityLib.Strategy currentStrategy,
            uint256 baseBetAmount,
            uint256 currentBetAmount,
            uint256 bankrollPercentage
        ) 
    {
        require(botId < 10, "Invalid bot ID");
        
        BotPersonalityLib.BotPersonality memory p = botPersonalities[botId];
        BotState memory state = botStates[botId];
        
        currentStrategy = p.preferredStrategy;
        baseBetAmount = BASE_BET;
        
        currentBetAmount = BotPersonalityLib.calculateBetSize(
            p.aggressiveness,
            p.riskTolerance,
            BASE_BET,
            state.currentBankroll,
            state.consecutiveWins,
            state.consecutiveLosses
        );
        
        bankrollPercentage = state.currentBankroll > 0 
            ? (currentBetAmount * 100) / state.currentBankroll 
            : 0;
    }
    
    /**
     * @notice Pause bot operations
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause bot operations  
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
}