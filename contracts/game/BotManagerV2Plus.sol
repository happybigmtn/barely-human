// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title BotManagerV2Plus
 * @notice Manages AI bot personalities and their betting behavior
 * @dev Uses Chainlink VRF 2.5 for randomness in bot decision making
 */
contract BotManagerV2Plus is VRFConsumerBaseV2Plus, AccessControl, ReentrancyGuard, Pausable {
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    // Chainlink VRF 2.5 configuration
    uint256 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1; // Single random word for decisions
    bool private constant NATIVE_PAYMENT = false; // Pay with LINK tokens
    
    // Bot personality structure
    struct BotPersonality {
        uint256 id;
        string name;
        string description;
        uint8 aggressiveness;      // 1-10: How aggressive betting strategy
        uint8 riskTolerance;       // 1-10: Willingness to take risks
        uint8 patternBelief;       // 1-10: Belief in streaks/patterns
        uint8 socialInfluence;     // 1-10: Influenced by other bots
        uint8 adaptability;        // 1-10: Changes strategy based on results
        bool isActive;
        address vaultAddress;
        uint256 totalBetsPlaced;
        uint256 totalWinnings;
        uint256 totalLosses;
    }
    
    // Betting strategy structure  
    struct BettingStrategy {
        uint256 baseBetSize;       // Base bet amount in BOT tokens
        uint256 maxBetSize;        // Maximum bet size
        uint8[] preferredBetTypes; // Array of preferred bet type IDs
        uint8 streakMultiplier;    // Multiplier for hot streaks (1-5)
        bool followsStreaks;       // Whether bot follows hot/cold streaks
        bool contrarian;           // Opposite of streak following
    }
    
    // Decision request structure
    struct DecisionRequest {
        uint256 botId;
        uint256 seriesId;
        uint8 gamePhase;
        uint256 requestId;
        bool isPending;
    }
    
    // State variables
    mapping(uint256 => BotPersonality) public bots;
    mapping(uint256 => BettingStrategy) public strategies;
    mapping(uint256 => DecisionRequest) public pendingDecisions;
    mapping(uint256 => uint256) public requestToBotId;
    uint256 public totalBots;
    bool public isInitialized;
    
    // Events
    event BotCreated(uint256 indexed botId, string name, address vaultAddress);
    event BotDecisionRequested(uint256 indexed botId, uint256 requestId, uint256 seriesId);
    event BotDecisionMade(uint256 indexed botId, uint8 betType, uint256 amount, bool shouldBet);
    event BotStatsUpdated(uint256 indexed botId, uint256 totalBets, uint256 winnings, uint256 losses);
    
    /**
     * @dev Constructor initializes VRF 2.5 and roles
     * @param _vrfCoordinator Chainlink VRF 2.5 coordinator address  
     * @param _subscriptionId VRF subscription ID (uint256 in v2.5)
     * @param _keyHash Gas lane key hash for VRF requests
     */
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        require(_vrfCoordinator != address(0), "Invalid VRF coordinator");
        require(_subscriptionId != 0, "Invalid subscription ID");
        require(_keyHash != bytes32(0), "Invalid key hash");
        
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Initialize all 10 bot personalities
     * @dev Can only be called once by admin
     */
    function initializeBots() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isInitialized, "Already initialized");
        
        // Alice "All-In" - Aggressive high-roller
        _createBot(0, "Alice", "All-In Alice - Aggressive high-roller who loves big risks", 
                   10, 9, 3, 5, 4, 50000 * 10**18, 100000 * 10**18);
        
        // Bob "Calculator" - Statistical analyzer
        _createBot(1, "Bob", "Bob the Calculator - Analyzes odds and makes calculated bets",
                   4, 6, 2, 3, 8, 25000 * 10**18, 75000 * 10**18);
        
        // Charlie "Lucky" - Superstitious gambler  
        _createBot(2, "Charlie", "Lucky Charlie - Believes in signs, patterns, and superstitions",
                   6, 7, 9, 6, 5, 30000 * 10**18, 80000 * 10**18);
        
        // Diana "Ice Queen" - Cold and methodical
        _createBot(3, "Diana", "Diana Ice Queen - Emotionless and purely logical approach",
                   3, 4, 1, 2, 7, 20000 * 10**18, 60000 * 10**18);
        
        // Eddie "Entertainer" - Showman who makes it fun
        _createBot(4, "Eddie", "Eddie the Entertainer - Theatrical showman who lives for the crowd",
                   7, 8, 6, 9, 6, 35000 * 10**18, 90000 * 10**18);
        
        // Fiona "Fearless" - Never backs down
        _createBot(5, "Fiona", "Fearless Fiona - Adrenaline junkie who never backs down",
                   9, 10, 4, 4, 3, 45000 * 10**18, 95000 * 10**18);
        
        // Greg "Grinder" - Patient and steady
        _createBot(6, "Greg", "Greg the Grinder - Patient, steady, believes slow wins the race",
                   2, 3, 5, 3, 9, 15000 * 10**18, 50000 * 10**18);
        
        // Helen "Hot Streak" - Momentum based
        _createBot(7, "Helen", "Hot Streak Helen - Rides momentum and believes in streaks",
                   8, 8, 10, 7, 7, 40000 * 10**18, 85000 * 10**18);
        
        // Ivan "Intimidator" - Psychological warfare
        _createBot(8, "Ivan", "Ivan the Intimidator - Uses psychology and mind games",
                   6, 5, 7, 8, 8, 30000 * 10**18, 70000 * 10**18);
        
        // Julia "Jinx" - Claims to control luck
        _createBot(9, "Julia", "Julia Jinx - Claims mysterious power to control luck itself",
                   5, 9, 8, 5, 6, 25000 * 10**18, 75000 * 10**18);
        
        totalBots = 10;
        isInitialized = true;
    }
    
    /**
     * @dev Internal function to create a bot with personality and strategy
     */
    function _createBot(
        uint256 botId,
        string memory name,
        string memory description,
        uint8 aggressiveness,
        uint8 riskTolerance, 
        uint8 patternBelief,
        uint8 socialInfluence,
        uint8 adaptability,
        uint256 baseBet,
        uint256 maxBet
    ) internal {
        // Create personality
        bots[botId] = BotPersonality({
            id: botId,
            name: name,
            description: description,
            aggressiveness: aggressiveness,
            riskTolerance: riskTolerance,
            patternBelief: patternBelief,
            socialInfluence: socialInfluence,
            adaptability: adaptability,
            isActive: true,
            vaultAddress: address(0), // Set later by vault factory
            totalBetsPlaced: 0,
            totalWinnings: 0,
            totalLosses: 0
        });
        
        // Create betting strategy based on personality
        uint8[] memory preferredBets = new uint8[](3);
        
        if (aggressiveness >= 8) {
            // Aggressive bots prefer high-risk bets
            preferredBets[0] = 4;  // Field
            preferredBets[1] = 25; // Hard ways
            preferredBets[2] = 43; // Next roll bets
        } else if (riskTolerance <= 3) {
            // Conservative bots prefer line bets
            preferredBets[0] = 0;  // Pass line
            preferredBets[1] = 1;  // Don't pass
            preferredBets[2] = 29; // Odds (no house edge)
        } else {
            // Moderate bots mix strategies
            preferredBets[0] = 0;  // Pass line
            preferredBets[1] = 4;  // Field  
            preferredBets[2] = 5;  // Place 6
        }
        
        strategies[botId] = BettingStrategy({
            baseBetSize: baseBet,
            maxBetSize: maxBet,
            preferredBetTypes: preferredBets,
            streakMultiplier: patternBelief >= 7 ? 3 : 1,
            followsStreaks: patternBelief >= 6,
            contrarian: patternBelief <= 3
        });
        
        emit BotCreated(botId, name, address(0));
    }
    
    /**
     * @notice Request a betting decision from a specific bot
     * @param botId The bot to request decision from
     * @param seriesId Current game series ID
     * @param gamePhase Current game phase (0=IDLE, 1=COME_OUT, 2=POINT)
     * @return requestId VRF request ID
     */
    function requestBotDecision(
        uint256 botId,
        uint256 seriesId,
        uint8 gamePhase
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused returns (uint256 requestId) {
        require(botId < totalBots, "Invalid bot ID");
        require(bots[botId].isActive, "Bot not active");
        
        // Create VRF 2.5 request for randomness
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: NATIVE_PAYMENT})
                )
            })
        );
        
        // Track decision request
        pendingDecisions[requestId] = DecisionRequest({
            botId: botId,
            seriesId: seriesId,
            gamePhase: gamePhase,
            requestId: requestId,
            isPending: true
        });
        
        requestToBotId[requestId] = botId;
        
        emit BotDecisionRequested(botId, requestId, seriesId);
        return requestId;
    }
    
    /**
     * @notice VRF 2.5 callback function for bot decisions
     * @dev Called by VRF coordinator with randomness for decision making
     * @param requestId The VRF request ID
     * @param randomWords Array of random numbers (calldata in v2.5)
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        require(pendingDecisions[requestId].isPending, "Request not found");
        require(randomWords.length >= 1, "Insufficient random words");
        
        DecisionRequest storage request = pendingDecisions[requestId];
        uint256 botId = request.botId;
        uint256 randomness = randomWords[0];
        
        // Get bot personality and strategy
        BotPersonality storage bot = bots[botId];
        BettingStrategy storage strategy = strategies[botId];
        
        // Make decision based on personality and randomness
        (bool shouldBet, uint8 betType, uint256 amount) = _makeBettingDecision(
            botId, 
            randomness, 
            request.gamePhase
        );
        
        // Update bot stats if betting
        if (shouldBet) {
            bot.totalBetsPlaced++;
        }
        
        // Clear pending request
        request.isPending = false;
        
        emit BotDecisionMade(botId, betType, amount, shouldBet);
        emit BotStatsUpdated(botId, bot.totalBetsPlaced, bot.totalWinnings, bot.totalLosses);
    }
    
    /**
     * @dev Internal function to make betting decision based on bot personality
     */
    function _makeBettingDecision(
        uint256 botId,
        uint256 randomness,
        uint8 gamePhase
    ) internal view returns (bool shouldBet, uint8 betType, uint256 amount) {
        BotPersonality storage bot = bots[botId];
        BettingStrategy storage strategy = strategies[botId];
        
        // Base probability to bet based on aggressiveness (30% to 90%)
        uint256 betProbability = 30 + (bot.aggressiveness * 6);
        uint256 randomValue = randomness % 100;
        
        shouldBet = randomValue < betProbability;
        
        if (!shouldBet) {
            return (false, 0, 0);
        }
        
        // Choose bet type from preferred types
        uint256 betIndex = (randomness / 100) % strategy.preferredBetTypes.length;
        betType = strategy.preferredBetTypes[betIndex];
        
        // Calculate bet amount based on risk tolerance
        uint256 baseAmount = strategy.baseBetSize;
        uint256 riskMultiplier = 1 + ((randomness / 10000) % bot.riskTolerance);
        amount = baseAmount * riskMultiplier;
        
        // Cap at max bet size
        if (amount > strategy.maxBetSize) {
            amount = strategy.maxBetSize;
        }
        
        return (shouldBet, betType, amount);
    }
    
    // View functions
    function getBotCount() external view returns (uint256) {
        return totalBots;
    }
    
    function getBotPersonality(uint256 botId) external view returns (BotPersonality memory) {
        require(botId < totalBots, "Invalid bot ID");
        return bots[botId];
    }
    
    function getBettingStrategy(uint256 botId) external view returns (BettingStrategy memory) {
        require(botId < totalBots, "Invalid bot ID");
        return strategies[botId];
    }
    
    function getBotVault(uint256 botId) external view returns (address) {
        require(botId < totalBots, "Invalid bot ID");
        return bots[botId].vaultAddress;
    }
    
    function isDecisionPending(uint256 requestId) external view returns (bool) {
        return pendingDecisions[requestId].isPending;
    }
    
    // Admin functions
    function setBotVault(uint256 botId, address vaultAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(botId < totalBots, "Invalid bot ID");
        require(vaultAddress != address(0), "Invalid vault address");
        bots[botId].vaultAddress = vaultAddress;
    }
    
    function updateBotStats(uint256 botId, uint256 winnings, uint256 losses)
        external
        onlyRole(VAULT_ROLE)
    {
        require(botId < totalBots, "Invalid bot ID");
        bots[botId].totalWinnings += winnings;
        bots[botId].totalLosses += losses;
        
        emit BotStatsUpdated(botId, bots[botId].totalBetsPlaced, winnings, losses);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}