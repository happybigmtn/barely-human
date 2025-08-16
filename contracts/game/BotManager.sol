// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "../vault/CrapsVault.sol";
import "../vault/VaultFactoryOptimized.sol";
import "./ICrapsGame.sol";

/**
 * @title BotManager
 * @notice Manages automated bot players with unique personalities and strategies
 * @dev Integrates with vaults for funding and game contracts for betting
 */
contract BotManager is VRFConsumerBaseV2, AccessControl, ReentrancyGuard, Pausable {
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    // Chainlink VRF configuration
    VRFCoordinatorV2Interface private immutable COORDINATOR;
    uint64 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 150000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    
    // Bot strategy types
    enum Strategy {
        CONSERVATIVE,    // Low risk, small bets
        AGGRESSIVE,      // High risk, large bets
        MARTINGALE,      // Double after loss
        FIBONACCI,       // Fibonacci sequence betting
        PAROLI,          // Positive progression
        DALEMBERT,       // Increase after loss, decrease after win
        OSCAR_GRIND,     // Small profit target per session
        RANDOM,          // Random bet amounts
        ADAPTIVE,        // Adjusts based on bankroll
        MIXED            // Combines multiple strategies
    }
    
    // Bot state
    struct BotState {
        uint256 botId;
        address vault;
        Strategy currentStrategy;
        uint256 baseBetAmount;
        uint256 currentBetAmount;
        uint256 consecutiveWins;
        uint256 consecutiveLosses;
        uint256 sessionProfit;
        uint256 sessionStartBalance;
        uint256 lastActionTimestamp;
        bool isActive;
        bool isInSeries;
        uint256 currentSeriesId;
        uint256 currentBetId;
    }
    
    // Bot personality traits
    struct BotPersonality {
        uint8 aggressiveness;   // 0-100
        uint8 riskTolerance;    // 0-100
        uint8 patience;         // 0-100
        uint8 adaptability;     // 0-100
        uint8 confidence;       // 0-100, changes based on results
        Strategy preferredStrategy;
        string quirk;           // Unique behavioral trait
    }
    
    // Betting decision factors
    struct DecisionFactors {
        uint256 bankrollPercentage;  // What % of bankroll to risk
        uint256 winProbability;      // Estimated win probability
        uint256 recentPerformance;   // Recent win rate
        uint256 tableTemperature;    // "Hot" or "cold" table
        bool shouldBet;              // Final decision
    }
    
    // State variables
    mapping(uint256 => BotState) public botStates;
    mapping(uint256 => BotPersonality) public botPersonalities;
    mapping(uint256 => uint256[]) public botBetHistory;
    mapping(uint256 => bool[]) public botResultHistory;
    mapping(uint256 => uint256) public pendingDecisions;
    
    VaultFactoryOptimized public immutable vaultFactory;
    ICrapsGame public gameContract;
    
    uint256 public constant MAX_BET_PERCENTAGE = 1000; // 10% of bankroll max
    uint256 public constant MIN_BET_PERCENTAGE = 10;   // 0.1% of bankroll min
    uint256 public sessionNumber;
    uint256 public totalBetsPlaced;
    uint256 public totalBetsWon;
    
    // Timing configuration
    uint256 public minBetInterval = 30 seconds;
    uint256 public maxInactivityPeriod = 1 hours;
    
    // Events
    event BotDecisionMade(
        uint256 indexed botId,
        uint256 betAmount,
        Strategy strategy,
        uint256 confidence
    );
    event BotBetPlaced(
        uint256 indexed botId,
        uint256 seriesId,
        uint256 betAmount,
        uint256 betId
    );
    event BotBetSettled(
        uint256 indexed botId,
        uint256 betId,
        bool won,
        uint256 payout
    );
    event BotStrategyChanged(
        uint256 indexed botId,
        Strategy oldStrategy,
        Strategy newStrategy
    );
    event BotSessionStarted(uint256 indexed botId, uint256 sessionNumber);
    event BotSessionEnded(
        uint256 indexed botId,
        uint256 sessionNumber,
        int256 profit
    );
    
    /**
     * @notice Constructor
     * @param _vaultFactory The vault factory contract
     * @param _vrfCoordinator Chainlink VRF coordinator
     * @param _subscriptionId VRF subscription ID
     * @param _keyHash VRF key hash
     */
    constructor(
        address _vaultFactory,
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        require(_vaultFactory != address(0), "Invalid factory");
        
        vaultFactory = VaultFactoryOptimized(_vaultFactory);
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
    }
    
    /**
     * @notice Initialize bot personalities
     */
    function initializeBots() external onlyRole(OPERATOR_ROLE) {
        // Initialize the 10 unique bot personalities
        _initializeBot(0, 30, 40, 80, 60, Strategy.CONSERVATIVE, "Always bets on field");
        _initializeBot(1, 90, 95, 20, 40, Strategy.AGGRESSIVE, "Goes all-in on hot streaks");
        _initializeBot(2, 70, 80, 50, 70, Strategy.MARTINGALE, "Never gives up after a loss");
        _initializeBot(3, 40, 30, 90, 80, Strategy.FIBONACCI, "Follows mathematical patterns");
        _initializeBot(4, 20, 25, 95, 50, Strategy.OSCAR_GRIND, "Slow and steady wins");
        _initializeBot(5, 85, 90, 30, 60, Strategy.PAROLI, "Rides the winning waves");
        _initializeBot(6, 50, 45, 70, 90, Strategy.ADAPTIVE, "Learns from the table");
        _initializeBot(7, 95, 100, 10, 30, Strategy.RANDOM, "Pure chaos incarnate");
        _initializeBot(8, 15, 10, 100, 40, Strategy.DALEMBERT, "Extremely cautious");
        _initializeBot(9, 75, 85, 40, 100, Strategy.MIXED, "Jack of all strategies");
    }
    
    /**
     * @notice Initialize a single bot
     */
    function _initializeBot(
        uint256 botId,
        uint8 aggressiveness,
        uint8 riskTolerance,
        uint8 patience,
        uint8 adaptability,
        Strategy strategy,
        string memory quirk
    ) internal {
        address vault = vaultFactory.getVault(botId);
        require(vault != address(0), "Vault not found");
        
        botPersonalities[botId] = BotPersonality({
            aggressiveness: aggressiveness,
            riskTolerance: riskTolerance,
            patience: patience,
            adaptability: adaptability,
            confidence: 50, // Start neutral
            preferredStrategy: strategy,
            quirk: quirk
        });
        
        botStates[botId] = BotState({
            botId: botId,
            vault: vault,
            currentStrategy: strategy,
            baseBetAmount: 100 * 10**18, // 100 BOT tokens base bet
            currentBetAmount: 100 * 10**18, // 100 BOT tokens current bet
            consecutiveWins: 0,
            consecutiveLosses: 0,
            sessionProfit: 0,
            sessionStartBalance: 0,
            lastActionTimestamp: block.timestamp,
            isActive: true,
            isInSeries: false,
            currentSeriesId: 0,
            currentBetId: 0
        });
    }
    
    /**
     * @notice Make betting decision for a bot
     */
    function makeBettingDecision(uint256 botId) 
        external 
        onlyRole(KEEPER_ROLE) 
        whenNotPaused 
        returns (bool shouldBet, uint256 betAmount) 
    {
        BotState storage bot = botStates[botId];
        require(bot.isActive, "Bot not active");
        require(!bot.isInSeries, "Bot already in series");
        require(
            block.timestamp >= bot.lastActionTimestamp + minBetInterval,
            "Too soon for next bet"
        );
        
        // Get vault balance
        CrapsVault vault = CrapsVault(bot.vault);
        uint256 vaultBalance = vault.totalAssets();
        
        if (vaultBalance == 0) {
            return (false, 0);
        }
        
        // Calculate decision factors
        DecisionFactors memory factors = _calculateDecisionFactors(botId, vaultBalance);
        
        if (factors.shouldBet) {
            betAmount = _calculateBetAmount(botId, vaultBalance, factors);
            
            // Ensure bet is within vault limits
            if (vault.canPlaceBet(betAmount)) {
                // Request randomness for additional decision variance
                uint256 requestId = COORDINATOR.requestRandomWords(
                    keyHash,
                    subscriptionId,
                    REQUEST_CONFIRMATIONS,
                    CALLBACK_GAS_LIMIT,
                    NUM_WORDS
                );
                
                pendingDecisions[requestId] = botId;
                
                emit BotDecisionMade(
                    botId,
                    betAmount,
                    bot.currentStrategy,
                    botPersonalities[botId].confidence
                );
                
                return (true, betAmount);
            }
        }
        
        return (false, 0);
    }
    
    /**
     * @notice Calculate decision factors for betting
     */
    function _calculateDecisionFactors(uint256 botId, uint256 /* vaultBalance */) 
        internal 
        view 
        returns (DecisionFactors memory) 
    {
        BotPersonality storage personality = botPersonalities[botId];
        BotState storage bot = botStates[botId];
        
        // Calculate recent performance
        uint256 recentWins = 0;
        uint256 recentBets = botResultHistory[botId].length;
        if (recentBets > 0) {
            uint256 lookback = recentBets > 10 ? 10 : recentBets;
            for (uint256 i = recentBets - lookback; i < recentBets; i++) {
                if (botResultHistory[botId][i]) {
                    recentWins++;
                }
            }
        }
        
        uint256 recentPerformance = recentBets > 0 ? (recentWins * 100) / 
            (recentBets > 10 ? 10 : recentBets) : 50;
        
        // Determine table temperature (simplified)
        uint256 tableTemp = 50; // Neutral
        if (bot.consecutiveWins > 2) {
            tableTemp = 70; // Hot
        } else if (bot.consecutiveLosses > 2) {
            tableTemp = 30; // Cold
        }
        
        // Calculate if should bet based on personality
        bool shouldBet = true;
        
        // Patient bots wait after losses
        if (personality.patience > 70 && bot.consecutiveLosses > 1) {
            shouldBet = (personality.confidence > 40);
        }
        
        // Aggressive bots almost always bet
        if (personality.aggressiveness > 80) {
            shouldBet = true;
        }
        
        // Conservative bots are selective
        if (personality.aggressiveness < 30) {
            shouldBet = (tableTemp > 40 && personality.confidence > 30);
        }
        
        // Calculate bankroll percentage to risk
        uint256 bankrollPct = (personality.riskTolerance * MAX_BET_PERCENTAGE) / 100;
        if (bankrollPct < MIN_BET_PERCENTAGE) {
            bankrollPct = MIN_BET_PERCENTAGE;
        }
        
        return DecisionFactors({
            bankrollPercentage: bankrollPct,
            winProbability: 49, // Simplified craps probability
            recentPerformance: recentPerformance,
            tableTemperature: tableTemp,
            shouldBet: shouldBet
        });
    }
    
    /**
     * @notice Calculate bet amount based on strategy
     */
    function _calculateBetAmount(
        uint256 botId,
        uint256 vaultBalance,
        DecisionFactors memory factors
    ) internal returns (uint256) {
        BotState storage bot = botStates[botId];
        BotPersonality storage personality = botPersonalities[botId];
        
        uint256 betAmount = bot.baseBetAmount;
        
        if (bot.currentStrategy == Strategy.CONSERVATIVE) {
            betAmount = (vaultBalance * MIN_BET_PERCENTAGE) / 10000;
            
        } else if (bot.currentStrategy == Strategy.AGGRESSIVE) {
            betAmount = (vaultBalance * factors.bankrollPercentage) / 10000;
            
        } else if (bot.currentStrategy == Strategy.MARTINGALE) {
            if (bot.consecutiveLosses > 0) {
                betAmount = bot.currentBetAmount * 2;
                if (betAmount > (vaultBalance * MAX_BET_PERCENTAGE) / 10000) {
                    betAmount = bot.baseBetAmount; // Reset
                }
            }
            
        } else if (bot.currentStrategy == Strategy.FIBONACCI) {
            betAmount = _calculateFibonacciBet(botId, vaultBalance);
            
        } else if (bot.currentStrategy == Strategy.PAROLI) {
            if (bot.consecutiveWins > 0 && bot.consecutiveWins < 3) {
                betAmount = bot.currentBetAmount * 2;
            } else {
                betAmount = bot.baseBetAmount;
            }
            
        } else if (bot.currentStrategy == Strategy.DALEMBERT) {
            if (bot.consecutiveLosses > 0) {
                betAmount = bot.currentBetAmount + bot.baseBetAmount;
            } else if (bot.consecutiveWins > 0 && bot.currentBetAmount > bot.baseBetAmount) {
                betAmount = bot.currentBetAmount - bot.baseBetAmount;
            }
            
        } else if (bot.currentStrategy == Strategy.OSCAR_GRIND) {
            if (bot.sessionProfit < bot.baseBetAmount * 10) {
                if (bot.consecutiveWins > 0) {
                    betAmount = bot.currentBetAmount + bot.baseBetAmount;
                }
            } else {
                betAmount = bot.baseBetAmount; // Target reached, reset
            }
            
        } else if (bot.currentStrategy == Strategy.ADAPTIVE) {
            // Adjust based on confidence and recent performance
            uint256 confidenceFactor = personality.confidence > 50 ? 
                personality.confidence - 50 : 0;
            betAmount = bot.baseBetAmount * (100 + confidenceFactor) / 100;
            
        } else if (bot.currentStrategy == Strategy.RANDOM) {
            // Will be determined by VRF callback
            betAmount = bot.baseBetAmount;
            
        } else if (bot.currentStrategy == Strategy.MIXED) {
            // Switch strategies based on performance
            if (bot.consecutiveLosses > 2) {
                bot.currentStrategy = Strategy.CONSERVATIVE;
            } else if (bot.consecutiveWins > 2) {
                bot.currentStrategy = Strategy.AGGRESSIVE;
            }
            betAmount = _calculateBetAmount(botId, vaultBalance, factors);
        }
        
        // Ensure bet is within limits
        uint256 maxBet = (vaultBalance * MAX_BET_PERCENTAGE) / 10000;
        uint256 minBet = (vaultBalance * MIN_BET_PERCENTAGE) / 10000;
        
        if (betAmount > maxBet) betAmount = maxBet;
        if (betAmount < minBet) betAmount = minBet;
        
        bot.currentBetAmount = betAmount;
        
        return betAmount;
    }
    
    /**
     * @notice Calculate Fibonacci bet amount
     */
    function _calculateFibonacciBet(uint256 botId, uint256 vaultBalance) 
        internal 
        view 
        returns (uint256) 
    {
        BotState storage bot = botStates[botId];
        uint256 betAmount = bot.baseBetAmount;
        
        if (bot.consecutiveLosses == 0) {
            return betAmount;
        }
        
        uint256 fib1 = bot.baseBetAmount;
        uint256 fib2 = bot.baseBetAmount;
        
        for (uint256 i = 0; i < bot.consecutiveLosses && i < 10; i++) {
            uint256 nextFib = fib1 + fib2;
            fib1 = fib2;
            fib2 = nextFib;
        }
        
        betAmount = fib2;
        
        uint256 maxBet = (vaultBalance * MAX_BET_PERCENTAGE) / 10000;
        if (betAmount > maxBet) {
            betAmount = bot.baseBetAmount; // Reset sequence
        }
        
        return betAmount;
    }
    
    /**
     * @notice Place bet for bot
     */
    function placeBotBet(uint256 botId, uint256 seriesId) 
        external 
        onlyRole(KEEPER_ROLE) 
        nonReentrant 
        returns (uint256 betId) 
    {
        BotState storage bot = botStates[botId];
        require(bot.isActive, "Bot not active");
        require(!bot.isInSeries, "Already in series");
        
        CrapsVault vault = CrapsVault(bot.vault);
        betId = vault.placeBet(bot.currentBetAmount, seriesId);
        
        bot.isInSeries = true;
        bot.currentSeriesId = seriesId;
        bot.currentBetId = betId;
        bot.lastActionTimestamp = block.timestamp;
        
        botBetHistory[botId].push(bot.currentBetAmount);
        totalBetsPlaced++;
        
        emit BotBetPlaced(botId, seriesId, bot.currentBetAmount, betId);
        
        return betId;
    }
    
    /**
     * @notice Settle bot bet
     */
    function settleBotBet(
        uint256 botId,
        uint256 betId,
        uint256 payout
    ) external onlyRole(KEEPER_ROLE) nonReentrant {
        BotState storage bot = botStates[botId];
        require(bot.currentBetId == betId, "Invalid bet ID");
        
        bool won = payout > bot.currentBetAmount;
        
        // Update bot state
        if (won) {
            bot.consecutiveWins++;
            bot.consecutiveLosses = 0;
            bot.sessionProfit += (payout - bot.currentBetAmount);
            totalBetsWon++;
            
            // Increase confidence
            BotPersonality storage personality = botPersonalities[botId];
            if (personality.confidence < 100) {
                personality.confidence += 5;
            }
        } else {
            bot.consecutiveLosses++;
            bot.consecutiveWins = 0;
            if (bot.sessionProfit >= bot.currentBetAmount) {
                bot.sessionProfit -= bot.currentBetAmount;
            } else {
                bot.sessionProfit = 0;
            }
            
            // Decrease confidence
            BotPersonality storage personality = botPersonalities[botId];
            if (personality.confidence > 0) {
                personality.confidence = personality.confidence > 5 ? 
                    personality.confidence - 5 : 0;
            }
        }
        
        // Update history
        botResultHistory[botId].push(won);
        
        // Settle in vault
        CrapsVault vault = CrapsVault(bot.vault);
        vault.settleBet(betId, payout);
        
        // Reset for next bet
        bot.isInSeries = false;
        bot.currentSeriesId = 0;
        bot.currentBetId = 0;
        
        // Consider strategy change for adaptive bots
        if (botPersonalities[botId].adaptability > 70) {
            _considerStrategyChange(botId);
        }
        
        emit BotBetSettled(botId, betId, won, payout);
    }
    
    /**
     * @notice Consider changing strategy based on performance
     */
    function _considerStrategyChange(uint256 botId) internal {
        BotState storage bot = botStates[botId];
        BotPersonality storage personality = botPersonalities[botId];
        
        Strategy oldStrategy = bot.currentStrategy;
        
        // Change strategy based on consecutive results
        if (bot.consecutiveLosses > 3) {
            if (personality.riskTolerance < 50) {
                bot.currentStrategy = Strategy.CONSERVATIVE;
            } else {
                bot.currentStrategy = Strategy.MARTINGALE;
            }
        } else if (bot.consecutiveWins > 3) {
            if (personality.aggressiveness > 70) {
                bot.currentStrategy = Strategy.PAROLI;
            }
        } else if (personality.confidence < 30) {
            bot.currentStrategy = Strategy.OSCAR_GRIND;
        } else if (personality.confidence > 70) {
            bot.currentStrategy = personality.preferredStrategy;
        }
        
        if (oldStrategy != bot.currentStrategy) {
            emit BotStrategyChanged(botId, oldStrategy, bot.currentStrategy);
        }
    }
    
    /**
     * @notice VRF callback for random decisions
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        uint256 botId = pendingDecisions[requestId];
        if (botId < 10) {
            BotState storage bot = botStates[botId];
            
            // Use randomness to add variance to bet amounts for RANDOM strategy
            if (bot.currentStrategy == Strategy.RANDOM) {
                uint256 randomFactor = (randomWords[0] % 100) + 50; // 50-150%
                bot.currentBetAmount = (bot.currentBetAmount * randomFactor) / 100;
            }
            
            // Add some randomness to confidence adjustments
            BotPersonality storage personality = botPersonalities[botId];
            uint256 confidenceAdjust = randomWords[0] % 10;
            if (confidenceAdjust < 3 && personality.confidence < 95) {
                personality.confidence += 5;
            } else if (confidenceAdjust > 7 && personality.confidence > 5) {
                personality.confidence -= 5;
            }
        }
        
        delete pendingDecisions[requestId];
    }
    
    /**
     * @notice Start new session for bot
     */
    function startBotSession(uint256 botId) external onlyRole(KEEPER_ROLE) {
        BotState storage bot = botStates[botId];
        require(bot.isActive, "Bot not active");
        require(!bot.isInSeries, "Bot in active series");
        
        CrapsVault vault = CrapsVault(bot.vault);
        bot.sessionStartBalance = vault.totalAssets();
        bot.sessionProfit = 0;
        bot.consecutiveWins = 0;
        bot.consecutiveLosses = 0;
        
        sessionNumber++;
        
        emit BotSessionStarted(botId, sessionNumber);
    }
    
    /**
     * @notice End session for bot
     */
    function endBotSession(uint256 botId) external onlyRole(KEEPER_ROLE) {
        BotState storage bot = botStates[botId];
        require(!bot.isInSeries, "Bot in active series");
        
        CrapsVault vault = CrapsVault(bot.vault);
        uint256 currentBalance = vault.totalAssets();
        int256 profit = int256(currentBalance) - int256(bot.sessionStartBalance);
        
        emit BotSessionEnded(botId, sessionNumber, profit);
        
        // Reset session data
        bot.sessionProfit = 0;
        bot.sessionStartBalance = 0;
    }
    
    /**
     * @notice Set game contract
     */
    function setGameContract(address _gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameContract != address(0), "Invalid address");
        gameContract = ICrapsGame(_gameContract);
    }
    
    /**
     * @notice Update timing parameters
     */
    function updateTimingParams(
        uint256 _minBetInterval,
        uint256 _maxInactivityPeriod
    ) external onlyRole(OPERATOR_ROLE) {
        minBetInterval = _minBetInterval;
        maxInactivityPeriod = _maxInactivityPeriod;
    }
    
    /**
     * @notice Toggle bot active status
     */
    function toggleBotActive(uint256 botId) external onlyRole(OPERATOR_ROLE) {
        botStates[botId].isActive = !botStates[botId].isActive;
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get bot statistics
     */
    function getBotStats(uint256 botId) external view returns (
        uint256 totalBets,
        uint256 totalWins,
        uint256 winRate,
        uint256 avgBetSize,
        uint256 currentStreak,
        bool isWinStreak
    ) {
        BotState storage bot = botStates[botId];
        
        totalBets = botBetHistory[botId].length;
        
        for (uint256 i = 0; i < botResultHistory[botId].length; i++) {
            if (botResultHistory[botId][i]) {
                totalWins++;
            }
        }
        
        winRate = totalBets > 0 ? (totalWins * 100) / totalBets : 0;
        
        uint256 totalBetAmount;
        for (uint256 i = 0; i < botBetHistory[botId].length; i++) {
            totalBetAmount += botBetHistory[botId][i];
        }
        avgBetSize = totalBets > 0 ? totalBetAmount / totalBets : 0;
        
        if (bot.consecutiveWins > 0) {
            currentStreak = bot.consecutiveWins;
            isWinStreak = true;
        } else {
            currentStreak = bot.consecutiveLosses;
            isWinStreak = false;
        }
    }
    
    /**
     * @notice Get bot personality
     */
    function getPersonality(uint8 botId) external view returns (
        uint8 aggressiveness,
        uint8 riskTolerance,
        uint8 patience,
        uint8 adaptability,
        uint8 confidence,
        Strategy preferredStrategy,
        string memory quirk
    ) {
        require(botId < 10, "Invalid bot ID");
        BotPersonality storage personality = botPersonalities[botId];
        return (
            personality.aggressiveness,
            personality.riskTolerance,
            personality.patience,
            personality.adaptability,
            personality.confidence,
            personality.preferredStrategy,
            personality.quirk
        );
    }
    
    /**
     * @notice Get bot betting strategy for a specific game phase
     */
    function getBettingStrategy(uint8 botId, uint8 gamePhase) external view returns (
        Strategy currentStrategy,
        uint256 baseBetAmount,
        uint256 currentBetAmount,
        uint256 bankrollPercentage
    ) {
        require(botId < 10, "Invalid bot ID");
        BotState storage bot = botStates[botId];
        BotPersonality storage personality = botPersonalities[botId];
        
        // Calculate bankroll percentage based on risk tolerance
        uint256 bankrollPct = (personality.riskTolerance * MAX_BET_PERCENTAGE) / 100;
        if (bankrollPct < MIN_BET_PERCENTAGE) {
            bankrollPct = MIN_BET_PERCENTAGE;
        }
        
        // Adjust strategy based on game phase
        Strategy strategyForPhase = bot.currentStrategy;
        if (gamePhase == 1) { // COME_OUT
            if (personality.aggressiveness > 70) {
                strategyForPhase = Strategy.AGGRESSIVE;
            }
        } else if (gamePhase == 2) { // POINT
            if (personality.patience > 70) {
                strategyForPhase = Strategy.CONSERVATIVE;
            }
        }
        
        return (
            strategyForPhase,
            bot.baseBetAmount,
            bot.currentBetAmount,
            bankrollPct
        );
    }
}