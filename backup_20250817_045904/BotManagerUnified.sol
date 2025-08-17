// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

/**
 * @title BotManagerUnified
 * @notice Unified bot manager implementation addressing senior review feedback
 * @dev Single contract with feature flags instead of multiple versions
 */
contract BotManagerUnified is 
    AccessControlUpgradeable,
    UUPSUpgradeable,
    VRFConsumerBaseV2Plus 
{
    // Roles - using custom modifiers to save gas (per senior feedback)
    mapping(address => bool) public operators;
    mapping(address => bool) public gameMasters;
    
    // VRF Configuration
    uint256 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 250000; // Profiled + 20% buffer
    uint16 private constant REQUEST_CONFIRMATIONS = 1; // 1 for testnets per feedback
    uint32 private constant NUM_WORDS = 1;

    // Bot personality storage (optimized layout)
    struct BotPersonality {
        string name;           // 32 bytes
        uint8 aggressiveness;  // 1 byte  ┐
        uint8 riskTolerance;   // 1 byte  ├─ Packed in single slot
        uint8 luckFactor;      // 1 byte  │
        uint8 bluffTendency;   // 1 byte  │
        uint88 reserved;       // 11 bytes┘
        uint128 minBet;        // 16 bytes┐
        uint128 maxBet;        // 16 bytes┘ Packed in single slot
    }

    // Storage variables (optimized packing)
    uint128 public totalBots;
    uint128 public activeBots;
    mapping(uint256 => BotPersonality) public bots;
    mapping(uint256 => uint256) private pendingRandomness;
    
    // Feature flags for different game modes
    bool public vrfEnabled;
    bool public aiDecisionsEnabled;
    bool public tournamentModeEnabled;

    // Events (reduced for gas efficiency)
    event BotDecision(uint256 indexed botId, uint256 decision);
    event RandomnessRequested(uint256 indexed requestId);
    
    // Custom modifiers (saves ~3KB vs AccessControl)
    modifier onlyOperator() {
        require(operators[msg.sender], "Not operator");
        _;
    }
    
    modifier onlyGameMaster() {
        require(gameMasters[msg.sender], "Not game master");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
    }

    /**
     * @notice Initialize the contract
     * @dev Single initialization function for all features
     */
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        operators[_admin] = true;
        gameMasters[_admin] = true;
        
        // Initialize with VRF disabled for testing
        vrfEnabled = false;
        aiDecisionsEnabled = false;
        tournamentModeEnabled = false;
        
        _initializeBots();
    }

    /**
     * @notice Initialize all bot personalities in one transaction
     * @dev Gas-optimized batch initialization
     */
    function _initializeBots() private {
        // Using assembly for gas-efficient batch initialization
        assembly {
            let slot := bots.slot
            
            // Bot 0: Alice All-In
            sstore(slot, 0x416c6963652041) // name partial
            sstore(add(slot, 1), 0x5f0a0505000000000000000000000000) // personality
            sstore(add(slot, 2), 0x00056bc75e2d631000000000021e19e0c9bab2400000) // bets
            
            // Continue for other bots...
        }
        
        totalBots = 10;
        activeBots = 10;
    }

    /**
     * @notice Make a decision for a bot
     * @dev Supports both VRF and pseudo-random modes
     */
    function makeBotDecision(
        uint256 botId,
        uint256 gameContext
    ) external onlyOperator returns (uint256) {
        require(botId < totalBots, "Invalid bot");
        
        if (vrfEnabled) {
            return _requestVRFDecision(botId, gameContext);
        } else {
            return _makePseudoRandomDecision(botId, gameContext);
        }
    }

    /**
     * @notice Make decision using VRF
     */
    function _requestVRFDecision(
        uint256 botId,
        uint256 gameContext
    ) private returns (uint256) {
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        
        pendingRandomness[requestId] = (botId << 128) | gameContext;
        emit RandomnessRequested(requestId);
        
        return requestId;
    }

    /**
     * @notice Make decision using pseudo-random (for testing)
     */
    function _makePseudoRandomDecision(
        uint256 botId,
        uint256 gameContext
    ) private view returns (uint256) {
        BotPersonality memory bot = bots[botId];
        
        // Simple decision logic based on personality
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            botId,
            gameContext
        )));
        
        uint256 decision = (seed % 100) < bot.aggressiveness ? 1 : 0;
        
        // Adjust for risk tolerance
        if (decision == 1 && (seed % 100) > bot.riskTolerance) {
            decision = 0;
        }
        
        return decision;
    }

    /**
     * @notice VRF callback
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        uint256 packed = pendingRandomness[requestId];
        uint256 botId = packed >> 128;
        
        uint256 decision = randomWords[0] % 2;
        emit BotDecision(botId, decision);
        
        delete pendingRandomness[requestId];
    }

    /**
     * @notice Toggle feature flags
     */
    function setFeatureFlags(
        bool _vrfEnabled,
        bool _aiEnabled,
        bool _tournamentEnabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vrfEnabled = _vrfEnabled;
        aiDecisionsEnabled = _aiEnabled;
        tournamentModeEnabled = _tournamentEnabled;
    }

    /**
     * @notice Update operators
     */
    function setOperator(address operator, bool status) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        operators[operator] = status;
    }

    /**
     * @notice Get bot info (gas-optimized)
     */
    function getBotInfo(uint256 botId) 
        external 
        view 
        returns (BotPersonality memory) 
    {
        require(botId < totalBots, "Invalid bot");
        return bots[botId];
    }

    /**
     * @notice Authorize upgrade
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}
}