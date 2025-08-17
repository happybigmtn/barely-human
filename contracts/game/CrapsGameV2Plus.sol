// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "./ICrapsGame.sol";
import "./CrapsBetTypes.sol";

/**
 * @title CrapsGameV2Plus
 * @notice Main contract managing the craps game state and dice rolls
 * @dev Integrates with Chainlink VRF 2.5 for provably fair randomness
 */
contract CrapsGameV2Plus is 
    ICrapsGame, 
    VRFConsumerBaseV2Plus, 
    AccessControl, 
    ReentrancyGuard, 
    Pausable 
{
    using CrapsBetTypes for uint8;
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    // Chainlink VRF 2.5 configuration
    uint256 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 2; // Two dice
    bool private constant NATIVE_PAYMENT = false; // Pay with LINK tokens
    
    // Series data structure
    struct SeriesData {
        uint256 seriesId;
        address shooter;
        uint256 startTime;
        uint256 endTime;
        uint256 totalRolls;
        uint8[] rollHistory;  // Array of dice totals
        bool isComplete;
        uint8 finalOutcome;   // 7 for seven-out, point for point made
    }
    
    // Game state
    ShooterState public currentShooter;
    Phase public currentPhase;
    DiceRoll public lastRoll;
    uint256 public currentSeriesId;
    uint256 public totalRollsInSeries;
    
    // Request tracking
    mapping(uint256 => bool) public pendingRequests;
    mapping(uint256 => uint256) public requestToSeries;
    
    // Series history
    mapping(uint256 => SeriesData) public series;
    uint256[] public allSeries;
    
    // Events
    event DiceRequested(uint256 indexed requestId, uint256 indexed seriesId, address indexed shooter);
    event DiceRolled(uint256 indexed seriesId, uint8 die1, uint8 die2, uint8 total, address indexed shooter);
    event PhaseChanged(Phase indexed oldPhase, Phase indexed newPhase, uint256 indexed seriesId);
    event SeriesStarted(uint256 indexed seriesId, address indexed shooter);
    event SeriesEnded(uint256 indexed seriesId, address indexed shooter, uint256 totalRolls);
    
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
        
        // Initialize game state
        currentPhase = Phase.IDLE;
        currentSeriesId = 0;
        totalRollsInSeries = 0;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(SETTLEMENT_ROLE, msg.sender);
    }
    
    /**
     * @notice Start a new craps series (come out roll)
     * @param shooter Address of the shooter for this series
     */
    function startNewSeries(address shooter) 
        external 
        override 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(currentPhase == Phase.IDLE, "Game not in IDLE phase");
        require(shooter != address(0), "Invalid shooter address");
        
        // Start new series
        currentSeriesId++;
        currentShooter = ShooterState({
            shooter: shooter,
            point: 0,
            phase: Phase.COME_OUT,
            pointsMadeCount: 0,
            consecutiveWins: 0,
            fireMask: 0,
            doublesMask: 0,
            smallTallMask: 0,
            rollCount: [0,0,0,0,0,0,0,0,0,0,0,0,0],
            seriesStartBlock: block.number
        });
        
        currentPhase = Phase.COME_OUT;
        totalRollsInSeries = 0;
        
        // Initialize series data
        series[currentSeriesId] = SeriesData({
            seriesId: currentSeriesId,
            shooter: shooter,
            startTime: block.timestamp,
            endTime: 0,
            totalRolls: 0,
            rollHistory: new uint8[](0),
            isComplete: false,
            finalOutcome: 0
        });
        
        allSeries.push(currentSeriesId);
        
        emit SeriesStarted(currentSeriesId, shooter);
        emit PhaseChanged(Phase.IDLE, Phase.COME_OUT, currentSeriesId);
    }
    
    /**
     * @notice Request dice roll using VRF 2.5
     * @dev Only callable by operators during active series
     */
    function requestDiceRoll() 
        external 
        override 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (uint256 requestId) 
    {
        require(currentPhase != Phase.IDLE, "No active series");
        require(currentPhase != Phase.IDLE, "Shooter not active");
        
        // Create VRF 2.5 request
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
        
        // Track request
        pendingRequests[requestId] = true;
        requestToSeries[requestId] = currentSeriesId;
        
        emit DiceRequested(requestId, currentSeriesId, currentShooter.shooter);
        
        return requestId;
    }
    
    /**
     * @notice VRF 2.5 callback function
     * @dev Called by VRF coordinator with random numbers
     * @param requestId The VRF request ID
     * @param randomWords Array of random numbers (calldata in v2.5)
     */
    function fulfillRandomWords(
        uint256 requestId, 
        uint256[] calldata randomWords
    ) internal override {
        require(pendingRequests[requestId], "Request not found");
        require(randomWords.length >= 2, "Insufficient random words");
        
        // Clear request tracking
        pendingRequests[requestId] = false;
        uint256 seriesId = requestToSeries[requestId];
        
        // Generate dice values (1-6)
        uint8 die1 = uint8((randomWords[0] % 6) + 1);
        uint8 die2 = uint8((randomWords[1] % 6) + 1);
        uint8 total = die1 + die2;
        
        // Create dice roll
        lastRoll = DiceRoll({
            die1: die1,
            die2: die2,
            total: total,
            timestamp: block.timestamp,
            requestId: requestId
        });
        
        totalRollsInSeries++;
        
        // Update series data
        series[seriesId].totalRolls++;
        series[seriesId].rollHistory.push(total);
        
        // Handle come out roll
        if (currentPhase == Phase.COME_OUT) {
            
            if (total == 7 || total == 11) {
                // Natural win - series ends
                _endSeries(seriesId, total);
            } else if (total == 2 || total == 3 || total == 12) {
                // Craps - series ends
                _endSeries(seriesId, total);
            } else {
                // Point established
                currentShooter.point = total;
                currentShooter.phase = Phase.POINT;
                currentPhase = Phase.POINT;
                emit PhaseChanged(Phase.COME_OUT, Phase.POINT, seriesId);
            }
        } else if (currentPhase == Phase.POINT) {
            // Point phase
            if (total == currentShooter.point) {
                // Point made - series ends with win
                _endSeries(seriesId, total);
            } else if (total == 7) {
                // Seven out - series ends with loss
                _endSeries(seriesId, total);
            }
            // Continue rolling if neither point nor seven
        }
        
        emit DiceRolled(seriesId, die1, die2, total, currentShooter.shooter);
    }
    
    /**
     * @dev Internal function to end current series
     * @param seriesId The series ID to end
     * @param finalTotal The final dice total
     */
    function _endSeries(uint256 seriesId, uint8 finalTotal) internal {
        require(seriesId == currentSeriesId, "Invalid series");
        
        // Update series data
        series[seriesId].endTime = block.timestamp;
        series[seriesId].finalOutcome = finalTotal;
        series[seriesId].isComplete = true;
        
        // Reset game state
        currentPhase = Phase.IDLE;
        
        emit SeriesEnded(seriesId, currentShooter.shooter, totalRollsInSeries);
        emit PhaseChanged(currentPhase, Phase.IDLE, seriesId);
    }
    
    // Interface implementation - View functions
    function getCurrentPhase() external view override returns (Phase) {
        return currentPhase;
    }
    
    function getSeriesId() external view override returns (uint256) {
        return currentSeriesId;
    }
    
    function getCurrentShooter() external view override returns (ShooterState memory) {
        return currentShooter;
    }
    
    function getLastRoll() external view override returns (DiceRoll memory) {
        return lastRoll;
    }
    
    // Interface implementation - Game state management
    function endCurrentSeries() external override onlyRole(OPERATOR_ROLE) {
        require(currentPhase != Phase.IDLE, "No active series");
        _endSeries(currentSeriesId, 7); // Default to seven out
    }
    
    function isGameActive() external view override returns (bool) {
        return currentPhase != Phase.IDLE;
    }
    
    // Interface implementation - Bet validation
    function canPlaceBet(uint8 betType) external view override returns (bool) {
        // For now, allow all valid bet types during active games
        return currentPhase != Phase.IDLE && this.isBetTypeValid(betType);
    }
    
    function isBetTypeValid(uint8 betType) external pure override returns (bool) {
        return betType < 64; // We support 64 bet types (0-63)
    }
    
    // Additional view functions (not in interface)
    function getSeriesData(uint256 seriesId) external view returns (SeriesData memory) {
        return series[seriesId];
    }
    
    function getAllSeries() external view returns (uint256[] memory) {
        return allSeries;
    }
    
    function isRequestPending(uint256 requestId) external view returns (bool) {
        return pendingRequests[requestId];
    }
    
    // Admin functions
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }
    
    function grantSettlementRole(address settlement) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SETTLEMENT_ROLE, settlement);
    }
}